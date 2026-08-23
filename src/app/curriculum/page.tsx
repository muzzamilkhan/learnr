import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoMark } from '@/components/logo';
import {
  curriculumCodes,
  listSubjects,
  syllabusDivergences,
  SYLLABUSES,
  type Syllabus,
  type SyllabusId,
} from '@/content/catalog';
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
    'The syllabuses LearnR’s questions are written against, where they disagree, and the attribution each carries.',
};

const SUBJECT_LABELS: Record<string, string> = {
  maths: 'Maths',
  english: 'English',
};

const subjectLabel = (subject: string) => SUBJECT_LABELS[subject] ?? subject;

// The ACARA prefix a subject's codes carry, so `strandOf` can tell where a
// code's strand letters start without a subject-specific regex per caller.
const ACARA_PREFIXES: Record<string, string> = {
  maths: 'AC9M',
  english: 'AC9E',
};

// The strand each ACARA code's letters name, so a code reads without a decoder
// ring. Maths' six and English's three share one table because the keys never
// collide - a strand name is what a code *is*, not what it says.
const STRANDS: Record<string, string> = {
  N: 'Number',
  A: 'Algebra',
  M: 'Measurement',
  SP: 'Space',
  ST: 'Statistics',
  P: 'Probability',
  LA: 'Language',
  LE: 'Literature',
  LY: 'Literacy',
};

const strandOf = (code: string, subject: string) => {
  const prefix = ACARA_PREFIXES[subject];
  if (!prefix || !code.startsWith(prefix)) return undefined;
  const key = code
    .slice(prefix.length)
    .replace(/^(F|\d{1,2})/, '')
    .replace(/\d+$/, '');
  return STRANDS[key];
};

/**
 * The focus area each NSW code's middle segment names - the same job `STRANDS`
 * does for ACARA, and the reason a reader can tell MA2-AR-01 from MA2-MR-01 (or
 * EN2-VOCAB-01 from EN2-SPELL-01) without leaving the page. Maths' and
 * English's focus areas share this table for the same reason `STRANDS` does:
 * the abbreviations never collide.
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
  OLC: 'Oral language and communication',
  VOCAB: 'Vocabulary',
  PHOAW: 'Phonological awareness',
  PRINT: 'Print conventions',
  PHOKW: 'Phonic and word knowledge',
  REFLU: 'Reading fluency',
  RECOM: 'Reading comprehension',
  CWT: 'Creating written texts',
  SPELL: 'Spelling',
  HANDW: 'Handwriting and digital transcription',
  UARL: 'Understanding and responding to literature',
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
const labelFor = (code: string, syllabus: SyllabusId, subject: string) =>
  syllabus === 'acara' ? strandOf(code, subject) : focusAreaOf(code);

const questionTypes = (count: number) =>
  `${count} ${count === 1 ? 'question type' : 'question types'}`;

/**
 * One worked example per subject's ACARA document - a code, what it names, and
 * (only where the quoted text has been checked against ACARA's own document)
 * the content description itself. ACARA's material is CC BY 4.0, so quoting is
 * permitted; it is not mandatory, and a subject with no checked quote here
 * simply shows the code's shape instead.
 */
interface AcaraExample {
  code: string;
  label: string;
  quote?: string;
}

/**
 * The specific downloaded document a subject's content was written from, where
 * one exists - `syllabus.url` alone only ever reaches the Australian
 * Curriculum website's front door, and a parent checking a citation deserves
 * the actual document rather than a search away from it. English has no entry
 * here yet because its content was written against the website's browsable
 * scope and sequence rather than a single downloaded file.
 */
interface AcaraSourceDoc {
  url: string;
  label: string;
}

const ACARA_SOURCE_DOCS: Partial<Record<string, AcaraSourceDoc>> = {
  maths: {
    url: 'https://www.australiancurriculum.edu.au/content/dam/en/curriculum/ac-version-9/downloads/mathematics/mathematics-scope-and-sequence-f-10-v9.docx',
    label: 'Mathematics: Scope and sequence F–10 (v9.0)',
  },
};

const ACARA_EXAMPLES: Record<string, AcaraExample> = {
  maths: {
    code: 'AC9M4N02',
    label: 'Year 4 Number',
    quote: 'explain and use the properties of odd and even numbers',
  },
  english: {
    code: 'AC9E4LA11',
    label: 'Year 4 Language',
    quote:
      'expand vocabulary by exploring a range of synonyms and antonyms, and using words ' +
      'encountered in a range of sources',
  },
};

/** The equivalent worked example for each subject's NSW document. */
interface NswExample {
  prefix: string;
  code: string;
  label: string;
  earlyStagePrefix: string;
}

const NSW_EXAMPLES: Record<string, NswExample> = {
  maths: {
    prefix: 'MA',
    code: 'MA2-AR-01',
    label: 'Stage 2, Additive relations',
    earlyStagePrefix: 'MAE',
  },
  english: {
    prefix: 'EN',
    code: 'EN2-VOCAB-01',
    label: 'Stage 2, Vocabulary',
    earlyStagePrefix: 'ENE',
  },
};

const findSyllabus = (subject: string, id: SyllabusId): Syllabus =>
  SYLLABUSES.find((s) => s.subject === subject && s.id === id)!;

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

function AcaraPanel({ subject }: { subject: string }) {
  const syllabus = findSyllabus(subject, 'acara');
  const example = ACARA_EXAMPLES[subject];
  const sourceDoc = ACARA_SOURCE_DOCS[subject];

  return (
    <>
      <h3 className="mt-8 text-xl font-semibold">Australian Curriculum (ACARA)</h3>
      <p>
        <strong>{syllabus.name}</strong>, published by the Australian Curriculum, Assessment and
        Reporting Authority (ACARA) and available at{' '}
        <a href={syllabus.url} className="text-(--color-brand) underline">
          Australian Curriculum website
        </a>
        .
      </p>
      {sourceDoc ? (
        <p>
          The specific document the Kindergarten to Year 6 content was written from is ACARA’s{' '}
          <a href={sourceDoc.url} className="text-(--color-brand) underline">
            {sourceDoc.label}
          </a>
          , downloaded from the{' '}
          <a href={syllabus.url} className="text-(--color-brand) underline">
            Australian Curriculum website
          </a>
          .
        </p>
      ) : null}
      {example ? (
        <p>
          Its codes read as <code>{ACARA_PREFIXES[subject]}</code> + year + strand + number - for
          example <code>{example.code}</code>, {example.label}
          {example.quote ? (
            <>
              : <em>“{example.quote}”</em>
            </>
          ) : null}
          . Foundation is <code>F</code>, which this app calls Kindergarten.
        </p>
      ) : null}
    </>
  );
}

function NswPanel({ subject }: { subject: string }) {
  const syllabus = findSyllabus(subject, 'nsw');
  const example = NSW_EXAMPLES[subject];

  return (
    <>
      <h3 className="mt-8 text-xl font-semibold">{syllabus.name}</h3>
      <p>
        Published by the NSW Education Standards Authority (NESA) and available at{' '}
        <a href={syllabus.url} className="text-(--color-brand) underline">
          curriculum.nsw.edu.au
        </a>
        . It is here because a NSW school teaches this and not ACARA directly, so a NSW parent
        checking what their child is being asked needs the outcome their teacher would name.
      </p>
      {example ? (
        <p>
          Its codes read as <code>{example.prefix}</code> + stage + focus area + number - for
          example <code>{example.code}</code>, {example.label}. Early Stage 1 is{' '}
          <code>{example.earlyStagePrefix}</code>. This page carries NSW codes and focus-area
          names and nothing more; the outcomes themselves live on NESA’s site, for the reason the
          attribution below gives.
        </p>
      ) : null}
    </>
  );
}

export default function CurriculumPage() {
  // Alphabetical, and not reordered here: this is the same order
  // `listSubjects()` gives the home screen's subject cards, so the two
  // screens agree on which subject comes first rather than each keeping its
  // own idea of it.
  const subjects = listSubjects();

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
          LearnR’s questions are cross-referenced to <strong>two</strong> syllabuses per subject:
          the national curriculum, and the one NSW schools actually teach. Every question records
          the content description or outcome it practises in each, so any question can be traced
          back to the curriculum - and where the two syllabuses place the same content in
          different years, this page says so rather than quietly picking one.
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
          exact in one direction only: every year has one stage, and every stage has two years.
          That is why the same Stage 2 outcome can appear against both Year 3 and Year 4 below -
          the syllabus working as written, rather than a code in the wrong place.
        </p>
      </section>

      {subjects.map(({ subject }) => {
        const byLevel = curriculumCodes(subject);
        const divergences = syllabusDivergences(subject);
        const syllabusesForSubject = SYLLABUSES.filter((s) => s.subject === subject);

        return (
          <section key={subject} className="mt-14">
            <h2 className="text-3xl font-bold tracking-tight">{subjectLabel(subject)}</h2>

            <div className="mt-4 space-y-4 text-lg leading-relaxed">
              <AcaraPanel subject={subject} />
              <NswPanel subject={subject} />
            </div>

            <h3 className="mt-10 mb-4 text-2xl font-semibold">What is covered</h3>
            <p className="mb-6 text-lg text-(--color-ink-soft)">
              Listed straight from the shipped questions, so this page cannot drift from what a
              child is actually asked - and that includes the gaps. Where one syllabus places
              content in this year and the other places it elsewhere, the missing code is drawn as
              a dash, with the reason beside it.
            </p>

            <div className="space-y-6">
              {byLevel.map(({ level, codes }) => (
                <section
                  key={level}
                  className="rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-6"
                >
                  <h4 className="text-2xl font-semibold">
                    {yearLabel(level)}{' '}
                    <span className="font-normal text-(--color-ink-soft)">
                      · {stageLabel(stageForLevel(level))}
                    </span>
                  </h4>

                  {syllabusesForSubject.map((syllabus) => {
                    const cited = codes.filter((c) => c.syllabus === syllabus.id);
                    // A divergence citing the *other* syllabus is this one's gap: the
                    // content is here, and this source has no code for it.
                    const gaps = divergences.filter(
                      (d) => d.level === level && d.cites !== syllabus.id,
                    );
                    if (cited.length === 0 && gaps.length === 0) return null;

                    return (
                      <div key={syllabus.id} className="mt-5">
                        <h5 className="text-sm font-semibold tracking-wide text-(--color-ink-soft) uppercase">
                          {syllabus.shortName}
                        </h5>
                        <ul className="mt-2 space-y-2">
                          {cited.map(({ code, topics, templateCount }) => {
                            const label = labelFor(code, syllabus.id, subject);
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
                                  {SYLLABUSES.find((s) => s.subject === subject && s.id === cites)
                                    ?.shortName}{' '}
                                  alone
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
          </section>
        );
      })}

      <h2 className="mt-14 mb-4 text-2xl font-semibold">What a code here does not claim</h2>
      <div className="space-y-4 text-lg leading-relaxed">
        <p>
          A code says a question practises that content description or outcome. It does not say
          LearnR covers all of it: the questions are written against the focus areas, and a
          question here is one prompt with one answer.
        </p>
        <p>
          NSW attaches <code>MAO-WM-01</code> - Working mathematically - to every maths outcome at
          every stage. A generated single-answer question can evidence understanding and fluency;
          it cannot evidence communicating, reasoning or problem solving, which a child does out
          loud, on paper and with somebody else. So no template cites it, and nothing on this page
          should be read as covering it.
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
        The material was modified in the sense that LearnR writes its own practice questions
        against the content descriptions; it does not reproduce ACARA’s material verbatim.
      </p>

      <blockquote className="mt-8 border-l-4 border-(--color-line) pl-5 text-lg leading-relaxed text-(--color-ink-soft)">
        © NSW Education Standards Authority (NESA) for and on behalf of the Crown in right of the
        State of New South Wales. The{' '}
        <a href={findSyllabus('maths', 'nsw').url} className="text-(--color-brand) underline">
          <em>NSW Mathematics K–10 Syllabus (2022)</em>
        </a>{' '}
        and the{' '}
        <a href={findSyllabus('english', 'nsw').url} className="text-(--color-brand) underline">
          <em>NSW English K–10 Syllabus (2022)</em>
        </a>{' '}
        are published at curriculum.nsw.edu.au. LearnR cites outcome codes from them and writes
        its own questions; it reproduces no NSW syllabus material.
      </blockquote>
      <p className="mt-4 text-lg leading-relaxed">
        <strong>The two blocks differ because the licences do.</strong> ACARA’s material is
        licensed CC BY 4.0, which permits quoting a content description with attribution - which
        is why <code>AC9M4N02</code> is quoted in full above. NESA’s syllabuses are Crown
        copyright and carry no such licence, so every NSW reference on this page is a code and a
        focus-area name pointing at the syllabus, and never a line of it. Both are cited; only one
        may be quoted.
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
