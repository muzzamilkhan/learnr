import Link from 'next/link';
import { readShareInvite } from '@/server/sharing';
import { readViewer } from '@/app/viewer';
import { AcceptShare } from '@/components/accept-share';
import { SignInButton, SignOutButton } from '@/components/auth-buttons';
import { ProfileFace } from '@/components/profile-face';
import { LogoMark } from '@/components/logo';
import { yearLabel, parseYearLevel } from '@/lib/curriculum';
import { nameList } from '@/lib/format';
import type { InviteDetails } from '@/lib/dto';
import { sharePath } from '@/lib/share-link';

// Per-invite and per-visitor, and it changes the moment it is accepted.
export const dynamic = 'force-dynamic';

/**
 * Where a share link lands.
 *
 * It is a public page that names two people's children, so it says as little as
 * it can get away with: first names and year levels, which is what someone needs
 * to recognise the invitation as meant for them, and nothing about how anyone is
 * going - the report itself is behind the acceptance. A link that has been used
 * or has run out shows none of it.
 *
 * Signing in is the acceptance, so Google's round trip comes back here with
 * `?go=1` and `AcceptShare` takes the invite on arrival. Landing here already
 * signed in is the other case, and there the button is the gesture.
 */
export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ go?: string }>;
}) {
  const { token } = await params;
  const { go } = await searchParams;

  // The one read on this page that needs no session at all, and has to: the
  // link's whole point is that it reaches somebody with no account here yet.
  const invite = await readShareInvite(token);
  if (!invite || !invite.live) {
    return (
      <Frame heading="This link doesn’t work">
        <p className="text-center text-base text-(--color-ink-soft)">
          It may have been used already, or run out - a link lasts a week and lets one person in.
          Ask whoever sent it for a new one.
        </p>
        <Link
          href="/"
          className="mt-6 block text-center text-sm font-medium text-(--color-brand)"
        >
          Go to LearnR
        </Link>
      </Frame>
    );
  }

  const { userId, account } = await readViewer();

  const names = invite.children.map((child) => child.name);
  const who = invite.ownerName ?? 'A parent';

  return (
    <Frame heading={`${who} would like you to follow along`}>
      <Children invite={invite} />

      <div className="mt-6">
        {!userId ? (
          <>
            <p className="mb-4 text-center text-sm text-(--color-ink-soft)">
              Sign in and {nameList(names)}
              {names.length === 1 ? "'s" : "'"} progress is yours to read. Nothing about{' '}
              {names.length === 1 ? 'their profile' : 'their profiles'} is yours to change - that
              stays with {who}.
            </p>
            <div className="flex justify-center">
              {/* Back to this link, not to the home screen: the invite is the
                  whole reason they are signing in. */}
              <SignInButton
                size="hero"
                redirectTo={`${sharePath(token)}?go=1`}
                label="Sign in with Google to accept"
              />
            </div>
          </>
        ) : account?.role === 'child' ? (
          // A child's account is signed in on this device. Accepting here would
          // hang another family's children off a profile that plays the game, so
          // it is refused rather than quietly allowed.
          <div className="text-center">
            <p className="text-base font-semibold">
              You&rsquo;re signed in as {account.name ?? 'a young player'}.
            </p>
            <p className="mt-1 text-sm text-(--color-ink-soft)">
              This link is for a grown-up. Sign out, then open it again.
            </p>
            <div className="mt-4 flex justify-center">
              <SignOutButton />
            </div>
          </div>
        ) : userId === invite.ownerId ? (
          <div className="text-center">
            <p className="text-base font-semibold">This is your own link.</p>
            <p className="mt-1 text-sm text-(--color-ink-soft)">
              Send it to the person you want to share with - opening it yourself changes nothing.
            </p>
            <Link
              href="/children"
              className="mt-4 inline-block text-sm font-medium text-(--color-brand)"
            >
              Back to your children
            </Link>
          </div>
        ) : (
          <AcceptShare token={token} auto={go === '1'} childNames={names} />
        )}
      </div>
    </Frame>
  );
}

/** First name, year, and the face they picked. Enough to know who is meant. */
function Children({ invite }: { invite: InviteDetails }) {
  return (
    <ul className="divide-y divide-(--color-line) rounded-xl border border-(--color-line)">
      {invite.children.map((child) => {
        const level = parseYearLevel(child.level ?? '');
        return (
          <li key={child.id} className="flex items-center gap-3 px-4 py-3">
            <ProfileFace
              photo={child.photo}
              avatar={child.avatar}
              name={child.name}
              className="size-9"
              px={36}
            />
            <span className="text-base font-semibold">{child.name}</span>
            {level && (
              <span className="ml-auto text-sm text-(--color-ink-soft)">{yearLabel(level)}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One card in the middle of the page. Drawn at the parent's scale, like the
 * landing page: whoever opens this is a grown-up deciding something, and nothing
 * here is for a child at arm's length.
 */
function Frame({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-6 flex items-center justify-center gap-2">
        <LogoMark size="sm" />
        <span className="text-xl font-bold tracking-tight">LearnR</span>
      </div>
      <div className="rounded-2xl border border-(--color-line) bg-(--color-card) p-6 shadow-sm">
        <h1 className="mb-5 text-center text-xl font-semibold">{heading}</h1>
        {children}
      </div>
    </main>
  );
}
