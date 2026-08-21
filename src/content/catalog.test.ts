import { describe, it, expect } from 'vitest';
import { validateTemplates } from '@/lib/templates/validate';
import { generateQuestion } from '@/lib/templates/generate';
import { createRng } from '@/lib/rng';
import { isYearLevel } from '@/lib/curriculum';
import { MAX_NUMBER_LENGTH } from '@/lib/session/answers';
import {
  allTemplates,
  listSubjects,
  listLevels,
  listTopics,
  templatesFor,
  topicsForLevel,
  levelsForTopic,
  curriculumCodes,
  subjectOverview,
  SYLLABUSES,
  syllabusOf,
  nswStageOfCode,
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

  // A typed answer has to be something the number pad can actually produce: digits
  // and one decimal point, no minus key. True/false and multiple choice are tapped
  // rather than typed, so they are exempt.
  it('never asks a child to type an answer the number pad cannot enter', () => {
    for (const template of allTemplates) {
      for (let i = 0; i < 25; i++) {
        const q = generateQuestion(template, createRng(`${template.id}-typed-${i}`));
        if (q.answerType !== 'number') continue;

        const answer = q.answer as number;
        expect(typeof answer).toBe('number');
        expect(answer).toBeGreaterThanOrEqual(0);
        // Two decimal places is as fine as the curriculum gets, and keeps the
        // answer short enough to read back on the display.
        expect(Number(answer.toFixed(2))).toBe(answer);
        expect(String(answer).length).toBeLessThanOrEqual(MAX_NUMBER_LENGTH);
      }
    }
  });

  // Spelling a word on the letter pad is a literacy test, not a maths one. In the
  // early years the answer is tapped instead: a word a child of that age cannot
  // reliably spell would hide what they actually know about the maths.
  it('never asks a child in K to Year 3 to spell an answer', () => {
    const early = allTemplates.filter((t) => ['K', '1', '2', '3'].includes(t.level));

    for (const template of early) {
      for (let i = 0; i < 25; i++) {
        const q = generateQuestion(template, createRng(`${template.id}-spelling-${i}`));
        expect(q.answerType, template.id).not.toBe('text');
      }
    }
  });

  it('offers at most four options on a multiple choice question', () => {
    for (const template of allTemplates) {
      for (let i = 0; i < 25; i++) {
        const q = generateQuestion(template, createRng(`${template.id}-choice-${i}`));
        if (!q.choices) continue;
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.choices.length).toBeLessThanOrEqual(4);
        expect(q.choices).toContain(q.answer);
      }
    }
  });

  it('names every template subject.level.topic.variant', () => {
    for (const template of allTemplates) {
      const topic = template.topic.replaceAll(' ', '-');
      expect(template.id).toMatch(
        new RegExp(`^${template.subject}\\.${template.level}\\.${topic}\\.[a-z0-9-]+$`),
      );
    }
  });

  // Content is written against two syllabuses, so every template says which
  // content description or outcome it practises - AC9M4N02, MA2-AR-01. Either
  // source satisfies this on its own, because the two disagree about which year
  // some content belongs to and a template can honestly sit in only one of
  // them - each such template is named in an exception test below. What is
  // refused is a template citing neither: an uncited question is a claim about
  // the curriculum that nothing can check.
  it('cites a curriculum code from at least one syllabus for every template', () => {
    for (const template of allTemplates) {
      expect(template.tags?.some((tag) => syllabusOf(tag) !== null), template.id).toBe(true);
    }
  });

  // Two places where NSW teaches something a year or more before ACARA writes
  // it down, so the template cites NSW alone rather than the nearest ACARA
  // code that fits badly.
  //
  // - **Hour time on an analog clock.** NSW puts it at Early Stage 1;
  //   ACARA puts reading a clock face at Year 2 (AC9M2M04). Foundation's only
  //   time description, AC9MFM02, is about sequencing the days of the week and
  //   the times of the day, which is not what reading a dial practises.
  // - **Halves and quarters of a shape.** NSW puts them at Stage 1
  //   (MA1-GM-03); ACARA's first fraction description is AC9M2N03, at Year 2,
  //   and Year 1 has none to cite.
  //
  // It is the Year 6 integer exception pointed the other way, and the
  // curriculum page renders the disagreement either way round. Naming them here
  // means dropping the asterisk later has to be a decision somebody makes,
  // rather than a test going quietly green when a well-meaning edit adds a
  // code that does not belong.
  //
  // **The list is closed from both ends, and the second end is the one that
  // matters.** Asserting only that these two lack an ACARA code catches an
  // addition to them and misses a subtraction from anything else: with the
  // citation rule above now satisfied by either syllabus, dropping ACARA from
  // any of the other templates would otherwise pass green. So the exception is
  // also asserted as exhaustive - a template with no ACARA code has to be one
  // of the ids named here.
  it('cites no ACARA description for the content ACARA places a year later than NSW', () => {
    const nswOnly = [
      ...['oclock', 'clock-says'].map((v) => `maths.K.time.${v}`),
      ...['half-shaded', 'how-much-shaded'].map((v) => `maths.1.fractions.${v}`),
    ];

    for (const id of nswOnly) {
      const template = allTemplates.find((t) => t.id === id);
      expect(template, id).toBeDefined();
      expect(template!.tags?.some((tag) => syllabusOf(tag) === 'nsw'), id).toBe(true);
      expect(template!.tags?.some((tag) => syllabusOf(tag) === 'acara'), id).toBe(false);
    }

    const missingAcara = allTemplates
      .filter((t) => !t.tags?.some((tag) => syllabusOf(tag) === 'acara'))
      .map((t) => t.id);

    expect(missingAcara.sort()).toEqual([...nswOnly].sort());
  });

  it('tags every template with a school year', () => {
    for (const template of allTemplates) {
      expect(isYearLevel(template.level)).toBe(true);
    }
  });
});

describe('levels and topics are many-to-many', () => {
  it('gives a year several topics', () => {
    expect(topicsForLevel('maths', 'K')).toContain('counting numbers');
    expect(topicsForLevel('maths', 'K')).toContain('shapes');
    for (const level of ['K', '1', '2', '3', '4', '5', '6'] as const) {
      expect(topicsForLevel('maths', level).length).toBeGreaterThan(1);
    }
  });

  it('carries a topic across several years, harder each time', () => {
    expect(levelsForTopic('maths', 'counting numbers')).toEqual(['K', '1', '2', '3']);
    expect(levelsForTopic('maths', 'multiplication')).toEqual(['2', '3', '4', '5']);
    expect(levelsForTopic('maths', 'fractions')).toEqual(['1', '2', '3', '4', '5', '6']);
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

  it('returns nothing for a subject or topic that does not exist', () => {
    expect(topicsForLevel('spelling', 'K')).toEqual([]);
    expect(levelsForTopic('maths', 'calculus')).toEqual([]);
    expect(levelsForTopic('spelling', 'counting numbers')).toEqual([]);
  });
});

describe('catalog lookups', () => {
  it('lists maths years in school order', () => {
    const maths = listSubjects().find((s) => s.subject === 'maths');

    expect(maths).toBeDefined();
    expect(maths!.levels.map((l) => l.level)).toEqual(['K', '1', '2', '3', '4', '5', '6']);
    for (const level of maths!.levels) {
      expect(level.templateCount).toBeGreaterThan(0);
      expect(level.topics.length).toBeGreaterThan(0);
    }
  });

  // A session draws at random from a year's pool, so a thin year means a child
  // sees the same question shapes over and over.
  it('gives every year enough templates for a varied session', () => {
    const maths = listSubjects().find((s) => s.subject === 'maths');

    for (const level of maths!.levels) {
      expect(level.templateCount).toBeGreaterThanOrEqual(20);
    }
  });

  it('lists every topic in the subject', () => {
    expect(listTopics('maths')).toContain('counting numbers');
    expect(listTopics('maths')).toContain('division');
    expect(listTopics('spelling')).toEqual([]);
  });

  it('looks up templates by subject and year', () => {
    expect(templatesFor('maths', 'K').every((t) => t.level === 'K')).toBe(true);
    expect(templatesFor('maths', '6').every((t) => t.level === '6')).toBe(true);
    expect(templatesFor('spelling', 'K')).toEqual([]);
  });
});

describe('curriculumCodes', () => {
  it('groups the codes a subject cites by year, in school order', () => {
    const grouped = curriculumCodes('maths');

    expect(grouped.map((g) => g.level)).toEqual(['K', '1', '2', '3', '4', '5', '6']);
    expect(grouped[0].codes.map((c) => c.code)).toContain('AC9MFN01');
    expect(grouped[4].codes.map((c) => c.code)).toContain('AC9M4N02');
  });

  it('counts the templates citing a code, from either syllabus', () => {
    const grouped = curriculumCodes('maths', [
      { ...allTemplates[0], level: '3', topic: 'addition', tags: ['AC9M3N01', 'MA2-AR-01'] },
      { ...allTemplates[0], level: '3', topic: 'subtraction', tags: ['AC9M3N01'] },
    ]);

    expect(grouped).toEqual([
      {
        level: '3',
        codes: [
          { code: 'AC9M3N01', syllabus: 'acara', topics: ['addition', 'subtraction'], templateCount: 2 },
          { code: 'MA2-AR-01', syllabus: 'nsw', topics: ['addition'], templateCount: 1 },
        ],
      },
    ]);
  });

  it('ignores tags that are not curriculum codes', () => {
    const grouped = curriculumCodes('maths', [
      { ...allTemplates[0], level: 'K', tags: ['AC9MFN01', 'needs-review'] },
    ]);

    expect(grouped[0].codes.map((c) => c.code)).toEqual(['AC9MFN01']);
  });

  it('is empty for a subject with no content', () => {
    expect(curriculumCodes('spelling')).toEqual([]);
  });
});

describe('syllabus sources', () => {
  it('recognises an ACARA content description', () => {
    expect(syllabusOf('AC9M4N02')).toBe('acara');
    expect(syllabusOf('AC9MFN01')).toBe('acara');
  });

  it('recognises an NSW outcome code at every stage', () => {
    expect(syllabusOf('MAE-RWN-01')).toBe('nsw');
    expect(syllabusOf('MA1-CSQ-01')).toBe('nsw');
    expect(syllabusOf('MA2-MR-02')).toBe('nsw');
    expect(syllabusOf('MA3-RQF-01')).toBe('nsw');
    expect(syllabusOf('MAO-WM-01')).toBe('nsw');
  });

  it('accepts a focus-area segment with a digit in it', () => {
    expect(syllabusOf('MAE-RWN-01')).toBe('nsw');
    expect(syllabusOf('MA1-CHAN-01')).toBe('nsw');
    expect(syllabusOf('MA2-2DS-03')).toBe('nsw');
    expect(syllabusOf('MA3-RQF-02')).toBe('nsw');
    expect(syllabusOf('MAO-WM-01')).toBe('nsw');
  });

  it('is not fooled by a tag that is only a note to ourselves', () => {
    expect(syllabusOf('needs-review')).toBe(null);
    expect(syllabusOf('MA9-XX-01')).toBe(null);
    expect(syllabusOf('AC9E4N02')).toBe(null);
  });

  it('rejects a Stage 4 code, deliberately out of our K-6 scope', () => {
    expect(syllabusOf('MA4-INT-C-01')).toBe(null);
  });

  it('reads the stage an NSW code belongs to', () => {
    expect(nswStageOfCode('MAE-RWN-01')).toBe('ES1');
    expect(nswStageOfCode('MA1-FG-01')).toBe('S1');
    expect(nswStageOfCode('MA2-AR-01')).toBe('S2');
    expect(nswStageOfCode('MA3-GM-03')).toBe('S3');
  });

  // MAO-WM-01 is Working mathematically, which hangs off every outcome at
  // every stage rather than belonging to one. It has no stage to read.
  it('gives the working-mathematically code no stage', () => {
    expect(nswStageOfCode('MAO-WM-01')).toBe(null);
    expect(nswStageOfCode('AC9M4N02')).toBe(null);
  });

  it('names both sources', () => {
    expect(SYLLABUSES.map((s) => s.id)).toEqual(['acara', 'nsw']);
  });
});

describe('listLevels', () => {
  it('lists every year with content, in school order', () => {
    expect(listLevels()).toEqual(['K', '1', '2', '3', '4', '5', '6']);
  });

  it('merges the years across subjects without repeating one', () => {
    const levels = listLevels([
      { ...allTemplates[0], subject: 'maths', level: '2' },
      { ...allTemplates[0], subject: 'spelling', level: '6' },
      { ...allTemplates[0], subject: 'spelling', level: '2' },
      { ...allTemplates[0], subject: 'maths', level: 'K' },
    ]);

    expect(levels).toEqual(['K', '2', '6']);
  });
});

// The landing page's "what it teaches" section is built from this, so what a
// stranger is told the app covers is read from the content rather than written
// beside it. A hardcoded summary drifts the first time a template lands.
describe('subjectOverview', () => {
  it('reads the years and topics straight from the shipped templates', () => {
    const overview = subjectOverview('maths');

    expect(overview.levels.map((l) => l.level)).toEqual(listLevels());
    for (const level of overview.levels) {
      expect(level.topics).toEqual(topicsForLevel('maths', level.level));
    }
  });

  it('totals the templates and the distinct topics across every year', () => {
    const overview = subjectOverview('maths');

    expect(overview.templateCount).toBe(allTemplates.filter((t) => t.subject === 'maths').length);
    expect(overview.topicCount).toBe(listTopics('maths').length);
  });

  // A topic recurring across years is one topic, not one per year - counting it
  // twice would overstate the breadth on the one page nobody can check yet.
  it('counts a topic once however many years it spans', () => {
    const overview = subjectOverview('maths', [
      { ...allTemplates[0], subject: 'maths', topic: 'counting numbers', level: 'K' },
      { ...allTemplates[0], subject: 'maths', topic: 'counting numbers', level: '1' },
    ]);

    expect(overview.topicCount).toBe(1);
    expect(overview.templateCount).toBe(2);
    expect(overview.levels.map((l) => l.level)).toEqual(['K', '1']);
  });

  it('is empty for a subject with no content', () => {
    const overview = subjectOverview('spelling');

    expect(overview.levels).toEqual([]);
    expect(overview.templateCount).toBe(0);
    expect(overview.topicCount).toBe(0);
  });
});
