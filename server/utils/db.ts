import mysql from 'mysql2/promise';

let pool: any = null;

export const useDb = async () => {
  if (!pool) {
    const config = useRuntimeConfig();
    try {
      pool = mysql.createPool({
        host: config.dbHost,
        user: config.dbUser,
        password: config.dbPass,
        database: config.dbName,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        // Ensures dates come back as strings (YYYY-MM-DD) for easy Vue handling
        dateStrings: true 
      });
    } catch (e) {
      console.error("DB Config Error", e);
      throw e;
    }
  }
  return pool;
};