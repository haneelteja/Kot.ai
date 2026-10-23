-- Widen orders.source to allow the new public-web-order-creation path.
-- The original check (added inline in 20261023000001) is named
-- orders_source_check by Postgres's default inline-check naming convention.
alter table orders drop constraint if exists orders_source_check;
alter table orders add constraint orders_source_check check (source in ('manual','whatsapp_bot','weblink'));
