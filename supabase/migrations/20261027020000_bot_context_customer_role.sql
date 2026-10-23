-- WAB-06 made it possible for a tenant to have more than one active
-- whatsapp_numbers row under the same (tenant_id, product_slug, provider)
-- (kitchen/ops numbers alongside the customer-facing one). get_bot_context's
-- whatsapp_number subquery used `LIMIT 1` with no further tie-break, so it
-- could non-deterministically return a kitchen/ops number as "the" number
-- used to build customer-facing replies. Pin it to the customer-facing row
-- — existing single-number tenants are unaffected, since their only row
-- already defaults to role='customer'.

CREATE OR REPLACE FUNCTION get_bot_context(
  p_tenant_id    UUID,
  p_product_slug TEXT,
  p_provider     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'whatsapp_number', (
      SELECT row_to_json(wn)
      FROM whatsapp_numbers wn
      WHERE wn.tenant_id    = p_tenant_id
        AND wn.product_slug = p_product_slug
        AND wn.provider     = p_provider
        AND wn.active       = true
        AND wn.role         = 'customer'
      LIMIT 1
    ),
    'tenant', (
      SELECT row_to_json(t)
      FROM tenants t
      WHERE t.id = p_tenant_id
    ),
    'bot_config', (
      SELECT jsonb_build_object(
        'id',                   bc.id,
        'system_prompt',        bc.system_prompt,
        'ai_model',             bc.ai_model,
        'confidence_threshold', bc.confidence_threshold,
        'escalation_triggers',  bc.escalation_triggers,
        'guardrails_json',      bc.guardrails_json,
        'escalation_policy',    bc.escalation_policy,
        'voice_config',         bc.voice_config,
        'order_mode',           bc.order_mode,
        'default_prompt',       p.default_prompt,
        'default_model',        p.default_model
      )
      FROM bot_configs bc
      LEFT JOIN products p ON p.slug = bc.product_slug
      WHERE bc.tenant_id    = p_tenant_id
        AND bc.product_slug = p_product_slug
      LIMIT 1
    ),
    'platform_guardrails', (
      SELECT value
      FROM platform_settings
      WHERE key = 'guardrails'
      LIMIT 1
    ),
    'bot_type_guardrails', (
      SELECT guardrails_json
      FROM bot_type_guardrails
      WHERE product_slug = p_product_slug
      LIMIT 1
    ),
    'tenant_guardrails', (
      SELECT guardrails_json
      FROM tenant_guardrails
      WHERE tenant_id = p_tenant_id
      LIMIT 1
    ),
    'llm_configs', (
      SELECT jsonb_agg(row_to_json(lc))
      FROM llm_configs lc
      WHERE (lc.tenant_id IS NULL OR lc.tenant_id = p_tenant_id)
        AND (lc.product_slug IS NULL OR lc.product_slug = p_product_slug)
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_bot_context(UUID, TEXT, TEXT) TO service_role;
