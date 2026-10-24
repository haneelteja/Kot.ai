-- PRV-01: exactly-once claim column — an UPDATE ... WHERE privacy_notice_sent_at
-- IS NULL ... RETURNING id lets concurrent/retried webhook deliveries for the
-- same brand-new contact race safely without double-sending the notice.
alter table contacts add column if not exists privacy_notice_sent_at timestamptz;

-- Backfill existing contacts so they aren't treated as first-time on their
-- next message just because this column is new for them.
update contacts set privacy_notice_sent_at = created_at where privacy_notice_sent_at is null;
