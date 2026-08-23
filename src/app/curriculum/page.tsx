import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoMark } from '@/components/logo';
import { curriculumCodes, syllabusDivergences, SYLLABUSES, type SyllabusId } from '@/content/catalog';
import {
  levelsForStage,
  stageForLevel,
  stageLabel,
  STAGES,
  yearLabel,
  type YearLevel,
} from '@/lib/curriculum';

export const metadata: Metadata = {
  title: 'Curriculum sources · LearnR',
  description:
    'The two syllabuses LearnR’s questions are written against, where the two disagree, and the attribution it carries.',
};

// The strand each ACARA code's letters name, so a code reads without a decoder
// ring.
const STRANDS: Record<string, string> = {
  N: 'Number',
  A: 'Algebra',
  M: 'Measurement',
  SP: 'Space',
  ST: 'Statistics',
  P: 'Probability',
};

const strandOf = (code: string) => STRANDS[code.replace(/^AC9M(F|\d{1,2})/, '').replace(/\d+$/, '')];

/**
 * The focus area each NSW code's middle segment names - the same job `STRANDS`
 * does for ACARA, and the reason a reader can tell MA2-AR-01 from MA2-MR-01
 * without leaving the page.
 *
 * **Names only.** A focus area's name is what a code *is*; what an outcome says
 * is NESA's Crown copyright and stays on NESA's site. Nothing here describes
 * what an outcome covers.
 */
const FOCUS_AREAS: Record<string, string> = {
  RWN: 'Representing whole numbers',
  CSQ: 'Combining and separating quantities',
  FG: 'Forming groups',
  GM: 'Geometric measure',
  '2DS': 'Two-dimensional spatial structure',
  '3DS': 'Three-dimensional spatial structure',
  NSM: 'Non-spatial measure',
  DATA: 'Data',
  CHAN: 'Chance',
  RN: 'Represents numbers',
  AR: 'Additive relations',
  MR: 'Multiplicative relations',
  PF: 'Partitioned fractions',
  RQF: 'Representing quantity fractions',
};

// Stage 2 and Stage 3 give the same segment different names, so the whole
// prefix wins where it is listed and the segment answers everywhere else.
const FOCUS_AREA_BY_PREFIX: Record<string, string> = {
  'MA2-RN': 'Representing numbers using place value',
};

const focusAreaOf = (code: string) => {
  const [stage, area] = code.split('-');
  return FOCUS_AREA_BY_PREFIX[`${stage}-${area}`] ?? FOCUS_AREAS[area];
};

/** What a code's letters name: ACARA's strand, or NSW's focus area. */
const labelFor = (code: string, syllabus: SyllabusId) =>
  syllabus === 'acara' ? strandOf(code) : focusAreaOf(code);

const questionTypes = (count: number) =>
  `${count} ${count === 1 ? 'question type' : 'question types'}`;

const ACARA_SOURCE_URL =
  'https://www.australiancurriculum.edu.au/content/dam/en/curriculum/ac-version-9/downloads/mathematics/mathematics-scope-and-sequence-f-10-v9.docx';

// The syllabus's own link, from the one table that holds it - a second copy
// here would be a second thing to update.
const NSW_SOURCE_URL = SYLLABUSES.find((s) => s.id === 'nsw')!.url;

/**
 * The years a stage spans, said the way a parent would say them: "Kindergarten",
 * or "Years 1 and 2". Which years those are is `levelsForStage`'s answer and not
 * this page's - the mapping is the thing this section exists to teach, so the
 * page that teaches it must not be a second copy of it. Only the wording is
 * here.
 */
const yearsInStage = (levels: YearLevel[]) => {
  const numbered = levels.filter((level) => level !== 'K');
  return [
    ...(levels.includes('K') ? [yearLabel('K')] : []),
    ...(numbered.length > 0
      ? [`Year${numbered.length > 1 ? 's' : ''} ${numbered.join(' and ')}`]
      : []),
  ].join(' and ');
};

export default function CurriculumPage() {
  const byLevel = curriculumCodes('maths');
  const divergences = syllabusDivergences('maths');

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <header className="mb-10">
        <Link href="/" className="text-lg font-medium text-(--color-brand)">
          ← Back
        </Link>
        <div className="mt-4 flex items-center gap-4">
          <LogoMark size="lg" />
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Curriculum sources</h1>
            <p className="mt-2 text-xl text-(--color-ink-soft)">
              Where LearnR’s questions come from, and how to check them.
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-4 text-lg leading-relaxed">
        <p>
          The maths questions in LearnR are cross-referenced to <strong>two</strong> syllabuses: the
          national curriculum, and the one NSW schools actually teach. Every question records the
          content description or outcome it practises in each, so any question can be traced back to
          the curriculum - and where the two syllabuses place the same content in different years,
          this page says so rather than quietly picking one.
        </p>

        <h2 className="mt-10 text-2xl font-semibold">Australian Curriculum (ACARA)</h2>
        <p>
          <strong>Australian Curriculum Version 9.0 - Mathematics (Foundation to Year 10)</strong>,
          published by the Australian Curriculum, Assessment and Reporting Authority (ACARA). The
          specific document the Kindergarten to Year 6 content was written from is ACARA’s{' '}
          <a href={ACARA_SOURCE_URL} className="text-(--color-brand) underline">
            Mathematics: Scope and sequence F-10 (v9.0)
          </a>
          , downloaded from the{' '}
          <a href="https://www.australiancurriculum.edu.au" className="text-(--color-brand) underline">
            Australian Curriculum website
          </a>
          .
        </p>
        <p>
          Its codes read as <code>AC9M</code> + year + strand + number - for example{' '}
          <code>AC9M4N02</code>, Year 4 Number: <em>“explain and use the properties of odd and even
          numbers”</em>. Foundation is <code>F</code>, which this app calls Kindergarten.
        </p>

        <h2 className="mt-10 text-2xl font-semibold">NSW Mathematics K–10 Syllabus (2022)</h2>
        <p>
          Published by the NSW Education Standards Authority (NESA) and available at{' '}
          <a href={NSW_SOURCE_URL} className="text-(--color-brand) underline">
            curriculum.nsw.edu.au
          </a>
          . It is here because a NSW school teaches this and not ACARA directly, so a NSW parent
          checking what their child is being asked needs the outcome their teacher would name.
        </p>
        <p>
          Its codes read as <code>MA</code> + stage + focus area + number - for example{' '}
          <code>MA2-AR-01</code>, Stage 2, Additive relations. Early Stage 1 is <code>MAE</code>.
          This page carries NSW codes and focus-area names and nothing more; the outcomes themselves
          live on NESA’s site, for the reason the attribution below gives.
        </p>
        <p>
          NSW organises its content by <strong>stage</strong> rather than by year:
        </p>
        <ul className="ml-1 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          {STAGES.map((stage) => (
            <li key={stage} className="col-span-2 grid grid-cols-subgrid">
              <span className="font-semibold">{stageLabel(stage)}</span>
              <span className="text-(--color-ink-soft)">{yearsInStage(levelsForStage(stage))}</span>
            </li>
          ))}
        </ul>
        <p>
          A stage spans two school years where a LearnR level is a single year, so the mapping is
          exact in one direction only: every year has one stage, and every stage has two years. That
          is why the same Stage 2 outcome appears against both Year 3 and Year 4 below - the
          syllabus working as written, rather than a code in the wrong place.
        </p>
      </section>

      <h2 className="mt-12 mb-4 text-2xl font-semibold">What is covered</h2>
      <p className="mb-6 text-lg text-(--color-ink-soft)">
        Listed straight from the shipped questions, so this page cannot drift from what a child is
        actually asked - and that includes the gaps. Where one syllabus places content in this year
        and the other places it elsewhere, the missing code is drawn as a dash, with the reason
        beside it.
      </p>

      <div className="space-y-6">
        {byLevel.map(({ level, codes }) => (
          <section
            key={level}
            className="rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-6"
          >
            <h3 className="text-2xl font-semibold">
              {yearLabel(level)}{' '}
              <span className="font-normal text-(--color-ink-soft)">
                · {stageLabel(stageForLevel(level))}
              </span>
            </h3>

            {SYLLABUSES.filter((s) => s.subject === 'maths').map((syllabus) => {
              const cited = codes.filter((c) => c.syllabus === syllabus.id);
              // A divergence citing the *other* syllabus is this one's gap: the
              // content is here, and this source has no code for it.
              const gaps = divergences.filter((d) => d.level === level && d.cites !== syllabus.id);
              if (cited.length === 0 && gaps.length === 0) return null;

              return (
                <div key={syllabus.id} className="mt-5">
                  <h4 className="text-sm font-semibold tracking-wide text-(--color-ink-soft) uppercase">
                    {syllabus.shortName}
                  </h4>
                  <ul className="mt-2 space-y-2">
                    {cited.map(({ code, topics, templateCount }) => {
                      const label = labelFor(code, syllabus.id);
                      return (
                        <li key={code} className="flex flex-wrap items-baseline gap-x-3 text-lg">
                          <code className="font-semibold">{code}</code>
                          {label ? <span className="text-(--color-ink-soft)">{label}</span> : null}
                          <span className="text-base text-(--color-ink-soft)">
                            {topics.join(' · ')} - {questionTypes(templateCount)}
                          </span>
                        </li>
                      );
                    })}

                    {gaps.map(({ topic, templateCount, cites, reason }) => (
                      <li key={topic} className="text-lg">
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <span aria-hidden className="font-semibold">
                            —
                          </span>
                          <span>{topic}</span>
                          <span className="text-base text-(--color-ink-soft)">
                            {questionTypes(templateCount)}, cited in{' '}
                            {SYLLABUSES.find((s) => s.id === cites)?.shortName} alone
                          </span>
                        </div>
                        <p className="mt-1 text-base leading-relaxed text-(--color-ink-soft)">
                          {reason ??
                            'This page has no note recording why. That is a gap in our citations rather than a claim about the syllabus.'}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <h2 className="mt-12 mb-4 text-2xl font-semibold">What a code here does not claim</h2>
      <div className="space-y-4 text-lg leading-relaxed">
        <p>
          A code says a question practises that content description or outcome. It does not say
          LearnR covers all of it: the questions are written against the focus areas, and a question
          here is one prompt with one answer.
        </p>
        <p>
          NSW attaches <code>MAO-WM-01</code> - Working mathematically - to every outcome at every
          stage. A generated single-answer question can evidence understanding and fluency; it
          cannot evidence communicating, reasoning or problem solving, which a child does out loud,
          on paper and with somebody else. So no template cites it, and nothing on this page should
          be read as covering it.
        </p>
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

      <blockquote className="mt-8 border-l-4 border-(--color-line) pl-5 text-lg leading-relaxed text-(--color-ink-soft)">
        © NSW Education Standards Authority (NESA) for and on behalf of the Crown in right of the
        State of New South Wales. The <em>NSW Mathematics K–10 Syllabus (2022)</em> is published at{' '}
        <a href={NSW_SOURCE_URL} className="text-(--color-brand) underline">
          curriculum.nsw.edu.au
        </a>
        . LearnR cites outcome codes from it and writes its own questions; it reproduces no NSW
        syllabus material.
      </blockquote>
      <p className="mt-4 text-lg leading-relaxed">
        <strong>The two blocks differ because the licences do.</strong> ACARA’s material is licensed
        CC BY 4.0, which permits quoting a content description with attribution - which is why{' '}
        <code>AC9M4N02</code> is quoted in full above. NESA’s syllabus is Crown copyright and
        carries no such licence, so every NSW reference on this page is a code and a focus-area name
        pointing at the syllabus, and never a line of it. Both are cited; only one may be quoted.
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
      <p className="mt-4 text-lg leading-relaxed">
        NESA does not endorse this app and has no involvement in it. LearnR is not affiliated with
        NESA, and nothing here is an official NSW syllabus document.
      </p>
    </main>
  );
}
