import { getServerClient } from '@alphabot/database';
import type { Conversation, WhatsAppProvider } from '@alphabot/shared';
import { WhatsAppGateway } from '../whatsapp/gateway.js';
import { resolveNumberForRole } from '../../lib/number-roles.js';

export interface BookingDetails {
  partySize:   number;
  bookingDate: string; // YYYY-MM-DD
  bookingTime: string; // HH:MM
}

/**
 * Staff notification for a new table-booking request — capture + notify
 * only, no availability/capacity checking (confirmed decision). Near-literal
 * copy of sendLeadNotifications (services/escalation/index.ts), reusing the
 * same tenant_notification_settings recipient lists — no new Settings UI.
 */
export async function notifyStaffOfBooking(
  conversation: Conversation,
  booking:      BookingDetails,
): Promise<void> {
  const db = getServerClient();

  const [settingsRes, contactRes, wn] = await Promise.all([
    db.from('tenant_notification_settings')
      .select('lead_notification_emails, lead_notification_wa_numbers, from_email, resend_api_key')
      .eq('tenant_id', conversation.tenant_id)
      .single(),
    db.from('contacts')
      .select('phone, name')
      .eq('id', conversation.contact_id)
      .single(),
    // WAB-06: send from the tenant's dedicated "ops" number if one is
    // configured, falling back to the default number otherwise.
    resolveNumberForRole(db, conversation.tenant_id, conversation.product_type, 'ops'),
  ]);

  const settings = settingsRes.data as {
    lead_notification_emails:     string[] | null;
    lead_notification_wa_numbers: string[] | null;
    from_email:                   string | null;
    resend_api_key:               string | null;
  } | null;

  const contact = contactRes.data;

  const customerName  = contact?.name ?? contact?.phone ?? 'Unknown';
  const customerPhone = contact?.phone ?? '—';

  // ── Email alerts ────────────────────────────────────────────────────────
  const emails = (settings?.lead_notification_emails as string[] | null) ?? [];
  if (emails.length > 0) {
    const apiKey = settings?.resend_api_key ?? process.env['RESEND_API_KEY'];
    const from   = settings?.from_email ?? process.env['RESEND_FROM_EMAIL'] ?? 'alerts@alphabot.in';
    if (apiKey) {
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fff;">
          <div style="margin-bottom:20px;">
            <span style="font-weight:700;font-size:18px;color:#111">KOT.ai</span>
            <span style="display:inline-block;margin-left:10px;background:#fff7ed;color:#c2410c;font-size:12px;font-weight:600;padding:3px 8px;border-radius:99px;">New Booking</span>
          </div>
          <h2 style="font-size:18px;font-weight:700;color:#111;margin:0 0 16px">A new table booking request has come in</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="padding:8px 0;color:#666;font-size:13px;width:140px;">Customer</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#111;">${customerName}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:13px;">Phone</td><td style="padding:8px 0;font-size:13px;color:#111;">${customerPhone}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:13px;">Party size</td><td style="padding:8px 0;font-size:13px;color:#111;">${booking.partySize}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:13px;">Date</td><td style="padding:8px 0;font-size:13px;color:#111;">${booking.bookingDate}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:13px;">Time</td><td style="padding:8px 0;font-size:13px;color:#111;">${booking.bookingTime}</td></tr>
          </table>
          <p style="font-size:13px;color:#666;">No availability check was performed — please confirm capacity with the customer directly.</p>
        </div>
      `;
      void fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from,
          to: emails,
          subject: `[KOT.ai] New booking request: ${customerName}`,
          html,
        }),
      }).catch(err => console.error('[BookingNotify] Resend error:', err));
    }
  }

  // ── WhatsApp alerts ─────────────────────────────────────────────────────
  const waNumbers = (settings?.lead_notification_wa_numbers as string[] | null) ?? [];
  if (waNumbers.length > 0 && wn) {
    const gateway = new WhatsAppGateway(wn.provider as WhatsAppProvider);

    const waMessage = [
      `🍽️ *New Table Booking Request*`,
      ``,
      `*Customer:* ${customerName}`,
      `*Phone:* ${customerPhone}`,
      `*Party size:* ${booking.partySize}`,
      `*Date:* ${booking.bookingDate}`,
      `*Time:* ${booking.bookingTime}`,
      ``,
      `_No availability check was performed — please confirm capacity directly._`,
    ].join('\n');

    await Promise.allSettled(
      waNumbers.map(number =>
        gateway.sendMessage(wn.phone_number_id, wn.access_token, {
          type: 'text',
          to:   number,
          text: waMessage,
        }).catch(err => console.error(`[BookingNotify] Failed to send WA to ${number}:`, err))
      )
    );
  }
}
