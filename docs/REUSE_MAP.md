# KOT.ai — Reuse Map (Phase 0)

Brief Section 0A.1's table, verified against the actual copied code and corrected with real paths. "Action" column reflects the decision in `docs/AUDIT.md`. See that file for removal rationale on anything marked REMOVE.

| Need in KOT.ai | Verified Alphabot source | Action |
|---|---|---|
| Send/receive WhatsApp, interactive lists/buttons/CTA URL | `apps/api/src/services/whatsapp/gateway.ts`, `providers/meta.ts`, `providers/twilio.ts` | KEEP; add location-request, order-confirmation, template helpers |
| Webhook entry, tenant + number resolution, multi-bot routing | `apps/api/src/routes/webhook/index.ts`, `services/routing/router.ts`, `services/bot-context.ts` | KEEP routing/resolution; EXTEND with signature verification, route KOT.ai numbers to the restaurant agent |
| Nearest branch from shared location | Location handling inside the webhook route's multi-routing branch | EXTRACT into `modules/restaurant/serviceability/nearest-branch.ts`, reuse the underlying logic |
| Business hours / working days | `apps/api/src/lib/business-hours.ts`, `lib/business-days.ts` | EXTEND for split shifts, cut-offs, closures |
| Phone normalisation, retries, Redis, locks | `lib/phone.ts`, `lib/retry.ts`, `lib/redis.ts`, `lib/fire-forget.ts` | KEEP |
| LLM calls, cost tracking, per-tenant model config | `lib/anthropic.ts`, `lib/llm-router.ts`, `lib/llm-cost.ts`, `services/ai/claude.ts`, `confidence.ts`, `history-assembler.ts`, `token-quota.ts` | KEEP; EXTEND with a tool-use execution path for the restaurant agent |
| Tool registry per bot | `lib/tool-registry.ts` (`toolEnabled`/`TOOL_IDS`) | EXTEND with the restaurant tool set (brief §9) |
| Knowledge base RAG | `services/kb/chunker.ts`, `document-processor.ts`, `embedding.ts`, `image-extractor.ts`, `lookup.ts` | KEEP for restaurant FAQs/policies |
| Contact memory | `services/contact/memory.ts`, `fact-extractor.ts` | KEEP (preferences, saved addresses) |
| Escalation, sentiment | `services/escalation/index.ts`, `services/sentiment/detector.ts` | KEEP detector + handoff mechanics; REPLACE lead-scoring call sites with handoff-trigger logic |
| Opt-out / suppression | `lib/suppression.ts` | KEEP for marketing STOP |
| Scheduler and scheduled messages | `jobs/scheduler.ts`, `services/scheduled-messages/sender.ts`, `routes/scheduled-messages/` | KEEP for reminders, reconciliation polling, acceptance timeouts |
| Voice note transcription | `services/voice/providers/stt/sarvam.ts`, `deepgram.ts` | KEEP (STT only); REMOVE the outbound AI-calling pipeline these files sit alongside |
| Easebuzz link + hash verification | `services/payment/easebuzz.ts` (`createEasebuzzPaymentLink`, `verifyEasebuzzCallback`) | EXTEND: per-tenant creds, server webhook, idempotency, amount check, refunds |
| Orders/payments tables and routes | `orders` table (`001_initial_schema.sql`), `payments` table (PhonePe/Easebuzz-subscription-oriented), `routes/orders/index.ts` | REPLACE pricing/trust logic and schema (brief §6); no dedicated migration file existed for either, contrary to the original brief's assumption |
| Receipts / PDFs | `services/invoice/generator.ts` (`generateAndSendInvoice`) | KEEP for payment receipts |
| Return/complaint flow | `return_requests` migration (`033.../20260905020000_return_requests.sql`) | EXTEND into the richer `complaints` model (categories, photos, SLA) |
| Daily reports, insights, notifications inbox | `lib/email/daily-report.ts`, `services/insights/generator.ts`, migrations `045_notifications_inbox.sql`, `046_lead_notifications.sql`, `047_daily_report_settings.sql` | KEEP for owner summaries and alerts |
| Staff/internal numbers | `tenant_internal_numbers` table (migration `033_internal_numbers.sql`); **no `InternalNumbersManager` class exists** — it's inline logic in the webhook route | EXTEND: extract inline logic into a proper service for restaurant staff alerts |
| Audit logs | `audit_logs` migration (`042`) | KEEP |
| Dashboard shell, nav, auth, team invites, roles | `components/dashboard-shell.tsx`, `topbar.tsx`, `platform-nav.tsx`, `components/dashboard/TeamInviteForm.tsx`, `components/platform/InviteUserForm.tsx`, `app/(auth)/*` | KEEP; re-theme with KOT.ai brand tokens |
| Conversations inbox, message view, actions | `components/RecentConversations.tsx` (actually under `components/dashboard/`), `components/conversation-messages.tsx`, `conversation-actions.tsx` (flat under `components/`, not nested) | EXTEND with an order/booking side panel and takeover controls |
| WhatsApp number setup UI | `components/dashboard/WhatsAppNumbersManager.tsx`, `WhatsAppSetupSection.tsx`, `components/platform/WhatsAppNumberSection.tsx` | KEEP in the onboarding wizard |
| Integrations, notifications, persona, guardrails settings | `components/dashboard/IntegrationsClient.tsx`, `NotificationSettings.tsx`, `PersonaEditor.tsx`, `components/platform/TenantGuardrailsForm.tsx` | KEEP; `IntegrationsClient` repurposed for POS/delivery/payment credentials instead of CRM webhooks |
| Billing / plans | `components/platform/BillingManager.tsx`, subscription migrations, subscription routes | KEEP for KOT.ai SaaS plans |
| Analytics components | `components/leads/SalesAnalytics.tsx`, `AutoRefresh.tsx` (two copies: `components/dashboard/AutoRefresh.tsx` and a route-local one under `payment/status/[paymentId]/`) | REUSE the `AutoRefresh` polling pattern; `SalesAnalytics` layout reused as a pattern for order analytics, not reused directly (it's lead-funnel specific) |
| Tenant onboarding intake | `tenant-intake.html`, `TENANT_MASTER_SPEC.template.md`, `tenant-master-spec.schema.json` | **REMOVE** — these are Alphabot's own multi-vertical sales-intake tooling (see `docs/AUDIT.md` §3); KOT.ai's onboarding wizard (brief §13) is purpose-built instead |
| Dashboard Copilot | `components/dashboard/CopilotWidgetMount.tsx`, `CopilotWidget.tsx`, `app/api/copilot/*` | OPTIONAL KEEP — no dedicated migrations exist for it; revisit after MVP if owners want "how many orders today?" |

## Corrections vs. the original brief's assumptions

- Component paths for team-invite, conversation, and WhatsApp-setup UI are flatter/differently-nested than the brief stated — table above has the real paths.
- No `packages/brand`/`packages/ui` exists; theming is local CSS variables in `apps/web`. KOT.ai's brand package is net-new, not extracted.
- No `InternalNumbersManager` class, no dedicated `orders`/`payments`/`return_requests` migration files in the form the brief described — see per-row notes above and `docs/AUDIT.md` §1–2.
- `services/sentiment/detector.ts` and `services/escalation/index.ts` exist but are wired to lead-scoring/sales-notification use cases, not pure handoff triggers — reusing them means replacing their call sites, not just "reusing."
