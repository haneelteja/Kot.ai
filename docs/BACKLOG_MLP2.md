# KOT.ai — MLP2 Backlog

Items explicitly deferred past the current milestone (MLP1), either because the user asked to take them up later, or because they have a hard external dependency (real partner credentials, third-party approval, legal review) that blocks them regardless. Added to as items come up — no fixed format required, just enough to not lose track.

---

### MLP2-01 — Full and partial refunds (PAY-07)
Real Easebuzz refund API integration (endpoint, parameters, hash formula) — explicitly deferred by the user ("Refunds we will shall take up in the MLP2"). Blocked today on Easebuzz's refund API documentation, which isn't publicly discoverable via web search (likely behind a merchant login) — needs the user to pull it from their Easebuzz merchant dashboard, or confirm an alternate path (e.g. support-ticket-initiated refunds only). Until then, FUL-03's "Refund order" button stays a manual-handoff stub (cancels the order, tells the owner to refund manually in the Easebuzz dashboard).

**Downstream of this**: CAN-02 (post-acceptance cancellation with refund %) and CAN-03 (post-pickup cancellation → complaint) both assume real refund processing exists — queued here too, not just PAY-07 itself.

---

### MLP2-02 — Per-tenant Easebuzz merchant accounts (SEC-02 payments)
Confirmed by the user: "each restaurant should get its own merchant account in MLP2." Today there is no per-tenant payment credential storage at all — `services/payment/easebuzz.ts` reads one shared platform-level merchant key/salt from global env vars (`EASEBUZZ_MERCHANT_KEY`, `EASEBUZZ_SALT`, `EASEBUZZ_ENV`, `EASEBUZZ_SURL`), so every tenant's payment links currently settle to the same KOT.ai-owned Easebuzz account.

**MLP2 scope**: a new `integration_credentials`-style per-tenant table (envelope-encrypted at rest — see MLP2-03, since this needs the same encryption groundwork), a Settings UI for a restaurant owner to enter their own Easebuzz merchant key/salt, and `services/payment/easebuzz.ts`'s hash/link-creation functions switched from reading `process.env[...]` to resolving the calling tenant's own stored credentials (falling back to the platform account only if explicitly intended as a transitional default — confirm with the user whether a fallback is wanted or every tenant must configure their own before accepting payments). Also touches the Easebuzz webhook callback verification (`routes/orders/index.ts`'s `easebuzzCallbackRoute`), which currently verifies against the single global `SALT` — needs to resolve the right tenant's salt per incoming callback (by order → tenant lookup) before hash-verifying.

---

### MLP2-03 — Encrypt `llm_configs.api_key` at rest
Found while reviewing SEC-02: a tenant's own BYOK AI provider key is stored and read in plaintext today, across 8 files in both apps (`apps/web/src/app/actions/llm-configs.ts`, `apps/web/src/app/(dashboard)/settings/page.tsx`, `apps/web/src/app/(platform)/platform/ai-models/page.tsx`, `apps/web/src/app/(platform)/platform/analytics/page.tsx`, `apps/web/src/app/(platform)/platform/clients/[tenantId]/page.tsx`, `apps/web/src/app/api/cron/refresh-models/route.ts`, `apps/api/src/routes/webhook/index.ts`, `apps/api/src/services/bot-context.ts`) and actively used on every inbound message when a tenant has BYOK configured. Not a hard external blocker — just genuinely bigger/riskier than a squeeze-in fix: needs a generic envelope-encryption helper (`lib/encryption.ts`, AES-256-GCM, master key from env), a backfill migration to re-encrypt every already-stored plaintext key, and coordinated updates to every read/write site above without breaking live AI responses for any tenant mid-migration. Natural to build alongside MLP2-02's credential table, since both need the same encryption groundwork.

Also noted, lower priority: `tenant_voice_configs.exotel_api_key`/`exotel_api_token` (per-tenant Exotel voice credentials) are stored in plaintext too, but there is no live read call site for them in `apps/api` today (only a platform-console display read) — effectively dead/unused infrastructure, so not worth encrypting until the voice-calling feature that would actually consume them exists.

---

### MLP2-04 — Payment reconciliation poll job (PAY-05)
Same root blocker as PAY-07 (MLP2-01): building this needs Easebuzz's transaction-status-check API (endpoint, request params, hash formula) to poll a pending payment's real state when a webhook is missed — not publicly discoverable via web search, likely behind the merchant dashboard login. PAY-03 (webhook amount verification) and PAY-04 (idempotent webhook processing) are done without this; PAY-05 specifically needs the poll-status call, which nothing in `services/payment/easebuzz.ts` implements today. PAY-06 (auto-refund on a late payment after expiry/cancellation) is also blocked here, same as CAN-02/03 — it needs real refund processing (MLP2-01), not just reconciliation.
