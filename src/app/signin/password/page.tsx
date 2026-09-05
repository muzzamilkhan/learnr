import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { LogoLockup } from '@/components/logo';
import { PasswordSignInForm } from '@/components/password-forms';

// Per-request, like `/signin` - it redirects a signed-in visitor and must
// never be prerendered and shared between two of them.
export const dynamic = 'force-dynamic';

/**
 * A grown-up signing in with a password rather than Google, once they have set
 * one at `/password/new`. Parent density throughout - this is never a screen a
 * child sees.
 */
export default async function PasswordSignInPage() {
  const session = isAuthConfigured ? await auth() : null;
  if (session?.user?.id) redirect('/');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" aria-label="LearnR home" className="no-select mx-auto mb-8">
        <LogoLockup className="w-56" />
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-(--color-line) bg-(--color-card) p-6">
        <p className="text-sm font-semibold text-(--color-ink-soft)">Sign in with a password</p>
        <PasswordSignInForm />
      </div>

      <Link
        href="/signin"
        className="mt-8 text-center text-sm text-(--color-ink-soft) underline transition hover:text-(--color-brand)"
      >
        Back to the start
      </Link>
    </main>
  );
}
