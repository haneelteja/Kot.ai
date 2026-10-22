# 0005 — Marker-based ordering actions (not real tool-calling)

## Status
Accepted

## Context

`KOTAI_BUILD_BRIEF.md` §9 specifies the restaurant agent should call real tools
(`get_cart`, `add_to_cart`, `create_payment_link`, etc.) via a structured
function-calling interface — "the agent requests buttons/lists/CTA URLs
through a structured reply tool or response schema, not text markers."

The existing WhatsApp bot pipeline (`apps/api/src/routes/webhook/index.ts`)
is, in practice, 100% marker-based end-to-end: the model returns one plain
text string, and the backend regexes specific `[MARKER:...]` tags off the end
of it (`[STAGE:x]`, `[BUTTONS:name]`, `[SEND_CATALOGUE]`, `[SALES_LEAD]`, etc.)
to drive side effects. No real Anthropic `tool_use` / OpenAI function-calling
plumbing exists anywhere in `routedChatCompletion` / `getAIResponse` /
`chatCompletion` — the only place real tool-calling exists in this codebase
is the separate dashboard "AI Copilot" widget (`apps/web/src/app/api/copilot/*`),
an unrelated app with its own approve/execute flow.

This session also spent significant effort making the webhook pipeline work
reliably against free-tier OpenRouter models (`google/gemma-4-31b-it:free`,
`liquid/lfm-2.5-2.6b:free`, `poolside/laguna-s-2.1:free`) as the default LLM
backend. Function-calling support and reliability across these specific free
models was not something we could verify was solid enough to build the first
real revenue-critical feature (order placement + payment) on top of, without
first spending comparable effort stabilizing that path the way the plain-text
path already was.

## Decision

Extend the existing marker convention for ordering actions rather than
building new multi-provider tool-calling plumbing right now:

- `[ADD_ITEM:<menu_item_id>:<qty>]`
- `[REMOVE_ITEM:<menu_item_id>]`
- `[CLEAR_CART]`
- `[CONFIRM_ORDER]`

The live per-tenant menu and current cart are injected into the system
prompt every turn (not pulled via a separate marker), so the model can
answer "what's on the menu" / "what's in my cart" directly from context.

The "AI proposes, code decides" guarantee is enforced exactly the same way
it would be with real tool-calling: the model only ever emits an item id and
a quantity; `apps/api/src/lib/cart.ts` validates the item (tenant-scoped,
active, in stock) and always re-joins the **live** `menu_items.price_paise`
to compute totals — the model never sets or states a price that is trusted.

## Consequences

- This is a deliberate, acknowledged deviation from the brief's literal §9
  wording. It is swappable later: markers are purely an AI↔code interface
  sitting in front of the same `cart.ts` / `restaurant-order.ts` functions a
  future real tool-calling implementation would call — migrating later does
  not require touching the cart/order data model at all.
- Pro: works uniformly across every provider this project currently
  supports, including all three free OpenRouter fallback models, with zero
  new plumbing.
- Con: a cart mutation only takes effect on the *next* turn's prompt
  injection, not retroactively in the reply just generated — the model must
  be instructed to narrate what it did in its own reply text, not rely on
  the marker alone (this is the same limitation every existing marker in
  this file already has, e.g. `[STAGE:x]`).
- Con: malformed markers (e.g. a truncated item id) fail closed and silently
  — mitigated with a log warning when the literal substring `ADD_ITEM`
  appears in a reply but the strict UUID regex finds no match, so drift from
  a given model is at least visible in logs rather than fully silent.
