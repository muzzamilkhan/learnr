import { describe, it, expect } from 'vitest';
import { validateTemplates } from '@/lib/templates/validate';
import { generateQuestion } from '@/lib/templates/generate';
import { createRng } from '@/lib/rng';
import { isYearLevel } from '@/lib/curriculum';
import {
  allTemplates,
  listSubjects,
  listTopics,
  templatesFor,
  topicsForLevel,
  levelsForTopic,
} from './catalog';

describe('shipped content', () => {
  it('every template is valid', () => {
    const result = validateTemplates(allTemplates);
    expect(result.errors).toEqual([]);
  });

  it('every template generates sane questions across many seeds', () => {
    for (const template of allTemplates) {
      for (let i = 0; i < 25; i++) {
        const q = generateQuestion(template, createRng(`${template.id}-${i}`));
        expect(q.prompt).not.toContain('{');
        expect(q.prompt.length).toBeGreaterThan(0);
        expect(q.answer).not.toBe('');
      }
    }
  });

  it('never asks a child for a negative or fractional answer', () => {
    for (const template of allTemplates) {
      for (let i = 0; i < 25; i++) {
        const { answer } = generateQuestion(template, createRng(`${template.id}-neg-${i}`));
        expect(typeof answer).toBe('number');
        expect(answer as number).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(answer)).toBe(true);
      }
    }
  });

  it('tags every template with a school year', () => {
    for (const template of allTemplates) {
      expect(isYearLevel(template.level)).toBe(true);
    }
  });
});

describe('levels and topics are many-to-many', () => {
  it('gives a year several topics', () => {
    expect(topicsForLevel('maths', 'K')).toEqual(['counting numbers', 'even and odd']);
    expect(topicsForLevel('maths', '1').length).toBeGreaterThan(1);
  });

  it('carries a topic across several years, harder each time', () => {
    expect(levelsForTopic('maths', 'counting numbers')).toEqual(['K', '1']);
    expect(levelsForTopic('maths', 'even and odd')).toEqual(['K', '2']);
    expect(levelsForTopic('maths', 'multiplication')).toEqual(['2', '3']);
  });

  it('round-trips: every topic of a year lists that year back', () => {
    for (const subject of listSubjects()) {
      for (const level of subject.levels) {
        for (const topic of level.topics) {
          expect(levelsForTopic(subject.subject, topic)).toContain(level.level);
        }
      }
    }
  });

  it('returns nothing for a year or topic that does not exist', () => {
    expect(topicsForLevel('maths', '11')).toEqual([]);
    expect(levelsForTopic('maths', 'algebra')).toEqual([]);
    expect(levelsForTopic('spelling', 'counting numbers')).toEqual([]);
  });
});

describe('catalog lookups', () => {
  it('lists maths years in school order', () => {
    const maths = listSubjects().find((s) => s.subject === 'maths');

    expect(maths).toBeDefined();
    expect(maths!.levels.map((l) => l.level)).toEqual(['K', '1', '2', '3']);
    for (const level of maths!.levels) {
      expect(level.templateCount).toBeGreaterThan(0);
      expect(level.topics.length).toBeGreaterThan(0);
    }
  });

  it('lists every topic in the subject', () => {
    expect(listTopics('maths')).toContain('counting numbers');
    expect(listTopics('maths')).toContain('division');
    expect(listTopics('spelling')).toEqual([]);
  });

  it('looks up templates by subject and year', () => {
    expect(templatesFor('maths', 'K').every((t) => t.level === 'K')).toBe(true);
    expect(templatesFor('maths', '12')).toEqual([]);
    expect(templatesFor('spelling', 'K')).toEqual([]);
  });
});
