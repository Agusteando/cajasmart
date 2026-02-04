import mysql, { type Pool } from 'mysql2/promise';

let pool: Pool | null = null;

export const useDb = async (): Promise<Pool> => {
  if (pool) return pool;

  const config = useRuntimeConfig();

  const host = config.dbHost || process.env.DB_HOST;
  const user = config.dbUser || process.env.DB_USER;
  const password = config.dbPass || process.env.DB_PASSWORD;
  const database = config.dbName || process.env.DB_NAME;

  if (!host || !user || !database) {
    console.error(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'ERROR',
        message: 'DB not configured',
        data: { hasHost: !!host, hasUser: !!user, hasDatabase: !!database }
      })
    );
    throw createError({ statusCode: 500, statusMessage: 'DB not configured' });
  }

  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      level: 'INFO',
      message: 'DB pool init',
      data: { host, user, database }
    })
  );

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    // Fix for 502 Bad Gateway / Connection drops
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  return pool;
};