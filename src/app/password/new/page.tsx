import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { LogoLockup } from '@/components/logo';
import { EmailStepForm } from '@/components/password-forms';

export const dynamic = 'force-dynamic';

/**
 * Step one of setting a password: the address it goes on.
 *
 * This is also the whole of password reset - there is no second flow for a
 * forgotten password, so the line below the heading says both things at once.
 */
export default async function NewPasswordPage() {
  const session = isAuthConfigured ? await auth() : null;
  if (session?.user?.id) redirect('/');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" aria-label="LearnR home" className="no-select mx-auto mb-8">
        <LogoLockup className="w-56" />
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-(--color-line) bg-(--color-card) p-6">
        <p className="text-sm font-semibold text-(--color-ink-soft)">Set a password</p>
        <p className="text-sm text-(--color-ink-soft)">
          We&rsquo;ll send a code to your email to prove it&rsquo;s you. This is also how to
          replace a password you&rsquo;ve forgotten.
        </p>
        <EmailStepForm />
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
