import { signIn, signOut } from '@/auth';

/**
 * `lg` is the child's scale; `bar` is the landing page's top bar, where it sits
 * beside the code box rather than alone on a screen of its own.
 */
export function SignInButton({ size = 'lg' }: { size?: 'lg' | 'bar' }) {
  return (
    <form
      action={async () => {
        'use server';
        await signIn('google', { redirectTo: '/' });
      }}
    >
      <button
        type="submit"
        className={
          size === 'bar'
            ? // Full width inside the phone's "Get started" panel, its own width
              // once it is in the bar itself. See `GetStarted`.
              'no-select w-full rounded-lg bg-(--color-brand) px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white transition active:scale-[0.98] sm:w-auto'
            : 'no-select rounded-2xl bg-(--color-brand) px-10 py-5 text-2xl font-semibold text-white transition active:scale-[0.98]'
        }
      >
        Sign in with Google
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
