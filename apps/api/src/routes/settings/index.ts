import type { FastifyInstance } from 'fastify';
import { getServerClient } from '@alphabot/database';
import { requireAuth } from '../../middleware/auth.js';

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── GET/PATCH /api/settings/billing ─────────────────────────────────────
  // PRC-01: tax rate (basis points) + flat packing charge, applied server-
  // side to every checkout (lib/bill-calculator.ts). Lives on `tenants`.
  fastify.get('/billing', { preHandler: [requireAuth] }, async (request, reply) => {
    const db = getServerClient();
    const { data } = await db.from('tenants').select('tax_rate_bp, packing_charge_paise, min_order_value_paise, max_order_value_paise').eq('id', request.tenantId).single();
    const row = data as {
      tax_rate_bp: number | null; packing_charge_paise: number | null;
      min_order_value_paise: number | null; max_order_value_paise: number | null;
    } | null;
    return {
      success: true,
      data: {
        tax_rate_bp:            row?.tax_rate_bp ?? 0,
        packing_charge_paise:   row?.packing_charge_paise ?? 0,
        min_order_value_paise:  row?.min_order_value_paise ?? 0,
        max_order_value_paise:  row?.max_order_value_paise ?? null,
      },
    };
  });

  fastify.patch<{ Body: { tax_rate_bp?: number; packing_charge_paise?: number; min_order_value_paise?: number; max_order_value_paise?: number | null } }>(
    '/billing', { preHandler: [requireAuth] }, async (request, reply) => {
      const { tax_rate_bp, packing_charge_paise, min_order_value_paise, max_order_value_paise } = request.body;

      if (tax_rate_bp !== undefined && (!Number.isInteger(tax_rate_bp) || tax_rate_bp < 0 || tax_rate_bp > 10000)) {
        return reply.status(400).send({ success: false, error: 'tax_rate_bp must be an integer between 0 and 10000' });
      }
      if (packing_charge_paise !== undefined && (!Number.isInteger(packing_charge_paise) || packing_charge_paise < 0)) {
        return reply.status(400).send({ success: false, error: 'packing_charge_paise must be a non-negative integer' });
      }
      if (min_order_value_paise !== undefined && (!Number.isInteger(min_order_value_paise) || min_order_value_paise < 0)) {
        return reply.status(400).send({ success: false, error: 'min_order_value_paise must be a non-negative integer' });
      }
      if (max_order_value_paise !== undefined && max_order_value_paise !== null && (!Number.isInteger(max_order_value_paise) || max_order_value_paise <= 0)) {
        return reply.status(400).send({ success: false, error: 'max_order_value_paise must be a positive integer, or null' });
      }

      const db = getServerClient();
      const { error } = await db
        .from('tenants')
        .update({
          ...(tax_rate_bp !== undefined && { tax_rate_bp }),
          ...(packing_charge_paise !== undefined && { packing_charge_paise }),
          ...(min_order_value_paise !== undefined && { min_order_value_paise }),
          ...(max_order_value_paise !== undefined && { max_order_value_paise }),
        })
        .eq('id', request.tenantId);

      if (error) return reply.status(500).send({ success: false, error: error.message });
      return { success: true, data: { tax_rate_bp, packing_charge_paise } };
    },
  );

  // ─── GET/PATCH /api/settings/retention ───────────────────────────────────
  // PRV-02: lives on `tenants` (not tenant_notification_settings) — retention
  // is a data-governance setting, not a notification preference.
  fastify.get('/retention', { preHandler: [requireAuth] }, async (request, reply) => {
    const db = getServerClient();
    const { data } = await db.from('tenants').select('chat_retention_days').eq('id', request.tenantId).single();
    return { success: true, data: { chat_retention_days: (data as { chat_retention_days: number | null } | null)?.chat_retention_days ?? null } };
  });

  fastify.patch<{ Body: { chat_retention_days: number | null } }>('/retention', { preHandler: [requireAuth] }, async (request, reply) => {
    const { chat_retention_days } = request.body;
    if (chat_retention_days !== null && (!Number.isInteger(chat_retention_days) || chat_retention_days <= 0)) {
      return reply.status(400).send({ success: false, error: 'chat_retention_days must be a positive integer or null' });
    }

    const { error } = await getServerClient().from('tenants').update({ chat_retention_days }).eq('id', request.tenantId);
    if (error) return reply.status(500).send({ success: false, error: error.message });
    return { success: true, data: { chat_retention_days } };
  });

  // GET /api/settings/notifications
  fastify.get('/notifications', { preHandler: [requireAuth] }, async (request, reply) => {
    const db = getServerClient();
    const { data } = await db
      .from('tenant_notification_settings')
      .select('escalation_emails, escalation_wa_numbers, escalation_customer_message, from_email, resend_api_key, lead_notification_emails, lead_notification_wa_numbers, daily_report_emails, daily_report_wa_numbers, daily_report_hour_utc, kitchen_notification_wa_numbers, privacy_notice_url')
      .eq('tenant_id', request.tenantId)
      .single();

    const row = data as {
      escalation_emails: string[] | null;
      escalation_wa_numbers: string[] | null;
      escalation_customer_message: string | null;
      from_email: string | null;
      resend_api_key: string | null;
      lead_notification_emails: string[] | null;
      lead_notification_wa_numbers: string[] | null;
      daily_report_emails: string[] | null;
      daily_report_wa_numbers: string[] | null;
      daily_report_hour_utc: number | null;
      kitchen_notification_wa_numbers: string[] | null;
      privacy_notice_url: string | null;
    } | null;

    return {
      success: true,
      data: {
        escalation_emails:            row?.escalation_emails ?? [],
        escalation_wa_numbers:        row?.escalation_wa_numbers ?? [],
        escalation_customer_message:  row?.escalation_customer_message ?? 'Your query has been escalated to our team. A team member will get back to you shortly.',
        from_email:                   row?.from_email ?? '',
        resend_api_key_masked:        row?.resend_api_key ? '••••' + row.resend_api_key.slice(-4) : '',
        resend_configured:            !!row?.resend_api_key,
        lead_notification_emails:     row?.lead_notification_emails ?? [],
        lead_notification_wa_numbers: row?.lead_notification_wa_numbers ?? [],
        daily_report_emails:          row?.daily_report_emails ?? [],
        daily_report_wa_numbers:      row?.daily_report_wa_numbers ?? [],
        daily_report_hour_utc:        row?.daily_report_hour_utc ?? null,
        kitchen_notification_wa_numbers: row?.kitchen_notification_wa_numbers ?? [],
        privacy_notice_url:            row?.privacy_notice_url ?? '',
      },
    };
  });

  // POST /api/settings/notifications/validate-resend
  // Validates a Resend API key and checks that the from_email domain is verified in that account
  fastify.post<{
    Body: { api_key: string; from_email: string };
  }>('/notifications/validate-resend', { preHandler: [requireAuth] }, async (request, reply) => {
    const { api_key, from_email } = request.body;

    if (!api_key || !from_email) {
      return reply.status(400).send({ success: false, error: 'api_key and from_email are required' });
    }

    const fromDomain = from_email.split('@')[1];
    if (!fromDomain) {
      return reply.status(400).send({ success: false, error: 'Invalid from_email format' });
    }

    // 1. Check API key is valid by listing domains
    let domainsRes: Response;
    try {
      domainsRes = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${api_key}` },
      });
    } catch {
      return reply.status(502).send({ success: false, error: 'Could not reach Resend API' });
    }

    if (domainsRes.status === 401 || domainsRes.status === 403) {
      return reply.status(400).send({ success: false, error: 'Invalid Resend API key' });
    }

    if (!domainsRes.ok) {
      return reply.status(502).send({ success: false, error: `Resend API returned ${domainsRes.status}` });
    }

    const domainsBody = await domainsRes.json() as { data: { name: string; status: string }[] };
    const domains = domainsBody.data ?? [];

    const matchedDomain = domains.find(d => d.name === fromDomain);

    if (!matchedDomain) {
      return {
        success: true,
        key_valid: true,
        domain_verified: false,
        message: `API key is valid but domain "${fromDomain}" is not added to this Resend account. Add and verify it in your Resend dashboard.`,
      };
    }

    if (matchedDomain.status !== 'verified') {
      return {
        success: true,
        key_valid: true,
        domain_verified: false,
        message: `Domain "${fromDomain}" is added but not yet verified (status: ${matchedDomain.status}). Complete DNS verification in your Resend dashboard.`,
      };
    }

    return {
      success: true,
      key_valid: true,
      domain_verified: true,
      message: `API key valid and domain "${fromDomain}" is verified. Ready to send.`,
    };
  });

  // PATCH /api/settings/notifications
  fastify.patch<{
    Body: {
      escalation_emails?: string[];
      escalation_wa_numbers?: string[];
      escalation_customer_message?: string;
      from_email?: string | null;
      resend_api_key?: string | null;
      lead_notification_emails?: string[];
      lead_notification_wa_numbers?: string[];
      daily_report_emails?: string[];
      daily_report_wa_numbers?: string[];
      daily_report_hour_utc?: number | null;
      kitchen_notification_wa_numbers?: string[];
      privacy_notice_url?: string | null;
    };
  }>('/notifications', { preHandler: [requireAuth] }, async (request, reply) => {
    const db = getServerClient();
    const {
      escalation_emails, escalation_wa_numbers, escalation_customer_message, from_email, resend_api_key,
      lead_notification_emails, lead_notification_wa_numbers,
      daily_report_emails, daily_report_wa_numbers, daily_report_hour_utc,
      kitchen_notification_wa_numbers, privacy_notice_url,
    } = request.body;

    const { data, error } = await db
      .from('tenant_notification_settings')
      .upsert({
        tenant_id: request.tenantId,
        ...(escalation_emails !== undefined && { escalation_emails }),
        ...(escalation_wa_numbers !== undefined && { escalation_wa_numbers }),
        ...(escalation_customer_message !== undefined && { escalation_customer_message }),
        ...(from_email !== undefined && { from_email }),
        ...(resend_api_key !== undefined && { resend_api_key }),
        ...(lead_notification_emails !== undefined && { lead_notification_emails }),
        ...(lead_notification_wa_numbers !== undefined && { lead_notification_wa_numbers }),
        ...(daily_report_emails !== undefined && { daily_report_emails }),
        ...(daily_report_wa_numbers !== undefined && { daily_report_wa_numbers }),
        ...(daily_report_hour_utc !== undefined && { daily_report_hour_utc }),
        ...(kitchen_notification_wa_numbers !== undefined && { kitchen_notification_wa_numbers }),
        ...(privacy_notice_url !== undefined && { privacy_notice_url }),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' })
      .select('escalation_emails, escalation_wa_numbers, escalation_customer_message, from_email, resend_api_key, lead_notification_emails, lead_notification_wa_numbers, daily_report_emails, daily_report_wa_numbers, daily_report_hour_utc, kitchen_notification_wa_numbers, privacy_notice_url')
      .single();

    if (error) return reply.status(500).send({ success: false, error: error.message });

    const row = data as { resend_api_key: string | null } & Record<string, unknown>;
    return {
      success: true,
      data: {
        ...row,
        resend_api_key_masked: row.resend_api_key ? '••••' + row.resend_api_key.slice(-4) : '',
        resend_configured: !!row.resend_api_key,
        resend_api_key: undefined,
      },
    };
  });
}
