import type { Avatar } from '../avatars';
import { MODES, modeKey, parseMode, type Mode } from './modes';

/**
 * Who is fastest in the house, per mode. Pure like the rest of `speedrun/` -
 * the rows come from `readFamilyRecords`, and nothing here reads a clock or a
 * database.
 *
 * A family is a parent and the children they manage, both playing the same
 * twenty-six modes and each banking their own `SpeedRecord`. There is no new
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
 * The standings, one per mode somebody has run, **freshest first**.
 *
 * **Only modes that have been run appear**, and `SpeedRecordsCabinet` draws the
 * empty ones the same way for the same reason: twenty-six rows of dashes make
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
 * **The order is when a mode's podium last changed**, newest first, rather than
 * the fixed `MODES` order it used to be. Twenty-six cards is more than anyone
 * reads top to bottom, and the ones worth reading are the ones that just moved:
 * a board sorted by what happened lately puts the run somebody finished this
 * afternoon on the first card rather than wherever addition happens to sit in a
 * list. Freshness is the newest `achievedAt` among the *places*, not among the
 * rows - a fourth-place run changes nothing anybody can see on the card, so it
 * must not reorder the board either. Modes that are equally fresh keep `MODES`
 * order between them, which is what an empty board and a seeded test both fall
 * back to.
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

  const standings = MODES.flatMap((mode) => {
    const rows = byMode.get(modeKey(mode));
    if (!rows) return [];
    return [{ mode, places: placesFor(rows) }];
  });

  // Built in `MODES` order and sorted by freshness after, so `sort`'s stability
  // is what keeps two equally fresh modes in the order the game lists them.
  return standings.sort((a, b) => freshness(b) - freshness(a));
}

/** When this mode's podium last changed: the newest `achievedAt` on it. */
function freshness(standing: Standing): number {
  return Math.max(...standing.places.map((place) => place.achievedAt.getTime()));
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

/**
 * Where a run left a player on the family board, when that changed.
 *
 * The result screen is the one place a standing is *news* rather than a thing
 * to go and look at: the run just happened, and the only leaderboard fact worth
 * putting in front of a child at that moment is whether it moved them.
 */
export interface StandingChange {
  /** Where they sit now. Ties share a place, exactly as `familyStandings` places them. */
  place: number;
  /** Where they sat before this run, or null if they were not on the board at all. */
  previousPlace: number | null;
  /** How many other players have a record at this mode. Never zero - see below. */
  rivals: number;
}

/**
 * The move a run made on the family board, or null when there is nothing to
 * say.
 *
 * **Null when nobody else has run this mode.** A board of one is not a
 * leaderboard - the same judgement `/speed/leaderboard` makes before it draws
 * anything - and "you're 1st in the family" to a child who is the only person
 * who has ever played it is a prize for turning up.
 *
 * **Null when the place did not change**, which is most runs: a player's own
 * best can only rise, so a place can only improve, and a run short of their own
 * best moves nothing. Saying "still 2nd" would turn the one line about the
 * board into a line that is always there and usually means nothing.
 *
 * Arriving on the board at all counts as a move, with `previousPlace` null to
 * say so - a first-ever run at a mode other people play is exactly the moment
 * being placed is worth knowing.
 *
 * The rank is standard competition ranking, `placesFor`'s rule: one plus the
 * number of players strictly above, so a tie shares a place. It takes the
 * rivals' bests as bare numbers because that is all a rank needs, and it makes
 * the caller - which has just written a row - responsible for leaving its own
 * out.
 */
export function standingChange(
  rivalBests: readonly number[],
  previousBest: number | null,
  best: number,
): StandingChange | null {
  if (rivalBests.length === 0) return null;

  const rank = (score: number) => 1 + rivalBests.filter((rival) => rival > score).length;

  const place = rank(best);
  const previousPlace = previousBest === null ? null : rank(previousBest);
  if (previousPlace === place) return null;

  return { place, previousPlace, rivals: rivalBests.length };
}
