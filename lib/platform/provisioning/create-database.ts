import postgres from 'postgres';

/**
 * Creates a new PostgreSQL database pay_t_{slug} on the database server.
 */
export async function createTenantDatabase(slug: string): Promise<{
  dbName: string;
  dbUser: string;
  dbPasswordPlain: string;
  connectionUrl: string;
}> {
  // Clean slug format to prevent SQL injection
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const dbName = `pay_t_${safeSlug}`;

  const mainDbUrl = process.env.DATABASE_URL;
  if (!mainDbUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  // Parse admin user, host, port from DATABASE_URL
  const urlObj = new URL(mainDbUrl.replace('postgresql://', 'http://'));
  const dbUser = urlObj.username || 'postgres';
  const dbPasswordPlain = urlObj.password || 'admin';
  const dbHost = urlObj.hostname || '127.0.0.1';
  const dbPort = urlObj.port || '5432';

  // Connect to postgres default DB to issue CREATE DATABASE statement
  const adminPgUrl = `postgresql://${dbUser}:${dbPasswordPlain}@${dbHost}:${dbPort}/postgres`;
  const adminSql = postgres(adminPgUrl, { max: 1 });

  try {
    // Check if database already exists
    const existing = await adminSql`
      SELECT datname FROM pg_database WHERE datname = ${dbName}
    `;

    if (existing.length === 0) {
      // Issue raw CREATE DATABASE (Postgres parameterized queries don't allow identifier parameters for CREATE DATABASE)
      await adminSql.unsafe(`CREATE DATABASE "${dbName}"`);
    }

    const connectionUrl = `postgresql://${dbUser}:${dbPasswordPlain}@${dbHost}:${dbPort}/${dbName}`;

    return {
      dbName,
      dbUser,
      dbPasswordPlain,
      connectionUrl,
    };
  } finally {
    await adminSql.end();
  }
}
