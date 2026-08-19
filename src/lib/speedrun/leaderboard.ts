import type { Avatar } from '../avatars';
import { MODES, modeKey, parseMode, type Mode } from './modes';

/**
 * Who is fastest in the house, per mode. Pure like the rest of `speedrun/` -
 * the rows come from `readFamilyRecords`, and nothing here reads a clock or a
 * database.
 *
 * A family is a parent and the children they manage, both playing the same
 * twenty-seven modes and each banking their own `SpeedRecord`. There is no new
 * column behind this and no migration: a leaderboard is those rows sorted, and
 * the score it sorts on is the same maximum the cabinet already shows.
 */

/**
 * One player's best at one mode - a `SpeedRecord` row with its owner named, and
 * drawn as their face. The photo and the avatar ride along beside the name
 * because the board shows the face and keeps the name for the alt text; which of
 * the three is drawn is `ProfileFace`'s decision, not this file's, and the
 * ranking cares about none of them.
 */
export interface FamilyRecord {
  playerId: string;
  playerName: string;
  playerPhoto?: string | null;
  playerAvatar?: Avatar | null;
  /** A grown-up's Google picture, which is the only face they have. */
  playerImage?: string | null;
  /** The stored mode key, parsed here rather than trusted. */
  mode: string;
  best: number;
  achievedAt: Date;
}

export interface Place {
  /** 1, 2 or 3 - shared on a tie, so two firsts are followed by a third. */
  place: number;
  playerId: string;
  playerName: string;
  playerPhoto?: string | null;
  playerAvatar?: Avatar | null;
  playerImage?: string | null;
  best: number;
  achievedAt: Date;
}

export interface Standing {
  mode: Mode;
  places: Place[];
}

/** How many *places* are shown - not how many rows, which a tie can exceed. */
export const PLACES = 3;

/**
 * The standings, one per mode somebody has run, in `MODES` order.
 *
 * **Only modes that have been run appear**, and `SpeedRecordsCabinet` draws the
 * empty ones the same way for the same reason: twenty-seven rows of dashes make
 * a to-do list out of a trophy case, and the few scores actually set end up the
 * smallest thing on a screen mostly composed of what has not happened.
 *
 * **A tie shares a place and the next one is skipped** - 1st, 1st, 3rd. In a
 * family of three a tie is common, and breaking it on a technicality would hand
 * one of them a second place they did not lose. Within a tie the earlier
 * `achievedAt` is listed first: they got there first, which is the only thing
 * that honestly separates them.
 *
 * The cut is at three *places*, not three rows, so a three-way tie for first
 * shows all three names rather than dropping one on the ordering used to break
 * a tie that was not broken.
 *
 * A `mode` key this build no longer recognises is dropped rather than rendered
 * as raw text - the same defence `recordBanners` and every other reader of a
 * stored key takes through `parseMode`.
 */
export function familyStandings(records: readonly FamilyRecord[]): Standing[] {
  const byMode = new Map<string, FamilyRecord[]>();

  for (const record of records) {
    if (parseMode(record.mode) === null) continue;
    const rows = byMode.get(record.mode);
    if (rows) rows.push(record);
    else byMode.set(record.mode, [record]);
  }

  return MODES.flatMap((mode) => {
    const rows = byMode.get(modeKey(mode));
    if (!rows) return [];
    return [{ mode, places: placesFor(rows) }];
  });
}

function placesFor(rows: readonly FamilyRecord[]): Place[] {
  const ordered = [...rows].sort(
    (a, b) => b.best - a.best || a.achievedAt.getTime() - b.achievedAt.getTime(),
  );

  const places: Place[] = [];
  let place = 0;
  let previousBest: number | null = null;

  for (const [index, row] of ordered.entries()) {
    // Standard competition ranking: a tie keeps the place it shares, and the
    // next different score takes the one its position implies.
    if (row.best !== previousBest) {
      place = index + 1;
      previousBest = row.best;
    }
    if (place > PLACES) break;

    places.push({
      place,
      playerId: row.playerId,
      playerName: row.playerName,
      playerPhoto: row.playerPhoto,
      playerAvatar: row.playerAvatar,
      playerImage: row.playerImage,
      best: row.best,
      achievedAt: row.achievedAt,
    });
  }

  return places;
}
