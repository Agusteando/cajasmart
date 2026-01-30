// server/routes/uploads/[...path].get.ts
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAuth } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';

function contentTypeFor(ext: string) {
  switch (ext.toLowerCase()) {
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.xml':
      return 'application/xml; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function safeRelPath(p: string) {
  const s = String(p || '').replace(/^\/+/, '');
  if (!s || s.includes('..') || s.includes('\\')) return null;
  return s;
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);

  const raw = String(event.context.params?.path || '');
  const rel = safeRelPath(raw);
  if (!rel) throw createError({ statusCode: 400, statusMessage: 'Invalid path' });

  // We only expect a single filename (UUID.ext). If someone tries nested paths, block.
  if (rel.includes('/')) throw createError({ statusCode: 400, statusMessage: 'Invalid filename' });

  const db = await useDb();

  // FIX: Look up the file in 'reimbursement_items' and join with 'reimbursements'
  // to get the user_id for permission checking.
  const [rows]: any = await db.execute(
    `SELECT r.id, r.user_id 
     FROM reimbursement_items i
     JOIN reimbursements r ON i.reimbursement_id = r.id
     WHERE i.file_url = ? 
     LIMIT 1`,
    [rel]
  );
  
  const row = rows?.[0];
  if (!row) throw createError({ statusCode: 404, statusMessage: 'File not found in database' });

  // Requester can only access their own files
  if (user.role_name === 'ADMIN_PLANTEL' && Number(row.user_id) !== Number(user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado' });
  }

  const cfg = useRuntimeConfig() as any;
  const uploadDirCfg = String(cfg.uploadDir || './public/uploads');
  const uploadDirAbs = path.isAbsolute(uploadDirCfg)
    ? uploadDirCfg
    : path.resolve(process.cwd(), uploadDirCfg);

  const abs = path.resolve(uploadDirAbs, rel);
  if (!abs.startsWith(uploadDirAbs)) throw createError({ statusCode: 400, statusMessage: 'Invalid path' });

  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'File not found on disk' });
  }
  if (!stat.isFile()) throw createError({ statusCode: 404, statusMessage: 'File not found' });

  const ext = path.extname(abs);
  const ct = contentTypeFor(ext);

  setHeader(event, 'Content-Type', ct);
  setHeader(event, 'Content-Disposition', `inline; filename="${path.basename(rel)}"`);
  setHeader(event, 'Accept-Ranges', 'bytes');
  setHeader(event, 'Cache-Control', 'private, no-store');

  const range = getHeader(event, 'range');
  const size = stat.size;

  // Range support (needed for smooth PDF viewing in-browser)
  if (range && typeof range === 'string') {
    const m = range.match(/bytes=(\d+)-(\d+)?/);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : size - 1;

      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && end < size) {
        event.node.res.statusCode = 206;
        setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`);
        setHeader(event, 'Content-Length', String(end - start + 1));
        return sendStream(event, createReadStream(abs, { start, end }));
      }
    }
  }

  setHeader(event, 'Content-Length', String(size));
  return sendStream(event, createReadStream(abs));
});