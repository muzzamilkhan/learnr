import Link from 'next/link';
import { SignInButton } from '@/components/auth-buttons';
import { CodeSignIn } from '@/components/code-sign-in';
import { GetStarted } from '@/components/get-started';
import { LogoLockup, LogoMark } from '@/components/logo';
import { Well } from '@/components/well';
import { subjectOverview } from '@/content/catalog';
import { yearLabel } from '@/lib/curriculum';
import { formatCount } from '@/lib/format';

/**
 * What someone sees before they sign in — the app's only public page.
 *
 * Drawn at the parent scale rather than the child's. Nobody has signed in yet, so
 * the reader is almost always a grown-up deciding whether to use this; a child
 * arrives with a code already in their hand and needs one box, not a page of
 * prose blown up to fill an iPad.
 *
 * Both ways in live in the top bar, as peers. A grown-up signs in with Google, a
 * child types their code — neither is the fallback for the other, and putting one
 * in a bar and the other at the bottom of the page would say otherwise.
 */

function TopBar() {
  return (
    <header className="sticky top-0 z-10 border-b border-(--color-line) bg-(--color-paper)/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <span className="flex items-center gap-2">
          <LogoMark size="sm" />
          <span className="text-xl font-bold tracking-tight">LearnR</span>
        </span>
        {/* Four characters read off another screen have a floor on how small
            they get, so on a phone the pair goes behind one button rather than
            being squeezed into the bar. See `GetStarted`. */}
        <div className="ml-auto flex items-center gap-4">
          <GetStarted>
            {/* In the bar the two sit side by side and speak for themselves. In
                the panel they are stacked, and an empty four-character box with
                a Go beside it needs saying whose it is. */}
            <p className="px-1 text-xs text-(--color-ink-soft) sm:hidden">
              Got a code from your grown-up?
            </p>
            <CodeSignIn variant="bar" />
            <p className="mt-2 border-t border-(--color-line) px-1 pt-3 text-xs text-(--color-ink-soft) sm:hidden">
              Or, for a parent:
            </p>
            <SignInButton size="bar" />
          </GetStarted>
        </div>
      </div>
    </header>
  );
}

function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-(--color-line) bg-(--color-card) p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-(--color-ink-soft)">{children}</p>
    </div>
  );
}

export function Landing() {
  const maths = subjectOverview('maths');
  const first = maths.levels[0];
  const last = maths.levels[maths.levels.length - 1];

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-4xl px-6 pt-14 pb-20">
        {/* The lockup is the hero's other half rather than a band above it: it
            carries the wordmark and the tagline, so stacking it over a headline
            that says much the same thing twice would be saying it twice. On a
            phone it goes first — column-reverse, so the source order still leads
            with the headline for anything reading the page rather than looking
            at it. */}
        <section className="flex flex-col-reverse items-center gap-8 sm:flex-row sm:gap-10">
          <div className="min-w-0 flex-1">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Maths practice that follows the child.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-(--color-ink-soft)">
              {first && last ? (
                <>
                  {yearLabel(first.level)} to {yearLabel(last.level)}, written against the
                  Australian Curriculum.{' '}
                </>
              ) : null}
              Questions are generated rather than stored, so the practice never runs out — and what
              comes next is chosen from what your child is actually finding hard.
            </p>
          </div>
          <LogoLockup className="w-56 shrink-0 sm:w-2/5 sm:max-w-xs" />
        </section>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Point title="It notices what&rsquo;s hard">
            Every answer updates a picture of how each topic is going. A topic that falls apart in
            the first ten questions is being asked more by the twentieth — held to about a fifth of
            the session, never so much that it becomes a drill.
          </Point>
          <Point title="Nothing to lose">
            No timer on a question, no score to protect, no streak a bad day breaks. A wrong answer
            shows the right one and waits for your child to be ready. Stars come for finishing a
            round of ten, even a hard one.
          </Point>
          <Point title="You can see how it&rsquo;s going">
            A weekly report per child: time on questions, which topics need a hand, which are
            solid, and a calendar of the days they practised.
          </Point>
        </div>

        <div className="mt-10 space-y-4">
          <Well
            title="What it teaches"
            note="Listed straight from the questions that ship, so this cannot drift from what a child is actually asked."
            aside={
              maths.templateCount > 0
                ? `${formatCount(maths.templateCount)} question templates · ${formatCount(maths.topicCount)} topics`
                : undefined
            }
          >
            <ul className="divide-y divide-(--color-line)">
              {maths.levels.map((level) => (
                <li key={level.level} className="flex flex-wrap gap-x-4 gap-y-1 py-2">
                  <span className="w-32 shrink-0 text-sm font-semibold">
                    {yearLabel(level.level)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-(--color-ink-soft)">
                    {level.topics.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/curriculum"
              className="mt-4 flex items-center gap-3 rounded-xl border border-(--color-line) p-3 transition hover:border-(--color-brand)"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Curriculum sources</span>
                <span className="mt-0.5 block text-sm text-(--color-ink-soft)">
                  The exact ACARA content description behind every question, year by year — and the
                  attribution this app carries.
                </span>
              </span>
              <span aria-hidden className="ml-auto text-lg text-(--color-brand)">
                &rarr;
              </span>
            </Link>
          </Well>

          <Well
            title="How a child gets in"
            note="A child needs no email, no password and no account of their own."
          >
            <ol className="divide-y divide-(--color-line) text-sm">
              <li className="py-2">
                <strong className="font-semibold">You sign in with Google</strong> and add each
                child — a name, an avatar, and{' '}
                <strong className="font-semibold">the school year they&rsquo;re in</strong>. Setting
                the year is yours, not theirs: left to choose, a child picks the year that feels
                easiest, and the point of this app is the questions that don&rsquo;t.
              </li>
              <li className="py-2">
                <strong className="font-semibold">They type a 4-character code</strong> in the box
                at the top of this page. The code lasts an hour, so it only has to survive being
                read off your screen and typed into theirs.
              </li>
              <li className="py-2">
                <strong className="font-semibold">Then they stay signed in.</strong> Being locked
                out of a maths app mid-term and having to find a parent is the friction this
                replaces.
              </li>
            </ol>
          </Well>
        </div>
      </main>
    </>
  );
}
