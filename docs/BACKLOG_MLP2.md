# KOT.ai — MLP2 Backlog

Items explicitly deferred past the current milestone (MLP1), either because the user asked to take them up later, or because they have a hard external dependency (real partner credentials, third-party approval, legal review) that blocks them regardless. Added to as items come up — no fixed format required, just enough to not lose track.

---

### MLP2-01 — Full and partial refunds (PAY-07)
Real Easebuzz refund API integration (endpoint, parameters, hash formula) — explicitly deferred by the user ("Refunds we will shall take up in the MLP2"). Blocked today on Easebuzz's refund API documentation, which isn't publicly discoverable via web search (likely behind a merchant login) — needs the user to pull it from their Easebuzz merchant dashboard, or confirm an alternate path (e.g. support-ticket-initiated refunds only). Until then, FUL-03's "Refund order" button stays a manual-handoff stub (cancels the order, tells the owner to refund manually in the Easebuzz dashboard).

**Downstream of this**: CAN-02 (post-acceptance cancellation with refund %) and CAN-03 (post-pickup cancellation → complaint) both assume real refund processing exists — queued here too, not just PAY-07 itself.
