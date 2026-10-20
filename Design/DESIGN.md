# KOT.ai — Design System and Visual Direction

> For Claude Code. Place at `docs/DESIGN.md`. Logo files go in `packages/brand/assets/` (and the favicons/app icons in `apps/web/public/`).
> This document is the source of truth for how every KOT.ai screen looks. `KOTAI_BUILD_BRIEF.md` §14 summarises it; where they differ, this file wins.

---

## 1. The idea: the kitchen pass

In every Indian restaurant kitchen, orders arrive as **KOT slips** — thermal-printed tickets that get pinned to a steel rail at the pass, read by the chef, and torn off when the food goes out. KOT.ai is that moment, moved onto WhatsApp.

The whole visual language comes from that world:

| Material | Becomes |
|---|---|
| Thermal paper | Light background and ticket surfaces (`Paper`) |
| Thermal print | Text and the logo ticket (`Ink`) |
| Steel ticket rail | Thin rails, dividers, the live-orders strip (`Steel`) |
| Saffron / chilli in the kitchen | The single brand accent (`Saffron`) |
| Torn ticket edge | The zigzag edge — used only on order tickets |

**Spend the boldness in one place: the live-orders ticket rail.** Every other screen is calm, quiet and fast to read. A restaurant manager glances at this at 1:15 pm with 14 orders open — clarity beats decoration.

Personality: confident, practical, warm, quick. Not playful, not corporate, not "AI-glow".

---

## 2. Logo

Files (all text converted to outlines, no font dependency):

| File | Use |
|---|---|
| `kotai-logo-light.svg` / `.png` | Default logo on light backgrounds |
| `kotai-logo-dark.svg` / `.png` | Logo on Ink / dark mode |
| `kotai-logo-light-tagline.svg` / `.png`, `kotai-logo-dark-tagline.svg` | Login page, marketing, email header, decks |
| `kotai-mark.svg`, `kotai-mark-dark.svg` | Collapsed sidebar, loading state, small spaces |
| `kotai-app-icon.svg`, `-512.png`, `-180.png` | PWA icon, apple-touch-icon, app stores |
| `kotai-whatsapp-profile.svg` / `.png` (640×640) | KOT.ai's own WhatsApp number profile photo (WhatsApp crops to a circle; artwork is centred) |
| `kotai-favicon.svg`, `-32.png`, `-48.png` | Browser favicon (simplified mark: two lines, badge without dots) |

Rules:
- **Clear space** around the logo = the height of the badge circle on all sides.
- **Minimum size:** full logo 120 px wide on screen; below that use the mark; below 48 px use the favicon mark.
- Never recolour the wordmark, stretch, add shadows/gradients, place the light logo on photos, or use WhatsApp green with it.
- The logo appears on KOT.ai surfaces only. **Restaurant-facing customer pages show the restaurant's logo** with a small "Powered by KOT.ai" mark in the footer.

---

## 3. Colour

### 3.1 Core palette

| Name | Hex | Role |
|---|---|---|
| **Ink** | `#16181D` | Text, logo ticket, dark-mode background |
| **Paper** | `#F5F5F3` | App background (light), ticket surfaces |
| **White** | `#FFFFFF` | Raised surfaces (cards, panels, inputs) on Paper |
| **Steel** | `#E3E3DF` | Borders, dividers, rails |
| **Graphite** | `#565A62` | Secondary text, icons (6.3:1 on Paper) |
| **Saffron** | `#E8590C` | Brand accent: logo, highlights, focus ring, large text only |
| **Saffron Deep** | `#C2410C` | Primary buttons and links with white text (5.2:1) |
| **Saffron Wash** | `#FDEBDD` | Selected rows, active nav background, subtle highlights |

Saffron is the **only** brand colour. Use it for: primary action per screen, active navigation, focus rings, the new-order pulse, and key numbers. If more than ~10% of a screen is orange, remove some.

### 3.2 Status colours (order, payment, delivery, booking)

Status always uses **colour + icon + text** — never colour alone.

| Status group | Light (text / tint bg) | Dark (text / tint bg) | Used for |
|---|---|---|---|
| Waiting | `#B45309` / `#FEF3C7` | `#FBBF24` / `#3A2E12` | Awaiting acceptance, payment pending, booking requested |
| In progress | `#1D4ED8` / `#DBEAFE` | `#93C5FD` / `#18243F` | Accepted, preparing, rider searching |
| Ready | `#0F766E` / `#CCFBF1` | `#5EEAD4` / `#12302D` | Food ready, rider assigned, booking confirmed |
| Done | `#15803D` / `#DCFCE7` | `#4ADE80` / `#14301E` | Delivered, collected, paid, refunded, seated |
| Problem | `#B91C1C` / `#FEE2E2` | `#F87171` / `#3B1717` | Rejected, failed, timeout, complaint, no-show |
| Neutral | `#565A62` / `#EEEEEB` | `#A9ADB5` / `#26292F` | Cancelled, draft, closed |

### 3.3 Design tokens (CSS variables)

```css
:root {
  --bg: #F5F5F3;          /* Paper */
  --surface: #FFFFFF;
  --surface-sunken: #EEEEEB;
  --text: #16181D;        /* Ink */
  --text-muted: #565A62;  /* Graphite */
  --line: #E3E3DF;        /* Steel */
  --line-strong: #CFCFC9;
  --brand: #E8590C;       /* Saffron */
  --brand-strong: #C2410C;/* Saffron Deep — buttons */
  --brand-wash: #FDEBDD;
  --on-brand: #FFFFFF;
  --focus: #E8590C;
  --waiting: #B45309;  --waiting-bg: #FEF3C7;
  --progress: #1D4ED8; --progress-bg: #DBEAFE;
  --ready: #0F766E;    --ready-bg: #CCFBF1;
  --done: #15803D;     --done-bg: #DCFCE7;
  --problem: #B91C1C;  --problem-bg: #FEE2E2;
  --neutral: #565A62;  --neutral-bg: #EEEEEB;
  --ticket: #FFFFFF;      /* order ticket paper */
  --rail: #16181D;        /* live-orders rail */
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #16181D; --surface: #1F2228; --surface-sunken: #1A1C21;
    --text: #F5F5F3; --text-muted: #A9ADB5;
    --line: #2E3239; --line-strong: #3A3F47;
    --brand: #F07A33; --brand-strong: #F07A33; --brand-wash: #3A2216; --on-brand: #16181D;
    --focus: #F07A33;
    --waiting: #FBBF24;  --waiting-bg: #3A2E12;
    --progress: #93C5FD; --progress-bg: #18243F;
    --ready: #5EEAD4;    --ready-bg: #12302D;
    --done: #4ADE80;     --done-bg: #14301E;
    --problem: #F87171;  --problem-bg: #3B1717;
    --neutral: #A9ADB5;  --neutral-bg: #26292F;
    --ticket: #F5F5F3; --rail: #0E0F12;
  }
}
:root[data-theme="dark"] { /* same values as the dark block above */ }
```

Dark mode note: order tickets stay **paper-coloured** in dark mode (they are physical slips) with Ink text — the one deliberate light element on dark screens.

---

## 4. Typography

| Family | Role | Weights |
|---|---|---|
| **Bricolage Grotesque** | Page titles, big numbers (KPIs, totals, countdowns), empty-state headlines, the login screen | 700, 800 |
| **IBM Plex Sans** | All UI and body text, buttons, forms, tables | 400, 500, 600 |
| **IBM Plex Mono** | **Ticket content only**: order refs (`KOT-HYD1-000123`), item lines on tickets, quantities, ticket timers, receipt lines | 500 |

Load with `next/font/google`, `display: swap`, subsets `latin`. Fallbacks: `ui-sans-serif, system-ui, sans-serif` and `ui-monospace, monospace`.

Type scale (px / line-height):

| Token | Size | LH | Family | Use |
|---|---|---|---|---|
| `display` | 44 | 48 | Bricolage 800 | Login, big KPI on Today |
| `h1` | 30 | 36 | Bricolage 700 | Page titles |
| `h2` | 22 | 28 | Plex Sans 600 | Section titles |
| `h3` | 18 | 24 | Plex Sans 600 | Card / drawer titles |
| `body` | 15 | 22 | Plex Sans 400 | Default text |
| `body-strong` | 15 | 22 | Plex Sans 600 | Emphasis, prices in UI |
| `small` | 13 | 18 | Plex Sans 400/500 | Meta, helper text, table secondary |
| `ticket` | 14 | 20 | Plex Mono 500 | Ticket lines |
| `ticket-ref` | 13 | 16 | Plex Mono 500, +0.06em | Order refs |

Rules:
- **Sentence case everywhere** in the UI ("Live orders", "Mark food ready"). No all-caps labels or eyebrows. The only uppercase is printed-ticket text (ticket header like `DELIVERY · TABLE 4` is fine on the ticket itself) and the logo tagline.
- Numbers: `font-variant-numeric: tabular-nums` in tables, tickets, totals and timers.
- Money: `₹1,23,450` (Indian grouping via `Intl.NumberFormat('en-IN')`); show paise only when non-zero.
- Times: `1:15 pm`; dates: `Mon, 19 Oct`; relative for live items ("4 min ago").
- Max line length ~70 characters for prose (help text, policies).

---

## 5. Layout, spacing, shape

- **Spacing:** 4-px base; use 4, 8, 12, 16, 20, 24, 32, 40, 56.
- **Radius hierarchy** (not one radius for everything):
  - 999 px — status pills, toggles, avatar
  - 8 px — inputs, buttons, small chips
  - 12 px — panels, table containers, drawers' inner cards
  - 20 px — bottom sheets, modals, the customer ordering page cards
  - Tickets: 10 px top corners, zigzag bottom edge, no bottom radius
- **Elevation:** borders (`1px var(--line)`) do the separating. Shadows only for things floating above the page: drawers, sheets, toasts, dropdowns (`0 8px 24px rgba(22,24,29,.12)`). No shadows on resting cards.
- **No gradients** anywhere in the product UI.
- **Breakpoints:** 0–639 mobile, 640–1023 tablet, 1024–1439 desktop, 1440+ wide. Dashboard is usable on a phone (owners) and optimised for a counter tablet/desktop (staff).
- **Dashboard shell:** left sidebar 240 px (collapses to 64 px with the mark); top bar with branch switcher, live-status dot (open / paused / closed), search, notifications, user menu. Content max width 1280 px except Live orders, which goes full width.
- Left-align everything except empty states and the login card.

---

## 6. Iconography and imagery

- Icons: `lucide-react`, 1.75 stroke, 18 px in UI, 20 px in nav, `currentColor`.
- Veg / non-veg markers follow the Indian convention: square outline with filled dot (green `#15803D` veg, red-brown `#9A3412` non-veg, with a triangle for non-veg so it's not colour-only).
- Food photos: real photos from the restaurant only, 4:3, `object-fit: cover`, rounded 12 px, lazy-loaded; no stock illustrations. When there is no photo, show no image (text-only item row) — never a placeholder graphic.
- Empty states: a small line illustration of a ticket on the rail (built from the mark), one sentence, one action.

---

## 7. Motion and sound

- **Signature moment (the only decorative motion):** a new order slides onto the live-orders rail from the left (240 ms, ease-out) with a short saffron pulse on its edge, plus a short two-tone kitchen-bell sound (toggle in settings; browser notification when the tab is hidden).
- Acceptance countdown ring ticks; turns Waiting → Problem colour in the last 60 s.
- Everything else is functional: drawers 200 ms, sheets 240 ms, toasts fade 150 ms. No hover lift on cards, no scroll-triggered animations.
- Respect `prefers-reduced-motion`: replace slides with instant appearance; keep the sound and the colour change.

---

## 8. Components (build in `packages/ui` with shadcn/ui + Radix, themed with the tokens)

| Component | Notes |
|---|---|
| **Button** | `primary` (Saffron Deep bg, white text), `secondary` (Surface bg, Ink text, Steel border), `ghost`, `destructive` (Problem colour). Height 40 (36 small, 48 on customer pages). Labels say the action: "Accept order", "Mark food ready", "Refund ₹240". |
| **StatusPill** | Pill with icon + text, tint background from §3.2. One mapping table in code shared by every screen. |
| **TicketCard** | The signature component. Paper/white surface, Ink text, zigzag bottom edge via CSS mask, mono order ref, fulfilment type, item lines in mono (`2 × Chicken Biryani (Full)`), notes, total, countdown, primary action. Problem state: 3 px Problem-colour top border. |
| **Countdown** | Ring or bar with mm:ss in mono; colour changes Waiting → Problem. |
| **Timeline** | Vertical status history with time, actor (customer / restaurant / partner / system) and icon. Used in order drawer, tracking page, booking detail. |
| **Drawer** | Right side, 480 px (full screen on mobile) for order / booking / conversation details. |
| **BottomSheet** | Customer ordering page: variants & add-ons, cart, address. Drag handle, 20 px radius. |
| **DataTable** | TanStack Table; sticky header, 44 px rows, tabular numbers, filters as chips above the table, CSV export. |
| **Stat** | Big number (Bricolage 800) + label + change vs yesterday; tap/click goes to the filtered list. |
| **Toast** | Bottom-left on desktop, top on mobile; action toasts include "Undo" where reversible. |
| **EmptyState** | Ticket-on-rail line drawing, one sentence, one button. |
| **Inputs** | 40 px, 8 px radius, Steel border, Saffron 2 px focus ring with 2 px offset; errors in Problem colour below the field with a fix ("Enter a 6-digit pincode"). |

Zigzag ticket edge:

```css
.ticket {
  --zz: 10px;
  background: var(--ticket);
  border-radius: 10px 10px 0 0;
  padding-bottom: calc(var(--zz) + 12px);
  -webkit-mask:
    conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / calc(var(--zz) * 2) var(--zz) repeat-x,
    linear-gradient(#000 0 0) top / 100% calc(100% - var(--zz) + 0.5px) no-repeat;
          mask:
    conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / calc(var(--zz) * 2) var(--zz) repeat-x,
    linear-gradient(#000 0 0) top / 100% calc(100% - var(--zz) + 0.5px) no-repeat;
}
```
Because a mask clips borders and shadows, give tickets a 1 px Steel outline by wrapping them in a slightly larger Steel-coloured ticket, or rely on the Paper-vs-White contrast plus the rail.

---

## 9. Screens — how each one should look

### 9.1 Live orders (the hero screen)

A horizontal **rail** across the top of the content (Ink bar, 6 px) with tickets hanging from it in columns by status. Full width. Columns scroll horizontally on tablet; on mobile it becomes a single list grouped by status with sticky group headers.

```
┌ Live orders ─────────────── Branch: Madhapur ▾ ── ● Open ── Pause orders ─┐
│████████████████████████████████████████████████████████████████████████████│ ← rail
│ New (3)            Preparing (5)        Food ready (2)     Out for delivery│
│ ┌──────────────┐   ┌──────────────┐     ┌──────────────┐   ┌─────────────┐ │
│ │KOT-MDP-000123│   │KOT-MDP-000118│     │KOT-MDP-000115│   │KOT-MDP-0109 │ │
│ │Delivery  ◔4:12   │Takeaway  12 min    │Delivery          │Rider: Ravi  │ │
│ │2 × Chkn Biryani│ │1 × Paneer Tikka│   │Rider search… │   │Picked 1:02pm│ │
│ │1 × Raita       │ │2 × Butter Naan │   │              │   │             │ │
│ │₹640  Paid      │ │₹420  Paid      │   │[Book rider]  │   │[Track]      │ │
│ │[Reject][Accept]│ │[Food ready]    │   │              │   │             │ │
│ └∧∧∧∧∧∧∧∧∧∧∧∧∧∧┘   └∧∧∧∧∧∧∧∧∧∧∧∧∧∧┘     └∧∧∧∧∧∧∧∧∧∧∧∧∧∧┘   └∧∧∧∧∧∧∧∧∧∧∧∧┘ │
└────────────────────────────────────────────────────────────────────────────┘
```
- Ticket click → order drawer with timeline, customer, address map, payment, POS and delivery events, chat link, "Print KOT".
- "Accept" is the primary action on New tickets; "Reject" asks for a reason and shows the refund amount.
- Item unavailable: "Mark items unavailable" inside Accept flow → checkboxes → shows what the customer will be asked.

### 9.2 Today

Three or four Stats in one row (Orders, Sales, Bookings, Average order), then a **Needs attention** list (most important first: orders waiting for acceptance with countdown, rider search failing, open complaints, payment failures, POS/partner offline), then a small chart of orders by hour. No decorative charts.

### 9.3 Inbox

Three panes on desktop: conversation list (filters: All, Needs a human, Bot handling, Unread) · thread · context panel (customer, current cart/order/booking, past orders). A clear bar at the top of the thread: "Bot is replying" with **Take over** (Saffron Deep), or "You're replying — bot paused" with **Hand back to bot**. Messages styled like WhatsApp structure but in KOT.ai colours (customer bubbles Surface, restaurant/bot bubbles Saffron Wash, staff replies marked with the staff name).

### 9.4 Bookings

Day view by time slot rows × capacity, booking chips with party size and occasion icon; side list of requests awaiting confirmation (staff mode). Week view for planning.

### 9.5 Menu & stock, Branches & hours, Delivery, Payments, Offers, Customers, Complaints, Analytics, Settings

Calm list/table + drawer pattern. POS-synced fields show a small "From Petpooja" lock icon and are read-only. Hours editor shows a weekly grid with split shifts and a live sentence summary ("Open today 12:00 pm–3:30 pm and 7:00 pm–11:00 pm. Last delivery order 10:30 pm."). Credentials forms show masked values with **Test connection** and a result line.

### 9.6 Customer ordering page (restaurant-branded, mobile-first)

```
┌──────────────────────────────┐
│ [Logo] Demo Biryani House     │
│ Madhapur · Open till 11 pm    │
│ (Delivery | Takeaway)  35 min │
│ 🔍 Search the menu            │
│ Biryani  Starters  Breads  …  │ ← sticky tabs
├──────────────────────────────┤
│ ▣ Chicken Dum Biryani   ₹320  │
│   Slow-cooked, serves 1 [Add]│
│ ▣ Veg Biryani           ₹260  │
│   Unavailable now             │
├──────────────────────────────┤
│ 3 items · ₹900   [View cart] │ ← sticky cart bar (restaurant accent)
└──────────────────────────────┘
```
- Uses the **restaurant's accent colour** for the cart bar, Add buttons and selected tabs; KOT.ai neutral tokens for everything else. Run a contrast check on the tenant accent (≥ 4.5:1 with its button text); if it fails, darken it automatically until it passes.
- Checkout: address card with map preview and "Flat / house no." + "Landmark", bill breakdown (Items, Packing, Taxes, Delivery fee, Discount, **To pay** in Bricolage 700), cancellation policy line, big "Pay ₹1,024" button (48 px).
- Return page: success with order ref in mono and "Back to WhatsApp"; failure explains and offers "Try again".
- Footer: small "Powered by KOT.ai" mark, privacy link.

### 9.7 Order tracking page

Restaurant header, order ref, ETA, the Timeline, rider card (name, call button, partner tracking link), items and bill, "Need help?" opens WhatsApp chat.

### 9.8 Platform console

Same shell, KOT.ai branding, plus a thin Ink "Platform" band in the top bar so staff always know they're in the console. Tenants table with health dots (WhatsApp, Payments, POS, Delivery). Onboarding wizard as a vertical step list with each step's status (Not started / In progress / Done / Blocked) — this is a real sequence, so numbered steps are appropriate here.

### 9.9 Login

Paper background, centred card, logo with tagline above, phone/email OTP. Nothing else.

---

## 10. WhatsApp message style

WhatsApp renders its own UI, so "design" here is structure and words:
- One idea per message, 1–3 short lines, the order ref on every order message.
- Bold (`*text*`) only for the order ref or the total.
- Buttons for choices (max 3 reply buttons; list message for more); CTA URL button for the menu and payment.
- At most one emoji per message, optional per tenant.

Examples:
```
Order KOT-MDP-000123 is confirmed ✅
2 × Chicken Dum Biryani, 1 × Raita
Total paid: *₹640* · Ready in about 30 min
[Track order]
```
```
Sorry, Paneer Tikka isn't available right now.
What would you like to do?
[Replace it] [Remove & refund ₹240] [Cancel order]
```

---

## 11. Writing in the interface

- Name things the way restaurant staff do: "Orders", "Food ready", "Rider", "Table booking", "Out of stock" — not "fulfilment events" or "inventory flags".
- Buttons describe the result; the confirmation uses the same verb ("Refund ₹240" → toast "Refunded ₹240").
- Errors say what happened and how to fix it, without apologising ("Payment link expired. Send a new link?").
- Empty states invite action ("No orders yet today. Share your WhatsApp link to start receiving orders.").

---

## 12. Accessibility (quality floor)

- WCAG 2.1 AA: text contrast ≥ 4.5:1 (≥ 3:1 for large text ≥ 24 px or 19 px bold). Saffron `#E8590C` is for large text and graphics only; use Saffron Deep for small text and buttons.
- Visible focus ring on every interactive element (2 px Saffron, 2 px offset).
- Touch targets ≥ 44 px; customer page buttons 48 px.
- Status = colour + icon + text; veg/non-veg = colour + shape.
- Proper labels, landmarks, keyboard support in drawers/sheets (focus trap, Esc closes), `aria-live="polite"` for new orders.
- Reduced motion respected (§7).

---

## 13. Implementation notes

**Fonts (`apps/web/src/app/fonts.ts`):**
```ts
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
export const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-display', display: 'swap' });
export const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans', display: 'swap' });
export const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-mono', display: 'swap' });
```

**Tailwind theme (extend):**
```ts
theme: {
  extend: {
    colors: {
      bg: 'var(--bg)', surface: 'var(--surface)', sunken: 'var(--surface-sunken)',
      text: 'var(--text)', muted: 'var(--text-muted)', line: 'var(--line)',
      brand: { DEFAULT: 'var(--brand)', strong: 'var(--brand-strong)', wash: 'var(--brand-wash)' },
      waiting: { DEFAULT: 'var(--waiting)', bg: 'var(--waiting-bg)' },
      progress: { DEFAULT: 'var(--progress)', bg: 'var(--progress-bg)' },
      ready: { DEFAULT: 'var(--ready)', bg: 'var(--ready-bg)' },
      done: { DEFAULT: 'var(--done)', bg: 'var(--done-bg)' },
      problem: { DEFAULT: 'var(--problem)', bg: 'var(--problem-bg)' },
      neutral: { DEFAULT: 'var(--neutral)', bg: 'var(--neutral-bg)' },
      ticket: 'var(--ticket)', rail: 'var(--rail)',
    },
    fontFamily: {
      display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
    },
    borderRadius: { sm: '8px', md: '12px', lg: '20px', ticket: '10px' },
    boxShadow: { float: '0 8px 24px rgba(22,24,29,.12)' },
  },
}
```

**Assets placement:**
- `packages/brand/assets/` — all SVG/PNG logo files.
- `apps/web/public/` — `favicon.svg`, `favicon-32.png`, `favicon-48.png`, `apple-touch-icon.png` (180), `icon-512.png`; reference them in `app/layout.tsx` metadata and the web manifest (`theme_color: #16181D`, `background_color: #F5F5F3`).
- Import logos as React components (SVGR) or `<Image>`; always with `alt="KOT.ai"`.

**Build a `/design` route** (platform admins only) showing tokens, type scale, every component and status in light and dark, so visual regressions are easy to spot. Add Playwright screenshot tests for it.

---

## 14. Don'ts

- No WhatsApp green as a brand or button colour.
- No gradients, glows, glassmorphism or "AI sparkle" icons.
- No all-caps labels or eyebrow text above headings (ticket print excepted).
- No identical rounded cards for everything — use the radius hierarchy and tables.
- No monospace outside ticket/order content.
- No stock food photos or placeholder images.
- Don't use Saffron for errors or warnings — those have their own colours.
