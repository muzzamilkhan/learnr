import type { ChildRecord } from '../speed-records';
import { operationLabel, parseMode, type Mode } from './modes';

/**
 * The sentence a parent's banner reads, and which child it belongs to.
 *
 * Kept out of `speed-banner.tsx` because building the sentence - which mode
 * gets an article and which gets its difficulty spelled out - is exactly the
 * kind of small, easy-to-get-wrong logic CLAUDE.md asks to live in `lib` with a
 * test beside it, not judged only by eye in a component.
 */
export interface RecordBanner {
  childId: string;
  childName: string;
  message: string;
}

/**
 * "the 4 times table", "tables 2-5", "all the tables", "easy addition" - the
 * noun phrase a sentence can drop straight in after "in". Multiplication reads
 * as a table because that is how it is drilled; every other operation has no
 * name of its own, so its difficulty stands in for one.
 */
function modeDescription(mode: Mode): string {
  if (mode.op === 'multiply') {
    if (mode.tables === 'all') return 'all the tables';
    if (typeof mode.tables === 'number') return `the ${mode.tables} times table`;
    return `tables ${mode.tables}`;
  }
  return `${mode.difficulty} ${operationLabel(mode.op).toLowerCase()}`;
}

/**
 * One line per child with an unseen record - the newest of theirs, since a
 * banner is a headline rather than a log. `readUnseenRecords` already orders
 * its rows newest first, so keeping the first hit per child is enough to keep
 * that order; a second or third achievement from the same child is still
 * cleared when the one shown is dismissed; see `dismissSpeedRecords`.
 *
 * A `mode` key this build no longer recognises is dropped rather than shown as
 * raw text - the same defence `parseMode` gives every other reader of a stored
 * key, and a record that can no longer be described is not one to announce.
 */
export function recordBanners(records: readonly ChildRecord[]): RecordBanner[] {
  const seen = new Set<string>();
  const banners: RecordBanner[] = [];

  for (const record of records) {
    if (seen.has(record.childId)) continue;
    const mode = parseMode(record.mode);
    if (mode === null) continue;
    seen.add(record.childId);

    banners.push({
      childId: record.childId,
      childName: record.childName,
      message: `${record.childName} scored a personal best in ${modeDescription(mode)}: ${record.best} questions in 90 seconds!`,
    });
  }

  return banners;
}
