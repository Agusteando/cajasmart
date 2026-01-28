// server/utils/cfdiQr.ts
export type CfdiQrParsed = {
  raw: string;
  satUrl: string | null;
  uuid: string | null; // "id" param
  rfcEmisor: string | null; // "re"
  rfcReceptor: string | null; // "rr"
  total: number | null; // "tt"
  selloLast8: string | null; // "fe"
};

export type CfdiSatMeta = {
  issuerName?: string | null;
  receiverName?: string | null;
  issueDate?: string | null; // try keep original string
  serie?: string | null;
  folio?: string | null;
  status?: string | null;
};

function tryUrl(text: string) {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

function normalizeTotal(tt: string) {
  const s = String(tt || '').trim().replace(',', '.');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function parseCfdiQrText(text: string): CfdiQrParsed {
  const raw = String(text || '').trim();

  // Many CFDI QRs contain a SAT verification URL like:
  // https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=UUID&re=RFC_EMISOR&rr=RFC_RECEPTOR&tt=TOTAL&fe=SELLO8
  const u = tryUrl(raw);

  let satUrl: string | null = null;
  let uuid: string | null = null;
  let rfcEmisor: string | null = null;
  let rfcReceptor: string | null = null;
  let total: number | null = null;
  let selloLast8: string | null = null;

  if (u) {
    satUrl = raw;

    // common params
    uuid = u.searchParams.get('id') || u.searchParams.get('uuid');
    rfcEmisor = u.searchParams.get('re') || u.searchParams.get('rfe') || null;
    rfcReceptor = u.searchParams.get('rr') || u.searchParams.get('rfr') || null;

    const tt = u.searchParams.get('tt') || u.searchParams.get('total') || null;
    total = tt ? normalizeTotal(tt) : null;

    selloLast8 = u.searchParams.get('fe') || null;
  } else {
    // If they paste the raw QR payload (sometimes it's exactly the SAT URL; otherwise we can't reliably parse).
    // Keep as raw for debugging.
  }

  return { raw, satUrl, uuid, rfcEmisor, rfcReceptor, total, selloLast8 };
}

function pickFirst(html: string, patterns: RegExp[]) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].replace(/&nbsp;/g, ' ').trim();
  }
  return null;
}

// Best-effort scrape of SAT verify page HTML (structure can change).
export async function fetchSatMeta(parsed: CfdiQrParsed): Promise<CfdiSatMeta> {
  if (!parsed.satUrl) return {};

  let html = '';
  try {
    const res = await fetch(parsed.satUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'CajaSmart/1.0' }
    });
    html = await res.text();
  } catch {
    return {};
  }

  const issuerName = pickFirst(html, [
    /Nombre\s+del\s+Emisor[^<]*<\/[^>]+>\s*<[^>]+>\s*([^<]+)\s*</i,
    /lblNombreEmisor[^>]*>\s*([^<]+)\s*</i,
    /Nombre\s+Emisor[^<]*:\s*<\/[^>]+>\s*([^<]+)\s*</i
  ]);

  const receiverName = pickFirst(html, [
    /Nombre\s+del\s+Receptor[^<]*<\/[^>]+>\s*<[^>]+>\s*([^<]+)\s*</i,
    /lblNombreReceptor[^>]*>\s*([^<]+)\s*</i
  ]);

  const issueDate = pickFirst(html, [
    /Fecha\s+de\s+Emisi[oó]n[^<]*<\/[^>]+>\s*<[^>]+>\s*([^<]+)\s*</i,
    /lblFechaEmision[^>]*>\s*([^<]+)\s*</i
  ]);

  const serie = pickFirst(html, [
    /Serie[^<]*<\/[^>]+>\s*<[^>]+>\s*([^<]+)\s*</i,
    /lblSerie[^>]*>\s*([^<]+)\s*</i
  ]);

  const folio = pickFirst(html, [
    /Folio[^<]*<\/[^>]+>\s*<[^>]+>\s*([^<]+)\s*</i,
    /lblFolio[^>]*>\s*([^<]+)\s*</i
  ]);

  const status = pickFirst(html, [
    /Estatus[^<]*<\/[^>]+>\s*<[^>]+>\s*([^<]+)\s*</i,
    /Estado\s+del\s+Comprobante[^<]*<\/[^>]+>\s*<[^>]+>\s*([^<]+)\s*</i
  ]);

  return {
    issuerName,
    receiverName,
    issueDate,
    serie,
    folio,
    status
  };
}
