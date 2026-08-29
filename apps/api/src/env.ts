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

/**
 * The origins the browser may call this API from, as an exact allowlist.
 *
 * The web app used to be the only caller and reached this API server-side,
 * where the same-origin rules do not apply. It calls it from the browser now
 * for the things a child does while playing, so those calls are cross-origin
 * and carry a cookie - and a browser refuses a wildcard origin the moment
 * credentials are involved. So the list is exact, and never reflected back from
 * whatever asked.
 *
 * Read per call rather than at import, so a test can set it and build a server.
 * The default is the port `npm run dev` serves the web app on, so a local pair
 * needs no entry; production sets it to the deployed web app.
 */
export const webOrigins = (): string[] =>
  (process.env.LEARNR_WEB_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
