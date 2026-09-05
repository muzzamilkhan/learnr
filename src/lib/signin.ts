/**
 * What the sign-in screen reads off its own URL.
 *
 * `/signin` is where Auth.js sends someone when a sign-in fails: every
 * `SignInError` it raises carries `kind = 'signIn'`, which it resolves against
 * `pages.signIn` and redirects to as `?error=<type>`. It is also where
 * `GET /api/auth/signin` lands, carrying `?callbackUrl=`. Both parameters arrive
 * through the browser, so both are normalised here rather than read where they
 * are used - the same boundary `parseYearLevel`, `parseTarget`, `parsePhoto` and
 * `parseScoreTab` are, and for `parseScoreTab`'s reason especially: the screen
 * behind a junk parameter is perfectly good, so falling back beats refusing.
 */

/**
 * Every error worth telling a reader apart from another one.
 *
 * Auth.js has a much longer list, and most of it cannot happen here: there is
 * one provider and no email links, so `Verification`, the credentials errors and
 * the WebAuthn ones name failures this app has no way to produce. What is left
 * is the handful a Google round trip can actually end in, and the rest are
 * covered by the fallback below - a list that has to be complete is a list that
 * goes stale against a dependency's next release.
 *
 * The wording avoids the protocol. "OAuthAccountNotLinked" is a true and useless
 * thing to show a parent; what they can act on is that the email is already in
 * use, and how.
 */
const MESSAGES: Readonly<Record<string, string>> = {
  // Not a fault, and the most likely one to be seen: tapping the button and
  // then declining on Google's own consent screen. It must not read as a
  // telling-off or as a bug, because it is neither.
  AccessDenied: "That sign-in wasn't completed. You can try again whenever you like.",
  OAuthAccountNotLinked:
    'That email address is already signed up here a different way. Use the way you signed up the first time.',
  AccountNotLinked:
    'That email address is already signed up here a different way. Use the way you signed up the first time.',
  // Never worth retrying, unlike everything else here - the server is missing
  // its Google credentials, and the reader cannot do anything about it.
  Configuration: "Sign-in isn't set up on this server yet. Nothing you did caused this.",
  SessionRequired: 'Please sign in to see that page.',
  // Its own sentence rather than OAuthAccountNotLinked's, which says "use the
  // way you signed up the first time" - the one thing that cannot work here.
  // Nothing was linked and nothing was created, so there is no other way in yet.
  GoogleEmailUnverified:
    "Google couldn't confirm that email address belongs to you, so nothing was linked. Try a different Google account.",
};

/**
 * The general case, and what an unrecognised code falls back to. Auth.js is
 * free to add error types in a minor release, and a page that renders nothing
 * for one it has not heard of would leave somebody on a screen with no account
 * of why they are on it.
 */
const FALLBACK = "That sign-in didn't work. Please try again.";

/**
 * The sentence to show for an `?error=` code, or `null` when there is no error
 * to report. Arriving here with no code is the ordinary way in - from
 * `/api/auth/signin`, or by typing the URL - so that is silence and not a
 * shrug.
 */
export function authErrorMessage(code: string | undefined | null): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? FALLBACK;
}

/**
 * Where to send someone once they are in.
 *
 * It decides where a freshly signed-in session is pointed, and it is the
 * browser's word, so it is refused unless it is a path inside this app: an
 * absolute URL accepted here would be a way to land somebody on a site somebody
 * else chose the moment they signed in, which is the argument `parsePhoto`
 * makes about a remote image URL.
 *
 * A path has to begin with exactly one `/`. `//host` is protocol-relative and
 * leaves the site, and a backslash is folded to a slash by some URL parsers and
 * not others - a disagreement between two parsers about where a URL points is
 * precisely where an open redirect lives, so neither is allowed near it.
 */
export function parseCallbackUrl(value: string | undefined | null): string {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}
