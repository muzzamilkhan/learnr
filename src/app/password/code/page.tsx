import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, isSessionReadable } from '@/auth';
import { LogoLockup } from '@/components/logo';
import { CodeStepForm } from '@/components/password-forms';
import { normaliseEmail } from '@/lib/verification-code';

export const dynamic = 'force-dynamic';

/**
 * Step two: the code that just arrived. `?email=` names where it went, and it
 * is not a secret worth guarding here - the code is bound to it server-side, so
 * editing the query string only makes the code not match.
 */
export default async function PasswordCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = isSessionReadable ? await auth() : null;
  if (session?.user?.id) redirect('/');

  const { email } = await searchParams;
  const address = normaliseEmail(email ?? '');
  if (!address) redirect('/password/new');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" aria-label="LearnR home" className="no-select mx-auto mb-8">
        <LogoLockup className="w-56" />
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-(--color-line) bg-(--color-card) p-6">
        <p className="text-sm font-semibold text-(--color-ink-soft)">Check your email</p>
        <p className="text-sm text-(--color-ink-soft)">
          We sent a code to <span className="font-semibold">{address}</span>.
        </p>
        <CodeStepForm email={address} />
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
