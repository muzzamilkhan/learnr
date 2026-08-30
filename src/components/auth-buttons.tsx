import { cookies } from 'next/headers';
import { signIn, signOut } from '@/auth';
import { DEBUG_COOKIE } from '@/lib/speedrun/taps';

/**
 * `lg` is the child's scale; `bar` is the landing page's top bar, where it sits
 * beside the code box rather than alone on a screen of its own; `hero` is the
 * landing page's one call to action, which is a parent's - big enough to be the
 * thing on the screen to press, but not blown up to the child's scale.
 */
const SIZES = {
  lg: 'no-select rounded-2xl bg-(--color-brand) px-10 py-5 text-2xl font-semibold text-white transition active:scale-[0.98]',
  // Full width inside the phone's "Get started" panel, its own width once it is
  // in the bar itself. See `GetStarted`.
  bar: 'no-select w-full rounded-lg bg-(--color-brand) px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white transition active:scale-[0.98] sm:w-auto',
  hero: 'no-select rounded-xl bg-(--color-grape) px-5 py-3 text-base font-semibold text-white shadow-md transition hover:brightness-110 active:scale-[0.98]',
} as const;

/**
 * `redirectTo` exists for one caller: someone who arrived on a share link and has
 * to sign in before they can take it. Google's round trip has to come back to the
 * link rather than to the home screen, or the invite is lost between the two.
 */
export function SignInButton({
  size = 'lg',
  redirectTo = '/',
  label = 'Sign in with Google',
}: {
  size?: keyof typeof SIZES;
  redirectTo?: string;
  label?: string;
}) {
  return (
    <form
      action={async () => {
        'use server';
        await signIn('google', { redirectTo });
      }}
    >
      <button type="submit" className={SIZES[size]}>
        {label}
      </button>
    </form>
  );
}

/** Lives inside the profile menu, so it is shaped as a row in it rather than a button. */
export function SignOutButton() {
  return (
    <form
      action={async () => {
        'use server';
        // DIAGNOSTIC: the tap-funnel readout is remembered in a cookie for the
        // life of the browser session, so it goes when whoever turned it on
        // does. A shared family iPad is the reason: the next person to sign in
        // is a different child, and inheriting a stranger's diagnostic overlay
        // over their game is not a thing they can be expected to turn off.
        (await cookies()).delete(DEBUG_COOKIE);
        await signOut({ redirectTo: '/' });
      }}
    >
      <button
        type="submit"
        role="menuitem"
        className="no-select w-full rounded-xl px-3 py-2.5 text-left text-lg font-medium text-(--color-ink-soft) transition active:scale-[0.98] active:bg-(--color-brand-soft)"
      >
        Sign out
      </button>
    </form>
  );
}
