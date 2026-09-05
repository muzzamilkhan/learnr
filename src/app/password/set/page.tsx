import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { LogoLockup } from '@/components/logo';
import { PasswordStepForm } from '@/components/password-forms';
import { PASSWORD_MIN_LENGTH } from '@/lib/password';

export const dynamic = 'force-dynamic';

/**
 * Step three: the password itself. The length rule is said here, before it is
 * typed, rather than left for the form to refuse afterwards.
 */
export default async function SetPasswordPage() {
  const session = isAuthConfigured ? await auth() : null;
  if (session?.user?.id) redirect('/');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" aria-label="LearnR home" className="no-select mx-auto mb-8">
        <LogoLockup className="w-56" />
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-(--color-line) bg-(--color-card) p-6">
        <p className="text-sm font-semibold text-(--color-ink-soft)">Choose a password</p>
        <p className="text-sm text-(--color-ink-soft)">
          At least {PASSWORD_MIN_LENGTH} characters. Long is stronger than clever.
        </p>
        <PasswordStepForm />
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
