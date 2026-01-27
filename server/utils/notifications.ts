import { useDb } from './db';

export async function createNotification(data: {
  userId: number;
  type: string;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: number;
}) {
  try {
    const db = await useDb();
    await db.execute(
      `INSERT INTO notifications 
       (user_id, type, title, message, reference_type, reference_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        data.userId, 
        data.type, 
        data.title, 
        data.message, 
        data.referenceType || null, 
        data.referenceId || null
      ]
    );
  } catch (e) {
    console.error('Failed to create notification:', e);
  }
}

export async function notifyRoleUsers(
  roleName: string, 
  type: string, 
  title: string, 
  message: string, 
  refType?: string, 
  refId?: number
) {
  const db = await useDb();
  // Find all active users with this role
  const [users]: any = await db.execute(
    `SELECT u.id FROM users u 
     JOIN roles r ON u.role_id = r.id 
     WHERE r.nombre = ? AND u.activo = 1`,
    [roleName]
  );
  
  for (const user of users) {
    await createNotification({
      userId: user.id,
      type,
      title,
      message,
      referenceType: refType,
      referenceId: refId
    });
  }
}