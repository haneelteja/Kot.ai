-- PRV-02: configurable chat retention. Null = no purge (default — opt-in,
-- never silently enabled for an existing tenant).
alter table tenants add column if not exists chat_retention_days integer
  check (chat_retention_days is null or chat_retention_days > 0);
