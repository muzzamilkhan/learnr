import type { QuestionTemplate } from '@/lib/templates/types';
import { mathsTemplates } from './maths';

/**
 * The in-repo course catalog. Once courses are authored by AI and stored in the
 * database this becomes the fallback/seed source, and the lookups below move to
 * queries — the shape of the API stays the same.
 */
export const allTemplates: QuestionTemplate[] = [...mathsTemplates];

export interface LevelSummary {
  level: number;
  categories: string[];
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
        .sort((a, b) => a - b)
        .map((level) => {
          const forLevel = forSubject.filter((t) => t.level === level);
          return {
            level,
            categories: unique(forLevel.map((t) => t.category)).sort(),
            templateCount: forLevel.length,
          };
        });
      return { subject, levels };
    });
}

export function templatesFor(
  subject: string,
  level: number,
  templates: QuestionTemplate[] = allTemplates,
): QuestionTemplate[] {
  return templates.filter((t) => t.subject === subject && t.level === level);
}
