// MENU-07: bulk menu import, scoped to CSV (not raw .xlsx — avoids adding a
// binary spreadsheet-parsing dependency; Excel exports to CSV trivially).
// Expected columns (header row required, order doesn't matter):
//   name, price, category, veg, description
// "veg" accepts veg/non-veg/nonveg/yes/no/true/false, case-insensitive,
// defaulting to veg (matches menu_items.is_veg's own default).
import type { MenuCategory, MenuItemRow } from '@alphabot/shared';

export interface ParsedMenuRow {
  name:         string;
  priceRupees:  number;
  category:     string | null;
  isVeg:        boolean;
  description:  string | null;
}

export interface ParseResult {
  rows:   ParsedMenuRow[];
  errors: string[]; // line-level problems; parsing continues past them
}

/** RFC4180-ish line splitter — handles quoted fields with embedded commas/quotes. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map(f => f.trim());
}

function parseVeg(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return !['non-veg', 'nonveg', 'non veg', 'no', 'false', '0'].includes(v);
}

export function parseMenuCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: ['File is empty'] };

  const header = parseCsvLine(lines[0]!).map(h => h.toLowerCase());
  const nameIdx  = header.indexOf('name');
  const priceIdx = header.indexOf('price');
  const catIdx   = header.indexOf('category');
  const vegIdx   = header.indexOf('veg');
  const descIdx  = header.indexOf('description');

  if (nameIdx === -1 || priceIdx === -1) {
    return { rows: [], errors: ['Header row must include at least "name" and "price" columns'] };
  }

  const rows: ParsedMenuRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]!);
    const name = fields[nameIdx]?.trim();
    if (!name) { errors.push(`Row ${i + 1}: missing name — skipped`); continue; }

    const priceRaw = fields[priceIdx]?.trim() ?? '';
    const priceRupees = Number(priceRaw.replace(/[₹,\s]/g, ''));
    if (!Number.isFinite(priceRupees) || priceRupees < 0) {
      errors.push(`Row ${i + 1} (${name}): invalid price "${priceRaw}" — skipped`);
      continue;
    }

    rows.push({
      name,
      priceRupees,
      category:    catIdx  !== -1 ? (fields[catIdx]?.trim() || null) : null,
      isVeg:       vegIdx  !== -1 ? parseVeg(fields[vegIdx]) : true,
      description: descIdx !== -1 ? (fields[descIdx]?.trim() || null) : null,
    });
  }

  return { rows, errors };
}

export type MenuImportChangeField = 'price' | 'category' | 'veg' | 'description';

export interface MenuImportDiff {
  added:   ParsedMenuRow[];
  changed: Array<{ row: ParsedMenuRow; existing: MenuItemRow; fields: MenuImportChangeField[] }>;
  unchangedCount: number;
  newCategoryNames: string[];
}

/** Pure diff computation — no DB access, so the preview and apply steps can share one source of truth. */
export function buildMenuImportDiff(
  rows:               ParsedMenuRow[],
  existingItems:      MenuItemRow[],
  existingCategories: MenuCategory[],
): MenuImportDiff {
  const byName = new Map(existingItems.map(i => [i.name.toLowerCase(), i]));
  const categoryNameById = new Map(existingCategories.map(c => [c.id, c.name]));
  const existingCategoryNames = new Set(existingCategories.map(c => c.name.toLowerCase()));

  const added: ParsedMenuRow[] = [];
  const changed: MenuImportDiff['changed'] = [];
  let unchangedCount = 0;
  const newCategoryNames = new Set<string>();

  for (const row of rows) {
    const existing = byName.get(row.name.toLowerCase());
    if (!existing) {
      added.push(row);
      if (row.category && !existingCategoryNames.has(row.category.toLowerCase())) {
        newCategoryNames.add(row.category);
      }
      continue;
    }

    const fields: MenuImportChangeField[] = [];
    if (Math.round(row.priceRupees * 100) !== existing.price_paise) fields.push('price');
    if (row.isVeg !== existing.is_veg) fields.push('veg');
    if ((row.description ?? '') !== (existing.description ?? '')) fields.push('description');
    const existingCategoryName = existing.category_id ? (categoryNameById.get(existing.category_id) ?? null) : null;
    if ((row.category ?? null) !== null && (row.category ?? '').toLowerCase() !== (existingCategoryName ?? '').toLowerCase()) {
      fields.push('category');
      if (row.category && !existingCategoryNames.has(row.category.toLowerCase())) {
        newCategoryNames.add(row.category);
      }
    }

    if (fields.length === 0) unchangedCount++;
    else changed.push({ row, existing, fields });
  }

  return { added, changed, unchangedCount, newCategoryNames: [...newCategoryNames] };
}
