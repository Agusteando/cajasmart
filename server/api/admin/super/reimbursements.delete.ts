import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export default defineEventHandler(async (event) => {
  const user = requireSuperAdminReal(event);
  const body = await readBody(event);
  const id = Number(body.id);

  if (!id) throw createError({ statusCode: 400 });

  const db = await useDb();

  // 1. Get files to delete from disk
  const [items]: any = await db.execute(
    'SELECT file_url FROM reimbursement_items WHERE reimbursement_id = ?',
    [id]
  );

  // 2. Delete DB records
  await db.execute('DELETE FROM reimbursement_items WHERE reimbursement_id = ?', [id]);
  await db.execute('DELETE FROM reimbursements WHERE id = ?', [id]);

  // 3. Clean up physical files (Best effort)
  const cfg = useRuntimeConfig();
  const uploadsDir = path.resolve(process.cwd(), String(cfg.uploadDir || './public/uploads'));

  for (const item of items) {
    if (item.file_url) {
      try {
        await fs.unlink(path.join(uploadsDir, item.file_url));
      } catch (e) {
        console.warn(`Could not delete file ${item.file_url}:`, e);
      }
    }
  }

  return { success: true };
});