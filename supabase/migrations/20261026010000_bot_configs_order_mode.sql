-- Per-bot toggle: continue ordering inside WhatsApp (existing cart/[CONFIRM_ORDER]
-- flow) vs. send a weblink to the new public ordering page. Additive-only.
alter table bot_configs
  add column if not exists order_mode text not null default 'whatsapp' check (order_mode in ('whatsapp','weblink'));
