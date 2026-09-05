/**
 * `isAuthConfigured` used to answer one question: was the app fully wired up
 * for Google sign-in. Adding a password path split that into two questions
 * that used to have the same answer and no longer do.
 *
 * Both take their inputs as an argument rather than reading `process.env`
 * directly, so they are pure and live here rather than in `src/auth.ts` -
 * `src/lib/purity.test.ts` is what holds that boundary. `src/auth.ts` reads
 * the environment once and applies these.
 */
export interface AuthEnv {
  secret: string | null | undefined;
  database: boolean;
  googleId: string | null | undefined;
  googleSecret: string | null | undefined;
}

/**
 * May a session exist and be read at all?
 *
 * A session - Google's or a password one - is a `Session` row plus a signed
 * cookie. Neither needs Google: a password sign-in writes the row and sets the
 * cookie itself, with no OAuth round trip. So this needs only `AUTH_SECRET`
 * (to sign the cookie) and a reachable database (to hold the row), and it is
 * what every call site gating `auth()` must use - `readViewer` above all,
 * since it is how every screen learns who is asking. Gating that call on
 * Google credentials instead is the defect this exists to fix: a deployment
 * with a secret and a database but no Google app lets a parent sign in with a
 * password, write their session, and then never have it read back.
 */
export function sessionsReadable({ secret, database }: AuthEnv): boolean {
  return Boolean(secret) && database;
}

/**
 * Is Google sign-in itself available?
 *
 * This is the narrower question `isAuthConfigured` used to answer for
 * everything: whether to offer the Google button, or to say sign-in has not
 * been set up at all. It needs both Google variables *and* the secret, since
 * an app with no secret cannot sign anyone in by any route.
 */
export function googleConfigured({ secret, googleId, googleSecret }: AuthEnv): boolean {
  return Boolean(secret) && Boolean(googleId) && Boolean(googleSecret);
}
