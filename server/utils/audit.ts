import { useDb } from './db';

export async function createAuditLog(data: {
  entityType: string;
  entityId: number;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  actorUserId: number;
  comment?: string;
}) {
  try {
    const db = await useDb();
    await db.execute(
      `INSERT INTO audit_logs 
       (entity_type, entity_id, action, from_status, to_status, actor_user_id, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        data.entityType,
        data.entityId,
        data.action,
        data.fromStatus || null,
        data.toStatus || null,
        data.actorUserId,
        data.comment || null
      ]
    );
  } catch (e) {
    console.error('Failed to create audit log:', e);
    // Don't throw, so we don't break the main transaction just for logging
  }
}