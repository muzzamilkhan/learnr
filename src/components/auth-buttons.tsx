import { signIn, signOut } from '@/auth';

export function SignInButton() {
  return (
    <form
      action={async () => {
        'use server';
        await signIn('google', { redirectTo: '/' });
      }}
    >
      <button
        type="submit"
        className="no-select rounded-2xl bg-(--color-brand) px-10 py-5 text-2xl font-semibold text-white transition active:scale-[0.98]"
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
