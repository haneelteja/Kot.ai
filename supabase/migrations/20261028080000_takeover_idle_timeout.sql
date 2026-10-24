-- HND-03: a human-takeover conversation (status='bot_paused') idle this
-- long auto-releases back to the bot. Default 120 minutes (2h).
alter table tenants add column if not exists bot_takeover_idle_minutes integer not null default 120
  check (bot_takeover_idle_minutes > 0);
