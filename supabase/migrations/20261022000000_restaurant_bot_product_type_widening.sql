-- ============================================================================
-- RESTAURANT BOT: widen remaining product_type check constraints
-- ============================================================================
-- 20261021000000_restaurant_bot_product.sql widened tenant_products and
-- (conditionally) whatsapp_numbers, but missed five other tables whose
-- product_type column is written on the live message path: a real customer
-- message against a restaurant_bot number failed with a 23514 check
-- violation on `conversations` the first time the webhook was wired up to a
-- live Meta number. Widen every remaining product_type CHECK the same way.

alter table conversations
  drop constraint if exists conversations_product_type_check;
alter table conversations
  add constraint conversations_product_type_check
  check (product_type in ('support_bot','sales_bot','lifecycle_bot','restaurant_bot'));

alter table knowledge_base
  drop constraint if exists knowledge_base_product_type_check;
alter table knowledge_base
  add constraint knowledge_base_product_type_check
  check (product_type in ('support_bot','sales_bot','lifecycle_bot','restaurant_bot'));

alter table kb_suggestions
  drop constraint if exists kb_suggestions_product_type_check;
alter table kb_suggestions
  add constraint kb_suggestions_product_type_check
  check (product_type in ('support_bot','sales_bot','lifecycle_bot','restaurant_bot'));

alter table usage_events
  drop constraint if exists usage_events_product_type_check;
alter table usage_events
  add constraint usage_events_product_type_check
  check (product_type in ('support_bot','sales_bot','lifecycle_bot','restaurant_bot'));

alter table subscriptions
  drop constraint if exists subscriptions_product_type_check;
alter table subscriptions
  add constraint subscriptions_product_type_check
  check (product_type in ('support_bot','sales_bot','lifecycle_bot','restaurant_bot'));
