-- CONV-06: re-alert once if an escalated conversation isn't claimed/resolved
-- within the configured window (default 5 minutes).
alter table escalations add column if not exists reminder_sent_at timestamptz;
alter table tenants add column if not exists escalation_reminder_minutes integer not null default 5
  check (escalation_reminder_minutes > 0);
