import type { QuestionTemplate } from '../lib/templates/types';
import { compareYearLevels, type Stage, type YearLevel } from '../lib/curriculum';
import { mathsTemplates } from './maths';
import { englishTemplates } from './english';

/**
 * The in-repo course catalog. Once courses are authored by AI and stored in the
 * database this becomes the fallback/seed source, and the lookups below move to
 * queries - the shape of the API stays the same.
 *
 * Levels and topics are many-to-many: a year offers several topics, and a topic
 * recurs across years at increasing difficulty. Neither owns the other, so the
 * catalog can be walked from either end - `topicsForLevel` and `levelsForTopic`.
 *
 * Every shipped template, maths K-6 then English K-6 - the order `allTemplates`
 * has always had.
 *
 * This read the generated packs in `./packs` while the API served them to a
 * client that could not import TypeScript. There is no such client, so a pack
 * is a second copy of the content whose only remaining job was to be kept in
 * step with the first - and `scripts/content-packs.test.ts` existed to redden
 * when it was not. One copy cannot drift.
 */
export const allTemplates: QuestionTemplate[] = [...mathsTemplates, ...englishTemplates];

export interface LevelSummary {
  level: YearLevel;
  topics: string[];
  templateCount: number;
}

export interface SubjectSummary {
  subject: string;
  levels: LevelSummary[];
}

const unique = <T>(items: T[]): T[] => [...new Set(items)];

export function listSubjects(templates: QuestionTemplate[] = allTemplates): SubjectSummary[] {
  return unique(templates.map((t) => t.subject))
    .sort()
    .map((subject) => {
      const forSubject = templates.filter((t) => t.subject === subject);
      const levels = unique(forSubject.map((t) => t.level))
        .sort(compareYearLevels)
        .map((level) => {
          const forLevel = forSubject.filter((t) => t.level === level);
          return {
            level,
            topics: unique(forLevel.map((t) => t.topic)).sort(),
            templateCount: forLevel.length,
          };
        });
      return { subject, levels };
    });
}

/** Every year with content, across all subjects - the home screen's level list. */
export function listLevels(templates: QuestionTemplate[] = allTemplates): YearLevel[] {
  return unique(templates.map((t) => t.level)).sort(compareYearLevels);
}

export function templatesFor(
  subject: string,
  level: YearLevel,
  templates: QuestionTemplate[] = allTemplates,
): QuestionTemplate[] {
  return templates.filter((t) => t.subject === subject && t.level === level);
}

/** The topics a year covers. */
export function topicsForLevel(
  subject: string,
  level: YearLevel,
  templates: QuestionTemplate[] = allTemplates,
): string[] {
  return unique(templatesFor(subject, level, templates).map((t) => t.topic)).sort();
}

/** The years a topic appears in - the same topic recurs, harder each time. */
export function levelsForTopic(
  subject: string,
  topic: string,
  templates: QuestionTemplate[] = allTemplates,
): YearLevel[] {
  return unique(
    templates.filter((t) => t.subject === subject && t.topic === topic).map((t) => t.level),
  ).sort(compareYearLevels);
}

export type SyllabusId = 'acara' | 'nsw';

export interface Syllabus {
  id: SyllabusId;
  /** The subject whose content this document covers. */
  subject: string;
  name: string;
  shortName: string;
  url: string;
  pattern: RegExp;
}

/**
 * The syllabuses a template may cite. Two families (ACARA and NSW) with two
 * subjects each (maths and English) because NSW schools teach the NSW syllabus
 * and not ACARA directly, and a NSW parent should be able to find their child's
 * stage on the curriculum page.
 *
 * A code is a *reference*, which matters legally as well as structurally: ACARA
 * material is CC BY 4.0 and quotable, NESA material is Crown copyright and is
 * not. Nothing in this repo stores an outcome statement.
 *
 * `MAO` is Working mathematically, which belongs to every stage at once - it
 * matches as an NSW code and has no stage of its own.
 */
export const SYLLABUSES: readonly Syllabus[] = [
  {
    id: 'acara',
    subject: 'maths',
    name: 'Australian Curriculum Version 9.0 — Mathematics (Foundation to Year 10)',
    shortName: 'ACARA v9.0',
    url: 'https://www.australiancurriculum.edu.au',
    pattern: /^AC9M(F|\d{1,2})[A-Z]+\d{2}$/,
  },
  {
    id: 'acara',
    subject: 'english',
    name: 'Australian Curriculum Version 9.0 — English (Foundation to Year 10)',
    shortName: 'ACARA v9.0',
    url: 'https://www.australiancurriculum.edu.au',
    // English has exactly three strands, so they are named rather than matched
    // as `[A-Z]+`: a mistyped strand fails here instead of reaching the
    // membership list looking like a real code.
    pattern: /^AC9E(F|\d{1,2})(LA|LE|LY)\d{2}$/,
  },
  {
    id: 'nsw',
    subject: 'maths',
    name: 'NSW Mathematics K–10 Syllabus (2022)',
    shortName: 'NSW K–10 (2022)',
    url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-k-10-2022',
    pattern: /^MA(E|O|[1-3])-[A-Z0-9]+-\d{2}$/,
  },
  {
    id: 'nsw',
    subject: 'english',
    name: 'NSW English K–10 Syllabus (2022)',
    shortName: 'NSW K–10 (2022)',
    url: 'https://curriculum.nsw.edu.au/learning-areas/english/english-k-10-2022',
    pattern: /^EN(E|[1-3])-[A-Z]+-\d{2}$/,
  },
];

export function syllabusOf(code: string): SyllabusId | null {
  return SYLLABUSES.find((s) => s.pattern.test(code))?.id ?? null;
}

/**
 * The subject whose syllabus a code comes from, or `null` for a tag that is not
 * a curriculum code.
 *
 * A second narrow lookup rather than widening `syllabusOf`'s return, because the
 * two questions have different callers: `/curriculum` needs the subject to name
 * the right document and link the right URL, and `catalog.test.ts` needs it to
 * refuse a maths code on an English template - while everything that already
 * asks which *family* published a code is unchanged.
 */
export function syllabusSubjectOf(code: string): string | null {
  return SYLLABUSES.find((s) => s.pattern.test(code))?.subject ?? null;
}

const STAGE_BY_PREFIX: Record<string, Stage> = {
  MAE: 'ES1',
  MA1: 'S1',
  MA2: 'S2',
  MA3: 'S3',
  ENE: 'ES1',
  EN1: 'S1',
  EN2: 'S2',
  EN3: 'S3',
};

/** The stage an NSW outcome code belongs to, or `null` if it names no one stage. */
export function nswStageOfCode(code: string): Stage | null {
  if (syllabusOf(code) !== 'nsw') return null;
  return STAGE_BY_PREFIX[code.slice(0, 3)] ?? null;
}

export interface CodeUse {
  code: string;
  syllabus: SyllabusId;
  topics: string[];
  templateCount: number;
}

export interface LevelCodes {
  level: YearLevel;
  codes: CodeUse[];
}

/**
 * The curriculum codes a subject's content cites, grouped by year. Derived from
 * the templates rather than declared, for the same reason the topic lookups are:
 * a hand-kept list would go stale against the content it claims to describe.
 */
export function curriculumCodes(
  subject: string,
  templates: QuestionTemplate[] = allTemplates,
): LevelCodes[] {
  const forSubject = templates.filter((t) => t.subject === subject);

  return unique(forSubject.map((t) => t.level))
    .sort(compareYearLevels)
    .map((level) => {
      const forLevel = forSubject.filter((t) => t.level === level);
      const codes = unique(forLevel.flatMap((t) => (t.tags ?? []).filter((tag) => syllabusOf(tag))))
        .sort()
        .map((code) => {
          const citing = forLevel.filter((t) => t.tags?.includes(code));
          return {
            code,
            syllabus: syllabusOf(code) as SyllabusId,
            topics: unique(citing.map((t) => t.topic)).sort(),
            templateCount: citing.length,
          };
        });
      return { level, codes };
    });
}

export interface Divergence {
  level: YearLevel;
  topic: string;
  /**
   * The syllabus these templates do cite. The other one has no code here, which
   * is what `/curriculum` draws as an em dash where a code would have sat.
   */
  cites: SyllabusId;
  templateCount: number;
  /** Why the other syllabus has no code here, or null if nothing is recorded. */
  reason: string | null;
}

export interface DivergenceNote {
  /** The syllabus the templates cite; the note explains the other one's absence. */
  cites: SyllabusId;
  level: YearLevel;
  topic: string;
  reason: string;
}

/**
 * Why one syllabus has no code for a year's topic.
 *
 * **The list of divergences is derived and only the sentence is written**, which
 * is the same split `/curriculum` makes everywhere else: the em dash is the
 * absence of a tag, and this is the note beside it. A hand-copied list of ids
 * would be a second source of truth going stale the first time a citation
 * changes, and `catalog.test.ts`'s two set-equality tests already guarantee the
 * derived set is the complete one.
 *
 * **They live here rather than in the page because the note is keyed into the
 * derivation.** `syllabusDivergences` returns `reason` as part of the record, so
 * the key that finds a note - year, topic, and which syllabus is cited - and the
 * code that produces that key are one thing. Split them and the page has to
 * re-implement the join, and the test that no note has outlived its divergence
 * has to import the derivation anyway: the coupling without the locality. It is
 * why `nextSkill` is the only place the skill arithmetic is written down.
 *
 * And the branch-level reason, which is the one that settles it: this whole
 * cross-reference replaced *trusted* citations with *enforced* ones. A note in
 * `page.tsx` cannot carry a test, so moving them there would turn "every
 * divergence a reader can see is one the page accounts for" back into something
 * we merely intend. Here `catalog.test.ts` asserts both halves of it.
 *
 * Matched on year and topic rather than on template id: the five ACARA-only and
 * three NSW-only groups each *are* a year's topic, one decision covers the
 * templates in it, and an id is the thing most likely to be renamed under a
 * sentence that would still be true.
 *
 * **NSW outcome codes and focus-area names, never an outcome statement.** NESA's
 * material is Crown copyright; these say where NSW *places* content and why our
 * citation is the honest one, which is the wording
 * `docs/superpowers/notes/nsw-outcome-codes.md` allows and Task 22 settled.
 * ACARA's descriptions are CC BY 4.0 and may be paraphrased or quoted.
 *
 * Every sentence traces to a recorded decision, all of them in the plan's
 * `progress.md` or in the commit that made the citation: commit 9686fc6 (Year 1
 * patterns, Year 1 fractions), the Task 15 and Task 16 rulings (the Year K and
 * Year 1 clock faces), the Task 17 ruling (Year 2 grid references), the Task 19
 * ruling and the comment at `maths/4.ts` (Year 4 pictographs), the Task 20
 * review and the comment at `maths/5.ts` (Year 5 symmetry), and the Year 6
 * integers exception named in `catalog.test.ts`.
 */
export const DIVERGENCE_NOTES: readonly DivergenceNote[] = [
  {
    cites: 'acara',
    level: '1',
    topic: 'number patterns',
    reason:
      'A repeating unit is content NSW places at Early Stage 1 (MAE-FG-01), and no Stage 1 focus ' +
      'area picks it up again - so this Year 1 question has no NSW outcome to cite.',
  },
  {
    cites: 'acara',
    level: '2',
    topic: 'position',
    reason:
      'NSW places grid maps and grid references at Stage 2, which is Years 3 and 4. A Year 2 ' +
      'template sits in Stage 1, so citing an NSW outcome here would mean stretching one to ' +
      'cover something the syllabus teaches later.',
  },
  {
    cites: 'acara',
    level: '4',
    topic: 'data',
    reason:
      'NSW places many-to-one scales - one picture standing for several things - at Stage 3, ' +
      'which is Years 5 and 6. These ask a Year 4 child to read a key of two, five or ten, so ' +
      'they cite ACARA alone.',
  },
  {
    cites: 'acara',
    level: '5',
    topic: 'symmetry',
    reason:
      'NSW files turning a shape onto itself under Stage 2 (MA2-2DS-02), which is what the Year ' +
      '4 questions on this page cite, and Stage 3 has no successor to it that reaches pentagons ' +
      'through octagons. A citation offered as checkable is worse wrong than missing, so both ' +
      'keep ACARA alone.',
  },
  {
    cites: 'acara',
    level: '6',
    topic: 'integers',
    reason:
      'NSW places integers at Stage 4 - Years 7 and 8 - where ACARA introduces them at Year ' +
      '6, so these carry an ACARA description and no NSW outcome.',
  },
  {
    cites: 'nsw',
    level: '5',
    topic: 'data',
    reason:
      'NSW files timelines under Stage 3 Data. ACARA’s Year 5 and 6 Statistics descriptions are ' +
      'about data a child gathers and represents, and a timeline shows events rather than ' +
      'collected data - so the three timeline questions cite NSW alone rather than stretch one ' +
      'of them to reach it.',
  },
  {
    cites: 'nsw',
    level: 'K',
    topic: 'time',
    reason:
      'NSW places reading o’clock on a clock face at Early Stage 1. ACARA’s clock-face ' +
      'description, AC9M2M04, is at Year 2, and Foundation’s one time description (AC9MFM02) is ' +
      'about sequencing days and parts of the day rather than reading a dial - so there is no ' +
      'ACARA description to cite instead.',
  },
  {
    cites: 'nsw',
    level: '1',
    topic: 'time',
    reason:
      'NSW places half past at Stage 1. ACARA’s clock-face description is again AC9M2M04 at Year ' +
      '2, and Year 1’s AC9M1M03 is about durations in weeks, days and hours - which is why the ' +
      'Year 1 questions that count a duration do cite ACARA, and only the two that read a dial ' +
      'appear here.',
  },
  {
    cites: 'nsw',
    level: '1',
    topic: 'fractions',
    reason:
      'NSW places halves and quarters of a shape at Stage 1 (MA1-GM-03). ACARA’s first fraction ' +
      'description, AC9M2N03, is at Year 2, and Year 1 has none to cite.',
  },
  {
    cites: 'nsw',
    level: 'K',
    topic: 'fractions',
    reason:
      'The same disagreement as Year 1’s, one year earlier and wider: NSW puts halves of a ' +
      'shape at Early Stage 1 (MAE-GM-03), where ACARA’s first fraction description is ' +
      'AC9M2N03 at Year 2 — so Kindergarten is two years short of one rather than one.',
  },
];

/**
 * Where a year's content cites one syllabus and not the other, grouped by the
 * year's topic. Derived from the tags, exactly as `curriculumCodes` is: a
 * template citing ACARA with no NSW outcome beside it *is* the divergence, and
 * nothing here is declared except the sentence explaining it.
 *
 * It exists because the disagreement is the most useful thing this content knows
 * about the two syllabuses, and it is invisible in a list of codes - an absent
 * code looks exactly like a code nobody thought to add.
 */
export function syllabusDivergences(
  subject: string,
  templates: QuestionTemplate[] = allTemplates,
): Divergence[] {
  const forSubject = templates.filter((t) => t.subject === subject);
  // Filter SYLLABUSES to only those matching this subject, since SYLLABUSES
  // now carries entries for both maths and English - a maths divergence must
  // only look at maths syllabuses.
  const relevantSyllabuses = SYLLABUSES.filter((s) => s.subject === subject);

  return unique(forSubject.map((t) => t.level))
    .sort(compareYearLevels)
    .flatMap((level) => {
      const forLevel = forSubject.filter((t) => t.level === level);

      return unique(forLevel.map((t) => t.topic))
        .sort()
        .flatMap((topic) =>
          relevantSyllabuses.map(({ id }) => {
            const citing = forLevel.filter(
              (t) =>
                t.topic === topic &&
                (t.tags ?? []).some((tag) => syllabusOf(tag) === id) &&
                !(t.tags ?? []).some((tag) => {
                  const source = syllabusOf(tag);
                  return source !== null && source !== id;
                }),
            );
            return {
              level,
              topic,
              cites: id,
              templateCount: citing.length,
              reason:
                DIVERGENCE_NOTES.find(
                  (n) => n.cites === id && n.level === level && n.topic === topic,
                )?.reason ?? null,
            };
          }).filter((d) => d.templateCount > 0),
        );
    });
}

export interface SubjectOverview {
  subject: string;
  levels: LevelSummary[];
  /** How many templates ship for the subject, across every year. */
  templateCount: number;
  /** Distinct topics - a topic recurring across years is one topic, not several. */
  topicCount: number;
}

/**
 * What a subject covers, in the one shape the landing page needs: the years, the
 * topics in each, and the two totals worth quoting to someone who has not signed
 * in yet.
 *
 * It exists so that page can be *derived* rather than written beside the content.
 * A stranger reading "counting, shapes, addition…" has no way to check it against
 * what a child is actually asked, which is exactly why it must not be a list
 * maintained by hand - the same reason `/curriculum` reads `curriculumCodes`.
 */
export function subjectOverview(
  subject: string,
  templates: QuestionTemplate[] = allTemplates,
): SubjectOverview {
  const levels = listSubjects(templates).find((s) => s.subject === subject)?.levels ?? [];
  return {
    subject,
    levels,
    templateCount: levels.reduce((sum, level) => sum + level.templateCount, 0),
    topicCount: listTopics(subject, templates).length,
  };
}

/** Every topic in a subject, across all years. */
export function listTopics(
  subject: string,
  templates: QuestionTemplate[] = allTemplates,
): string[] {
  return unique(templates.filter((t) => t.subject === subject).map((t) => t.topic)).sort();
}
