import type { getServerClient } from '@alphabot/database';
import type { IncomingWhatsAppMessage } from '@alphabot/shared';
import { createSarvamSttProvider } from '../services/voice/providers/stt/sarvam.js';

type Db = ReturnType<typeof getServerClient>;

interface MetaMediaInfo {
  url:       string;
  mime_type: string;
}

/** Resolves a Meta media id to a short-lived download URL (Graph API). Twilio sends a direct mediaUrl already, so this is Meta-only. */
async function resolveMetaMediaUrl(mediaId: string, accessToken: string): Promise<MetaMediaInfo | null> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json() as { url?: string; mime_type?: string };
  if (!data.url) return null;
  return { url: data.url, mime_type: data.mime_type ?? 'audio/ogg' };
}

/**
 * CONV-05: transcribes a WhatsApp voice note via Sarvam STT, gated on the
 * existing (currently dormant — nothing in this codebase called it before)
 * voice_provider_configs row for stt/sarvam. Respects that row's own
 * `enabled` flag rather than forcing it on: this platform's Alphabot-
 * inherited voice infrastructure has real stored credentials but was left
 * explicitly disabled, and this is the first runtime caller of it — not
 * something to silently flip on. Returns null on any failure (no provider
 * configured/enabled, download failure, Sarvam error) so the caller falls
 * back to asking the customer to type instead, per the acceptance criteria.
 */
export async function transcribeVoiceNote(
  db:            Db,
  incoming:      IncomingWhatsAppMessage,
  accessToken:   string,
): Promise<string | null> {
  if (incoming.type !== 'audio') return null;

  try {
    const { data: sttConfig } = await db
      .from('voice_provider_configs')
      .select('enabled, credentials_json')
      .eq('component', 'stt')
      .eq('provider_name', 'sarvam')
      .maybeSingle();

    if (!sttConfig || !(sttConfig as { enabled: boolean }).enabled) return null;
    const creds = (sttConfig as { credentials_json: Record<string, unknown> }).credentials_json;
    const apiKey = creds?.['api_key'] as string | undefined;
    if (!apiKey) return null;

    let recordingUrl: string | undefined = incoming.mediaUrl;
    let mimeType = incoming.mimeType;
    if (!recordingUrl && incoming.mediaId && incoming.provider === 'meta_cloud') {
      const resolved = await resolveMetaMediaUrl(incoming.mediaId, accessToken);
      if (!resolved) return null;
      recordingUrl = resolved.url;
      mimeType = resolved.mime_type;
    }
    if (!recordingUrl) return null;

    const sarvam = createSarvamSttProvider({ api_key: apiKey });
    const result = await sarvam.transcribe({
      recordingUrl,
      recordingAuth: incoming.provider === 'meta_cloud' ? `Bearer ${accessToken}` : undefined,
      audioMimeType: mimeType,
      language: 'hi-IN', // no per-tenant language signal exists yet; Sarvam auto-detects reasonably well from this default
    });

    return result.transcript?.trim() || null;
  } catch {
    return null;
  }
}
