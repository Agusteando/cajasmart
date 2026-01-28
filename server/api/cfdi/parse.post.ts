// server/api/cfdi/parse.post.ts
import { parseCfdiQrText, fetchSatMeta } from '~/server/utils/cfdiQr';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ text?: string }>(event);
  const text = String(body?.text || '').trim();

  if (!text) {
    throw createError({ statusCode: 400, statusMessage: 'text requerido' });
  }

  const parsed = parseCfdiQrText(text);

  // If it's not the SAT URL, we still return parsed (mostly raw)
  const satMeta = await fetchSatMeta(parsed);

  // Prefill mapping for your UI fields
  const invoiceNumber =
    (satMeta.serie || satMeta.folio)
      ? `${satMeta.serie || ''}${satMeta.serie && satMeta.folio ? '-' : ''}${satMeta.folio || ''}`.trim()
      : (parsed.uuid || '');

  const provider =
    (satMeta.issuerName || '')?.trim() ||
    (parsed.rfcEmisor ? `RFC: ${parsed.rfcEmisor}` : '');

  // Date input expects YYYY-MM-DD; SAT often returns localized string.
  // We return both raw + a best-effort ISO date if it looks parseable.
  const issueDateRaw = (satMeta.issueDate || '').trim();
  let issueDateIso = '';
  if (issueDateRaw) {
    const d = new Date(issueDateRaw);
    if (!Number.isNaN(d.getTime())) issueDateIso = d.toISOString().slice(0, 10);
  }

  return {
    parsed,
    satMeta,
    prefill: {
      amount: parsed.total,      // total CFDI -> monto
      total: parsed.total,       // keep both for boss language
      provider,                  // proveedor
      invoiceNumber,             // numero de factura (best-effort via SAT; else UUID)
      date: issueDateIso,        // fecha
      dateRaw: issueDateRaw      // if you want to show it
    }
  };
});
