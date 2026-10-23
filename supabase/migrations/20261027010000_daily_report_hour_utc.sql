-- OWN-02: per-tenant configurable daily-report send hour (UTC, hour-only
-- granularity — matches this codebase's existing hour-cron convention, e.g.
-- payment_reminders' "30 11 * * *" comment noting the IST-equivalent).
-- null = keep the pre-existing fixed global 08:00 UTC behaviour.
alter table tenant_notification_settings
  add column if not exists daily_report_hour_utc smallint
    check (daily_report_hour_utc is null or (daily_report_hour_utc >= 0 and daily_report_hour_utc <= 23));
