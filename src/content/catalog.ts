import type { QuestionTemplate } from '@/lib/templates/types';
import { compareYearLevels, type YearLevel } from '@/lib/curriculum';
import { mathsTemplates } from './maths';

/**
 * The in-repo course catalog. Once courses are authored by AI and stored in the
 * database this becomes the fallback/seed source, and the lookups below move to
 * queries — the shape of the API stays the same.
 *
 * Levels and topics are many-to-many: a year offers several topics, and a topic
 * recurs across years at increasing difficulty. Neither owns the other, so the
 * catalog can be walked from either end — `topicsForLevel` and `levelsForTopic`.
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

/** Every year with content, across all subjects — the home screen's level list. */
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

/** The years a topic appears in — the same topic recurs, harder each time. */
export function levelsForTopic(
  subject: string,
  topic: string,
  templates: QuestionTemplate[] = allTemplates,
): YearLevel[] {
  return unique(
    templates.filter((t) => t.subject === subject && t.topic === topic).map((t) => t.level),
  ).sort(compareYearLevels);
}

/**
 * An Australian Curriculum content description code, as cited in a template's
 * `tags` — `AC9M` + year (`F` for Foundation) + strand + number, e.g. `AC9M4N02`.
 */
const CURRICULUM_CODE = /^AC9M(F|\d{1,2})[A-Z]+\d{2}$/;

export interface CodeUse {
  code: string;
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
      const codes = unique(
        forLevel.flatMap((t) => (t.tags ?? []).filter((tag) => CURRICULUM_CODE.test(tag))),
      )
        .sort()
        .map((code) => {
          const citing = forLevel.filter((t) => t.tags?.includes(code));
          return {
            code,
            topics: unique(citing.map((t) => t.topic)).sort(),
            templateCount: citing.length,
          };
        });
      return { level, codes };
    });
}

/** Every topic in a subject, across all years. */
export function listTopics(
  subject: string,
  templates: QuestionTemplate[] = allTemplates,
): string[] {
  return unique(templates.filter((t) => t.subject === subject).map((t) => t.topic)).sort();
}
