import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400 });

  const db = await useDb();
  const [rows]: any = await db.execute('SELECT id, user_id, status FROM reimbursements WHERE id = ?', [id]);
  const record = rows?.[0];

  if (!record) throw createError({ statusCode: 404 });
  
  if (user.role_name !== 'SUPER_ADMIN' && Number(record.user_id) !== Number(user.id)) {
    throw createError({ statusCode: 403 });
  }

  // ✅ ALLOW deleting if 'PENDING_OPS_REVIEW'
  const allowedStatuses = ['DRAFT', 'RETURNED', 'PENDING_OPS_REVIEW'];
  
  if (!allowedStatuses.includes(record.status) && user.role_name !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 400, statusMessage: 'Ya no se puede eliminar (en proceso avanzado).' });
  }

  // Get files to clean up (optional best effort)
  const [items]: any = await db.execute('SELECT file_url FROM reimbursement_items WHERE reimbursement_id = ?', [id]);

  await db.execute('DELETE FROM reimbursement_items WHERE reimbursement_id = ?', [id]);
  await db.execute('DELETE FROM reimbursements WHERE id = ?', [id]);

  // Clean up files
  const cfg = useRuntimeConfig();
  const uploadsDir = path.resolve(process.cwd(), String(cfg.uploadDir || './public/uploads'));
  for(const i of items) {
     if(i.file_url) try { await fs.unlink(path.join(uploadsDir, i.file_url)); } catch {}
  }

  return { success: true };
});