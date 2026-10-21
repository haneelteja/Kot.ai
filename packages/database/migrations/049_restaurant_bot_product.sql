-- ============================================================================
-- RESTAURANT BOT PRODUCT TYPE
-- ============================================================================
-- Registers KOT.ai's restaurant ordering/booking bot as a first-class product
-- type, alongside the inherited support_bot/sales_bot/lifecycle_bot values.
-- Needed before any tenant can be onboarded onto the restaurant agent
-- (routing, tool registry, seed data all key off tenant_products.product_type
-- and whatsapp_numbers.product_slug).

-- 1. Register the product in the products registry (whatsapp_numbers.product_slug
--    and tenant_products.product_slug both reference products(slug)).
insert into products (slug, name, description, default_prompt, default_model)
values (
  'restaurant_bot',
  'Restaurant Bot',
  'AI-powered WhatsApp ordering and table booking for restaurants.',
  'You are a restaurant''s WhatsApp ordering assistant. Help customers browse the menu, book tables, and place orders for delivery or takeaway. Never invent menu items, prices, or policies -- always use tool results. Confirm the full order and bill before creating a payment link.',
  'claude-sonnet-4-6'
)
on conflict (slug) do nothing;

-- 2. Allow 'restaurant_bot' in tenant_products.product_type's check constraint.
--    (tenant_products.product_slug, added in 043_multi_bot_instances.sql, is
--    unconstrained free text and already accepts 'restaurant_bot' -- only the
--    original product_type column needs widening.)
alter table tenant_products
  drop constraint if exists tenant_products_product_type_check;

alter table tenant_products
  add constraint tenant_products_product_type_check
  check (product_type in ('support_bot','sales_bot','lifecycle_bot','restaurant_bot'));

-- 3. Same widening for whatsapp_numbers, in case any code path still checks
--    a product_type column there instead of product_slug.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'whatsapp_numbers' and column_name = 'product_type'
  ) then
    execute 'alter table whatsapp_numbers drop constraint if exists whatsapp_numbers_product_type_check';
    execute $sql$alter table whatsapp_numbers
      add constraint whatsapp_numbers_product_type_check
      check (product_type in ('support_bot','sales_bot','lifecycle_bot','restaurant_bot'))$sql$;
  end if;
end $$;
