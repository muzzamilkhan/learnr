import type { Metadata } from 'next';
import Link from 'next/link';
import { curriculumCodes } from '@/content/catalog';
import { yearLabel } from '@/lib/curriculum';

export const metadata: Metadata = {
  title: 'Curriculum sources · LearnR',
  description: 'The curriculum LearnR’s questions are written against, and the attribution it carries.',
};

// The strand each code's letters name, so a code reads without a decoder ring.
const STRANDS: Record<string, string> = {
  N: 'Number',
  A: 'Algebra',
  M: 'Measurement',
  SP: 'Space',
  ST: 'Statistics',
  P: 'Probability',
};

const strandOf = (code: string) => STRANDS[code.replace(/^AC9M(F|\d{1,2})/, '').replace(/\d+$/, '')];

const SOURCE_URL =
  'https://www.australiancurriculum.edu.au/content/dam/en/curriculum/ac-version-9/downloads/mathematics/mathematics-scope-and-sequence-f-10-v9.docx';

export default function CurriculumPage() {
  const byLevel = curriculumCodes('maths');

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <header className="mb-10">
        <Link href="/" className="text-lg font-medium text-(--color-brand)">
          ← Back
        </Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Curriculum sources</h1>
        <p className="mt-3 text-xl text-(--color-ink-soft)">
          Where LearnR’s questions come from, and how to check them.
        </p>
      </header>

      <section className="space-y-4 text-lg leading-relaxed">
        <p>
          The maths questions in LearnR are written against the{' '}
          <strong>Australian Curriculum Version 9.0 — Mathematics (Foundation to Year 10)</strong>,
          published by the Australian Curriculum, Assessment and Reporting Authority (ACARA).
        </p>
        <p>
          The specific document the Kindergarten to Year 6 content was written from is ACARA’s{' '}
          <a href={SOURCE_URL} className="text-(--color-brand) underline">
            Mathematics: Scope and sequence F–10 (v9.0)
          </a>
          , downloaded from the{' '}
          <a href="https://www.australiancurriculum.edu.au" className="text-(--color-brand) underline">
            Australian Curriculum website
          </a>
          .
        </p>
        <p>
          Every question template records the content description it practises, so any question can
          be traced back to the curriculum. The codes read as <code>AC9M</code> + year + strand +
          number — for example <code>AC9M4N02</code>, Year 4 Number: <em>“explain and use the
          properties of odd and even numbers”</em>. Foundation is <code>F</code>, which this app
          calls Kindergarten.
        </p>
      </section>

      <h2 className="mt-12 mb-4 text-2xl font-semibold">What is covered</h2>
      <p className="mb-6 text-lg text-(--color-ink-soft)">
        Listed straight from the shipped questions, so this page cannot drift from what a child is
        actually asked.
      </p>

      <div className="space-y-6">
        {byLevel.map(({ level, codes }) => (
          <section key={level} className="rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-6">
            <h3 className="text-2xl font-semibold">{yearLabel(level)}</h3>
            <ul className="mt-4 space-y-2">
              {codes.map(({ code, topics, templateCount }) => (
                <li key={code} className="flex flex-wrap items-baseline gap-x-3 text-lg">
                  <code className="font-semibold">{code}</code>
                  {strandOf(code) ? (
                    <span className="text-(--color-ink-soft)">{strandOf(code)}</span>
                  ) : null}
                  <span className="text-(--color-ink-soft)">
                    {topics.join(' · ')} — {templateCount}{' '}
                    {templateCount === 1 ? 'question type' : 'question types'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <h2 className="mt-12 mb-4 text-2xl font-semibold">Attribution</h2>
      <blockquote className="border-l-4 border-(--color-line) pl-5 text-lg leading-relaxed text-(--color-ink-soft)">
        © Australian Curriculum, Assessment and Reporting Authority (ACARA) 2010 to present, unless
        otherwise indicated. This material was downloaded from the{' '}
        <a href="http://www.australiancurriculum.edu.au" className="text-(--color-brand) underline">
          Australian Curriculum website
        </a>{' '}
        (accessed 17 August 2026) and was modified. The material is licensed under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" className="text-(--color-brand) underline">
          CC BY 4.0
        </a>
        .
      </blockquote>
      <p className="mt-4 text-lg leading-relaxed">
        The material was modified in the sense that LearnR writes its own practice questions against
        the content descriptions; it does not reproduce ACARA’s material verbatim.
      </p>

      <h2 className="mt-12 mb-4 text-2xl font-semibold">Disclaimer</h2>
      <blockquote className="border-l-4 border-(--color-line) pl-5 text-lg leading-relaxed text-(--color-ink-soft)">
        ACARA does not endorse any product that uses the Australian Curriculum or make any
        representations as to the quality of such products. Any product that uses material published
        on the Australian Curriculum website should not be taken to be affiliated with ACARA or have
        the sponsorship or approval of ACARA. It is up to each person to make their own assessment of
        the product, taking into account matters including the degree to which the materials align
        with the content descriptions and achievement standards.
      </blockquote>
    </main>
  );
}
