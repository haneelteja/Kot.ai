# KOT.ai — Setup

Copy-pasteable setup for local development and the staging environment. Phase 1 gate (brief §21): *a test WhatsApp message reaches staging and is stored.*

## 0. Prerequisites

- Node 22 (see `.node-version`) and npm 10
- Docker (for local Redis; Postgres comes from Supabase, see below)
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `npm i -g supabase` or `brew install supabase/tap/supabase`
- Render CLI and Vercel CLI (optional — only needed for manual deploy triggers; CI handles normal deploys)

## 1. Clone and install

```bash
git clone <this-repo-url> kotai
cd kotai
npm install
cp .env.example .env
```

Fill in `.env` as you complete the steps below. Every variable in `.env.example` is documented inline with where to get it.

## 2. Local Supabase project

This repo doesn't yet have a `supabase/config.toml` (no local Supabase project has been initialized). To stand one up:

```bash
supabase init          # creates supabase/config.toml next to the existing supabase/migrations/
supabase start         # launches local Postgres + Studio + Auth in Docker
```

`supabase start` prints a local `API URL`, `anon key`, and `service_role key` — put those in `.env` as `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` for local dev.

Apply migrations:

```bash
supabase db push       # applies every file in supabase/migrations/ in order
```

> **Known gap**: `packages/database`'s own `npm run db:migrate` script (`node dist/migrate.js`) has no corresponding `src/migrate.ts` in this repo — it will fail if invoked. Use `supabase db push` (above) as the real migration path until that script is either implemented or removed. Tracked as a Phase 2 cleanup item.

## 3. Local Redis

```bash
docker compose up -d redis
```

Set `REDIS_URL=redis://localhost:6379` in `.env`. The app degrades gracefully (logs a warning, skips queueing/rate-limit-by-Redis) if Redis is unreachable — useful for quick frontend-only work, but queue-dependent stories (QUE epic) need it running.

## 4. Run the app

```bash
npm run dev   # turbo runs apps/api and apps/web in parallel
```

- API: http://localhost:4000 (health check at `/health`)
- Web: http://localhost:3000

## 5. Seed data

```bash
npm run db:seed --workspace=packages/database   # see docs/PROGRESS.md for current seed coverage
```

The seed script currently creates a demo tenant, an owner user, and a WhatsApp number row — enough to log into the dashboard and exercise auth/routing. It does **not** yet seed branches, menu, or offers, because those tables don't exist until the BR-01/MENU-01 migrations (Phase 3) land. Re-run after Phase 3 to get the full "Demo Biryani House" fixture the brief describes (brief §20.2).

## 6. Staging environment (manual steps — need your accounts)

These require you to create accounts/projects; I can't provision them for you. Once created, tell me the project refs/URLs and I'll wire the CI/CD secrets and `render.yaml`/Vercel config to point at them.

1. **Supabase staging project** — a separate project from your local one (Settings → API for the URL/keys). `supabase link --project-ref <ref>` from this repo, then `supabase db push` to apply migrations.
2. **Render** — a new Web Service from `render.yaml` (API + worker), pointed at this repo's `master` branch. Set the env vars from `.env.example` as Render secrets (`sync: false` ones are NOT read from `render.yaml` — add them in the Render dashboard).
3. **Vercel** — import this repo, set the root directory to `apps/web`, add the same Supabase/API env vars as Vercel project env vars (Preview + Production).
4. **Meta test WhatsApp number** — a test WABA + test number in [Meta's App Dashboard](https://developers.facebook.com) (WhatsApp → API Setup). Register the staging API's webhook URL (`https://<render-staging-url>/api/webhook/:tenantId/:productType`) and a verify token (`META_VERIFY_TOKEN`).
5. **Easebuzz test credentials** — request a test merchant account; not needed until Phase 6, but worth requesting early (external turnaround time).
6. **GitHub Actions secrets** — add `RENDER_DEPLOY_HOOK` (used by `.github/workflows/deploy-render.yml`) once the Render service exists.

**Phase 1 gate check**: once steps 1–4 are done, send a WhatsApp message to the test number and confirm a row appears in staging's `messages` table (via Supabase Studio) — that closes SET-02.

## 7. Verifying your setup

```bash
npm run type-check   # should be clean across all workspaces
npm run lint
npm test
```

See `docs/RUNBOOK.md` for what to do when something in this list fails, and for production incident response.
