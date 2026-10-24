-- PRV-01: per-tenant privacy notice link, sent once alongside the greeting
-- on a contact's first-ever message.
alter table tenant_notification_settings add column if not exists privacy_notice_url text;
