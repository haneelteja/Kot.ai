-- FUL-01: kitchen tickets are sent FROM the tenant's 'kitchen'-role
-- WhatsApp number (WAB-06) TO the actual kitchen staff's phone(s) — same
-- pattern as lead_notification_wa_numbers/daily_report_wa_numbers.
alter table tenant_notification_settings
  add column if not exists kitchen_notification_wa_numbers text[] not null default '{}';
