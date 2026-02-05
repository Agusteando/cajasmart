import { readMultipartFormData } from 'h3';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  requireSuperAdminReal(event);
  
  const cfg = useRuntimeConfig();
  const uploadsDir = path.resolve(process.cwd(), String(cfg.uploadDir || './public/uploads'));
  const db = await useDb();

  // Check content type to distinguish between simple JSON (delete) and Multipart (upload)
  const contentType = getHeader(event, 'content-type') || '';

  // --- DELETE LOGIC ---
  if (contentType.includes('application/json')) {
    const body = await readBody(event);
    const { itemId, action } = body;
    
    if (action === 'delete' && itemId) {
      // Get current file
      const [rows]: any = await db.execute('SELECT file_url FROM reimbursement_items WHERE id = ?', [itemId]);
      const fileUrl = rows?.[0]?.file_url;
      
      // Update DB
      await db.execute('UPDATE reimbursement_items SET file_url = NULL WHERE id = ?', [itemId]);
      
      // Delete from disk
      if (fileUrl) {
        try { await fs.unlink(path.join(uploadsDir, fileUrl)); } catch {}
      }
      return { success: true };
    }
  }

  // --- REPLACE LOGIC (Multipart) ---
  const parts = (await readMultipartFormData(event)) || [];
  let filePart: any = null;
  let itemId: number | null = null;

  for (const p of parts) {
    if (p.name === 'file') filePart = p;
    if (p.name === 'itemId') itemId = Number(p.data.toString());
  }

  if (!filePart || !itemId) throw createError({ statusCode: 400, statusMessage: 'Bad Request' });

  // 1. Save new file
  await fs.mkdir(uploadsDir, { recursive: true });
  const original = String(filePart.filename).replace(/[^a-z0-9.]/gi, '_').slice(0, 50);
  const newFilename = `ADMIN_${Date.now()}_${original}`;
  await fs.writeFile(path.join(uploadsDir, newFilename), filePart.data);

  // 2. Get old file to delete
  const [rows]: any = await db.execute('SELECT file_url FROM reimbursement_items WHERE id = ?', [itemId]);
  const oldFile = rows?.[0]?.file_url;

  // 3. Update DB
  await db.execute('UPDATE reimbursement_items SET file_url = ? WHERE id = ?', [newFilename, itemId]);

  // 4. Delete old file
  if (oldFile) {
    try { await fs.unlink(path.join(uploadsDir, oldFile)); } catch {}
  }

  return { success: true, newFilename };
});