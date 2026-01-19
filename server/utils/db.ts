import mysql from 'mysql2/promise';

let pool: any = null;

export const useDb = async () => {
  if (!pool) {
    const config = useRuntimeConfig();

    const host = config.dbHost || process.env.DB_HOST;
    const user = config.dbUser || process.env.DB_USER;
    const password = config.dbPass || process.env.DB_PASSWORD;
    const database = config.dbName || process.env.DB_NAME;

    try {
      pool = mysql.createPool({
        host,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        dateStrings: true
      });
    } catch (e) {
      console.error('DB Config Error', e);
      throw e;
    }
  }
  return pool;
};
