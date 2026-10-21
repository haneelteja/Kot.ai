# ADR 0004: Bootstrap KOT.ai as a fresh repo copied from Alphabot

## Status
Accepted

## Context
The build brief assumes KOT.ai is built as a new product vertical inside the existing Alphabot monorepo (`WhatsApp AI Agent/`, D11). This session's actual working directory, `KOT.ai/`, was an empty, non-git folder. Building literally inside the Alphabot repo would require KOT.ai to keep every existing Alphabot bot vertical (support, sales, lifecycle, campaigns, outbound AI voice calling) working indefinitely (brief's "never break existing Alphabot features" rule), even though KOT.ai is a separate product with its own release cadence and customers.

## Decision
Copy the Alphabot monorepo's working tree (not its git history) into `KOT.ai/`, `git init` a fresh repository there, and prune the sales/lifecycle/campaign/outbound-voice-calling verticals that KOT.ai doesn't need (`docs/AUDIT.md` §3). The "reuse before build" principle (brief §0A) is reinterpreted as "keep/extend the copied code," not "share one repo with Alphabot."

Reasoning:
- A fresh history avoids carrying unrelated Alphabot commits, secrets history, and marketing collateral into a product with different stakeholders.
- Pruning unused verticals immediately (rather than leaving them dormant) keeps the codebase's actual surface area honest — dead code that "might come back" invites drift and confusion for every future session.
- Everything the brief's reuse map (§0A.1) calls out as shared platform/tenant infrastructure (auth, dashboard shell, WhatsApp gateway, AI/LLM pipeline, KB, escalation, scheduler, Easebuzz, invoicing, billing) survives the copy unchanged in location and behavior, so the brief's reuse guidance still applies almost verbatim — only the "same repo" framing changes.

## Consequences
- `docs/REUSE_MAP.md` and `docs/AUDIT.md` document real paths and real removal decisions, verified against this copy — not assumed from the brief.
- KOT.ai's commit history starts at `0665674` (baseline copy) and `9103350` (prune) — there is no earlier Alphabot history to `git blame` into; consult the original `WhatsApp AI Agent` repo if historical context on a specific piece of inherited code is ever needed.
- If Alphabot later ships a fix to one of the shared modules (e.g. the WhatsApp gateway), it will not automatically propagate here — there is no ongoing sync mechanism. Treat shared-module bug reports from either codebase as something to port manually.
