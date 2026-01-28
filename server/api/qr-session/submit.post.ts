// server/api/qr-session/submit.post.ts
import { getQrSession, setQrSessionPayload } from '~/server/utils/qrSessions';
import { parseCfdiQrText, fetchSatMeta } from '~/server/utils/cfdiQr';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: string; text?: string }>(event);

  const token = String(body?.token || '').trim();
  const text = String(body?.text || '').trim();

  if (!token || !text) {
    throw createError({ statusCode: 400, statusMessage: 'token y text requeridos' });
  }

  const s = getQrSession(token);
  if (!s) return { success: false, status: 'EXPIRED' };

  const parsed = parseCfdiQrText(text);
  const satMeta = await fetchSatMeta(parsed);

  const invoiceNumber =
    (satMeta.serie || satMeta.folio)
      ? `${satMeta.serie || ''}${satMeta.serie && satMeta.folio ? '-' : ''}${satMeta.folio || ''}`.trim()
      : (parsed.uuid || '');

  const provider =
    (satMeta.issuerName || '')?.trim() ||
    (parsed.rfcEmisor ? `RFC: ${parsed.rfcEmisor}` : '');

  const issueDateRaw = (satMeta.issueDate || '').trim();
  let issueDateIso = '';
  if (issueDateRaw) {
    const d = new Date(issueDateRaw);
    if (!Number.isNaN(d.getTime())) issueDateIso = d.toISOString().slice(0, 10);
  }

  const payload = {
    parsed,
    satMeta,
    prefill: {
      amount: parsed.total,
      total: parsed.total,
      provider,
      invoiceNumber,
      date: issueDateIso,
      dateRaw: issueDateRaw
    }
  };

  setQrSessionPayload(token, payload);
  return { success: true };
});
