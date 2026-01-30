import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  // Security: Only allow Super Admin to see schema
  try {
    requireSuperAdminReal(event);
  } catch (e) {
    // If auth fails completely (e.g. login broken), you can comment out the line above temporarily to debug
    // but remember to uncomment it or delete this file afterwards.
    throw e;
  }

  const db = await useDb();

  // Get current database name
  const [dbNameRows]: any = await db.execute('SELECT DATABASE() as db');
  const dbName = dbNameRows[0]?.db;

  if (!dbName) {
    return { error: 'Could not determine database name' };
  }

  // Get all columns for all tables in the current database
  const [rows]: any = await db.execute(
    `
    SELECT 
      TABLE_NAME as tableName, 
      COLUMN_NAME as columnName, 
      DATA_TYPE as dataType, 
      COLUMN_TYPE as columnType,
      IS_NULLABLE as isNullable,
      COLUMN_KEY as columnKey,
      EXTRA as extra
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = ? 
    ORDER BY TABLE_NAME, ORDINAL_POSITION
    `,
    [dbName]
  );

  // Group by table for readability
  const schema: Record<string, any[]> = {};
  
  for (const row of rows) {
    if (!schema[row.tableName]) {
      schema[row.tableName] = [];
    }
    schema[row.tableName].push({
      name: row.columnName,
      type: row.columnType,
      nullable: row.isNullable,
      key: row.columnKey,
      extra: row.extra
    });
  }

  return {
    database: dbName,
    tables: Object.keys(schema),
    schema
  };
});