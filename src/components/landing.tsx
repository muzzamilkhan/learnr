import Link from 'next/link';
import { SignInButton } from '@/components/auth-buttons';
import { CodeSignIn } from '@/components/code-sign-in';
import { GetStarted } from '@/components/get-started';
import { LogoLockup, LogoMark } from '@/components/logo';
import { subjectOverview } from '@/content/catalog';
import { shortYearLabel, yearLabel } from '@/lib/curriculum';
import { formatCount } from '@/lib/format';

/**
 * What someone sees before they sign in - the app's only public page.
 *
 * Drawn at the parent scale rather than the child's. Nobody has signed in yet, so
 * the reader is almost always a grown-up deciding whether to use this; a child
 * arrives with a code already in their hand and needs one box, not a page of
 * prose blown up to fill an iPad.
 *
 * Both ways in live in the top bar, as peers. A grown-up signs in with Google, a
 * child types their code - neither is the fallback for the other, and putting one
 * in a bar and the other at the bottom of the page would say otherwise.
 *
 * **The copy says what this is and who it helps, not how it is built.** How the
 * selector weights a topic, that questions are generated rather than stored, how
 * long a code lives - those are true and they are on this page's author's mind,
 * but a parent deciding in thirty seconds is asking whether their child will use
 * it and whether they will learn anything. What the machinery buys them is the
 * claim; the machinery itself is not. The one technical thing that stays is the
 * curriculum, because that is the claim a parent would actually want to check -
 * and it is listed straight from the shipped questions, so it cannot be
 * flattering.
 *
 * The colour comes from the logo (`--color-grape` and friends), which was the
 * other half of the problem: a loud, warm mark at the top of a cool blue page of
 * boxes read as two different products.
 */

function TopBar() {
  return (
    <header className="sticky top-0 z-10 border-b border-(--color-line) bg-(--color-paper)/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
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

/**
 * A section heading. Small and coloured rather than another 24px bold line - the
 * page is a run of panels, and what separates them should be lighter than what
 * is inside them, not heavier.
 */
function Eyebrow({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <p className={`text-xs font-bold tracking-widest uppercase ${tone}`}>{children}</p>
  );
}

/**
 * One promise, with a coloured tile carrying its number or glyph.
 *
 * The tile is doing the work the old page asked a bare heading to do: at a skim
 * it is what tells you there are three of these and where each one starts.
 */
function Point({
  glyph,
  tone,
  title,
  children,
}: {
  glyph: React.ReactNode;
  /** Background and text classes for the tile, e.g. `bg-(--color-sun-soft) text-(--color-sun)`. */
  tone: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-base font-bold ${tone}`}
      >
        {glyph}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-(--color-ink-soft)">
          {children}
        </span>
      </span>
    </li>
  );
}

/** A panel on this page: the same box as `Well`, with room for a coloured heading. */
function Panel({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-(--color-line) bg-(--color-card) p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function Landing() {
  const maths = subjectOverview('maths');
  const first = maths.levels[0];
  const last = maths.levels[maths.levels.length - 1];

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-5xl px-6 pt-10 pb-20">
        {/* The hero is a tinted panel rather than bare paper - the mark's own
            violet, at the strength a background can be read over. The lockup is
            the hero's other half rather than a band above it: it carries the
            wordmark and the tagline, so stacking it over a headline saying much
            the same thing would be saying it twice. On a phone it goes first -
            column-reverse, so the source order still leads with the headline for
            anything reading the page rather than looking at it. */}
        <section className="relative overflow-hidden rounded-3xl border border-(--color-line) bg-gradient-to-br from-(--color-grape-soft) via-(--color-paper) to-(--color-brand-soft) px-6 py-10 sm:px-10 sm:py-12">
          {/* Two soft discs behind the content, in the mark's warm colours. They
              are the only decoration on the page and they carry no meaning, so
              they are hidden from anything reading it aloud. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-(--color-sun-soft) opacity-70 blur-2xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-12 size-56 rounded-full bg-(--color-berry-soft) opacity-70 blur-2xl"
          />

          <div className="relative flex flex-col-reverse items-center gap-8 sm:flex-row sm:gap-10">
            <div className="min-w-0 flex-1">
              {first && last ? (
                <p className="inline-flex items-center gap-2 rounded-full bg-(--color-card) px-3 py-1 text-xs font-semibold text-(--color-grape) shadow-sm">
                  <span aria-hidden className="size-1.5 rounded-full bg-(--color-grape)" />
                  {shortYearLabel(first.level)} to {shortYearLabel(last.level)} · Australian
                  Curriculum
                </p>
              ) : null}
              <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
                Maths practice that meets your child where they are.
              </h1>
              <p className="mt-4 max-w-prose text-lg leading-relaxed text-(--color-ink-soft)">
                Short rounds of maths at their own school year, in a place with nothing to lose -
                and a straight weekly read for you on how it is really going.
              </p>
              {/* The one call to action on the page, centred under the copy it
                  follows rather than tucked against the left margin - a single
                  button in a column of left-aligned text reads as another line
                  of that text, and this is the thing the page is asking for. */}
              <div className="mt-6 flex flex-col items-center gap-2 text-center">
                <SignInButton size="hero" />
                <p className="text-sm text-(--color-ink-soft)">
                  Free to set up. Your child needs no email and no password.
                </p>
              </div>
            </div>
            <LogoLockup className="w-52 shrink-0 sm:w-2/5 sm:max-w-xs" />
          </div>
        </section>

        {/* Two panels rather than one row of six cards, because the reader is
            asking two separate questions - will my child use it, and will I know
            whether it worked - and the answers should not be shuffled together. */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Panel>
            <Eyebrow tone="text-(--color-grape)">For your child</Eyebrow>
            <h2 className="mt-1 text-xl font-semibold">Somewhere it is safe to be wrong.</h2>
            <ul className="mt-4 space-y-4">
              <Point
                glyph="◎"
                tone="bg-(--color-grape-soft) text-(--color-grape)"
                title="Questions pitched at their year"
              >
                You set the school year, and every question comes from that year&rsquo;s maths.
                Nothing is out of reach, and nothing is babyish.
              </Point>
              <Point
                glyph="↗"
                tone="bg-(--color-leaf-soft) text-(--color-leaf)"
                title="More of what&rsquo;s wobbly, without the drilling"
              >
                LearnR notices the topics that aren&rsquo;t sticking and brings them round more
                often - enough to shift them, never so much that it starts to feel like being
                picked on.
              </Point>
              <Point
                glyph="★"
                tone="bg-(--color-star-soft) text-(--color-star)"
                title="Nothing to lose"
              >
                No timer on a question and no score to protect. A wrong answer shows the right one
                and waits. Stars come for finishing a round - even a hard one.
              </Point>
            </ul>
          </Panel>

          <Panel>
            <Eyebrow tone="text-(--color-berry)">For you</Eyebrow>
            <h2 className="mt-1 text-xl font-semibold">You&rsquo;ll know how it is going.</h2>
            <ul className="mt-4 space-y-4">
              <Point
                glyph="◔"
                tone="bg-(--color-berry-soft) text-(--color-berry)"
                title="A weekly read, not a wall of numbers"
              >
                Which topics need a hand, which are solid, and how much practice actually happened
                - in the words you would use to ask a teacher.
              </Point>
              <Point
                glyph="▦"
                tone="bg-(--color-brand-soft) text-(--color-brand)"
                title="The days they practised"
              >
                A month at a glance, so you can see a habit forming instead of guessing at one.
              </Point>
              <Point
                glyph="⚑"
                tone="bg-(--color-sun-soft) text-(--color-sun)"
                title="Choosing the level is yours"
              >
                Left to pick their own year, a child picks the one that feels easiest - and the
                whole point of this is the questions that don&rsquo;t.
              </Point>
            </ul>
          </Panel>
        </div>

        {/* Three steps, numbered, because the question underneath "will they use
            it" is always "what do I have to do first". */}
        <Panel className="mt-4">
          <Eyebrow tone="text-(--color-ink-soft)">How it works</Eyebrow>
          <h2 className="mt-1 text-xl font-semibold">Three things, once.</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            <Point
              glyph="1"
              tone="bg-(--color-grape) text-white"
              title="Add your child"
            >
              A name, an avatar and the school year they are in. A minute, and you only do it once.
            </Point>
            <Point glyph="2" tone="bg-(--color-grape) text-white" title="Give them the code">
              Four characters they type at the top of this page. No email, no password, nothing for
              them to remember or lose.
            </Point>
            <Point glyph="3" tone="bg-(--color-grape) text-white" title="Let them get on with it">
              They practise whenever the iPad is out. You check the report whenever you want to
              know.
            </Point>
          </ol>
        </Panel>

        {/* The curriculum is the one claim on this page a parent can check, so it
            is shown rather than asserted - every year, with its real topics,
            read straight out of the questions that ship. */}
        <Panel className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <Eyebrow tone="text-(--color-leaf)">What it covers</Eyebrow>
              <h2 className="mt-1 text-xl font-semibold">Every year of primary maths.</h2>
            </div>
            {maths.templateCount > 0 ? (
              <p className="text-sm text-(--color-ink-soft)">
                {formatCount(maths.templateCount)} questions · {formatCount(maths.topicCount)}{' '}
                topics
              </p>
            ) : null}
          </div>
          <p className="mt-1 max-w-prose text-sm text-(--color-ink-soft)">
            Listed straight from the questions themselves, so this page cannot say more than your
            child is actually asked.
          </p>
          <ul className="mt-4 divide-y divide-(--color-line)">
            {maths.levels.map((level) => (
              <li key={level.level} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
                <span className="w-20 shrink-0 rounded-lg bg-(--color-grape-soft) px-2 py-0.5 text-center text-xs font-bold text-(--color-grape)">
                  {shortYearLabel(level.level)}
                </span>
                <span className="min-w-0 flex-1 text-sm text-(--color-ink-soft)">
                  {level.topics.join(', ')}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/curriculum"
            className="mt-4 flex items-center gap-3 rounded-xl border border-(--color-line) p-3 transition hover:border-(--color-grape)"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Where the questions come from</span>
              <span className="mt-0.5 block text-sm text-(--color-ink-soft)">
                The Australian Curriculum, year by year - and the part of it behind each question.
              </span>
            </span>
            <span aria-hidden className="ml-auto text-lg text-(--color-grape)">
              &rarr;
            </span>
          </Link>
        </Panel>

        <section className="mt-6 flex flex-col items-center gap-4 rounded-3xl bg-(--color-grape-soft) px-6 py-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Ready when they are.</h2>
          <p className="max-w-prose text-base text-(--color-ink-soft)">
            Sign in, add your child, and hand them the code. They can be answering their first
            question in about two minutes.
          </p>
          <SignInButton size="hero" />
          <p className="text-sm text-(--color-ink-soft)">
            {first && last ? (
              <>
                {yearLabel(first.level)} to {yearLabel(last.level)}. Maths today, more to come.
              </>
            ) : null}
          </p>
        </section>
      </main>
    </>
  );
}
