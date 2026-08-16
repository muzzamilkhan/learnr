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
        className="no-select rounded-xl border-2 border-(--color-line) px-5 py-3 text-lg font-medium text-(--color-ink-soft) transition active:scale-[0.98]"
      >
        Sign out
      </button>
    </form>
  );
}
