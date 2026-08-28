import { z } from 'zod';
import { AVATARS } from '@learnr/core/avatars';
import { MAX_MARKS } from '@learnr/core/figures/types';
import { yearLevelSchema } from './common.js';
import type {
  Account,
  AcceptResult,
  ChildProfile,
  ChildRecord,
  ContentManifest,
  ContentManifestLevel,
  ContentManifestSubject,
  ContentPack,
  InviteDetails,
  PendingInvite,
  PlayerState,
  Sitting,
  SpeedOutcome,
  ViewableChild,
} from '@learnr/core/dto';
import type { LearnerProfile, Observation, TopicSkill } from '@learnr/core/analytics/profile';
import type {
  AnsweredQuestion,
  Headline,
  ProgressBucket,
  TopicReport,
} from '@learnr/core/analytics/report';
import type { ErrorCluster } from '@learnr/core/analytics/errors';
import type { Figure, FigureSpec, Mark } from '@learnr/core/figures/types';
import type { ChoiceSpec, QuestionTemplate, VarSpec } from '@learnr/core/templates/types';
import type { SharedViewer } from '@learnr/core/children';
import type { DailyTarget, TargetAnswer } from '@learnr/core/rewards/target';
import type { PlayStreak } from '@learnr/core/rewards/streak';
import type { FamilyRecord, StandingChange } from '@learnr/core/speedrun/leaderboard';
import type { SpeedAttempt } from '@learnr/core/speedrun/history';
import type { SummaryRun } from '@learnr/core/speedrun/summary';
import type { Mode } from '@learnr/core/speedrun/modes';

/**
 * Every shape this server answers with, described rather than waved through.
 *
 * These endpoints used to declare `z.unknown()`, which typechecks, serializes
 * and documents nothing - the generated contract said "a 200 happens" and the
 * iOS client transcribed its models off the TypeScript by eye. That is the gap
 * this closes: `contract/openapi.yaml` now carries the real shape of every
 * response, so a client that cannot import TypeScript can generate its models
 * from it instead of copying them.
 *
 * **A response schema is a serializer, not just a description.** Fastify runs
 * the value through it on the way out, and a zod object strips what it does not
 * declare - so a field left out of a schema here does not fail loudly, it
 * silently vanishes from the response. Forget `figure` on an answered question
 * and a parent's report quietly loses its diagrams. That is the whole reason for
 * the guard below.
 */

/**
 * The DTOs are declared once, as TypeScript, in `@learnr/core/dto` and the
 * engine modules beside it - and they stay that way. What is here describes the
 * same shapes to Fastify, checked against them by the compiler rather than kept
 * in step by hand.
 *
 * `Mirrored` at the foot of this file is the check, and every schema is in it.
 *
 * **`satisfies z.ZodType<T>` alone is not enough, which is worth knowing before
 * reaching for it.** Assignability cannot see a missing *optional* field: an
 * object without `figure` is perfectly assignable to one with `figure?`, so
 * dropping `figure` from `answeredQuestionSchema` compiles clean and silently
 * empties every diagram out of a parent's report. Optional fields are exactly
 * the ones whose loss is invisible, so the check is on the **key sets**, both
 * ways, which sees them. It was verified by deleting `figure` and watching the
 * compiler name it.
 *
 * The check is shallow by design, and that is sound because it is *total*:
 * every nested shape is built from a schema that is itself in `Mirrored`, so a
 * leaf cannot be wrong without its own entry going red.
 *
 * There is no normalisation step between schema and DTO, deliberately - the
 * assertion is against the DTO itself. That costs `.readonly()` in the four
 * places an engine type is readonly, and it is worth it: a helper that smoothed
 * the difference away would also smooth away a real one.
 *
 * `Date` survives as a `Date`: `z.date()` accepts one and serializes it to an
 * ISO 8601 string, which the contract then documents as `format: date-time`.
 * That is what lets a client generate a date-typed model rather than a string it
 * has to remember to parse.
 */

/* The vocabulary ------------------------------------------------------- */

export const avatarSchema = z.enum(AVATARS);
export const roleSchema = z.enum(['parent', 'child']);
export const childAccessSchema = z.enum(['owner', 'viewer']);
export const skillStatusSchema = z.enum([
  'new',
  'struggling',
  'developing',
  'secure',
  'review-due',
]);
export const trendSchema = z.enum(['improving', 'steady', 'slipping', 'unknown']);
export const bucketUnitSchema = z.enum(['day', 'week']);
export const errorKindSchema = z.enum([
  'copied',
  'power-of-ten',
  'sign-dropped',
  'added-not-multiplied',
  'clock-format',
]);

export const dailyTargetSchema = z.object({
  kind: z.enum(['questions', 'minutes']),
  value: z.number().int(),
});

export const playStreakSchema = z.object({
  days: z.number().int(),
  /** A local day number, not a timestamp - see `src/lib/day.ts`. */
  lastDay: z.number().int().nullable(),
});

export const targetAnswerSchema = z.object({
  answeredAt: z.number().int(),
  timeTakenMs: z.number().int(),
});

/* Figures --------------------------------------------------------------- */

/**
 * A drawing in a 0-100 box, as it was stored against the answer the child gave.
 *
 * Four mark kinds and no more - a renderer has to handle every one, so anything
 * a fifth would express is a decision that has escaped `lib`. `MAX_MARKS` is
 * carried through from `parseFigure` so the contract states the same cap the
 * inbound boundary enforces.
 */
const pointSchema = z.tuple([z.number(), z.number()]).readonly();

export const markSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('path'),
    points: z.array(pointSchema).readonly(),
    closed: z.boolean(),
    fill: z.boolean(),
    dashed: z.boolean(),
  }),
  z.object({
    kind: z.literal('arc'),
    /** Screen coordinates, y down, where `fit` left it. */
    at: pointSchema,
    radius: z.number(),
    /** The maths frame instead: degrees anticlockwise from east. */
    from: z.number(),
    to: z.number(),
  }),
  z.object({ kind: z.literal('dot'), at: pointSchema }),
  z.object({ kind: z.literal('label'), at: pointSchema, text: z.string() }),
]);

export const figureSchema = z.object({
  width: z.number(),
  height: z.number(),
  marks: z.array(markSchema).max(MAX_MARKS).readonly(),
});

/* Who is asking, and who they may look at -------------------------------- */

export const accountSchema = z.object({
  id: z.string(),
  role: roleSchema.nullable(),
  parentId: z.string().nullable(),
  name: z.string().nullable(),
  avatar: avatarSchema.nullable(),
  image: z.string().nullable(),
  photo: z.string().nullable(),
});

export const childProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: avatarSchema,
  photo: z.string().nullable(),
  /** As stored - a caller resolves it against content, so it is not a YearLevel here. */
  level: z.string().nullable(),
  target: dailyTargetSchema.nullable(),
  code: z.string().nullable(),
  codeExpiresAt: z.date().nullable(),
});

export const viewableChildSchema = childProfileSchema.extend({
  access: childAccessSchema,
  sharedBy: z.string().nullable(),
});

/* The child's own screens ------------------------------------------------ */

export const playerStateSchema = z.object({
  selectedLevel: z.string().nullable(),
  streak: playStreakSchema,
  stars: z.number().int(),
  target: dailyTargetSchema.nullable(),
  targetDay: z.number().int().nullable(),
});

export const topicSkillSchema = z.object({
  topic: z.string(),
  level: yearLevelSchema,
  attempts: z.number().int(),
  correct: z.number().int(),
  /** Recency-weighted accuracy in [0, 1], so not an integer. */
  strength: z.number(),
  streak: z.number().int(),
  correctDays: z.number().int(),
  lastCorrectDay: z.number().int().nullable(),
  totalTimeMs: z.number().int(),
  lastAnsweredAt: z.number().int(),
});

export const learnerProfileSchema = z.object({
  skills: z.array(topicSkillSchema).readonly(),
});

export const playerReadSchema = z.object({
  player: playerStateSchema,
  targetAnswers: z.array(targetAnswerSchema),
});

export const playStateSchema = playerReadSchema.extend({
  profile: learnerProfileSchema,
  recentTopics: z.array(z.string()),
});

/* The report ------------------------------------------------------------- */

export const observationSchema = z.object({
  topic: z.string(),
  level: yearLevelSchema,
  correct: z.boolean(),
  /** Carried for the parent's report alone - nothing that folds a profile reads it. */
  templateId: z.string().optional(),
  timeTakenMs: z.number().int(),
  answeredAt: z.number().int(),
  offsetMinutes: z.number().int().optional(),
});

export const sittingSchema = z.object({
  id: z.string(),
  startedAt: z.number().int(),
  level: yearLevelSchema,
  attempts: z.number().int(),
  correct: z.number().int(),
  timeMs: z.number().int(),
});

export const answeredQuestionSchema = z.object({
  topic: z.string(),
  level: yearLevelSchema,
  prompt: z.string(),
  expected: z.string(),
  response: z.string(),
  correct: z.boolean(),
  answeredAt: z.number().int(),
  /** Present exactly when the question the child answered carried one. */
  figure: figureSchema.optional(),
});

export const topicReportSchema = z.object({
  topic: z.string(),
  level: yearLevelSchema,
  status: skillStatusSchema,
  attempts: z.number().int(),
  correct: z.number().int(),
  /** A ratio in [0, 1], like `strength`. */
  accuracy: z.number(),
  strength: z.number(),
  streak: z.number().int(),
  correctDays: z.number().int(),
  averageTimeMs: z.number().int(),
  lastAnsweredAt: z.number().int(),
  reviewDueAt: z.number().int(),
  trend: trendSchema,
});

export const progressBucketSchema = z.object({
  start: z.number().int(),
  unit: bucketUnitSchema,
  attempts: z.number().int(),
  correct: z.number().int(),
  /** Null for a bucket nobody answered in - a ratio needs a denominator. */
  accuracy: z.number().nullable(),
});

export const headlineSchema = z.object({
  minutes: z.number().int(),
  questions: z.number().int(),
  accuracy: z.number().nullable(),
  minutesDelta: z.number().int(),
  questionsDelta: z.number().int(),
  accuracyDelta: z.number().nullable(),
});

export const errorClusterSchema = z.object({
  kind: errorKindSchema,
  count: z.number().int(),
  topics: z.array(z.object({ topic: z.string(), level: yearLevelSchema })),
  examples: z.array(answeredQuestionSchema),
});

export const reportSchema = z.object({
  headline: headlineSchema,
  topics: z.array(topicReportSchema),
  problems: z.array(topicReportSchema),
  due: z.array(topicReportSchema),
  strengths: z.array(topicReportSchema),
  progress: z.array(progressBucketSchema),
  clusters: z.array(errorClusterSchema),
  sittings: z.array(sittingSchema),
});

/* Sharing ---------------------------------------------------------------- */

export const pendingInviteSchema = z.object({
  id: z.string(),
  token: z.string(),
  childIds: z.array(z.string()),
  createdAt: z.date(),
  expiresAt: z.date(),
});

export const sharedViewerSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  image: z.string().nullable(),
  children: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const sharesSchema = z.object({
  invites: z.array(pendingInviteSchema),
  viewers: z.array(sharedViewerSchema),
});

/**
 * What a link is offering, for the page whose whole job is to say "accept
 * this?". First names and year levels and nothing about how anyone is going -
 * this is served to anybody holding the token, signed in or not.
 */
export const inviteDetailsSchema = z.object({
  ownerId: z.string(),
  ownerName: z.string().nullable(),
  children: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      avatar: avatarSchema,
      photo: z.string().nullable(),
      level: z.string().nullable(),
    }),
  ),
  expiresAt: z.date(),
  /** False once it has been accepted or has run out of its week. */
  live: z.boolean(),
});

export const acceptResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), children: z.number().int() }),
  z.object({ ok: z.literal(false), reason: z.enum(['unavailable', 'own-link', 'error']) }),
]);

/* Speed runs ------------------------------------------------------------- */

export const tableChoiceSchema = z.union([
  z.number().int(),
  z.enum(['2-5', '6-9', '11-12', 'all']),
]);

export const modeSchema = z.union([
  z.object({
    op: z.enum(['add', 'subtract', 'divide', 'mixed']),
    difficulty: z.enum(['easy', 'moderate', 'hard']),
  }),
  z.object({ op: z.literal('multiply'), tables: tableChoiceSchema }),
]);

/** Each mode with the key a client submits it as - `multiply.7`, `add.easy`. */
export const modeListingSchema = z.union([
  z.object({
    key: z.string(),
    op: z.enum(['add', 'subtract', 'divide', 'mixed']),
    difficulty: z.enum(['easy', 'moderate', 'hard']),
  }),
  z.object({ key: z.string(), op: z.literal('multiply'), tables: tableChoiceSchema }),
]);

export const standingChangeSchema = z.object({
  place: z.number().int(),
  /** Null when this run is the player's first appearance on the board. */
  previousPlace: z.number().int().nullable(),
  rivals: z.number().int(),
});

export const speedOutcomeSchema = z.object({
  previousBest: z.number().int().nullable(),
  best: z.number().int(),
  isRecord: z.boolean(),
  /** Null when the run moved nobody: no rivals, no change, or an unreadable household. */
  standing: standingChangeSchema.nullable(),
});

export const speedAttemptSchema = z.object({
  mode: z.string(),
  correct: z.number().int(),
  playedAt: z.date(),
});

export const summaryRunSchema = z.object({
  mode: z.string(),
  correct: z.number().int(),
  playedAt: z.date(),
});

export const familyRecordSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  playerPhoto: z.string().nullable().optional(),
  playerAvatar: avatarSchema.nullable().optional(),
  playerImage: z.string().nullable().optional(),
  mode: z.string(),
  best: z.number().int(),
  achievedAt: z.date(),
});

/** `family: null` is nobody to rank, which is neither a failure nor an empty board. */
export const speedRecordsSchema = z.object({
  attempts: z.array(speedAttemptSchema),
  family: z.array(familyRecordSchema).nullable(),
});

export const childRecordSchema = z.object({
  childId: z.string(),
  childName: z.string(),
  mode: z.string(),
  best: z.number().int(),
  achievedAt: z.date(),
});

/* The report's raw half, which needs the speed runs above ---------------- */

/**
 * A child's raw history, for a caller that folds it itself.
 *
 * Three of these are nullable and two are not, and the difference is which
 * failure the screen can still be read through: without observations or
 * sittings there is no report at all, so those are a 503 and never null here.
 * The rest degrade - a report without its examples is still worth reading, and
 * a calendar without its window falls back to plain shading rather than drawing
 * four weeks of missed goals.
 */
export const childHistorySchema = z.object({
  observations: z.array(observationSchema),
  sittings: z.array(sittingSchema),
  answers: z.array(answeredQuestionSchema).nullable(),
  recentAnswers: z.array(targetAnswerSchema).nullable(),
  /** Null when they were not asked for, and when the read failed. */
  speedRuns: z.array(summaryRunSchema).nullable(),
});

/* Content packs ------------------------------------------------------------ */

/**
 * Everything a content pack carries.
 *
 * A template is authored data and every numeric field in it is an *expression
 * string*, not a number - `max: 'x - 1'` is the point of the format - so
 * `exprSchema` is `z.string()` throughout and tightening any of it to a number
 * would 500 the endpoint on perfectly good content.
 */
const exprSchema = z.string();

export const varSpecSchema = z.discriminatedUnion('kind', [
  z.object({
    name: z.string(), kind: z.literal('int'),
    min: exprSchema, max: exprSchema, step: z.number().optional(),
  }),
  z.object({
    name: z.string(), kind: z.literal('number'),
    min: exprSchema, max: exprSchema, decimals: z.number().optional(),
  }),
  z.object({
    name: z.string(), kind: z.literal('pick'),
    from: z.array(z.union([z.string(), z.number()])).readonly(),
    weights: z.array(z.number()).readonly().optional(),
  }),
  z.object({ name: z.string(), kind: z.literal('expr'), expr: exprSchema }),
]);

export const choiceSpecSchema = z.object({
  count: z.number(),
  distractors: z.array(exprSchema).readonly().optional(),
  jitter: z.object({ min: exprSchema, max: exprSchema }).optional(),
  rankIsTheQuestion: z.boolean().optional(),
  propertyIsTheQuestion: z.boolean().optional(),
});

export const figureSpecSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('polygon'), shape: exprSchema,
    rotation: exprSchema.optional(), mirror: exprSchema.optional(),
    rightAngles: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('angle'), degrees: exprSchema,
    rotation: exprSchema.optional(), armLength: exprSchema.optional(),
    arc: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('bar'), values: exprSchema,
    labels: exprSchema.optional(), style: exprSchema.optional(),
    scale: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('pictograph'), counts: exprSchema,
    labels: exprSchema.optional(), key: exprSchema.optional(),
    halves: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('spinner'), sectors: exprSchema,
    fills: exprSchema.optional(), rotation: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('solid'), solid: exprSchema,
    view: exprSchema.optional(), rotation: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('number-line'), at: exprSchema,
    from: exprSchema.optional(), to: exprSchema.optional(),
    step: exprSchema.optional(), minorTicks: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('clock'), hour: exprSchema, minute: exprSchema,
    numerals: exprSchema.optional(), minuteTicks: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('array'), rows: exprSchema, columns: exprSchema,
    orientation: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('fraction-shape'), numerator: exprSchema, denominator: exprSchema,
    shape: exprSchema.optional(), rotation: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('grid'), at: exprSchema,
    columns: exprSchema.optional(), rows: exprSchema.optional(),
    axisLabels: exprSchema.optional(), onLines: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('timeline'), years: exprSchema,
    labels: exprSchema.optional(), from: exprSchema.optional(),
    to: exprSchema.optional(), step: exprSchema.optional(),
  }),
]);

export const questionTemplateSchema = z.object({
  id: z.string(),
  subject: z.string(),
  topic: z.string(),
  level: yearLevelSchema,
  tags: z.array(z.string()).readonly().optional(),
  prompt: z.string(),
  vars: z.array(varSpecSchema).readonly(),
  constraints: z.array(exprSchema).readonly().optional(),
  answer: exprSchema,
  answerType: z.enum(['number', 'text', 'choice', 'boolean']).optional(),
  choices: choiceSpecSchema.optional(),
  hint: z.string().optional(),
  figure: figureSpecSchema.optional(),
});

export const contentPackSchema = z.object({
  version: z.string(),
  subject: z.string(),
  level: yearLevelSchema,
  templates: z.array(questionTemplateSchema),
});

export const contentManifestLevelSchema = z.object({
  level: yearLevelSchema,
  topics: z.array(z.string()),
  templateCount: z.number().int(),
  etag: z.string(),
});

export const contentManifestSubjectSchema = z.object({
  subject: z.string(),
  levels: z.array(contentManifestLevelSchema),
});

export const contentManifestSchema = z.object({
  version: z.string(),
  subjects: z.array(contentManifestSubjectSchema),
});

/* The guard -------------------------------------------------------------- */

/**
 * Every schema above, held against the DTO it describes.
 *
 * A schema is a serializer here, so a field it fails to declare is a field that
 * silently disappears from the response - and assignability alone cannot see
 * that, because an object missing an *optional* field is still assignable to one
 * that has it. So this compares the **key sets**, both ways, and reports the
 * offending field by name rather than as a wall of structural mismatch.
 *
 * Shallow, and total: every nested shape is built from a schema that has its own
 * entry, so nothing can be wrong without one of these lines going red.
 *
 * Exported so it is never an unused declaration, and because the list itself is
 * worth reading - it is the map of what this server promises.
 */
export type Mirrored = {
  account: Assert<Mirrors<typeof accountSchema, Account>>;
  childProfile: Assert<Mirrors<typeof childProfileSchema, ChildProfile>>;
  viewableChild: Assert<Mirrors<typeof viewableChildSchema, ViewableChild>>;
  dailyTarget: Assert<Mirrors<typeof dailyTargetSchema, DailyTarget>>;
  playStreak: Assert<Mirrors<typeof playStreakSchema, PlayStreak>>;
  targetAnswer: Assert<Mirrors<typeof targetAnswerSchema, TargetAnswer>>;
  playerState: Assert<Mirrors<typeof playerStateSchema, PlayerState>>;
  figure: Assert<Mirrors<typeof figureSchema, Figure>>;
  topicSkill: Assert<Mirrors<typeof topicSkillSchema, TopicSkill>>;
  learnerProfile: Assert<Mirrors<typeof learnerProfileSchema, LearnerProfile>>;
  observation: Assert<Mirrors<typeof observationSchema, Observation>>;
  sitting: Assert<Mirrors<typeof sittingSchema, Sitting>>;
  answeredQuestion: Assert<Mirrors<typeof answeredQuestionSchema, AnsweredQuestion>>;
  topicReport: Assert<Mirrors<typeof topicReportSchema, TopicReport>>;
  progressBucket: Assert<Mirrors<typeof progressBucketSchema, ProgressBucket>>;
  headline: Assert<Mirrors<typeof headlineSchema, Headline>>;
  errorCluster: Assert<Mirrors<typeof errorClusterSchema, ErrorCluster>>;
  pendingInvite: Assert<Mirrors<typeof pendingInviteSchema, PendingInvite>>;
  sharedViewer: Assert<Mirrors<typeof sharedViewerSchema, SharedViewer>>;
  inviteDetails: Assert<Mirrors<typeof inviteDetailsSchema, InviteDetails>>;
  acceptResult: Assert<Mirrors<typeof acceptResultSchema, AcceptResult>>;
  standingChange: Assert<Mirrors<typeof standingChangeSchema, StandingChange>>;
  speedOutcome: Assert<Mirrors<typeof speedOutcomeSchema, SpeedOutcome>>;
  speedAttempt: Assert<Mirrors<typeof speedAttemptSchema, SpeedAttempt>>;
  summaryRun: Assert<Mirrors<typeof summaryRunSchema, SummaryRun>>;
  familyRecord: Assert<Mirrors<typeof familyRecordSchema, FamilyRecord>>;
  childRecord: Assert<Mirrors<typeof childRecordSchema, ChildRecord>>;
  questionTemplate: Assert<Mirrors<typeof questionTemplateSchema, QuestionTemplate>>;
  choiceSpec: Assert<Mirrors<typeof choiceSpecSchema, ChoiceSpec>>;
  contentPack: Assert<Mirrors<typeof contentPackSchema, ContentPack>>;
  contentManifest: Assert<Mirrors<typeof contentManifestSchema, ContentManifest>>;
  contentManifestSubject: Assert<Mirrors<typeof contentManifestSubjectSchema, ContentManifestSubject>>;
  contentManifestLevel: Assert<Mirrors<typeof contentManifestLevelSchema, ContentManifestLevel>>;
};

/**
 * True when a schema describes a DTO exactly, and otherwise a type that fails to
 * satisfy `true` while naming what is wrong - which is what a reader sees in the
 * compiler error.
 *
 * `Mark`, `Mode` and the two unions this task adds (`VarSpec`, `FigureSpec`) are
 * all unions, and `keyof` a union is only the keys common to every arm, so key
 * comparison alone would wave a missing arm through - `Mirrors` is for a plain
 * object and none of the four can go through it directly.
 *
 * They do not all take the same fix, and which one a new union needs is worth
 * checking before reaching for the nearer one. Assignability in both directions
 * (`Both`, below) is exact for `Mode` and `Mark`, because every field on every
 * arm of both is required - there is nothing optional for assignability to fail
 * to notice. It stops being exact the moment an arm carries an *optional*
 * field: proved by deleting `rightAngles` from `figureSpecSchema`'s `polygon`
 * arm and watching the typecheck stay green anyway. TypeScript treats "the
 * property is absent" and "the property is declared optional and absent" as
 * mutually assignable, so a whole optional field can vanish from one arm
 * without `Both` ever seeing it - the same blindness the comment on `Check`
 * warns about for a plain object, reappearing per arm. `VarSpec` and
 * `FigureSpec` both carry optional fields per arm, so they are held by
 * `CheckEachArm` instead: `Check`'s exact key sets, both ways, run once per
 * discriminant value, so a dropped field still names itself and the arm it
 * went missing from.
 */
type Mirrors<Schema extends z.ZodType, Dto> = Check<z.infer<Schema>, Dto>;

/** Where the failure actually lands: anything but `true` fails this constraint. */
type Assert<T extends true> = T;

type Check<Inferred, Dto> = [Inferred] extends [Dto]
  ? [Exclude<keyof Dto, keyof Inferred>] extends [never]
    ? [Exclude<keyof Inferred, keyof Dto>] extends [never]
      ? true
      : { schemaDeclaresAFieldTheDtoDoesNot: Exclude<keyof Inferred, keyof Dto> }
    : { schemaIsMissing: Exclude<keyof Dto, keyof Inferred> }
  : { schemaDoesNotDescribe: Dto };

/** The `kind`-discriminated unions, checked exactly - see `CheckEachArm`. */
export type MirroredUnions = {
  mark: Assert<Both<z.infer<typeof markSchema>, Mark>>;
  mode: Assert<Both<z.infer<typeof modeSchema>, Mode>>;
  modeListing: Assert<Both<z.infer<typeof modeListingSchema>, Mode & { key: string }>>;
  varSpec: Assert<CheckEachArm<z.infer<typeof varSpecSchema>, VarSpec>>;
  figureSpec: Assert<CheckEachArm<z.infer<typeof figureSpecSchema>, FigureSpec>>;
};

type Both<A, B> = [A] extends [B] ? ([B] extends [A] ? true : { notExactly: B }) : { notExactly: B };

/** The arm of union `U` whose discriminant `K` is `V`. */
type ArmWith<U, K extends PropertyKey, V> = U extends Record<K, V> ? U : never;

/** Every discriminant value `K` takes across union `U`. */
type Discriminants<U, K extends PropertyKey> = U extends Record<K, infer V> ? V : never;

/**
 * A `kind`-discriminated union, held to `Check`'s exact key sets arm by arm
 * rather than to `Both`'s whole-union assignability - see the comment on
 * `Mirrors` for why the two are not interchangeable. Reuses `Check` once per
 * discriminant value the DTO's union takes, so a field dropped from a single
 * arm's schema names itself, and names the arm it went missing from, rather
 * than passing unnoticed the way `Both` does.
 *
 * Collapses to `true` only when every arm's `Check` does; otherwise the
 * result is the whole per-discriminant map, so the failing arm reads off the
 * key it is filed under.
 */
type CheckEachArm<Schema, Dto, K extends PropertyKey = 'kind'> = ArmChecksAllTrue<{
  [V in Discriminants<Dto, K> & PropertyKey]: Check<ArmWith<Schema, K, V>, ArmWith<Dto, K, V>>;
}>;

type ArmChecksAllTrue<T> = T[keyof T] extends true ? true : T;
