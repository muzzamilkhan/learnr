import type { QuestionTemplate } from '@/lib/templates/types';
import { compareYearLevels, type Stage, type YearLevel } from '@/lib/curriculum';
import { mathsTemplates } from './maths';

/**
 * The in-repo course catalog. Once courses are authored by AI and stored in the
 * database this becomes the fallback/seed source, and the lookups below move to
 * queries - the shape of the API stays the same.
 *
 * Levels and topics are many-to-many: a year offers several topics, and a topic
 * recurs across years at increasing difficulty. Neither owns the other, so the
 * catalog can be walked from either end - `topicsForLevel` and `levelsForTopic`.
 */
export const allTemplates: QuestionTemplate[] = [...mathsTemplates];

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
  name: string;
  shortName: string;
  url: string;
  pattern: RegExp;
}

/**
 * The syllabuses a template may cite. Two rather than one because NSW schools
 * teach the NSW syllabus and not ACARA directly, and a NSW parent should be
 * able to find their child's stage on the curriculum page.
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
    name: 'Australian Curriculum Version 9.0 — Mathematics (Foundation to Year 10)',
    shortName: 'ACARA v9.0',
    url: 'https://www.australiancurriculum.edu.au',
    pattern: /^AC9M(F|\d{1,2})[A-Z]+\d{2}$/,
  },
  {
    id: 'nsw',
    name: 'NSW Mathematics K–10 Syllabus (2022)',
    shortName: 'NSW K–10 (2022)',
    url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-k-10-2022',
    pattern: /^MA(E|O|[1-3])-[A-Z0-9]+-\d{2}$/,
  },
];

export function syllabusOf(code: string): SyllabusId | null {
  return SYLLABUSES.find((s) => s.pattern.test(code))?.id ?? null;
}

const STAGE_BY_PREFIX: Record<string, Stage> = {
  MAE: 'ES1',
  MA1: 'S1',
  MA2: 'S2',
  MA3: 'S3',
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
