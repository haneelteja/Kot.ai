# CLAUDE.md

KOT.ai — WhatsApp ordering and table booking for restaurants. Bootstrapped from the Alphabot WhatsApp SaaS platform; see `KOTAI_BUILD_BRIEF.md` (source of truth for product/process rules) and `docs/AUDIT.md` (what was kept/extended/removed from the Alphabot copy).

## Where things live

- `apps/api` — Fastify 4 / Node 22 API + workers. Webhook entry at `src/routes/webhook/index.ts`, scheduler at `src/jobs/scheduler.ts`, WhatsApp gateway at `src/services/whatsapp/`.
- `apps/web` — Next.js 14 App Router. `(dashboard)/*` = tenant app, `(platform)/platform/*` = platform console, `o/[tenant]/[branch]` and `t/[orderRef]` (net-new) = public ordering/tracking pages.
- `packages/shared` — shared TS types. `packages/database` — Supabase client (`getServerClient` = service role, `getTenantClient` = RLS-scoped).
- `packages/brand` — KOT.ai design tokens/assets (net-new; see `docs/DESIGN.md`, the authoritative design spec — it supersedes brief §14 where they differ).
- `supabase/migrations` is the **canonical, proven migration set** (92 files) — applied clean start-to-finish against the real Supabase project (`qogsclmwnthienjxkjbu`) via `supabase db push`. It now includes copies of `packages/database/migrations` 001–048 (with early 2025-01-01 timestamps so they apply first) plus the original incremental files. `packages/database/migrations` is kept as a historical numbered reference only — its own `db:migrate` script doesn't work (see `docs/SETUP.md`) and its internal ordering has an uncorrected bug (035 references a column from a later migration). **When adding a new migration, add it only to `supabase/migrations`** and apply with `supabase db push`; don't bother mirroring into `packages/database/migrations` going forward.
- `docs/` — all Phase 0+ planning docs: `AUDIT.md`, `REUSE_MAP.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `PLAN.md`, `BACKLOG.md`, `TRACEABILITY.md`, `adr/`, `integrations/`, `copy/`.

## Commands

- `npm run dev` / `npm run build` / `npm run lint` / `npm run type-check` / `npm run test` — all run via Turborepo across workspaces.
- `npm run type-check --workspace=apps/api` (or `apps/web`) — scope to one workspace while iterating.
- `npm run db:migrate` — runs `packages/database`'s migration script.

## Non-negotiable rules (full detail in `KOTAI_BUILD_BRIEF.md` §0)

- Money is integer paise, computed server-side. Never trust a client-supplied total.
- The AI proposes, the code decides — the model calls tools; tools enforce tenant scope and state-machine rules.
- No secrets in the repo; per-tenant credentials are encrypted at rest.
- One backlog story per commit, referencing the backlog ID (e.g. `feat(ORD-07): ...`).
- Work in gated phases (`docs/PLAN.md` / brief §21) — stop and summarize at each phase gate.
- Reuse before building: check `docs/REUSE_MAP.md` and `docs/AUDIT.md` before writing new code for a backlog item.

## Conventions carried over from Alphabot

- Multi-tenancy via `tenant_id` + Postgres RLS on every tenant table; two RLS policy styles exist in older vs. newer migrations (see `docs/AUDIT.md` §2) — new tables use the simpler `tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())` form.
- `fire-forget.ts` for non-blocking side effects; `withJobLock` (Redis) for cron de-duplication across instances.
- Git hooks run via `scripts/hooks` (set by the root `prepare` script) — includes a large-file guard (100KB limit); store big binaries outside the repo.
