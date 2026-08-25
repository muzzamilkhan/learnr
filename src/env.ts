/**
 * The database is optional, exactly as it is in the web app: without a real
 * DATABASE_URL the server still boots and answers, it just cannot persist.
 * The placeholder from `.env.example` counts as absent, so copying that file
 * as-is is enough to start.
 */
const connectionString = process.env.DATABASE_URL;

export const DATABASE_URL = connectionString;

export const isDatabaseConfigured = Boolean(
  connectionString && !connectionString.includes('user:password@host'),
);

export const PORT = Number(process.env.PORT ?? 3001);
