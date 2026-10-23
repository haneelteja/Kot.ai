-- Backfill the "main_menu" quick-reply button template (View menu / Reserve a
-- table / Order food) for every existing restaurant_bot instance. Idempotent
-- via the table's existing unique(tenant_id, name) constraint. New tenants/
-- instances get this via ensureDefaultButtonTemplates() in
-- app/actions/tenant-products.ts going forward.
insert into interactive_button_templates (tenant_id, product_slug, name, description, type, template_json, trigger_keywords, is_active)
select
  tp.tenant_id,
  tp.product_slug,
  'main_menu',
  'Generic greeting fallback — view menu / reserve a table / order food',
  'quick_reply',
  jsonb_build_object(
    'body', 'Hi there! 👋 How can I help you today?',
    'buttons', jsonb_build_array(
      jsonb_build_object('id', 'view_menu',     'title', 'View menu'),
      jsonb_build_object('id', 'reserve_table', 'title', 'Reserve a table'),
      jsonb_build_object('id', 'order_food',     'title', 'Order food')
    )
  ),
  array['hi','hello','hey','hii','menu','start','good morning','good evening','good afternoon'],
  true
from tenant_products tp
where tp.product_type = 'restaurant_bot' and tp.active = true
on conflict (tenant_id, name) do nothing;
