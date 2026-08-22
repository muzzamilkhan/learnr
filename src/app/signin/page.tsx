import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { SignInButton } from '@/components/auth-buttons';
import { CodeSignIn } from '@/components/code-sign-in';
import { LogoLockup } from '@/components/logo';
import { authErrorMessage, parseCallbackUrl } from '@/lib/signin';

// Whether this even renders depends on who is asking, and it carries a
// per-request error, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * Where a sign-in goes when it does not work.
 *
 * **This route is not optional, and its absence was a 404 on a path a parent
 * reaches by accident.** `auth.ts` names it as `pages.signIn`, and Auth.js
 * resolves *every* `SignInError` against that setting - `AccessDenied`,
 * `OAuthCallbackError`, `OAuthAccountNotLinked`, `MissingCSRF` all carry
 * `kind = 'signIn'` - so it is not a screen somebody has to navigate to on
 * purpose. Tapping "Sign in with Google" and then declining on Google's own
 * consent screen lands here, which made the ordinary act of changing your mind
 * indistinguishable from the app being broken. `GET /api/auth/signin` redirects
 * here too, with a `?callbackUrl=`.
 *
 * The alternative was deleting the `pages.signIn` line and letting Auth.js
 * render its own page. That is one line rather than this, and it is the wrong
 * one: the built-in page is unstyled and unbranded, which is the objection this
 * app already makes to a native `<select>` - the one control the theme cannot
 * reach - only louder, since this is a whole screen and the first one a failed
 * sign-in shows.
 *
 * **Both ways in, as peers**, which is the landing page's rule and holds harder
 * here: somebody who has just been bounced out of a sign-in is exactly the
 * person who might have been trying the wrong one of the two. A child who
 * mistyped their way to `/signin` finds their code box rather than a wall of
 * Google.
 *
 * **A signed-in visitor is sent home rather than offered a second sign-in.**
 * Signing in again is meaningless, and the failure this page exists to explain
 * is behind them.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  const session = isAuthConfigured ? await auth() : null;
  if (session?.user?.id) redirect('/');

  const message = authErrorMessage(error);
  // The browser's word about where to go next, so it is refused unless it
  // points inside this app - see `parseCallbackUrl`.
  const redirectTo = parseCallbackUrl(callbackUrl);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" aria-label="LearnR home" className="no-select mx-auto mb-8">
        <LogoLockup className="w-56" />
      </Link>

      {/* Out of the way of the two controls rather than above them: the reason
          somebody is here is worth saying, but what they came to do is sign in,
          and an error banner at the top of a short screen becomes the screen. */}
      {message ? (
        <p
          role="alert"
          className="mb-8 rounded-xl border border-(--color-line) bg-(--color-card) px-4 py-3 text-center text-sm text-(--color-ink-soft)"
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-(--color-line) bg-(--color-card) p-6">
        <p className="text-sm font-semibold text-(--color-ink-soft)">For a grown-up</p>
        <SignInButton size="hero" redirectTo={redirectTo} />
      </div>

      {/* The child's half, and the same weight as the half above it - neither is
          the fallback for the other. */}
      <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-(--color-line) bg-(--color-card) p-6">
        <p className="text-sm font-semibold text-(--color-ink-soft)">For a child</p>
        <CodeSignIn />
      </div>

      <Link
        href="/"
        className="mt-8 text-center text-sm text-(--color-ink-soft) underline transition hover:text-(--color-brand)"
      >
        Back to the start
      </Link>
    </main>
  );
}
