import { describe, it, expect } from 'vitest';
import { validateTemplates } from '@/lib/templates/validate';
import { generateQuestion } from '@/lib/templates/generate';
import { createRng } from '@/lib/rng';
import { isYearLevel, stageForLevel, type Stage } from '@/lib/curriculum';
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
  syllabusDivergences,
  DIVERGENCE_NOTES,
  subjectOverview,
  SYLLABUSES,
  syllabusOf,
  nswStageOfCode,
} from './catalog';

/**
 * Every NSW outcome code a template may cite, by stage - the four stage tables
 * of `docs/superpowers/notes/nsw-outcome-codes.md`, and nothing else. The test
 * flattens it, so the grouping buys nothing at assertion time and everything at
 * transcription time: it is four tables to check against four tables, in their
 * order, rather than one list of seventy-three to check against a document.
 *
 * The list is what turns "looks like a code" into "is a code": `syllabusOf`'s
 * pattern is a shape test, so a transposed `MA3-RFQ-01` for `MA3-RQF-01`
 * satisfies it, cites a syllabus, and reads from the right stage. Every other
 * test in this file passes on that typo, and the curriculum page would then
 * invite a parent to look up an outcome that does not exist.
 *
 * **Transcribed rather than parsed out of the notes file, and the alternative
 * was close.** The notes file is the single source of truth and a copy of it
 * here is a second one that can drift - but it lives under `docs/`, is prose
 * written for a person to read, and is free to be reworded or reformatted. A
 * regex over its markdown tables that stops matching produces an *empty* list,
 * and an empty membership list waves through every code in the catalogue: the
 * failure mode is a green test, which is the one failure mode this net must not
 * have. A transcription fails the other way - a code *missing* from it fails
 * loudly against the template that legitimately cites it.
 *
 * **That is true of omissions and of nothing else, so the transcription is the
 * thing to get right.** A code sitting here *wrongly* - mistyped on the way in,
 * or corrected in the notes file afterwards - stays green forever: the test
 * would cheerfully accept the very typo it exists to refuse, and no assertion in
 * this repo can tell that from a correct entry, because this list is where
 * correctness is defined. The only guard is the manual check against the notes
 * file, which is why the task report records how it was done rather than merely
 * saying it was: the code column of all four stage tables diffed against these
 * four blocks in both directions, empty each way, and the per-stage counts
 * (ES1 16, S1 16, S2 20, S3 21 - 73) reconciled against the totals the notes
 * file states for itself. Repeat that if you touch either side.
 *
 * **`MAO-WM-01` is deliberately absent.** Working mathematically hangs off
 * every outcome at every stage and has no stage of its own, which is why
 * `nswStageOfCode` returns null for it and why the stage test below would wave
 * it through. The notes file says not to cite it on a template - a generated
 * single-answer question cannot evidence it - and leaving it out of this list
 * is what makes that rule enforced rather than written down. The `/curriculum`
 * page naming it is prose about what this app does not claim to cover, not a
 * citation, so nothing there needs it here. This list answers one question
 * only: may a template carry this code?
 */
const NSW_OUTCOMES: Record<Stage, readonly string[]> = {
  ES1: [
    'MAE-RWN-01',
    'MAE-RWN-02',
    'MAE-CSQ-01',
    'MAE-CSQ-02',
    'MAE-FG-01',
    'MAE-FG-02',
    'MAE-GM-01',
    'MAE-GM-02',
    'MAE-GM-03',
    'MAE-2DS-01',
    'MAE-2DS-02',
    'MAE-3DS-01',
    'MAE-3DS-02',
    'MAE-NSM-01',
    'MAE-NSM-02',
    'MAE-DATA-01',
  ],
  S1: [
    'MA1-RWN-01',
    'MA1-RWN-02',
    'MA1-CSQ-01',
    'MA1-FG-01',
    'MA1-GM-01',
    'MA1-GM-02',
    'MA1-GM-03',
    'MA1-2DS-01',
    'MA1-2DS-02',
    'MA1-3DS-01',
    'MA1-3DS-02',
    'MA1-NSM-01',
    'MA1-NSM-02',
    'MA1-DATA-01',
    'MA1-DATA-02',
    'MA1-CHAN-01',
  ],
  S2: [
    'MA2-RN-01',
    'MA2-RN-02',
    'MA2-AR-01',
    'MA2-AR-02',
    'MA2-MR-01',
    'MA2-MR-02',
    'MA2-PF-01',
    'MA2-GM-01',
    'MA2-GM-02',
    'MA2-GM-03',
    'MA2-2DS-01',
    'MA2-2DS-02',
    'MA2-2DS-03',
    'MA2-3DS-01',
    'MA2-3DS-02',
    'MA2-NSM-01',
    'MA2-NSM-02',
    'MA2-DATA-01',
    'MA2-DATA-02',
    'MA2-CHAN-01',
  ],
  S3: [
    'MA3-RN-01',
    'MA3-RN-02',
    'MA3-RN-03',
    'MA3-AR-01',
    'MA3-MR-01',
    'MA3-MR-02',
    'MA3-RQF-01',
    'MA3-RQF-02',
    'MA3-GM-01',
    'MA3-GM-02',
    'MA3-GM-03',
    'MA3-2DS-01',
    'MA3-2DS-02',
    'MA3-2DS-03',
    'MA3-3DS-01',
    'MA3-3DS-02',
    'MA3-NSM-01',
    'MA3-NSM-02',
    'MA3-DATA-01',
    'MA3-DATA-02',
    'MA3-CHAN-01',
  ],
};

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
  // - **Reading an analog clock.** NSW puts o'clock at Early Stage 1 and half
  //   past at Stage 1; ACARA's read-a-clock-face description is AC9M2M04, at
  //   Year 2. Neither of the earlier years has one to cite instead:
  //   Foundation's only time description, AC9MFM02, is about sequencing the
  //   days of the week and the times of the day, and Year 1's AC9M1M03 is
  //   about durations in weeks, days and hours - which is why the four Year K
  //   and Year 1 templates that count *durations* keep their ACARA codes and
  //   only the ones that read a dial appear here.
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
      ...['half-past', 'half-past-claim'].map((v) => `maths.1.time.${v}`),
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

  // NSW places integers at Stage 4 - Year 7 - where ACARA places them at Year 6.
  // These three keep the ACARA citation and take no NSW one, and the curriculum
  // page renders the disagreement. Naming them here means dropping the asterisk
  // later has to be a decision somebody makes, rather than a test going quietly
  // green when a well-meaning edit adds an MA3- code that does not belong.
  it('cites no NSW outcome for the content NSW places beyond Year 6', () => {
    const acaraOnly = ['temperature', 'subtract', 'compare'].map((v) => `maths.6.integers.${v}`);

    for (const id of acaraOnly) {
      const template = allTemplates.find((t) => t.id === id);
      expect(template, id).toBeDefined();
      expect(template!.tags?.some((tag) => syllabusOf(tag) === 'acara')).toBe(true);
      expect(template!.tags?.some((tag) => syllabusOf(tag) === 'nsw')).toBe(false);
    }
  });

  // And the same list closed from the other end, which is the half that catches
  // a mistake nobody meant to make. The test above says three named templates
  // are ACARA-only on purpose; it says nothing about a fourth that ends up that
  // way by accident, and with the citation rule above satisfied by either
  // syllabus an NSW code quietly dropped off any other template would pass
  // green. So the complete set of templates carrying no NSW citation is
  // asserted, and every member of it names the decision that put it there.
  //
  // Each of these is a place NSW teaches something *later* than ACARA does, so
  // the honest Stage code for the year is one that does not cover the content -
  // and a citation the curriculum page presents as checkable is worse wrong
  // than missing. It is the `nswOnly` exception above pointed the other way.
  it('names every template that cites ACARA alone', () => {
    const acaraOnly = [
      // NSW places repeating patterns at Early Stage 1, where Task 15 cited
      // MAE-FG-01 for them, and no Stage 1 focus area picks them up again - so
      // a Year 1 template has no honest MA1- code to carry. Task 16's report
      // and commit 9686fc6 record the decision.
      'maths.1.number-patterns.repeating-unit',
      // NSW files grid maps and grid references at Stage 2, which is Years 3
      // and 4 - so a Year 2 template may only carry a Stage 1 code, and NSW
      // does not put this reading in Stage 1.
      'maths.2.position.grid-square',
      'maths.2.position.grid-square-claim',
      // A many-to-one picture graph below Stage 3 is ACARA-only unless it earns
      // the carve-out `maths.2.data.picture-key-two` makes out loud about
      // counting in twos; neither of these makes that argument, and at Year 4
      // the convention itself is the content rather than a way of counting.
      'maths.4.data.many-to-one',
      'maths.4.data.picture-key',
      // Both ask about the rotational symmetry of pentagons through octagons.
      // Year 4's equivalents cite Stage 2's transformations outcome, which has
      // no Stage 3 successor in the assembled code list, and the nearest
      // Stage 3 candidate, MA3-2DS-01, does not reach these shapes. Caught in
      // the Task 20 review, and both keep ['AC9M4SP03', 'AC9M5SP03'].
      'maths.5.symmetry.half-turn',
      'maths.5.symmetry.turn-matches',
      // NSW places integers at Stage 4 - Year 7 - which is the exception the
      // test above names one by one.
      'maths.6.integers.temperature',
      'maths.6.integers.subtract',
      'maths.6.integers.compare',
    ];

    const missingNsw = allTemplates
      .filter((t) => !t.tags?.some((tag) => syllabusOf(tag) === 'nsw'))
      .map((t) => t.id);

    expect(missingNsw.sort()).toEqual([...acaraOnly].sort());
  });

  // The characteristic bug of a second citation family, and invisible by
  // inspection across 350 templates: an NSW code from the wrong stage. A Stage 2
  // code on a Year 5 template reads as perfectly plausible and is simply wrong,
  // and every other test here passes on it - it cites a syllabus, it is a real
  // code, and it has no space in it. NSW pairs its years (Early Stage 1 is
  // Kindergarten, Stage 1 is Years 1 and 2, Stage 2 is Years 3 and 4, Stage 3 is
  // Years 5 and 6), so the check is against the template's stage and never its
  // year: a Year 6 template citing the MA3- code Year 5 also carries is the
  // syllabus working as written, not a mistake.
  it('only cites an NSW outcome from the stage the template’s year falls in', () => {
    for (const template of allTemplates) {
      for (const tag of template.tags ?? []) {
        const stage = nswStageOfCode(tag);
        if (!stage) continue;
        expect(stage, `${template.id} cites ${tag}`).toBe(stageForLevel(template.level));
      }
    }
  });

  // And the code has to be one the syllabus actually has. This is the only test
  // in the file that checks a citation for *truth* rather than for shape, which
  // is what makes it the strongest of them: `syllabusOf` accepts anything shaped
  // like a code, so a transposition survives every other check and reaches the
  // curriculum page, where a parent is invited to look it up. See NSW_OUTCOMES
  // above for why the list is transcribed and why MAO-WM-01 is not in it.
  it('cites no NSW outcome code the syllabus does not have', () => {
    const known = new Set(Object.values(NSW_OUTCOMES).flat());

    for (const template of allTemplates) {
      for (const tag of template.tags ?? []) {
        if (syllabusOf(tag) !== 'nsw') continue;
        expect(known.has(tag), `${template.id} cites ${tag}, which is not an NSW outcome`).toBe(
          true,
        );
      }
    }
  });

  // **Prose was the quarry.** A tag is an identifier; anything with a space in
  // it is a sentence, and NESA's sentences are Crown copyright - nothing in this
  // repo stores an outcome statement, which is the one rule here whose breach
  // would be a licensing problem rather than a bug.
  //
  // The whitespace test that catches it has to run over *every* tag, not over
  // the ones `syllabusOf` calls NSW: the NSW pattern has no whitespace in it, so
  // a tag holding an outcome statement is not an NSW tag by that test's own
  // reckoning and a narrowed guard would never look at it.
  //
  // **Which makes recognition the assertion to make, since it is strictly
  // stronger and the content already satisfies it** - 350 templates, 687 tags,
  // every one of them recognised today. It refuses prose, it refuses the
  // hyphen-joined evasion a whitespace check waves through
  // (`interprets-data-displays`), and it is the only thing in the file that sees
  // a *shape-broken* code like `MA3-DATA-1`: the membership test below skips it
  // because `syllabusOf` returns null, and the "cites a syllabus" test above is
  // satisfied by the ACARA code sitting beside it. That is the silent failure
  // this branch is built against - `curriculumCodes` drops a tag it does not
  // recognise, so a broken code reaches the curriculum page as a *missing*
  // citation rather than a visible error, and nobody would ever notice.
  //
  // It commits the repo to **every tag being a curriculum code**. That is a real
  // commitment and it is meant: a note-to-ourselves tag like `needs-review` is
  // no longer free to add, and putting one back has to be a decision somebody
  // makes here rather than a line that slips into a `tags` array.
  it('reproduces no syllabus prose, and tags nothing that is not a curriculum code', () => {
    for (const template of allTemplates) {
      for (const tag of template.tags ?? []) {
        expect(syllabusOf(tag), `${template.id} tags ${JSON.stringify(tag)}`).not.toBeNull();
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

// What the `/curriculum` page draws an em dash for. The two set-equality tests
// above already fix *which* templates cite one syllabus alone; this is the same
// fact grouped the way a reader meets it - by year and topic - so the page can
// derive the disagreement rather than transcribe a list that would go stale.
describe('syllabusDivergences', () => {
  it('names the year and topic where one syllabus has no code, and which one does', () => {
    const divergences = syllabusDivergences('maths', [
      // Cited by both: not a divergence.
      { ...allTemplates[0], level: '3', topic: 'addition', tags: ['AC9M3N01', 'MA2-AR-01'] },
      // ACARA alone, twice over in one topic.
      { ...allTemplates[0], level: '3', topic: 'position', tags: ['AC9M3SP02'] },
      { ...allTemplates[0], level: '3', topic: 'position', tags: ['AC9M3SP02'] },
      // NSW alone, in a year of its own.
      { ...allTemplates[0], level: '4', topic: 'time', tags: ['MA2-NSM-02'] },
    ]);

    expect(divergences).toEqual([
      { level: '3', topic: 'position', cites: 'acara', templateCount: 2, reason: null },
      { level: '4', topic: 'time', cites: 'nsw', templateCount: 1, reason: null },
    ]);
  });

  // A topic can hold both kinds of template - Year 1's clock faces cite NSW
  // alone while the durations beside them cite ACARA - so the count has to be
  // of the templates that actually diverge, not of the topic.
  it('counts only the templates that diverge, not the whole topic', () => {
    const divergences = syllabusDivergences('maths', [
      { ...allTemplates[0], level: '1', topic: 'time', tags: ['MA1-NSM-02'] },
      { ...allTemplates[0], level: '1', topic: 'time', tags: ['AC9M1M03', 'MA1-NSM-02'] },
    ]);

    expect(divergences).toEqual([
      {
        level: '1',
        topic: 'time',
        cites: 'nsw',
        templateCount: 1,
        reason: expect.stringContaining('NSW places half past at Stage 1'),
      },
    ]);
  });

  it('is empty for a subject with no content', () => {
    expect(syllabusDivergences('spelling')).toEqual([]);
  });

  it('finds the disagreement in both directions in the shipped content', () => {
    const shipped = syllabusDivergences('maths');

    expect(shipped).toContainEqual(
      expect.objectContaining({ level: '6', topic: 'integers', cites: 'acara', templateCount: 3 }),
    );
    expect(shipped).toContainEqual(
      expect.objectContaining({ level: '1', topic: 'fractions', cites: 'nsw', templateCount: 2 }),
    );
  });

  // The page renders every one of these, and a divergence with no note is an em
  // dash with nothing beside it - the easy case explained and the rest hidden,
  // which is the opposite of what that page is for.
  it('explains every divergence the shipped content produces', () => {
    const unexplained = syllabusDivergences('maths')
      .filter((d) => d.reason === null)
      .map((d) => `${d.cites}: ${d.level} ${d.topic}`);

    expect(unexplained).toEqual([]);
  });

  // And the same list closed from the other end, which is the half that catches
  // the sentence nobody deleted: a note whose divergence has since been resolved
  // by a citation would otherwise sit here reading perfectly well and explaining
  // nothing on the page.
  it('records no note that has outlived its divergence', () => {
    const live = syllabusDivergences('maths').map((d) => `${d.cites}:${d.level}:${d.topic}`);
    const orphans = DIVERGENCE_NOTES.map((n) => `${n.cites}:${n.level}:${n.topic}`).filter(
      (key) => !live.includes(key),
    );

    expect(orphans).toEqual([]);
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
