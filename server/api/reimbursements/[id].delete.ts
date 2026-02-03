import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400 });

  const db = await useDb();
  const [rows]: any = await db.execute('SELECT id, user_id, status FROM reimbursements WHERE id = ?', [id]);
  const record = rows?.[0];

  if (!record) throw createError({ statusCode: 404 });
  if (user.role_name !== 'SUPER_ADMIN' && Number(record.user_id) !== Number(user.id)) throw createError({ statusCode: 403 });
  if (!['DRAFT', 'RETURNED'].includes(record.status) && user.role_name !== 'SUPER_ADMIN') throw createError({ statusCode: 400, statusMessage: 'No se puede eliminar' });

  await db.execute('DELETE FROM reimbursement_items WHERE reimbursement_id = ?', [id]);
  await db.execute('DELETE FROM reimbursements WHERE id = ?', [id]);

  return { success: true };
});