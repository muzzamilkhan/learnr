/**
 * The shapes that cross the API boundary.
 *
 * These used to be declared beside the Prisma queries that produced them, in
 * the five modules the extraction moved into `learnr-api`. Both sides need
 * them now - the server to describe what it returns, the web app and the iOS
 * client to describe what they receive - and two declarations of the same shape
 * would start drifting on the first change, which is the failure this whole
 * design exists to prevent. So they live here, in the package both apps already
 * depend on, and the data modules re-export them rather than redeclaring them.
 *
 * Pure by construction: types only, no Prisma, no runtime. Every `Date` here is
 * a real `Date`: nothing crosses a wire on the way to a screen any more, so a
 * Prisma read hands one over and it is read as one.
 *
 * `contract/openapi.yaml` remains the contract for a client that cannot import
 * TypeScript. This is the same information, for the two that can.
 */
import type { Avatar } from './avatars';
import type { ChildAccess } from './children';
import type { YearLevel } from './curriculum';
import type { DailyTarget } from './rewards/target';
import type { PlayStreak } from './rewards/streak';
import type { StandingChange } from './speedrun/leaderboard';
import type { QuestionTemplate } from './templates/types';

export type Role = 'parent' | 'child';

/** Who the signed-in user is, as every branch of the home screen needs it. */
export interface Account {
  id: string;
  role: Role | null;
  /** Set only on a child profile a parent created - the flag that fixes the level. */
  parentId: string | null;
  name: string | null;
  avatar: Avatar | null;
  image: string | null;
  /**
   * The photograph their parent cropped, if there is one. Parsed rather than
   * handed over as stored: the column is only ever written through `parsePhoto`,
   * and reading it back through the same boundary is what makes that a property
   * of the app rather than of the one action that happens to write it.
   */
  photo: string | null;
}

/** A child profile as the parent dashboard lists it. */
export interface ChildProfile {
  id: string;
  name: string;
  avatar: Avatar;
  /** The photograph, when their parent has set one - it wins over the avatar everywhere a face is drawn. */
  photo: string | null;
  /** Set by the parent at creation and only ever changed by them. */
  level: string | null;
  /** The daily target the parent set, or null for the child who has none. */
  target: DailyTarget | null;
  /** The live code, if one has been generated and not yet used or expired. */
  code: string | null;
  codeExpiresAt: Date | null;
}

/** Every child a person may look at: their own, and the ones shared with them. */
export interface ViewableChild extends ChildProfile {
  access: ChildAccess;
  /** The name of the parent who shared them, on a shared child only. */
  sharedBy: string | null;
}

/**
 * Everything the play screen reads off the child's own row: the run of days, the
 * stars, the goal and the level they last chose. One read rather than four,
 * which is why it is a shape rather than four calls.
 */
export interface PlayerState {
  /** As stored - the caller resolves it against content. */
  selectedLevel: string | null;
  streak: PlayStreak;
  stars: number;
  target: DailyTarget | null;
  /** The last local day the target's stars were banked. */
  targetDay: number | null;
}

/** What a recorded answer hands back to the play screen. Rewards only - never play. */
export interface AttemptResult {
  /** Days in a row including today. */
  streak: number;
  /** Whether this was the first answer of its day, and so worth showing. */
  streakAdvanced: boolean;
}

export interface Sitting {
  id: string;
  startedAt: number;
  level: YearLevel;
  attempts: number;
  correct: number;
  /** Summed time on this sitting's questions, each already capped when it was recorded. */
  timeMs: number;
}

export interface SpeedOutcome {
  previousBest: number | null;
  best: number;
  isRecord: boolean;
  /**
   * The move this run made on the family board, or null when it made none -
   * nobody else runs this mode, the place did not change, or the household
   * could not be read. `standingChange` decides which, and the result screen
   * says nothing at all when this is null.
   */
  standing: StandingChange | null;
}

export interface ChildRecord {
  childId: string;
  childName: string;
  mode: string;
  best: number;
  achievedAt: Date;
}

export interface PendingInvite {
  id: string;
  token: string;
  childIds: string[];
  createdAt: Date;
  expiresAt: Date;
}

export interface InviteDetails {
  /** Who is offering, for a page whose whole job is to say "accept this?". */
  ownerId: string;
  ownerName: string | null;
  children: {
    id: string;
    name: string;
    avatar: Avatar;
    photo: string | null;
    level: string | null;
  }[];
  expiresAt: Date;
  /** False once it has been accepted or has run out of its week. */
  live: boolean;
}

export type AcceptResult =
  | { ok: true; children: number }
  | { ok: false; reason: 'unavailable' | 'own-link' | 'error' };

/**
 * One subject and school year of shipped content.
 *
 * `version` is derived - 12 hex characters of sha256 over the pack's own bytes
 * with this field excluded - so it can never disagree with the templates below
 * it, and nobody has to remember to bump anything. It is the same value the
 * manifest carries as that pack's `etag`, written twice so neither file has to
 * be read to make sense of the other.
 */
export interface ContentPack {
  version: string;
  subject: string;
  level: YearLevel;
  templates: QuestionTemplate[];
}

export interface ContentManifestLevel {
  level: YearLevel;
  topics: string[];
  templateCount: number;
  /** The `version` of the pack this names. */
  etag: string;
}

export interface ContentManifestSubject {
  subject: string;
  levels: ContentManifestLevel[];
}

/**
 * What content exists, without any of it. A client renders a level picker from
 * this alone and downloads only the pack a child is about to play.
 */
export interface ContentManifest {
  version: string;
  subjects: ContentManifestSubject[];
}
