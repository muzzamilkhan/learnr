var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server.ts
import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifyCors from "@fastify/cors";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler
} from "fastify-type-provider-zod";

// src/openapi.ts
import { jsonSchemaTransformObject } from "fastify-type-provider-zod";
var PREFIX = "#/components/schemas/";
var transformObject = (input) => {
  const document = jsonSchemaTransformObject(input);
  const schemas = document.components?.schemas;
  if (!schemas) return collapseNullableUnions(document);
  return collapseNullableUnions({
    ...document,
    components: { ...document.components, schemas: reachable(schemas, document.paths) }
  });
};
var NULL_SCHEMA = "null";
var NULLABLE_REF_NOTE = "May be null. The null is not expressible beside a $ref in OpenAPI 3.1, so it is said here instead.";
function collapseNullableUnions(value) {
  if (Array.isArray(value)) return value.map(collapseNullableUnions);
  if (value === null || typeof value !== "object") return value;
  const walked = Object.fromEntries(
    Object.entries(value).map(([key2, child]) => [key2, collapseNullableUnions(child)])
  );
  const pruned = withoutNullableRefsInRequired(value, walked);
  const { anyOf, ...rest } = pruned;
  const other = nullableMember(anyOf);
  if (!other) return pruned;
  if ("$ref" in other) {
    return {
      description: NULLABLE_REF_NOTE,
      // Whatever sat beside the union outranks what is invented here.
      ...rest,
      allOf: [other]
    };
  }
  return {
    ...other,
    // Whatever sat beside the union outranks the member's own copy of it: it
    // was written about the nullable as a whole.
    ...rest,
    type: [other.type, NULL_SCHEMA],
    // `enum` restricts the value whatever `type` permits, so a collapse that
    // left it alone would produce a schema refusing the null the union allowed
    // - the same silent narrowing, wearing the fix's clothes.
    ...Array.isArray(other.enum) ? { enum: [...other.enum, null] } : {}
  };
}
function withoutNullableRefsInRequired(original, walked) {
  const { properties, required } = original;
  if (!properties || typeof properties !== "object" || !Array.isArray(required)) return walked;
  const isNullableRef = (name) => {
    if (typeof name !== "string") return false;
    const property = properties[name];
    const other = property ? nullableMember(property.anyOf) : void 0;
    return other !== void 0 && "$ref" in other;
  };
  const kept = required.filter((name) => !isNullableRef(name));
  return kept.length === required.length ? walked : { ...walked, required: kept };
}
function nullableMember(anyOf) {
  if (!Array.isArray(anyOf) || anyOf.length !== 2) return void 0;
  const isNull = (member) => typeof member === "object" && member !== null && Object.keys(member).length === 1 && member.type === NULL_SCHEMA;
  const nulls = anyOf.filter(isNull);
  if (nulls.length !== 1) return void 0;
  const other = anyOf.find((member) => !isNull(member));
  if (typeof other !== "object" || other === null) return void 0;
  const keys = Object.keys(other);
  if (keys.length === 1 && typeof other.$ref === "string") {
    return other;
  }
  return typeof other.type === "string" ? other : void 0;
}
function reachable(schemas, paths) {
  const seen = /* @__PURE__ */ new Set();
  const pending = referencesIn(paths);
  while (pending.length > 0) {
    const name = pending.pop();
    if (seen.has(name) || !(name in schemas)) continue;
    seen.add(name);
    pending.push(...referencesIn(schemas[name]));
  }
  return Object.fromEntries(Object.entries(schemas).filter(([name]) => seen.has(name)));
}
function referencesIn(value) {
  if (Array.isArray(value)) return value.flatMap(referencesIn);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(
    ([key2, child]) => key2 === "$ref" && typeof child === "string" && child.startsWith(PREFIX) ? [child.slice(PREFIX.length)] : referencesIn(child)
  );
}

// src/schemas/register.ts
import { z as z5 } from "zod";

// src/schemas/common.ts
var common_exports = {};
__export(common_exports, {
  errorSchema: () => errorSchema,
  idSchema: () => idSchema,
  yearLevelSchema: () => yearLevelSchema
});
import { z } from "zod";
var yearLevelSchema = z.enum(["K", "1", "2", "3", "4", "5", "6"]);
var idSchema = z.string().min(1).max(64);
var errorSchema = z.object({
  error: z.string()
});

// src/schemas/account.ts
var account_exports = {};
__export(account_exports, {
  childDetailsSchema: () => childDetailsSchema,
  loginCodeSchema: () => loginCodeSchema
});
import { z as z2 } from "zod";
var childDetailsSchema = z2.object({
  name: z2.string().trim().min(1).max(40),
  avatar: z2.string().min(1),
  level: yearLevelSchema,
  targetKind: z2.enum(["questions", "minutes"]).nullable(),
  targetValue: z2.number().int().positive().nullable(),
  photo: z2.string().nullable()
});
var loginCodeSchema = z2.object({
  code: z2.string(),
  expiresAt: z2.string()
});

// src/schemas/play.ts
var play_exports = {};
__export(play_exports, {
  attemptResultSchema: () => attemptResultSchema,
  attemptSchema: () => attemptSchema,
  attemptsBodySchema: () => attemptsBodySchema,
  createSessionSchema: () => createSessionSchema,
  sessionSchema: () => sessionSchema
});
import { z as z3 } from "zod";
var attemptSchema = z3.object({
  id: z3.uuid(),
  templateId: z3.string().min(1),
  subject: z3.string().min(1),
  topic: z3.string().min(1),
  level: yearLevelSchema,
  prompt: z3.string(),
  expected: z3.string(),
  response: z3.string(),
  correct: z3.boolean(),
  timeTakenMs: z3.number().int().min(0),
  answeredAt: z3.number().int(),
  offsetMinutes: z3.number().int().min(-840).max(840),
  figure: z3.unknown().optional()
});
var createSessionSchema = z3.object({
  id: z3.uuid(),
  subject: z3.string().min(1),
  level: yearLevelSchema,
  seed: z3.string().min(1)
});
var sessionSchema = z3.object({ id: idSchema });
var attemptsBodySchema = z3.object({
  attempts: z3.array(attemptSchema).min(1).max(200)
});
var attemptResultSchema = z3.object({
  streak: z3.number().int().min(0),
  streakAdvanced: z3.boolean()
});

// src/schemas/dto.ts
var dto_exports = {};
__export(dto_exports, {
  acceptResultSchema: () => acceptResultSchema,
  accountSchema: () => accountSchema,
  answeredQuestionSchema: () => answeredQuestionSchema,
  avatarSchema: () => avatarSchema,
  bucketUnitSchema: () => bucketUnitSchema,
  childAccessSchema: () => childAccessSchema,
  childHistorySchema: () => childHistorySchema,
  childProfileSchema: () => childProfileSchema,
  childRecordSchema: () => childRecordSchema,
  choiceSpecSchema: () => choiceSpecSchema,
  contentManifestLevelSchema: () => contentManifestLevelSchema,
  contentManifestSchema: () => contentManifestSchema,
  contentManifestSubjectSchema: () => contentManifestSubjectSchema,
  contentPackSchema: () => contentPackSchema,
  dailyTargetSchema: () => dailyTargetSchema,
  errorClusterSchema: () => errorClusterSchema,
  errorKindSchema: () => errorKindSchema,
  familyRecordSchema: () => familyRecordSchema,
  figureSchema: () => figureSchema,
  figureSpecSchema: () => figureSpecSchema,
  headlineSchema: () => headlineSchema,
  inviteDetailsSchema: () => inviteDetailsSchema,
  learnerProfileSchema: () => learnerProfileSchema,
  markSchema: () => markSchema,
  modeListingSchema: () => modeListingSchema,
  modeSchema: () => modeSchema,
  observationSchema: () => observationSchema,
  pendingInviteSchema: () => pendingInviteSchema,
  playStateSchema: () => playStateSchema,
  playStreakSchema: () => playStreakSchema,
  playerReadSchema: () => playerReadSchema,
  playerStateSchema: () => playerStateSchema,
  progressBucketSchema: () => progressBucketSchema,
  questionTemplateSchema: () => questionTemplateSchema,
  reportSchema: () => reportSchema,
  roleSchema: () => roleSchema,
  sharedViewerSchema: () => sharedViewerSchema,
  sharesSchema: () => sharesSchema,
  sittingSchema: () => sittingSchema,
  skillStatusSchema: () => skillStatusSchema,
  speedAttemptSchema: () => speedAttemptSchema,
  speedOutcomeSchema: () => speedOutcomeSchema,
  speedRecordsSchema: () => speedRecordsSchema,
  standingChangeSchema: () => standingChangeSchema,
  summaryRunSchema: () => summaryRunSchema,
  tableChoiceSchema: () => tableChoiceSchema,
  targetAnswerSchema: () => targetAnswerSchema,
  topicReportSchema: () => topicReportSchema,
  topicSkillSchema: () => topicSkillSchema,
  trendSchema: () => trendSchema,
  varSpecSchema: () => varSpecSchema,
  viewableChildSchema: () => viewableChildSchema
});
import { z as z4 } from "zod";

// ../../src/lib/avatars.ts
var AVATARS = ["fox", "bear", "cat", "owl", "frog", "whale", "rabbit", "panda"];
function parseAvatar(value) {
  return AVATARS.includes(value) ? value : null;
}

// ../../src/lib/figures/types.ts
var MAX_MARKS = 200;
var isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
function parsePoint(value) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [x, y] = value;
  return isFiniteNumber(x) && isFiniteNumber(y) ? [x, y] : null;
}
function parsePoints(value) {
  if (!Array.isArray(value)) return null;
  const points = [];
  for (const raw2 of value) {
    const point = parsePoint(raw2);
    if (!point) return null;
    points.push(point);
  }
  return points;
}
function parseMark(value) {
  if (typeof value !== "object" || value === null) return null;
  const mark = value;
  switch (mark.kind) {
    case "path": {
      const points = parsePoints(mark.points);
      if (!points || typeof mark.closed !== "boolean" || typeof mark.fill !== "boolean" || typeof mark.dashed !== "boolean") {
        return null;
      }
      return { kind: "path", points, closed: mark.closed, fill: mark.fill, dashed: mark.dashed };
    }
    case "arc": {
      const at = parsePoint(mark.at);
      if (!at || !isFiniteNumber(mark.radius) || !isFiniteNumber(mark.from) || !isFiniteNumber(mark.to)) {
        return null;
      }
      return { kind: "arc", at, radius: mark.radius, from: mark.from, to: mark.to };
    }
    case "dot": {
      const at = parsePoint(mark.at);
      return at ? { kind: "dot", at } : null;
    }
    case "label": {
      const at = parsePoint(mark.at);
      return at && typeof mark.text === "string" ? { kind: "label", at, text: mark.text } : null;
    }
    default:
      return null;
  }
}
function parseFigure(value) {
  if (typeof value !== "object" || value === null) return null;
  const figure = value;
  if (!isFiniteNumber(figure.width) || figure.width <= 0) return null;
  if (!isFiniteNumber(figure.height) || figure.height <= 0) return null;
  if (!Array.isArray(figure.marks) || figure.marks.length > MAX_MARKS) return null;
  const marks = [];
  for (const raw2 of figure.marks) {
    const mark = parseMark(raw2);
    if (!mark) return null;
    marks.push(mark);
  }
  return { width: figure.width, height: figure.height, marks };
}

// src/schemas/dto.ts
var avatarSchema = z4.enum(AVATARS);
var roleSchema = z4.enum(["parent", "child"]);
var childAccessSchema = z4.enum(["owner", "viewer"]);
var skillStatusSchema = z4.enum([
  "new",
  "struggling",
  "developing",
  "secure",
  "review-due"
]);
var trendSchema = z4.enum(["improving", "steady", "slipping", "unknown"]);
var bucketUnitSchema = z4.enum(["day", "week"]);
var errorKindSchema = z4.enum([
  "copied",
  "power-of-ten",
  "sign-dropped",
  "added-not-multiplied",
  "clock-format"
]);
var dailyTargetSchema = z4.object({
  kind: z4.enum(["questions", "minutes"]),
  value: z4.number().int()
});
var playStreakSchema = z4.object({
  days: z4.number().int(),
  /** A local day number, not a timestamp - see `src/lib/day.ts`. */
  lastDay: z4.number().int().nullable()
});
var targetAnswerSchema = z4.object({
  answeredAt: z4.number().int(),
  timeTakenMs: z4.number().int()
});
var pointSchema = z4.tuple([z4.number(), z4.number()]).readonly();
var markSchema = z4.discriminatedUnion("kind", [
  z4.object({
    kind: z4.literal("path"),
    points: z4.array(pointSchema).readonly(),
    closed: z4.boolean(),
    fill: z4.boolean(),
    dashed: z4.boolean()
  }),
  z4.object({
    kind: z4.literal("arc"),
    /** Screen coordinates, y down, where `fit` left it. */
    at: pointSchema,
    radius: z4.number(),
    /** The maths frame instead: degrees anticlockwise from east. */
    from: z4.number(),
    to: z4.number()
  }),
  z4.object({ kind: z4.literal("dot"), at: pointSchema }),
  z4.object({ kind: z4.literal("label"), at: pointSchema, text: z4.string() })
]);
var figureSchema = z4.object({
  width: z4.number(),
  height: z4.number(),
  marks: z4.array(markSchema).max(MAX_MARKS).readonly()
});
var accountSchema = z4.object({
  id: z4.string(),
  role: roleSchema.nullable(),
  parentId: z4.string().nullable(),
  name: z4.string().nullable(),
  avatar: avatarSchema.nullable(),
  image: z4.string().nullable(),
  photo: z4.string().nullable()
});
var childProfileSchema = z4.object({
  id: z4.string(),
  name: z4.string(),
  avatar: avatarSchema,
  photo: z4.string().nullable(),
  /** As stored - a caller resolves it against content, so it is not a YearLevel here. */
  level: z4.string().nullable(),
  target: dailyTargetSchema.nullable(),
  code: z4.string().nullable(),
  codeExpiresAt: z4.date().nullable()
});
var viewableChildSchema = childProfileSchema.extend({
  access: childAccessSchema,
  sharedBy: z4.string().nullable()
});
var playerStateSchema = z4.object({
  selectedLevel: z4.string().nullable(),
  streak: playStreakSchema,
  stars: z4.number().int(),
  target: dailyTargetSchema.nullable(),
  targetDay: z4.number().int().nullable()
});
var topicSkillSchema = z4.object({
  topic: z4.string(),
  level: yearLevelSchema,
  attempts: z4.number().int(),
  correct: z4.number().int(),
  /** Recency-weighted accuracy in [0, 1], so not an integer. */
  strength: z4.number(),
  streak: z4.number().int(),
  correctDays: z4.number().int(),
  lastCorrectDay: z4.number().int().nullable(),
  totalTimeMs: z4.number().int(),
  lastAnsweredAt: z4.number().int()
});
var learnerProfileSchema = z4.object({
  skills: z4.array(topicSkillSchema).readonly()
});
var playerReadSchema = z4.object({
  player: playerStateSchema,
  targetAnswers: z4.array(targetAnswerSchema)
});
var playStateSchema = playerReadSchema.extend({
  profile: learnerProfileSchema,
  recentTopics: z4.array(z4.string())
});
var observationSchema = z4.object({
  topic: z4.string(),
  level: yearLevelSchema,
  correct: z4.boolean(),
  /** Carried for the parent's report alone - nothing that folds a profile reads it. */
  templateId: z4.string().optional(),
  timeTakenMs: z4.number().int(),
  answeredAt: z4.number().int(),
  offsetMinutes: z4.number().int().optional()
});
var sittingSchema = z4.object({
  id: z4.string(),
  startedAt: z4.number().int(),
  level: yearLevelSchema,
  attempts: z4.number().int(),
  correct: z4.number().int(),
  timeMs: z4.number().int()
});
var answeredQuestionSchema = z4.object({
  topic: z4.string(),
  level: yearLevelSchema,
  prompt: z4.string(),
  expected: z4.string(),
  response: z4.string(),
  correct: z4.boolean(),
  answeredAt: z4.number().int(),
  /** Present exactly when the question the child answered carried one. */
  figure: figureSchema.optional()
});
var topicReportSchema = z4.object({
  topic: z4.string(),
  level: yearLevelSchema,
  status: skillStatusSchema,
  attempts: z4.number().int(),
  correct: z4.number().int(),
  /** A ratio in [0, 1], like `strength`. */
  accuracy: z4.number(),
  strength: z4.number(),
  streak: z4.number().int(),
  correctDays: z4.number().int(),
  averageTimeMs: z4.number().int(),
  lastAnsweredAt: z4.number().int(),
  reviewDueAt: z4.number().int(),
  trend: trendSchema
});
var progressBucketSchema = z4.object({
  start: z4.number().int(),
  unit: bucketUnitSchema,
  attempts: z4.number().int(),
  correct: z4.number().int(),
  /** Null for a bucket nobody answered in - a ratio needs a denominator. */
  accuracy: z4.number().nullable()
});
var headlineSchema = z4.object({
  minutes: z4.number().int(),
  questions: z4.number().int(),
  accuracy: z4.number().nullable(),
  minutesDelta: z4.number().int(),
  questionsDelta: z4.number().int(),
  accuracyDelta: z4.number().nullable()
});
var errorClusterSchema = z4.object({
  kind: errorKindSchema,
  count: z4.number().int(),
  topics: z4.array(z4.object({ topic: z4.string(), level: yearLevelSchema })),
  examples: z4.array(answeredQuestionSchema)
});
var reportSchema = z4.object({
  headline: headlineSchema,
  topics: z4.array(topicReportSchema),
  problems: z4.array(topicReportSchema),
  due: z4.array(topicReportSchema),
  strengths: z4.array(topicReportSchema),
  progress: z4.array(progressBucketSchema),
  clusters: z4.array(errorClusterSchema),
  sittings: z4.array(sittingSchema)
});
var pendingInviteSchema = z4.object({
  id: z4.string(),
  token: z4.string(),
  childIds: z4.array(z4.string()),
  createdAt: z4.date(),
  expiresAt: z4.date()
});
var sharedViewerSchema = z4.object({
  id: z4.string(),
  name: z4.string().nullable(),
  email: z4.string().nullable(),
  image: z4.string().nullable(),
  children: z4.array(z4.object({ id: z4.string(), name: z4.string() }))
});
var sharesSchema = z4.object({
  invites: z4.array(pendingInviteSchema),
  viewers: z4.array(sharedViewerSchema)
});
var inviteDetailsSchema = z4.object({
  ownerId: z4.string(),
  ownerName: z4.string().nullable(),
  children: z4.array(
    z4.object({
      id: z4.string(),
      name: z4.string(),
      avatar: avatarSchema,
      photo: z4.string().nullable(),
      level: z4.string().nullable()
    })
  ),
  expiresAt: z4.date(),
  /** False once it has been accepted or has run out of its week. */
  live: z4.boolean()
});
var acceptResultSchema = z4.discriminatedUnion("ok", [
  z4.object({ ok: z4.literal(true), children: z4.number().int() }),
  z4.object({ ok: z4.literal(false), reason: z4.enum(["unavailable", "own-link", "error"]) })
]);
var tableChoiceSchema = z4.union([
  z4.number().int(),
  z4.enum(["2-5", "6-9", "11-12", "all"])
]);
var modeSchema = z4.union([
  z4.object({
    op: z4.enum(["add", "subtract", "divide", "mixed"]),
    difficulty: z4.enum(["easy", "moderate", "hard"])
  }),
  z4.object({ op: z4.literal("multiply"), tables: tableChoiceSchema })
]);
var modeListingSchema = z4.union([
  z4.object({
    key: z4.string(),
    op: z4.enum(["add", "subtract", "divide", "mixed"]),
    difficulty: z4.enum(["easy", "moderate", "hard"])
  }),
  z4.object({ key: z4.string(), op: z4.literal("multiply"), tables: tableChoiceSchema })
]);
var standingChangeSchema = z4.object({
  place: z4.number().int(),
  /** Null when this run is the player's first appearance on the board. */
  previousPlace: z4.number().int().nullable(),
  rivals: z4.number().int()
});
var speedOutcomeSchema = z4.object({
  previousBest: z4.number().int().nullable(),
  best: z4.number().int(),
  isRecord: z4.boolean(),
  /** Null when the run moved nobody: no rivals, no change, or an unreadable household. */
  standing: standingChangeSchema.nullable()
});
var speedAttemptSchema = z4.object({
  mode: z4.string(),
  correct: z4.number().int(),
  playedAt: z4.date()
});
var summaryRunSchema = z4.object({
  mode: z4.string(),
  correct: z4.number().int(),
  playedAt: z4.date()
});
var familyRecordSchema = z4.object({
  playerId: z4.string(),
  playerName: z4.string(),
  playerPhoto: z4.string().nullable().optional(),
  playerAvatar: avatarSchema.nullable().optional(),
  playerImage: z4.string().nullable().optional(),
  mode: z4.string(),
  best: z4.number().int(),
  achievedAt: z4.date()
});
var speedRecordsSchema = z4.object({
  attempts: z4.array(speedAttemptSchema),
  family: z4.array(familyRecordSchema).nullable()
});
var childRecordSchema = z4.object({
  childId: z4.string(),
  childName: z4.string(),
  mode: z4.string(),
  best: z4.number().int(),
  achievedAt: z4.date()
});
var childHistorySchema = z4.object({
  observations: z4.array(observationSchema),
  sittings: z4.array(sittingSchema),
  answers: z4.array(answeredQuestionSchema).nullable(),
  recentAnswers: z4.array(targetAnswerSchema).nullable(),
  /** Null when they were not asked for, and when the read failed. */
  speedRuns: z4.array(summaryRunSchema).nullable()
});
var exprSchema = z4.string();
var varSpecSchema = z4.discriminatedUnion("kind", [
  z4.object({
    name: z4.string(),
    kind: z4.literal("int"),
    min: exprSchema,
    max: exprSchema,
    step: z4.number().optional()
  }),
  z4.object({
    name: z4.string(),
    kind: z4.literal("number"),
    min: exprSchema,
    max: exprSchema,
    decimals: z4.number().optional()
  }),
  z4.object({
    name: z4.string(),
    kind: z4.literal("pick"),
    from: z4.array(z4.union([z4.string(), z4.number()])).readonly(),
    weights: z4.array(z4.number()).readonly().optional()
  }),
  z4.object({ name: z4.string(), kind: z4.literal("expr"), expr: exprSchema })
]);
var choiceSpecSchema = z4.object({
  count: z4.number(),
  distractors: z4.array(exprSchema).readonly().optional(),
  jitter: z4.object({ min: exprSchema, max: exprSchema }).optional(),
  rankIsTheQuestion: z4.boolean().optional(),
  propertyIsTheQuestion: z4.boolean().optional()
});
var figureSpecSchema = z4.discriminatedUnion("kind", [
  z4.object({
    kind: z4.literal("polygon"),
    shape: exprSchema,
    rotation: exprSchema.optional(),
    mirror: exprSchema.optional(),
    rightAngles: exprSchema.optional()
  }),
  z4.object({
    kind: z4.literal("angle"),
    degrees: exprSchema,
    rotation: exprSchema.optional(),
    armLength: exprSchema.optional(),
    arc: exprSchema.optional()
  }),
  z4.object({
    kind: z4.literal("bar"),
    values: exprSchema,
    labels: exprSchema.optional(),
    style: exprSchema.optional(),
    scale: exprSchema.optional()
  }),
  z4.object({
    kind: z4.literal("pictograph"),
    counts: exprSchema,
    labels: exprSchema.optional(),
    key: exprSchema.optional(),
    halves: exprSchema.optional()
  }),
  z4.object({
    kind: z4.literal("spinner"),
    sectors: exprSchema,
    fills: exprSchema.optional(),
    rotation: exprSchema.optional()
  }),
  z4.object({
    kind: z4.literal("solid"),
    solid: exprSchema,
    view: exprSchema.optional(),
    rotation: exprSchema.optional()
  }),
  z4.object({
    kind: z4.literal("number-line"),
    at: exprSchema,
    from: exprSchema.optional(),
    to: exprSchema.optional(),
    step: exprSchema.optional(),
    minorTicks: exprSchema.optional()
  }),
  z4.object({
    kind: z4.literal("clock"),
    hour: exprSchema,
    minute: exprSchema,
    numerals: exprSchema.optional(),
    minuteTicks: exprSchema.optional()
  }),
  z4.object({
    kind: z4.literal("array"),
    rows: exprSchema,
    columns: exprSchema,
    orientation: exprSchema.optional()
  }),
  z4.object({
    kind: z4.literal("fraction-shape"),
    numerator: exprSchema,
    denominator: exprSchema,
    shape: exprSchema.optional(),
    rotation: exprSchema.optional()
  }),
  z4.object({
    kind: z4.literal("grid"),
    at: exprSchema,
    columns: exprSchema.optional(),
    rows: exprSchema.optional(),
    axisLabels: exprSchema.optional(),
    onLines: exprSchema.optional()
  }),
  z4.object({
    kind: z4.literal("timeline"),
    years: exprSchema,
    labels: exprSchema.optional(),
    from: exprSchema.optional(),
    to: exprSchema.optional(),
    step: exprSchema.optional()
  })
]);
var questionTemplateSchema = z4.object({
  id: z4.string(),
  subject: z4.string(),
  topic: z4.string(),
  level: yearLevelSchema,
  tags: z4.array(z4.string()).readonly().optional(),
  prompt: z4.string(),
  vars: z4.array(varSpecSchema).readonly(),
  constraints: z4.array(exprSchema).readonly().optional(),
  answer: exprSchema,
  answerType: z4.enum(["number", "text", "choice", "boolean"]).optional(),
  choices: choiceSpecSchema.optional(),
  hint: z4.string().optional(),
  figure: figureSpecSchema.optional()
});
var contentPackSchema = z4.object({
  version: z4.string(),
  subject: z4.string(),
  level: yearLevelSchema,
  templates: z4.array(questionTemplateSchema)
});
var contentManifestLevelSchema = z4.object({
  level: yearLevelSchema,
  topics: z4.array(z4.string()),
  templateCount: z4.number().int(),
  etag: z4.string()
});
var contentManifestSubjectSchema = z4.object({
  subject: z4.string(),
  levels: z4.array(contentManifestLevelSchema)
});
var contentManifestSchema = z4.object({
  version: z4.string(),
  subjects: z4.array(contentManifestSubjectSchema)
});

// src/schemas/register.ts
function registerComponents() {
  const schemas = Object.entries({ ...common_exports, ...account_exports, ...play_exports, ...dto_exports }).sort(
    ([a], [b]) => a < b ? -1 : a > b ? 1 : 0
  );
  for (const [name, value] of schemas) {
    if (!name.endsWith("Schema")) continue;
    if (!(value instanceof z5.ZodType)) continue;
    const id = name.slice(0, -"Schema".length);
    z5.globalRegistry.add(value, { id: id[0].toUpperCase() + id.slice(1) });
  }
}

// src/auth/plugin.ts
import fp from "fastify-plugin";

// src/generated/prisma/client.ts
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// src/generated/prisma/internal/class.ts
import * as runtime from "@prisma/client/runtime/client";
var config = {
  "previewFeatures": [],
  "clientVersion": "7.10.0",
  "engineVersion": "0edf323efd1d98336f3f0a68684b56f689b900d3",
  "activeProvider": "postgresql",
  "inlineSchema": '// LearnR data model.\n//\n// Two halves: the Auth.js tables (User/Account/Session), and the learning record\n// (LearningSession/Attempt/TopicSkill). Attempts are the history - every answer,\n// as given. TopicSkill is that history folded forward into what the child can do\n// now: the reinforcement selector reads it to decide what to ask next, and the\n// parents\' report is written from it. It is a cache of the attempts, never a\n// second truth - `buildProfile` over the Attempt rows reproduces it exactly.\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../src/generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\nmodel User {\n  id            String    @id @default(cuid())\n  name          String?\n  email         String?   @unique\n  emailVerified DateTime?\n  image         String?\n  createdAt     DateTime  @default(now())\n  /// The year the home screen reopens on. Australian school year: "K" or "1" through "6".\n  selectedLevel String?\n\n  /// Chosen once at first sign-in and then permanent: "parent" or "child". Null\n  /// means the choice hasn\'t been made yet, which is what routes to the chooser -\n  /// including for every account that already existed before this column did.\n  role String?\n\n  /// Set only on a child profile a parent created. Null on every account that\n  /// signed in with Google itself, parent or child. This is what tells the home\n  /// screen the level is the parent\'s to set, not the child\'s.\n  parentId String?\n  parent   User?   @relation("ChildProfiles", fields: [parentId], references: [id], onDelete: Cascade)\n  children User[]  @relation("ChildProfiles")\n\n  /// Preset icon id, e.g. "fox". A managed child has no Google account and so no\n  /// `image`; this is what stands in for one.\n  avatar String?\n\n  /// The code a parent hands to a child, and when it stops working. Both null when\n  /// there is no live code - redeeming clears them, so a code is spent at use\n  /// rather than left to run down its hour. Only ever set on a managed child.\n  loginCode          String?   @unique\n  loginCodeExpiresAt DateTime?\n\n  /// Days in a row with at least one answer on them. Reward only - nothing about\n  /// what to ask next reads it.\n  playStreak    Int  @default(0)\n  /// The last local day counted towards the streak, as a day number rather than a\n  /// timestamp: the streak is counted in the child\'s days, and a timestamp would\n  /// need the offset re-applied at every read to mean anything. Null until they play.\n  playStreakDay Int?\n\n  /// The daily target a parent set on this child: "questions" or "minutes", and\n  /// how many. Both null when there is no target, which is where every child\n  /// starts - a target is optional and is a thing a parent chooses.\n  targetKind  String?\n  targetValue Int?\n\n  /// The last local day the target\'s stars were banked, as a day number rather\n  /// than a timestamp - a day here is the child\'s, and a timestamp would need\n  /// the offset re-applied at every read. Null until they first hit a target.\n  /// This column is the compare-and-set that makes the award happen once a day\n  /// however many times it is asked for.\n  targetDay Int?\n\n  /// Every star this child has, from finished rounds and from days they hit\n  /// their target. Only ever incremented, never recounted: a target is mutable,\n  /// so recounting a past day against today\'s setting would take stars off a\n  /// child who earned them. What replaces the old recount\'s safety is a guard\n  /// per event - `LearningSession.roundsBanked` for a round, `targetDay` above\n  /// for a day - so an award can still only ever be paid once.\n  stars Int @default(0)\n\n  /// The photograph a parent cropped for this child, if they set one. A row of\n  /// its own rather than a column, because the Auth.js adapter reads whole `User`\n  /// rows on every authenticated request and a photo has no business riding\n  /// along with a session lookup. The preset `avatar` above is still what stands\n  /// in when there is no photo - it is the fallback, not the thing replaced.\n  photo ChildPhoto?\n\n  accounts         Account[]\n  sessions         Session[]\n  learningSessions LearningSession[]\n  topicSkills      TopicSkill[]\n  speedRecords     SpeedRecord[]\n  speedAttempts    SpeedAttempt[]\n\n  /// Sharing, from all four sides: invites this parent has sent, an invite they\n  /// accepted, grants over this child, and grants to this viewer. Ownership is\n  /// still `parentId` alone - none of these ever make someone a parent.\n  invitesSent     ShareInvite[] @relation("InvitesSent")\n  invitesAccepted ShareInvite[] @relation("InvitesAccepted")\n  sharedOut       ChildShare[]  @relation("SharedChild")\n  sharedIn        ChildShare[]  @relation("ChildViewer")\n\n  /// The parent dashboard\'s only read: this parent\'s children.\n  @@index([parentId])\n}\n\n/// One child\'s cropped profile picture, as a square WebP data URL.\n///\n/// The bytes never leave the browser as a file: the cropper decodes whatever\n/// picture was chosen, draws the circle\'s square into a 256px canvas and encodes\n/// that, so what is stored is about 20KB whatever the camera produced. `parsePhoto`\n/// is the boundary - nothing but a `data:image/webp;base64,` string under\n/// `MAX_PHOTO_BYTES` is ever written, so this column can never become a way to\n/// make the app fetch a URL somebody else chose.\nmodel ChildPhoto {\n  childId   String   @id\n  child     User     @relation(fields: [childId], references: [id], onDelete: Cascade)\n  dataUrl   String\n  updatedAt DateTime @updatedAt\n}\n\nmodel Account {\n  id                String  @id @default(cuid())\n  userId            String\n  type              String\n  provider          String\n  providerAccountId String\n  refresh_token     String? @db.Text\n  access_token      String? @db.Text\n  expires_at        Int?\n  token_type        String?\n  scope             String?\n  id_token          String? @db.Text\n  session_state     String?\n\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@unique([provider, providerAccountId])\n  @@index([userId])\n}\n\nmodel Session {\n  id           String   @id @default(cuid())\n  sessionToken String   @unique\n  userId       String\n  expires      DateTime\n\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@index([userId])\n}\n\nmodel VerificationToken {\n  identifier String\n  token      String   @unique\n  expires    DateTime\n\n  @@unique([identifier, token])\n}\n\n/// One sitting: a child picks a subject + level and answers until they stop.\n/// There is no end condition, so `endedAt` is set on an explicit finish only.\nmodel LearningSession {\n  id           String    @id @default(cuid())\n  userId       String\n  subject      String\n  /// Australian school year: "K" or "1" through "6".\n  level        String\n  /// RNG seed, so a session\'s exact question sequence can be replayed.\n  seed         String\n  startedAt    DateTime  @default(now())\n  endedAt      DateTime?\n  /// How many closed rounds of this sitting have been paid for. The guard that\n  /// lets `User.stars` be incremented rather than recounted: banking reads this\n  /// under a row lock, pays for the rounds past it, and moves it up. It is a\n  /// count of events, not a cache of anything.\n  roundsBanked Int       @default(0)\n\n  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)\n  attempts Attempt[]\n\n  @@index([userId, startedAt])\n  /// History is always read for one child and one subject, so this is the side the\n  /// planner should drive from: narrow to their sessions here, then walk the\n  /// attempts of each in `answeredAt` order. Attempt carries no userId of its own.\n  @@index([userId, subject, level])\n}\n\n/// What a child can do on one topic at one year level, folded forward from their\n/// attempts one answer at a time. Read at the start of a session to weight the\n/// questions, and by the parents\' report.\nmodel TopicSkill {\n  id      String @id @default(cuid())\n  userId  String\n  subject String\n  /// What the questions practise, e.g. "counting numbers".\n  topic   String\n  /// Australian school year: "K" or "1" through "6".\n  level   String\n\n  attempts       Int   @default(0)\n  correct        Int   @default(0)\n  /// Recency-weighted accuracy in [0, 1] - what the child can do now, not on average.\n  strength       Float @default(0)\n  /// Correct answers in a row. A run, not a single right answer, is what mastery looks like.\n  streak         Int   @default(0)\n  /// Distinct local days with at least one right answer. A run inside one sitting is\n  /// short-term memory; the same topic known again a day later is what mastery is.\n  correctDays    Int   @default(0)\n  /// The last day counted towards `correctDays`, so folding forward can tell a new day apart.\n  lastCorrectDay Int?\n\n  totalTimeMs    Int      @default(0)\n  lastAnsweredAt DateTime\n  updatedAt      DateTime @updatedAt\n\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  /// One row per child, subject, topic and year - and the lookup the session start does.\n  @@unique([userId, subject, topic, level])\n}\n\n/// One answered question, as it was answered. The history everything else is\n/// derived from, and the only row a replay or a rebuild needs.\nmodel Attempt {\n  /// Client-supplied, so a retried offline flush writes each answer exactly\n  /// once. A server default would make every replay a new row, and the child\'s\n  /// TopicSkill would count their answers twice.\n  id                String   @id\n  learningSessionId String\n  templateId        String\n  subject           String\n  /// What the question practises, e.g. "counting numbers". Shared across years.\n  topic             String\n  /// Australian school year: "K" or "1" through "6".\n  level             String\n  prompt            String\n  expected          String\n  response          String\n  correct           Boolean\n  /// Capped by the session engine - an abandoned question is not a measurement.\n  timeTakenMs       Int\n  answeredAt        DateTime @default(now())\n  /// Minutes east of UTC when it was answered. Stored so rebuilding a profile from\n  /// history puts each answer on the same day the live fold did.\n  offsetMinutes     Int      @default(0)\n  /// The resolved figure the child actually saw, for a question with one - not\n  /// the template\'s parameters, so a template edited next month cannot change\n  /// what a parent is shown about last week. `null` for the ordinary question\n  /// with nothing to draw; read back through `parseFigure`, which trusts no\n  /// stored row further than it can validate.\n  figure            Json?\n\n  learningSession LearningSession @relation(fields: [learningSessionId], references: [id], onDelete: Cascade)\n\n  /// "This session\'s answers, newest first" - the shape both history reads take once\n  /// the planner has narrowed to a child\'s sessions. Covers the plain FK lookup too.\n  @@index([learningSessionId, answeredAt])\n}\n\n/// The best a player has done at one speed-run mode.\n///\n/// Only the best is kept: a run that does not beat it leaves no trace, so there\n/// is no history of every run and no graph of improvement over time. That is the\n/// cost of one row per mode, and it is written down here rather than discovered\n/// later.\n///\n/// This is the one award in the app that needs no row lock. `User.stars` is\n/// incremented, so a repeated or raced call would pay twice - hence\n/// `roundsBanked` under `SELECT ... FOR UPDATE` and the compare-and-set on\n/// `targetDay`. A record is a *maximum*, and a maximum is idempotent: two runs\n/// landing at once produce the same row whichever order they arrive in.\nmodel SpeedRecord {\n  id     String @id @default(cuid())\n  userId String\n  /// The mode\'s canonical key, e.g. "multiply.7". Parsed by `parseMode`.\n  mode   String\n\n  /// Most correct answers in a single run of this mode.\n  best Int\n\n  achievedAt DateTime @default(now())\n\n  /// Whether this player\'s parent has seen the banner for it. True on creation,\n  /// because a first run is not a record and announces nothing; set false only\n  /// when a previous best is genuinely beaten.\n  seen Boolean @default(true)\n\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@unique([userId, mode])\n  /// Redundant against the unique constraint above, which already indexes\n  /// `userId` as its leading column - not worth a migration to drop. It does\n  /// not serve `readUnseenRecords`: that filters on `seen` and `user.parentId`\n  /// with no `userId` in the WHERE at all, so a parent\'s banner scans on\n  /// those, never on this.\n  @@index([userId])\n}\n\n/// One finished speed run, kept whether or not it beat anything.\n///\n/// `SpeedRecord` above is the maximum and stays the maximum - it is what the\n/// leaderboard ranks, what the banner announces and what the guarded update\n/// makes idempotent. This is the history behind it, and it exists because a\n/// single best cannot say whether a score was a fluke or a floor: the cabinet\n/// shows a player their top five runs at a mode, and there is nothing to show\n/// unless every run is written down.\n///\n/// It needs no lock and no guard of any kind: an insert is not a maximum and\n/// not a counter, so a retry writes a second row rather than paying twice, and\n/// two runs landing at once are simply two runs.\nmodel SpeedAttempt {\n  /// Client-supplied, for the reason `Attempt.id` is: a retried offline flush\n  /// writes the run exactly once. A server default would make every replay a\n  /// new row, and the cabinet would list one run twice while the report\'s\n  /// "latest run" and its change measured themselves off the duplicate.\n  id     String @id\n  userId String\n  /// The mode\'s canonical key, e.g. "multiply.7". Parsed by `parseMode`.\n  mode   String\n\n  /// How many were got right, which is how many were answered: a speed run only\n  /// moves on a correct answer, so the two were always going to be one number.\n  correct Int\n\n  /// When the run was *played*, which is not when it was received: an offline\n  /// queue flushes whenever connectivity returns, and this orders the cabinet,\n  /// the report table and the family board and tie-breaks the star. The client\n  /// sends it, bounded by `parsePlayedAt` on the way in. The default is the\n  /// fallback for a client that sends none, which is what every client did\n  /// before the field existed.\n  playedAt DateTime @default(now())\n\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  /// What the cabinet reads: one player\'s runs at one mode, best first. The\n  /// ranking is done in the database (`readSpeedAttempts`), so the index is\n  /// the ordering the window function uses.\n  @@index([userId, mode, correct(sort: Desc), playedAt])\n}\n\n/// A link one parent sends another grown-up so they can watch a child\'s progress.\n///\n/// The link is the short-lived half of sharing and the grant below is the lasting\n/// half - the same split as a child\'s login code and the session it buys. An\n/// invite is good for a week and is spent at acceptance (`acceptedAt`), so one\n/// link admits exactly one person however many times it is forwarded.\n///\n/// `childIds` is a plain array rather than a join table because it is a *record\n/// of what was offered*, not a live set: it is written once and read once, at\n/// acceptance, and every id in it is checked against the issuer\'s children then.\n/// A child removed in the meantime simply isn\'t granted - which is why the array\n/// having no foreign keys is the honest shape rather than a missing constraint.\nmodel ShareInvite {\n  id       String   @id @default(cuid())\n  /// What the URL carries. Long and unguessable, since nobody types it.\n  token    String   @unique\n  ownerId  String\n  /// The children this link offers, as chosen when it was created.\n  childIds String[]\n\n  createdAt    DateTime  @default(now())\n  expiresAt    DateTime\n  /// When it was spent, and by whom. Null on a link nobody has opened yet - and\n  /// the column the accepting statement matches on, so two taps cannot both win.\n  acceptedAt   DateTime?\n  acceptedById String?\n\n  owner      User  @relation("InvitesSent", fields: [ownerId], references: [id], onDelete: Cascade)\n  acceptedBy User? @relation("InvitesAccepted", fields: [acceptedById], references: [id], onDelete: SetNull)\n\n  /// "The links I have sent", newest first - the sharing panel\'s only read.\n  @@index([ownerId, createdAt])\n}\n\n/// One grown-up may read one child\'s progress. The standing grant an accepted\n/// invite leaves behind, and the row revoking deletes.\n///\n/// It carries no `ownerId`: who owns the child is `User.parentId`, and copying it\n/// here would be a second truth to keep in step. Scoping a revoke to the parent\n/// asking is a filter through the child (`child: { parentId }`), which cannot\n/// drift from ownership because it *is* ownership.\n///\n/// A grant is read-only by construction rather than by a flag: nothing in\n/// `accounts.ts` matches on anything but `parentId`, so no query that edits a\n/// child can be reached through one of these rows.\nmodel ChildShare {\n  id       String @id @default(cuid())\n  childId  String\n  viewerId String\n\n  createdAt DateTime @default(now())\n\n  child  User @relation("SharedChild", fields: [childId], references: [id], onDelete: Cascade)\n  viewer User @relation("ChildViewer", fields: [viewerId], references: [id], onDelete: Cascade)\n\n  /// Sharing the same child with the same person twice is one grant.\n  @@unique([childId, viewerId])\n  /// "The children shared with me", which every screen a viewer sees starts from.\n  @@index([viewerId])\n}\n',
  "runtimeDataModel": {
    "models": {},
    "enums": {},
    "types": {}
  },
  "parameterizationSchema": {
    "strings": [],
    "graph": ""
  }
};
config.runtimeDataModel = JSON.parse('{"models":{"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"emailVerified","kind":"scalar","type":"DateTime"},{"name":"image","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"selectedLevel","kind":"scalar","type":"String"},{"name":"role","kind":"scalar","type":"String"},{"name":"parentId","kind":"scalar","type":"String"},{"name":"parent","kind":"object","type":"User","relationName":"ChildProfiles"},{"name":"children","kind":"object","type":"User","relationName":"ChildProfiles"},{"name":"avatar","kind":"scalar","type":"String"},{"name":"loginCode","kind":"scalar","type":"String"},{"name":"loginCodeExpiresAt","kind":"scalar","type":"DateTime"},{"name":"playStreak","kind":"scalar","type":"Int"},{"name":"playStreakDay","kind":"scalar","type":"Int"},{"name":"targetKind","kind":"scalar","type":"String"},{"name":"targetValue","kind":"scalar","type":"Int"},{"name":"targetDay","kind":"scalar","type":"Int"},{"name":"stars","kind":"scalar","type":"Int"},{"name":"photo","kind":"object","type":"ChildPhoto","relationName":"ChildPhotoToUser"},{"name":"accounts","kind":"object","type":"Account","relationName":"AccountToUser"},{"name":"sessions","kind":"object","type":"Session","relationName":"SessionToUser"},{"name":"learningSessions","kind":"object","type":"LearningSession","relationName":"LearningSessionToUser"},{"name":"topicSkills","kind":"object","type":"TopicSkill","relationName":"TopicSkillToUser"},{"name":"speedRecords","kind":"object","type":"SpeedRecord","relationName":"SpeedRecordToUser"},{"name":"speedAttempts","kind":"object","type":"SpeedAttempt","relationName":"SpeedAttemptToUser"},{"name":"invitesSent","kind":"object","type":"ShareInvite","relationName":"InvitesSent"},{"name":"invitesAccepted","kind":"object","type":"ShareInvite","relationName":"InvitesAccepted"},{"name":"sharedOut","kind":"object","type":"ChildShare","relationName":"SharedChild"},{"name":"sharedIn","kind":"object","type":"ChildShare","relationName":"ChildViewer"}],"dbName":null,"schema":null},"ChildPhoto":{"fields":[{"name":"childId","kind":"scalar","type":"String"},{"name":"child","kind":"object","type":"User","relationName":"ChildPhotoToUser"},{"name":"dataUrl","kind":"scalar","type":"String"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":null,"schema":null},"Account":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"type","kind":"scalar","type":"String"},{"name":"provider","kind":"scalar","type":"String"},{"name":"providerAccountId","kind":"scalar","type":"String"},{"name":"refresh_token","kind":"scalar","type":"String"},{"name":"access_token","kind":"scalar","type":"String"},{"name":"expires_at","kind":"scalar","type":"Int"},{"name":"token_type","kind":"scalar","type":"String"},{"name":"scope","kind":"scalar","type":"String"},{"name":"id_token","kind":"scalar","type":"String"},{"name":"session_state","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"AccountToUser"}],"dbName":null,"schema":null},"Session":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"sessionToken","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"expires","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"SessionToUser"}],"dbName":null,"schema":null},"VerificationToken":{"fields":[{"name":"identifier","kind":"scalar","type":"String"},{"name":"token","kind":"scalar","type":"String"},{"name":"expires","kind":"scalar","type":"DateTime"}],"dbName":null,"schema":null},"LearningSession":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"level","kind":"scalar","type":"String"},{"name":"seed","kind":"scalar","type":"String"},{"name":"startedAt","kind":"scalar","type":"DateTime"},{"name":"endedAt","kind":"scalar","type":"DateTime"},{"name":"roundsBanked","kind":"scalar","type":"Int"},{"name":"user","kind":"object","type":"User","relationName":"LearningSessionToUser"},{"name":"attempts","kind":"object","type":"Attempt","relationName":"AttemptToLearningSession"}],"dbName":null,"schema":null},"TopicSkill":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"topic","kind":"scalar","type":"String"},{"name":"level","kind":"scalar","type":"String"},{"name":"attempts","kind":"scalar","type":"Int"},{"name":"correct","kind":"scalar","type":"Int"},{"name":"strength","kind":"scalar","type":"Float"},{"name":"streak","kind":"scalar","type":"Int"},{"name":"correctDays","kind":"scalar","type":"Int"},{"name":"lastCorrectDay","kind":"scalar","type":"Int"},{"name":"totalTimeMs","kind":"scalar","type":"Int"},{"name":"lastAnsweredAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"TopicSkillToUser"}],"dbName":null,"schema":null},"Attempt":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"learningSessionId","kind":"scalar","type":"String"},{"name":"templateId","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"topic","kind":"scalar","type":"String"},{"name":"level","kind":"scalar","type":"String"},{"name":"prompt","kind":"scalar","type":"String"},{"name":"expected","kind":"scalar","type":"String"},{"name":"response","kind":"scalar","type":"String"},{"name":"correct","kind":"scalar","type":"Boolean"},{"name":"timeTakenMs","kind":"scalar","type":"Int"},{"name":"answeredAt","kind":"scalar","type":"DateTime"},{"name":"offsetMinutes","kind":"scalar","type":"Int"},{"name":"figure","kind":"scalar","type":"Json"},{"name":"learningSession","kind":"object","type":"LearningSession","relationName":"AttemptToLearningSession"}],"dbName":null,"schema":null},"SpeedRecord":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"mode","kind":"scalar","type":"String"},{"name":"best","kind":"scalar","type":"Int"},{"name":"achievedAt","kind":"scalar","type":"DateTime"},{"name":"seen","kind":"scalar","type":"Boolean"},{"name":"user","kind":"object","type":"User","relationName":"SpeedRecordToUser"}],"dbName":null,"schema":null},"SpeedAttempt":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"mode","kind":"scalar","type":"String"},{"name":"correct","kind":"scalar","type":"Int"},{"name":"playedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"SpeedAttemptToUser"}],"dbName":null,"schema":null},"ShareInvite":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"token","kind":"scalar","type":"String"},{"name":"ownerId","kind":"scalar","type":"String"},{"name":"childIds","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"acceptedAt","kind":"scalar","type":"DateTime"},{"name":"acceptedById","kind":"scalar","type":"String"},{"name":"owner","kind":"object","type":"User","relationName":"InvitesSent"},{"name":"acceptedBy","kind":"object","type":"User","relationName":"InvitesAccepted"}],"dbName":null,"schema":null},"ChildShare":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"childId","kind":"scalar","type":"String"},{"name":"viewerId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"child","kind":"object","type":"User","relationName":"SharedChild"},{"name":"viewer","kind":"object","type":"User","relationName":"ChildViewer"}],"dbName":null,"schema":null}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","parent","orderBy","cursor","children","child","photo","user","accounts","sessions","learningSession","attempts","_count","learningSessions","topicSkills","speedRecords","speedAttempts","owner","acceptedBy","invitesSent","invitesAccepted","viewer","sharedOut","sharedIn","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","data","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","create","update","User.upsertOne","User.deleteOne","User.deleteMany","having","_avg","_sum","_min","_max","User.groupBy","User.aggregate","ChildPhoto.findUnique","ChildPhoto.findUniqueOrThrow","ChildPhoto.findFirst","ChildPhoto.findFirstOrThrow","ChildPhoto.findMany","ChildPhoto.createOne","ChildPhoto.createMany","ChildPhoto.createManyAndReturn","ChildPhoto.updateOne","ChildPhoto.updateMany","ChildPhoto.updateManyAndReturn","ChildPhoto.upsertOne","ChildPhoto.deleteOne","ChildPhoto.deleteMany","ChildPhoto.groupBy","ChildPhoto.aggregate","Account.findUnique","Account.findUniqueOrThrow","Account.findFirst","Account.findFirstOrThrow","Account.findMany","Account.createOne","Account.createMany","Account.createManyAndReturn","Account.updateOne","Account.updateMany","Account.updateManyAndReturn","Account.upsertOne","Account.deleteOne","Account.deleteMany","Account.groupBy","Account.aggregate","Session.findUnique","Session.findUniqueOrThrow","Session.findFirst","Session.findFirstOrThrow","Session.findMany","Session.createOne","Session.createMany","Session.createManyAndReturn","Session.updateOne","Session.updateMany","Session.updateManyAndReturn","Session.upsertOne","Session.deleteOne","Session.deleteMany","Session.groupBy","Session.aggregate","VerificationToken.findUnique","VerificationToken.findUniqueOrThrow","VerificationToken.findFirst","VerificationToken.findFirstOrThrow","VerificationToken.findMany","VerificationToken.createOne","VerificationToken.createMany","VerificationToken.createManyAndReturn","VerificationToken.updateOne","VerificationToken.updateMany","VerificationToken.updateManyAndReturn","VerificationToken.upsertOne","VerificationToken.deleteOne","VerificationToken.deleteMany","VerificationToken.groupBy","VerificationToken.aggregate","LearningSession.findUnique","LearningSession.findUniqueOrThrow","LearningSession.findFirst","LearningSession.findFirstOrThrow","LearningSession.findMany","LearningSession.createOne","LearningSession.createMany","LearningSession.createManyAndReturn","LearningSession.updateOne","LearningSession.updateMany","LearningSession.updateManyAndReturn","LearningSession.upsertOne","LearningSession.deleteOne","LearningSession.deleteMany","LearningSession.groupBy","LearningSession.aggregate","TopicSkill.findUnique","TopicSkill.findUniqueOrThrow","TopicSkill.findFirst","TopicSkill.findFirstOrThrow","TopicSkill.findMany","TopicSkill.createOne","TopicSkill.createMany","TopicSkill.createManyAndReturn","TopicSkill.updateOne","TopicSkill.updateMany","TopicSkill.updateManyAndReturn","TopicSkill.upsertOne","TopicSkill.deleteOne","TopicSkill.deleteMany","TopicSkill.groupBy","TopicSkill.aggregate","Attempt.findUnique","Attempt.findUniqueOrThrow","Attempt.findFirst","Attempt.findFirstOrThrow","Attempt.findMany","Attempt.createOne","Attempt.createMany","Attempt.createManyAndReturn","Attempt.updateOne","Attempt.updateMany","Attempt.updateManyAndReturn","Attempt.upsertOne","Attempt.deleteOne","Attempt.deleteMany","Attempt.groupBy","Attempt.aggregate","SpeedRecord.findUnique","SpeedRecord.findUniqueOrThrow","SpeedRecord.findFirst","SpeedRecord.findFirstOrThrow","SpeedRecord.findMany","SpeedRecord.createOne","SpeedRecord.createMany","SpeedRecord.createManyAndReturn","SpeedRecord.updateOne","SpeedRecord.updateMany","SpeedRecord.updateManyAndReturn","SpeedRecord.upsertOne","SpeedRecord.deleteOne","SpeedRecord.deleteMany","SpeedRecord.groupBy","SpeedRecord.aggregate","SpeedAttempt.findUnique","SpeedAttempt.findUniqueOrThrow","SpeedAttempt.findFirst","SpeedAttempt.findFirstOrThrow","SpeedAttempt.findMany","SpeedAttempt.createOne","SpeedAttempt.createMany","SpeedAttempt.createManyAndReturn","SpeedAttempt.updateOne","SpeedAttempt.updateMany","SpeedAttempt.updateManyAndReturn","SpeedAttempt.upsertOne","SpeedAttempt.deleteOne","SpeedAttempt.deleteMany","SpeedAttempt.groupBy","SpeedAttempt.aggregate","ShareInvite.findUnique","ShareInvite.findUniqueOrThrow","ShareInvite.findFirst","ShareInvite.findFirstOrThrow","ShareInvite.findMany","ShareInvite.createOne","ShareInvite.createMany","ShareInvite.createManyAndReturn","ShareInvite.updateOne","ShareInvite.updateMany","ShareInvite.updateManyAndReturn","ShareInvite.upsertOne","ShareInvite.deleteOne","ShareInvite.deleteMany","ShareInvite.groupBy","ShareInvite.aggregate","ChildShare.findUnique","ChildShare.findUniqueOrThrow","ChildShare.findFirst","ChildShare.findFirstOrThrow","ChildShare.findMany","ChildShare.createOne","ChildShare.createMany","ChildShare.createManyAndReturn","ChildShare.updateOne","ChildShare.updateMany","ChildShare.updateManyAndReturn","ChildShare.upsertOne","ChildShare.deleteOne","ChildShare.deleteMany","ChildShare.groupBy","ChildShare.aggregate","AND","OR","NOT","id","childId","viewerId","createdAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","token","ownerId","childIds","expiresAt","acceptedAt","acceptedById","has","hasEvery","hasSome","userId","mode","correct","playedAt","best","achievedAt","seen","learningSessionId","templateId","subject","topic","level","prompt","expected","response","timeTakenMs","answeredAt","offsetMinutes","figure","string_contains","string_starts_with","string_ends_with","array_starts_with","array_ends_with","array_contains","strength","streak","correctDays","lastCorrectDay","totalTimeMs","lastAnsweredAt","updatedAt","seed","startedAt","endedAt","roundsBanked","identifier","expires","identifier_token","sessionToken","type","provider","providerAccountId","refresh_token","access_token","expires_at","token_type","scope","id_token","session_state","dataUrl","name","email","emailVerified","image","selectedLevel","role","parentId","avatar","loginCode","loginCodeExpiresAt","playStreak","playStreakDay","targetKind","targetValue","targetDay","stars","childId_viewerId","userId_mode","userId_subject_topic_level","every","some","none","provider_providerAccountId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","increment","decrement","multiply","divide","push"]'),
  graph: "9QVxwAEiAQAA_wIAIAQAAJIDACAGAACTAwAgCAAAlAMAIAkAAJUDACANAACWAwAgDgAAlwMAIA8AAJgDACAQAACZAwAgEwAAmgMAIBQAAJoDACAWAACbAwAgFwAAmwMAIOABAACRAwAw4QEAAAMAEOIBAACRAwAw4wEBAAAAAeYBQADyAgAhrgIBAP4CACGvAgEAAAABsAJAAP0CACGxAgEA_gIAIbICAQD-AgAhswIBAP4CACG0AgEA_gIAIbUCAQD-AgAhtgIBAAAAAbcCQAD9AgAhuAICAIEDACG5AgIAiAMAIboCAQD-AgAhuwICAIgDACG8AgIAiAMAIb0CAgCBAwAhAQAAAAEAICIBAAD_AgAgBAAAkgMAIAYAAJMDACAIAACUAwAgCQAAlQMAIA0AAJYDACAOAACXAwAgDwAAmAMAIBAAAJkDACATAACaAwAgFAAAmgMAIBYAAJsDACAXAACbAwAg4AEAAJEDADDhAQAAAwAQ4gEAAJEDADDjAQEA8QIAIeYBQADyAgAhrgIBAP4CACGvAgEA_gIAIbACQAD9AgAhsQIBAP4CACGyAgEA_gIAIbMCAQD-AgAhtAIBAP4CACG1AgEA_gIAIbYCAQD-AgAhtwJAAP0CACG4AgIAgQMAIbkCAgCIAwAhugIBAP4CACG7AgIAiAMAIbwCAgCIAwAhvQICAIEDACEBAAAAAwAgGwEAAPoDACAEAACfBQAgBgAAoAUAIAgAAKEFACAJAACiBQAgDQAAowUAIA4AAKQFACAPAAClBQAgEAAApgUAIBMAAKcFACAUAACnBQAgFgAAqAUAIBcAAKgFACCuAgAApQMAIK8CAAClAwAgsAIAAKUDACCxAgAApQMAILICAAClAwAgswIAAKUDACC0AgAApQMAILUCAAClAwAgtgIAAKUDACC3AgAApQMAILkCAAClAwAgugIAAKUDACC7AgAApQMAILwCAAClAwAgAwAAAAMAIAIAAAUAMAMAAAEAIAcFAAD4AgAg4AEAAPcCADDhAQAABwAQ4gEAAPcCADDkAQEA8QIAIZoCQADyAgAhrQIBAPECACEBAAAABwAgEAcAAPgCACDgAQAAkAMAMOEBAAAJABDiAQAAkAMAMOMBAQDxAgAh-wEBAPECACGjAgEA8QIAIaQCAQDxAgAhpQIBAPECACGmAgEA_gIAIacCAQD-AgAhqAICAIgDACGpAgEA_gIAIaoCAQD-AgAhqwIBAP4CACGsAgEA_gIAIQgHAAD6AwAgpgIAAKUDACCnAgAApQMAIKgCAAClAwAgqQIAAKUDACCqAgAApQMAIKsCAAClAwAgrAIAAKUDACARBwAA-AIAIOABAACQAwAw4QEAAAkAEOIBAACQAwAw4wEBAAAAAfsBAQDxAgAhowIBAPECACGkAgEA8QIAIaUCAQDxAgAhpgIBAP4CACGnAgEA_gIAIagCAgCIAwAhqQIBAP4CACGqAgEA_gIAIasCAQD-AgAhrAIBAP4CACHEAgAAjwMAIAMAAAAJACACAAAKADADAAALACAIBwAA-AIAIOABAACOAwAw4QEAAA0AEOIBAACOAwAw4wEBAPECACH7AQEA8QIAIaACQADyAgAhogIBAPECACEBBwAA-gMAIAgHAAD4AgAg4AEAAI4DADDhAQAADQAQ4gEAAI4DADDjAQEAAAAB-wEBAPECACGgAkAA8gIAIaICAQAAAAEDAAAADQAgAgAADgAwAwAADwAgDQcAAPgCACALAACNAwAg4AEAAIwDADDhAQAAEQAQ4gEAAIwDADDjAQEA8QIAIfsBAQDxAgAhhAIBAPECACGGAgEA8QIAIZsCAQDxAgAhnAJAAPICACGdAkAA_QIAIZ4CAgCBAwAhAwcAAPoDACALAACeBQAgnQIAAKUDACANBwAA-AIAIAsAAI0DACDgAQAAjAMAMOEBAAARABDiAQAAjAMAMOMBAQAAAAH7AQEA8QIAIYQCAQDxAgAhhgIBAPECACGbAgEA8QIAIZwCQADyAgAhnQJAAP0CACGeAgIAgQMAIQMAAAARACACAAASADADAAATACASCgAAiwMAIOABAACJAwAw4QEAABUAEOIBAACJAwAw4wEBAPECACH9ASAAhAMAIYICAQDxAgAhgwIBAPECACGEAgEA8QIAIYUCAQDxAgAhhgIBAPECACGHAgEA8QIAIYgCAQDxAgAhiQIBAPECACGKAgIAgQMAIYsCQADyAgAhjAICAIEDACGNAgAAigMAIAIKAACdBQAgjQIAAKUDACASCgAAiwMAIOABAACJAwAw4QEAABUAEOIBAACJAwAw4wEBAAAAAf0BIACEAwAhggIBAPECACGDAgEA8QIAIYQCAQDxAgAhhQIBAPECACGGAgEA8QIAIYcCAQDxAgAhiAIBAPECACGJAgEA8QIAIYoCAgCBAwAhiwJAAPICACGMAgIAgQMAIY0CAACKAwAgAwAAABUAIAIAABYAMAMAABcAIAEAAAAVACASBwAA-AIAIAsCAIEDACHgAQAAhgMAMOEBAAAaABDiAQAAhgMAMOMBAQDxAgAh-wEBAPECACH9AQIAgQMAIYQCAQDxAgAhhQIBAPECACGGAgEA8QIAIZQCCACHAwAhlQICAIEDACGWAgIAgQMAIZcCAgCIAwAhmAICAIEDACGZAkAA8gIAIZoCQADyAgAhAgcAAPoDACCXAgAApQMAIBMHAAD4AgAgCwIAgQMAIeABAACGAwAw4QEAABoAEOIBAACGAwAw4wEBAAAAAfsBAQDxAgAh_QECAIEDACGEAgEA8QIAIYUCAQDxAgAhhgIBAPECACGUAggAhwMAIZUCAgCBAwAhlgICAIEDACGXAgIAiAMAIZgCAgCBAwAhmQJAAPICACGaAkAA8gIAIcACAACFAwAgAwAAABoAIAIAABsAMAMAABwAIAoHAAD4AgAg4AEAAIMDADDhAQAAHgAQ4gEAAIMDADDjAQEA8QIAIfsBAQDxAgAh_AEBAPECACH_AQIAgQMAIYACQADyAgAhgQIgAIQDACEBBwAA-gMAIAsHAAD4AgAg4AEAAIMDADDhAQAAHgAQ4gEAAIMDADDjAQEAAAAB-wEBAPECACH8AQEA8QIAIf8BAgCBAwAhgAJAAPICACGBAiAAhAMAIb8CAACCAwAgAwAAAB4AIAIAAB8AMAMAACAAIAkHAAD4AgAg4AEAAIADADDhAQAAIgAQ4gEAAIADADDjAQEA8QIAIfsBAQDxAgAh_AEBAPECACH9AQIAgQMAIf4BQADyAgAhAQcAAPoDACAJBwAA-AIAIOABAACAAwAw4QEAACIAEOIBAACAAwAw4wEBAAAAAfsBAQDxAgAh_AEBAPECACH9AQIAgQMAIf4BQADyAgAhAwAAACIAIAIAACMAMAMAACQAIA0RAAD4AgAgEgAA_wIAIOABAAD8AgAw4QEAACYAEOIBAAD8AgAw4wEBAPECACHmAUAA8gIAIfIBAQDxAgAh8wEBAPECACH0AQAA1QIAIPUBQADyAgAh9gFAAP0CACH3AQEA_gIAIQQRAAD6AwAgEgAA-gMAIPYBAAClAwAg9wEAAKUDACANEQAA-AIAIBIAAP8CACDgAQAA_AIAMOEBAAAmABDiAQAA_AIAMOMBAQAAAAHmAUAA8gIAIfIBAQAAAAHzAQEA8QIAIfQBAADVAgAg9QFAAPICACH2AUAA_QIAIfcBAQD-AgAhAwAAACYAIAIAACcAMAMAACgAIAEAAAADACADAAAAJgAgAgAAJwAwAwAAKAAgCQUAAPgCACAVAAD4AgAg4AEAAPsCADDhAQAALAAQ4gEAAPsCADDjAQEA8QIAIeQBAQDxAgAh5QEBAPECACHmAUAA8gIAIQIFAAD6AwAgFQAA-gMAIAoFAAD4AgAgFQAA-AIAIOABAAD7AgAw4QEAACwAEOIBAAD7AgAw4wEBAAAAAeQBAQDxAgAh5QEBAPECACHmAUAA8gIAIb4CAAD6AgAgAwAAACwAIAIAAC0AMAMAAC4AIAMAAAAsACACAAAtADADAAAuACABAAAAAwAgAQAAAAkAIAEAAAANACABAAAAEQAgAQAAABoAIAEAAAAeACABAAAAIgAgAQAAACYAIAEAAAAmACABAAAALAAgAQAAACwAIAEAAAABACADAAAAAwAgAgAABQAwAwAAAQAgAwAAAAMAIAIAAAUAMAMAAAEAIAMAAAADACACAAAFADADAAABACAfAQAAnAUAIAQAAJAFACAGAACRBQAgCAAAkgUAIAkAAJMFACANAACUBQAgDgAAlQUAIA8AAJYFACAQAACXBQAgEwAAmAUAIBQAAJkFACAWAACaBQAgFwAAmwUAIOMBAQAAAAHmAUAAAAABrgIBAAAAAa8CAQAAAAGwAkAAAAABsQIBAAAAAbICAQAAAAGzAgEAAAABtAIBAAAAAbUCAQAAAAG2AgEAAAABtwJAAAAAAbgCAgAAAAG5AgIAAAABugIBAAAAAbsCAgAAAAG8AgIAAAABvQICAAAAAQEdAABAACAS4wEBAAAAAeYBQAAAAAGuAgEAAAABrwIBAAAAAbACQAAAAAGxAgEAAAABsgIBAAAAAbMCAQAAAAG0AgEAAAABtQIBAAAAAbYCAQAAAAG3AkAAAAABuAICAAAAAbkCAgAAAAG6AgEAAAABuwICAAAAAbwCAgAAAAG9AgIAAAABAR0AAEIAMAEdAABCADABAAAAAwAgHwEAAIAEACAEAACBBAAgBgAAggQAIAgAAIMEACAJAACEBAAgDQAAhQQAIA4AAIYEACAPAACHBAAgEAAAiAQAIBMAAIkEACAUAACKBAAgFgAAiwQAIBcAAIwEACDjAQEAnwMAIeYBQACgAwAhrgIBAKsDACGvAgEAqwMAIbACQACqAwAhsQIBAKsDACGyAgEAqwMAIbMCAQCrAwAhtAIBAKsDACG1AgEAqwMAIbYCAQCrAwAhtwJAAKoDACG4AgIAtgMAIbkCAgDOAwAhugIBAKsDACG7AgIAzgMAIbwCAgDOAwAhvQICALYDACECAAAAAQAgHQAARgAgEuMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG0AgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIQIAAAADACAdAABIACACAAAAAwAgHQAASAAgAQAAAAMAIAMAAAABACAkAABAACAlAABGACABAAAAAQAgAQAAAAMAIBMMAAD7AwAgKgAA_AMAICsAAP8DACAsAAD-AwAgLQAA_QMAIK4CAAClAwAgrwIAAKUDACCwAgAApQMAILECAAClAwAgsgIAAKUDACCzAgAApQMAILQCAAClAwAgtQIAAKUDACC2AgAApQMAILcCAAClAwAguQIAAKUDACC6AgAApQMAILsCAAClAwAgvAIAAKUDACAV4AEAAPkCADDhAQAAUAAQ4gEAAPkCADDjAQEAzQIAIeYBQADOAgAhrgIBANcCACGvAgEA1wIAIbACQADWAgAhsQIBANcCACGyAgEA1wIAIbMCAQDXAgAhtAIBANcCACG1AgEA1wIAIbYCAQDXAgAhtwJAANYCACG4AgIA3gIAIbkCAgDqAgAhugIBANcCACG7AgIA6gIAIbwCAgDqAgAhvQICAN4CACEDAAAAAwAgAgAATwAwKQAAUAAgAwAAAAMAIAIAAAUAMAMAAAEAIAcFAAD4AgAg4AEAAPcCADDhAQAABwAQ4gEAAPcCADDkAQEAAAABmgJAAPICACGtAgEA8QIAIQEAAABTACABAAAAUwAgAQUAAPoDACADAAAABwAgAgAAVgAwAwAAUwAgAwAAAAcAIAIAAFYAMAMAAFMAIAMAAAAHACACAABWADADAABTACAEBQAA-QMAIOQBAQAAAAGaAkAAAAABrQIBAAAAAQEdAABaACAD5AEBAAAAAZoCQAAAAAGtAgEAAAABAR0AAFwAMAEdAABcADAEBQAA-AMAIOQBAQCfAwAhmgJAAKADACGtAgEAnwMAIQIAAABTACAdAABfACAD5AEBAJ8DACGaAkAAoAMAIa0CAQCfAwAhAgAAAAcAIB0AAGEAIAIAAAAHACAdAABhACADAAAAUwAgJAAAWgAgJQAAXwAgAQAAAFMAIAEAAAAHACADDAAA9QMAICwAAPcDACAtAAD2AwAgBuABAAD2AgAw4QEAAGgAEOIBAAD2AgAw5AEBAM0CACGaAkAAzgIAIa0CAQDNAgAhAwAAAAcAIAIAAGcAMCkAAGgAIAMAAAAHACACAABWADADAABTACABAAAACwAgAQAAAAsAIAMAAAAJACACAAAKADADAAALACADAAAACQAgAgAACgAwAwAACwAgAwAAAAkAIAIAAAoAMAMAAAsAIA0HAAD0AwAg4wEBAAAAAfsBAQAAAAGjAgEAAAABpAIBAAAAAaUCAQAAAAGmAgEAAAABpwIBAAAAAagCAgAAAAGpAgEAAAABqgIBAAAAAasCAQAAAAGsAgEAAAABAR0AAHAAIAzjAQEAAAAB-wEBAAAAAaMCAQAAAAGkAgEAAAABpQIBAAAAAaYCAQAAAAGnAgEAAAABqAICAAAAAakCAQAAAAGqAgEAAAABqwIBAAAAAawCAQAAAAEBHQAAcgAwAR0AAHIAMA0HAADzAwAg4wEBAJ8DACH7AQEAnwMAIaMCAQCfAwAhpAIBAJ8DACGlAgEAnwMAIaYCAQCrAwAhpwIBAKsDACGoAgIAzgMAIakCAQCrAwAhqgIBAKsDACGrAgEAqwMAIawCAQCrAwAhAgAAAAsAIB0AAHUAIAzjAQEAnwMAIfsBAQCfAwAhowIBAJ8DACGkAgEAnwMAIaUCAQCfAwAhpgIBAKsDACGnAgEAqwMAIagCAgDOAwAhqQIBAKsDACGqAgEAqwMAIasCAQCrAwAhrAIBAKsDACECAAAACQAgHQAAdwAgAgAAAAkAIB0AAHcAIAMAAAALACAkAABwACAlAAB1ACABAAAACwAgAQAAAAkAIAwMAADuAwAgKgAA7wMAICsAAPIDACAsAADxAwAgLQAA8AMAIKYCAAClAwAgpwIAAKUDACCoAgAApQMAIKkCAAClAwAgqgIAAKUDACCrAgAApQMAIKwCAAClAwAgD-ABAAD1AgAw4QEAAH4AEOIBAAD1AgAw4wEBAM0CACH7AQEAzQIAIaMCAQDNAgAhpAIBAM0CACGlAgEAzQIAIaYCAQDXAgAhpwIBANcCACGoAgIA6gIAIakCAQDXAgAhqgIBANcCACGrAgEA1wIAIawCAQDXAgAhAwAAAAkAIAIAAH0AMCkAAH4AIAMAAAAJACACAAAKADADAAALACABAAAADwAgAQAAAA8AIAMAAAANACACAAAOADADAAAPACADAAAADQAgAgAADgAwAwAADwAgAwAAAA0AIAIAAA4AMAMAAA8AIAUHAADtAwAg4wEBAAAAAfsBAQAAAAGgAkAAAAABogIBAAAAAQEdAACGAQAgBOMBAQAAAAH7AQEAAAABoAJAAAAAAaICAQAAAAEBHQAAiAEAMAEdAACIAQAwBQcAAOwDACDjAQEAnwMAIfsBAQCfAwAhoAJAAKADACGiAgEAnwMAIQIAAAAPACAdAACLAQAgBOMBAQCfAwAh-wEBAJ8DACGgAkAAoAMAIaICAQCfAwAhAgAAAA0AIB0AAI0BACACAAAADQAgHQAAjQEAIAMAAAAPACAkAACGAQAgJQAAiwEAIAEAAAAPACABAAAADQAgAwwAAOkDACAsAADrAwAgLQAA6gMAIAfgAQAA9AIAMOEBAACUAQAQ4gEAAPQCADDjAQEAzQIAIfsBAQDNAgAhoAJAAM4CACGiAgEAzQIAIQMAAAANACACAACTAQAwKQAAlAEAIAMAAAANACACAAAOADADAAAPACAH4AEAAPACADDhAQAAmgEAEOIBAADwAgAw8gEBAAAAAZ8CAQDxAgAhoAJAAPICACGhAgAA8wIAIAEAAACXAQAgAQAAAJcBACAG4AEAAPACADDhAQAAmgEAEOIBAADwAgAw8gEBAPECACGfAgEA8QIAIaACQADyAgAhAAMAAACaAQAgAgAAmwEAMAMAAJcBACADAAAAmgEAIAIAAJsBADADAACXAQAgAwAAAJoBACACAACbAQAwAwAAlwEAIAPyAQEAAAABnwIBAAAAAaACQAAAAAEBHQAAnwEAIAPyAQEAAAABnwIBAAAAAaACQAAAAAEBHQAAoQEAMAEdAAChAQAwA_IBAQCfAwAhnwIBAJ8DACGgAkAAoAMAIQIAAACXAQAgHQAApAEAIAPyAQEAnwMAIZ8CAQCfAwAhoAJAAKADACECAAAAmgEAIB0AAKYBACACAAAAmgEAIB0AAKYBACADAAAAlwEAICQAAJ8BACAlAACkAQAgAQAAAJcBACABAAAAmgEAIAMMAADmAwAgLAAA6AMAIC0AAOcDACAG4AEAAO8CADDhAQAArQEAEOIBAADvAgAw8gEBAM0CACGfAgEAzQIAIaACQADOAgAhAwAAAJoBACACAACsAQAwKQAArQEAIAMAAACaAQAgAgAAmwEAMAMAAJcBACABAAAAEwAgAQAAABMAIAMAAAARACACAAASADADAAATACADAAAAEQAgAgAAEgAwAwAAEwAgAwAAABEAIAIAABIAMAMAABMAIAoHAADkAwAgCwAA5QMAIOMBAQAAAAH7AQEAAAABhAIBAAAAAYYCAQAAAAGbAgEAAAABnAJAAAAAAZ0CQAAAAAGeAgIAAAABAR0AALUBACAI4wEBAAAAAfsBAQAAAAGEAgEAAAABhgIBAAAAAZsCAQAAAAGcAkAAAAABnQJAAAAAAZ4CAgAAAAEBHQAAtwEAMAEdAAC3AQAwCgcAANYDACALAADXAwAg4wEBAJ8DACH7AQEAnwMAIYQCAQCfAwAhhgIBAJ8DACGbAgEAnwMAIZwCQACgAwAhnQJAAKoDACGeAgIAtgMAIQIAAAATACAdAAC6AQAgCOMBAQCfAwAh-wEBAJ8DACGEAgEAnwMAIYYCAQCfAwAhmwIBAJ8DACGcAkAAoAMAIZ0CQACqAwAhngICALYDACECAAAAEQAgHQAAvAEAIAIAAAARACAdAAC8AQAgAwAAABMAICQAALUBACAlAAC6AQAgAQAAABMAIAEAAAARACAGDAAA0QMAICoAANIDACArAADVAwAgLAAA1AMAIC0AANMDACCdAgAApQMAIAvgAQAA7gIAMOEBAADDAQAQ4gEAAO4CADDjAQEAzQIAIfsBAQDNAgAhhAIBAM0CACGGAgEAzQIAIZsCAQDNAgAhnAJAAM4CACGdAkAA1gIAIZ4CAgDeAgAhAwAAABEAIAIAAMIBADApAADDAQAgAwAAABEAIAIAABIAMAMAABMAIAEAAAAcACABAAAAHAAgAwAAABoAIAIAABsAMAMAABwAIAMAAAAaACACAAAbADADAAAcACADAAAAGgAgAgAAGwAwAwAAHAAgDwcAANADACALAgAAAAHjAQEAAAAB-wEBAAAAAf0BAgAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGUAggAAAABlQICAAAAAZYCAgAAAAGXAgIAAAABmAICAAAAAZkCQAAAAAGaAkAAAAABAR0AAMsBACAOCwIAAAAB4wEBAAAAAfsBAQAAAAH9AQIAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABlAIIAAAAAZUCAgAAAAGWAgIAAAABlwICAAAAAZgCAgAAAAGZAkAAAAABmgJAAAAAAQEdAADNAQAwAR0AAM0BADAPBwAAzwMAIAsCALYDACHjAQEAnwMAIfsBAQCfAwAh_QECALYDACGEAgEAnwMAIYUCAQCfAwAhhgIBAJ8DACGUAggAzQMAIZUCAgC2AwAhlgICALYDACGXAgIAzgMAIZgCAgC2AwAhmQJAAKADACGaAkAAoAMAIQIAAAAcACAdAADQAQAgDgsCALYDACHjAQEAnwMAIfsBAQCfAwAh_QECALYDACGEAgEAnwMAIYUCAQCfAwAhhgIBAJ8DACGUAggAzQMAIZUCAgC2AwAhlgICALYDACGXAgIAzgMAIZgCAgC2AwAhmQJAAKADACGaAkAAoAMAIQIAAAAaACAdAADSAQAgAgAAABoAIB0AANIBACADAAAAHAAgJAAAywEAICUAANABACABAAAAHAAgAQAAABoAIAYMAADIAwAgKgAAyQMAICsAAMwDACAsAADLAwAgLQAAygMAIJcCAAClAwAgEQsCAN4CACHgAQAA6AIAMOEBAADZAQAQ4gEAAOgCADDjAQEAzQIAIfsBAQDNAgAh_QECAN4CACGEAgEAzQIAIYUCAQDNAgAhhgIBAM0CACGUAggA6QIAIZUCAgDeAgAhlgICAN4CACGXAgIA6gIAIZgCAgDeAgAhmQJAAM4CACGaAkAAzgIAIQMAAAAaACACAADYAQAwKQAA2QEAIAMAAAAaACACAAAbADADAAAcACABAAAAFwAgAQAAABcAIAMAAAAVACACAAAWADADAAAXACADAAAAFQAgAgAAFgAwAwAAFwAgAwAAABUAIAIAABYAMAMAABcAIA8KAADHAwAg4wEBAAAAAf0BIAAAAAGCAgEAAAABgwIBAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAgEAAAABiQIBAAAAAYoCAgAAAAGLAkAAAAABjAICAAAAAY0CgAAAAAEBHQAA4QEAIA7jAQEAAAAB_QEgAAAAAYICAQAAAAGDAgEAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCAQAAAAGJAgEAAAABigICAAAAAYsCQAAAAAGMAgIAAAABjQKAAAAAAQEdAADjAQAwAR0AAOMBADAPCgAAxgMAIOMBAQCfAwAh_QEgAL4DACGCAgEAnwMAIYMCAQCfAwAhhAIBAJ8DACGFAgEAnwMAIYYCAQCfAwAhhwIBAJ8DACGIAgEAnwMAIYkCAQCfAwAhigICALYDACGLAkAAoAMAIYwCAgC2AwAhjQKAAAAAAQIAAAAXACAdAADmAQAgDuMBAQCfAwAh_QEgAL4DACGCAgEAnwMAIYMCAQCfAwAhhAIBAJ8DACGFAgEAnwMAIYYCAQCfAwAhhwIBAJ8DACGIAgEAnwMAIYkCAQCfAwAhigICALYDACGLAkAAoAMAIYwCAgC2AwAhjQKAAAAAAQIAAAAVACAdAADoAQAgAgAAABUAIB0AAOgBACADAAAAFwAgJAAA4QEAICUAAOYBACABAAAAFwAgAQAAABUAIAYMAADBAwAgKgAAwgMAICsAAMUDACAsAADEAwAgLQAAwwMAII0CAAClAwAgEeABAADlAgAw4QEAAO8BABDiAQAA5QIAMOMBAQDNAgAh_QEgAOICACGCAgEAzQIAIYMCAQDNAgAhhAIBAM0CACGFAgEAzQIAIYYCAQDNAgAhhwIBAM0CACGIAgEAzQIAIYkCAQDNAgAhigICAN4CACGLAkAAzgIAIYwCAgDeAgAhjQIAAOYCACADAAAAFQAgAgAA7gEAMCkAAO8BACADAAAAFQAgAgAAFgAwAwAAFwAgAQAAACAAIAEAAAAgACADAAAAHgAgAgAAHwAwAwAAIAAgAwAAAB4AIAIAAB8AMAMAACAAIAMAAAAeACACAAAfADADAAAgACAHBwAAwAMAIOMBAQAAAAH7AQEAAAAB_AEBAAAAAf8BAgAAAAGAAkAAAAABgQIgAAAAAQEdAAD3AQAgBuMBAQAAAAH7AQEAAAAB_AEBAAAAAf8BAgAAAAGAAkAAAAABgQIgAAAAAQEdAAD5AQAwAR0AAPkBADAHBwAAvwMAIOMBAQCfAwAh-wEBAJ8DACH8AQEAnwMAIf8BAgC2AwAhgAJAAKADACGBAiAAvgMAIQIAAAAgACAdAAD8AQAgBuMBAQCfAwAh-wEBAJ8DACH8AQEAnwMAIf8BAgC2AwAhgAJAAKADACGBAiAAvgMAIQIAAAAeACAdAAD-AQAgAgAAAB4AIB0AAP4BACADAAAAIAAgJAAA9wEAICUAAPwBACABAAAAIAAgAQAAAB4AIAUMAAC5AwAgKgAAugMAICsAAL0DACAsAAC8AwAgLQAAuwMAIAngAQAA4QIAMOEBAACFAgAQ4gEAAOECADDjAQEAzQIAIfsBAQDNAgAh_AEBAM0CACH_AQIA3gIAIYACQADOAgAhgQIgAOICACEDAAAAHgAgAgAAhAIAMCkAAIUCACADAAAAHgAgAgAAHwAwAwAAIAAgAQAAACQAIAEAAAAkACADAAAAIgAgAgAAIwAwAwAAJAAgAwAAACIAIAIAACMAMAMAACQAIAMAAAAiACACAAAjADADAAAkACAGBwAAuAMAIOMBAQAAAAH7AQEAAAAB_AEBAAAAAf0BAgAAAAH-AUAAAAABAR0AAI0CACAF4wEBAAAAAfsBAQAAAAH8AQEAAAAB_QECAAAAAf4BQAAAAAEBHQAAjwIAMAEdAACPAgAwBgcAALcDACDjAQEAnwMAIfsBAQCfAwAh_AEBAJ8DACH9AQIAtgMAIf4BQACgAwAhAgAAACQAIB0AAJICACAF4wEBAJ8DACH7AQEAnwMAIfwBAQCfAwAh_QECALYDACH-AUAAoAMAIQIAAAAiACAdAACUAgAgAgAAACIAIB0AAJQCACADAAAAJAAgJAAAjQIAICUAAJICACABAAAAJAAgAQAAACIAIAUMAACxAwAgKgAAsgMAICsAALUDACAsAAC0AwAgLQAAswMAIAjgAQAA3QIAMOEBAACbAgAQ4gEAAN0CADDjAQEAzQIAIfsBAQDNAgAh_AEBAM0CACH9AQIA3gIAIf4BQADOAgAhAwAAACIAIAIAAJoCADApAACbAgAgAwAAACIAIAIAACMAMAMAACQAIAEAAAAoACABAAAAKAAgAwAAACYAIAIAACcAMAMAACgAIAMAAAAmACACAAAnADADAAAoACADAAAAJgAgAgAAJwAwAwAAKAAgChEAAK8DACASAACwAwAg4wEBAAAAAeYBQAAAAAHyAQEAAAAB8wEBAAAAAfQBAACuAwAg9QFAAAAAAfYBQAAAAAH3AQEAAAABAR0AAKMCACAI4wEBAAAAAeYBQAAAAAHyAQEAAAAB8wEBAAAAAfQBAACuAwAg9QFAAAAAAfYBQAAAAAH3AQEAAAABAR0AAKUCADABHQAApQIAMAEAAAADACAKEQAArAMAIBIAAK0DACDjAQEAnwMAIeYBQACgAwAh8gEBAJ8DACHzAQEAnwMAIfQBAACpAwAg9QFAAKADACH2AUAAqgMAIfcBAQCrAwAhAgAAACgAIB0AAKkCACAI4wEBAJ8DACHmAUAAoAMAIfIBAQCfAwAh8wEBAJ8DACH0AQAAqQMAIPUBQACgAwAh9gFAAKoDACH3AQEAqwMAIQIAAAAmACAdAACrAgAgAgAAACYAIB0AAKsCACABAAAAAwAgAwAAACgAICQAAKMCACAlAACpAgAgAQAAACgAIAEAAAAmACAFDAAApgMAICwAAKgDACAtAACnAwAg9gEAAKUDACD3AQAApQMAIAvgAQAA1AIAMOEBAACzAgAQ4gEAANQCADDjAQEAzQIAIeYBQADOAgAh8gEBAM0CACHzAQEAzQIAIfQBAADVAgAg9QFAAM4CACH2AUAA1gIAIfcBAQDXAgAhAwAAACYAIAIAALICADApAACzAgAgAwAAACYAIAIAACcAMAMAACgAIAEAAAAuACABAAAALgAgAwAAACwAIAIAAC0AMAMAAC4AIAMAAAAsACACAAAtADADAAAuACADAAAALAAgAgAALQAwAwAALgAgBgUAAKMDACAVAACkAwAg4wEBAAAAAeQBAQAAAAHlAQEAAAAB5gFAAAAAAQEdAAC7AgAgBOMBAQAAAAHkAQEAAAAB5QEBAAAAAeYBQAAAAAEBHQAAvQIAMAEdAAC9AgAwBgUAAKEDACAVAACiAwAg4wEBAJ8DACHkAQEAnwMAIeUBAQCfAwAh5gFAAKADACECAAAALgAgHQAAwAIAIATjAQEAnwMAIeQBAQCfAwAh5QEBAJ8DACHmAUAAoAMAIQIAAAAsACAdAADCAgAgAgAAACwAIB0AAMICACADAAAALgAgJAAAuwIAICUAAMACACABAAAALgAgAQAAACwAIAMMAACcAwAgLAAAngMAIC0AAJ0DACAH4AEAAMwCADDhAQAAyQIAEOIBAADMAgAw4wEBAM0CACHkAQEAzQIAIeUBAQDNAgAh5gFAAM4CACEDAAAALAAgAgAAyAIAMCkAAMkCACADAAAALAAgAgAALQAwAwAALgAgB-ABAADMAgAw4QEAAMkCABDiAQAAzAIAMOMBAQDNAgAh5AEBAM0CACHlAQEAzQIAIeYBQADOAgAhDgwAANACACAsAADTAgAgLQAA0wIAIOcBAQAAAAHoAQEAAAAE6QEBAAAABOoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQAAAAHuAQEA0gIAIe8BAQAAAAHwAQEAAAAB8QEBAAAAAQsMAADQAgAgLAAA0QIAIC0AANECACDnAUAAAAAB6AFAAAAABOkBQAAAAATqAUAAAAAB6wFAAAAAAewBQAAAAAHtAUAAAAAB7gFAAM8CACELDAAA0AIAICwAANECACAtAADRAgAg5wFAAAAAAegBQAAAAATpAUAAAAAE6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAAAAAAe4BQADPAgAhCOcBAgAAAAHoAQIAAAAE6QECAAAABOoBAgAAAAHrAQIAAAAB7AECAAAAAe0BAgAAAAHuAQIA0AIAIQjnAUAAAAAB6AFAAAAABOkBQAAAAATqAUAAAAAB6wFAAAAAAewBQAAAAAHtAUAAAAAB7gFAANECACEODAAA0AIAICwAANMCACAtAADTAgAg5wEBAAAAAegBAQAAAATpAQEAAAAE6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBAAAAAe4BAQDSAgAh7wEBAAAAAfABAQAAAAHxAQEAAAABC-cBAQAAAAHoAQEAAAAE6QEBAAAABOoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQAAAAHuAQEA0wIAIe8BAQAAAAHwAQEAAAAB8QEBAAAAAQvgAQAA1AIAMOEBAACzAgAQ4gEAANQCADDjAQEAzQIAIeYBQADOAgAh8gEBAM0CACHzAQEAzQIAIfQBAADVAgAg9QFAAM4CACH2AUAA1gIAIfcBAQDXAgAhBOcBAQAAAAX4AQEAAAAB-QEBAAAABPoBAQAAAAQLDAAA2QIAICwAANwCACAtAADcAgAg5wFAAAAAAegBQAAAAAXpAUAAAAAF6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAAAAAAe4BQADbAgAhDgwAANkCACAsAADaAgAgLQAA2gIAIOcBAQAAAAHoAQEAAAAF6QEBAAAABeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQAAAAHuAQEA2AIAIe8BAQAAAAHwAQEAAAAB8QEBAAAAAQ4MAADZAgAgLAAA2gIAIC0AANoCACDnAQEAAAAB6AEBAAAABekBAQAAAAXqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEAAAAB7gEBANgCACHvAQEAAAAB8AEBAAAAAfEBAQAAAAEI5wECAAAAAegBAgAAAAXpAQIAAAAF6gECAAAAAesBAgAAAAHsAQIAAAAB7QECAAAAAe4BAgDZAgAhC-cBAQAAAAHoAQEAAAAF6QEBAAAABeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQAAAAHuAQEA2gIAIe8BAQAAAAHwAQEAAAAB8QEBAAAAAQsMAADZAgAgLAAA3AIAIC0AANwCACDnAUAAAAAB6AFAAAAABekBQAAAAAXqAUAAAAAB6wFAAAAAAewBQAAAAAHtAUAAAAAB7gFAANsCACEI5wFAAAAAAegBQAAAAAXpAUAAAAAF6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAAAAAAe4BQADcAgAhCOABAADdAgAw4QEAAJsCABDiAQAA3QIAMOMBAQDNAgAh-wEBAM0CACH8AQEAzQIAIf0BAgDeAgAh_gFAAM4CACENDAAA0AIAICoAAOACACArAADQAgAgLAAA0AIAIC0AANACACDnAQIAAAAB6AECAAAABOkBAgAAAATqAQIAAAAB6wECAAAAAewBAgAAAAHtAQIAAAAB7gECAN8CACENDAAA0AIAICoAAOACACArAADQAgAgLAAA0AIAIC0AANACACDnAQIAAAAB6AECAAAABOkBAgAAAATqAQIAAAAB6wECAAAAAewBAgAAAAHtAQIAAAAB7gECAN8CACEI5wEIAAAAAegBCAAAAATpAQgAAAAE6gEIAAAAAesBCAAAAAHsAQgAAAAB7QEIAAAAAe4BCADgAgAhCeABAADhAgAw4QEAAIUCABDiAQAA4QIAMOMBAQDNAgAh-wEBAM0CACH8AQEAzQIAIf8BAgDeAgAhgAJAAM4CACGBAiAA4gIAIQUMAADQAgAgLAAA5AIAIC0AAOQCACDnASAAAAAB7gEgAOMCACEFDAAA0AIAICwAAOQCACAtAADkAgAg5wEgAAAAAe4BIADjAgAhAucBIAAAAAHuASAA5AIAIRHgAQAA5QIAMOEBAADvAQAQ4gEAAOUCADDjAQEAzQIAIf0BIADiAgAhggIBAM0CACGDAgEAzQIAIYQCAQDNAgAhhQIBAM0CACGGAgEAzQIAIYcCAQDNAgAhiAIBAM0CACGJAgEAzQIAIYoCAgDeAgAhiwJAAM4CACGMAgIA3gIAIY0CAADmAgAgDwwAANkCACAsAADnAgAgLQAA5wIAIOcBgAAAAAHqAYAAAAAB6wGAAAAAAewBgAAAAAHtAYAAAAAB7gGAAAAAAY4CAQAAAAGPAgEAAAABkAIBAAAAAZECgAAAAAGSAoAAAAABkwKAAAAAAQznAYAAAAAB6gGAAAAAAesBgAAAAAHsAYAAAAAB7QGAAAAAAe4BgAAAAAGOAgEAAAABjwIBAAAAAZACAQAAAAGRAoAAAAABkgKAAAAAAZMCgAAAAAERCwIA3gIAIeABAADoAgAw4QEAANkBABDiAQAA6AIAMOMBAQDNAgAh-wEBAM0CACH9AQIA3gIAIYQCAQDNAgAhhQIBAM0CACGGAgEAzQIAIZQCCADpAgAhlQICAN4CACGWAgIA3gIAIZcCAgDqAgAhmAICAN4CACGZAkAAzgIAIZoCQADOAgAhDQwAANACACAqAADgAgAgKwAA4AIAICwAAOACACAtAADgAgAg5wEIAAAAAegBCAAAAATpAQgAAAAE6gEIAAAAAesBCAAAAAHsAQgAAAAB7QEIAAAAAe4BCADtAgAhDQwAANkCACAqAADsAgAgKwAA2QIAICwAANkCACAtAADZAgAg5wECAAAAAegBAgAAAAXpAQIAAAAF6gECAAAAAesBAgAAAAHsAQIAAAAB7QECAAAAAe4BAgDrAgAhDQwAANkCACAqAADsAgAgKwAA2QIAICwAANkCACAtAADZAgAg5wECAAAAAegBAgAAAAXpAQIAAAAF6gECAAAAAesBAgAAAAHsAQIAAAAB7QECAAAAAe4BAgDrAgAhCOcBCAAAAAHoAQgAAAAF6QEIAAAABeoBCAAAAAHrAQgAAAAB7AEIAAAAAe0BCAAAAAHuAQgA7AIAIQ0MAADQAgAgKgAA4AIAICsAAOACACAsAADgAgAgLQAA4AIAIOcBCAAAAAHoAQgAAAAE6QEIAAAABOoBCAAAAAHrAQgAAAAB7AEIAAAAAe0BCAAAAAHuAQgA7QIAIQvgAQAA7gIAMOEBAADDAQAQ4gEAAO4CADDjAQEAzQIAIfsBAQDNAgAhhAIBAM0CACGGAgEAzQIAIZsCAQDNAgAhnAJAAM4CACGdAkAA1gIAIZ4CAgDeAgAhBuABAADvAgAw4QEAAK0BABDiAQAA7wIAMPIBAQDNAgAhnwIBAM0CACGgAkAAzgIAIQbgAQAA8AIAMOEBAACaAQAQ4gEAAPACADDyAQEA8QIAIZ8CAQDxAgAhoAJAAPICACEL5wEBAAAAAegBAQAAAATpAQEAAAAE6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBAAAAAe4BAQDTAgAh7wEBAAAAAfABAQAAAAHxAQEAAAABCOcBQAAAAAHoAUAAAAAE6QFAAAAABOoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQAAAAAHuAUAA0QIAIQLyAQEAAAABnwIBAAAAAQfgAQAA9AIAMOEBAACUAQAQ4gEAAPQCADDjAQEAzQIAIfsBAQDNAgAhoAJAAM4CACGiAgEAzQIAIQ_gAQAA9QIAMOEBAAB-ABDiAQAA9QIAMOMBAQDNAgAh-wEBAM0CACGjAgEAzQIAIaQCAQDNAgAhpQIBAM0CACGmAgEA1wIAIacCAQDXAgAhqAICAOoCACGpAgEA1wIAIaoCAQDXAgAhqwIBANcCACGsAgEA1wIAIQbgAQAA9gIAMOEBAABoABDiAQAA9gIAMOQBAQDNAgAhmgJAAM4CACGtAgEAzQIAIQcFAAD4AgAg4AEAAPcCADDhAQAABwAQ4gEAAPcCADDkAQEA8QIAIZoCQADyAgAhrQIBAPECACEkAQAA_wIAIAQAAJIDACAGAACTAwAgCAAAlAMAIAkAAJUDACANAACWAwAgDgAAlwMAIA8AAJgDACAQAACZAwAgEwAAmgMAIBQAAJoDACAWAACbAwAgFwAAmwMAIOABAACRAwAw4QEAAAMAEOIBAACRAwAw4wEBAPECACHmAUAA8gIAIa4CAQD-AgAhrwIBAP4CACGwAkAA_QIAIbECAQD-AgAhsgIBAP4CACGzAgEA_gIAIbQCAQD-AgAhtQIBAP4CACG2AgEA_gIAIbcCQAD9AgAhuAICAIEDACG5AgIAiAMAIboCAQD-AgAhuwICAIgDACG8AgIAiAMAIb0CAgCBAwAhxQIAAAMAIMYCAAADACAV4AEAAPkCADDhAQAAUAAQ4gEAAPkCADDjAQEAzQIAIeYBQADOAgAhrgIBANcCACGvAgEA1wIAIbACQADWAgAhsQIBANcCACGyAgEA1wIAIbMCAQDXAgAhtAIBANcCACG1AgEA1wIAIbYCAQDXAgAhtwJAANYCACG4AgIA3gIAIbkCAgDqAgAhugIBANcCACG7AgIA6gIAIbwCAgDqAgAhvQICAN4CACEC5AEBAAAAAeUBAQAAAAEJBQAA-AIAIBUAAPgCACDgAQAA-wIAMOEBAAAsABDiAQAA-wIAMOMBAQDxAgAh5AEBAPECACHlAQEA8QIAIeYBQADyAgAhDREAAPgCACASAAD_AgAg4AEAAPwCADDhAQAAJgAQ4gEAAPwCADDjAQEA8QIAIeYBQADyAgAh8gEBAPECACHzAQEA8QIAIfQBAADVAgAg9QFAAPICACH2AUAA_QIAIfcBAQD-AgAhCOcBQAAAAAHoAUAAAAAF6QFAAAAABeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQAAAAAHuAUAA3AIAIQvnAQEAAAAB6AEBAAAABekBAQAAAAXqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEAAAAB7gEBANoCACHvAQEAAAAB8AEBAAAAAfEBAQAAAAEkAQAA_wIAIAQAAJIDACAGAACTAwAgCAAAlAMAIAkAAJUDACANAACWAwAgDgAAlwMAIA8AAJgDACAQAACZAwAgEwAAmgMAIBQAAJoDACAWAACbAwAgFwAAmwMAIOABAACRAwAw4QEAAAMAEOIBAACRAwAw4wEBAPECACHmAUAA8gIAIa4CAQD-AgAhrwIBAP4CACGwAkAA_QIAIbECAQD-AgAhsgIBAP4CACGzAgEA_gIAIbQCAQD-AgAhtQIBAP4CACG2AgEA_gIAIbcCQAD9AgAhuAICAIEDACG5AgIAiAMAIboCAQD-AgAhuwICAIgDACG8AgIAiAMAIb0CAgCBAwAhxQIAAAMAIMYCAAADACAJBwAA-AIAIOABAACAAwAw4QEAACIAEOIBAACAAwAw4wEBAPECACH7AQEA8QIAIfwBAQDxAgAh_QECAIEDACH-AUAA8gIAIQjnAQIAAAAB6AECAAAABOkBAgAAAATqAQIAAAAB6wECAAAAAewBAgAAAAHtAQIAAAAB7gECANACACEC-wEBAAAAAfwBAQAAAAEKBwAA-AIAIOABAACDAwAw4QEAAB4AEOIBAACDAwAw4wEBAPECACH7AQEA8QIAIfwBAQDxAgAh_wECAIEDACGAAkAA8gIAIYECIACEAwAhAucBIAAAAAHuASAA5AIAIQT7AQEAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABEgcAAPgCACALAgCBAwAh4AEAAIYDADDhAQAAGgAQ4gEAAIYDADDjAQEA8QIAIfsBAQDxAgAh_QECAIEDACGEAgEA8QIAIYUCAQDxAgAhhgIBAPECACGUAggAhwMAIZUCAgCBAwAhlgICAIEDACGXAgIAiAMAIZgCAgCBAwAhmQJAAPICACGaAkAA8gIAIQjnAQgAAAAB6AEIAAAABOkBCAAAAATqAQgAAAAB6wEIAAAAAewBCAAAAAHtAQgAAAAB7gEIAOACACEI5wECAAAAAegBAgAAAAXpAQIAAAAF6gECAAAAAesBAgAAAAHsAQIAAAAB7QECAAAAAe4BAgDZAgAhEgoAAIsDACDgAQAAiQMAMOEBAAAVABDiAQAAiQMAMOMBAQDxAgAh_QEgAIQDACGCAgEA8QIAIYMCAQDxAgAhhAIBAPECACGFAgEA8QIAIYYCAQDxAgAhhwIBAPECACGIAgEA8QIAIYkCAQDxAgAhigICAIEDACGLAkAA8gIAIYwCAgCBAwAhjQIAAIoDACAM5wGAAAAAAeoBgAAAAAHrAYAAAAAB7AGAAAAAAe0BgAAAAAHuAYAAAAABjgIBAAAAAY8CAQAAAAGQAgEAAAABkQKAAAAAAZICgAAAAAGTAoAAAAABDwcAAPgCACALAACNAwAg4AEAAIwDADDhAQAAEQAQ4gEAAIwDADDjAQEA8QIAIfsBAQDxAgAhhAIBAPECACGGAgEA8QIAIZsCAQDxAgAhnAJAAPICACGdAkAA_QIAIZ4CAgCBAwAhxQIAABEAIMYCAAARACANBwAA-AIAIAsAAI0DACDgAQAAjAMAMOEBAAARABDiAQAAjAMAMOMBAQDxAgAh-wEBAPECACGEAgEA8QIAIYYCAQDxAgAhmwIBAPECACGcAkAA8gIAIZ0CQAD9AgAhngICAIEDACEDwQIAABUAIMICAAAVACDDAgAAFQAgCAcAAPgCACDgAQAAjgMAMOEBAAANABDiAQAAjgMAMOMBAQDxAgAh-wEBAPECACGgAkAA8gIAIaICAQDxAgAhAqQCAQAAAAGlAgEAAAABEAcAAPgCACDgAQAAkAMAMOEBAAAJABDiAQAAkAMAMOMBAQDxAgAh-wEBAPECACGjAgEA8QIAIaQCAQDxAgAhpQIBAPECACGmAgEA_gIAIacCAQD-AgAhqAICAIgDACGpAgEA_gIAIaoCAQD-AgAhqwIBAP4CACGsAgEA_gIAISIBAAD_AgAgBAAAkgMAIAYAAJMDACAIAACUAwAgCQAAlQMAIA0AAJYDACAOAACXAwAgDwAAmAMAIBAAAJkDACATAACaAwAgFAAAmgMAIBYAAJsDACAXAACbAwAg4AEAAJEDADDhAQAAAwAQ4gEAAJEDADDjAQEA8QIAIeYBQADyAgAhrgIBAP4CACGvAgEA_gIAIbACQAD9AgAhsQIBAP4CACGyAgEA_gIAIbMCAQD-AgAhtAIBAP4CACG1AgEA_gIAIbYCAQD-AgAhtwJAAP0CACG4AgIAgQMAIbkCAgCIAwAhugIBAP4CACG7AgIAiAMAIbwCAgCIAwAhvQICAIEDACEDwQIAAAMAIMICAAADACDDAgAAAwAgCQUAAPgCACDgAQAA9wIAMOEBAAAHABDiAQAA9wIAMOQBAQDxAgAhmgJAAPICACGtAgEA8QIAIcUCAAAHACDGAgAABwAgA8ECAAAJACDCAgAACQAgwwIAAAkAIAPBAgAADQAgwgIAAA0AIMMCAAANACADwQIAABEAIMICAAARACDDAgAAEQAgA8ECAAAaACDCAgAAGgAgwwIAABoAIAPBAgAAHgAgwgIAAB4AIMMCAAAeACADwQIAACIAIMICAAAiACDDAgAAIgAgA8ECAAAmACDCAgAAJgAgwwIAACYAIAPBAgAALAAgwgIAACwAIMMCAAAsACAAAAABygIBAAAAAQHKAkAAAAABBSQAAO4FACAlAAD0BQAgxwIAAO8FACDIAgAA8wUAIM0CAAABACAFJAAA7AUAICUAAPEFACDHAgAA7QUAIMgCAADwBQAgzQIAAAEAIAMkAADuBQAgxwIAAO8FACDNAgAAAQAgAyQAAOwFACDHAgAA7QUAIM0CAAABACAAAAAAAsoCAQAAAATUAgEAAAAFAcoCQAAAAAEBygIBAAAAAQUkAADkBQAgJQAA6gUAIMcCAADlBQAgyAIAAOkFACDNAgAAAQAgByQAAOIFACAlAADnBQAgxwIAAOMFACDIAgAA5gUAIMsCAAADACDMAgAAAwAgzQIAAAEAIAHKAgEAAAAEAyQAAOQFACDHAgAA5QUAIM0CAAABACADJAAA4gUAIMcCAADjBQAgzQIAAAEAIAAAAAAABcoCAgAAAAHQAgIAAAAB0QICAAAAAdICAgAAAAHTAgIAAAABBSQAAN0FACAlAADgBQAgxwIAAN4FACDIAgAA3wUAIM0CAAABACADJAAA3QUAIMcCAADeBQAgzQIAAAEAIAAAAAAAAcoCIAAAAAEFJAAA2AUAICUAANsFACDHAgAA2QUAIMgCAADaBQAgzQIAAAEAIAMkAADYBQAgxwIAANkFACDNAgAAAQAgAAAAAAAFJAAA0wUAICUAANYFACDHAgAA1AUAIMgCAADVBQAgzQIAABMAIAMkAADTBQAgxwIAANQFACDNAgAAEwAgAAAAAAAFygIIAAAAAdACCAAAAAHRAggAAAAB0gIIAAAAAdMCCAAAAAEFygICAAAAAdACAgAAAAHRAgIAAAAB0gICAAAAAdMCAgAAAAEFJAAAzgUAICUAANEFACDHAgAAzwUAIMgCAADQBQAgzQIAAAEAIAMkAADOBQAgxwIAAM8FACDNAgAAAQAgAAAAAAAFJAAAyAUAICUAAMwFACDHAgAAyQUAIMgCAADLBQAgzQIAAAEAIAskAADYAwAwJQAA3QMAMMcCAADZAwAwyAIAANoDADDJAgAA2wMAIMoCAADcAwAwywIAANwDADDMAgAA3AMAMM0CAADcAwAwzgIAAN4DADDPAgAA3wMAMA3jAQEAAAAB_QEgAAAAAYMCAQAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIBAAAAAYkCAQAAAAGKAgIAAAABiwJAAAAAAYwCAgAAAAGNAoAAAAABAgAAABcAICQAAOMDACADAAAAFwAgJAAA4wMAICUAAOIDACABHQAAygUAMBIKAACLAwAg4AEAAIkDADDhAQAAFQAQ4gEAAIkDADDjAQEAAAAB_QEgAIQDACGCAgEA8QIAIYMCAQDxAgAhhAIBAPECACGFAgEA8QIAIYYCAQDxAgAhhwIBAPECACGIAgEA8QIAIYkCAQDxAgAhigICAIEDACGLAkAA8gIAIYwCAgCBAwAhjQIAAIoDACACAAAAFwAgHQAA4gMAIAIAAADgAwAgHQAA4QMAIBHgAQAA3wMAMOEBAADgAwAQ4gEAAN8DADDjAQEA8QIAIf0BIACEAwAhggIBAPECACGDAgEA8QIAIYQCAQDxAgAhhQIBAPECACGGAgEA8QIAIYcCAQDxAgAhiAIBAPECACGJAgEA8QIAIYoCAgCBAwAhiwJAAPICACGMAgIAgQMAIY0CAACKAwAgEeABAADfAwAw4QEAAOADABDiAQAA3wMAMOMBAQDxAgAh_QEgAIQDACGCAgEA8QIAIYMCAQDxAgAhhAIBAPECACGFAgEA8QIAIYYCAQDxAgAhhwIBAPECACGIAgEA8QIAIYkCAQDxAgAhigICAIEDACGLAkAA8gIAIYwCAgCBAwAhjQIAAIoDACAN4wEBAJ8DACH9ASAAvgMAIYMCAQCfAwAhhAIBAJ8DACGFAgEAnwMAIYYCAQCfAwAhhwIBAJ8DACGIAgEAnwMAIYkCAQCfAwAhigICALYDACGLAkAAoAMAIYwCAgC2AwAhjQKAAAAAAQ3jAQEAnwMAIf0BIAC-AwAhgwIBAJ8DACGEAgEAnwMAIYUCAQCfAwAhhgIBAJ8DACGHAgEAnwMAIYgCAQCfAwAhiQIBAJ8DACGKAgIAtgMAIYsCQACgAwAhjAICALYDACGNAoAAAAABDeMBAQAAAAH9ASAAAAABgwIBAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAgEAAAABiQIBAAAAAYoCAgAAAAGLAkAAAAABjAICAAAAAY0CgAAAAAEDJAAAyAUAIMcCAADJBQAgzQIAAAEAIAQkAADYAwAwxwIAANkDADDJAgAA2wMAIM0CAADcAwAwAAAAAAAABSQAAMMFACAlAADGBQAgxwIAAMQFACDIAgAAxQUAIM0CAAABACADJAAAwwUAIMcCAADEBQAgzQIAAAEAIAAAAAAABSQAAL4FACAlAADBBQAgxwIAAL8FACDIAgAAwAUAIM0CAAABACADJAAAvgUAIMcCAAC_BQAgzQIAAAEAIAAAAAUkAAC5BQAgJQAAvAUAIMcCAAC6BQAgyAIAALsFACDNAgAAAQAgAyQAALkFACDHAgAAugUAIM0CAAABACAbAQAA-gMAIAQAAJ8FACAGAACgBQAgCAAAoQUAIAkAAKIFACANAACjBQAgDgAApAUAIA8AAKUFACAQAACmBQAgEwAApwUAIBQAAKcFACAWAACoBQAgFwAAqAUAIK4CAAClAwAgrwIAAKUDACCwAgAApQMAILECAAClAwAgsgIAAKUDACCzAgAApQMAILQCAAClAwAgtQIAAKUDACC2AgAApQMAILcCAAClAwAguQIAAKUDACC6AgAApQMAILsCAAClAwAgvAIAAKUDACAAAAAAAAckAACpBQAgJQAAtwUAIMcCAACqBQAgyAIAALYFACDLAgAAAwAgzAIAAAMAIM0CAAABACALJAAAhAUAMCUAAIkFADDHAgAAhQUAMMgCAACGBQAwyQIAAIcFACDKAgAAiAUAMMsCAACIBQAwzAIAAIgFADDNAgAAiAUAMM4CAACKBQAwzwIAAIsFADAHJAAA_wQAICUAAIIFACDHAgAAgAUAIMgCAACBBQAgywIAAAcAIMwCAAAHACDNAgAAUwAgCyQAAPMEADAlAAD4BAAwxwIAAPQEADDIAgAA9QQAMMkCAAD2BAAgygIAAPcEADDLAgAA9wQAMMwCAAD3BAAwzQIAAPcEADDOAgAA-QQAMM8CAAD6BAAwCyQAAOcEADAlAADsBAAwxwIAAOgEADDIAgAA6QQAMMkCAADqBAAgygIAAOsEADDLAgAA6wQAMMwCAADrBAAwzQIAAOsEADDOAgAA7QQAMM8CAADuBAAwCyQAANsEADAlAADgBAAwxwIAANwEADDIAgAA3QQAMMkCAADeBAAgygIAAN8EADDLAgAA3wQAMMwCAADfBAAwzQIAAN8EADDOAgAA4QQAMM8CAADiBAAwCyQAAM8EADAlAADUBAAwxwIAANAEADDIAgAA0QQAMMkCAADSBAAgygIAANMEADDLAgAA0wQAMMwCAADTBAAwzQIAANMEADDOAgAA1QQAMM8CAADWBAAwCyQAAMMEADAlAADIBAAwxwIAAMQEADDIAgAAxQQAMMkCAADGBAAgygIAAMcEADDLAgAAxwQAMMwCAADHBAAwzQIAAMcEADDOAgAAyQQAMM8CAADKBAAwCyQAALcEADAlAAC8BAAwxwIAALgEADDIAgAAuQQAMMkCAAC6BAAgygIAALsEADDLAgAAuwQAMMwCAAC7BAAwzQIAALsEADDOAgAAvQQAMM8CAAC-BAAwCyQAAK4EADAlAACyBAAwxwIAAK8EADDIAgAAsAQAMMkCAACxBAAgygIAAKYEADDLAgAApgQAMMwCAACmBAAwzQIAAKYEADDOAgAAswQAMM8CAACpBAAwCyQAAKIEADAlAACnBAAwxwIAAKMEADDIAgAApAQAMMkCAAClBAAgygIAAKYEADDLAgAApgQAMMwCAACmBAAwzQIAAKYEADDOAgAAqAQAMM8CAACpBAAwCyQAAJkEADAlAACdBAAwxwIAAJoEADDIAgAAmwQAMMkCAACcBAAgygIAAJEEADDLAgAAkQQAMMwCAACRBAAwzQIAAJEEADDOAgAAngQAMM8CAACUBAAwCyQAAI0EADAlAACSBAAwxwIAAI4EADDIAgAAjwQAMMkCAACQBAAgygIAAJEEADDLAgAAkQQAMMwCAACRBAAwzQIAAJEEADDOAgAAkwQAMM8CAACUBAAwBAUAAKMDACDjAQEAAAAB5AEBAAAAAeYBQAAAAAECAAAALgAgJAAAmAQAIAMAAAAuACAkAACYBAAgJQAAlwQAIAEdAAC1BQAwCgUAAPgCACAVAAD4AgAg4AEAAPsCADDhAQAALAAQ4gEAAPsCADDjAQEAAAAB5AEBAPECACHlAQEA8QIAIeYBQADyAgAhvgIAAPoCACACAAAALgAgHQAAlwQAIAIAAACVBAAgHQAAlgQAIAfgAQAAlAQAMOEBAACVBAAQ4gEAAJQEADDjAQEA8QIAIeQBAQDxAgAh5QEBAPECACHmAUAA8gIAIQfgAQAAlAQAMOEBAACVBAAQ4gEAAJQEADDjAQEA8QIAIeQBAQDxAgAh5QEBAPECACHmAUAA8gIAIQPjAQEAnwMAIeQBAQCfAwAh5gFAAKADACEEBQAAoQMAIOMBAQCfAwAh5AEBAJ8DACHmAUAAoAMAIQQFAACjAwAg4wEBAAAAAeQBAQAAAAHmAUAAAAABBBUAAKQDACDjAQEAAAAB5QEBAAAAAeYBQAAAAAECAAAALgAgJAAAoQQAIAMAAAAuACAkAAChBAAgJQAAoAQAIAEdAAC0BQAwAgAAAC4AIB0AAKAEACACAAAAlQQAIB0AAJ8EACAD4wEBAJ8DACHlAQEAnwMAIeYBQACgAwAhBBUAAKIDACDjAQEAnwMAIeUBAQCfAwAh5gFAAKADACEEFQAApAMAIOMBAQAAAAHlAQEAAAAB5gFAAAAAAQgRAACvAwAg4wEBAAAAAeYBQAAAAAHyAQEAAAAB8wEBAAAAAfQBAACuAwAg9QFAAAAAAfYBQAAAAAECAAAAKAAgJAAArQQAIAMAAAAoACAkAACtBAAgJQAArAQAIAEdAACzBQAwDREAAPgCACASAAD_AgAg4AEAAPwCADDhAQAAJgAQ4gEAAPwCADDjAQEAAAAB5gFAAPICACHyAQEAAAAB8wEBAPECACH0AQAA1QIAIPUBQADyAgAh9gFAAP0CACH3AQEA_gIAIQIAAAAoACAdAACsBAAgAgAAAKoEACAdAACrBAAgC-ABAACpBAAw4QEAAKoEABDiAQAAqQQAMOMBAQDxAgAh5gFAAPICACHyAQEA8QIAIfMBAQDxAgAh9AEAANUCACD1AUAA8gIAIfYBQAD9AgAh9wEBAP4CACEL4AEAAKkEADDhAQAAqgQAEOIBAACpBAAw4wEBAPECACHmAUAA8gIAIfIBAQDxAgAh8wEBAPECACH0AQAA1QIAIPUBQADyAgAh9gFAAP0CACH3AQEA_gIAIQfjAQEAnwMAIeYBQACgAwAh8gEBAJ8DACHzAQEAnwMAIfQBAACpAwAg9QFAAKADACH2AUAAqgMAIQgRAACsAwAg4wEBAJ8DACHmAUAAoAMAIfIBAQCfAwAh8wEBAJ8DACH0AQAAqQMAIPUBQACgAwAh9gFAAKoDACEIEQAArwMAIOMBAQAAAAHmAUAAAAAB8gEBAAAAAfMBAQAAAAH0AQAArgMAIPUBQAAAAAH2AUAAAAABCBIAALADACDjAQEAAAAB5gFAAAAAAfIBAQAAAAH0AQAArgMAIPUBQAAAAAH2AUAAAAAB9wEBAAAAAQIAAAAoACAkAAC2BAAgAwAAACgAICQAALYEACAlAAC1BAAgAR0AALIFADACAAAAKAAgHQAAtQQAIAIAAACqBAAgHQAAtAQAIAfjAQEAnwMAIeYBQACgAwAh8gEBAJ8DACH0AQAAqQMAIPUBQACgAwAh9gFAAKoDACH3AQEAqwMAIQgSAACtAwAg4wEBAJ8DACHmAUAAoAMAIfIBAQCfAwAh9AEAAKkDACD1AUAAoAMAIfYBQACqAwAh9wEBAKsDACEIEgAAsAMAIOMBAQAAAAHmAUAAAAAB8gEBAAAAAfQBAACuAwAg9QFAAAAAAfYBQAAAAAH3AQEAAAABBOMBAQAAAAH8AQEAAAAB_QECAAAAAf4BQAAAAAECAAAAJAAgJAAAwgQAIAMAAAAkACAkAADCBAAgJQAAwQQAIAEdAACxBQAwCQcAAPgCACDgAQAAgAMAMOEBAAAiABDiAQAAgAMAMOMBAQAAAAH7AQEA8QIAIfwBAQDxAgAh_QECAIEDACH-AUAA8gIAIQIAAAAkACAdAADBBAAgAgAAAL8EACAdAADABAAgCOABAAC-BAAw4QEAAL8EABDiAQAAvgQAMOMBAQDxAgAh-wEBAPECACH8AQEA8QIAIf0BAgCBAwAh_gFAAPICACEI4AEAAL4EADDhAQAAvwQAEOIBAAC-BAAw4wEBAPECACH7AQEA8QIAIfwBAQDxAgAh_QECAIEDACH-AUAA8gIAIQTjAQEAnwMAIfwBAQCfAwAh_QECALYDACH-AUAAoAMAIQTjAQEAnwMAIfwBAQCfAwAh_QECALYDACH-AUAAoAMAIQTjAQEAAAAB_AEBAAAAAf0BAgAAAAH-AUAAAAABBeMBAQAAAAH8AQEAAAAB_wECAAAAAYACQAAAAAGBAiAAAAABAgAAACAAICQAAM4EACADAAAAIAAgJAAAzgQAICUAAM0EACABHQAAsAUAMAsHAAD4AgAg4AEAAIMDADDhAQAAHgAQ4gEAAIMDADDjAQEAAAAB-wEBAPECACH8AQEA8QIAIf8BAgCBAwAhgAJAAPICACGBAiAAhAMAIb8CAACCAwAgAgAAACAAIB0AAM0EACACAAAAywQAIB0AAMwEACAJ4AEAAMoEADDhAQAAywQAEOIBAADKBAAw4wEBAPECACH7AQEA8QIAIfwBAQDxAgAh_wECAIEDACGAAkAA8gIAIYECIACEAwAhCeABAADKBAAw4QEAAMsEABDiAQAAygQAMOMBAQDxAgAh-wEBAPECACH8AQEA8QIAIf8BAgCBAwAhgAJAAPICACGBAiAAhAMAIQXjAQEAnwMAIfwBAQCfAwAh_wECALYDACGAAkAAoAMAIYECIAC-AwAhBeMBAQCfAwAh_AEBAJ8DACH_AQIAtgMAIYACQACgAwAhgQIgAL4DACEF4wEBAAAAAfwBAQAAAAH_AQIAAAABgAJAAAAAAYECIAAAAAENCwIAAAAB4wEBAAAAAf0BAgAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGUAggAAAABlQICAAAAAZYCAgAAAAGXAgIAAAABmAICAAAAAZkCQAAAAAGaAkAAAAABAgAAABwAICQAANoEACADAAAAHAAgJAAA2gQAICUAANkEACABHQAArwUAMBMHAAD4AgAgCwIAgQMAIeABAACGAwAw4QEAABoAEOIBAACGAwAw4wEBAAAAAfsBAQDxAgAh_QECAIEDACGEAgEA8QIAIYUCAQDxAgAhhgIBAPECACGUAggAhwMAIZUCAgCBAwAhlgICAIEDACGXAgIAiAMAIZgCAgCBAwAhmQJAAPICACGaAkAA8gIAIcACAACFAwAgAgAAABwAIB0AANkEACACAAAA1wQAIB0AANgEACARCwIAgQMAIeABAADWBAAw4QEAANcEABDiAQAA1gQAMOMBAQDxAgAh-wEBAPECACH9AQIAgQMAIYQCAQDxAgAhhQIBAPECACGGAgEA8QIAIZQCCACHAwAhlQICAIEDACGWAgIAgQMAIZcCAgCIAwAhmAICAIEDACGZAkAA8gIAIZoCQADyAgAhEQsCAIEDACHgAQAA1gQAMOEBAADXBAAQ4gEAANYEADDjAQEA8QIAIfsBAQDxAgAh_QECAIEDACGEAgEA8QIAIYUCAQDxAgAhhgIBAPECACGUAggAhwMAIZUCAgCBAwAhlgICAIEDACGXAgIAiAMAIZgCAgCBAwAhmQJAAPICACGaAkAA8gIAIQ0LAgC2AwAh4wEBAJ8DACH9AQIAtgMAIYQCAQCfAwAhhQIBAJ8DACGGAgEAnwMAIZQCCADNAwAhlQICALYDACGWAgIAtgMAIZcCAgDOAwAhmAICALYDACGZAkAAoAMAIZoCQACgAwAhDQsCALYDACHjAQEAnwMAIf0BAgC2AwAhhAIBAJ8DACGFAgEAnwMAIYYCAQCfAwAhlAIIAM0DACGVAgIAtgMAIZYCAgC2AwAhlwICAM4DACGYAgIAtgMAIZkCQACgAwAhmgJAAKADACENCwIAAAAB4wEBAAAAAf0BAgAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGUAggAAAABlQICAAAAAZYCAgAAAAGXAgIAAAABmAICAAAAAZkCQAAAAAGaAkAAAAABCAsAAOUDACDjAQEAAAABhAIBAAAAAYYCAQAAAAGbAgEAAAABnAJAAAAAAZ0CQAAAAAGeAgIAAAABAgAAABMAICQAAOYEACADAAAAEwAgJAAA5gQAICUAAOUEACABHQAArgUAMA0HAAD4AgAgCwAAjQMAIOABAACMAwAw4QEAABEAEOIBAACMAwAw4wEBAAAAAfsBAQDxAgAhhAIBAPECACGGAgEA8QIAIZsCAQDxAgAhnAJAAPICACGdAkAA_QIAIZ4CAgCBAwAhAgAAABMAIB0AAOUEACACAAAA4wQAIB0AAOQEACAL4AEAAOIEADDhAQAA4wQAEOIBAADiBAAw4wEBAPECACH7AQEA8QIAIYQCAQDxAgAhhgIBAPECACGbAgEA8QIAIZwCQADyAgAhnQJAAP0CACGeAgIAgQMAIQvgAQAA4gQAMOEBAADjBAAQ4gEAAOIEADDjAQEA8QIAIfsBAQDxAgAhhAIBAPECACGGAgEA8QIAIZsCAQDxAgAhnAJAAPICACGdAkAA_QIAIZ4CAgCBAwAhB-MBAQCfAwAhhAIBAJ8DACGGAgEAnwMAIZsCAQCfAwAhnAJAAKADACGdAkAAqgMAIZ4CAgC2AwAhCAsAANcDACDjAQEAnwMAIYQCAQCfAwAhhgIBAJ8DACGbAgEAnwMAIZwCQACgAwAhnQJAAKoDACGeAgIAtgMAIQgLAADlAwAg4wEBAAAAAYQCAQAAAAGGAgEAAAABmwIBAAAAAZwCQAAAAAGdAkAAAAABngICAAAAAQPjAQEAAAABoAJAAAAAAaICAQAAAAECAAAADwAgJAAA8gQAIAMAAAAPACAkAADyBAAgJQAA8QQAIAEdAACtBQAwCAcAAPgCACDgAQAAjgMAMOEBAAANABDiAQAAjgMAMOMBAQAAAAH7AQEA8QIAIaACQADyAgAhogIBAAAAAQIAAAAPACAdAADxBAAgAgAAAO8EACAdAADwBAAgB-ABAADuBAAw4QEAAO8EABDiAQAA7gQAMOMBAQDxAgAh-wEBAPECACGgAkAA8gIAIaICAQDxAgAhB-ABAADuBAAw4QEAAO8EABDiAQAA7gQAMOMBAQDxAgAh-wEBAPECACGgAkAA8gIAIaICAQDxAgAhA-MBAQCfAwAhoAJAAKADACGiAgEAnwMAIQPjAQEAnwMAIaACQACgAwAhogIBAJ8DACED4wEBAAAAAaACQAAAAAGiAgEAAAABC-MBAQAAAAGjAgEAAAABpAIBAAAAAaUCAQAAAAGmAgEAAAABpwIBAAAAAagCAgAAAAGpAgEAAAABqgIBAAAAAasCAQAAAAGsAgEAAAABAgAAAAsAICQAAP4EACADAAAACwAgJAAA_gQAICUAAP0EACABHQAArAUAMBEHAAD4AgAg4AEAAJADADDhAQAACQAQ4gEAAJADADDjAQEAAAAB-wEBAPECACGjAgEA8QIAIaQCAQDxAgAhpQIBAPECACGmAgEA_gIAIacCAQD-AgAhqAICAIgDACGpAgEA_gIAIaoCAQD-AgAhqwIBAP4CACGsAgEA_gIAIcQCAACPAwAgAgAAAAsAIB0AAP0EACACAAAA-wQAIB0AAPwEACAP4AEAAPoEADDhAQAA-wQAEOIBAAD6BAAw4wEBAPECACH7AQEA8QIAIaMCAQDxAgAhpAIBAPECACGlAgEA8QIAIaYCAQD-AgAhpwIBAP4CACGoAgIAiAMAIakCAQD-AgAhqgIBAP4CACGrAgEA_gIAIawCAQD-AgAhD-ABAAD6BAAw4QEAAPsEABDiAQAA-gQAMOMBAQDxAgAh-wEBAPECACGjAgEA8QIAIaQCAQDxAgAhpQIBAPECACGmAgEA_gIAIacCAQD-AgAhqAICAIgDACGpAgEA_gIAIaoCAQD-AgAhqwIBAP4CACGsAgEA_gIAIQvjAQEAnwMAIaMCAQCfAwAhpAIBAJ8DACGlAgEAnwMAIaYCAQCrAwAhpwIBAKsDACGoAgIAzgMAIakCAQCrAwAhqgIBAKsDACGrAgEAqwMAIawCAQCrAwAhC-MBAQCfAwAhowIBAJ8DACGkAgEAnwMAIaUCAQCfAwAhpgIBAKsDACGnAgEAqwMAIagCAgDOAwAhqQIBAKsDACGqAgEAqwMAIasCAQCrAwAhrAIBAKsDACEL4wEBAAAAAaMCAQAAAAGkAgEAAAABpQIBAAAAAaYCAQAAAAGnAgEAAAABqAICAAAAAakCAQAAAAGqAgEAAAABqwIBAAAAAawCAQAAAAECmgJAAAAAAa0CAQAAAAECAAAAUwAgJAAA_wQAIAMAAAAHACAkAAD_BAAgJQAAgwUAIAQAAAAHACAdAACDBQAgmgJAAKADACGtAgEAnwMAIQKaAkAAoAMAIa0CAQCfAwAhHQQAAJAFACAGAACRBQAgCAAAkgUAIAkAAJMFACANAACUBQAgDgAAlQUAIA8AAJYFACAQAACXBQAgEwAAmAUAIBQAAJkFACAWAACaBQAgFwAAmwUAIOMBAQAAAAHmAUAAAAABrgIBAAAAAa8CAQAAAAGwAkAAAAABsQIBAAAAAbICAQAAAAGzAgEAAAABtQIBAAAAAbYCAQAAAAG3AkAAAAABuAICAAAAAbkCAgAAAAG6AgEAAAABuwICAAAAAbwCAgAAAAG9AgIAAAABAgAAAAEAICQAAI8FACADAAAAAQAgJAAAjwUAICUAAI4FACABHQAAqwUAMCIBAAD_AgAgBAAAkgMAIAYAAJMDACAIAACUAwAgCQAAlQMAIA0AAJYDACAOAACXAwAgDwAAmAMAIBAAAJkDACATAACaAwAgFAAAmgMAIBYAAJsDACAXAACbAwAg4AEAAJEDADDhAQAAAwAQ4gEAAJEDADDjAQEAAAAB5gFAAPICACGuAgEA_gIAIa8CAQAAAAGwAkAA_QIAIbECAQD-AgAhsgIBAP4CACGzAgEA_gIAIbQCAQD-AgAhtQIBAP4CACG2AgEAAAABtwJAAP0CACG4AgIAgQMAIbkCAgCIAwAhugIBAP4CACG7AgIAiAMAIbwCAgCIAwAhvQICAIEDACECAAAAAQAgHQAAjgUAIAIAAACMBQAgHQAAjQUAIBXgAQAAiwUAMOEBAACMBQAQ4gEAAIsFADDjAQEA8QIAIeYBQADyAgAhrgIBAP4CACGvAgEA_gIAIbACQAD9AgAhsQIBAP4CACGyAgEA_gIAIbMCAQD-AgAhtAIBAP4CACG1AgEA_gIAIbYCAQD-AgAhtwJAAP0CACG4AgIAgQMAIbkCAgCIAwAhugIBAP4CACG7AgIAiAMAIbwCAgCIAwAhvQICAIEDACEV4AEAAIsFADDhAQAAjAUAEOIBAACLBQAw4wEBAPECACHmAUAA8gIAIa4CAQD-AgAhrwIBAP4CACGwAkAA_QIAIbECAQD-AgAhsgIBAP4CACGzAgEA_gIAIbQCAQD-AgAhtQIBAP4CACG2AgEA_gIAIbcCQAD9AgAhuAICAIEDACG5AgIAiAMAIboCAQD-AgAhuwICAIgDACG8AgIAiAMAIb0CAgCBAwAhEeMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG1AgEAqwMAIbYCAQCrAwAhtwJAAKoDACG4AgIAtgMAIbkCAgDOAwAhugIBAKsDACG7AgIAzgMAIbwCAgDOAwAhvQICALYDACEdBAAAgQQAIAYAAIIEACAIAACDBAAgCQAAhAQAIA0AAIUEACAOAACGBAAgDwAAhwQAIBAAAIgEACATAACJBAAgFAAAigQAIBYAAIsEACAXAACMBAAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIR0EAACQBQAgBgAAkQUAIAgAAJIFACAJAACTBQAgDQAAlAUAIA4AAJUFACAPAACWBQAgEAAAlwUAIBMAAJgFACAUAACZBQAgFgAAmgUAIBcAAJsFACDjAQEAAAAB5gFAAAAAAa4CAQAAAAGvAgEAAAABsAJAAAAAAbECAQAAAAGyAgEAAAABswIBAAAAAbUCAQAAAAG2AgEAAAABtwJAAAAAAbgCAgAAAAG5AgIAAAABugIBAAAAAbsCAgAAAAG8AgIAAAABvQICAAAAAQQkAACEBQAwxwIAAIUFADDJAgAAhwUAIM0CAACIBQAwAyQAAP8EACDHAgAAgAUAIM0CAABTACAEJAAA8wQAMMcCAAD0BAAwyQIAAPYEACDNAgAA9wQAMAQkAADnBAAwxwIAAOgEADDJAgAA6gQAIM0CAADrBAAwBCQAANsEADDHAgAA3AQAMMkCAADeBAAgzQIAAN8EADAEJAAAzwQAMMcCAADQBAAwyQIAANIEACDNAgAA0wQAMAQkAADDBAAwxwIAAMQEADDJAgAAxgQAIM0CAADHBAAwBCQAALcEADDHAgAAuAQAMMkCAAC6BAAgzQIAALsEADAEJAAArgQAMMcCAACvBAAwyQIAALEEACDNAgAApgQAMAQkAACiBAAwxwIAAKMEADDJAgAApQQAIM0CAACmBAAwBCQAAJkEADDHAgAAmgQAMMkCAACcBAAgzQIAAJEEADAEJAAAjQQAMMcCAACOBAAwyQIAAJAEACDNAgAAkQQAMAMkAACpBQAgxwIAAKoFACDNAgAAAQAgAwcAAPoDACALAACeBQAgnQIAAKUDACAAAAEFAAD6AwAgAAAAAAAAAAAeAQAAnAUAIAYAAJEFACAIAACSBQAgCQAAkwUAIA0AAJQFACAOAACVBQAgDwAAlgUAIBAAAJcFACATAACYBQAgFAAAmQUAIBYAAJoFACAXAACbBQAg4wEBAAAAAeYBQAAAAAGuAgEAAAABrwIBAAAAAbACQAAAAAGxAgEAAAABsgIBAAAAAbMCAQAAAAG0AgEAAAABtQIBAAAAAbYCAQAAAAG3AkAAAAABuAICAAAAAbkCAgAAAAG6AgEAAAABuwICAAAAAbwCAgAAAAG9AgIAAAABAgAAAAEAICQAAKkFACAR4wEBAAAAAeYBQAAAAAGuAgEAAAABrwIBAAAAAbACQAAAAAGxAgEAAAABsgIBAAAAAbMCAQAAAAG1AgEAAAABtgIBAAAAAbcCQAAAAAG4AgIAAAABuQICAAAAAboCAQAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAEL4wEBAAAAAaMCAQAAAAGkAgEAAAABpQIBAAAAAaYCAQAAAAGnAgEAAAABqAICAAAAAakCAQAAAAGqAgEAAAABqwIBAAAAAawCAQAAAAED4wEBAAAAAaACQAAAAAGiAgEAAAABB-MBAQAAAAGEAgEAAAABhgIBAAAAAZsCAQAAAAGcAkAAAAABnQJAAAAAAZ4CAgAAAAENCwIAAAAB4wEBAAAAAf0BAgAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGUAggAAAABlQICAAAAAZYCAgAAAAGXAgIAAAABmAICAAAAAZkCQAAAAAGaAkAAAAABBeMBAQAAAAH8AQEAAAAB_wECAAAAAYACQAAAAAGBAiAAAAABBOMBAQAAAAH8AQEAAAAB_QECAAAAAf4BQAAAAAEH4wEBAAAAAeYBQAAAAAHyAQEAAAAB9AEAAK4DACD1AUAAAAAB9gFAAAAAAfcBAQAAAAEH4wEBAAAAAeYBQAAAAAHyAQEAAAAB8wEBAAAAAfQBAACuAwAg9QFAAAAAAfYBQAAAAAED4wEBAAAAAeUBAQAAAAHmAUAAAAABA-MBAQAAAAHkAQEAAAAB5gFAAAAAAQMAAAADACAkAACpBQAgJQAAuAUAICAAAAADACABAACABAAgBgAAggQAIAgAAIMEACAJAACEBAAgDQAAhQQAIA4AAIYEACAPAACHBAAgEAAAiAQAIBMAAIkEACAUAACKBAAgFgAAiwQAIBcAAIwEACAdAAC4BQAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhHgEAAIAEACAGAACCBAAgCAAAgwQAIAkAAIQEACANAACFBAAgDgAAhgQAIA8AAIcEACAQAACIBAAgEwAAiQQAIBQAAIoEACAWAACLBAAgFwAAjAQAIOMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG0AgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIR4BAACcBQAgBAAAkAUAIAgAAJIFACAJAACTBQAgDQAAlAUAIA4AAJUFACAPAACWBQAgEAAAlwUAIBMAAJgFACAUAACZBQAgFgAAmgUAIBcAAJsFACDjAQEAAAAB5gFAAAAAAa4CAQAAAAGvAgEAAAABsAJAAAAAAbECAQAAAAGyAgEAAAABswIBAAAAAbQCAQAAAAG1AgEAAAABtgIBAAAAAbcCQAAAAAG4AgIAAAABuQICAAAAAboCAQAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAECAAAAAQAgJAAAuQUAIAMAAAADACAkAAC5BQAgJQAAvQUAICAAAAADACABAACABAAgBAAAgQQAIAgAAIMEACAJAACEBAAgDQAAhQQAIA4AAIYEACAPAACHBAAgEAAAiAQAIBMAAIkEACAUAACKBAAgFgAAiwQAIBcAAIwEACAdAAC9BQAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhHgEAAIAEACAEAACBBAAgCAAAgwQAIAkAAIQEACANAACFBAAgDgAAhgQAIA8AAIcEACAQAACIBAAgEwAAiQQAIBQAAIoEACAWAACLBAAgFwAAjAQAIOMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG0AgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIR4BAACcBQAgBAAAkAUAIAYAAJEFACAJAACTBQAgDQAAlAUAIA4AAJUFACAPAACWBQAgEAAAlwUAIBMAAJgFACAUAACZBQAgFgAAmgUAIBcAAJsFACDjAQEAAAAB5gFAAAAAAa4CAQAAAAGvAgEAAAABsAJAAAAAAbECAQAAAAGyAgEAAAABswIBAAAAAbQCAQAAAAG1AgEAAAABtgIBAAAAAbcCQAAAAAG4AgIAAAABuQICAAAAAboCAQAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAECAAAAAQAgJAAAvgUAIAMAAAADACAkAAC-BQAgJQAAwgUAICAAAAADACABAACABAAgBAAAgQQAIAYAAIIEACAJAACEBAAgDQAAhQQAIA4AAIYEACAPAACHBAAgEAAAiAQAIBMAAIkEACAUAACKBAAgFgAAiwQAIBcAAIwEACAdAADCBQAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhHgEAAIAEACAEAACBBAAgBgAAggQAIAkAAIQEACANAACFBAAgDgAAhgQAIA8AAIcEACAQAACIBAAgEwAAiQQAIBQAAIoEACAWAACLBAAgFwAAjAQAIOMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG0AgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIR4BAACcBQAgBAAAkAUAIAYAAJEFACAIAACSBQAgDQAAlAUAIA4AAJUFACAPAACWBQAgEAAAlwUAIBMAAJgFACAUAACZBQAgFgAAmgUAIBcAAJsFACDjAQEAAAAB5gFAAAAAAa4CAQAAAAGvAgEAAAABsAJAAAAAAbECAQAAAAGyAgEAAAABswIBAAAAAbQCAQAAAAG1AgEAAAABtgIBAAAAAbcCQAAAAAG4AgIAAAABuQICAAAAAboCAQAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAECAAAAAQAgJAAAwwUAIAMAAAADACAkAADDBQAgJQAAxwUAICAAAAADACABAACABAAgBAAAgQQAIAYAAIIEACAIAACDBAAgDQAAhQQAIA4AAIYEACAPAACHBAAgEAAAiAQAIBMAAIkEACAUAACKBAAgFgAAiwQAIBcAAIwEACAdAADHBQAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhHgEAAIAEACAEAACBBAAgBgAAggQAIAgAAIMEACANAACFBAAgDgAAhgQAIA8AAIcEACAQAACIBAAgEwAAiQQAIBQAAIoEACAWAACLBAAgFwAAjAQAIOMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG0AgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIR4BAACcBQAgBAAAkAUAIAYAAJEFACAIAACSBQAgCQAAkwUAIA4AAJUFACAPAACWBQAgEAAAlwUAIBMAAJgFACAUAACZBQAgFgAAmgUAIBcAAJsFACDjAQEAAAAB5gFAAAAAAa4CAQAAAAGvAgEAAAABsAJAAAAAAbECAQAAAAGyAgEAAAABswIBAAAAAbQCAQAAAAG1AgEAAAABtgIBAAAAAbcCQAAAAAG4AgIAAAABuQICAAAAAboCAQAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAECAAAAAQAgJAAAyAUAIA3jAQEAAAAB_QEgAAAAAYMCAQAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIBAAAAAYkCAQAAAAGKAgIAAAABiwJAAAAAAYwCAgAAAAGNAoAAAAABAwAAAAMAICQAAMgFACAlAADNBQAgIAAAAAMAIAEAAIAEACAEAACBBAAgBgAAggQAIAgAAIMEACAJAACEBAAgDgAAhgQAIA8AAIcEACAQAACIBAAgEwAAiQQAIBQAAIoEACAWAACLBAAgFwAAjAQAIB0AAM0FACDjAQEAnwMAIeYBQACgAwAhrgIBAKsDACGvAgEAqwMAIbACQACqAwAhsQIBAKsDACGyAgEAqwMAIbMCAQCrAwAhtAIBAKsDACG1AgEAqwMAIbYCAQCrAwAhtwJAAKoDACG4AgIAtgMAIbkCAgDOAwAhugIBAKsDACG7AgIAzgMAIbwCAgDOAwAhvQICALYDACEeAQAAgAQAIAQAAIEEACAGAACCBAAgCAAAgwQAIAkAAIQEACAOAACGBAAgDwAAhwQAIBAAAIgEACATAACJBAAgFAAAigQAIBYAAIsEACAXAACMBAAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhHgEAAJwFACAEAACQBQAgBgAAkQUAIAgAAJIFACAJAACTBQAgDQAAlAUAIA8AAJYFACAQAACXBQAgEwAAmAUAIBQAAJkFACAWAACaBQAgFwAAmwUAIOMBAQAAAAHmAUAAAAABrgIBAAAAAa8CAQAAAAGwAkAAAAABsQIBAAAAAbICAQAAAAGzAgEAAAABtAIBAAAAAbUCAQAAAAG2AgEAAAABtwJAAAAAAbgCAgAAAAG5AgIAAAABugIBAAAAAbsCAgAAAAG8AgIAAAABvQICAAAAAQIAAAABACAkAADOBQAgAwAAAAMAICQAAM4FACAlAADSBQAgIAAAAAMAIAEAAIAEACAEAACBBAAgBgAAggQAIAgAAIMEACAJAACEBAAgDQAAhQQAIA8AAIcEACAQAACIBAAgEwAAiQQAIBQAAIoEACAWAACLBAAgFwAAjAQAIB0AANIFACDjAQEAnwMAIeYBQACgAwAhrgIBAKsDACGvAgEAqwMAIbACQACqAwAhsQIBAKsDACGyAgEAqwMAIbMCAQCrAwAhtAIBAKsDACG1AgEAqwMAIbYCAQCrAwAhtwJAAKoDACG4AgIAtgMAIbkCAgDOAwAhugIBAKsDACG7AgIAzgMAIbwCAgDOAwAhvQICALYDACEeAQAAgAQAIAQAAIEEACAGAACCBAAgCAAAgwQAIAkAAIQEACANAACFBAAgDwAAhwQAIBAAAIgEACATAACJBAAgFAAAigQAIBYAAIsEACAXAACMBAAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhCQcAAOQDACDjAQEAAAAB-wEBAAAAAYQCAQAAAAGGAgEAAAABmwIBAAAAAZwCQAAAAAGdAkAAAAABngICAAAAAQIAAAATACAkAADTBQAgAwAAABEAICQAANMFACAlAADXBQAgCwAAABEAIAcAANYDACAdAADXBQAg4wEBAJ8DACH7AQEAnwMAIYQCAQCfAwAhhgIBAJ8DACGbAgEAnwMAIZwCQACgAwAhnQJAAKoDACGeAgIAtgMAIQkHAADWAwAg4wEBAJ8DACH7AQEAnwMAIYQCAQCfAwAhhgIBAJ8DACGbAgEAnwMAIZwCQACgAwAhnQJAAKoDACGeAgIAtgMAIR4BAACcBQAgBAAAkAUAIAYAAJEFACAIAACSBQAgCQAAkwUAIA0AAJQFACAOAACVBQAgEAAAlwUAIBMAAJgFACAUAACZBQAgFgAAmgUAIBcAAJsFACDjAQEAAAAB5gFAAAAAAa4CAQAAAAGvAgEAAAABsAJAAAAAAbECAQAAAAGyAgEAAAABswIBAAAAAbQCAQAAAAG1AgEAAAABtgIBAAAAAbcCQAAAAAG4AgIAAAABuQICAAAAAboCAQAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAECAAAAAQAgJAAA2AUAIAMAAAADACAkAADYBQAgJQAA3AUAICAAAAADACABAACABAAgBAAAgQQAIAYAAIIEACAIAACDBAAgCQAAhAQAIA0AAIUEACAOAACGBAAgEAAAiAQAIBMAAIkEACAUAACKBAAgFgAAiwQAIBcAAIwEACAdAADcBQAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhHgEAAIAEACAEAACBBAAgBgAAggQAIAgAAIMEACAJAACEBAAgDQAAhQQAIA4AAIYEACAQAACIBAAgEwAAiQQAIBQAAIoEACAWAACLBAAgFwAAjAQAIOMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG0AgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIR4BAACcBQAgBAAAkAUAIAYAAJEFACAIAACSBQAgCQAAkwUAIA0AAJQFACAOAACVBQAgDwAAlgUAIBMAAJgFACAUAACZBQAgFgAAmgUAIBcAAJsFACDjAQEAAAAB5gFAAAAAAa4CAQAAAAGvAgEAAAABsAJAAAAAAbECAQAAAAGyAgEAAAABswIBAAAAAbQCAQAAAAG1AgEAAAABtgIBAAAAAbcCQAAAAAG4AgIAAAABuQICAAAAAboCAQAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAECAAAAAQAgJAAA3QUAIAMAAAADACAkAADdBQAgJQAA4QUAICAAAAADACABAACABAAgBAAAgQQAIAYAAIIEACAIAACDBAAgCQAAhAQAIA0AAIUEACAOAACGBAAgDwAAhwQAIBMAAIkEACAUAACKBAAgFgAAiwQAIBcAAIwEACAdAADhBQAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhHgEAAIAEACAEAACBBAAgBgAAggQAIAgAAIMEACAJAACEBAAgDQAAhQQAIA4AAIYEACAPAACHBAAgEwAAiQQAIBQAAIoEACAWAACLBAAgFwAAjAQAIOMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG0AgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIR4BAACcBQAgBAAAkAUAIAYAAJEFACAIAACSBQAgCQAAkwUAIA0AAJQFACAOAACVBQAgDwAAlgUAIBAAAJcFACATAACYBQAgFgAAmgUAIBcAAJsFACDjAQEAAAAB5gFAAAAAAa4CAQAAAAGvAgEAAAABsAJAAAAAAbECAQAAAAGyAgEAAAABswIBAAAAAbQCAQAAAAG1AgEAAAABtgIBAAAAAbcCQAAAAAG4AgIAAAABuQICAAAAAboCAQAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAECAAAAAQAgJAAA4gUAIB4BAACcBQAgBAAAkAUAIAYAAJEFACAIAACSBQAgCQAAkwUAIA0AAJQFACAOAACVBQAgDwAAlgUAIBAAAJcFACAUAACZBQAgFgAAmgUAIBcAAJsFACDjAQEAAAAB5gFAAAAAAa4CAQAAAAGvAgEAAAABsAJAAAAAAbECAQAAAAGyAgEAAAABswIBAAAAAbQCAQAAAAG1AgEAAAABtgIBAAAAAbcCQAAAAAG4AgIAAAABuQICAAAAAboCAQAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAECAAAAAQAgJAAA5AUAIAMAAAADACAkAADiBQAgJQAA6AUAICAAAAADACABAACABAAgBAAAgQQAIAYAAIIEACAIAACDBAAgCQAAhAQAIA0AAIUEACAOAACGBAAgDwAAhwQAIBAAAIgEACATAACJBAAgFgAAiwQAIBcAAIwEACAdAADoBQAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhHgEAAIAEACAEAACBBAAgBgAAggQAIAgAAIMEACAJAACEBAAgDQAAhQQAIA4AAIYEACAPAACHBAAgEAAAiAQAIBMAAIkEACAWAACLBAAgFwAAjAQAIOMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG0AgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIQMAAAADACAkAADkBQAgJQAA6wUAICAAAAADACABAACABAAgBAAAgQQAIAYAAIIEACAIAACDBAAgCQAAhAQAIA0AAIUEACAOAACGBAAgDwAAhwQAIBAAAIgEACAUAACKBAAgFgAAiwQAIBcAAIwEACAdAADrBQAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhHgEAAIAEACAEAACBBAAgBgAAggQAIAgAAIMEACAJAACEBAAgDQAAhQQAIA4AAIYEACAPAACHBAAgEAAAiAQAIBQAAIoEACAWAACLBAAgFwAAjAQAIOMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG0AgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIR4BAACcBQAgBAAAkAUAIAYAAJEFACAIAACSBQAgCQAAkwUAIA0AAJQFACAOAACVBQAgDwAAlgUAIBAAAJcFACATAACYBQAgFAAAmQUAIBYAAJoFACDjAQEAAAAB5gFAAAAAAa4CAQAAAAGvAgEAAAABsAJAAAAAAbECAQAAAAGyAgEAAAABswIBAAAAAbQCAQAAAAG1AgEAAAABtgIBAAAAAbcCQAAAAAG4AgIAAAABuQICAAAAAboCAQAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAECAAAAAQAgJAAA7AUAIB4BAACcBQAgBAAAkAUAIAYAAJEFACAIAACSBQAgCQAAkwUAIA0AAJQFACAOAACVBQAgDwAAlgUAIBAAAJcFACATAACYBQAgFAAAmQUAIBcAAJsFACDjAQEAAAAB5gFAAAAAAa4CAQAAAAGvAgEAAAABsAJAAAAAAbECAQAAAAGyAgEAAAABswIBAAAAAbQCAQAAAAG1AgEAAAABtgIBAAAAAbcCQAAAAAG4AgIAAAABuQICAAAAAboCAQAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAECAAAAAQAgJAAA7gUAIAMAAAADACAkAADsBQAgJQAA8gUAICAAAAADACABAACABAAgBAAAgQQAIAYAAIIEACAIAACDBAAgCQAAhAQAIA0AAIUEACAOAACGBAAgDwAAhwQAIBAAAIgEACATAACJBAAgFAAAigQAIBYAAIsEACAdAADyBQAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhHgEAAIAEACAEAACBBAAgBgAAggQAIAgAAIMEACAJAACEBAAgDQAAhQQAIA4AAIYEACAPAACHBAAgEAAAiAQAIBMAAIkEACAUAACKBAAgFgAAiwQAIOMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG0AgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIQMAAAADACAkAADuBQAgJQAA9QUAICAAAAADACABAACABAAgBAAAgQQAIAYAAIIEACAIAACDBAAgCQAAhAQAIA0AAIUEACAOAACGBAAgDwAAhwQAIBAAAIgEACATAACJBAAgFAAAigQAIBcAAIwEACAdAAD1BQAg4wEBAJ8DACHmAUAAoAMAIa4CAQCrAwAhrwIBAKsDACGwAkAAqgMAIbECAQCrAwAhsgIBAKsDACGzAgEAqwMAIbQCAQCrAwAhtQIBAKsDACG2AgEAqwMAIbcCQACqAwAhuAICALYDACG5AgIAzgMAIboCAQCrAwAhuwICAM4DACG8AgIAzgMAIb0CAgC2AwAhHgEAAIAEACAEAACBBAAgBgAAggQAIAgAAIMEACAJAACEBAAgDQAAhQQAIA4AAIYEACAPAACHBAAgEAAAiAQAIBMAAIkEACAUAACKBAAgFwAAjAQAIOMBAQCfAwAh5gFAAKADACGuAgEAqwMAIa8CAQCrAwAhsAJAAKoDACGxAgEAqwMAIbICAQCrAwAhswIBAKsDACG0AgEAqwMAIbUCAQCrAwAhtgIBAKsDACG3AkAAqgMAIbgCAgC2AwAhuQICAM4DACG6AgEAqwMAIbsCAgDOAwAhvAICAM4DACG9AgIAtgMAIQ4BBAEEBgEGCAIIDAMJEAQMAA0NFAUOHQgPIQkQJQoTKQsUKwsWLwwXMAwBBQABAQcAAQEHAAEDBwABCxgGDAAHAQoABQELGQABBwABAQcAAQEHAAECEQABEioBAgUAARUAAQsEMQAIMgAJMwANNAAONQAPNgAQNwATOAAUOQAWOgAXOwAAAQFFAQEBSwEFDAASKgATKwAULAAVLQAWAAAAAAAFDAASKgATKwAULAAVLQAWAQUAAQEFAAEDDAAbLAAcLQAdAAAAAwwAGywAHC0AHQEHAAEBBwABBQwAIioAIysAJCwAJS0AJgAAAAAABQwAIioAIysAJCwAJS0AJgEHAAEBBwABAwwAKywALC0ALQAAAAMMACssACwtAC0AAAADDAAzLAA0LQA1AAAAAwwAMywANC0ANQEHAAEBBwABBQwAOioAOysAPCwAPS0APgAAAAAABQwAOioAOysAPCwAPS0APgEHAAEBBwABBQwAQyoARCsARSwARi0ARwAAAAAABQwAQyoARCsARSwARi0ARwEKAAUBCgAFBQwATCoATSsATiwATy0AUAAAAAAABQwATCoATSsATiwATy0AUAEHAAEBBwABBQwAVSoAVisAVywAWC0AWQAAAAAABQwAVSoAVisAVywAWC0AWQEHAAEBBwABBQwAXioAXysAYCwAYS0AYgAAAAAABQwAXioAXysAYCwAYS0AYgIRAAESqAIBAhEAARKuAgEDDABnLABoLQBpAAAAAwwAZywAaC0AaQIFAAEVAAECBQABFQABAwwAbiwAby0AcAAAAAMMAG4sAG8tAHAYAgEZPAEaPQEbPgEcPwEeQQEfQw4gRA8hRwEiSQ4jShAmTAEnTQEoTg4uUREvUhcwVAIxVQIyVwIzWAI0WQI1WwI2XQ43Xhg4YAI5Yg46Yxk7ZAI8ZQI9Zg4-aRo_ah5AawNBbANCbQNDbgNEbwNFcQNGcw5HdB9IdgNJeA5KeSBLegNMewNNfA5OfyFPgAEnUIEBBFGCAQRSgwEEU4QBBFSFAQRVhwEEVokBDleKAShYjAEEWY4BDlqPASlbkAEEXJEBBF2SAQ5elQEqX5YBLmCYAS9hmQEvYpwBL2OdAS9kngEvZaABL2aiAQ5nowEwaKUBL2mnAQ5qqAExa6kBL2yqAS9tqwEObq4BMm-vATZwsAEFcbEBBXKyAQVzswEFdLQBBXW2AQV2uAEOd7kBN3i7AQV5vQEOer4BOHu_AQV8wAEFfcEBDn7EATl_xQE_gAHGAQiBAccBCIIByAEIgwHJAQiEAcoBCIUBzAEIhgHOAQ6HAc8BQIgB0QEIiQHTAQ6KAdQBQYsB1QEIjAHWAQiNAdcBDo4B2gFCjwHbAUiQAdwBBpEB3QEGkgHeAQaTAd8BBpQB4AEGlQHiAQaWAeQBDpcB5QFJmAHnAQaZAekBDpoB6gFKmwHrAQacAewBBp0B7QEOngHwAUufAfEBUaAB8gEJoQHzAQmiAfQBCaMB9QEJpAH2AQmlAfgBCaYB-gEOpwH7AVKoAf0BCakB_wEOqgGAAlOrAYECCawBggIJrQGDAg6uAYYCVK8BhwJasAGIAgqxAYkCCrIBigIKswGLAgq0AYwCCrUBjgIKtgGQAg63AZECW7gBkwIKuQGVAg66AZYCXLsBlwIKvAGYAgq9AZkCDr4BnAJdvwGdAmPAAZ4CC8EBnwILwgGgAgvDAaECC8QBogILxQGkAgvGAaYCDscBpwJkyAGqAgvJAawCDsoBrQJlywGvAgvMAbACC80BsQIOzgG0AmbPAbUCatABtgIM0QG3AgzSAbgCDNMBuQIM1AG6AgzVAbwCDNYBvgIO1wG_AmvYAcECDNkBwwIO2gHEAmzbAcUCDNwBxgIM3QHHAg7eAcoCbd8BywJx"
};
async function decodeBase64AsWasm(wasmBase64) {
  const { Buffer: Buffer2 } = await import("node:buffer");
  const wasmArray = Buffer2.from(wasmBase64, "base64");
  return new WebAssembly.Module(wasmArray);
}
config.compilerWasm = {
  getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs"),
  getQueryCompilerWasmModule: async () => {
    const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
    return await decodeBase64AsWasm(wasm);
  },
  importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
  return runtime.getPrismaClient(config);
}

// src/generated/prisma/internal/prismaNamespace.ts
import * as runtime2 from "@prisma/client/runtime/client";
var getExtensionContext = runtime2.Extensions.getExtensionContext;
var NullTypes2 = {
  DbNull: runtime2.NullTypes.DbNull,
  JsonNull: runtime2.NullTypes.JsonNull,
  AnyNull: runtime2.NullTypes.AnyNull
};
var TransactionIsolationLevel = runtime2.makeStrictEnum({
  ReadUncommitted: "ReadUncommitted",
  ReadCommitted: "ReadCommitted",
  RepeatableRead: "RepeatableRead",
  Serializable: "Serializable"
});
var defineExtension = runtime2.Extensions.defineExtension;

// src/generated/prisma/client.ts
globalThis["__dirname"] = path.dirname(fileURLToPath(import.meta.url));
var PrismaClient = getPrismaClientClass();

// src/db.ts
import { PrismaPg } from "@prisma/adapter-pg";

// src/env.ts
var connectionString = process.env.DATABASE_URL;
var DATABASE_URL = connectionString;
var isDatabaseConfigured = Boolean(
  connectionString && !connectionString.includes("user:password@host")
);
var PORT = Number(process.env.PORT ?? 3001);
var webOrigins = () => (process.env.LEARNR_WEB_ORIGINS ?? "http://localhost:3000").split(",").map((origin) => origin.trim()).filter(Boolean);

// src/db.ts
var globalForPrisma = globalThis;
function createClient() {
  if (!isDatabaseConfigured) return null;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
}
var prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production" && prisma) globalForPrisma.prisma = prisma;

// src/auth/session.ts
async function resolveUserId(token) {
  if (!prisma || !token) return null;
  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      select: { userId: true, expires: true }
    });
    if (!session) return null;
    if (session.expires.getTime() <= Date.now()) return null;
    return session.userId;
  } catch (error) {
    console.error("Failed to resolve a session", error);
    return null;
  }
}

// src/data/accounts.ts
import { randomInt, randomUUID } from "node:crypto";

// ../../src/lib/login-code.ts
var CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
var CODE_LENGTH = 4;
var CODE_TTL_MS = 60 * 60 * 1e3;
var REDEEM_FAILURE_WINDOW_MS = 15 * 60 * 1e3;
var REDEEM_BACKSTOP_LIMIT = 120;
function generateLoginCode(randomInt3) {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_CHARSET[randomInt3(CODE_CHARSET.length)];
  }
  return code;
}
function codeExpiry(now) {
  return new Date(now.getTime() + CODE_TTL_MS);
}
function normaliseCode(input) {
  const trimmed = input.trim().toUpperCase();
  if (trimmed.length !== CODE_LENGTH) return null;
  for (const char of trimmed) {
    if (!CODE_CHARSET.includes(char)) return null;
  }
  return trimmed;
}

// ../../src/lib/revive.ts
var ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

// ../../src/lib/day.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
var localDay = (at, offsetMinutes = 0) => Math.floor((at + offsetMinutes * 6e4) / DAY_MS);
var OFFSET_LIMIT = 14 * 60;
var SKEW_LIMIT_MS = 5 * 6e4;
var BACKDATE_LIMIT_MS = 30 * DAY_MS;
function parsePlayedAt(value, now) {
  if (typeof value !== "string") return null;
  if (!ISO_TIMESTAMP.test(value)) return null;
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return null;
  if (ms > now + SKEW_LIMIT_MS) return null;
  if (ms < now - BACKDATE_LIMIT_MS) return null;
  return new Date(ms);
}

// ../../src/lib/rewards/target.ts
var TARGET_STARS = 10;
var TARGET_LIMITS = {
  questions: { min: 10, max: 60, step: 5 },
  minutes: { min: 5, max: 30, step: 5 }
};
var MINUTE_MS = 6e4;
var isTargetKind = (value) => value === "questions" || value === "minutes";
function parseTarget(kind, value) {
  if (!isTargetKind(kind)) return null;
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isInteger(number)) return null;
  const { min, max, step } = TARGET_LIMITS[kind];
  if (number < min || number > max || (number - min) % step !== 0) return null;
  return { kind, value: number };
}
var targetUnits = (target) => target.kind === "minutes" ? target.value * MINUTE_MS : target.value;
var totalFor = (total, kind) => kind === "minutes" ? total.timeMs : total.questions;
function dayTotal(answers, { now, offsetMinutes = 0 }) {
  const today = localDay(now, offsetMinutes);
  return answers.reduce(
    (total, answer) => localDay(answer.answeredAt, offsetMinutes) === today ? { questions: total.questions + 1, timeMs: total.timeMs + answer.timeTakenMs } : total,
    { questions: 0, timeMs: 0 }
  );
}
function targetProgress(target, done) {
  const units = targetUnits(target);
  return {
    done,
    target: units,
    fraction: units <= 0 ? 0 : Math.min(1, done / units),
    complete: done >= units
  };
}
var dayProgress = (target, total) => targetProgress(target, totalFor(total, target.kind));

// ../../src/lib/photo/photo.ts
var PHOTO_PREFIX = "data:image/webp;base64,";
var MAX_PHOTO_BYTES = 64 * 1024;
var BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
function decodedBytes(base64) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor(base64.length * 3 / 4) - padding;
}
function parsePhoto(value) {
  if (typeof value !== "string" || !value.startsWith(PHOTO_PREFIX)) return null;
  const payload = value.slice(PHOTO_PREFIX.length);
  if (payload.length === 0 || !BASE64.test(payload)) return null;
  if (decodedBytes(payload) > MAX_PHOTO_BYTES) return null;
  return value;
}

// src/data/accounts.ts
function parseRole(value) {
  return value === "parent" || value === "child" ? value : null;
}
async function readAccount(userId) {
  if (!prisma) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        parentId: true,
        name: true,
        avatar: true,
        image: true,
        photo: { select: { dataUrl: true } }
      }
    });
    if (!user) return null;
    return {
      id: user.id,
      role: parseRole(user.role),
      parentId: user.parentId,
      name: user.name,
      avatar: parseAvatar(user.avatar),
      image: user.image,
      photo: parsePhoto(user.photo?.dataUrl)
    };
  } catch (error) {
    console.error("Failed to read account", error);
    return null;
  }
}
async function claimParentRole(userId) {
  if (!prisma) return false;
  try {
    const written = await prisma.user.updateMany({
      where: { id: userId, role: null },
      data: { role: "parent" }
    });
    return written.count > 0;
  } catch (error) {
    console.error("Failed to claim the parent role", error);
    return false;
  }
}
async function listChildren(parentId) {
  if (!prisma) return [];
  try {
    const rows = await prisma.user.findMany({
      where: { parentId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        avatar: true,
        photo: { select: { dataUrl: true } },
        selectedLevel: true,
        targetKind: true,
        targetValue: true,
        loginCode: true,
        loginCodeExpiresAt: true
      }
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      avatar: parseAvatar(row.avatar) ?? "fox",
      photo: parsePhoto(row.photo?.dataUrl),
      level: row.selectedLevel,
      target: parseTarget(row.targetKind, row.targetValue),
      code: row.loginCode,
      codeExpiresAt: row.loginCodeExpiresAt
    }));
  } catch (error) {
    console.error("Failed to list children", error);
    return null;
  }
}
async function createChild(parentId, input) {
  if (!prisma) return null;
  try {
    const child = await prisma.user.create({
      data: {
        parentId,
        role: "child",
        name: input.name,
        avatar: input.avatar,
        selectedLevel: input.level,
        targetKind: input.target?.kind ?? null,
        targetValue: input.target?.value ?? null,
        // A nested create, so the photograph lands in the same statement as the
        // row it belongs to: there is no moment where the child exists without
        // the face their parent just cropped, and nothing to clean up if the
        // create fails.
        photo: input.photo ? { create: { dataUrl: input.photo } } : void 0
      },
      select: { id: true }
    });
    return child.id;
  } catch (error) {
    console.error("Failed to create child", error);
    return null;
  }
}
async function updateChild(parentId, childId, input) {
  if (!prisma) return false;
  const db = prisma;
  try {
    return await db.$transaction(async (tx) => {
      const written = await tx.user.updateMany({
        where: { id: childId, parentId },
        data: {
          name: input.name,
          avatar: input.avatar,
          selectedLevel: input.level,
          targetKind: input.target?.kind ?? null,
          targetValue: input.target?.value ?? null
        }
      });
      if (written.count === 0) return false;
      if (input.photo) {
        await tx.childPhoto.upsert({
          where: { childId },
          create: { childId, dataUrl: input.photo },
          update: { dataUrl: input.photo }
        });
      } else {
        await tx.childPhoto.deleteMany({ where: { childId } });
      }
      return true;
    });
  } catch (error) {
    console.error("Failed to update child", error);
    return false;
  }
}
async function removeChild(parentId, childId) {
  if (!prisma) return false;
  try {
    const removed = await prisma.user.deleteMany({ where: { id: childId, parentId } });
    return removed.count > 0;
  } catch (error) {
    console.error("Failed to remove child", error);
    return false;
  }
}
var CODE_ATTEMPTS = 4;
var isUniqueViolation = (error) => typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
async function issueLoginCode(parentId, childId, now = /* @__PURE__ */ new Date()) {
  if (!prisma) return null;
  for (let tries = 0; tries < CODE_ATTEMPTS; tries += 1) {
    const code = generateLoginCode((max) => randomInt(max));
    try {
      const written = await prisma.user.updateMany({
        where: { id: childId, parentId },
        data: { loginCode: code, loginCodeExpiresAt: codeExpiry(now) }
      });
      return written.count > 0 ? code : null;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        console.error("Failed to issue login code", error);
        return null;
      }
    }
  }
  console.error(`Gave up generating a login code after ${CODE_ATTEMPTS} tries`);
  return null;
}
var SESSION_LIFETIME_MS = 100 * 365 * 24 * 60 * 60 * 1e3;
async function redeemLoginCode(input, now = /* @__PURE__ */ new Date()) {
  if (!prisma) return null;
  const code = normaliseCode(input);
  if (!code) return null;
  const db = prisma;
  try {
    return await db.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw`
        UPDATE "User"
        SET "loginCode" = NULL, "loginCodeExpiresAt" = NULL
        WHERE "loginCode" = ${code} AND "loginCodeExpiresAt" > ${now}
        RETURNING "id"
      `;
      const child = claimed[0];
      if (!child) return null;
      const token = randomUUID();
      const expires = new Date(now.getTime() + SESSION_LIFETIME_MS);
      await tx.session.create({ data: { sessionToken: token, userId: child.id, expires } });
      return { token, expires, userId: child.id };
    });
  } catch (error) {
    console.error("Failed to redeem login code", error);
    return null;
  }
}

// src/auth/plugin.ts
var COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token";
var MAX_TOKENS = 4;
function tokensFrom(request) {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return [header.slice("Bearer ".length)];
  const cookie = request.headers.cookie;
  if (!cookie) return [];
  const tokens = [];
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) tokens.push(decodeURIComponent(rest.join("=")));
    if (tokens.length === MAX_TOKENS) break;
  }
  return tokens;
}
var authPlugin = fp(async (app2) => {
  app2.decorateRequest("userId", null);
  app2.addHook("onRequest", async (request) => {
    const started = performance.now();
    const tokens = tokensFrom(request);
    for (const token of tokens) {
      request.userId = await resolveUserId(token);
      if (request.userId) break;
    }
    if (tokens.length > 0) request.authMs = performance.now() - started;
  });
});
function requireUser(request) {
  if (!request.userId) {
    const error = new Error("Not signed in");
    error.statusCode = 401;
    throw error;
  }
  return request.userId;
}
async function requireParent(request) {
  const userId = requireUser(request);
  const account = await readAccount(userId);
  if (account?.role !== "parent") {
    const error = new Error("Not a parent");
    error.statusCode = 403;
    throw error;
  }
  return userId;
}

// src/timing.ts
import fp2 from "fastify-plugin";
var timingPlugin = fp2(async (app2) => {
  app2.decorateRequest("authMs", null);
  app2.addHook("onResponse", async (request, reply) => {
    const auth = request.authMs === null ? "" : ` auth=${Math.round(request.authMs)}ms`;
    console.log(
      `[timing] ${request.method} ${request.url} ${reply.statusCode} total=${Math.round(reply.elapsedTime)}ms${auth}`
    );
  });
});

// src/routes/auth.ts
import { z as z6 } from "zod";

// ../../src/lib/throttle.ts
var MAX_TRACKED_KEYS = 1e4;
function createThrottle({
  limit,
  windowMs
}) {
  const seen = /* @__PURE__ */ new Map();
  const live = (failures, now) => now - failures.since < windowMs;
  return {
    blocked(key2, now) {
      const failures = seen.get(key2);
      return failures !== void 0 && live(failures, now) && failures.count >= limit;
    },
    fail(key2, now) {
      for (const [seenKey, failures2] of seen) {
        if (!live(failures2, now)) seen.delete(seenKey);
      }
      const failures = seen.get(key2);
      if (failures) {
        seen.delete(key2);
        seen.set(key2, { count: failures.count + 1, since: failures.since });
      } else {
        seen.set(key2, { count: 1, since: now });
      }
      while (seen.size > MAX_TRACKED_KEYS) {
        const stalest = seen.keys().next().value;
        if (stalest === void 0) break;
        seen.delete(stalest);
      }
    },
    clear(key2) {
      seen.delete(key2);
    },
    retryAfterSeconds(key2, now) {
      const failures = seen.get(key2);
      if (!failures) return 0;
      return Math.max(1, Math.ceil((failures.since + windowMs - now) / 1e3));
    },
    size() {
      return seen.size;
    }
  };
}

// src/routes/auth.ts
var authRoutes = async (fastify) => {
  const app2 = fastify.withTypeProvider();
  const redeemFailures = createThrottle({
    limit: REDEEM_BACKSTOP_LIMIT,
    windowMs: REDEEM_FAILURE_WINDOW_MS
  });
  const caller = (request) => {
    const forwarded = request.headers["fly-client-ip"];
    return typeof forwarded === "string" && forwarded.length > 0 ? forwarded : request.ip;
  };
  app2.post("/auth/redeem", {
    schema: {
      operationId: "redeemLoginCode",
      body: z6.object({ code: z6.string().min(1).max(16) }),
      response: {
        200: z6.object({
          token: z6.string(),
          childId: z6.string(),
          expiresAt: z6.string()
        }),
        401: errorSchema,
        429: errorSchema
      }
    }
  }, async (request, reply) => {
    const key2 = caller(request);
    const now = Date.now();
    if (redeemFailures.blocked(key2, now)) {
      return reply.header("retry-after", String(redeemFailures.retryAfterSeconds(key2, now))).code(429).send({ error: "Too many tries. Wait a few minutes and try again." });
    }
    const redeemed = await redeemLoginCode(request.body.code);
    if (!redeemed) {
      redeemFailures.fail(key2, now);
      return reply.code(401).send({ error: "That code did not work" });
    }
    redeemFailures.clear(key2);
    return reply.send({
      token: redeemed.token,
      childId: redeemed.userId,
      expiresAt: redeemed.expires.toISOString()
    });
  });
  app2.post("/me/claim-parent", {
    schema: {
      operationId: "claimParentRole",
      response: { 200: z6.object({ claimed: z6.boolean() }) }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    return reply.send({ claimed: await claimParentRole(userId) });
  });
  app2.get("/me", {
    schema: {
      operationId: "readAccount",
      response: { 200: accountSchema, 503: errorSchema }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const account = await readAccount(userId);
    if (!account) return reply.code(503).send({ error: "Could not read the account" });
    return reply.send(account);
  });
};

// src/routes/sessions.ts
import { z as z7 } from "zod";

// ../../src/lib/analytics/profile.ts
var RECENCY = 0.4;
var MIN_OBSERVATIONS = 4;
var STRUGGLING_BELOW = 0.6;
var SECURE_AT = 0.85;
var SECURE_STREAK = 3;
var SECURE_OBSERVATIONS = 8;
var SECURE_DAYS = 2;
var REVIEW_INTERVALS_MS = [2 * DAY_MS, 5 * DAY_MS, 12 * DAY_MS, 28 * DAY_MS];
function reviewIntervalMs(skill) {
  const step = Math.min(Math.max(skill.correctDays - SECURE_DAYS, 0), REVIEW_INTERVALS_MS.length - 1);
  return REVIEW_INTERVALS_MS[step];
}
function reviewDueAt(skill) {
  return skill.lastAnsweredAt + reviewIntervalMs(skill);
}
var isMastered = (skill) => skill.strength >= SECURE_AT && skill.streak >= SECURE_STREAK && skill.attempts >= SECURE_OBSERVATIONS && skill.correctDays >= SECURE_DAYS;
function skillStatus(skill, now) {
  if (!skill || skill.attempts < MIN_OBSERVATIONS) return "new";
  if (skill.strength < STRUGGLING_BELOW) return "struggling";
  if (isMastered(skill)) return now >= reviewDueAt(skill) ? "review-due" : "secure";
  return "developing";
}
var emptyProfile = () => ({ skills: [] });
function findSkill(profile, topic, level) {
  return profile.skills.find((skill) => skill.topic === topic && skill.level === level);
}
function nextSkill(previous, observation) {
  const outcome = observation.correct ? 1 : 0;
  const day = localDay(observation.answeredAt, observation.offsetMinutes);
  if (!previous) {
    return {
      topic: observation.topic,
      level: observation.level,
      attempts: 1,
      correct: outcome,
      strength: outcome,
      streak: outcome,
      correctDays: outcome,
      lastCorrectDay: observation.correct ? day : null,
      totalTimeMs: observation.timeTakenMs,
      lastAnsweredAt: observation.answeredAt
    };
  }
  const newDay = observation.correct && (previous.lastCorrectDay === null || day > previous.lastCorrectDay);
  return {
    ...previous,
    attempts: previous.attempts + 1,
    correct: previous.correct + outcome,
    strength: previous.strength + RECENCY * (outcome - previous.strength),
    streak: observation.correct ? previous.streak + 1 : 0,
    correctDays: previous.correctDays + (newDay ? 1 : 0),
    lastCorrectDay: newDay ? day : previous.lastCorrectDay,
    totalTimeMs: previous.totalTimeMs + observation.timeTakenMs,
    lastAnsweredAt: Math.max(previous.lastAnsweredAt, observation.answeredAt)
  };
}
function applyObservation(profile, observation) {
  const existing = findSkill(profile, observation.topic, observation.level);
  const updated = nextSkill(existing, observation);
  return {
    skills: existing ? profile.skills.map((skill) => skill === existing ? updated : skill) : [...profile.skills, updated]
  };
}
function buildProfile(observations) {
  return [...observations].sort((a, b) => a.answeredAt - b.answeredAt).reduce(applyObservation, emptyProfile());
}
var accuracy = (skill) => skill.attempts === 0 ? 0 : skill.correct / skill.attempts;
var averageTimeMs = (skill) => skill.attempts === 0 ? 0 : Math.round(skill.totalTimeMs / skill.attempts);

// ../../src/lib/curriculum.ts
var YEAR_LEVELS = ["K", "1", "2", "3", "4", "5", "6"];
var YEAR_SET = new Set(YEAR_LEVELS);
function isYearLevel(value) {
  return typeof value === "string" && YEAR_SET.has(value);
}
function parseYearLevel(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const upper = trimmed.toUpperCase();
  if (upper === "K") return "K";
  if (!/^\d+$/.test(trimmed)) return null;
  const normalised = String(Number(trimmed));
  return isYearLevel(normalised) ? normalised : null;
}
function compareYearLevels(a, b) {
  return YEAR_LEVELS.indexOf(a) - YEAR_LEVELS.indexOf(b);
}

// ../../src/lib/analytics/report.ts
var TREND_MIN_OBSERVATIONS = 6;
var TREND_DELTA = 0.15;
var key = (topic, level) => `${level}|${topic}`;
function groupByTopic(observations) {
  const groups = /* @__PURE__ */ new Map();
  for (const observation of observations) {
    const id = key(observation.topic, observation.level);
    const group = groups.get(id) ?? {
      topic: observation.topic,
      level: observation.level,
      observations: []
    };
    group.observations.push(observation);
    groups.set(id, group);
  }
  return groups;
}
var share = (observations) => observations.length === 0 ? 0 : observations.filter((observation) => observation.correct).length / observations.length;
function trendFor(observations) {
  if (observations.length < TREND_MIN_OBSERVATIONS) return "unknown";
  const ordered = [...observations].sort((a, b) => a.answeredAt - b.answeredAt);
  const middle = Math.floor(ordered.length / 2);
  const delta = share(ordered.slice(middle)) - share(ordered.slice(0, middle));
  if (delta >= TREND_DELTA) return "improving";
  if (delta <= -TREND_DELTA) return "slipping";
  return "steady";
}
var NEED = {
  struggling: 0,
  "review-due": 1,
  developing: 2,
  new: 3,
  secure: 4
};
function topicReports(observations, now) {
  const profile = buildProfile(observations);
  return [...groupByTopic(observations).values()].map((group) => {
    const skill = profile.skills.find(
      (candidate) => candidate.topic === group.topic && candidate.level === group.level
    );
    return {
      topic: group.topic,
      level: group.level,
      status: skillStatus(skill, now),
      attempts: skill.attempts,
      correct: skill.correct,
      accuracy: accuracy(skill),
      strength: skill.strength,
      streak: skill.streak,
      correctDays: skill.correctDays,
      averageTimeMs: averageTimeMs(skill),
      lastAnsweredAt: skill.lastAnsweredAt,
      reviewDueAt: reviewDueAt(skill),
      trend: trendFor(group.observations)
    };
  }).sort(
    (a, b) => NEED[a.status] - NEED[b.status] || a.strength - b.strength || b.attempts - a.attempts || compareYearLevels(a.level, b.level) || a.topic.localeCompare(b.topic)
  );
}
var EXAMPLE_ANSWERS = 3;
function problemTopics(reports, limit = 3) {
  return reports.filter((report) => report.status === "struggling").slice(0, limit);
}
function dueForReview(reports, limit = 3) {
  return reports.filter((report) => report.status === "review-due").slice(0, limit);
}
function strengths(reports, limit = 3) {
  return reports.filter((report) => report.status === "secure").sort(
    (a, b) => b.correctDays - a.correctDays || b.strength - a.strength || b.attempts - a.attempts || compareYearLevels(a.level, b.level) || a.topic.localeCompare(b.topic)
  ).slice(0, limit);
}
var DAY_MS2 = 24 * 60 * 60 * 1e3;
var WEEK_MS = 7 * DAY_MS2;
var WEEK_ALIGN = 3 * DAY_MS2;
var unitMs = (unit) => unit === "day" ? DAY_MS2 : WEEK_MS;
function bucketStart(time, unit, offsetMs) {
  const size = unitMs(unit);
  const align = unit === "week" ? WEEK_ALIGN : 0;
  return Math.floor((time + offsetMs + align) / size) * size - align - offsetMs;
}
function progressOverTime(observations, { now, unit = "day", count = 14, offsetMinutes = 0 }) {
  const offsetMs = offsetMinutes * 6e4;
  const size = unitMs(unit);
  const latest = bucketStart(now, unit, offsetMs);
  const earliest = latest - (count - 1) * size;
  const buckets = /* @__PURE__ */ new Map();
  for (let start = earliest; start <= latest; start += size) {
    buckets.set(start, { start, unit, attempts: 0, correct: 0, accuracy: null });
  }
  for (const observation of observations) {
    const bucket = buckets.get(bucketStart(observation.answeredAt, unit, offsetMs));
    if (!bucket) continue;
    bucket.attempts += 1;
    if (observation.correct) bucket.correct += 1;
  }
  return [...buckets.values()].sort((a, b) => a.start - b.start).map((bucket) => ({
    ...bucket,
    accuracy: bucket.attempts === 0 ? null : bucket.correct / bucket.attempts
  }));
}
function summarise(observations, { now, offsetMinutes = 0 }) {
  const reports = topicReports(observations, now);
  const days = new Set(
    observations.map((observation) => bucketStart(observation.answeredAt, "day", offsetMinutes * 6e4))
  );
  const correct = observations.filter((observation) => observation.correct).length;
  return {
    attempts: observations.length,
    correct,
    accuracy: observations.length === 0 ? 0 : correct / observations.length,
    totalTimeMs: observations.reduce((total, observation) => total + observation.timeTakenMs, 0),
    daysPracticed: days.size,
    topics: reports.length,
    secure: reports.filter((report) => report.status === "secure" || report.status === "review-due").length,
    struggling: reports.filter((report) => report.status === "struggling").length,
    lastAnsweredAt: observations.reduce(
      (latest, observation) => latest === null ? observation.answeredAt : Math.max(latest, observation.answeredAt),
      null
    )
  };
}
function periods(observations, { now, days = 7, offsetMinutes = 0 }) {
  const today = localDay(now, offsetMinutes);
  const opened = today - days + 1;
  const previouslyOpened = opened - days;
  const current = [];
  const previous = [];
  for (const observation of observations) {
    const day = localDay(observation.answeredAt, offsetMinutes);
    if (day >= opened && day <= today) current.push(observation);
    else if (day >= previouslyOpened && day < opened) previous.push(observation);
  }
  return { current, previous };
}
function headline(observations, options) {
  const { now, offsetMinutes = 0 } = options;
  const { current, previous } = periods(observations, options);
  const thisWindow = summarise(current, { now, offsetMinutes });
  const lastWindow = summarise(previous, { now, offsetMinutes });
  const minutes = Math.round(thisWindow.totalTimeMs / 6e4);
  return {
    minutes,
    questions: thisWindow.attempts,
    accuracy: thisWindow.attempts === 0 ? null : thisWindow.accuracy,
    minutesDelta: minutes - Math.round(lastWindow.totalTimeMs / 6e4),
    questionsDelta: thisWindow.attempts - lastWindow.attempts,
    // "Down 76 points" against a week the child did not practise is not a fact.
    accuracyDelta: thisWindow.attempts === 0 || lastWindow.attempts === 0 ? null : thisWindow.accuracy - lastWindow.accuracy
  };
}

// ../../src/lib/rewards/streak.ts
var noStreak = () => ({ days: 0, lastDay: null });
function nextPlayStreak(previous, at, offsetMinutes = 0) {
  const day = localDay(at, offsetMinutes);
  if (!previous || previous.lastDay === null) return { days: 1, lastDay: day };
  if (day <= previous.lastDay) return previous;
  return day === previous.lastDay + 1 ? { days: previous.days + 1, lastDay: day } : { days: 1, lastDay: day };
}
var startedNewDay = (previous, next) => previous?.lastDay !== next.lastDay;

// ../../src/lib/rewards/stars.ts
var ROUND_SIZE = 10;
function starsForRound(correct, size = ROUND_SIZE) {
  if (correct >= size) return 3;
  return correct > 0 ? 2 : 1;
}
function rounds(results) {
  const closed = [];
  for (let start = 0; start + ROUND_SIZE <= results.length; start += ROUND_SIZE) {
    const correct = results.slice(start, start + ROUND_SIZE).filter(Boolean).length;
    closed.push({ index: start / ROUND_SIZE + 1, correct, stars: starsForRound(correct) });
  }
  return closed;
}

// src/data/records.ts
import { randomUUID as randomUUID2 } from "node:crypto";
async function writeSelectedLevel(userId, level) {
  if (!prisma) return;
  try {
    await prisma.user.update({ where: { id: userId }, data: { selectedLevel: level } });
  } catch (error) {
    console.error("Failed to write selected level", error);
  }
}
async function recordSessionStart(input) {
  if (!prisma) return null;
  try {
    const { id, ...rest } = input;
    const session = await prisma.learningSession.create({
      data: { ...rest, ...id ? { id } : {} }
    });
    return session.id;
  } catch (error) {
    console.error("Failed to record session start", error);
    return null;
  }
}
async function ownsSession(userId, learningSessionId) {
  if (!prisma) return false;
  const found = await prisma.learningSession.findFirst({
    where: { id: learningSessionId, userId },
    select: { id: true }
  });
  return found !== null;
}
var isUniqueViolation2 = (error) => typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
var WRITE_ATTEMPTS = 3;
async function updateTopicSkill(userId, attempt) {
  if (!prisma) return;
  const db = prisma;
  const identity = { userId, subject: attempt.subject, topic: attempt.topic, level: attempt.level };
  for (let tries = 0; tries < WRITE_ATTEMPTS; tries++) {
    try {
      await db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT "id", "topic", "level", "attempts", "correct", "strength", "streak",
                 "correctDays", "lastCorrectDay", "totalTimeMs", "lastAnsweredAt"
          FROM "TopicSkill"
          WHERE "userId" = ${userId}
            AND "subject" = ${attempt.subject}
            AND "topic" = ${attempt.topic}
            AND "level" = ${attempt.level}
          FOR UPDATE
        `;
        const row = rows[0];
        const skill = nextSkill(row ? toSkill(row) : void 0, attempt);
        const values = {
          attempts: skill.attempts,
          correct: skill.correct,
          strength: skill.strength,
          streak: skill.streak,
          correctDays: skill.correctDays,
          lastCorrectDay: skill.lastCorrectDay,
          totalTimeMs: skill.totalTimeMs,
          lastAnsweredAt: new Date(skill.lastAnsweredAt)
        };
        if (row) await tx.topicSkill.update({ where: { id: row.id }, data: values });
        else await tx.topicSkill.create({ data: { ...identity, ...values } });
      });
      return;
    } catch (error) {
      if (!isUniqueViolation2(error)) throw error;
    }
  }
  throw new Error(`Gave up folding an answer into ${attempt.topic} after ${WRITE_ATTEMPTS} tries`);
}
async function recordAttempt(userId, learningSessionId, attempt) {
  if (!prisma) return null;
  try {
    if (!await ownsSession(userId, learningSessionId)) return null;
    const id = attempt.id ?? randomUUID2();
    const already = await prisma.attempt.findUnique({
      where: { id },
      select: { id: true }
    });
    if (already) return await foldPlayStreak(userId, attempt);
    await prisma.attempt.create({
      data: {
        id,
        learningSessionId,
        templateId: attempt.templateId,
        subject: attempt.subject,
        topic: attempt.topic,
        level: attempt.level,
        prompt: attempt.prompt,
        expected: attempt.expected,
        response: attempt.response,
        correct: attempt.correct,
        timeTakenMs: attempt.timeTakenMs,
        answeredAt: new Date(attempt.answeredAt),
        offsetMinutes: attempt.offsetMinutes,
        // Stored resolved, as the child actually saw it - see `Attempt.figure`
        // in the Prisma schema for why. Left unset rather than written as
        // `null` for the ordinary question with nothing to draw, which is what
        // every attempt before this column existed already means. Spread
        // rather than passed through: `Figure` is declared as an `interface`
        // (`figures/types.ts`), and an interface gets no implicit index
        // signature, which is the whole of why it doesn't structurally match
        // `InputJsonObject` on its own - nothing to do with the `readonly`
        // arrays inside it, which `InputJsonArray` already accepts. A plain
        // object literal built from its own keys has an index signature and
        // needs no cast, and unlike a cast it keeps tsc checking that `Figure`
        // stays JSON-serialisable - lose that and a later field typed `Date`
        // or `Map` fails silently inside this `try`, costing the attempt.
        ...attempt.figure ? { figure: { ...attempt.figure } } : {}
      }
    });
    await updateTopicSkill(userId, attempt);
    return await foldPlayStreak(userId, attempt);
  } catch (error) {
    console.error("Failed to record attempt", error);
    return null;
  }
}
async function foldPlayStreak(userId, attempt) {
  if (!prisma) return null;
  const previous = await readPlayStreak(userId);
  const next = nextPlayStreak(previous, attempt.answeredAt, attempt.offsetMinutes);
  if (!startedNewDay(previous, next)) return { streak: next.days, streakAdvanced: false };
  const written = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ playStreakDay: null }, { playStreakDay: { lt: next.lastDay ?? 0 } }]
    },
    data: { playStreak: next.days, playStreakDay: next.lastDay }
  });
  return { streak: next.days, streakAdvanced: written.count > 0 };
}
async function readPlayStreak(userId) {
  if (!prisma) return noStreak();
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { playStreak: true, playStreakDay: true }
    });
    return user ? { days: user.playStreak, lastDay: user.playStreakDay } : noStreak();
  } catch (error) {
    console.error("Failed to read play streak", error);
    return noStreak();
  }
}
async function awardRoundStars(userId, learningSessionId) {
  if (!prisma) return null;
  const db = prisma;
  try {
    if (!await ownsSession(userId, learningSessionId)) return null;
    const answers = await db.attempt.findMany({
      where: { learningSessionId },
      // The same order the round chunking assumes: as they were answered, with
      // the id settling a tie so two calls cannot chunk the sitting differently.
      orderBy: [{ answeredAt: "asc" }, { id: "asc" }],
      select: { correct: true }
    });
    const closed = rounds(answers.map((answer) => answer.correct));
    return await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw`
        SELECT "roundsBanked"
        FROM "LearningSession"
        WHERE "id" = ${learningSessionId}
        FOR UPDATE
      `;
      const banked = locked[0]?.roundsBanked;
      if (banked === void 0 || closed.length <= banked) return null;
      const gained = closed.slice(banked).reduce((total, round) => total + round.stars, 0);
      await tx.learningSession.update({
        where: { id: learningSessionId },
        data: { roundsBanked: closed.length }
      });
      const user = await tx.user.update({
        where: { id: userId },
        data: { stars: { increment: gained } },
        select: { stars: true }
      });
      return user.stars;
    });
  } catch (error) {
    console.error("Failed to award stars", error);
    return null;
  }
}
var noPlayerState = () => ({
  selectedLevel: null,
  streak: noStreak(),
  stars: 0,
  target: null,
  targetDay: null
});
async function readPlayerState(userId) {
  if (!prisma) return noPlayerState();
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        selectedLevel: true,
        playStreak: true,
        playStreakDay: true,
        stars: true,
        targetKind: true,
        targetValue: true,
        targetDay: true
      }
    });
    if (!user) return noPlayerState();
    return {
      selectedLevel: user.selectedLevel,
      streak: { days: user.playStreak, lastDay: user.playStreakDay },
      stars: user.stars,
      target: parseTarget(user.targetKind, user.targetValue),
      targetDay: user.targetDay
    };
  } catch (error) {
    console.error("Failed to read player state", error);
    return noPlayerState();
  }
}
var noTarget = () => ({ target: null, targetDay: null });
async function readTargetSettings(userId) {
  if (!prisma) return noTarget();
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { targetKind: true, targetValue: true, targetDay: true }
    });
    if (!user) return noTarget();
    return { target: parseTarget(user.targetKind, user.targetValue), targetDay: user.targetDay };
  } catch (error) {
    console.error("Failed to read daily target", error);
    return noTarget();
  }
}
async function readRecentAnswers(userId, sinceMs) {
  if (!prisma) return [];
  try {
    const rows = await prisma.attempt.findMany({
      where: { learningSession: { userId }, answeredAt: { gte: new Date(sinceMs) } },
      orderBy: { answeredAt: "asc" },
      select: { answeredAt: true, timeTakenMs: true }
    });
    return rows.map((row) => ({
      answeredAt: row.answeredAt.getTime(),
      timeTakenMs: row.timeTakenMs
    }));
  } catch (error) {
    console.error("Failed to read recent answers", error);
    return null;
  }
}
var TARGET_WINDOW_MS = 2 * 24 * 60 * 60 * 1e3;
async function awardDailyTarget(userId, learningSessionId, { now, offsetMinutes }) {
  if (!prisma) return false;
  try {
    if (!await ownsSession(userId, learningSessionId)) return false;
    const { target } = await readTargetSettings(userId);
    if (!target) return false;
    const answers = await readRecentAnswers(userId, now - TARGET_WINDOW_MS) ?? [];
    if (!dayProgress(target, dayTotal(answers, { now, offsetMinutes })).complete) return false;
    const today = localDay(now, offsetMinutes);
    const written = await prisma.user.updateMany({
      where: { id: userId, OR: [{ targetDay: null }, { targetDay: { lt: today } }] },
      data: { targetDay: today, stars: { increment: TARGET_STARS } }
    });
    return written.count > 0;
  } catch (error) {
    console.error("Failed to award daily target", error);
    return false;
  }
}
function toSkill(row) {
  const level = parseYearLevel(row.level);
  if (!level) return void 0;
  return {
    topic: row.topic,
    level,
    attempts: row.attempts,
    correct: row.correct,
    strength: row.strength,
    streak: row.streak,
    correctDays: row.correctDays,
    lastCorrectDay: row.lastCorrectDay,
    totalTimeMs: row.totalTimeMs,
    lastAnsweredAt: row.lastAnsweredAt.getTime()
  };
}
async function readLearnerProfile(userId, subject) {
  if (!prisma) return emptyProfile();
  try {
    const rows = await prisma.topicSkill.findMany({ where: { userId, subject } });
    return { skills: rows.map(toSkill).filter((skill) => skill !== void 0) };
  } catch (error) {
    console.error("Failed to read learner profile", error);
    return emptyProfile();
  }
}
async function readRecentTopics(userId, subject, level, count) {
  if (!prisma) return [];
  try {
    const rows = await prisma.attempt.findMany({
      where: { learningSession: { userId, subject, level } },
      orderBy: { answeredAt: "desc" },
      take: count,
      select: { topic: true }
    });
    return rows.map((row) => row.topic);
  } catch (error) {
    console.error("Failed to read recent topics", error);
    return [];
  }
}
var HISTORY_LIMIT = 2e3;
async function readObservations(userId, subject, limit = HISTORY_LIMIT) {
  if (!prisma) return [];
  try {
    const rows = await prisma.attempt.findMany({
      where: { learningSession: { userId, subject } },
      orderBy: { answeredAt: "desc" },
      take: limit,
      select: {
        topic: true,
        level: true,
        correct: true,
        timeTakenMs: true,
        answeredAt: true,
        offsetMinutes: true,
        // Carried for the parent's report alone - nothing that folds a profile
        // or picks the next question reads it. See `Observation.templateId`.
        templateId: true
      }
    });
    return rows.map((row) => {
      const level = parseYearLevel(row.level);
      return level ? {
        topic: row.topic,
        level,
        correct: row.correct,
        templateId: row.templateId,
        timeTakenMs: row.timeTakenMs,
        answeredAt: row.answeredAt.getTime(),
        offsetMinutes: row.offsetMinutes
      } : void 0;
    }).filter((observation) => observation !== void 0).reverse();
  } catch (error) {
    console.error("Failed to read practice history", error);
    return null;
  }
}
async function readAnsweredQuestions(userId, subject, perTopic = EXAMPLE_ANSWERS) {
  if (!prisma) return [];
  try {
    const rows = await prisma.$queryRaw`
      SELECT "topic", "level", "prompt", "expected", "response", "correct", "answeredAt", "figure"
      FROM (
        SELECT a."topic", a."level", a."prompt", a."expected", a."response", a."correct",
               a."answeredAt", a."figure",
               ROW_NUMBER() OVER (
                 PARTITION BY a."topic", a."level"
                 -- The id settles a tie, so two reads cannot pick different answers.
                 ORDER BY a."answeredAt" DESC, a."id" DESC
               ) AS place
        FROM "Attempt" a
        JOIN "LearningSession" s ON s."id" = a."learningSessionId"
        WHERE s."userId" = ${userId} AND s."subject" = ${subject}
      ) ranked
      WHERE "place" <= ${perTopic}
    `;
    return rows.map((row) => {
      const level = parseYearLevel(row.level);
      if (!level) return void 0;
      const figure = parseFigure(row.figure) ?? void 0;
      return {
        topic: row.topic,
        level,
        prompt: row.prompt,
        expected: row.expected,
        response: row.response,
        correct: row.correct,
        answeredAt: row.answeredAt.getTime(),
        ...figure ? { figure } : {}
      };
    }).filter((answer) => answer !== void 0);
  } catch (error) {
    console.error("Failed to read answered questions", error);
    return null;
  }
}
var SITTING_LIMIT = 8;
async function readSittings(userId, subject, limit = SITTING_LIMIT) {
  if (!prisma) return [];
  try {
    const rows = await prisma.learningSession.findMany({
      where: { userId, subject },
      orderBy: { startedAt: "desc" },
      take: limit,
      select: {
        id: true,
        startedAt: true,
        level: true,
        attempts: { select: { correct: true, timeTakenMs: true } }
      }
    });
    return rows.map((row) => {
      const level = parseYearLevel(row.level);
      if (!level || row.attempts.length === 0) return void 0;
      return {
        id: row.id,
        startedAt: row.startedAt.getTime(),
        level,
        attempts: row.attempts.length,
        correct: row.attempts.filter((attempt) => attempt.correct).length,
        timeMs: row.attempts.reduce((total, attempt) => total + attempt.timeTakenMs, 0)
      };
    }).filter((sitting) => sitting !== void 0);
  } catch (error) {
    console.error("Failed to read sittings", error);
    return null;
  }
}
async function recordSessionEnd(userId, learningSessionId) {
  if (!prisma) return;
  try {
    await prisma.learningSession.updateMany({
      where: { id: learningSessionId, userId },
      data: { endedAt: /* @__PURE__ */ new Date() }
    });
  } catch (error) {
    console.error("Failed to record session end", error);
  }
}

// src/routes/sessions.ts
var sessionRoutes = async (fastify) => {
  const app2 = fastify.withTypeProvider();
  app2.post("/sessions", {
    schema: {
      operationId: "startSession",
      body: createSessionSchema,
      response: { 200: sessionSchema, 201: sessionSchema, 503: errorSchema }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const { id, subject, level, seed } = request.body;
    const existing = await prisma?.learningSession.findFirst({
      where: { id, userId },
      select: { id: true }
    });
    if (existing) return reply.code(200).send({ id });
    const created = await recordSessionStart({ id, userId, subject, level, seed });
    if (!created) return reply.code(503).send({ error: "Could not open the sitting" });
    return reply.code(201).send({ id: created });
  });
  app2.post("/sessions/:id/attempts", {
    schema: {
      operationId: "recordAttempt",
      params: z7.object({ id: z7.string() }),
      body: attemptsBodySchema,
      response: { 200: attemptResultSchema, 404: errorSchema }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const { id } = request.params;
    let last = { streak: 0, streakAdvanced: false };
    for (const { figure, ...attempt } of request.body.attempts) {
      const parsed = figure === void 0 ? void 0 : parseFigure(figure) ?? void 0;
      const result = await recordAttempt(userId, id, { ...attempt, figure: parsed });
      if (!result) return reply.code(404).send({ error: "No such sitting" });
      last = result;
    }
    return reply.send(last);
  });
  app2.post("/sessions/:id/award-round", {
    schema: {
      operationId: "awardRound",
      params: z7.object({ id: z7.string() }),
      response: { 200: z7.object({ stars: z7.number().int().nullable() }) }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const stars = await awardRoundStars(userId, request.params.id);
    return reply.send({ stars });
  });
  app2.post("/sessions/:id/award-target", {
    schema: {
      operationId: "awardDailyTarget",
      params: z7.object({ id: z7.string() }),
      body: z7.object({ offsetMinutes: z7.number().int().min(-840).max(840) }),
      response: { 200: z7.object({ awarded: z7.boolean() }) }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const awarded = await awardDailyTarget(userId, request.params.id, {
      now: Date.now(),
      offsetMinutes: request.body.offsetMinutes
    });
    return reply.send({ awarded });
  });
  app2.post("/sessions/:id/end", {
    schema: {
      operationId: "endSession",
      params: z7.object({ id: z7.string() }),
      response: { 204: z7.null() }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    await recordSessionEnd(userId, request.params.id);
    return reply.code(204).send(null);
  });
};

// src/routes/children.ts
import { z as z8 } from "zod";

// src/data/sharing.ts
import { randomInt as randomInt2 } from "node:crypto";

// ../../src/lib/children.ts
function mergeViewable(owned, shared) {
  return [
    ...owned.map((child) => ({ ...child, access: "owner" })),
    ...shared.map((child) => ({ ...child, access: "viewer" }))
  ];
}
function groupViewers(rows) {
  const viewers = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const existing = viewers.get(row.viewerId);
    if (existing) {
      existing.children.push({ id: row.childId, name: row.childName });
      continue;
    }
    viewers.set(row.viewerId, {
      id: row.viewerId,
      name: row.viewerName,
      email: row.viewerEmail,
      image: row.viewerImage,
      children: [{ id: row.childId, name: row.childName }]
    });
  }
  return [...viewers.values()];
}
function householdId(account) {
  if (account.parentId) return account.parentId;
  return account.role === "parent" ? account.id : null;
}
function extendHouseholdWithShares(household, shares) {
  const ids = new Set(household);
  for (const share2 of shares) {
    ids.add(share2.childId);
    ids.add(share2.viewerId);
    ids.add(share2.ownerId);
  }
  return [...ids];
}

// ../../src/lib/share-link.ts
var TOKEN_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
var TOKEN_LENGTH = 32;
var INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
function generateShareToken(randomInt3) {
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i += 1) {
    token += TOKEN_CHARSET[randomInt3(TOKEN_CHARSET.length)];
  }
  return token;
}
function inviteExpiry(now) {
  return new Date(now.getTime() + INVITE_TTL_MS);
}
function normaliseToken(input) {
  const trimmed = input.trim();
  if (trimmed.length !== TOKEN_LENGTH) return null;
  for (const char of trimmed) {
    if (!TOKEN_CHARSET.includes(char)) return null;
  }
  return trimmed;
}

// src/data/sharing.ts
async function readViewableChildren(userId) {
  if (!prisma) return [];
  const owned = await listChildren(userId);
  if (owned === null) return null;
  const shared = await listSharedWithMe(userId);
  if (shared === null) return null;
  return mergeViewable(
    owned.map((child) => ({ ...child, sharedBy: null })),
    shared
  );
}
async function listSharedWithMe(viewerId) {
  if (!prisma) return [];
  try {
    const rows = await prisma.childShare.findMany({
      where: { viewerId },
      orderBy: { createdAt: "asc" },
      select: {
        child: {
          select: {
            id: true,
            name: true,
            avatar: true,
            photo: { select: { dataUrl: true } },
            selectedLevel: true,
            targetKind: true,
            targetValue: true,
            parent: { select: { name: true, email: true } }
          }
        }
      }
    });
    return rows.map(({ child }) => ({
      id: child.id,
      name: child.name ?? "",
      avatar: parseAvatar(child.avatar) ?? "fox",
      // A viewer sees the face the owner set, for the reason they see the name:
      // it is how a grown-up reading two families' children tells them apart.
      photo: parsePhoto(child.photo?.dataUrl),
      level: child.selectedLevel,
      target: parseTarget(child.targetKind, child.targetValue),
      // Never shown to a viewer, and never read either.
      code: null,
      codeExpiresAt: null,
      sharedBy: child.parent?.name ?? child.parent?.email ?? null
    }));
  } catch (error) {
    console.error("Failed to list shared children", error);
    return null;
  }
}
async function listPendingInvites(ownerId, now = /* @__PURE__ */ new Date()) {
  if (!prisma) return [];
  try {
    return await prisma.shareInvite.findMany({
      where: { ownerId, acceptedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { id: true, token: true, childIds: true, createdAt: true, expiresAt: true }
    });
  } catch (error) {
    console.error("Failed to list share invites", error);
    return null;
  }
}
async function listSharedViewers(ownerId) {
  if (!prisma) return [];
  try {
    const rows = await prisma.childShare.findMany({
      // Through the child, because the child is where ownership lives. There is
      // no `ownerId` on a grant to disagree with `parentId`.
      where: { child: { parentId: ownerId } },
      orderBy: [{ viewerId: "asc" }, { createdAt: "asc" }],
      select: {
        childId: true,
        child: { select: { name: true } },
        viewer: { select: { id: true, name: true, email: true, image: true } }
      }
    });
    return groupViewers(
      rows.map((row) => ({
        childId: row.childId,
        childName: row.child.name ?? "",
        viewerId: row.viewer.id,
        viewerName: row.viewer.name,
        viewerEmail: row.viewer.email,
        viewerImage: row.viewer.image
      }))
    );
  } catch (error) {
    console.error("Failed to list shared viewers", error);
    return null;
  }
}
async function createShareInvite(ownerId, childIds, now = /* @__PURE__ */ new Date()) {
  if (!prisma) return null;
  const wanted = [...new Set(childIds)];
  if (wanted.length === 0) return null;
  try {
    const owned = await prisma.user.findMany({
      where: { parentId: ownerId, id: { in: wanted } },
      select: { id: true }
    });
    if (owned.length !== wanted.length) return null;
    const token = generateShareToken((max) => randomInt2(max));
    const expiresAt = inviteExpiry(now);
    await prisma.shareInvite.create({ data: { token, ownerId, childIds: wanted, expiresAt } });
    return { token, expiresAt };
  } catch (error) {
    console.error("Failed to create share invite", error);
    return null;
  }
}
async function readShareInvite(token, now = /* @__PURE__ */ new Date()) {
  if (!prisma) return null;
  const clean = normaliseToken(token);
  if (!clean) return null;
  try {
    const invite = await prisma.shareInvite.findUnique({
      where: { token: clean },
      select: {
        ownerId: true,
        childIds: true,
        expiresAt: true,
        acceptedAt: true,
        owner: { select: { name: true, email: true } }
      }
    });
    if (!invite) return null;
    const children = await prisma.user.findMany({
      where: { parentId: invite.ownerId, id: { in: invite.childIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        avatar: true,
        photo: { select: { dataUrl: true } },
        selectedLevel: true
      }
    });
    return {
      ownerId: invite.ownerId,
      ownerName: invite.owner.name ?? invite.owner.email ?? null,
      children: children.map((child) => ({
        id: child.id,
        name: child.name ?? "",
        avatar: parseAvatar(child.avatar) ?? "fox",
        photo: parsePhoto(child.photo?.dataUrl),
        level: child.selectedLevel
      })),
      expiresAt: invite.expiresAt,
      live: invite.acceptedAt === null && now < invite.expiresAt
    };
  } catch (error) {
    console.error("Failed to read share invite", error);
    return null;
  }
}
async function acceptShareInvite(token, viewerId, now = /* @__PURE__ */ new Date()) {
  if (!prisma) return { ok: false, reason: "error" };
  const clean = normaliseToken(token);
  if (!clean) return { ok: false, reason: "unavailable" };
  const db = prisma;
  try {
    const existing = await db.shareInvite.findUnique({
      where: { token: clean },
      select: { ownerId: true, childIds: true, acceptedById: true }
    });
    if (!existing) return { ok: false, reason: "unavailable" };
    if (existing.ownerId === viewerId) return { ok: false, reason: "own-link" };
    if (existing.acceptedById === viewerId) {
      const held = await db.childShare.count({
        where: { viewerId, childId: { in: existing.childIds } }
      });
      return { ok: true, children: held };
    }
    return await db.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw`
        UPDATE "ShareInvite"
        SET "acceptedAt" = ${now}, "acceptedById" = ${viewerId}
        WHERE "token" = ${clean} AND "acceptedAt" IS NULL AND "expiresAt" > ${now}
        RETURNING "ownerId", "childIds"
      `;
      const invite = claimed[0];
      if (!invite) {
        const now2 = await tx.shareInvite.findUnique({
          where: { token: clean },
          select: { acceptedById: true, childIds: true }
        });
        if (now2?.acceptedById === viewerId) {
          const held = await tx.childShare.count({
            where: { viewerId, childId: { in: now2.childIds } }
          });
          return { ok: true, children: held };
        }
        return { ok: false, reason: "unavailable" };
      }
      const children = await tx.user.findMany({
        where: { parentId: invite.ownerId, id: { in: invite.childIds } },
        select: { id: true }
      });
      await tx.childShare.createMany({
        data: children.map((child) => ({ childId: child.id, viewerId })),
        skipDuplicates: true
      });
      await tx.user.updateMany({ where: { id: viewerId, role: null }, data: { role: "parent" } });
      return { ok: true, children: children.length };
    });
  } catch (error) {
    console.error("Failed to accept share invite", error);
    return { ok: false, reason: "error" };
  }
}
async function cancelShareInvite(ownerId, inviteId) {
  if (!prisma) return false;
  try {
    const removed = await prisma.shareInvite.deleteMany({
      where: { id: inviteId, ownerId, acceptedAt: null }
    });
    return removed.count > 0;
  } catch (error) {
    console.error("Failed to cancel share invite", error);
    return false;
  }
}
async function revokeShare(ownerId, viewerId, childId) {
  if (!prisma) return false;
  try {
    const removed = await prisma.childShare.deleteMany({
      where: { viewerId, child: { parentId: ownerId }, ...childId ? { childId } : {} }
    });
    return removed.count > 0;
  } catch (error) {
    console.error("Failed to revoke share", error);
    return false;
  }
}
async function leaveShare(viewerId, childId) {
  if (!prisma) return false;
  try {
    const removed = await prisma.childShare.deleteMany({ where: { viewerId, childId } });
    return removed.count > 0;
  } catch (error) {
    console.error("Failed to leave share", error);
    return false;
  }
}

// src/routes/children.ts
function toChildInput(body) {
  const avatar = parseAvatar(body.avatar);
  if (!avatar) return null;
  const target = parseTarget(body.targetKind, body.targetValue);
  if (body.targetKind !== null && !target) return null;
  return {
    name: body.name,
    avatar,
    photo: parsePhoto(body.photo),
    level: body.level,
    target
  };
}
var childRoutes = async (fastify) => {
  const app2 = fastify.withTypeProvider();
  app2.get("/children", {
    schema: {
      operationId: "listChildren",
      response: { 200: z8.array(childProfileSchema), 503: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const children = await listChildren(parentId);
    if (children === null) return reply.code(503).send({ error: "Could not read the children" });
    return reply.send(children);
  });
  app2.get("/children/viewable", {
    schema: {
      operationId: "listViewableChildren",
      response: { 200: z8.array(viewableChildSchema), 503: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const children = await readViewableChildren(parentId);
    if (children === null) return reply.code(503).send({ error: "Could not read the children" });
    return reply.send(children);
  });
  app2.post("/children", {
    schema: {
      operationId: "addChild",
      body: childDetailsSchema,
      response: { 201: z8.object({ id: z8.string() }), 400: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const input = toChildInput(request.body);
    if (!input) return reply.code(400).send({ error: "Could not add that child" });
    const id = await createChild(parentId, input);
    if (!id) return reply.code(400).send({ error: "Could not add that child" });
    return reply.code(201).send({ id });
  });
  app2.patch("/children/:id", {
    schema: {
      operationId: "updateChild",
      params: z8.object({ id: z8.string() }),
      body: childDetailsSchema,
      response: { 204: z8.null(), 400: errorSchema, 404: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const input = toChildInput(request.body);
    if (!input) return reply.code(400).send({ error: "Could not change that child" });
    const ok = await updateChild(parentId, request.params.id, input);
    if (!ok) return reply.code(404).send({ error: "No such child" });
    return reply.code(204).send(null);
  });
  app2.delete("/children/:id", {
    schema: {
      operationId: "removeChild",
      params: z8.object({ id: z8.string() }),
      response: { 204: z8.null(), 404: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const ok = await removeChild(parentId, request.params.id);
    if (!ok) return reply.code(404).send({ error: "No such child" });
    return reply.code(204).send(null);
  });
  app2.post("/children/:id/login-code", {
    schema: {
      operationId: "issueLoginCode",
      params: z8.object({ id: z8.string() }),
      response: { 200: loginCodeSchema, 404: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const now = /* @__PURE__ */ new Date();
    const code = await issueLoginCode(parentId, request.params.id, now);
    if (!code) return reply.code(404).send({ error: "No such child" });
    return reply.send({ code, expiresAt: codeExpiry(now).toISOString() });
  });
};

// src/routes/content.ts
import { z as z9 } from "zod";

// ../../src/content/packs/manifest.json
var manifest_default = {
  version: "6548429a5e23",
  subjects: [
    {
      subject: "english",
      levels: [
        {
          level: "K",
          topics: [
            "letters and sounds",
            "opposites",
            "rhyme",
            "sentences",
            "syllables"
          ],
          templateCount: 21,
          etag: "104cbb947163"
        },
        {
          level: "1",
          topics: [
            "letters and sounds",
            "opposites",
            "plurals",
            "rhyme",
            "sentences",
            "word classes"
          ],
          templateCount: 24,
          etag: "d32b6a1aca72"
        },
        {
          level: "2",
          topics: [
            "compound words",
            "past tense",
            "plurals",
            "punctuation",
            "synonyms",
            "word classes"
          ],
          templateCount: 22,
          etag: "8d7f7d44373c"
        },
        {
          level: "3",
          topics: [
            "homophones",
            "prefixes and suffixes",
            "punctuation",
            "spelling patterns",
            "word classes"
          ],
          templateCount: 22,
          etag: "59f80399e134"
        },
        {
          level: "4",
          topics: [
            "homophones",
            "plurals",
            "prefixes and suffixes",
            "synonyms",
            "word classes"
          ],
          templateCount: 22,
          etag: "92b2162f60ad"
        },
        {
          level: "5",
          topics: [
            "figurative language",
            "homophones",
            "prefixes and suffixes",
            "spelling patterns",
            "word roots"
          ],
          templateCount: 22,
          etag: "f6812b9e84fe"
        },
        {
          level: "6",
          topics: [
            "figurative language",
            "punctuation",
            "spelling patterns",
            "word classes",
            "word roots"
          ],
          templateCount: 22,
          etag: "e5b103321590"
        }
      ]
    },
    {
      subject: "maths",
      levels: [
        {
          level: "K",
          topics: [
            "addition",
            "comparing numbers",
            "counting numbers",
            "data",
            "even and odd",
            "measurement",
            "patterns",
            "shapes",
            "sharing",
            "subtraction",
            "time"
          ],
          templateCount: 41,
          etag: "af9986462fd3"
        },
        {
          level: "1",
          topics: [
            "addition",
            "chance",
            "counting numbers",
            "data",
            "fractions",
            "measurement",
            "money",
            "number patterns",
            "place value",
            "position",
            "shapes",
            "sharing",
            "subtraction",
            "time"
          ],
          templateCount: 48,
          etag: "e3bf78b1d395"
        },
        {
          level: "2",
          topics: [
            "addition",
            "addition and subtraction",
            "chance",
            "counting numbers",
            "data",
            "division",
            "even and odd",
            "fractions",
            "measurement",
            "money",
            "multiplication",
            "number patterns",
            "place value",
            "position",
            "shapes",
            "subtraction",
            "time",
            "turns"
          ],
          templateCount: 52,
          etag: "0e7ce738fd0f"
        },
        {
          level: "3",
          topics: [
            "addition",
            "algebra",
            "angles",
            "chance",
            "counting numbers",
            "data",
            "division",
            "fractions",
            "measurement",
            "money",
            "multiplication",
            "place value",
            "position",
            "shapes",
            "subtraction",
            "time"
          ],
          templateCount: 52,
          etag: "e61e91dcbd1e"
        },
        {
          level: "4",
          topics: [
            "algebra",
            "angles",
            "chance",
            "data",
            "decimals",
            "division",
            "estimation",
            "even and odd",
            "fractions",
            "measurement",
            "multiplication",
            "number patterns",
            "perimeter and area",
            "position",
            "shapes",
            "symmetry",
            "time"
          ],
          templateCount: 55,
          etag: "69e10b9a064c"
        },
        {
          level: "5",
          topics: [
            "algebra",
            "angles",
            "chance",
            "data",
            "decimals",
            "division",
            "factors and multiples",
            "fractions",
            "measurement",
            "multiplication",
            "number patterns",
            "percentages",
            "perimeter and area",
            "position",
            "shapes",
            "symmetry",
            "time"
          ],
          templateCount: 55,
          etag: "90f0f6ed850e"
        },
        {
          level: "6",
          topics: [
            "algebra",
            "angles",
            "chance",
            "data",
            "decimals",
            "fractions",
            "integers",
            "measurement",
            "number patterns",
            "order of operations",
            "percentages",
            "perimeter and area",
            "position",
            "primes and squares",
            "shapes",
            "time"
          ],
          templateCount: 49,
          etag: "e5a8dfc1203f"
        }
      ]
    }
  ]
};

// ../../src/content/packs/maths.K.json
var maths_K_default = {
  version: "af9986462fd3",
  subject: "maths",
  level: "K",
  templates: [
    {
      id: "maths.K.counting-numbers.next",
      subject: "maths",
      topic: "counting numbers",
      level: "K",
      prompt: "What number comes after {x}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "19"
        }
      ],
      answer: "x + 1",
      hint: "Count up one from {x}.",
      tags: [
        "AC9MFN01",
        "MAE-RWN-02"
      ]
    },
    {
      id: "maths.K.counting-numbers.before",
      subject: "maths",
      topic: "counting numbers",
      level: "K",
      prompt: "What number comes before {x}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "20"
        }
      ],
      answer: "x - 1",
      hint: "Count back one from {x}.",
      tags: [
        "AC9MFN01",
        "MAE-RWN-02"
      ]
    },
    {
      id: "maths.K.counting-numbers.missing",
      subject: "maths",
      topic: "counting numbers",
      level: "K",
      prompt: "Fill in the gap: {x}, {x + 1}, ?, {x + 3}",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "16"
        }
      ],
      answer: "x + 2",
      tags: [
        "AC9MFN01",
        "MAE-RWN-02"
      ]
    },
    {
      id: "maths.K.counting-numbers.count-back",
      subject: "maths",
      topic: "counting numbers",
      level: "K",
      prompt: "Counting backwards: {x}, {x - 1}, ?, {x - 3}",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "4",
          max: "20"
        }
      ],
      answer: "x - 2",
      hint: "Take away one each time.",
      tags: [
        "AC9MFN01",
        "MAE-RWN-02"
      ]
    },
    {
      id: "maths.K.counting-numbers.skip-twos",
      subject: "maths",
      topic: "counting numbers",
      level: "K",
      prompt: "Counting by twos: {x}, {x + 2}, {x + 4}, ?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "12",
          step: 2
        }
      ],
      answer: "x + 6",
      hint: "Add two more each time.",
      tags: [
        "AC9MFA01",
        "MAE-FG-02"
      ]
    },
    {
      id: "maths.K.counting-numbers.number-line",
      subject: "maths",
      topic: "counting numbers",
      level: "K",
      prompt: "What number is the arrow pointing to?",
      vars: [
        {
          name: "base",
          kind: "pick",
          from: [
            0,
            5,
            10
          ]
        },
        {
          name: "n",
          kind: "int",
          min: "base + 1",
          max: "base + 9"
        }
      ],
      constraints: [
        "n != base + 5"
      ],
      answer: "n",
      hint: "Start at the last number you can see, then count the small ticks.",
      figure: {
        kind: "number-line",
        at: "n",
        from: "base",
        to: "base + 10",
        step: "5"
      },
      tags: [
        "AC9MFN01",
        "MAE-RWN-02"
      ]
    },
    {
      id: "maths.K.comparing-numbers.larger",
      subject: "maths",
      topic: "comparing numbers",
      level: "K",
      prompt: "Which number is larger, {x} or {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "20"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "20"
        }
      ],
      constraints: [
        "x != y"
      ],
      answer: "max(x, y)",
      tags: [
        "AC9MFN03",
        "MAE-RWN-01"
      ]
    },
    {
      id: "maths.K.comparing-numbers.smaller",
      subject: "maths",
      topic: "comparing numbers",
      level: "K",
      prompt: "Which number is smaller, {x} or {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "20"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "20"
        }
      ],
      constraints: [
        "x != y"
      ],
      answer: "min(x, y)",
      tags: [
        "AC9MFN03",
        "MAE-RWN-01"
      ]
    },
    {
      id: "maths.K.comparing-numbers.more-than",
      subject: "maths",
      topic: "comparing numbers",
      level: "K",
      prompt: "True or false: {x} is more than {y}.",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "20"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "20"
        }
      ],
      constraints: [
        "x != y"
      ],
      answer: "x > y",
      tags: [
        "AC9MFN03",
        "MAE-RWN-01"
      ]
    },
    {
      id: "maths.K.comparing-numbers.between",
      subject: "maths",
      topic: "comparing numbers",
      level: "K",
      prompt: "Which number goes between {x} and {x + 2}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "18"
        }
      ],
      answer: "x + 1",
      tags: [
        "AC9MFN01",
        "MAE-RWN-02"
      ]
    },
    {
      id: "maths.K.addition.to-ten",
      subject: "maths",
      topic: "addition",
      level: "K",
      prompt: "What is {x} + {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "9"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "10 - x"
        }
      ],
      answer: "x + y",
      hint: "Start at {x} and count on {y} more.",
      tags: [
        "AC9MFN05",
        "MAE-CSQ-01"
      ]
    },
    {
      id: "maths.K.addition.story",
      subject: "maths",
      topic: "addition",
      level: "K",
      prompt: "Ali has {x} shells. He finds {y} more. How many shells does he have now?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "8"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "6"
        }
      ],
      answer: "x + y",
      tags: [
        "AC9MFN05",
        "MAE-CSQ-01"
      ]
    },
    {
      id: "maths.K.addition.part-part-whole",
      subject: "maths",
      topic: "addition",
      level: "K",
      prompt: "You need 10 counters. You already have {x}. How many more do you need?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "9"
        }
      ],
      answer: "10 - x",
      hint: "Count on from {x} up to 10.",
      tags: [
        "AC9MFN04",
        "MAE-CSQ-02"
      ]
    },
    {
      id: "maths.K.subtraction.to-ten",
      subject: "maths",
      topic: "subtraction",
      level: "K",
      prompt: "What is {x} \u2212 {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "10"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "x - 1"
        }
      ],
      answer: "x - y",
      hint: "Count back {y} from {x}.",
      tags: [
        "AC9MFN05",
        "MAE-CSQ-01"
      ]
    },
    {
      id: "maths.K.subtraction.story",
      subject: "maths",
      topic: "subtraction",
      level: "K",
      prompt: "There are {x} ducks on a pond. {y} of them swim away. How many are left?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "4",
          max: "10"
        },
        {
          name: "y",
          kind: "int",
          min: "2",
          max: "x - 1"
        }
      ],
      answer: "x - y",
      tags: [
        "AC9MFN05",
        "MAE-CSQ-01"
      ]
    },
    {
      id: "maths.K.sharing.equal-groups",
      subject: "maths",
      topic: "sharing",
      level: "K",
      prompt: "{total} apples are shared equally between {n} children. How many does each child get?",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            2,
            5
          ]
        },
        {
          name: "each",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "total",
          kind: "expr",
          expr: "n * each"
        }
      ],
      answer: "each",
      hint: "Share them out one at a time until they are all gone.",
      tags: [
        "AC9MFN06",
        "MAE-FG-02"
      ]
    },
    {
      id: "maths.K.sharing.how-many-groups",
      subject: "maths",
      topic: "sharing",
      level: "K",
      prompt: "You have {total} stickers. How many children get {n} stickers each?",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            2,
            5
          ]
        },
        {
          name: "groups",
          kind: "int",
          min: "2",
          max: "4"
        },
        {
          name: "total",
          kind: "expr",
          expr: "n * groups"
        }
      ],
      answer: "groups",
      tags: [
        "AC9MFN06",
        "MAE-FG-02"
      ]
    },
    {
      id: "maths.K.even-and-odd.next-even",
      subject: "maths",
      topic: "even and odd",
      level: "K",
      prompt: "{x} is an even number. What is the next even number?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "18",
          step: 2
        }
      ],
      constraints: [
        "isEven(x)"
      ],
      answer: "x + 2",
      hint: "Count on two from {x}.",
      tags: [
        "AC9MFA01",
        "MAE-FG-02"
      ]
    },
    {
      id: "maths.K.patterns.repeating-two",
      subject: "maths",
      topic: "patterns",
      level: "K",
      prompt: "What comes next? {a}, {b}, {a}, {b}, {a}, ?",
      vars: [
        {
          name: "a",
          kind: "pick",
          from: [
            "red",
            "blue",
            "green",
            "yellow",
            "orange",
            "purple"
          ]
        },
        {
          name: "b",
          kind: "pick",
          from: [
            "red",
            "blue",
            "green",
            "yellow",
            "orange",
            "purple"
          ]
        },
        {
          name: "c",
          kind: "pick",
          from: [
            "red",
            "blue",
            "green",
            "yellow",
            "orange",
            "purple"
          ]
        }
      ],
      constraints: [
        "a != b",
        "b != c",
        "a != c"
      ],
      answer: "b",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "a",
          "c"
        ]
      },
      hint: "The pattern goes {a}, {b}, over and over.",
      tags: [
        "AC9MFA01",
        "MAE-FG-01"
      ]
    },
    {
      id: "maths.K.patterns.repeating-three",
      subject: "maths",
      topic: "patterns",
      level: "K",
      prompt: "What comes next? {a}, {b}, {c}, {a}, {b}, {c}, {a}, ?",
      vars: [
        {
          name: "a",
          kind: "pick",
          from: [
            "red",
            "blue",
            "green",
            "yellow",
            "orange",
            "purple"
          ]
        },
        {
          name: "b",
          kind: "pick",
          from: [
            "red",
            "blue",
            "green",
            "yellow",
            "orange",
            "purple"
          ]
        },
        {
          name: "c",
          kind: "pick",
          from: [
            "red",
            "blue",
            "green",
            "yellow",
            "orange",
            "purple"
          ]
        }
      ],
      constraints: [
        "a != b",
        "b != c",
        "a != c"
      ],
      answer: "b",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "a",
          "c"
        ]
      },
      hint: "The part that repeats is {a}, {b}, {c}.",
      tags: [
        "AC9MFA01",
        "MAE-FG-01"
      ]
    },
    {
      id: "maths.K.measurement.longer",
      subject: "maths",
      topic: "measurement",
      level: "K",
      prompt: "A red ribbon is {a} blocks long and a blue one is {b}. Which is longer, red or blue?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "12"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "12"
        }
      ],
      constraints: [
        "a != b"
      ],
      answer: "a > b ? 'red' : 'blue'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'red'",
          "'blue'"
        ]
      },
      tags: [
        "AC9MFM01",
        "MAE-GM-02"
      ]
    },
    {
      id: "maths.K.measurement.holds-more",
      subject: "maths",
      topic: "measurement",
      level: "K",
      prompt: "A box holds {a} cups of sand. A jar holds {b} cups of sand. Which holds more, the box or the jar?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "12"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "12"
        }
      ],
      constraints: [
        "a != b"
      ],
      answer: "a > b ? 'box' : 'jar'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'box'",
          "'jar'"
        ]
      },
      tags: [
        "AC9MFM01",
        "MAE-3DS-02"
      ]
    },
    {
      id: "maths.K.measurement.heavier",
      subject: "maths",
      topic: "measurement",
      level: "K",
      prompt: "A book balances {a} blocks. A shoe balances {b} blocks. Which is heavier, the book or the shoe?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "12"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "12"
        }
      ],
      constraints: [
        "a != b"
      ],
      answer: "a > b ? 'book' : 'shoe'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'book'",
          "'shoe'"
        ]
      },
      tags: [
        "AC9MFM01",
        "MAE-NSM-01"
      ]
    },
    {
      id: "maths.K.measurement.lightest",
      subject: "maths",
      topic: "measurement",
      level: "K",
      prompt: "The red bag balances {a} blocks, the blue {b} and the green {c}. Which bag is the lightest?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "12"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "12"
        },
        {
          name: "c",
          kind: "int",
          min: "2",
          max: "12"
        }
      ],
      constraints: [
        "a != b",
        "b != c",
        "a != c"
      ],
      answer: "a < b && a < c ? 'red' : b < c ? 'blue' : 'green'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'red'",
          "'blue'",
          "'green'"
        ]
      },
      tags: [
        "AC9MFM01",
        "MAE-NSM-01"
      ]
    },
    {
      id: "maths.K.time.day-after",
      subject: "maths",
      topic: "time",
      level: "K",
      prompt: "Which day comes after {day}?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "0",
          max: "6"
        },
        {
          name: "o",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "day",
          kind: "expr",
          expr: "n == 0 ? 'Monday' : n == 1 ? 'Tuesday' : n == 2 ? 'Wednesday' : n == 3 ? 'Thursday' : n == 4 ? 'Friday' : n == 5 ? 'Saturday' : 'Sunday'"
        },
        {
          name: "after",
          kind: "expr",
          expr: "mod(n + 1, 7) == 0 ? 'Monday' : mod(n + 1, 7) == 1 ? 'Tuesday' : mod(n + 1, 7) == 2 ? 'Wednesday' : mod(n + 1, 7) == 3 ? 'Thursday' : mod(n + 1, 7) == 4 ? 'Friday' : mod(n + 1, 7) == 5 ? 'Saturday' : 'Sunday'"
        },
        {
          name: "d1",
          kind: "expr",
          expr: "mod(n - o + 7, 7) == 0 ? 'Monday' : mod(n - o + 7, 7) == 1 ? 'Tuesday' : mod(n - o + 7, 7) == 2 ? 'Wednesday' : mod(n - o + 7, 7) == 3 ? 'Thursday' : mod(n - o + 7, 7) == 4 ? 'Friday' : mod(n - o + 7, 7) == 5 ? 'Saturday' : 'Sunday'"
        },
        {
          name: "d2",
          kind: "expr",
          expr: "mod(n - o + (o == 0 ? 2 : 1) + 7, 7) == 0 ? 'Monday' : mod(n - o + (o == 0 ? 2 : 1) + 7, 7) == 1 ? 'Tuesday' : mod(n - o + (o == 0 ? 2 : 1) + 7, 7) == 2 ? 'Wednesday' : mod(n - o + (o == 0 ? 2 : 1) + 7, 7) == 3 ? 'Thursday' : mod(n - o + (o == 0 ? 2 : 1) + 7, 7) == 4 ? 'Friday' : mod(n - o + (o == 0 ? 2 : 1) + 7, 7) == 5 ? 'Saturday' : 'Sunday'"
        },
        {
          name: "d3",
          kind: "expr",
          expr: "mod(n - o + (o == 2 ? 2 : 3) + 7, 7) == 0 ? 'Monday' : mod(n - o + (o == 2 ? 2 : 3) + 7, 7) == 1 ? 'Tuesday' : mod(n - o + (o == 2 ? 2 : 3) + 7, 7) == 2 ? 'Wednesday' : mod(n - o + (o == 2 ? 2 : 3) + 7, 7) == 3 ? 'Thursday' : mod(n - o + (o == 2 ? 2 : 3) + 7, 7) == 4 ? 'Friday' : mod(n - o + (o == 2 ? 2 : 3) + 7, 7) == 5 ? 'Saturday' : 'Sunday'"
        }
      ],
      answer: "after",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "d1",
          "d2",
          "d3"
        ]
      },
      tags: [
        "AC9MFM02",
        "MAE-NSM-02"
      ]
    },
    {
      id: "maths.K.time.day-before",
      subject: "maths",
      topic: "time",
      level: "K",
      prompt: "Which day comes before {day}?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "0",
          max: "6"
        },
        {
          name: "o",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "day",
          kind: "expr",
          expr: "n == 0 ? 'Monday' : n == 1 ? 'Tuesday' : n == 2 ? 'Wednesday' : n == 3 ? 'Thursday' : n == 4 ? 'Friday' : n == 5 ? 'Saturday' : 'Sunday'"
        },
        {
          name: "before",
          kind: "expr",
          expr: "mod(n + 6, 7) == 0 ? 'Monday' : mod(n + 6, 7) == 1 ? 'Tuesday' : mod(n + 6, 7) == 2 ? 'Wednesday' : mod(n + 6, 7) == 3 ? 'Thursday' : mod(n + 6, 7) == 4 ? 'Friday' : mod(n + 6, 7) == 5 ? 'Saturday' : 'Sunday'"
        },
        {
          name: "d1",
          kind: "expr",
          expr: "mod(n - 1 - o + (o == 0 ? 1 : 0) + 7, 7) == 0 ? 'Monday' : mod(n - 1 - o + (o == 0 ? 1 : 0) + 7, 7) == 1 ? 'Tuesday' : mod(n - 1 - o + (o == 0 ? 1 : 0) + 7, 7) == 2 ? 'Wednesday' : mod(n - 1 - o + (o == 0 ? 1 : 0) + 7, 7) == 3 ? 'Thursday' : mod(n - 1 - o + (o == 0 ? 1 : 0) + 7, 7) == 4 ? 'Friday' : mod(n - 1 - o + (o == 0 ? 1 : 0) + 7, 7) == 5 ? 'Saturday' : 'Sunday'"
        },
        {
          name: "d2",
          kind: "expr",
          expr: "mod(n - 1 - o + (o <= 1 ? 2 : 1) + 7, 7) == 0 ? 'Monday' : mod(n - 1 - o + (o <= 1 ? 2 : 1) + 7, 7) == 1 ? 'Tuesday' : mod(n - 1 - o + (o <= 1 ? 2 : 1) + 7, 7) == 2 ? 'Wednesday' : mod(n - 1 - o + (o <= 1 ? 2 : 1) + 7, 7) == 3 ? 'Thursday' : mod(n - 1 - o + (o <= 1 ? 2 : 1) + 7, 7) == 4 ? 'Friday' : mod(n - 1 - o + (o <= 1 ? 2 : 1) + 7, 7) == 5 ? 'Saturday' : 'Sunday'"
        },
        {
          name: "d3",
          kind: "expr",
          expr: "mod(n - 1 - o + 3 + 7, 7) == 0 ? 'Monday' : mod(n - 1 - o + 3 + 7, 7) == 1 ? 'Tuesday' : mod(n - 1 - o + 3 + 7, 7) == 2 ? 'Wednesday' : mod(n - 1 - o + 3 + 7, 7) == 3 ? 'Thursday' : mod(n - 1 - o + 3 + 7, 7) == 4 ? 'Friday' : mod(n - 1 - o + 3 + 7, 7) == 5 ? 'Saturday' : 'Sunday'"
        }
      ],
      answer: "before",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "d1",
          "d2",
          "d3"
        ]
      },
      tags: [
        "AC9MFM02",
        "MAE-NSM-02"
      ]
    },
    {
      id: "maths.K.time.oclock",
      subject: "maths",
      topic: "time",
      level: "K",
      prompt: "What time is this?",
      vars: [
        {
          name: "lo",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "k",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ]
        },
        {
          name: "h",
          kind: "expr",
          expr: "mod(lo + k - 1, 12) + 1"
        }
      ],
      answer: "h + ' o\u2019clock'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "(mod(lo - 1, 12) + 1) + ' o\u2019clock'",
          "(mod(lo, 12) + 1) + ' o\u2019clock'",
          "(mod(lo + 1, 12) + 1) + ' o\u2019clock'",
          "(mod(lo + 2, 12) + 1) + ' o\u2019clock'"
        ]
      },
      hint: "The short hand tells you the hour.",
      figure: {
        kind: "clock",
        hour: "h",
        minute: "0",
        numerals: "true"
      },
      tags: [
        "MAE-NSM-02"
      ]
    },
    {
      id: "maths.K.time.clock-says",
      subject: "maths",
      topic: "time",
      level: "K",
      prompt: "True or false: this clock shows {h} o\u2019clock.",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "right",
          kind: "int",
          min: "0",
          max: "1"
        },
        {
          name: "off",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "shown",
          kind: "expr",
          expr: "right == 1 ? h : mod(h + off - 1, 12) + 1"
        }
      ],
      answer: "shown == h",
      figure: {
        kind: "clock",
        hour: "shown",
        minute: "0",
        numerals: "true"
      },
      tags: [
        "MAE-NSM-02"
      ]
    },
    {
      id: "maths.K.shapes.sides",
      subject: "maths",
      topic: "shapes",
      level: "K",
      prompt: "How many sides does a {shape} have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "triangle",
            "square",
            "rectangle",
            "pentagon",
            "hexagon"
          ]
        }
      ],
      answer: "shape == 'triangle' ? 3 : shape == 'square' ? 4 : shape == 'rectangle' ? 4 : shape == 'pentagon' ? 5 : 6",
      tags: [
        "AC9MFSP01",
        "MAE-2DS-01"
      ]
    },
    {
      id: "maths.K.shapes.name",
      subject: "maths",
      topic: "shapes",
      level: "K",
      prompt: "A shape has {n} equal sides and {n} corners. What is it called?",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            3,
            4,
            5,
            6
          ]
        }
      ],
      answer: "n == 3 ? 'triangle' : n == 4 ? 'square' : n == 5 ? 'pentagon' : 'hexagon'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "mod(n - 2, 4) + 3 == 3 ? 'triangle' : mod(n - 2, 4) + 3 == 4 ? 'square' : mod(n - 2, 4) + 3 == 5 ? 'pentagon' : 'hexagon'",
          "mod(n - 1, 4) + 3 == 3 ? 'triangle' : mod(n - 1, 4) + 3 == 4 ? 'square' : mod(n - 1, 4) + 3 == 5 ? 'pentagon' : 'hexagon'",
          "mod(n, 4) + 3 == 3 ? 'triangle' : mod(n, 4) + 3 == 4 ? 'square' : mod(n, 4) + 3 == 5 ? 'pentagon' : 'hexagon'"
        ]
      },
      tags: [
        "AC9MFSP01",
        "MAE-2DS-01"
      ]
    },
    {
      id: "maths.K.shapes.name-picture",
      subject: "maths",
      topic: "shapes",
      level: "K",
      prompt: "What shape is this?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "triangle",
            "square",
            "hexagon"
          ]
        },
        {
          name: "tri",
          kind: "pick",
          from: [
            "equilateral",
            "isosceles",
            "scalene"
          ]
        },
        {
          name: "drawn",
          kind: "expr",
          expr: "shape == 'triangle' ? tri : shape"
        }
      ],
      answer: "shape",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'triangle'",
          "'square'",
          "'hexagon'"
        ]
      },
      figure: {
        kind: "polygon",
        shape: "drawn"
      },
      tags: [
        "AC9MFSP01",
        "MAE-2DS-01"
      ]
    },
    {
      id: "maths.K.shapes.sides-picture",
      subject: "maths",
      topic: "shapes",
      level: "K",
      prompt: "How many sides does this shape have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "equilateral",
            "isosceles",
            "scalene",
            "square",
            "rectangle",
            "trapezium",
            "pentagon",
            "hexagon"
          ]
        }
      ],
      answer: "shape == 'equilateral' || shape == 'isosceles' || shape == 'scalene' || shape == 'right-triangle' ? 3 : shape == 'pentagon' ? 5 : shape == 'hexagon' ? 6 : shape == 'heptagon' ? 7 : shape == 'octagon' ? 8 : 4",
      hint: "Touch each side as you count it.",
      figure: {
        kind: "polygon",
        shape: "shape"
      },
      tags: [
        "AC9MFSP01",
        "MAE-2DS-01"
      ]
    },
    {
      id: "maths.K.shapes.is-a-triangle",
      subject: "maths",
      topic: "shapes",
      level: "K",
      prompt: "True or false: this shape is a triangle.",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "equilateral",
            "isosceles",
            "scalene",
            "right-triangle",
            "square",
            "rectangle",
            "trapezium",
            "pentagon",
            "hexagon"
          ]
        },
        {
          name: "sides",
          kind: "expr",
          expr: "shape == 'equilateral' || shape == 'isosceles' || shape == 'scalene' || shape == 'right-triangle' ? 3 : shape == 'pentagon' ? 5 : shape == 'hexagon' ? 6 : shape == 'heptagon' ? 7 : shape == 'octagon' ? 8 : 4"
        }
      ],
      answer: "sides == 3",
      figure: {
        kind: "polygon",
        shape: "shape"
      },
      tags: [
        "AC9MFSP01",
        "MAE-2DS-01"
      ]
    },
    {
      id: "maths.K.shapes.solid-name",
      subject: "maths",
      topic: "shapes",
      level: "K",
      prompt: "What is this called?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "sphere",
            "cone",
            "cylinder"
          ]
        }
      ],
      answer: "shape",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'cube'",
          "'sphere'",
          "'cone'",
          "'cylinder'"
        ]
      },
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9MFSP01",
        "MAE-3DS-01"
      ]
    },
    {
      id: "maths.K.shapes.solid-rolls",
      subject: "maths",
      topic: "shapes",
      level: "K",
      prompt: "True or false: this shape can roll.",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "cuboid",
            "sphere",
            "cylinder",
            "square-pyramid"
          ]
        }
      ],
      answer: "shape == 'sphere' || shape == 'cylinder'",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9MFSP01",
        "MAE-3DS-01"
      ]
    },
    {
      id: "maths.K.shapes.solid-everyday",
      subject: "maths",
      topic: "shapes",
      level: "K",
      prompt: "Which of these is shaped like this?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "cuboid",
            "sphere",
            "cone",
            "cylinder"
          ],
          weights: [
            1,
            1,
            2,
            2,
            2
          ]
        }
      ],
      answer: "shape == 'sphere' ? 'a ball' : shape == 'cube' || shape == 'cuboid' ? 'a box' : shape == 'cylinder' ? 'a can' : 'a party hat'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'a ball'",
          "'a box'",
          "'a can'",
          "'a party hat'"
        ]
      },
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9MFSP01",
        "MAE-3DS-01"
      ]
    },
    {
      id: "maths.K.data.most-counted",
      subject: "maths",
      topic: "data",
      level: "K",
      prompt: "Sam counted cars: {a} red, {b} blue and {c} green. Which colour did he see most of?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "c",
          kind: "int",
          min: "1",
          max: "12"
        }
      ],
      constraints: [
        "a != b",
        "b != c",
        "a != c"
      ],
      answer: "a > b && a > c ? 'red' : b > c ? 'blue' : 'green'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'red'",
          "'blue'",
          "'green'"
        ]
      },
      tags: [
        "AC9MFST01",
        "MAE-DATA-01"
      ]
    },
    {
      id: "maths.K.data.graph-count",
      subject: "maths",
      topic: "data",
      level: "K",
      prompt: "This graph shows the pets in our class. How many children have a {pet}?",
      vars: [
        {
          name: "dog",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "cat",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "fish",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "pet",
          kind: "expr",
          expr: "i == 0 ? 'dog' : i == 1 ? 'cat' : 'fish'"
        }
      ],
      constraints: [
        "max(dog, cat, fish) > 1"
      ],
      answer: "i == 0 ? dog : i == 1 ? cat : fish",
      hint: "Find the name along the bottom, then count up.",
      figure: {
        kind: "bar",
        values: "dog + ',' + cat + ',' + fish",
        labels: "'Dog,Cat,Fish'",
        scale: "1"
      },
      tags: [
        "AC9MFST01",
        "MAE-DATA-01"
      ]
    },
    {
      id: "maths.K.data.graph-most",
      subject: "maths",
      topic: "data",
      level: "K",
      prompt: "This graph shows our favourite toys. Which toy did the most children pick?",
      vars: [
        {
          name: "ball",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "bike",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "doll",
          kind: "int",
          min: "1",
          max: "5"
        }
      ],
      constraints: [
        "ball != bike",
        "bike != doll",
        "ball != doll"
      ],
      answer: "ball > bike && ball > doll ? 'Ball' : bike > doll ? 'Bike' : 'Doll'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'Ball'",
          "'Bike'",
          "'Doll'"
        ]
      },
      figure: {
        kind: "bar",
        values: "ball + ',' + bike + ',' + doll",
        labels: "'Ball,Bike,Doll'",
        scale: "1"
      },
      tags: [
        "AC9MFST01",
        "MAE-DATA-01"
      ]
    },
    {
      id: "maths.K.data.picture-count",
      subject: "maths",
      topic: "data",
      level: "K",
      prompt: "Each picture stands for one book. How many books did {who} read?",
      vars: [
        {
          name: "ana",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "ben",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "kim",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "who",
          kind: "expr",
          expr: "i == 0 ? 'Ana' : i == 1 ? 'Ben' : 'Kim'"
        }
      ],
      answer: "i == 0 ? ana : i == 1 ? ben : kim",
      hint: "Count the pictures in that row.",
      figure: {
        kind: "pictograph",
        counts: "ana + ',' + ben + ',' + kim",
        labels: "'Ana,Ben,Kim'",
        key: "1"
      },
      tags: [
        "AC9MFST01",
        "MAE-DATA-01"
      ]
    },
    {
      id: "maths.K.data.picture-fewest",
      subject: "maths",
      topic: "data",
      level: "K",
      prompt: "Each picture stands for one shell. Who found the fewest shells?",
      vars: [
        {
          name: "ana",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "ben",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "kim",
          kind: "int",
          min: "1",
          max: "4"
        }
      ],
      constraints: [
        "ana != ben",
        "ben != kim",
        "ana != kim"
      ],
      answer: "ana < ben && ana < kim ? 'Ana' : ben < kim ? 'Ben' : 'Kim'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'Ana'",
          "'Ben'",
          "'Kim'"
        ]
      },
      hint: "The shortest row is the fewest.",
      figure: {
        kind: "pictograph",
        counts: "ana + ',' + ben + ',' + kim",
        labels: "'Ana,Ben,Kim'",
        key: "1"
      },
      tags: [
        "AC9MFST01",
        "MAE-DATA-01"
      ]
    }
  ]
};

// ../../src/content/packs/maths.1.json
var maths_1_default = {
  version: "e3bf78b1d395",
  subject: "maths",
  level: "1",
  templates: [
    {
      id: "maths.1.counting-numbers.skip",
      subject: "maths",
      topic: "counting numbers",
      level: "1",
      prompt: "Counting by {step}s: {x}, {x + step}, {x + 2 * step}, ?",
      vars: [
        {
          name: "step",
          kind: "pick",
          from: [
            2,
            5,
            10
          ]
        },
        {
          name: "x",
          kind: "int",
          min: "step",
          max: "step * 5"
        }
      ],
      constraints: [
        "mod(x, step) == 0"
      ],
      answer: "x + 3 * step",
      hint: "Add {step} each time.",
      tags: [
        "AC9M1A01",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.1.counting-numbers.after-100",
      subject: "maths",
      topic: "counting numbers",
      level: "1",
      prompt: "What number comes after {x}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "95",
          max: "119"
        }
      ],
      answer: "x + 1",
      tags: [
        "AC9M1N01",
        "MA1-RWN-02"
      ]
    },
    {
      id: "maths.1.counting-numbers.largest",
      subject: "maths",
      topic: "counting numbers",
      level: "1",
      prompt: "Which of these is the largest: {a}, {b} or {c}?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "10",
          max: "120"
        },
        {
          name: "b",
          kind: "int",
          min: "10",
          max: "120"
        },
        {
          name: "c",
          kind: "int",
          min: "10",
          max: "120"
        }
      ],
      constraints: [
        "a != b",
        "b != c",
        "a != c"
      ],
      answer: "max(a, b, c)",
      tags: [
        "AC9M1N01",
        "MA1-RWN-02"
      ]
    },
    {
      id: "maths.1.counting-numbers.ten-more",
      subject: "maths",
      topic: "counting numbers",
      level: "1",
      prompt: "What is 10 more than {x}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "5",
          max: "109"
        }
      ],
      answer: "x + 10",
      hint: "Only the tens digit changes.",
      tags: [
        "AC9M1N01",
        "MA1-RWN-02"
      ]
    },
    {
      id: "maths.1.counting-numbers.ten-less",
      subject: "maths",
      topic: "counting numbers",
      level: "1",
      prompt: "What is 10 less than {x}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "15",
          max: "120"
        }
      ],
      answer: "x - 10",
      tags: [
        "AC9M1N01",
        "MA1-RWN-02"
      ]
    },
    {
      id: "maths.1.counting-numbers.number-line",
      subject: "maths",
      topic: "counting numbers",
      level: "1",
      prompt: "What number is the arrow pointing to?",
      vars: [
        {
          name: "base",
          kind: "int",
          min: "0",
          max: "9"
        },
        {
          name: "start",
          kind: "expr",
          expr: "base * 10"
        },
        {
          name: "n",
          kind: "int",
          min: "start + 1",
          max: "start + 9"
        }
      ],
      constraints: [
        "n != start + 5"
      ],
      answer: "n",
      hint: "Start at the last number you can see, then count the small ticks.",
      figure: {
        kind: "number-line",
        at: "n",
        from: "start",
        to: "start + 10",
        step: "5"
      },
      tags: [
        "AC9M1N01",
        "MA1-RWN-02"
      ]
    },
    {
      id: "maths.1.place-value.count-tens",
      subject: "maths",
      topic: "place value",
      level: "1",
      prompt: "How many whole tens are there in {x}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "20",
          max: "99"
        }
      ],
      answer: "floor(x / 10)",
      hint: "Look at the first digit of {x}.",
      tags: [
        "AC9M1N02",
        "MA1-RWN-01"
      ]
    },
    {
      id: "maths.1.place-value.count-ones",
      subject: "maths",
      topic: "place value",
      level: "1",
      prompt: "{x} is {tens} tens and how many ones?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "21",
          max: "99"
        },
        {
          name: "tens",
          kind: "expr",
          expr: "floor(x / 10)"
        }
      ],
      constraints: [
        "mod(x, 10) != 0"
      ],
      answer: "mod(x, 10)",
      tags: [
        "AC9M1N02",
        "MA1-RWN-01"
      ]
    },
    {
      id: "maths.1.place-value.build",
      subject: "maths",
      topic: "place value",
      level: "1",
      prompt: "What number is {tens} tens and {ones} ones?",
      vars: [
        {
          name: "tens",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "ones",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "tens * 10 + ones",
      tags: [
        "AC9M1N02",
        "MA1-RWN-01"
      ]
    },
    {
      id: "maths.1.addition.small",
      subject: "maths",
      topic: "addition",
      level: "1",
      prompt: "What is {x} + {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "9"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "9"
        }
      ],
      answer: "x + y",
      hint: "Start at {x} and count on {y} more.",
      tags: [
        "AC9M1N04",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.1.addition.story",
      subject: "maths",
      topic: "addition",
      level: "1",
      prompt: "Mia has {x} stickers. She is given {y} more. How many does she have now?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "12"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "8"
        }
      ],
      answer: "x + y",
      tags: [
        "AC9M1N05",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.1.addition.within-twenty",
      subject: "maths",
      topic: "addition",
      level: "1",
      prompt: "What is {x} + {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "6",
          max: "14"
        },
        {
          name: "y",
          kind: "int",
          min: "3",
          max: "20 - x"
        }
      ],
      answer: "x + y",
      hint: "Make ten first, then add what is left over.",
      tags: [
        "AC9M1N04",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.1.addition.double",
      subject: "maths",
      topic: "addition",
      level: "1",
      prompt: "What is double {x}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "10"
        }
      ],
      answer: "x * 2",
      hint: "{x} + {x}",
      tags: [
        "AC9M1N04",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.1.addition.missing-part",
      subject: "maths",
      topic: "addition",
      level: "1",
      prompt: "What goes in the box? {x} + ? = {total}",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "10"
        },
        {
          name: "rest",
          kind: "int",
          min: "1",
          max: "10"
        },
        {
          name: "total",
          kind: "expr",
          expr: "x + rest"
        }
      ],
      answer: "rest",
      hint: "Count on from {x} until you reach {total}.",
      tags: [
        "AC9M1N04",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.1.subtraction.difference",
      subject: "maths",
      topic: "subtraction",
      level: "1",
      prompt: "What is the difference between {x} and {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "5",
          max: "20"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "19"
        }
      ],
      constraints: [
        "x > y"
      ],
      answer: "x - y",
      hint: "Count back from {x} until you reach {y}.",
      tags: [
        "AC9M1N04",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.1.subtraction.story",
      subject: "maths",
      topic: "subtraction",
      level: "1",
      prompt: "There are {x} birds on a wall. {y} of them fly away. How many are left?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "5",
          max: "20"
        },
        {
          name: "y",
          kind: "int",
          min: "2",
          max: "x - 1"
        }
      ],
      answer: "x - y",
      tags: [
        "AC9M1N05",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.1.subtraction.within-twenty",
      subject: "maths",
      topic: "subtraction",
      level: "1",
      prompt: "What is {x} \u2212 {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "12",
          max: "20"
        },
        {
          name: "y",
          kind: "int",
          min: "3",
          max: "9"
        }
      ],
      answer: "x - y",
      hint: "Take away enough to get down to ten first.",
      tags: [
        "AC9M1N04",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.1.sharing.equal-groups",
      subject: "maths",
      topic: "sharing",
      level: "1",
      prompt: "{total} pencils are shared equally between {n} friends. How many does each friend get?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "5"
        },
        {
          name: "each",
          kind: "int",
          min: "2",
          max: "6"
        },
        {
          name: "total",
          kind: "expr",
          expr: "n * each"
        }
      ],
      answer: "each",
      tags: [
        "AC9M1N06",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.1.sharing.how-many-groups",
      subject: "maths",
      topic: "sharing",
      level: "1",
      prompt: "How many groups of {n} can you make from {total} counters?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "5"
        },
        {
          name: "groups",
          kind: "int",
          min: "2",
          max: "8"
        },
        {
          name: "total",
          kind: "expr",
          expr: "n * groups"
        }
      ],
      answer: "groups",
      hint: "Skip count by {n}s until you reach {total}.",
      tags: [
        "AC9M1N06",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.1.sharing.array-count",
      subject: "maths",
      topic: "sharing",
      level: "1",
      prompt: "How many dots are there altogether?",
      vars: [
        {
          name: "r",
          kind: "int",
          min: "2",
          max: "5"
        },
        {
          name: "c",
          kind: "int",
          min: "2",
          max: "5"
        }
      ],
      answer: "r * c",
      hint: "Count the dots in one row, then skip count.",
      figure: {
        kind: "array",
        rows: "r",
        columns: "c"
      },
      tags: [
        "AC9M1N06",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.1.fractions.half-shaded",
      subject: "maths",
      topic: "fractions",
      level: "1",
      prompt: "True or false: half of this shape is shaded.",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            4,
            6,
            8
          ]
        },
        {
          name: "right",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "off",
          kind: "int",
          min: "1",
          max: "d - 2"
        },
        {
          name: "n",
          kind: "expr",
          expr: "right == 1 ? d / 2 : mod(d / 2 - 1 + off, d - 1) + 1"
        }
      ],
      answer: "n * 2 == d",
      hint: "Half means the shaded parts and the plain parts are the same.",
      figure: {
        kind: "fraction-shape",
        numerator: "n",
        denominator: "d"
      },
      tags: [
        "MA1-GM-03"
      ]
    },
    {
      id: "maths.1.fractions.how-much-shaded",
      subject: "maths",
      topic: "fractions",
      level: "1",
      prompt: "How much of this shape is shaded?",
      vars: [
        {
          name: "which",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ],
          weights: [
            1,
            2,
            1,
            2
          ]
        },
        {
          name: "d",
          kind: "expr",
          expr: "which == 0 ? 2 : 4"
        },
        {
          name: "n",
          kind: "expr",
          expr: "which == 2 ? 2 : which == 3 ? 3 : 1"
        }
      ],
      answer: "n * 2 == d ? 'a half' : n == 1 ? 'a quarter' : 'three quarters'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'a half'",
          "'a quarter'",
          "'three quarters'"
        ]
      },
      hint: "Count how many parts there are, then how many are shaded.",
      figure: {
        kind: "fraction-shape",
        numerator: "n",
        denominator: "d"
      },
      tags: [
        "MA1-GM-03"
      ]
    },
    {
      id: "maths.1.money.count-coins",
      subject: "maths",
      topic: "money",
      level: "1",
      prompt: "How many {coin}c coins do you need to make {total}c?",
      vars: [
        {
          name: "coin",
          kind: "pick",
          from: [
            5,
            10,
            20
          ]
        },
        {
          name: "many",
          kind: "int",
          min: "2",
          max: "8"
        },
        {
          name: "total",
          kind: "expr",
          expr: "coin * many"
        }
      ],
      answer: "many",
      hint: "Skip count by {coin}s.",
      tags: [
        "AC9M1N05",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.1.number-patterns.count-back",
      subject: "maths",
      topic: "number patterns",
      level: "1",
      prompt: "What comes next? {x}, {x - step}, {x - 2 * step}, ?",
      vars: [
        {
          name: "step",
          kind: "pick",
          from: [
            2,
            5,
            10
          ]
        },
        {
          name: "x",
          kind: "int",
          min: "step * 4",
          max: "step * 12"
        }
      ],
      constraints: [
        "mod(x, step) == 0"
      ],
      answer: "x - 3 * step",
      hint: "The numbers go down by {step} each time.",
      tags: [
        "AC9M1A01",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.1.number-patterns.repeating-unit",
      subject: "maths",
      topic: "number patterns",
      level: "1",
      prompt: "What comes next? {a}, {b}, {c}, {a}, {b}, {c}, {a}, {b}, ?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "b",
          kind: "int",
          min: "4",
          max: "6"
        },
        {
          name: "c",
          kind: "int",
          min: "7",
          max: "9"
        }
      ],
      answer: "c",
      hint: "The part that repeats is {a}, {b}, {c}.",
      tags: [
        "AC9M1A02"
      ]
    },
    {
      id: "maths.1.measurement.how-much-longer",
      subject: "maths",
      topic: "measurement",
      level: "1",
      prompt: "A rope is {a} paperclips long. A pencil is {b} paperclips long. How many paperclips longer is the rope?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "8",
          max: "20"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "7"
        }
      ],
      answer: "a - b",
      tags: [
        "AC9M1M02",
        "MA1-GM-02"
      ]
    },
    {
      id: "maths.1.measurement.mass-heaviest",
      subject: "maths",
      topic: "measurement",
      level: "1",
      prompt: "A pear balances {a} marbles, an apple {b} and a lime {c}. Which is the heaviest?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "3",
          max: "15"
        },
        {
          name: "b",
          kind: "int",
          min: "3",
          max: "15"
        },
        {
          name: "c",
          kind: "int",
          min: "3",
          max: "15"
        }
      ],
      constraints: [
        "a != b",
        "b != c",
        "a != c"
      ],
      answer: "a > b && a > c ? 'the pear' : b > c ? 'the apple' : 'the lime'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'the pear'",
          "'the apple'",
          "'the lime'"
        ]
      },
      hint: "The heaviest one needs the most marbles to balance it.",
      tags: [
        "AC9M1M02",
        "MA1-NSM-01"
      ]
    },
    {
      id: "maths.1.time.days-in-weeks",
      subject: "maths",
      topic: "time",
      level: "1",
      prompt: "How many days are there in {n} weeks?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "6"
        }
      ],
      answer: "n * 7",
      hint: "There are 7 days in one week.",
      tags: [
        "AC9M1M03",
        "MA1-NSM-02"
      ]
    },
    {
      id: "maths.1.time.hours-in-days",
      subject: "maths",
      topic: "time",
      level: "1",
      prompt: "How many hours are there in {n} days?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "4"
        }
      ],
      answer: "n * 24",
      hint: "There are 24 hours in one day.",
      tags: [
        "AC9M1M03",
        "MA1-NSM-02"
      ]
    },
    {
      id: "maths.1.time.half-past",
      subject: "maths",
      topic: "time",
      level: "1",
      prompt: "What time is this?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "half",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "off",
          kind: "pick",
          from: [
            -5,
            -4,
            -3,
            -2,
            -1,
            1,
            2,
            3,
            4,
            5
          ]
        },
        {
          name: "g",
          kind: "expr",
          expr: "mod(h + off - 1, 12) + 1"
        }
      ],
      answer: "half == 1 ? 'half past ' + h : h + ' o\u2019clock'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "half == 1 ? h + ' o\u2019clock' : 'half past ' + h",
          "half == 1 ? 'half past ' + g : g + ' o\u2019clock'",
          "half == 1 ? g + ' o\u2019clock' : 'half past ' + g"
        ]
      },
      hint: "The long hand points straight down when it is half past.",
      figure: {
        kind: "clock",
        hour: "h",
        minute: "half == 1 ? 30 : 0",
        numerals: "true"
      },
      tags: [
        "MA1-NSM-02"
      ]
    },
    {
      id: "maths.1.time.half-past-claim",
      subject: "maths",
      topic: "time",
      level: "1",
      prompt: "True or false: this clock shows half past {h}.",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "right",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "slip",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "off",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "shownHour",
          kind: "expr",
          expr: "right == 1 || slip == 0 ? h : mod(h + off - 1, 12) + 1"
        },
        {
          name: "shownMinute",
          kind: "expr",
          expr: "right == 1 || slip == 1 ? 30 : 0"
        }
      ],
      answer: "shownHour == h && shownMinute == 30",
      figure: {
        kind: "clock",
        hour: "shownHour",
        minute: "shownMinute",
        numerals: "true"
      },
      tags: [
        "MA1-NSM-02"
      ]
    },
    {
      id: "maths.1.shapes.corners",
      subject: "maths",
      topic: "shapes",
      level: "1",
      prompt: "How many corners does {article} {shape} have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "triangle",
            "square",
            "rectangle",
            "pentagon",
            "hexagon",
            "octagon"
          ]
        },
        {
          name: "article",
          kind: "expr",
          expr: "shape == 'octagon' ? 'an' : 'a'"
        }
      ],
      answer: "shape == 'triangle' ? 3 : shape == 'square' ? 4 : shape == 'rectangle' ? 4 : shape == 'pentagon' ? 5 : shape == 'hexagon' ? 6 : 8",
      tags: [
        "AC9M1SP01",
        "MA1-2DS-01"
      ]
    },
    {
      id: "maths.1.shapes.name-picture",
      subject: "maths",
      topic: "shapes",
      level: "1",
      prompt: "What shape is this?",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            3,
            4,
            5,
            6
          ]
        },
        {
          name: "tri",
          kind: "pick",
          from: [
            "equilateral",
            "isosceles",
            "scalene"
          ]
        },
        {
          name: "drawn",
          kind: "expr",
          expr: "n == 3 ? tri : n == 4 ? 'square' : n == 5 ? 'pentagon' : 'hexagon'"
        }
      ],
      answer: "n == 3 ? 'triangle' : n == 4 ? 'square' : n == 5 ? 'pentagon' : 'hexagon'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "mod(n - 2, 4) + 3 == 3 ? 'triangle' : mod(n - 2, 4) + 3 == 4 ? 'square' : mod(n - 2, 4) + 3 == 5 ? 'pentagon' : 'hexagon'",
          "mod(n - 1, 4) + 3 == 3 ? 'triangle' : mod(n - 1, 4) + 3 == 4 ? 'square' : mod(n - 1, 4) + 3 == 5 ? 'pentagon' : 'hexagon'",
          "mod(n, 4) + 3 == 3 ? 'triangle' : mod(n, 4) + 3 == 4 ? 'square' : mod(n, 4) + 3 == 5 ? 'pentagon' : 'hexagon'"
        ]
      },
      figure: {
        kind: "polygon",
        shape: "drawn"
      },
      tags: [
        "AC9M1SP01",
        "MA1-2DS-01"
      ]
    },
    {
      id: "maths.1.shapes.corners-picture",
      subject: "maths",
      topic: "shapes",
      level: "1",
      prompt: "How many corners does this shape have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "equilateral",
            "isosceles",
            "right-triangle",
            "square",
            "rectangle",
            "rhombus",
            "kite",
            "pentagon",
            "hexagon",
            "octagon"
          ]
        }
      ],
      answer: "shape == 'equilateral' || shape == 'isosceles' || shape == 'scalene' || shape == 'right-triangle' ? 3 : shape == 'pentagon' ? 5 : shape == 'hexagon' ? 6 : shape == 'heptagon' ? 7 : shape == 'octagon' ? 8 : 4",
      hint: "A corner is where two sides meet.",
      figure: {
        kind: "polygon",
        shape: "shape"
      },
      tags: [
        "AC9M1SP01",
        "MA1-2DS-01"
      ]
    },
    {
      id: "maths.1.shapes.side-count-claim",
      subject: "maths",
      topic: "shapes",
      level: "1",
      prompt: "True or false: this shape has {claim} sides.",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "equilateral",
            "scalene",
            "square",
            "rectangle",
            "trapezium",
            "kite",
            "pentagon",
            "hexagon"
          ]
        },
        {
          name: "sides",
          kind: "expr",
          expr: "shape == 'equilateral' || shape == 'isosceles' || shape == 'scalene' || shape == 'right-triangle' ? 3 : shape == 'pentagon' ? 5 : shape == 'hexagon' ? 6 : shape == 'heptagon' ? 7 : shape == 'octagon' ? 8 : 4"
        },
        {
          name: "right",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "claim",
          kind: "expr",
          expr: "right == 1 ? sides : sides != 4 ? 4 : shape == 'square' || shape == 'rectangle' ? 3 : shape == 'trapezium' ? 5 : 6"
        }
      ],
      answer: "sides == claim",
      figure: {
        kind: "polygon",
        shape: "shape"
      },
      tags: [
        "AC9M1SP01",
        "MA1-2DS-01"
      ]
    },
    {
      id: "maths.1.shapes.solid-name",
      subject: "maths",
      topic: "shapes",
      level: "1",
      prompt: "What is this called?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "sphere",
            "cone",
            "cylinder",
            "square-pyramid"
          ]
        },
        {
          name: "i",
          kind: "expr",
          expr: "shape == 'cube' ? 0 : shape == 'sphere' ? 1 : shape == 'cone' ? 2 : shape == 'cylinder' ? 3 : 4"
        },
        {
          name: "gap",
          kind: "pick",
          from: [
            1,
            2,
            3,
            4
          ]
        },
        {
          name: "a",
          kind: "expr",
          expr: "gap == 1 ? 2 : 1"
        },
        {
          name: "b",
          kind: "expr",
          expr: "gap <= 2 ? 3 : 2"
        },
        {
          name: "c",
          kind: "expr",
          expr: "gap == 4 ? 3 : 4"
        }
      ],
      answer: "i == 0 ? 'cube' : i == 1 ? 'sphere' : i == 2 ? 'cone' : i == 3 ? 'cylinder' : 'pyramid'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "mod(i + a, 5) == 0 ? 'cube' : mod(i + a, 5) == 1 ? 'sphere' : mod(i + a, 5) == 2 ? 'cone' : mod(i + a, 5) == 3 ? 'cylinder' : 'pyramid'",
          "mod(i + b, 5) == 0 ? 'cube' : mod(i + b, 5) == 1 ? 'sphere' : mod(i + b, 5) == 2 ? 'cone' : mod(i + b, 5) == 3 ? 'cylinder' : 'pyramid'",
          "mod(i + c, 5) == 0 ? 'cube' : mod(i + c, 5) == 1 ? 'sphere' : mod(i + c, 5) == 2 ? 'cone' : mod(i + c, 5) == 3 ? 'cylinder' : 'pyramid'"
        ]
      },
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M1SP01",
        "MA1-3DS-01"
      ]
    },
    {
      id: "maths.1.shapes.solid-curved",
      subject: "maths",
      topic: "shapes",
      level: "1",
      prompt: "True or false: this shape has a curved surface.",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "cuboid",
            "sphere",
            "cone",
            "cylinder",
            "square-pyramid",
            "triangular-prism"
          ],
          weights: [
            3,
            3,
            4,
            4,
            4,
            3,
            3
          ]
        }
      ],
      answer: "shape == 'sphere' || shape == 'cone' || shape == 'cylinder'",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M1SP01",
        "MA1-3DS-01"
      ]
    },
    {
      id: "maths.1.shapes.solid-flat-faces",
      subject: "maths",
      topic: "shapes",
      level: "1",
      prompt: "How many flat faces does this shape have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "cuboid",
            "cone",
            "cylinder",
            "square-pyramid",
            "triangular-prism"
          ]
        }
      ],
      answer: "shape == 'cone' ? 1 : shape == 'cylinder' ? 2 : shape == 'square-pyramid' || shape == 'triangular-prism' ? 5 : 6",
      hint: "A flat face is a side you could stand the shape on.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M1SP01",
        "MA1-3DS-01"
      ]
    },
    {
      id: "maths.1.position.grid-squares-left",
      subject: "maths",
      topic: "position",
      level: "1",
      prompt: "How many squares are there to the left of the dot in the same row?",
      vars: [
        {
          name: "c",
          kind: "int",
          min: "2",
          max: "5"
        },
        {
          name: "r",
          kind: "int",
          min: "1",
          max: "4"
        }
      ],
      answer: "c - 1",
      hint: "Count along the row from the left edge up to the dot.",
      figure: {
        kind: "grid",
        at: "c + ',' + r",
        axisLabels: "'none'"
      },
      tags: [
        "AC9M1SP02",
        "MA1-GM-01"
      ]
    },
    {
      id: "maths.1.position.grid-bottom-row",
      subject: "maths",
      topic: "position",
      level: "1",
      prompt: "True or false: the dot is in the bottom row.",
      vars: [
        {
          name: "bottom",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "r",
          kind: "int",
          min: "bottom == 1 ? 1 : 2",
          max: "bottom == 1 ? 1 : 4"
        },
        {
          name: "c",
          kind: "int",
          min: "1",
          max: "4"
        }
      ],
      answer: "r == 1",
      figure: {
        kind: "grid",
        at: "c + ',' + r",
        axisLabels: "'none'"
      },
      tags: [
        "AC9M1SP02",
        "MA1-GM-01"
      ]
    },
    {
      id: "maths.1.data.compare-tallies",
      subject: "maths",
      topic: "data",
      level: "1",
      prompt: "A class tally shows {a} children chose cats and {b} chose dogs. How many more chose cats?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "6",
          max: "18"
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "5"
        }
      ],
      answer: "a - b",
      tags: [
        "AC9M1ST02",
        "MA1-DATA-02"
      ]
    },
    {
      id: "maths.1.data.graph-fewest",
      subject: "maths",
      topic: "data",
      level: "1",
      prompt: "This graph shows the fruit our class picked. Which fruit did the fewest children pick?",
      vars: [
        {
          name: "pear",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "plum",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "kiwi",
          kind: "int",
          min: "1",
          max: "5"
        }
      ],
      constraints: [
        "pear != plum",
        "plum != kiwi",
        "pear != kiwi"
      ],
      answer: "pear < plum && pear < kiwi ? 'Pear' : plum < kiwi ? 'Plum' : 'Kiwi'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'Pear'",
          "'Plum'",
          "'Kiwi'"
        ]
      },
      hint: "The shortest column is the fewest.",
      figure: {
        kind: "bar",
        values: "pear + ',' + plum + ',' + kiwi",
        labels: "'Pear,Plum,Kiwi'",
        scale: "1",
        style: "'column'"
      },
      tags: [
        "AC9M1ST02",
        "MA1-DATA-02"
      ]
    },
    {
      id: "maths.1.data.graph-difference",
      subject: "maths",
      topic: "data",
      level: "1",
      prompt: "This graph shows how we travel to school. How many more children come by {more} than by {less}?",
      vars: [
        {
          name: "car",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "bus",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "bike",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "k",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "j",
          kind: "expr",
          expr: "mod(i + k, 3)"
        },
        {
          name: "big",
          kind: "expr",
          expr: "i == 0 ? car : i == 1 ? bus : bike"
        },
        {
          name: "small",
          kind: "expr",
          expr: "j == 0 ? car : j == 1 ? bus : bike"
        },
        {
          name: "more",
          kind: "expr",
          expr: "i == 0 ? 'car' : i == 1 ? 'bus' : 'bike'"
        },
        {
          name: "less",
          kind: "expr",
          expr: "j == 0 ? 'car' : j == 1 ? 'bus' : 'bike'"
        }
      ],
      constraints: [
        "big > small"
      ],
      answer: "big - small",
      hint: "Count both columns, then take the smaller away from the bigger.",
      figure: {
        kind: "bar",
        values: "car + ',' + bus + ',' + bike",
        labels: "'Car,Bus,Bike'",
        scale: "1",
        style: "'column'"
      },
      tags: [
        "AC9M1ST02",
        "MA1-DATA-02"
      ]
    },
    {
      id: "maths.1.data.picture-total",
      subject: "maths",
      topic: "data",
      level: "1",
      prompt: "Each picture stands for one book. How many books were read altogether?",
      vars: [
        {
          name: "zoe",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "sam",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "eli",
          kind: "int",
          min: "1",
          max: "4"
        }
      ],
      answer: "zoe + sam + eli",
      hint: "Count every picture in the graph.",
      figure: {
        kind: "pictograph",
        counts: "zoe + ',' + sam + ',' + eli",
        labels: "'Zoe,Sam,Eli'",
        key: "1"
      },
      tags: [
        "AC9M1ST02",
        "MA1-DATA-02"
      ]
    },
    {
      id: "maths.1.data.picture-claim",
      subject: "maths",
      topic: "data",
      level: "1",
      prompt: "Each picture stands for one shell. True or false: {a} found more shells than {b}.",
      vars: [
        {
          name: "ivy",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "tom",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "ben",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "k",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "j",
          kind: "expr",
          expr: "mod(i + k, 3)"
        },
        {
          name: "va",
          kind: "expr",
          expr: "i == 0 ? ivy : i == 1 ? tom : ben"
        },
        {
          name: "vb",
          kind: "expr",
          expr: "j == 0 ? ivy : j == 1 ? tom : ben"
        },
        {
          name: "a",
          kind: "expr",
          expr: "i == 0 ? 'Ivy' : i == 1 ? 'Tom' : 'Ben'"
        },
        {
          name: "b",
          kind: "expr",
          expr: "j == 0 ? 'Ivy' : j == 1 ? 'Tom' : 'Ben'"
        }
      ],
      constraints: [
        "va != vb"
      ],
      answer: "va > vb",
      figure: {
        kind: "pictograph",
        counts: "ivy + ',' + tom + ',' + ben",
        labels: "'Ivy,Tom,Ben'",
        key: "1"
      },
      tags: [
        "AC9M1ST02",
        "MA1-DATA-02"
      ]
    },
    {
      id: "maths.1.chance.spinner-will-might",
      subject: "maths",
      topic: "chance",
      level: "1",
      prompt: "The arrow on this spinner is spun. Will it stop on {part}?",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            3,
            4,
            6
          ]
        },
        {
          name: "whole",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "s",
          kind: "int",
          min: "whole == 1 ? n : 1",
          max: "whole == 1 ? n : n - 1"
        },
        {
          name: "asked",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "part",
          kind: "expr",
          expr: "asked == 1 ? 'a shaded part' : 'a part with no shading'"
        }
      ],
      answer: "asked == 1 ? (s == n ? 'It will' : 'It might') : (s == n ? 'It will not' : 'It might')",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'It might'",
          "asked == 1 ? 'It will' : 'It will not'"
        ]
      },
      figure: {
        kind: "spinner",
        sectors: "n == 3 ? '1,1,1' : n == 4 ? '1,1,1,1' : '1,1,1,1,1,1'",
        fills: "n == 3 ? (s == 1 ? 'a,b,b' : s == 2 ? 'a,a,b' : 'a,a,a') : n == 4 ? (s == 1 ? 'a,b,b,b' : s == 2 ? 'a,a,b,b' : s == 3 ? 'a,a,a,b' : 'a,a,a,a') : (s == 1 ? 'a,b,b,b,b,b' : s == 2 ? 'a,a,b,b,b,b' : s == 3 ? 'a,a,a,b,b,b' : s == 4 ? 'a,a,a,a,b,b' : s == 5 ? 'a,a,a,a,a,b' : 'a,a,a,a,a,a')"
      },
      tags: [
        "AC9M1P01",
        "MA1-CHAN-01"
      ]
    },
    {
      id: "maths.1.chance.spinner-more-likely",
      subject: "maths",
      topic: "chance",
      level: "1",
      prompt: "Is the arrow more likely to stop on a shaded part or on a part with no shading?",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            3,
            4,
            6
          ]
        },
        {
          name: "s",
          kind: "int",
          min: "1",
          max: "n - 1"
        }
      ],
      constraints: [
        "s * 2 != n"
      ],
      answer: "s * 2 > n ? 'a shaded part' : 'a part with no shading'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'a shaded part'",
          "'a part with no shading'"
        ]
      },
      hint: "More parts means more chance.",
      figure: {
        kind: "spinner",
        sectors: "n == 3 ? '1,1,1' : n == 4 ? '1,1,1,1' : '1,1,1,1,1,1'",
        fills: "n == 3 ? (s == 1 ? 'a,b,b' : s == 2 ? 'a,a,b' : 'a,a,a') : n == 4 ? (s == 1 ? 'a,b,b,b' : s == 2 ? 'a,a,b,b' : s == 3 ? 'a,a,a,b' : 'a,a,a,a') : (s == 1 ? 'a,b,b,b,b,b' : s == 2 ? 'a,a,b,b,b,b' : s == 3 ? 'a,a,a,b,b,b' : s == 4 ? 'a,a,a,a,b,b' : s == 5 ? 'a,a,a,a,a,b' : 'a,a,a,a,a,a')"
      },
      tags: [
        "AC9M1P01",
        "MA1-CHAN-01"
      ]
    },
    {
      id: "maths.1.chance.spinner-same-chance",
      subject: "maths",
      topic: "chance",
      level: "1",
      prompt: "True or false: the arrow is just as likely to stop on a shaded part as on a part with no shading.",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            4,
            6
          ]
        },
        {
          name: "same",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "off",
          kind: "int",
          min: "1",
          max: "n - 2"
        },
        {
          name: "s",
          kind: "expr",
          expr: "same == 1 ? n / 2 : mod(n / 2 - 1 + off, n - 1) + 1"
        }
      ],
      answer: "s * 2 == n",
      hint: "Count the shaded parts, then the parts with no shading.",
      figure: {
        kind: "spinner",
        sectors: "n == 4 ? '1,1,1,1' : '1,1,1,1,1,1'",
        fills: "n == 4 ? (s == 1 ? 'a,b,b,b' : s == 2 ? 'a,a,b,b' : s == 3 ? 'a,a,a,b' : 'a,a,a,a') : (s == 1 ? 'a,b,b,b,b,b' : s == 2 ? 'a,a,b,b,b,b' : s == 3 ? 'a,a,a,b,b,b' : s == 4 ? 'a,a,a,a,b,b' : s == 5 ? 'a,a,a,a,a,b' : 'a,a,a,a,a,a')"
      },
      tags: [
        "AC9M1P01",
        "MA1-CHAN-01"
      ]
    }
  ]
};

// ../../src/content/packs/maths.2.json
var maths_2_default = {
  version: "0e7ce738fd0f",
  subject: "maths",
  level: "2",
  templates: [
    {
      id: "maths.2.counting-numbers.largest",
      subject: "maths",
      topic: "counting numbers",
      level: "2",
      prompt: "Which of these is the largest: {a}, {b} or {c}?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "100",
          max: "999"
        },
        {
          name: "b",
          kind: "int",
          min: "100",
          max: "999"
        },
        {
          name: "c",
          kind: "int",
          min: "100",
          max: "999"
        }
      ],
      constraints: [
        "a != b",
        "b != c",
        "a != c"
      ],
      answer: "max(a, b, c)",
      hint: "Compare the hundreds first.",
      tags: [
        "AC9M2N01",
        "MA1-RWN-02"
      ]
    },
    {
      id: "maths.2.counting-numbers.number-line",
      subject: "maths",
      topic: "counting numbers",
      level: "2",
      prompt: "What number is the arrow pointing to?",
      vars: [
        {
          name: "base",
          kind: "int",
          min: "0",
          max: "19"
        },
        {
          name: "start",
          kind: "expr",
          expr: "base * 50"
        },
        {
          name: "k",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "n",
          kind: "expr",
          expr: "start + k * 10"
        }
      ],
      answer: "n",
      hint: "Start at the number on the left, then count along the small ticks.",
      figure: {
        kind: "number-line",
        at: "n",
        from: "start",
        to: "start + 50",
        step: "50"
      },
      tags: [
        "AC9M2N01",
        "MA1-RWN-02"
      ]
    },
    {
      id: "maths.2.place-value.count-hundreds",
      subject: "maths",
      topic: "place value",
      level: "2",
      prompt: "How many whole hundreds are there in {x}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "150",
          max: "999"
        }
      ],
      answer: "floor(x / 100)",
      tags: [
        "AC9M2N02",
        "MA1-RWN-01"
      ]
    },
    {
      id: "maths.2.place-value.build",
      subject: "maths",
      topic: "place value",
      level: "2",
      prompt: "What number is {h} hundreds, {t} tens and {o} ones?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "t",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "o",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "h * 100 + t * 10 + o",
      tags: [
        "AC9M2N02",
        "MA1-RWN-01"
      ]
    },
    {
      id: "maths.2.place-value.zero-digit",
      subject: "maths",
      topic: "place value",
      level: "2",
      prompt: "What number is {h} hundreds and {o} ones, with no tens?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "o",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "h * 100 + o",
      hint: "A zero holds the tens place open.",
      tags: [
        "AC9M2N02",
        "MA1-RWN-01"
      ]
    },
    {
      id: "maths.2.addition.two-digit",
      subject: "maths",
      topic: "addition",
      level: "2",
      prompt: "What is {x} + {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "10",
          max: "59"
        },
        {
          name: "y",
          kind: "int",
          min: "10",
          max: "39"
        }
      ],
      answer: "x + y",
      hint: "Add the tens, then add the ones.",
      tags: [
        "AC9M2N04",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.2.addition.missing-addend",
      subject: "maths",
      topic: "addition",
      level: "2",
      prompt: "What goes in the box? {x} + ? = {total}",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "20"
        },
        {
          name: "y",
          kind: "int",
          min: "2",
          max: "20"
        },
        {
          name: "total",
          kind: "expr",
          expr: "x + y"
        }
      ],
      answer: "y",
      hint: "How many more than {x} is {total}?",
      tags: [
        "AC9M2N04",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.2.addition.facts-to-twenty",
      subject: "maths",
      topic: "addition",
      level: "2",
      prompt: "What is {x} + {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "4",
          max: "16"
        },
        {
          name: "y",
          kind: "int",
          min: "4",
          max: "20 - x"
        }
      ],
      answer: "x + y",
      tags: [
        "AC9M2A02",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.2.subtraction.two-digit",
      subject: "maths",
      topic: "subtraction",
      level: "2",
      prompt: "What is {x} \u2212 {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "20",
          max: "99"
        },
        {
          name: "y",
          kind: "int",
          min: "10",
          max: "49"
        }
      ],
      constraints: [
        "x > y"
      ],
      answer: "x - y",
      tags: [
        "AC9M2N04",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.2.subtraction.facts-to-twenty",
      subject: "maths",
      topic: "subtraction",
      level: "2",
      prompt: "What is {total} \u2212 {x}?",
      vars: [
        {
          name: "total",
          kind: "int",
          min: "11",
          max: "20"
        },
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "total - x",
      hint: "If you know {x} + {total - x} = {total}, you know this one.",
      tags: [
        "AC9M2A02",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.2.addition-and-subtraction.mixed",
      subject: "maths",
      topic: "addition and subtraction",
      level: "2",
      prompt: "What is {x} {op} {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "10",
          max: "30"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "9"
        },
        {
          name: "op",
          kind: "pick",
          from: [
            "+",
            "\u2212"
          ]
        }
      ],
      answer: "op == '+' ? x + y : x - y",
      tags: [
        "AC9M2N04",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.2.even-and-odd.next-odd",
      subject: "maths",
      topic: "even and odd",
      level: "2",
      prompt: "{x} is an odd number. What is the next odd number?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "21",
          max: "97",
          step: 2
        }
      ],
      constraints: [
        "isOdd(x)"
      ],
      answer: "x + 2",
      tags: [
        "AC9M2A01",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.2.even-and-odd.previous-even",
      subject: "maths",
      topic: "even and odd",
      level: "2",
      prompt: "What is the largest even number smaller than {x}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "21",
          max: "99"
        }
      ],
      constraints: [
        "isOdd(x)"
      ],
      answer: "x - 1",
      tags: [
        "AC9M2A01",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.2.multiplication.doubles",
      subject: "maths",
      topic: "multiplication",
      level: "2",
      prompt: "What is double {x}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "20"
        }
      ],
      answer: "x * 2",
      hint: "{x} + {x}",
      tags: [
        "AC9M2A03",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.2.multiplication.twos",
      subject: "maths",
      topic: "multiplication",
      level: "2",
      prompt: "What is {x} \xD7 2?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "12"
        }
      ],
      answer: "x * 2",
      tags: [
        "AC9M2A03",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.2.multiplication.equal-groups",
      subject: "maths",
      topic: "multiplication",
      level: "2",
      prompt: "There are {n} bags with {each} marbles in each bag. How many marbles altogether?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "6"
        },
        {
          name: "each",
          kind: "pick",
          from: [
            2,
            5,
            10
          ]
        }
      ],
      answer: "n * each",
      hint: "Skip count by {each}s, {n} times.",
      tags: [
        "AC9M2N05",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.2.multiplication.array-total",
      subject: "maths",
      topic: "multiplication",
      level: "2",
      prompt: "How many dots are there altogether?",
      vars: [
        {
          name: "each",
          kind: "pick",
          from: [
            2,
            5
          ]
        },
        {
          name: "groups",
          kind: "int",
          min: "3",
          max: "7"
        }
      ],
      answer: "each * groups",
      hint: "Count the dots in one row, then skip count.",
      figure: {
        kind: "array",
        rows: "groups",
        columns: "each"
      },
      tags: [
        "AC9M2N05",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.2.division.halving",
      subject: "maths",
      topic: "division",
      level: "2",
      prompt: "{total} counters are shared equally between 2 children. How many does each child get?",
      vars: [
        {
          name: "each",
          kind: "int",
          min: "3",
          max: "20"
        },
        {
          name: "total",
          kind: "expr",
          expr: "each * 2"
        }
      ],
      answer: "each",
      tags: [
        "AC9M2A03",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.2.division.by-twos",
      subject: "maths",
      topic: "division",
      level: "2",
      prompt: "What is {total} \xF7 2?",
      vars: [
        {
          name: "half",
          kind: "int",
          min: "3",
          max: "25"
        },
        {
          name: "total",
          kind: "expr",
          expr: "half * 2"
        }
      ],
      answer: "half",
      hint: "Halving is the opposite of doubling.",
      tags: [
        "AC9M2A03",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.2.fractions.half-of",
      subject: "maths",
      topic: "fractions",
      level: "2",
      prompt: "What is half of {x}?",
      vars: [
        {
          name: "half",
          kind: "int",
          min: "2",
          max: "20"
        },
        {
          name: "x",
          kind: "expr",
          expr: "half * 2"
        }
      ],
      answer: "half",
      hint: "Split {x} into 2 equal parts.",
      tags: [
        "AC9M2N03",
        "MA1-GM-03"
      ]
    },
    {
      id: "maths.2.fractions.quarter-of",
      subject: "maths",
      topic: "fractions",
      level: "2",
      prompt: "What is one quarter of {x}?",
      vars: [
        {
          name: "quarter",
          kind: "int",
          min: "2",
          max: "12"
        },
        {
          name: "x",
          kind: "expr",
          expr: "quarter * 4"
        }
      ],
      answer: "quarter",
      hint: "Halve {x}, then halve it again.",
      tags: [
        "AC9M2N03",
        "MA1-GM-03"
      ]
    },
    {
      id: "maths.2.fractions.repeated-halving",
      subject: "maths",
      topic: "fractions",
      level: "2",
      prompt: "Half of {x} is {x / 2}. What is half of {x / 2}?",
      vars: [
        {
          name: "quarter",
          kind: "int",
          min: "2",
          max: "12"
        },
        {
          name: "x",
          kind: "expr",
          expr: "quarter * 4"
        }
      ],
      answer: "quarter",
      tags: [
        "AC9M2N03",
        "MA1-GM-03"
      ]
    },
    {
      id: "maths.2.fractions.parts-of-a-whole",
      subject: "maths",
      topic: "fractions",
      level: "2",
      prompt: "How many {name} make one whole?",
      vars: [
        {
          name: "name",
          kind: "pick",
          from: [
            "halves",
            "quarters",
            "eighths"
          ]
        }
      ],
      answer: "name == 'halves' ? 2 : name == 'quarters' ? 4 : 8",
      tags: [
        "AC9M2N03",
        "AC9M2M02",
        "MA1-GM-03"
      ]
    },
    {
      id: "maths.2.fractions.how-much-shaded",
      subject: "maths",
      topic: "fractions",
      level: "2",
      prompt: "How much of this shape is shaded?",
      vars: [
        {
          name: "which",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3,
            4,
            5,
            6
          ],
          weights: [
            2,
            3,
            2,
            6,
            6,
            3,
            2
          ]
        },
        {
          name: "d",
          kind: "expr",
          expr: "which == 0 ? 2 : which <= 3 ? 4 : 8"
        },
        {
          name: "n",
          kind: "expr",
          expr: "which == 2 ? 2 : which == 3 ? 3 : which == 5 ? 2 : which == 6 ? 4 : 1"
        }
      ],
      answer: "n * 2 == d ? 'a half' : n * 4 == d ? 'a quarter' : n * 8 == d ? 'an eighth' : 'three quarters'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'a half'",
          "'a quarter'",
          "'an eighth'",
          "'three quarters'"
        ]
      },
      hint: "Count how many equal parts there are, then how many are shaded.",
      figure: {
        kind: "fraction-shape",
        numerator: "n",
        denominator: "d"
      },
      tags: [
        "AC9M2M02",
        "MA1-GM-03"
      ]
    },
    {
      id: "maths.2.number-patterns.additive",
      subject: "maths",
      topic: "number patterns",
      level: "2",
      prompt: "What comes next? {a}, {a + d}, {a + 2 * d}, {a + 3 * d}, ?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "20"
        },
        {
          name: "d",
          kind: "int",
          min: "3",
          max: "9"
        }
      ],
      answer: "a + 4 * d",
      hint: "The numbers go up by {d} each time.",
      tags: [
        "AC9M2A01",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.2.number-patterns.missing-element",
      subject: "maths",
      topic: "number patterns",
      level: "2",
      prompt: "Fill in the gap: {a}, ?, {a + 2 * d}, {a + 3 * d}",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "30"
        },
        {
          name: "d",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "a + d",
      tags: [
        "AC9M2A01",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.2.number-patterns.decreasing",
      subject: "maths",
      topic: "number patterns",
      level: "2",
      prompt: "What comes next? {a}, {a - d}, {a - 2 * d}, ?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "a",
          kind: "int",
          min: "d * 4",
          max: "d * 10"
        }
      ],
      answer: "a - 3 * d",
      tags: [
        "AC9M2A01",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.2.money.coins-to-dollars",
      subject: "maths",
      topic: "money",
      level: "2",
      prompt: "How many 50c coins make ${d}?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "1",
          max: "6"
        }
      ],
      answer: "d * 2",
      hint: "Two 50c coins make one dollar.",
      tags: [
        "AC9M2N06",
        "MA1-FG-01"
      ]
    },
    {
      id: "maths.2.money.total-cents",
      subject: "maths",
      topic: "money",
      level: "2",
      prompt: "A pencil costs {a}c and a rubber costs {b}c. How much do they cost together, in cents?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "5",
          max: "95",
          step: 5
        },
        {
          name: "b",
          kind: "int",
          min: "5",
          max: "95",
          step: 5
        }
      ],
      answer: "a + b",
      tags: [
        "AC9M2N06",
        "MA1-CSQ-01"
      ]
    },
    {
      id: "maths.2.measurement.mass-balance",
      subject: "maths",
      topic: "measurement",
      level: "2",
      prompt: "One apple weighs the same as {n} blocks. How many blocks weigh the same as {k} apples?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "6"
        },
        {
          name: "k",
          kind: "int",
          min: "2",
          max: "5"
        }
      ],
      answer: "n * k",
      hint: "Each apple needs {n} blocks, so count {n} for every apple.",
      tags: [
        "AC9M2M01",
        "MA1-NSM-01"
      ]
    },
    {
      id: "maths.2.measurement.mass-difference",
      subject: "maths",
      topic: "measurement",
      level: "2",
      prompt: "A tin balances {a} blocks and a jar balances {b} blocks. How many more blocks is the tin?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "6",
          max: "20"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "5"
        }
      ],
      answer: "a - b",
      hint: "Take the jar\u2019s blocks away from the tin\u2019s.",
      tags: [
        "AC9M2M01",
        "MA1-NSM-01"
      ]
    },
    {
      id: "maths.2.time.half-hours",
      subject: "maths",
      topic: "time",
      level: "2",
      prompt: "How many minutes are there in {n} half-hours?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "6"
        }
      ],
      answer: "n * 30",
      hint: "Half an hour is 30 minutes.",
      tags: [
        "AC9M2M04",
        "MA1-NSM-02"
      ]
    },
    {
      id: "maths.2.time.calendar-days",
      subject: "maths",
      topic: "time",
      level: "2",
      prompt: "Today is the {d}th of the month. What date will it be in {k} days?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "1",
          max: "20"
        },
        {
          name: "k",
          kind: "int",
          min: "2",
          max: "7"
        }
      ],
      answer: "d + k",
      tags: [
        "AC9M2M03",
        "MA1-NSM-02"
      ]
    },
    {
      id: "maths.2.time.quarter-time",
      subject: "maths",
      topic: "time",
      level: "2",
      prompt: "What time is this?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "past",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "off",
          kind: "pick",
          from: [
            -5,
            -4,
            -3,
            -2,
            -1,
            1,
            2,
            3,
            4,
            5
          ]
        },
        {
          name: "g",
          kind: "expr",
          expr: "mod(a + off - 1, 12) + 1"
        },
        {
          name: "h",
          kind: "expr",
          expr: "past == 1 ? a : mod(a + 10, 12) + 1"
        }
      ],
      answer: "past == 1 ? 'quarter past ' + a : 'quarter to ' + a",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "past == 1 ? 'quarter to ' + a : 'quarter past ' + a",
          "past == 1 ? 'quarter past ' + g : 'quarter to ' + g",
          "past == 1 ? 'quarter to ' + g : 'quarter past ' + g"
        ]
      },
      hint: "The long hand points to 3 for quarter past and to 9 for quarter to.",
      figure: {
        kind: "clock",
        hour: "h",
        minute: "past == 1 ? 15 : 45",
        numerals: "true"
      },
      tags: [
        "AC9M2M04",
        "MA1-NSM-02"
      ]
    },
    {
      id: "maths.2.time.quarter-claim",
      subject: "maths",
      topic: "time",
      level: "2",
      prompt: "True or false: this clock shows {claim}.",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "past",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "m",
          kind: "expr",
          expr: "past == 1 ? 15 : 45"
        },
        {
          name: "trueHour",
          kind: "expr",
          expr: "past == 1 ? a : mod(a + 10, 12) + 1"
        },
        {
          name: "right",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "slip",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "off",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "wm",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "wrongMinute",
          kind: "expr",
          expr: "wm == 0 ? 0 : wm == 1 ? 30 : (past == 1 ? 45 : 15)"
        },
        {
          name: "shownHour",
          kind: "expr",
          expr: "right == 1 || slip == 0 ? trueHour : mod(trueHour + off - 1, 12) + 1"
        },
        {
          name: "shownMinute",
          kind: "expr",
          expr: "right == 1 || slip == 1 ? m : wrongMinute"
        },
        {
          name: "claim",
          kind: "expr",
          expr: "past == 1 ? 'quarter past ' + a : 'quarter to ' + a"
        }
      ],
      answer: "shownHour == trueHour && shownMinute == m",
      figure: {
        kind: "clock",
        hour: "shownHour",
        minute: "shownMinute",
        numerals: "true"
      },
      tags: [
        "AC9M2M04",
        "MA1-NSM-02"
      ]
    },
    {
      id: "maths.2.turns.quarter-turns",
      subject: "maths",
      topic: "turns",
      level: "2",
      prompt: "How many quarter turns are there in {n} full turns?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "1",
          max: "5"
        }
      ],
      answer: "n * 4",
      hint: "One full turn is 4 quarter turns.",
      tags: [
        "AC9M2M05",
        "MA1-GM-01"
      ]
    },
    {
      id: "maths.2.shapes.sides",
      subject: "maths",
      topic: "shapes",
      level: "2",
      prompt: "How many sides does {article} {shape} have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "triangle",
            "quadrilateral",
            "pentagon",
            "hexagon",
            "heptagon",
            "octagon"
          ]
        },
        {
          name: "article",
          kind: "expr",
          expr: "shape == 'octagon' ? 'an' : 'a'"
        }
      ],
      answer: "shape == 'triangle' ? 3 : shape == 'quadrilateral' ? 4 : shape == 'pentagon' ? 5 : shape == 'hexagon' ? 6 : shape == 'heptagon' ? 7 : 8",
      tags: [
        "AC9M2SP01",
        "MA1-2DS-01"
      ]
    },
    {
      id: "maths.2.shapes.name-picture",
      subject: "maths",
      topic: "shapes",
      level: "2",
      prompt: "What shape is this?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "pentagon",
            "hexagon",
            "heptagon",
            "octagon"
          ]
        }
      ],
      answer: "shape",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'pentagon'",
          "'hexagon'",
          "'heptagon'",
          "'octagon'"
        ]
      },
      hint: "Count the sides: 5 pentagon, 6 hexagon, 7 heptagon, 8 octagon.",
      figure: {
        kind: "polygon",
        shape: "shape"
      },
      tags: [
        "AC9M2SP01",
        "MA1-2DS-01"
      ]
    },
    {
      id: "maths.2.shapes.sides-picture",
      subject: "maths",
      topic: "shapes",
      level: "2",
      prompt: "How many sides does this shape have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "pentagon",
            "hexagon",
            "heptagon",
            "octagon"
          ]
        }
      ],
      answer: "shape == 'equilateral' || shape == 'isosceles' || shape == 'scalene' || shape == 'right-triangle' ? 3 : shape == 'pentagon' ? 5 : shape == 'hexagon' ? 6 : shape == 'heptagon' ? 7 : shape == 'octagon' ? 8 : 4",
      figure: {
        kind: "polygon",
        shape: "shape"
      },
      tags: [
        "AC9M2SP01",
        "MA1-2DS-01"
      ]
    },
    {
      id: "maths.2.shapes.more-sides-than",
      subject: "maths",
      topic: "shapes",
      level: "2",
      prompt: "True or false: this shape has more than {n} sides.",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "scalene",
            "isosceles",
            "square",
            "trapezium",
            "parallelogram",
            "pentagon",
            "hexagon",
            "heptagon",
            "octagon"
          ]
        },
        {
          name: "sides",
          kind: "expr",
          expr: "shape == 'equilateral' || shape == 'isosceles' || shape == 'scalene' || shape == 'right-triangle' ? 3 : shape == 'pentagon' ? 5 : shape == 'hexagon' ? 6 : shape == 'heptagon' ? 7 : shape == 'octagon' ? 8 : 4"
        },
        {
          name: "n",
          kind: "int",
          min: "3",
          max: "7"
        }
      ],
      answer: "sides > n",
      figure: {
        kind: "polygon",
        shape: "shape"
      },
      tags: [
        "AC9M2SP01",
        "MA1-2DS-01"
      ]
    },
    {
      id: "maths.2.shapes.solid-faces-claim",
      subject: "maths",
      topic: "shapes",
      level: "2",
      prompt: "True or false: this shape has {claim} flat faces.",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "cuboid",
            "square-pyramid",
            "triangular-prism"
          ]
        },
        {
          name: "faces",
          kind: "expr",
          expr: "shape == 'cube' || shape == 'cuboid' ? 6 : 5"
        },
        {
          name: "right",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "claim",
          kind: "expr",
          expr: "right == 1 ? faces : (faces == 6 ? 5 : 6)"
        }
      ],
      answer: "faces == claim",
      hint: "Do not forget the faces at the back.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M2SP01",
        "MA1-3DS-01"
      ]
    },
    {
      id: "maths.2.shapes.solid-edges",
      subject: "maths",
      topic: "shapes",
      level: "2",
      prompt: "How many edges does this shape have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "cuboid",
            "square-pyramid",
            "triangular-prism"
          ]
        }
      ],
      answer: "shape == 'square-pyramid' ? 8 : shape == 'triangular-prism' ? 9 : 12",
      hint: "An edge is a line where two faces meet. The dashed ones count too.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M2SP01",
        "MA1-3DS-01"
      ]
    },
    {
      id: "maths.2.shapes.solid-corners",
      subject: "maths",
      topic: "shapes",
      level: "2",
      prompt: "How many corners does this shape have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "cuboid",
            "square-pyramid",
            "triangular-prism"
          ]
        }
      ],
      answer: "shape == 'square-pyramid' ? 5 : shape == 'triangular-prism' ? 6 : 8",
      hint: "A corner is where the edges meet.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M2SP01",
        "MA1-3DS-01"
      ]
    },
    {
      id: "maths.2.position.grid-square",
      subject: "maths",
      topic: "position",
      level: "2",
      prompt: "What square is the dot in?",
      vars: [
        {
          name: "c",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "r",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "cols",
          kind: "int",
          min: "3",
          max: "5"
        },
        {
          name: "rws",
          kind: "int",
          min: "3",
          max: "5"
        },
        {
          name: "dc",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "dr",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "cn",
          kind: "expr",
          expr: "mod(c - 1 + dc, 3) + 1"
        },
        {
          name: "rn",
          kind: "expr",
          expr: "mod(r - 1 + dr, 3) + 1"
        }
      ],
      answer: "(c == 1 ? 'A' : c == 2 ? 'B' : c == 3 ? 'C' : c == 4 ? 'D' : 'E') + r",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "(cn == 1 ? 'A' : cn == 2 ? 'B' : cn == 3 ? 'C' : cn == 4 ? 'D' : 'E') + r",
          "(c == 1 ? 'A' : c == 2 ? 'B' : c == 3 ? 'C' : c == 4 ? 'D' : 'E') + rn",
          "(cn == 1 ? 'A' : cn == 2 ? 'B' : cn == 3 ? 'C' : cn == 4 ? 'D' : 'E') + rn"
        ]
      },
      hint: "Read the letter along the bottom first, then the number up the side.",
      figure: {
        kind: "grid",
        at: "c + ',' + r",
        columns: "cols",
        rows: "rws",
        axisLabels: "'letters'",
        onLines: "false"
      },
      tags: [
        "AC9M2SP02"
      ]
    },
    {
      id: "maths.2.position.grid-square-claim",
      subject: "maths",
      topic: "position",
      level: "2",
      prompt: "True or false: the dot is in square {claim}.",
      vars: [
        {
          name: "c",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "r",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "cols",
          kind: "int",
          min: "3",
          max: "5"
        },
        {
          name: "rws",
          kind: "int",
          min: "3",
          max: "5"
        },
        {
          name: "right",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "slip",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "dc",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "dr",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "claimC",
          kind: "expr",
          expr: "right == 1 || slip == 1 ? c : mod(c - 1 + dc, 3) + 1"
        },
        {
          name: "claimR",
          kind: "expr",
          expr: "right == 1 || slip == 0 ? r : mod(r - 1 + dr, 3) + 1"
        },
        {
          name: "claim",
          kind: "expr",
          expr: "(claimC == 1 ? 'A' : claimC == 2 ? 'B' : claimC == 3 ? 'C' : claimC == 4 ? 'D' : 'E') + claimR"
        }
      ],
      answer: "claimC == c && claimR == r",
      figure: {
        kind: "grid",
        at: "c + ',' + r",
        columns: "cols",
        rows: "rws",
        axisLabels: "'letters'",
        onLines: "false"
      },
      tags: [
        "AC9M2SP02"
      ]
    },
    {
      id: "maths.2.data.graph-total",
      subject: "maths",
      topic: "data",
      level: "2",
      prompt: "This graph shows how many books we read each day. How many books were read altogether?",
      vars: [
        {
          name: "mon",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "tue",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "wed",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "thu",
          kind: "int",
          min: "2",
          max: "5"
        }
      ],
      answer: "mon + tue + wed + thu",
      hint: "Read each column, then add them all up.",
      figure: {
        kind: "bar",
        values: "mon + ',' + tue + ',' + wed + ',' + thu",
        labels: "'Mon,Tue,Wed,Thu'",
        scale: "1",
        style: "'column'"
      },
      tags: [
        "AC9M2ST02",
        "MA1-DATA-02"
      ]
    },
    {
      id: "maths.2.data.graph-scale-two",
      subject: "maths",
      topic: "data",
      level: "2",
      prompt: "This graph shows how many stickers we have. How many stickers does {who} have?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "c",
          kind: "int",
          min: "2",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "who",
          kind: "expr",
          expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'"
        }
      ],
      answer: "(i == 0 ? a : i == 1 ? b : c) * 2",
      hint: "The numbers up the side go up in 2s.",
      figure: {
        kind: "bar",
        values: "a * 2 + ',' + b * 2 + ',' + c * 2",
        labels: "'Ada,Kai,Leo'",
        scale: "2",
        style: "'column'"
      },
      tags: [
        "AC9M2ST02",
        "MA1-DATA-02"
      ]
    },
    {
      id: "maths.2.data.graph-same",
      subject: "maths",
      topic: "data",
      level: "2",
      prompt: "This graph shows our favourite colours. True or false: as many chose {a} as chose {b}.",
      vars: [
        {
          name: "same",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "p",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "off",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "q",
          kind: "expr",
          expr: "same == 1 ? p : mod(p - 1 + off, 5) + 1"
        },
        {
          name: "r",
          kind: "int",
          min: "2",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "k",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "j",
          kind: "expr",
          expr: "mod(i + k, 3)"
        },
        {
          name: "v1",
          kind: "expr",
          expr: "i == 0 ? p : j == 0 ? q : r"
        },
        {
          name: "v2",
          kind: "expr",
          expr: "i == 1 ? p : j == 1 ? q : r"
        },
        {
          name: "v3",
          kind: "expr",
          expr: "i == 2 ? p : j == 2 ? q : r"
        },
        {
          name: "a",
          kind: "expr",
          expr: "i == 0 ? 'Blue' : i == 1 ? 'Pink' : 'Gold'"
        },
        {
          name: "b",
          kind: "expr",
          expr: "j == 0 ? 'Blue' : j == 1 ? 'Pink' : 'Gold'"
        }
      ],
      answer: "p == q",
      hint: "Two columns the same height means the same number of children.",
      figure: {
        kind: "bar",
        values: "v1 + ',' + v2 + ',' + v3",
        labels: "'Blue,Pink,Gold'",
        scale: "1",
        style: "'column'"
      },
      tags: [
        "AC9M2ST02",
        "MA1-DATA-02"
      ]
    },
    {
      id: "maths.2.data.picture-key-two",
      subject: "maths",
      topic: "data",
      level: "2",
      prompt: "Each picture stands for 2 shells. How many shells did {who} find?",
      vars: [
        {
          name: "mia",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "jed",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "ann",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "who",
          kind: "expr",
          expr: "i == 0 ? 'Mia' : i == 1 ? 'Jed' : 'Ann'"
        }
      ],
      answer: "(i == 0 ? mia : i == 1 ? jed : ann) * 2",
      hint: "Count the pictures in that row, then count 2 for each one.",
      figure: {
        kind: "pictograph",
        counts: "mia * 2 + ',' + jed * 2 + ',' + ann * 2",
        labels: "'Mia,Jed,Ann'",
        key: "2"
      },
      tags: [
        "AC9M2ST02",
        "MA1-DATA-02"
      ]
    },
    {
      id: "maths.2.chance.spinner-how-likely",
      subject: "maths",
      topic: "chance",
      level: "2",
      prompt: "The arrow on this spinner is spun. How likely is it to stop on {part}?",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            3,
            4,
            6
          ]
        },
        {
          name: "whole",
          kind: "pick",
          from: [
            1,
            0
          ],
          weights: [
            1,
            2
          ]
        },
        {
          name: "s",
          kind: "int",
          min: "whole == 1 ? n : 1",
          max: "whole == 1 ? n : n - 1"
        },
        {
          name: "asked",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "part",
          kind: "expr",
          expr: "asked == 1 ? 'a shaded part' : 'a part with no shading'"
        },
        {
          name: "share",
          kind: "expr",
          expr: "asked == 1 ? s : n - s"
        }
      ],
      constraints: [
        "share * 2 != n"
      ],
      answer: "share == n ? 'certain' : share == 0 ? 'impossible' : share * 2 > n ? 'likely' : 'unlikely'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'likely'",
          "'unlikely'",
          "asked == 1 ? 'certain' : 'impossible'"
        ]
      },
      figure: {
        kind: "spinner",
        sectors: "n == 3 ? '1,1,1' : n == 4 ? '1,1,1,1' : '1,1,1,1,1,1'",
        fills: "n == 3 ? (s == 1 ? 'a,b,b' : s == 2 ? 'a,a,b' : 'a,a,a') : n == 4 ? (s == 1 ? 'a,b,b,b' : s == 2 ? 'a,a,b,b' : s == 3 ? 'a,a,a,b' : 'a,a,a,a') : (s == 1 ? 'a,b,b,b,b,b' : s == 2 ? 'a,a,b,b,b,b' : s == 3 ? 'a,a,a,b,b,b' : s == 4 ? 'a,a,a,a,b,b' : s == 5 ? 'a,a,a,a,a,b' : 'a,a,a,a,a,a')"
      },
      tags: [
        "AC9M2P01",
        "MA1-CHAN-01"
      ]
    },
    {
      id: "maths.2.chance.spinner-impossible",
      subject: "maths",
      topic: "chance",
      level: "2",
      prompt: "True or false: it is impossible for the arrow to stop on a part with no shading.",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            3,
            4,
            6
          ]
        },
        {
          name: "whole",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "s",
          kind: "int",
          min: "whole == 1 ? n : 1",
          max: "whole == 1 ? n : n - 1"
        }
      ],
      answer: "whole == 1",
      hint: "If you can see a part with no shading, it is not impossible.",
      figure: {
        kind: "spinner",
        sectors: "n == 3 ? '1,1,1' : n == 4 ? '1,1,1,1' : '1,1,1,1,1,1'",
        fills: "n == 3 ? (s == 1 ? 'a,b,b' : s == 2 ? 'a,a,b' : 'a,a,a') : n == 4 ? (s == 1 ? 'a,b,b,b' : s == 2 ? 'a,a,b,b' : s == 3 ? 'a,a,a,b' : 'a,a,a,a') : (s == 1 ? 'a,b,b,b,b,b' : s == 2 ? 'a,a,b,b,b,b' : s == 3 ? 'a,a,a,b,b,b' : s == 4 ? 'a,a,a,a,b,b' : s == 5 ? 'a,a,a,a,a,b' : 'a,a,a,a,a,a')"
      },
      tags: [
        "AC9M2P01",
        "MA1-CHAN-01"
      ]
    },
    {
      id: "maths.2.chance.bag-more-likely",
      subject: "maths",
      topic: "chance",
      level: "2",
      prompt: "A bag holds {r} red and {b} blue counters. Without looking, are you more likely to take red or blue?",
      vars: [
        {
          name: "r",
          kind: "int",
          min: "2",
          max: "10"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "10"
        }
      ],
      constraints: [
        "abs(r - b) >= 2"
      ],
      answer: "r > b ? 'red' : 'blue'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'red'",
          "'blue'"
        ]
      },
      hint: "More counters of one colour means more chance of taking that colour.",
      tags: [
        "AC9M2P01",
        "MA1-CHAN-01"
      ]
    }
  ]
};

// ../../src/content/packs/maths.3.json
var maths_3_default = {
  version: "e61e91dcbd1e",
  subject: "maths",
  level: "3",
  templates: [
    {
      id: "maths.3.place-value.count-thousands",
      subject: "maths",
      topic: "place value",
      level: "3",
      prompt: "How many whole thousands are there in {x}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1200",
          max: "99999"
        }
      ],
      answer: "floor(x / 1000)",
      tags: [
        "AC9M3N01",
        "MA2-RN-01"
      ]
    },
    {
      id: "maths.3.place-value.digit-value",
      subject: "maths",
      topic: "place value",
      level: "3",
      prompt: "In the number {x}, what is the value of the digit in the hundreds place?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1000",
          max: "9999"
        }
      ],
      constraints: [
        "mod(floor(x / 100), 10) != 0"
      ],
      answer: "mod(floor(x / 100), 10) * 100",
      hint: "A digit in the hundreds place is worth that many hundreds.",
      tags: [
        "AC9M3N01",
        "MA2-RN-01"
      ]
    },
    {
      id: "maths.3.counting-numbers.round-to-ten",
      subject: "maths",
      topic: "counting numbers",
      level: "3",
      prompt: "Round {x} to the nearest 10.",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "21",
          max: "989"
        }
      ],
      constraints: [
        "mod(x, 10) != 5",
        "mod(x, 10) != 0"
      ],
      answer: "round(x / 10) * 10",
      tags: [
        "AC9M3N05",
        "MA2-RN-01"
      ]
    },
    {
      id: "maths.3.counting-numbers.number-line",
      subject: "maths",
      topic: "counting numbers",
      level: "3",
      prompt: "What number is the arrow pointing to?",
      vars: [
        {
          name: "base",
          kind: "int",
          min: "0",
          max: "98"
        },
        {
          name: "start",
          kind: "expr",
          expr: "base * 100"
        },
        {
          name: "k",
          kind: "pick",
          from: [
            1,
            3,
            7,
            9
          ]
        },
        {
          name: "n",
          kind: "expr",
          expr: "start + k * 10"
        }
      ],
      answer: "n",
      hint: "Start at the number on the left, then count along the small ticks.",
      figure: {
        kind: "number-line",
        at: "n",
        from: "start",
        to: "start + 100",
        step: "100"
      },
      tags: [
        "AC9M3N01",
        "MA2-RN-01"
      ]
    },
    {
      id: "maths.3.addition.three-digit",
      subject: "maths",
      topic: "addition",
      level: "3",
      prompt: "What is {x} + {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "100",
          max: "699"
        },
        {
          name: "y",
          kind: "int",
          min: "100",
          max: "299"
        }
      ],
      answer: "x + y",
      hint: "Add the hundreds, then the tens, then the ones.",
      tags: [
        "AC9M3N03",
        "MA2-AR-01"
      ]
    },
    {
      id: "maths.3.addition.regrouping",
      subject: "maths",
      topic: "addition",
      level: "3",
      prompt: "What is {x} + {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "145",
          max: "486"
        },
        {
          name: "y",
          kind: "int",
          min: "117",
          max: "298"
        }
      ],
      constraints: [
        "mod(x, 10) + mod(y, 10) > 10"
      ],
      answer: "x + y",
      hint: "The ones make more than ten, so one ten is carried over.",
      tags: [
        "AC9M3N03",
        "MA2-AR-01"
      ]
    },
    {
      id: "maths.3.subtraction.three-digit",
      subject: "maths",
      topic: "subtraction",
      level: "3",
      prompt: "What is {x} \u2212 {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "300",
          max: "999"
        },
        {
          name: "y",
          kind: "int",
          min: "100",
          max: "299"
        }
      ],
      answer: "x - y",
      tags: [
        "AC9M3N03",
        "MA2-AR-01"
      ]
    },
    {
      id: "maths.3.multiplication.tables",
      subject: "maths",
      topic: "multiplication",
      level: "3",
      prompt: "What is {x} \xD7 {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "10"
        },
        {
          name: "y",
          kind: "int",
          min: "2",
          max: "10"
        }
      ],
      answer: "x * y",
      hint: "{y} groups of {x}.",
      tags: [
        "AC9M3N04",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.3.multiplication.groups",
      subject: "maths",
      topic: "multiplication",
      level: "3",
      prompt: "There are {x} boxes with {y} pencils in each. How many pencils altogether?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "y",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "x * y",
      tags: [
        "AC9M3N06",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.3.multiplication.known-facts",
      subject: "maths",
      topic: "multiplication",
      level: "3",
      prompt: "What is {x} \xD7 {fact}?",
      vars: [
        {
          name: "fact",
          kind: "pick",
          from: [
            3,
            4,
            5,
            10
          ]
        },
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "10"
        }
      ],
      answer: "x * fact",
      tags: [
        "AC9M3A03",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.3.division.exact",
      subject: "maths",
      topic: "division",
      level: "3",
      prompt: "What is {total} \xF7 {y}?",
      vars: [
        {
          name: "y",
          kind: "int",
          min: "2",
          max: "10"
        },
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "10"
        },
        {
          name: "total",
          kind: "expr",
          expr: "x * y"
        }
      ],
      answer: "x",
      hint: "How many {y}s fit into {total}?",
      tags: [
        "AC9M3N04",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.3.division.sharing",
      subject: "maths",
      topic: "division",
      level: "3",
      prompt: "{total} sweets are shared equally between {y} children. How many does each child get?",
      vars: [
        {
          name: "y",
          kind: "int",
          min: "2",
          max: "6"
        },
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "10"
        },
        {
          name: "total",
          kind: "expr",
          expr: "x * y"
        }
      ],
      answer: "x",
      tags: [
        "AC9M3N06",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.3.division.related-fact",
      subject: "maths",
      topic: "division",
      level: "3",
      prompt: "You know {x} \xD7 {fact} = {x * fact}. What is {x * fact} \xF7 {fact}?",
      vars: [
        {
          name: "fact",
          kind: "pick",
          from: [
            3,
            4,
            5,
            10
          ]
        },
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "10"
        }
      ],
      answer: "x",
      hint: "Division undoes multiplication.",
      tags: [
        "AC9M3A03",
        "MA2-MR-02"
      ]
    },
    {
      id: "maths.3.division.array-in-each-row",
      subject: "maths",
      topic: "division",
      level: "3",
      prompt: "These {total} dots are set out in {r} equal rows. How many dots are in each row?",
      vars: [
        {
          name: "r",
          kind: "int",
          min: "3",
          max: "6"
        },
        {
          name: "c",
          kind: "int",
          min: "3",
          max: "7"
        },
        {
          name: "total",
          kind: "expr",
          expr: "r * c"
        }
      ],
      answer: "c",
      hint: "Count the dots along one row, or work out {total} \xF7 {r}.",
      figure: {
        kind: "array",
        rows: "r",
        columns: "c",
        orientation: "'rows'"
      },
      tags: [
        "AC9M3N04",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.3.fractions.unit-fraction-of",
      subject: "maths",
      topic: "fractions",
      level: "3",
      prompt: "What is one {name} of {total}?",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            3,
            4,
            5,
            10
          ]
        },
        {
          name: "name",
          kind: "expr",
          expr: "d == 3 ? 'third' : d == 4 ? 'quarter' : d == 5 ? 'fifth' : 'tenth'"
        },
        {
          name: "part",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "total",
          kind: "expr",
          expr: "d * part"
        }
      ],
      answer: "part",
      hint: "Split {total} into {d} equal parts.",
      tags: [
        "AC9M3N02",
        "MA2-PF-01"
      ]
    },
    {
      id: "maths.3.fractions.multiple-of-unit",
      subject: "maths",
      topic: "fractions",
      level: "3",
      prompt: "What is {n} {plural} of {total}?",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            3,
            4,
            5,
            10
          ]
        },
        {
          name: "name",
          kind: "expr",
          expr: "d == 3 ? 'third' : d == 4 ? 'quarter' : d == 5 ? 'fifth' : 'tenth'"
        },
        {
          name: "plural",
          kind: "expr",
          expr: "d == 3 ? 'thirds' : d == 4 ? 'quarters' : d == 5 ? 'fifths' : 'tenths'"
        },
        {
          name: "part",
          kind: "int",
          min: "2",
          max: "8"
        },
        {
          name: "total",
          kind: "expr",
          expr: "d * part"
        },
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "d - 1"
        }
      ],
      answer: "n * part",
      hint: "One {name} of {total} is {part}.",
      tags: [
        "AC9M3N02",
        "MA2-PF-01"
      ]
    },
    {
      id: "maths.3.fractions.complete-the-whole",
      subject: "maths",
      topic: "fractions",
      level: "3",
      prompt: "You have {n} {plural} of a cake. How many more {plural} do you need to make a whole cake?",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            3,
            4,
            5,
            10
          ]
        },
        {
          name: "plural",
          kind: "expr",
          expr: "d == 3 ? 'thirds' : d == 4 ? 'quarters' : d == 5 ? 'fifths' : 'tenths'"
        },
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "d - 1"
        }
      ],
      answer: "d - n",
      tags: [
        "AC9M3N02",
        "MA2-PF-01"
      ]
    },
    {
      id: "maths.3.fractions.how-much-shaded",
      subject: "maths",
      topic: "fractions",
      level: "3",
      prompt: "How much of this shape is shaded?",
      vars: [
        {
          name: "which",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ]
        },
        {
          name: "d",
          kind: "expr",
          expr: "which <= 1 ? 3 : 5"
        },
        {
          name: "n",
          kind: "expr",
          expr: "which == 0 || which == 2 ? 1 : 2"
        }
      ],
      answer: "d == 3 ? (n == 1 ? 'one third' : 'two thirds') : (n == 1 ? 'one fifth' : 'two fifths')",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'one third'",
          "'two thirds'",
          "'one fifth'",
          "'two fifths'"
        ]
      },
      hint: "Count how many equal parts there are, then how many are shaded.",
      figure: {
        kind: "fraction-shape",
        numerator: "n",
        denominator: "d"
      },
      tags: [
        "AC9M3N02",
        "MA2-PF-01"
      ]
    },
    {
      id: "maths.3.algebra.unknown-value",
      subject: "maths",
      topic: "algebra",
      level: "3",
      prompt: "What goes in the box? ? + {y} = {total}",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "20",
          max: "180"
        },
        {
          name: "y",
          kind: "int",
          min: "10",
          max: "90"
        },
        {
          name: "total",
          kind: "expr",
          expr: "x + y"
        }
      ],
      answer: "x",
      hint: "Take {y} away from {total}.",
      tags: [
        "AC9M3A01",
        "MA2-AR-02"
      ]
    },
    {
      id: "maths.3.algebra.inverse-operations",
      subject: "maths",
      topic: "algebra",
      level: "3",
      prompt: "You know that {x} + {y} = {total}. What is {total} \u2212 {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "15",
          max: "120"
        },
        {
          name: "y",
          kind: "int",
          min: "5",
          max: "80"
        },
        {
          name: "total",
          kind: "expr",
          expr: "x + y"
        }
      ],
      answer: "x",
      hint: "Adding and subtracting undo each other.",
      tags: [
        "AC9M3A01",
        "MA2-AR-02"
      ]
    },
    {
      id: "maths.3.algebra.mental-strategy",
      subject: "maths",
      topic: "algebra",
      level: "3",
      prompt: "You know {x} + {y} = {x + y}. What is {x * 10} + {y * 10}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "y",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "(x + y) * 10",
      hint: "Ten times bigger in, ten times bigger out.",
      tags: [
        "AC9M3A02",
        "MA2-AR-01"
      ]
    },
    {
      id: "maths.3.time.minutes-in-hours",
      subject: "maths",
      topic: "time",
      level: "3",
      prompt: "How many minutes are there in {n} hours?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "8"
        }
      ],
      answer: "n * 60",
      tags: [
        "AC9M3M03",
        "MA2-NSM-02"
      ]
    },
    {
      id: "maths.3.time.seconds-in-minutes",
      subject: "maths",
      topic: "time",
      level: "3",
      prompt: "How many seconds are there in {n} minutes?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "n * 60",
      tags: [
        "AC9M3M03",
        "MA2-NSM-02"
      ]
    },
    {
      id: "maths.3.time.until-the-hour",
      subject: "maths",
      topic: "time",
      level: "3",
      prompt: "It is {m} minutes past {h} o\u2019clock. How many minutes until {h + 1} o\u2019clock?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "m",
          kind: "int",
          min: "5",
          max: "55",
          step: 5
        }
      ],
      answer: "60 - m",
      tags: [
        "AC9M3M04",
        "MA2-NSM-02"
      ]
    },
    {
      id: "maths.3.time.clock-five-minutes",
      subject: "maths",
      topic: "time",
      level: "3",
      prompt: "What time does this clock show?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "mi",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "m",
          kind: "expr",
          expr: "mi * 5"
        },
        {
          name: "dh",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "hn",
          kind: "expr",
          expr: "mod(h - 1 + dh, 12) + 1"
        },
        {
          name: "dm",
          kind: "int",
          min: "1",
          max: "10"
        },
        {
          name: "mn",
          kind: "expr",
          expr: "(mod(mi - 1 + dm, 11) + 1) * 5"
        },
        {
          name: "ms",
          kind: "expr",
          expr: "m == 5 ? '05' : '' + m"
        },
        {
          name: "mns",
          kind: "expr",
          expr: "mn == 5 ? '05' : '' + mn"
        }
      ],
      answer: "h + ':' + ms",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "hn + ':' + ms",
          "h + ':' + mns",
          "hn + ':' + mns"
        ]
      },
      hint: "The short hand gives the hour. Count round in 5s from the 12 for the minutes.",
      figure: {
        kind: "clock",
        hour: "h",
        minute: "m",
        numerals: "true",
        minuteTicks: "true"
      },
      tags: [
        "AC9M3M04",
        "MA2-NSM-02"
      ]
    },
    {
      id: "maths.3.time.minutes-past",
      subject: "maths",
      topic: "time",
      level: "3",
      prompt: "How many minutes past {h} o\u2019clock is this clock showing?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "mi",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "m",
          kind: "expr",
          expr: "mi * 5"
        }
      ],
      answer: "m",
      hint: "Count round in 5s from the 12 to the long hand.",
      figure: {
        kind: "clock",
        hour: "h",
        minute: "m",
        numerals: "true",
        minuteTicks: "true"
      },
      tags: [
        "AC9M3M04",
        "MA2-NSM-02"
      ]
    },
    {
      id: "maths.3.measurement.centimetres",
      subject: "maths",
      topic: "measurement",
      level: "3",
      prompt: "How many centimetres are there in {n} metres?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "n * 100",
      hint: "One metre is 100 centimetres.",
      tags: [
        "AC9M3M02",
        "MA2-GM-02"
      ]
    },
    {
      id: "maths.3.measurement.grams",
      subject: "maths",
      topic: "measurement",
      level: "3",
      prompt: "How many grams are there in {n} kilograms?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "n * 1000",
      tags: [
        "AC9M3M02",
        "MA2-NSM-01"
      ]
    },
    {
      id: "maths.3.measurement.choose-unit",
      subject: "maths",
      topic: "measurement",
      level: "3",
      prompt: "Would you measure the {thing} in metres or in centimetres?",
      vars: [
        {
          name: "thing",
          kind: "pick",
          from: [
            "length of a classroom",
            "height of a door",
            "length of a pencil",
            "width of a stamp"
          ]
        }
      ],
      answer: "thing == 'length of a classroom' || thing == 'height of a door' ? 'metres' : 'centimetres'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'metres'",
          "'centimetres'"
        ]
      },
      tags: [
        "AC9M3M01",
        "MA2-GM-02"
      ]
    },
    {
      id: "maths.3.measurement.mass-to-a-kilogram",
      subject: "maths",
      topic: "measurement",
      level: "3",
      prompt: "A bag of flour holds {g} grams. How many more grams would make it 1 kilogram?",
      vars: [
        {
          name: "g",
          kind: "int",
          min: "50",
          max: "950",
          step: 50
        }
      ],
      answer: "1000 - g",
      hint: "One kilogram is 1000 grams.",
      tags: [
        "AC9M3M01",
        "MA2-NSM-01"
      ]
    },
    {
      id: "maths.3.measurement.millilitres",
      subject: "maths",
      topic: "measurement",
      level: "3",
      prompt: "How many millilitres are there in {n} litres?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "n * 1000",
      hint: "One litre is 1000 millilitres.",
      tags: [
        "AC9M3M02",
        "MA2-3DS-02"
      ]
    },
    {
      id: "maths.3.measurement.cups-from-a-jug",
      subject: "maths",
      topic: "measurement",
      level: "3",
      prompt: "A jug holds {n} litres of juice. Each cup holds {c} millilitres. How many cups can you fill?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "4"
        },
        {
          name: "c",
          kind: "pick",
          from: [
            100,
            200,
            250,
            500
          ]
        }
      ],
      answer: "n * 1000 / c",
      hint: "The jug holds {n * 1000} millilitres altogether.",
      tags: [
        "AC9M3M01",
        "MA2-3DS-02"
      ]
    },
    {
      id: "maths.3.money.change",
      subject: "maths",
      topic: "money",
      level: "3",
      prompt: "A sticker costs {c}c. You pay with a $2 coin. How much change do you get, in cents?",
      vars: [
        {
          name: "c",
          kind: "int",
          min: "5",
          max: "195",
          step: 5
        }
      ],
      answer: "200 - c",
      hint: "A $2 coin is 200 cents.",
      tags: [
        "AC9M3M06",
        "MA2-AR-01"
      ]
    },
    {
      id: "maths.3.money.cents-in-dollars",
      subject: "maths",
      topic: "money",
      level: "3",
      prompt: "How many cents are there in ${d}?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "d * 100",
      tags: [
        "AC9M3M06",
        "MA2-AR-01"
      ]
    },
    {
      id: "maths.3.angles.right-angles-in-a-turn",
      subject: "maths",
      topic: "angles",
      level: "3",
      prompt: "How many right angles are there in a {turn} turn?",
      vars: [
        {
          name: "turn",
          kind: "pick",
          from: [
            "half",
            "three-quarter",
            "full"
          ]
        }
      ],
      answer: "turn == 'half' ? 2 : turn == 'three-quarter' ? 3 : 4",
      hint: "A quarter turn is one right angle.",
      tags: [
        "AC9M3M05",
        "MA2-GM-03"
      ]
    },
    {
      id: "maths.3.angles.against-a-right-angle",
      subject: "maths",
      topic: "angles",
      level: "3",
      prompt: "Is this angle bigger or smaller than a right angle?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "20",
          max: "160",
          step: 5
        }
      ],
      constraints: [
        "abs(d - 90) >= 25"
      ],
      answer: "d > 90 ? 'bigger' : 'smaller'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'bigger'",
          "'smaller'"
        ]
      },
      hint: "A right angle is the square corner of a page.",
      figure: {
        kind: "angle",
        degrees: "d"
      },
      tags: [
        "AC9M3M05",
        "MA2-GM-03"
      ]
    },
    {
      id: "maths.3.angles.is-a-right-angle",
      subject: "maths",
      topic: "angles",
      level: "3",
      prompt: "True or false: this is a right angle.",
      vars: [
        {
          name: "square",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "off",
          kind: "int",
          min: "25",
          max: "70",
          step: 5
        },
        {
          name: "side",
          kind: "pick",
          from: [
            1,
            -1
          ]
        },
        {
          name: "d",
          kind: "expr",
          expr: "square == 1 ? 90 : 90 + side * off"
        }
      ],
      answer: "square == 1",
      hint: "A right angle is a quarter turn.",
      figure: {
        kind: "angle",
        degrees: "d"
      },
      tags: [
        "AC9M3M05",
        "MA2-GM-03"
      ]
    },
    {
      id: "maths.3.shapes.net-folds-to",
      subject: "maths",
      topic: "shapes",
      level: "3",
      prompt: "Which shape would this net fold up to make?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "cylinder",
            "cone",
            "square-pyramid"
          ]
        }
      ],
      answer: "shape == 'square-pyramid' ? 'pyramid' : shape",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'cube'",
          "'cylinder'",
          "'cone'",
          "'pyramid'"
        ]
      },
      hint: "Look at the flat pieces: how many are there, and what shape is each one?",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'net'"
      },
      tags: [
        "AC9M3SP01",
        "MA2-3DS-01"
      ]
    },
    {
      id: "maths.3.shapes.net-faces",
      subject: "maths",
      topic: "shapes",
      level: "3",
      prompt: "This is the net of a shape. How many faces will it have when it is folded up?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "cuboid",
            "square-pyramid",
            "triangular-prism"
          ]
        }
      ],
      answer: "shape == 'cube' || shape == 'cuboid' ? 6 : 5",
      hint: "Count the flat pieces. Each one folds up to be a face.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'net'"
      },
      tags: [
        "AC9M3SP01",
        "MA2-3DS-01"
      ]
    },
    {
      id: "maths.3.shapes.triangle-face",
      subject: "maths",
      topic: "shapes",
      level: "3",
      prompt: "True or false: this shape has a face shaped like a triangle.",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "cuboid",
            "square-pyramid",
            "triangular-prism"
          ]
        }
      ],
      answer: "shape == 'square-pyramid' || shape == 'triangular-prism'",
      hint: "Look at every face, including the ones at the back.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M3SP01",
        "MA2-3DS-01"
      ]
    },
    {
      id: "maths.3.position.grid-reference",
      subject: "maths",
      topic: "position",
      level: "3",
      prompt: "What square is the dot in?",
      vars: [
        {
          name: "c",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "r",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "cols",
          kind: "int",
          min: "3",
          max: "5"
        },
        {
          name: "rws",
          kind: "int",
          min: "3",
          max: "5"
        },
        {
          name: "dc",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "dr",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "cn",
          kind: "expr",
          expr: "mod(c - 1 + dc, 3) + 1"
        },
        {
          name: "rn",
          kind: "expr",
          expr: "mod(r - 1 + dr, 3) + 1"
        }
      ],
      answer: "(c == 1 ? 'A' : c == 2 ? 'B' : c == 3 ? 'C' : c == 4 ? 'D' : 'E') + r",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "(cn == 1 ? 'A' : cn == 2 ? 'B' : cn == 3 ? 'C' : cn == 4 ? 'D' : 'E') + r",
          "(c == 1 ? 'A' : c == 2 ? 'B' : c == 3 ? 'C' : c == 4 ? 'D' : 'E') + rn",
          "(cn == 1 ? 'A' : cn == 2 ? 'B' : cn == 3 ? 'C' : cn == 4 ? 'D' : 'E') + rn"
        ]
      },
      hint: "Read the letter along the bottom first, then the number up the side.",
      figure: {
        kind: "grid",
        at: "c + ',' + r",
        columns: "cols",
        rows: "rws",
        axisLabels: "'letters'",
        onLines: "false"
      },
      tags: [
        "AC9M3SP02",
        "MA2-GM-01"
      ]
    },
    {
      id: "maths.3.position.grid-direction",
      subject: "maths",
      topic: "position",
      level: "3",
      prompt: "Which square is {dir} the dot?",
      vars: [
        {
          name: "cols",
          kind: "int",
          min: "3",
          max: "5"
        },
        {
          name: "rws",
          kind: "int",
          min: "3",
          max: "5"
        },
        {
          name: "bx",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "by",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "ac",
          kind: "int",
          min: "1 + bx",
          max: "cols - 1 + bx"
        },
        {
          name: "ar",
          kind: "int",
          min: "1 + by",
          max: "rws - 1 + by"
        },
        {
          name: "oc",
          kind: "expr",
          expr: "bx == 1 ? ac - 1 : ac + 1"
        },
        {
          name: "orw",
          kind: "expr",
          expr: "by == 1 ? ar - 1 : ar + 1"
        },
        {
          name: "axis",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "sgn",
          kind: "pick",
          from: [
            1,
            -1
          ]
        },
        {
          name: "c",
          kind: "expr",
          expr: "axis == 1 ? ac : ac - sgn"
        },
        {
          name: "r",
          kind: "expr",
          expr: "axis == 1 ? ar - sgn : ar"
        },
        {
          name: "dir",
          kind: "expr",
          expr: "axis == 1 ? (sgn == 1 ? 'directly above' : 'directly below') : (sgn == 1 ? 'directly to the right of' : 'directly to the left of')"
        }
      ],
      constraints: [
        "c >= 1",
        "c <= cols",
        "r >= 1",
        "r <= rws"
      ],
      answer: "(ac == 1 ? 'A' : ac == 2 ? 'B' : ac == 3 ? 'C' : ac == 4 ? 'D' : 'E') + ar",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "(oc == 1 ? 'A' : oc == 2 ? 'B' : oc == 3 ? 'C' : oc == 4 ? 'D' : 'E') + ar",
          "(ac == 1 ? 'A' : ac == 2 ? 'B' : ac == 3 ? 'C' : ac == 4 ? 'D' : 'E') + orw",
          "(oc == 1 ? 'A' : oc == 2 ? 'B' : oc == 3 ? 'C' : oc == 4 ? 'D' : 'E') + orw"
        ]
      },
      hint: "Find the square the dot is in first, then move one square from it.",
      figure: {
        kind: "grid",
        at: "c + ',' + r",
        columns: "cols",
        rows: "rws",
        axisLabels: "'letters'",
        onLines: "false"
      },
      tags: [
        "AC9M3SP02",
        "MA2-GM-01"
      ]
    },
    {
      id: "maths.3.chance.more-likely",
      subject: "maths",
      topic: "chance",
      level: "3",
      prompt: "A bag holds {r} red and {b} blue counters. True or false: you are more likely to pull out red.",
      vars: [
        {
          name: "r",
          kind: "int",
          min: "2",
          max: "12"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "12"
        }
      ],
      constraints: [
        "r != b"
      ],
      answer: "r > b",
      tags: [
        "AC9M3P01",
        "MA2-CHAN-01"
      ]
    },
    {
      id: "maths.3.chance.which-colour",
      subject: "maths",
      topic: "chance",
      level: "3",
      prompt: "A bag holds {r} red counters and {b} blue counters. Which colour are you more likely to pull out?",
      vars: [
        {
          name: "r",
          kind: "int",
          min: "2",
          max: "15"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "15"
        }
      ],
      constraints: [
        "r != b"
      ],
      answer: "r > b ? 'red' : 'blue'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'red'",
          "'blue'"
        ]
      },
      tags: [
        "AC9M3P01",
        "MA2-CHAN-01"
      ]
    },
    {
      id: "maths.3.chance.spinner-uneven",
      subject: "maths",
      topic: "chance",
      level: "3",
      prompt: "The parts are different sizes. Where is the arrow more likely to stop?",
      vars: [
        {
          name: "big",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "d",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "sh",
          kind: "expr",
          expr: "big == 1 ? 4 + d : 4 - d"
        },
        {
          name: "pl",
          kind: "expr",
          expr: "8 - sh"
        },
        {
          name: "g",
          kind: "pick",
          from: [
            1,
            2
          ]
        },
        {
          name: "p",
          kind: "int",
          min: "1",
          max: "g == 1 ? pl - 1 : sh - 1"
        }
      ],
      answer: "big == 1 ? 'a shaded part' : 'a part with no shading'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'a shaded part'",
          "'a part with no shading'"
        ]
      },
      hint: "It is how much of the spinner is shaded that matters, not how many parts there are.",
      figure: {
        kind: "spinner",
        sectors: "g == 1 ? (sh + ',' + p + ',' + (pl - p)) : (p + ',' + (sh - p) + ',' + pl)",
        fills: "g == 1 ? 'a,b,b' : 'a,a,b'"
      },
      tags: [
        "AC9M3P01",
        "MA2-CHAN-01"
      ]
    },
    {
      id: "maths.3.chance.experiment-rolls",
      subject: "maths",
      topic: "chance",
      level: "3",
      prompt: "A dice was rolled {t} times. It landed on an even number {e} times. How many were odd?",
      vars: [
        {
          name: "t",
          kind: "int",
          min: "20",
          max: "60",
          step: 10
        },
        {
          name: "e",
          kind: "int",
          min: "4",
          max: "t - 4"
        }
      ],
      answer: "t - e",
      hint: "Every roll was either even or odd.",
      tags: [
        "AC9M3P02",
        "MA2-CHAN-01"
      ]
    },
    {
      id: "maths.3.chance.most-likely-of-three",
      subject: "maths",
      topic: "chance",
      level: "3",
      prompt: "A bag holds {r} red, {b} blue and {g} green counters. Which colour are you most likely to take?",
      vars: [
        {
          name: "r",
          kind: "int",
          min: "2",
          max: "15"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "15"
        },
        {
          name: "g",
          kind: "int",
          min: "2",
          max: "15"
        }
      ],
      constraints: [
        "r != b",
        "b != g",
        "r != g"
      ],
      answer: "r > b && r > g ? 'red' : b > g ? 'blue' : 'green'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'red'",
          "'blue'",
          "'green'"
        ]
      },
      hint: "The colour with the most counters is the one you are most likely to take.",
      tags: [
        "AC9M3P01",
        "MA2-CHAN-01"
      ]
    },
    {
      id: "maths.3.data.survey-total",
      subject: "maths",
      topic: "data",
      level: "3",
      prompt: "In a survey {a} children chose apples, {b} bananas and {c} cherries. How many were surveyed?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "3",
          max: "25"
        },
        {
          name: "b",
          kind: "int",
          min: "3",
          max: "25"
        },
        {
          name: "c",
          kind: "int",
          min: "3",
          max: "25"
        }
      ],
      answer: "a + b + c",
      tags: [
        "AC9M3ST01",
        "MA2-DATA-01"
      ]
    },
    {
      id: "maths.3.data.dot-graph",
      subject: "maths",
      topic: "data",
      level: "3",
      prompt: "This graph shows how many goals each child scored. How many goals did {who} score?",
      vars: [
        {
          name: "eve",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "kit",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "rex",
          kind: "int",
          min: "2",
          max: "5"
        },
        {
          name: "zoe",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "who",
          kind: "expr",
          expr: "i == 0 ? 'Eve' : i == 1 ? 'Kit' : i == 2 ? 'Rex' : 'Zoe'"
        }
      ],
      answer: "i == 0 ? eve : i == 1 ? kit : i == 2 ? rex : zoe",
      hint: "Find that name along the bottom, then follow its dot across to the numbers up the side.",
      figure: {
        kind: "bar",
        values: "eve + ',' + kit + ',' + rex + ',' + zoe",
        labels: "'Eve,Kit,Rex,Zoe'",
        scale: "1",
        style: "'dot'"
      },
      tags: [
        "AC9M3ST02",
        "MA2-DATA-02"
      ]
    },
    {
      id: "maths.3.data.graph-scale-five",
      subject: "maths",
      topic: "data",
      level: "3",
      prompt: "This graph shows how many stickers each child has. How many stickers do they have altogether?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "c",
          kind: "int",
          min: "2",
          max: "5"
        }
      ],
      answer: "(a + b + c) * 5",
      hint: "The numbers up the side go up in 5s. Read each column, then add them up.",
      figure: {
        kind: "bar",
        values: "a * 5 + ',' + b * 5 + ',' + c * 5",
        labels: "'Ada,Kai,Leo'",
        scale: "5",
        style: "'column'"
      },
      tags: [
        "AC9M3ST02",
        "MA2-DATA-02"
      ]
    },
    {
      id: "maths.3.data.graph-who",
      subject: "maths",
      topic: "data",
      level: "3",
      prompt: "This graph shows how many books each child read. Who read {v} {books}?",
      vars: [
        {
          name: "amy",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "ben",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "joe",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "sam",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "v",
          kind: "expr",
          expr: "i == 0 ? amy : i == 1 ? ben : i == 2 ? joe : sam"
        },
        {
          name: "books",
          kind: "expr",
          expr: "v == 1 ? 'book' : 'books'"
        }
      ],
      constraints: [
        "amy != ben",
        "amy != joe",
        "amy != sam",
        "ben != joe",
        "ben != sam",
        "joe != sam"
      ],
      answer: "i == 0 ? 'Amy' : i == 1 ? 'Ben' : i == 2 ? 'Joe' : 'Sam'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'Amy'",
          "'Ben'",
          "'Joe'",
          "'Sam'"
        ]
      },
      hint: "Find the column that reaches {v}, then read the name under it.",
      figure: {
        kind: "bar",
        values: "amy + ',' + ben + ',' + joe + ',' + sam",
        labels: "'Amy,Ben,Joe,Sam'",
        scale: "1",
        style: "'column'"
      },
      tags: [
        "AC9M3ST02",
        "MA2-DATA-02"
      ]
    },
    {
      id: "maths.3.data.picture-difference",
      subject: "maths",
      topic: "data",
      level: "3",
      prompt: "Each picture stands for one shell. How many more shells did {a} find than {b}?",
      vars: [
        {
          name: "diff",
          kind: "pick",
          from: [
            1,
            2,
            3
          ]
        },
        {
          name: "vb",
          kind: "int",
          min: "1",
          max: "4 - diff"
        },
        {
          name: "va",
          kind: "expr",
          expr: "vb + diff"
        },
        {
          name: "vc",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "k",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "j",
          kind: "expr",
          expr: "mod(i + k, 3)"
        },
        {
          name: "mia",
          kind: "expr",
          expr: "i == 0 ? va : j == 0 ? vb : vc"
        },
        {
          name: "zac",
          kind: "expr",
          expr: "i == 1 ? va : j == 1 ? vb : vc"
        },
        {
          name: "ivy",
          kind: "expr",
          expr: "i == 2 ? va : j == 2 ? vb : vc"
        },
        {
          name: "a",
          kind: "expr",
          expr: "i == 0 ? 'Mia' : i == 1 ? 'Zac' : 'Ivy'"
        },
        {
          name: "b",
          kind: "expr",
          expr: "j == 0 ? 'Mia' : j == 1 ? 'Zac' : 'Ivy'"
        }
      ],
      answer: "diff",
      hint: "Count the pictures in both rows, then take the smaller away from the bigger.",
      figure: {
        kind: "pictograph",
        counts: "mia + ',' + zac + ',' + ivy",
        labels: "'Mia,Zac,Ivy'",
        key: "1"
      },
      tags: [
        "AC9M3ST02",
        "MA2-DATA-02"
      ]
    }
  ]
};

// ../../src/content/packs/maths.4.json
var maths_4_default = {
  version: "69e10b9a064c",
  subject: "maths",
  level: "4",
  templates: [
    {
      id: "maths.4.decimals.tenths",
      subject: "maths",
      topic: "decimals",
      level: "4",
      prompt: "Write {n} tenth{n == 1 ? '' : 's'} as a decimal.",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "1",
          max: "9"
        }
      ],
      answer: "n / 10",
      hint: "Tenths go in the first place after the decimal point.",
      tags: [
        "AC9M4N01",
        "MA2-RN-02"
      ]
    },
    {
      id: "maths.4.decimals.hundredths",
      subject: "maths",
      topic: "decimals",
      level: "4",
      prompt: "Write {n} hundredths as a decimal.",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "11",
          max: "99"
        }
      ],
      constraints: [
        "mod(n, 10) != 0"
      ],
      answer: "n / 100",
      hint: "Hundredths go in the second place after the decimal point.",
      tags: [
        "AC9M4N01",
        "MA2-RN-02"
      ]
    },
    {
      id: "maths.4.decimals.larger",
      subject: "maths",
      topic: "decimals",
      level: "4",
      prompt: "Which is larger, {a} or {b}?",
      vars: [
        {
          name: "a",
          kind: "number",
          min: "0.1",
          max: "9.9",
          decimals: 1
        },
        {
          name: "b",
          kind: "number",
          min: "0.1",
          max: "9.9",
          decimals: 1
        }
      ],
      constraints: [
        "a != b"
      ],
      answer: "max(a, b)",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "min(a, b)"
        ],
        rankIsTheQuestion: true
      },
      hint: "Compare the whole numbers first, then the tenths.",
      tags: [
        "AC9M4N01",
        "MA2-RN-02"
      ]
    },
    {
      id: "maths.4.decimals.add-tenths",
      subject: "maths",
      topic: "decimals",
      level: "4",
      prompt: "What is {a} + {b}?",
      vars: [
        {
          name: "na",
          kind: "int",
          min: "11",
          max: "99"
        },
        {
          name: "nb",
          kind: "int",
          min: "11",
          max: "99"
        },
        {
          name: "u",
          kind: "pick",
          from: [
            1,
            10
          ]
        },
        {
          name: "k",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ]
        },
        {
          name: "lo",
          kind: "expr",
          expr: "na + nb - k * u"
        },
        {
          name: "a",
          kind: "expr",
          expr: "na / 10"
        },
        {
          name: "b",
          kind: "expr",
          expr: "nb / 10"
        }
      ],
      answer: "(na + nb) / 10",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "lo / 10",
          "(lo + u) / 10",
          "(lo + 2 * u) / 10",
          "(lo + 3 * u) / 10"
        ]
      },
      hint: "Add the whole numbers, then add the tenths.",
      tags: [
        "AC9M4N01",
        "MA2-RN-02"
      ]
    },
    {
      id: "maths.4.decimals.unit-fraction",
      subject: "maths",
      topic: "decimals",
      level: "4",
      prompt: "Write 1/{d} as a decimal.",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            2,
            4,
            5,
            10
          ]
        }
      ],
      answer: "1 / d",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "d == 2 ? 0.25 : 0.5",
          "d <= 4 ? 0.2 : 0.25",
          "d == 10 ? 0.2 : 0.1"
        ]
      },
      tags: [
        "AC9M4N03",
        "MA2-RN-02"
      ]
    },
    {
      id: "maths.4.decimals.number-line-tenths",
      subject: "maths",
      topic: "decimals",
      level: "4",
      prompt: "What number is the arrow pointing to?",
      vars: [
        {
          name: "w",
          kind: "int",
          min: "0",
          max: "9"
        },
        {
          name: "k",
          kind: "pick",
          from: [
            1,
            3,
            7,
            9
          ]
        },
        {
          name: "n",
          kind: "expr",
          expr: "w + k / 10"
        }
      ],
      answer: "n",
      hint: "Each small tick is one tenth. Count them on from the number on the left.",
      figure: {
        kind: "number-line",
        at: "n",
        from: "w",
        to: "w + 1"
      },
      tags: [
        "AC9M4N01",
        "MA2-RN-02"
      ]
    },
    {
      id: "maths.4.even-and-odd.is-odd",
      subject: "maths",
      topic: "even and odd",
      level: "4",
      prompt: "True or false: {x} is an odd number.",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "10",
          max: "199"
        }
      ],
      answer: "isOdd(x)",
      tags: [
        "AC9M4N02",
        "MA2-AR-01"
      ]
    },
    {
      id: "maths.4.even-and-odd.sum-parity",
      subject: "maths",
      topic: "even and odd",
      level: "4",
      prompt: "True or false: {x} + {y} gives an even answer.",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "60"
        },
        {
          name: "y",
          kind: "int",
          min: "2",
          max: "60"
        }
      ],
      answer: "isEven(x + y)",
      hint: "Two odds make an even; an odd and an even make an odd.",
      tags: [
        "AC9M4N02",
        "MA2-AR-01"
      ]
    },
    {
      id: "maths.4.even-and-odd.product-parity",
      subject: "maths",
      topic: "even and odd",
      level: "4",
      prompt: "True or false: {x} \xD7 {y} gives an odd answer.",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "20"
        },
        {
          name: "y",
          kind: "int",
          min: "2",
          max: "20"
        }
      ],
      answer: "isOdd(x * y)",
      hint: "One even number anywhere in a product makes the answer even.",
      tags: [
        "AC9M4N02",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.4.fractions.equivalent",
      subject: "maths",
      topic: "fractions",
      level: "4",
      prompt: "Complete the equivalent fraction: {a}/{d} = ?/{d * k}",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "2",
          max: "6"
        },
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "d - 1"
        },
        {
          name: "k",
          kind: "int",
          min: "2",
          max: "4"
        }
      ],
      answer: "a * k",
      hint: "The bottom was multiplied by {k}, so the top is too.",
      tags: [
        "AC9M4N03",
        "MA2-PF-01"
      ]
    },
    {
      id: "maths.4.fractions.of-a-quantity",
      subject: "maths",
      topic: "fractions",
      level: "4",
      prompt: "What is {n}/{d} of {total}?",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            3,
            4,
            5,
            8,
            10
          ]
        },
        {
          name: "part",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "total",
          kind: "expr",
          expr: "d * part"
        },
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "d - 1"
        }
      ],
      answer: "n * part",
      tags: [
        "AC9M4N03",
        "MA2-PF-01"
      ]
    },
    {
      id: "maths.4.fractions.count-in-wholes",
      subject: "maths",
      topic: "fractions",
      level: "4",
      prompt: "How many {d == 2 ? 'halves' : d == 3 ? 'thirds' : d == 4 ? 'quarters' : d == 5 ? 'fifths' : 'tenths'} are there in {n} wholes?",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            2,
            3,
            4,
            5,
            10
          ]
        },
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "6"
        }
      ],
      answer: "d * n",
      tags: [
        "AC9M4N04",
        "MA2-PF-01"
      ]
    },
    {
      id: "maths.4.fractions.mixed-numeral",
      subject: "maths",
      topic: "fractions",
      level: "4",
      prompt: "How many quarters are there in {n} and three quarters?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "1",
          max: "8"
        }
      ],
      answer: "n * 4 + 3",
      hint: "Each whole is 4 quarters.",
      tags: [
        "AC9M4N04",
        "MA2-PF-01"
      ]
    },
    {
      id: "maths.4.fractions.same-as-half",
      subject: "maths",
      topic: "fractions",
      level: "4",
      prompt: "True or false: half of this shape is shaded.",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            4,
            6,
            8,
            10
          ]
        },
        {
          name: "half",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "off",
          kind: "pick",
          from: [
            1,
            -1
          ]
        },
        {
          name: "n",
          kind: "expr",
          expr: "half == 1 ? d / 2 : d / 2 + off"
        }
      ],
      answer: "half == 1",
      hint: "Count the equal parts, then count the shaded ones.",
      figure: {
        kind: "fraction-shape",
        numerator: "n",
        denominator: "d"
      },
      tags: [
        "AC9M4N03",
        "MA2-PF-01"
      ]
    },
    {
      id: "maths.4.multiplication.by-powers-of-ten",
      subject: "maths",
      topic: "multiplication",
      level: "4",
      prompt: "What is {x} \xD7 {p}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "99"
        },
        {
          name: "p",
          kind: "pick",
          from: [
            10,
            100,
            1e3
          ]
        }
      ],
      answer: "x * p",
      hint: "Every digit shifts up to the next place value.",
      tags: [
        "AC9M4N05",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.4.multiplication.facts",
      subject: "maths",
      topic: "multiplication",
      level: "4",
      prompt: "What is {x} \xD7 {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "6",
          max: "10"
        },
        {
          name: "y",
          kind: "int",
          min: "6",
          max: "10"
        }
      ],
      answer: "x * y",
      tags: [
        "AC9M4A02",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.4.multiplication.two-digit",
      subject: "maths",
      topic: "multiplication",
      level: "4",
      prompt: "What is {x} \xD7 {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "11",
          max: "49"
        },
        {
          name: "y",
          kind: "int",
          min: "3",
          max: "9"
        }
      ],
      answer: "x * y",
      hint: "Split {x} into tens and ones, multiply each, then add.",
      tags: [
        "AC9M4N06",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.4.multiplication.array-more-rows",
      subject: "maths",
      topic: "multiplication",
      level: "4",
      prompt: "How many dots would there be with {n} more {rows}?",
      vars: [
        {
          name: "r",
          kind: "int",
          min: "2",
          max: "5"
        },
        {
          name: "c",
          kind: "int",
          min: "3",
          max: "7"
        },
        {
          name: "n",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "rows",
          kind: "expr",
          expr: "n == 1 ? 'row' : 'rows'"
        }
      ],
      answer: "(r + n) * c",
      hint: "Count the rows, then the dots along one row. There would be {n} more {rows}.",
      figure: {
        kind: "array",
        rows: "r",
        columns: "c",
        orientation: "'rows'"
      },
      tags: [
        "AC9M4A02",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.4.division.by-powers-of-ten",
      subject: "maths",
      topic: "division",
      level: "4",
      prompt: "What is {total} \xF7 {p}?",
      vars: [
        {
          name: "p",
          kind: "pick",
          from: [
            10,
            100
          ]
        },
        {
          name: "x",
          kind: "int",
          min: "2",
          max: "99"
        },
        {
          name: "total",
          kind: "expr",
          expr: "x * p"
        }
      ],
      answer: "x",
      tags: [
        "AC9M4N05",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.4.division.facts",
      subject: "maths",
      topic: "division",
      level: "4",
      prompt: "What is {total} \xF7 {y}?",
      vars: [
        {
          name: "y",
          kind: "int",
          min: "6",
          max: "10"
        },
        {
          name: "x",
          kind: "int",
          min: "6",
          max: "10"
        },
        {
          name: "total",
          kind: "expr",
          expr: "x * y"
        }
      ],
      answer: "x",
      tags: [
        "AC9M4A02",
        "MA2-MR-01"
      ]
    },
    {
      id: "maths.4.estimation.round-to-hundred",
      subject: "maths",
      topic: "estimation",
      level: "4",
      prompt: "Round {x} to the nearest 100.",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "210",
          max: "9890"
        }
      ],
      constraints: [
        "mod(x, 100) != 50",
        "mod(x, 100) != 0"
      ],
      answer: "round(x / 100) * 100",
      tags: [
        "AC9M4N07",
        "MA2-RN-01"
      ]
    },
    {
      id: "maths.4.estimation.rounded-sum",
      subject: "maths",
      topic: "estimation",
      level: "4",
      prompt: "Estimate {a} + {b} by rounding each number to the nearest 10 first.",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "21",
          max: "289"
        },
        {
          name: "b",
          kind: "int",
          min: "21",
          max: "289"
        }
      ],
      constraints: [
        "mod(a, 10) != 5",
        "mod(b, 10) != 5"
      ],
      answer: "round(a / 10) * 10 + round(b / 10) * 10",
      tags: [
        "AC9M4N07",
        "MA2-AR-01"
      ]
    },
    {
      id: "maths.4.algebra.unknown-value",
      subject: "maths",
      topic: "algebra",
      level: "4",
      prompt: "What goes in the box? {total} \u2212 ? = {x}",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "30",
          max: "400"
        },
        {
          name: "y",
          kind: "int",
          min: "20",
          max: "300"
        },
        {
          name: "total",
          kind: "expr",
          expr: "x + y"
        }
      ],
      answer: "y",
      tags: [
        "AC9M4A01",
        "MA2-AR-02"
      ]
    },
    {
      id: "maths.4.number-patterns.nth-term",
      subject: "maths",
      topic: "number patterns",
      level: "4",
      prompt: "The rule is: add {d}. Starting at {a}, what is the 5th number in the pattern?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "40"
        },
        {
          name: "d",
          kind: "int",
          min: "3",
          max: "12"
        }
      ],
      answer: "a + 4 * d",
      hint: "{a} is the 1st number, so add {d} four more times.",
      tags: [
        "AC9M4N09",
        "MA2-AR-01"
      ]
    },
    {
      id: "maths.4.perimeter-and-area.rectangle-perimeter",
      subject: "maths",
      topic: "perimeter and area",
      level: "4",
      prompt: "A rectangle is {l} cm long and {w} cm wide. What is its perimeter, in centimetres?",
      vars: [
        {
          name: "l",
          kind: "int",
          min: "3",
          max: "20"
        },
        {
          name: "w",
          kind: "int",
          min: "2",
          max: "15"
        }
      ],
      answer: "2 * (l + w)",
      hint: "Add up all four sides.",
      tags: [
        "AC9M4M02",
        "MA2-GM-02"
      ]
    },
    {
      id: "maths.4.perimeter-and-area.rectangle-area",
      subject: "maths",
      topic: "perimeter and area",
      level: "4",
      prompt: "A rectangle is {l} squares long and {w} squares wide. How many squares cover it altogether?",
      vars: [
        {
          name: "l",
          kind: "int",
          min: "3",
          max: "12"
        },
        {
          name: "w",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "l * w",
      tags: [
        "AC9M4M02",
        "MA2-2DS-03"
      ]
    },
    {
      id: "maths.4.measurement.kilograms-and-grams",
      subject: "maths",
      topic: "measurement",
      level: "4",
      prompt: "A parcel weighs {k} kilograms and {g} grams. What is its mass in grams?",
      vars: [
        {
          name: "k",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "g",
          kind: "int",
          min: "50",
          max: "950",
          step: 50
        }
      ],
      answer: "k * 1000 + g",
      hint: "One kilogram is 1000 grams.",
      tags: [
        "AC9M4M01",
        "MA2-NSM-01"
      ]
    },
    {
      id: "maths.4.measurement.which-holds-more",
      subject: "maths",
      topic: "measurement",
      level: "4",
      prompt: "A bottle holds {ml} millilitres and a jug holds {l} {litres}. Which holds more?",
      vars: [
        {
          name: "l",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "litres",
          kind: "expr",
          expr: "l == 1 ? 'litre' : 'litres'"
        },
        {
          name: "bigger",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "d",
          kind: "int",
          min: "100",
          max: "900",
          step: 100
        },
        {
          name: "ml",
          kind: "expr",
          expr: "l * 1000 + (bigger == 1 ? d : 0 - d)"
        }
      ],
      answer: "bigger == 1 ? 'the bottle' : 'the jug'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'the bottle'",
          "'the jug'"
        ]
      },
      hint: "One litre is 1000 millilitres.",
      tags: [
        "AC9M4M01",
        "MA2-3DS-02"
      ]
    },
    {
      id: "maths.4.measurement.share-a-bottle",
      subject: "maths",
      topic: "measurement",
      level: "4",
      prompt: "A {l} litre bottle is shared equally between {c} glasses. How many millilitres in each?",
      vars: [
        {
          name: "l",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "c",
          kind: "pick",
          from: [
            2,
            4,
            5,
            8,
            10
          ]
        }
      ],
      answer: "l * 1000 / c",
      hint: "The bottle holds {l * 1000} millilitres altogether.",
      tags: [
        "AC9M4M01",
        "MA2-3DS-02"
      ]
    },
    {
      id: "maths.4.time.am-or-pm",
      subject: "maths",
      topic: "time",
      level: "4",
      prompt: "A film starts at {h} o\u2019clock in the {part}. Is that am or pm?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "part",
          kind: "pick",
          from: [
            "morning",
            "afternoon",
            "evening"
          ],
          weights: [
            2,
            1,
            1
          ]
        }
      ],
      answer: "part == 'morning' ? 'am' : 'pm'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'am'",
          "'pm'"
        ]
      },
      hint: "am runs from midnight to midday.",
      tags: [
        "AC9M4M03",
        "MA2-NSM-02"
      ]
    },
    {
      id: "maths.4.time.convert-minutes",
      subject: "maths",
      topic: "time",
      level: "4",
      prompt: "How many minutes are there in {h} hours and {m} minutes?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "2",
          max: "6"
        },
        {
          name: "m",
          kind: "int",
          min: "5",
          max: "55",
          step: 5
        }
      ],
      answer: "h * 60 + m",
      tags: [
        "AC9M4M03",
        "MA2-NSM-02"
      ]
    },
    {
      id: "maths.4.time.until-the-hour-clock",
      subject: "maths",
      topic: "time",
      level: "4",
      prompt: "How many minutes until the next o\u2019clock?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "mi",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "m",
          kind: "expr",
          expr: "mi * 5"
        }
      ],
      answer: "60 - m",
      hint: "Read the long hand first, then count round in 5s to the 12.",
      figure: {
        kind: "clock",
        hour: "h",
        minute: "m",
        numerals: "true",
        minuteTicks: "true"
      },
      tags: [
        "AC9M4M03",
        "MA2-NSM-02"
      ]
    },
    {
      id: "maths.4.time.after-minutes",
      subject: "maths",
      topic: "time",
      level: "4",
      prompt: "What time will it be {n} minutes after the time shown?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "mi",
          kind: "int",
          min: "0",
          max: "11"
        },
        {
          name: "m",
          kind: "expr",
          expr: "mi * 5"
        },
        {
          name: "ni",
          kind: "int",
          min: "2",
          max: "10"
        },
        {
          name: "n",
          kind: "expr",
          expr: "ni * 5"
        },
        {
          name: "tot",
          kind: "expr",
          expr: "m + n"
        },
        {
          name: "h2",
          kind: "expr",
          expr: "tot >= 60 ? mod(h, 12) + 1 : h"
        },
        {
          name: "m2",
          kind: "expr",
          expr: "mod(tot, 60)"
        },
        {
          name: "dh",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "hn",
          kind: "expr",
          expr: "mod(h2 - 1 + dh, 12) + 1"
        },
        {
          name: "dm",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "mn",
          kind: "expr",
          expr: "mod(m2 / 5 + dm, 12) * 5"
        },
        {
          name: "ms",
          kind: "expr",
          expr: "m2 < 10 ? '0' + m2 : '' + m2"
        },
        {
          name: "mns",
          kind: "expr",
          expr: "mn < 10 ? '0' + mn : '' + mn"
        }
      ],
      answer: "h2 + ':' + ms",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "hn + ':' + ms",
          "h2 + ':' + mns",
          "hn + ':' + mns"
        ]
      },
      hint: "Read the clock first, then count on {n} minutes from it.",
      figure: {
        kind: "clock",
        hour: "h",
        minute: "m",
        numerals: "true",
        minuteTicks: "true"
      },
      tags: [
        "AC9M4M03",
        "MA2-NSM-02"
      ]
    },
    {
      id: "maths.4.angles.larger-angle",
      subject: "maths",
      topic: "angles",
      level: "4",
      prompt: "Which is the larger angle, {a} or {b}?",
      vars: [
        {
          name: "a",
          kind: "pick",
          from: [
            "acute",
            "right",
            "obtuse",
            "straight"
          ]
        },
        {
          name: "b",
          kind: "pick",
          from: [
            "acute",
            "right",
            "obtuse",
            "straight"
          ]
        },
        {
          name: "ra",
          kind: "expr",
          expr: "a == 'acute' ? 1 : a == 'right' ? 2 : a == 'obtuse' ? 3 : 4"
        },
        {
          name: "rb",
          kind: "expr",
          expr: "b == 'acute' ? 1 : b == 'right' ? 2 : b == 'obtuse' ? 3 : 4"
        }
      ],
      constraints: [
        "ra != rb"
      ],
      answer: "ra > rb ? a : b",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "ra > rb ? b : a"
        ],
        rankIsTheQuestion: true
      },
      hint: "Smallest to largest: acute, right, obtuse, straight.",
      tags: [
        "AC9M4M04",
        "MA2-GM-03"
      ]
    },
    {
      id: "maths.4.angles.is-acute",
      subject: "maths",
      topic: "angles",
      level: "4",
      prompt: "True or false: an angle of {n} quarter turn{n == 1 ? '' : 's'} is larger than a right angle.",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "1",
          max: "4"
        }
      ],
      answer: "n > 1",
      hint: "One quarter turn is exactly a right angle.",
      tags: [
        "AC9M4M04",
        "MA2-GM-03"
      ]
    },
    {
      id: "maths.4.angles.name-picture",
      subject: "maths",
      topic: "angles",
      level: "4",
      prompt: "What kind of angle is this?",
      vars: [
        {
          name: "kind",
          kind: "pick",
          from: [
            "acute",
            "right",
            "obtuse",
            "straight"
          ]
        },
        {
          name: "small",
          kind: "int",
          min: "15",
          max: "65",
          step: 5
        },
        {
          name: "large",
          kind: "int",
          min: "115",
          max: "160",
          step: 5
        },
        {
          name: "d",
          kind: "expr",
          expr: "kind == 'acute' ? small : kind == 'right' ? 90 : kind == 'obtuse' ? large : 180"
        }
      ],
      answer: "kind",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'acute'",
          "'right'",
          "'obtuse'",
          "'straight'"
        ]
      },
      hint: "Smallest to largest: acute, right, obtuse, straight.",
      figure: {
        kind: "angle",
        degrees: "d"
      },
      tags: [
        "AC9M4M04",
        "MA2-GM-03"
      ]
    },
    {
      id: "maths.4.angles.is-obtuse",
      subject: "maths",
      topic: "angles",
      level: "4",
      prompt: "True or false: this angle is obtuse.",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "15",
          max: "170",
          step: 5
        }
      ],
      constraints: [
        "abs(d - 90) >= 20"
      ],
      answer: "d > 90",
      hint: "An obtuse angle is bigger than a right angle and smaller than a straight one.",
      figure: {
        kind: "angle",
        degrees: "d"
      },
      tags: [
        "AC9M4M04",
        "MA2-GM-03"
      ]
    },
    {
      id: "maths.4.symmetry.lines",
      subject: "maths",
      topic: "symmetry",
      level: "4",
      prompt: "How many lines of symmetry does {article} {shape} have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "square",
            "rectangle",
            "equilateral triangle",
            "regular pentagon",
            "regular hexagon"
          ]
        },
        {
          name: "article",
          kind: "expr",
          expr: "shape == 'equilateral triangle' ? 'an' : 'a'"
        }
      ],
      answer: "shape == 'square' ? 4 : shape == 'rectangle' ? 2 : shape == 'equilateral triangle' ? 3 : shape == 'regular pentagon' ? 5 : 6",
      hint: "A regular shape has as many lines of symmetry as it has sides.",
      tags: [
        "AC9M4SP03",
        "MA2-2DS-02"
      ]
    },
    {
      id: "maths.4.symmetry.dashed-line",
      subject: "maths",
      topic: "symmetry",
      level: "4",
      prompt: "True or false: the dashed line is a line of symmetry.",
      vars: [
        {
          name: "real",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "shape",
          kind: "pick",
          from: [
            "equilateral",
            "isosceles",
            "trapezium",
            "kite",
            "square",
            "rectangle",
            "rhombus",
            "pentagon",
            "hexagon"
          ]
        }
      ],
      answer: "real == 1",
      hint: "Fold along the line: would the two halves land on top of each other?",
      figure: {
        kind: "polygon",
        shape: "shape",
        mirror: "real == 1"
      },
      tags: [
        "AC9M4SP03",
        "MA2-2DS-02"
      ]
    },
    {
      id: "maths.4.symmetry.count-picture",
      subject: "maths",
      topic: "symmetry",
      level: "4",
      prompt: "How many lines of symmetry does this shape have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "scalene",
            "right-triangle",
            "parallelogram",
            "isosceles",
            "trapezium",
            "kite",
            "rectangle",
            "rhombus",
            "equilateral",
            "square",
            "pentagon",
            "hexagon"
          ]
        }
      ],
      answer: "shape == 'scalene' || shape == 'right-triangle' || shape == 'parallelogram' ? 0 : shape == 'isosceles' || shape == 'trapezium' || shape == 'kite' ? 1 : shape == 'rectangle' || shape == 'rhombus' ? 2 : shape == 'equilateral' ? 3 : shape == 'square' ? 4 : shape == 'pentagon' ? 5 : 6",
      hint: "A regular shape has one for every side, and some shapes have none at all.",
      figure: {
        kind: "polygon",
        shape: "shape"
      },
      tags: [
        "AC9M4SP03",
        "MA2-2DS-02"
      ]
    },
    {
      id: "maths.4.shapes.net-edges",
      subject: "maths",
      topic: "shapes",
      level: "4",
      prompt: "This is a net. How many edges will the folded shape have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "square-pyramid",
            "triangular-prism"
          ]
        }
      ],
      answer: "shape == 'cube' ? 12 : shape == 'square-pyramid' ? 8 : 9",
      hint: "Every edge of the folded shape is where two flat pieces meet.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'net'"
      },
      tags: [
        "AC9M4SP01",
        "MA2-3DS-01"
      ]
    },
    {
      id: "maths.4.shapes.net-corners",
      subject: "maths",
      topic: "shapes",
      level: "4",
      prompt: "This is a net. How many corners will the folded shape have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "square-pyramid",
            "triangular-prism"
          ]
        }
      ],
      answer: "shape == 'cube' ? 8 : shape == 'square-pyramid' ? 5 : 6",
      hint: "Several corners of the flat pieces fold together into one corner.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'net'"
      },
      tags: [
        "AC9M4SP01",
        "MA2-3DS-01"
      ]
    },
    {
      id: "maths.4.shapes.triangular-faces",
      subject: "maths",
      topic: "shapes",
      level: "4",
      prompt: "How many of this shape\u2019s faces are triangles?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "square-pyramid",
            "triangular-prism"
          ]
        }
      ],
      answer: "shape == 'cube' ? 0 : shape == 'square-pyramid' ? 4 : 2",
      hint: "Look at every face, including the ones round the back.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M4SP01",
        "MA2-3DS-01"
      ]
    },
    {
      id: "maths.4.position.grid-diagonal",
      subject: "maths",
      topic: "position",
      level: "4",
      prompt: "Which square is one square {ew} and one square {ns} from the dot?",
      vars: [
        {
          name: "ac",
          kind: "int",
          min: "2",
          max: "3"
        },
        {
          name: "ar",
          kind: "int",
          min: "2",
          max: "3"
        },
        {
          name: "across",
          kind: "pick",
          from: [
            1,
            -1
          ]
        },
        {
          name: "up",
          kind: "pick",
          from: [
            1,
            -1
          ]
        },
        {
          name: "c",
          kind: "expr",
          expr: "ac - across"
        },
        {
          name: "r",
          kind: "expr",
          expr: "ar - up"
        },
        {
          name: "ew",
          kind: "expr",
          expr: "across == 1 ? 'to the right' : 'to the left'"
        },
        {
          name: "ns",
          kind: "expr",
          expr: "up == 1 ? 'up' : 'down'"
        },
        {
          name: "cols",
          kind: "int",
          min: "max(3, c)",
          max: "5"
        },
        {
          name: "rws",
          kind: "int",
          min: "max(3, r)",
          max: "5"
        }
      ],
      answer: "(ac == 1 ? 'A' : ac == 2 ? 'B' : ac == 3 ? 'C' : ac == 4 ? 'D' : 'E') + ar",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'B2'",
          "'B3'",
          "'C2'",
          "'C3'"
        ]
      },
      hint: "Find the square the dot is in, then move one square across and one up or down.",
      figure: {
        kind: "grid",
        at: "c + ',' + r",
        columns: "cols",
        rows: "rws",
        axisLabels: "'letters'",
        onLines: "false"
      },
      tags: [
        "AC9M4SP02",
        "MA2-GM-01"
      ]
    },
    {
      id: "maths.4.position.grid-to-the-edge",
      subject: "maths",
      topic: "position",
      level: "4",
      prompt: "How many squares would you move right to get from the dot to the last column?",
      vars: [
        {
          name: "gap",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "cols",
          kind: "int",
          min: "max(3, gap + 1)",
          max: "5"
        },
        {
          name: "c",
          kind: "expr",
          expr: "cols - gap"
        },
        {
          name: "r",
          kind: "int",
          min: "1",
          max: "3"
        }
      ],
      answer: "gap",
      hint: "Count the squares from the dot along to the end of its row.",
      figure: {
        kind: "grid",
        at: "c + ',' + r",
        columns: "cols",
        onLines: "false"
      },
      tags: [
        "AC9M4SP02",
        "MA2-GM-01"
      ]
    },
    {
      id: "maths.4.data.many-to-one",
      subject: "maths",
      topic: "data",
      level: "4",
      prompt: "On a pictograph each picture stands for {k} children. How many children do {n} pictures show?",
      vars: [
        {
          name: "k",
          kind: "pick",
          from: [
            2,
            5,
            10
          ]
        },
        {
          name: "n",
          kind: "int",
          min: "3",
          max: "12"
        }
      ],
      answer: "k * n",
      tags: [
        "AC9M4ST01"
      ]
    },
    {
      id: "maths.4.data.picture-key",
      subject: "maths",
      topic: "data",
      level: "4",
      prompt: "Each picture stands for {k} books. How many books did {who} read?",
      vars: [
        {
          name: "k",
          kind: "pick",
          from: [
            2,
            5,
            10
          ]
        },
        {
          name: "ia",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "ib",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "ic",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "who",
          kind: "expr",
          expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'"
        },
        {
          name: "icons",
          kind: "expr",
          expr: "i == 0 ? ia : i == 1 ? ib : ic"
        }
      ],
      answer: "icons * k",
      hint: "Count the pictures in that row, then count on in {k}s.",
      figure: {
        kind: "pictograph",
        counts: "(ia * k) + ',' + (ib * k) + ',' + (ic * k)",
        labels: "'Ada,Kai,Leo'",
        key: "k"
      },
      tags: [
        "AC9M4ST01"
      ]
    },
    {
      id: "maths.4.data.graph-scale-ten",
      subject: "maths",
      topic: "data",
      level: "4",
      prompt: "This graph shows points scored. How many more did {a} score than {b}?",
      vars: [
        {
          name: "diff",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "lo",
          kind: "int",
          min: "1",
          max: "5 - diff"
        },
        {
          name: "hi",
          kind: "expr",
          expr: "lo + diff"
        },
        {
          name: "third",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "k",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "j",
          kind: "expr",
          expr: "mod(i + k, 3)"
        },
        {
          name: "ada",
          kind: "expr",
          expr: "(i == 0 ? hi : j == 0 ? lo : third) * 10"
        },
        {
          name: "kai",
          kind: "expr",
          expr: "(i == 1 ? hi : j == 1 ? lo : third) * 10"
        },
        {
          name: "leo",
          kind: "expr",
          expr: "(i == 2 ? hi : j == 2 ? lo : third) * 10"
        },
        {
          name: "a",
          kind: "expr",
          expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'"
        },
        {
          name: "b",
          kind: "expr",
          expr: "j == 0 ? 'Ada' : j == 1 ? 'Kai' : 'Leo'"
        }
      ],
      answer: "diff * 10",
      hint: "The numbers up the side go up in 10s. Read both columns, then subtract.",
      figure: {
        kind: "bar",
        values: "ada + ',' + kai + ',' + leo",
        labels: "'Ada,Kai,Leo'",
        scale: "10",
        style: "'column'"
      },
      tags: [
        "AC9M4ST01",
        "MA2-DATA-02"
      ]
    },
    {
      id: "maths.4.data.graph-between-rungs",
      subject: "maths",
      topic: "data",
      level: "4",
      prompt: "How many goals did {who} score?",
      vars: [
        {
          name: "x",
          kind: "pick",
          from: [
            3,
            5,
            7,
            9
          ]
        },
        {
          name: "y",
          kind: "pick",
          from: [
            3,
            5,
            7,
            9
          ]
        },
        {
          name: "z",
          kind: "pick",
          from: [
            3,
            5,
            7,
            9
          ]
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "who",
          kind: "expr",
          expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'"
        }
      ],
      answer: "i == 0 ? x : i == 1 ? y : z",
      hint: "The numbers up the side go up in 2s, so a column can stop halfway between two of them.",
      figure: {
        kind: "bar",
        values: "x + ',' + y + ',' + z",
        labels: "'Ada,Kai,Leo'",
        scale: "2",
        style: "'column'"
      },
      tags: [
        "AC9M4ST01",
        "MA2-DATA-02"
      ]
    },
    {
      id: "maths.4.data.dot-graph-who",
      subject: "maths",
      topic: "data",
      level: "4",
      prompt: "Who collected {v} shells?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "z",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "v",
          kind: "expr",
          expr: "(i == 0 ? x : i == 1 ? y : z) * 5"
        }
      ],
      constraints: [
        "x != y",
        "y != z",
        "x != z"
      ],
      answer: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'Ada'",
          "'Kai'",
          "'Leo'"
        ]
      },
      hint: "The numbers up the side go up in 5s. Find the dot at {v}, then read the name under it.",
      figure: {
        kind: "bar",
        values: "x * 5 + ',' + y * 5 + ',' + z * 5",
        labels: "'Ada,Kai,Leo'",
        scale: "5",
        style: "'dot'"
      },
      tags: [
        "AC9M4ST01",
        "MA2-DATA-02"
      ]
    },
    {
      id: "maths.4.chance.least-likely",
      subject: "maths",
      topic: "chance",
      level: "4",
      prompt: "A bag holds {r} red, {b} blue and {g} green marbles. Which colour are you least likely to pull out?",
      vars: [
        {
          name: "r",
          kind: "int",
          min: "2",
          max: "20"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "20"
        },
        {
          name: "g",
          kind: "int",
          min: "2",
          max: "20"
        }
      ],
      constraints: [
        "r != b",
        "b != g",
        "r != g"
      ],
      answer: "r < b && r < g ? 'red' : b < g ? 'blue' : 'green'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'red'",
          "'blue'",
          "'green'"
        ]
      },
      tags: [
        "AC9M4P01",
        "MA2-CHAN-01"
      ]
    },
    {
      id: "maths.4.chance.spinner-how-likely",
      subject: "maths",
      topic: "chance",
      level: "4",
      prompt: "How likely is the arrow to stop on a shaded part?",
      vars: [
        {
          name: "s",
          kind: "pick",
          from: [
            2,
            4,
            6,
            8
          ]
        }
      ],
      answer: "s == 2 ? 'unlikely' : s == 4 ? 'even chance' : s == 6 ? 'likely' : 'certain'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'unlikely'",
          "'even chance'",
          "'likely'",
          "'certain'"
        ]
      },
      hint: "Compare how much of the spinner is shaded with how much is not.",
      figure: {
        kind: "spinner",
        sectors: "'1,1,1,1,1,1,1,1'",
        fills: "s == 2 ? 'a,a,b,b,b,b,b,b' : s == 4 ? 'a,a,a,a,b,b,b,b' : s == 6 ? 'a,a,a,a,a,a,b,b' : 'a,a,a,a,a,a,a,a'"
      },
      tags: [
        "AC9M4P01",
        "MA2-CHAN-01"
      ]
    },
    {
      id: "maths.4.chance.spinner-even-chance",
      subject: "maths",
      topic: "chance",
      level: "4",
      prompt: "True or false: the arrow is equally likely to stop on shading as on no shading.",
      vars: [
        {
          name: "same",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "off",
          kind: "pick",
          from: [
            1,
            -1
          ]
        },
        {
          name: "sh",
          kind: "expr",
          expr: "same == 1 ? 4 : 4 + off"
        },
        {
          name: "pl",
          kind: "expr",
          expr: "8 - sh"
        },
        {
          name: "g",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "p",
          kind: "int",
          min: "1",
          max: "g == 1 ? pl - 1 : sh - 1"
        }
      ],
      answer: "same == 1",
      hint: "It is how much of the spinner is shaded that matters, not how many parts there are.",
      figure: {
        kind: "spinner",
        sectors: "g == 1 ? (sh + ',' + p + ',' + (pl - p)) : (p + ',' + (sh - p) + ',' + pl)",
        fills: "g == 1 ? 'a,b,b' : 'a,a,b'"
      },
      tags: [
        "AC9M4P01",
        "MA2-CHAN-01"
      ]
    },
    {
      id: "maths.4.chance.after-taking-one",
      subject: "maths",
      topic: "chance",
      level: "4",
      prompt: "A bag holds {r} red and {b} blue counters. You take out a {c} one. Is red now more or less likely?",
      vars: [
        {
          name: "r",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "c",
          kind: "pick",
          from: [
            "red",
            "blue"
          ]
        }
      ],
      answer: "c == 'red' ? 'less likely' : 'more likely'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'more likely'",
          "'less likely'"
        ]
      },
      hint: "There is one counter fewer in the bag now. Which colour lost one?",
      tags: [
        "AC9M4P01",
        "MA2-CHAN-01"
      ]
    },
    {
      id: "maths.4.chance.experiment-three-outcomes",
      subject: "maths",
      topic: "chance",
      level: "4",
      prompt: "A spinner was spun {t} times: red {r}, blue {b}, the rest green. How many were green?",
      vars: [
        {
          name: "t",
          kind: "int",
          min: "30",
          max: "60",
          step: 10
        },
        {
          name: "r",
          kind: "int",
          min: "5",
          max: "t - 15"
        },
        {
          name: "b",
          kind: "int",
          min: "5",
          max: "t - r - 5"
        }
      ],
      answer: "t - r - b",
      hint: "Every spin was red, blue or green.",
      tags: [
        "AC9M4P02",
        "MA2-CHAN-01"
      ]
    }
  ]
};

// ../../src/content/packs/maths.5.json
var maths_5_default = {
  version: "90f0f6ed850e",
  subject: "maths",
  level: "5",
  templates: [
    {
      id: "maths.5.decimals.count-hundredths",
      subject: "maths",
      topic: "decimals",
      level: "5",
      prompt: "How many hundredths are there in {x}?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "105",
          max: "995"
        },
        {
          name: "x",
          kind: "expr",
          expr: "n / 100"
        }
      ],
      constraints: [
        "mod(n, 10) != 0"
      ],
      answer: "n",
      hint: "Each whole is 100 hundredths.",
      tags: [
        "AC9M5N01",
        "MA3-RN-02"
      ]
    },
    {
      id: "maths.5.decimals.largest",
      subject: "maths",
      topic: "decimals",
      level: "5",
      prompt: "Which of these is the largest: {a}, {b} or {c}?",
      vars: [
        {
          name: "a",
          kind: "number",
          min: "0.01",
          max: "9.99",
          decimals: 2
        },
        {
          name: "b",
          kind: "number",
          min: "0.01",
          max: "9.99",
          decimals: 2
        },
        {
          name: "c",
          kind: "number",
          min: "0.01",
          max: "9.99",
          decimals: 2
        }
      ],
      constraints: [
        "a != b",
        "b != c",
        "a != c"
      ],
      answer: "max(a, b, c)",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "a",
          "b",
          "c"
        ],
        rankIsTheQuestion: true
      },
      tags: [
        "AC9M5N01",
        "MA3-RN-02"
      ]
    },
    {
      id: "maths.5.decimals.add",
      subject: "maths",
      topic: "decimals",
      level: "5",
      prompt: "What is {a} + {b}?",
      vars: [
        {
          name: "na",
          kind: "int",
          min: "105",
          max: "995"
        },
        {
          name: "nb",
          kind: "int",
          min: "105",
          max: "995"
        },
        {
          name: "u",
          kind: "pick",
          from: [
            1,
            10,
            100
          ]
        },
        {
          name: "k",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ]
        },
        {
          name: "lo",
          kind: "expr",
          expr: "na + nb - k * u"
        },
        {
          name: "a",
          kind: "expr",
          expr: "na / 100"
        },
        {
          name: "b",
          kind: "expr",
          expr: "nb / 100"
        }
      ],
      answer: "(na + nb) / 100",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "lo / 100",
          "(lo + u) / 100",
          "(lo + 2 * u) / 100",
          "(lo + 3 * u) / 100"
        ]
      },
      hint: "Line up the decimal points.",
      tags: [
        "AC9M5N01",
        "MA3-AR-01"
      ]
    },
    {
      id: "maths.5.decimals.subtract",
      subject: "maths",
      topic: "decimals",
      level: "5",
      prompt: "What is {a} \u2212 {b}?",
      vars: [
        {
          name: "na",
          kind: "int",
          min: "505",
          max: "1995"
        },
        {
          name: "nb",
          kind: "int",
          min: "105",
          max: "495"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            -10,
            10
          ]
        },
        {
          name: "a",
          kind: "expr",
          expr: "na / 100"
        },
        {
          name: "b",
          kind: "expr",
          expr: "nb / 100"
        }
      ],
      constraints: [
        "na - nb >= 20"
      ],
      answer: "(na - nb) / 100",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "(na - nb + s) / 100",
          "(na - nb - 1) / 100",
          "(na + nb) / 100"
        ]
      },
      tags: [
        "AC9M5N01",
        "MA3-AR-01"
      ]
    },
    {
      id: "maths.5.factors-and-multiples.is-a-factor",
      subject: "maths",
      topic: "factors and multiples",
      level: "5",
      prompt: "True or false: {d} is a factor of {n}.",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "2",
          max: "12"
        },
        {
          name: "n",
          kind: "int",
          min: "20",
          max: "120"
        }
      ],
      answer: "mod(n, d) == 0",
      hint: "A factor divides in with nothing left over.",
      tags: [
        "AC9M5N02",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.5.factors-and-multiples.divisible",
      subject: "maths",
      topic: "factors and multiples",
      level: "5",
      prompt: "True or false: {n} is divisible by {d}.",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            2,
            3,
            5,
            9,
            10
          ]
        },
        {
          name: "n",
          kind: "int",
          min: "30",
          max: "400"
        }
      ],
      answer: "mod(n, d) == 0",
      tags: [
        "AC9M5N02",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.5.factors-and-multiples.highest-common-factor",
      subject: "maths",
      topic: "factors and multiples",
      level: "5",
      prompt: "What is the highest common factor of {a} and {b}?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "4",
          max: "48"
        },
        {
          name: "b",
          kind: "int",
          min: "4",
          max: "48"
        }
      ],
      constraints: [
        "a != b",
        "gcd(a, b) > 1"
      ],
      answer: "gcd(a, b)",
      hint: "The largest number that divides into both.",
      tags: [
        "AC9M5N02",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.5.factors-and-multiples.lowest-common-multiple",
      subject: "maths",
      topic: "factors and multiples",
      level: "5",
      prompt: "What is the lowest common multiple of {a} and {b}?",
      vars: [
        {
          name: "a",
          kind: "pick",
          from: [
            2,
            3,
            4,
            5,
            6
          ]
        },
        {
          name: "b",
          kind: "pick",
          from: [
            2,
            3,
            4,
            5,
            6
          ]
        }
      ],
      constraints: [
        "a != b"
      ],
      answer: "lcm(a, b)",
      hint: "Count in {a}s and in {b}s until the lists meet.",
      tags: [
        "AC9M5N02",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.5.fractions.add-same-denominator",
      subject: "maths",
      topic: "fractions",
      level: "5",
      prompt: "{a}/{d} + {b}/{d} = ?/{d}  What is the missing numerator?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "4",
          max: "12"
        },
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "d - 2"
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "d - 1 - a"
        }
      ],
      answer: "a + b",
      hint: "The denominators match, so just add the numerators.",
      tags: [
        "AC9M5N05",
        "MA3-RQF-01"
      ]
    },
    {
      id: "maths.5.fractions.add-related-denominator",
      subject: "maths",
      topic: "fractions",
      level: "5",
      prompt: "{a}/{d} + {b}/{d * 2} = ?/{d * 2}  What is the missing numerator?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "3",
          max: "8"
        },
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "d - 2"
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "d - 1"
        }
      ],
      constraints: [
        "a * 2 + b <= d * 2"
      ],
      answer: "a * 2 + b",
      hint: "{a}/{d} is the same as {a * 2}/{d * 2}.",
      tags: [
        "AC9M5N05",
        "MA3-RQF-01"
      ]
    },
    {
      id: "maths.5.fractions.of-a-quantity",
      subject: "maths",
      topic: "fractions",
      level: "5",
      prompt: "What is {n}/{d} of {total}?",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            3,
            4,
            5,
            6,
            8
          ]
        },
        {
          name: "part",
          kind: "int",
          min: "5",
          max: "20"
        },
        {
          name: "total",
          kind: "expr",
          expr: "d * part"
        },
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "d - 1"
        }
      ],
      answer: "n * part",
      tags: [
        "AC9M5N03",
        "MA3-RQF-02"
      ]
    },
    {
      id: "maths.5.fractions.equivalent-shaded",
      subject: "maths",
      topic: "fractions",
      level: "5",
      prompt: "How much of this shape is shaded, in its simplest form?",
      vars: [
        {
          name: "which",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ]
        },
        {
          name: "top",
          kind: "expr",
          expr: "which == 3 ? 2 : 1"
        },
        {
          name: "bottom",
          kind: "expr",
          expr: "which == 0 ? 2 : which == 2 ? 4 : 3"
        },
        {
          name: "m",
          kind: "int",
          min: "2",
          max: "which == 0 ? 6 : which == 2 ? 3 : 4"
        },
        {
          name: "n",
          kind: "expr",
          expr: "top * m"
        },
        {
          name: "d",
          kind: "expr",
          expr: "bottom * m"
        }
      ],
      answer: "top + '/' + bottom",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'1/2'",
          "'1/3'",
          "'1/4'",
          "'2/3'"
        ]
      },
      hint: "Count the shaded parts and the parts altogether, then look for a smaller fraction that means the same.",
      figure: {
        kind: "fraction-shape",
        numerator: "n",
        denominator: "d"
      },
      tags: [
        "AC9M5N03",
        "MA3-RQF-01"
      ]
    },
    {
      id: "maths.5.percentages.of-a-quantity",
      subject: "maths",
      topic: "percentages",
      level: "5",
      prompt: "What is {p}% of {total}?",
      vars: [
        {
          name: "p",
          kind: "pick",
          from: [
            10,
            25,
            50,
            75
          ]
        },
        {
          name: "k",
          kind: "int",
          min: "1",
          max: "15"
        },
        {
          name: "total",
          kind: "expr",
          expr: "k * 20"
        }
      ],
      answer: "total * p / 100",
      hint: "10% is one tenth; 25% is one quarter.",
      tags: [
        "AC9M5N04",
        "MA3-RN-03"
      ]
    },
    {
      id: "maths.5.percentages.fraction-equivalent",
      subject: "maths",
      topic: "percentages",
      level: "5",
      prompt: "What percentage is the same as 1/{d}?",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            2,
            4,
            5,
            10
          ]
        }
      ],
      answer: "100 / d",
      tags: [
        "AC9M5N04",
        "MA3-RN-03"
      ]
    },
    {
      id: "maths.5.percentages.whole",
      subject: "maths",
      topic: "percentages",
      level: "5",
      prompt: "{p}% of a class has arrived. What percentage is still to come?",
      vars: [
        {
          name: "p",
          kind: "int",
          min: "5",
          max: "95",
          step: 5
        }
      ],
      answer: "100 - p",
      hint: "100% is the whole class.",
      tags: [
        "AC9M5N04",
        "MA3-RN-03"
      ]
    },
    {
      id: "maths.5.percentages.number-line-percent",
      subject: "maths",
      topic: "percentages",
      level: "5",
      prompt: "What percentage is the arrow pointing to?",
      vars: [
        {
          name: "k",
          kind: "pick",
          from: [
            10,
            20,
            25,
            30,
            40,
            50,
            60,
            70,
            75,
            80,
            90
          ]
        }
      ],
      answer: "k",
      hint: "The whole line is 100%.",
      figure: {
        kind: "number-line",
        at: "k / 100",
        from: "0",
        to: "1"
      },
      tags: [
        "AC9M5N04",
        "MA3-RN-03"
      ]
    },
    {
      id: "maths.5.multiplication.large-by-one-digit",
      subject: "maths",
      topic: "multiplication",
      level: "5",
      prompt: "What is {x} \xD7 {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "101",
          max: "899"
        },
        {
          name: "y",
          kind: "int",
          min: "3",
          max: "9"
        }
      ],
      answer: "x * y",
      tags: [
        "AC9M5N06",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.5.multiplication.two-by-two-digit",
      subject: "maths",
      topic: "multiplication",
      level: "5",
      prompt: "What is {x} \xD7 {y}?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "12",
          max: "49"
        },
        {
          name: "y",
          kind: "int",
          min: "11",
          max: "29"
        }
      ],
      answer: "x * y",
      hint: "Split both numbers into tens and ones.",
      tags: [
        "AC9M5N06",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.5.division.exact",
      subject: "maths",
      topic: "division",
      level: "5",
      prompt: "What is {total} \xF7 {d}?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "3",
          max: "12"
        },
        {
          name: "x",
          kind: "int",
          min: "11",
          max: "60"
        },
        {
          name: "total",
          kind: "expr",
          expr: "d * x"
        }
      ],
      answer: "x",
      tags: [
        "AC9M5N07",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.5.division.remainder",
      subject: "maths",
      topic: "division",
      level: "5",
      prompt: "What is the remainder when {total} is divided by {d}?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "3",
          max: "9"
        },
        {
          name: "total",
          kind: "int",
          min: "20",
          max: "200"
        }
      ],
      constraints: [
        "mod(total, d) != 0"
      ],
      answer: "mod(total, d)",
      hint: "How much is left over after the last whole group?",
      tags: [
        "AC9M5N07",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.5.division.how-many-groups",
      subject: "maths",
      topic: "division",
      level: "5",
      prompt: "{total} students are put into teams of {d}. How many full teams are there?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "3",
          max: "8"
        },
        {
          name: "total",
          kind: "int",
          min: "30",
          max: "160"
        }
      ],
      constraints: [
        "mod(total, d) != 0"
      ],
      answer: "floor(total / d)",
      hint: "The leftover students do not make a full team.",
      tags: [
        "AC9M5N07",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.5.algebra.inverse-operations",
      subject: "maths",
      topic: "algebra",
      level: "5",
      prompt: "You know that {a} \xD7 {b} = {a * b}. What is {a * b} \xF7 {b}?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "6",
          max: "30"
        },
        {
          name: "b",
          kind: "int",
          min: "3",
          max: "12"
        }
      ],
      answer: "a",
      hint: "Multiplying and dividing undo each other.",
      tags: [
        "AC9M5A01",
        "MA3-MR-02"
      ]
    },
    {
      id: "maths.5.algebra.unknown-value",
      subject: "maths",
      topic: "algebra",
      level: "5",
      prompt: "What goes in the box? {a} \xD7 ? = {product}",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "3",
          max: "12"
        },
        {
          name: "b",
          kind: "int",
          min: "3",
          max: "12"
        },
        {
          name: "product",
          kind: "expr",
          expr: "a * b"
        }
      ],
      answer: "b",
      tags: [
        "AC9M5A02",
        "MA3-MR-02"
      ]
    },
    {
      id: "maths.5.number-patterns.multiply-rule",
      subject: "maths",
      topic: "number patterns",
      level: "5",
      prompt: "The rule is: multiply by {k}. Starting at {a}, what is the 4th number in the pattern?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "k",
          kind: "pick",
          from: [
            2,
            3
          ]
        }
      ],
      answer: "a * pow(k, 3)",
      hint: "{a} is the 1st number, so multiply by {k} three more times.",
      tags: [
        "AC9M5N10",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.5.measurement.millimetres",
      subject: "maths",
      topic: "measurement",
      level: "5",
      prompt: "How many millimetres are there in {n} centimetres?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "3",
          max: "40"
        }
      ],
      answer: "n * 10",
      tags: [
        "AC9M5M01",
        "MA3-GM-02"
      ]
    },
    {
      id: "maths.5.measurement.millilitres",
      subject: "maths",
      topic: "measurement",
      level: "5",
      prompt: "How many millilitres are there in {n} litres?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "12"
        }
      ],
      answer: "n * 1000",
      tags: [
        "AC9M5M01",
        "MA3-3DS-02"
      ]
    },
    {
      id: "maths.5.measurement.kilograms-to-grams",
      subject: "maths",
      topic: "measurement",
      level: "5",
      prompt: "A parcel weighs {kg} kilograms. How many grams is that?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "11",
          max: "99"
        },
        {
          name: "kg",
          kind: "expr",
          expr: "n / 10"
        }
      ],
      constraints: [
        "mod(n, 10) != 0"
      ],
      answer: "n * 100",
      hint: "One kilogram is 1000 grams, so a tenth of a kilogram is 100.",
      tags: [
        "AC9M5M01",
        "MA3-NSM-01"
      ]
    },
    {
      id: "maths.5.measurement.millilitres-to-litres",
      subject: "maths",
      topic: "measurement",
      level: "5",
      prompt: "A bottle holds {ml} millilitres. How many litres is that?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "11",
          max: "99"
        },
        {
          name: "ml",
          kind: "expr",
          expr: "n * 100"
        }
      ],
      constraints: [
        "mod(n, 10) != 0"
      ],
      answer: "n / 10",
      hint: "One litre is 1000 millilitres.",
      tags: [
        "AC9M5M01",
        "MA3-3DS-02"
      ]
    },
    {
      id: "maths.5.measurement.fill-the-bottle",
      subject: "maths",
      topic: "measurement",
      level: "5",
      prompt: "A {l} litre bottle has {ml} millilitres in it. How many more millilitres would fill it?",
      vars: [
        {
          name: "l",
          kind: "int",
          min: "2",
          max: "5"
        },
        {
          name: "n",
          kind: "int",
          min: "1",
          max: "l * 10 - 1"
        },
        {
          name: "ml",
          kind: "expr",
          expr: "n * 100"
        }
      ],
      answer: "l * 1000 - ml",
      hint: "The full bottle holds {l * 1000} millilitres.",
      tags: [
        "AC9M5M01",
        "MA3-3DS-02"
      ]
    },
    {
      id: "maths.5.perimeter-and-area.rectangle-area",
      subject: "maths",
      topic: "perimeter and area",
      level: "5",
      prompt: "A rectangle is {l} cm long and {w} cm wide. What is its area, in square centimetres?",
      vars: [
        {
          name: "l",
          kind: "int",
          min: "4",
          max: "25"
        },
        {
          name: "w",
          kind: "int",
          min: "3",
          max: "18"
        }
      ],
      answer: "l * w",
      tags: [
        "AC9M5M02",
        "MA3-2DS-02"
      ]
    },
    {
      id: "maths.5.perimeter-and-area.missing-side",
      subject: "maths",
      topic: "perimeter and area",
      level: "5",
      prompt: "A rectangle has an area of {area} square cm and is {w} cm wide. How long is it, in centimetres?",
      vars: [
        {
          name: "w",
          kind: "int",
          min: "3",
          max: "12"
        },
        {
          name: "l",
          kind: "int",
          min: "4",
          max: "20"
        },
        {
          name: "area",
          kind: "expr",
          expr: "l * w"
        }
      ],
      answer: "l",
      tags: [
        "AC9M5M02",
        "MA3-2DS-02"
      ]
    },
    {
      id: "maths.5.time.24-hour",
      subject: "maths",
      topic: "time",
      level: "5",
      prompt: "A train leaves at {h}:00 in 24-hour time. What is that hour on a 12-hour clock?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "13",
          max: "23"
        }
      ],
      answer: "h - 12",
      hint: "After midday, take 12 off the 24-hour time.",
      tags: [
        "AC9M5M03",
        "MA3-NSM-02"
      ]
    },
    {
      id: "maths.5.time.clock-24-hour",
      subject: "maths",
      topic: "time",
      level: "5",
      prompt: "This clock shows a pm time. What is it in 24-hour time?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "mi",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "m",
          kind: "expr",
          expr: "mi * 5"
        },
        {
          name: "dh",
          kind: "int",
          min: "1",
          max: "10"
        },
        {
          name: "hn",
          kind: "expr",
          expr: "mod(h - 1 + dh, 11) + 1"
        },
        {
          name: "dm",
          kind: "int",
          min: "1",
          max: "10"
        },
        {
          name: "mn",
          kind: "expr",
          expr: "(mod(mi - 1 + dm, 11) + 1) * 5"
        },
        {
          name: "ms",
          kind: "expr",
          expr: "m == 5 ? '05' : '' + m"
        },
        {
          name: "mns",
          kind: "expr",
          expr: "mn == 5 ? '05' : '' + mn"
        }
      ],
      answer: "(h + 12) + ':' + ms",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "(hn + 12) + ':' + ms",
          "(h + 12) + ':' + mns",
          "(hn + 12) + ':' + mns"
        ]
      },
      hint: "Read the clock first, then add 12 to the hour.",
      figure: {
        kind: "clock",
        hour: "h",
        minute: "m",
        numerals: "true",
        minuteTicks: "true"
      },
      tags: [
        "AC9M5M03",
        "MA3-NSM-02"
      ]
    },
    {
      id: "maths.5.time.clock-minutes-until",
      subject: "maths",
      topic: "time",
      level: "5",
      prompt: "This clock shows a pm time. How many minutes until {th}:{tms}?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "10"
        },
        {
          name: "mi",
          kind: "int",
          min: "0",
          max: "11"
        },
        {
          name: "m",
          kind: "expr",
          expr: "mi * 5"
        },
        {
          name: "g",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "tot",
          kind: "expr",
          expr: "mi + g"
        },
        {
          name: "th",
          kind: "expr",
          expr: "tot >= 12 ? h + 13 : h + 12"
        },
        {
          name: "tm",
          kind: "expr",
          expr: "mod(tot, 12) * 5"
        },
        {
          name: "tms",
          kind: "expr",
          expr: "tm == 0 ? '00' : tm == 5 ? '05' : '' + tm"
        }
      ],
      answer: "g * 5",
      hint: "Count on round the face in 5s from the long hand.",
      figure: {
        kind: "clock",
        hour: "h",
        minute: "m",
        numerals: "true",
        minuteTicks: "true"
      },
      tags: [
        "AC9M5M03",
        "MA3-NSM-02"
      ]
    },
    {
      id: "maths.5.angles.right-angles-in-degrees",
      subject: "maths",
      topic: "angles",
      level: "5",
      prompt: "How many degrees are there in {n} right angles?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "4"
        }
      ],
      answer: "n * 90",
      hint: "A right angle is 90 degrees.",
      tags: [
        "AC9M5M04",
        "MA3-GM-03"
      ]
    },
    {
      id: "maths.5.angles.name-from-degrees",
      subject: "maths",
      topic: "angles",
      level: "5",
      prompt: "Is an angle of {d} degrees acute, obtuse or reflex?",
      vars: [
        {
          name: "band",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "lo",
          kind: "expr",
          expr: "band == 0 ? 5 : band == 1 ? 95 : 185"
        },
        {
          name: "hi",
          kind: "expr",
          expr: "band == 0 ? 85 : band == 1 ? 175 : 355"
        },
        {
          name: "d",
          kind: "int",
          min: "lo",
          max: "hi",
          step: 5
        }
      ],
      answer: "d < 90 ? 'acute' : d < 180 ? 'obtuse' : 'reflex'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'acute'",
          "'obtuse'",
          "'reflex'"
        ]
      },
      hint: "Under 90 is acute, between 90 and 180 is obtuse, over 180 is reflex.",
      tags: [
        "AC9M5M04",
        "MA3-GM-03"
      ]
    },
    {
      id: "maths.5.angles.name-picture",
      subject: "maths",
      topic: "angles",
      level: "5",
      prompt: "Is this angle acute, obtuse or reflex?",
      vars: [
        {
          name: "kind",
          kind: "pick",
          from: [
            "acute",
            "obtuse",
            "reflex"
          ]
        },
        {
          name: "small",
          kind: "int",
          min: "15",
          max: "65",
          step: 5
        },
        {
          name: "large",
          kind: "int",
          min: "115",
          max: "160",
          step: 5
        },
        {
          name: "round",
          kind: "int",
          min: "200",
          max: "340",
          step: 5
        },
        {
          name: "d",
          kind: "expr",
          expr: "kind == 'acute' ? small : kind == 'obtuse' ? large : round"
        }
      ],
      answer: "kind",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'acute'",
          "'obtuse'",
          "'reflex'"
        ]
      },
      hint: "The marked sweep is the angle - a reflex one goes more than half way round.",
      figure: {
        kind: "angle",
        degrees: "d"
      },
      tags: [
        "AC9M5M04",
        "MA3-GM-03"
      ]
    },
    {
      id: "maths.5.angles.estimate-degrees",
      subject: "maths",
      topic: "angles",
      level: "5",
      prompt: "About how many degrees is this angle?",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            30,
            60,
            90,
            120
          ]
        }
      ],
      answer: "d",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "30",
          "60",
          "90",
          "120"
        ]
      },
      hint: "A right angle is 90 degrees. Is this one bigger or smaller than that?",
      figure: {
        kind: "angle",
        degrees: "d"
      },
      tags: [
        "AC9M5M04",
        "MA3-GM-03"
      ]
    },
    {
      id: "maths.5.symmetry.half-turn",
      subject: "maths",
      topic: "symmetry",
      level: "5",
      prompt: "True or false: turning this shape half way round would leave it looking exactly the same.",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "equilateral",
            "isosceles",
            "scalene",
            "right-triangle",
            "square",
            "rectangle",
            "rhombus",
            "parallelogram",
            "trapezium",
            "kite",
            "pentagon",
            "hexagon",
            "heptagon",
            "octagon"
          ]
        }
      ],
      answer: "shape == 'square' || shape == 'rectangle' || shape == 'rhombus' || shape == 'parallelogram' || shape == 'hexagon' || shape == 'octagon'",
      hint: "Half a turn is the same as looking at it upside down.",
      figure: {
        kind: "polygon",
        shape: "shape"
      },
      tags: [
        "AC9M4SP03",
        "AC9M5SP03"
      ]
    },
    {
      id: "maths.5.symmetry.turn-matches",
      subject: "maths",
      topic: "symmetry",
      level: "5",
      prompt: "In one full turn, how many times does this shape look exactly the same as it does now?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "rectangle",
            "rhombus",
            "parallelogram",
            "equilateral",
            "square",
            "pentagon",
            "hexagon",
            "heptagon",
            "octagon"
          ]
        }
      ],
      answer: "shape == 'rectangle' || shape == 'rhombus' || shape == 'parallelogram' ? 2 : shape == 'equilateral' ? 3 : shape == 'square' ? 4 : shape == 'pentagon' ? 5 : shape == 'hexagon' ? 6 : shape == 'heptagon' ? 7 : 8",
      hint: "A regular shape matches once for every side. A rectangle, a rhombus and a parallelogram match twice.",
      figure: {
        kind: "polygon",
        shape: "shape"
      },
      tags: [
        "AC9M4SP03",
        "AC9M5SP03"
      ]
    },
    {
      id: "maths.5.shapes.object-edges",
      subject: "maths",
      topic: "shapes",
      level: "5",
      prompt: "How many edges does this shape have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "square-pyramid",
            "triangular-prism"
          ]
        }
      ],
      answer: "shape == 'cube' ? 12 : shape == 'square-pyramid' ? 8 : 9",
      hint: "Count the edges you can see, then the dashed ones round the back.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M5SP01",
        "MA3-3DS-01"
      ]
    },
    {
      id: "maths.5.shapes.object-corners",
      subject: "maths",
      topic: "shapes",
      level: "5",
      prompt: "How many corners does this shape have?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "square-pyramid",
            "triangular-prism"
          ]
        }
      ],
      answer: "shape == 'cube' ? 8 : shape == 'square-pyramid' ? 5 : 6",
      hint: "One corner is hidden behind the shape. Count that one too.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M5SP01",
        "MA3-3DS-01"
      ]
    },
    {
      id: "maths.5.shapes.square-face",
      subject: "maths",
      topic: "shapes",
      level: "5",
      prompt: "True or false: this shape has a face shaped like a square.",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "cuboid"
          ]
        }
      ],
      answer: "shape == 'cube'",
      hint: "A rectangle is only a square when all four of its sides are the same length.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M5SP01",
        "MA3-3DS-01"
      ]
    },
    {
      id: "maths.5.position.coordinates",
      subject: "maths",
      topic: "position",
      level: "5",
      prompt: "What are the coordinates of the dot?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "cols",
          kind: "int",
          min: "3",
          max: "5"
        },
        {
          name: "rws",
          kind: "int",
          min: "3",
          max: "4"
        },
        {
          name: "xn",
          kind: "expr",
          expr: "3 - x"
        },
        {
          name: "dy",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "yn",
          kind: "expr",
          expr: "mod(y - 1 + dy, 3) + 1"
        }
      ],
      answer: "'(' + x + ',' + y + ')'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'(' + xn + ',' + y + ')'",
          "'(' + x + ',' + yn + ')'",
          "'(' + xn + ',' + yn + ')'"
        ]
      },
      hint: "The first number is how far along the bottom, the second is how far up.",
      figure: {
        kind: "grid",
        at: "x + ',' + y",
        columns: "cols",
        rows: "rws",
        onLines: "true"
      },
      tags: [
        "AC9M5SP02",
        "MA3-GM-01"
      ]
    },
    {
      id: "maths.5.position.coordinate-step",
      subject: "maths",
      topic: "position",
      level: "5",
      prompt: "Which point is one to the {ew} and one {ns} from the dot?",
      vars: [
        {
          name: "ax",
          kind: "int",
          min: "2",
          max: "3"
        },
        {
          name: "ay",
          kind: "int",
          min: "2",
          max: "3"
        },
        {
          name: "across",
          kind: "pick",
          from: [
            1,
            -1
          ]
        },
        {
          name: "up",
          kind: "pick",
          from: [
            1,
            -1
          ]
        },
        {
          name: "x",
          kind: "expr",
          expr: "ax - across"
        },
        {
          name: "y",
          kind: "expr",
          expr: "ay - up"
        },
        {
          name: "ew",
          kind: "expr",
          expr: "across == 1 ? 'right' : 'left'"
        },
        {
          name: "ns",
          kind: "expr",
          expr: "up == 1 ? 'up' : 'down'"
        },
        {
          name: "cols",
          kind: "int",
          min: "max(3, x)",
          max: "5"
        },
        {
          name: "rws",
          kind: "int",
          min: "max(3, y)",
          max: "4"
        }
      ],
      answer: "'(' + ax + ',' + ay + ')'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'(2,2)'",
          "'(2,3)'",
          "'(3,2)'",
          "'(3,3)'"
        ]
      },
      hint: "Find the point the dot is on, then move one line across and one line up or down.",
      figure: {
        kind: "grid",
        at: "x + ',' + y",
        columns: "cols",
        rows: "rws",
        onLines: "true"
      },
      tags: [
        "AC9M5SP02",
        "MA3-GM-01"
      ]
    },
    {
      id: "maths.5.data.picture-key-difference",
      subject: "maths",
      topic: "data",
      level: "5",
      prompt: "Each picture stands for {k} books. How many more books did {a} read than {b}?",
      vars: [
        {
          name: "k",
          kind: "pick",
          from: [
            2,
            5,
            10
          ]
        },
        {
          name: "diff",
          kind: "pick",
          from: [
            1,
            2,
            3
          ]
        },
        {
          name: "ib",
          kind: "int",
          min: "1",
          max: "4 - diff"
        },
        {
          name: "ia",
          kind: "expr",
          expr: "ib + diff"
        },
        {
          name: "ic",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "skip",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "j",
          kind: "expr",
          expr: "mod(i + skip, 3)"
        },
        {
          name: "ada",
          kind: "expr",
          expr: "i == 0 ? ia : j == 0 ? ib : ic"
        },
        {
          name: "kai",
          kind: "expr",
          expr: "i == 1 ? ia : j == 1 ? ib : ic"
        },
        {
          name: "leo",
          kind: "expr",
          expr: "i == 2 ? ia : j == 2 ? ib : ic"
        },
        {
          name: "a",
          kind: "expr",
          expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'"
        },
        {
          name: "b",
          kind: "expr",
          expr: "j == 0 ? 'Ada' : j == 1 ? 'Kai' : 'Leo'"
        }
      ],
      answer: "diff * k",
      hint: "Count the pictures in both rows, then count on in {k}s.",
      figure: {
        kind: "pictograph",
        counts: "(ada * k) + ',' + (kai * k) + ',' + (leo * k)",
        labels: "'Ada,Kai,Leo'",
        key: "k"
      },
      tags: [
        "AC9M5ST01",
        "MA3-DATA-01"
      ]
    },
    {
      id: "maths.5.data.picture-key-halves",
      subject: "maths",
      topic: "data",
      level: "5",
      prompt: "Each picture stands for 10 goals. How many goals did {who} score?",
      vars: [
        {
          name: "ha",
          kind: "int",
          min: "1",
          max: "8"
        },
        {
          name: "hb",
          kind: "int",
          min: "1",
          max: "8"
        },
        {
          name: "hc",
          kind: "int",
          min: "1",
          max: "8"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "who",
          kind: "expr",
          expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'"
        },
        {
          name: "halfIcons",
          kind: "expr",
          expr: "i == 0 ? ha : i == 1 ? hb : hc"
        }
      ],
      answer: "halfIcons * 5",
      hint: "A whole picture is 10 goals and half a picture is 5.",
      figure: {
        kind: "pictograph",
        counts: "(ha * 5) + ',' + (hb * 5) + ',' + (hc * 5)",
        labels: "'Ada,Kai,Leo'",
        key: "10",
        halves: "true"
      },
      tags: [
        "AC9M5ST01",
        "MA3-DATA-01"
      ]
    },
    {
      id: "maths.5.data.line-graph-read",
      subject: "maths",
      topic: "data",
      level: "5",
      prompt: "How many visitors came on {day}?",
      vars: [
        {
          name: "v0",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "v1",
          kind: "int",
          min: "2",
          max: "5"
        },
        {
          name: "v2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "v3",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "day",
          kind: "expr",
          expr: "i == 0 ? 'Mon' : i == 1 ? 'Tue' : i == 2 ? 'Wed' : 'Thu'"
        }
      ],
      answer: "(i == 0 ? v0 : i == 1 ? v1 : i == 2 ? v2 : v3) * 10",
      hint: "The numbers up the side go up in 10s. Find the day along the bottom and follow the line up.",
      figure: {
        kind: "bar",
        values: "(v0 * 10) + ',' + (v1 * 10) + ',' + (v2 * 10) + ',' + (v3 * 10)",
        labels: "'Mon,Tue,Wed,Thu'",
        scale: "10",
        style: "'line'"
      },
      tags: [
        "AC9M5ST02",
        "MA3-DATA-02"
      ]
    },
    {
      id: "maths.5.data.line-graph-rise",
      subject: "maths",
      topic: "data",
      level: "5",
      prompt: "How many more visitors came on {b} than on {a}?",
      vars: [
        {
          name: "diff",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "lo",
          kind: "int",
          min: "1",
          max: "5 - diff"
        },
        {
          name: "hi",
          kind: "expr",
          expr: "lo + diff"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "p",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "q",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "v0",
          kind: "expr",
          expr: "i == 0 ? lo : p"
        },
        {
          name: "v1",
          kind: "expr",
          expr: "i == 0 ? hi : i == 1 ? lo : q"
        },
        {
          name: "v2",
          kind: "expr",
          expr: "i == 1 ? hi : i == 2 ? lo : p"
        },
        {
          name: "v3",
          kind: "expr",
          expr: "i == 2 ? hi : q"
        },
        {
          name: "a",
          kind: "expr",
          expr: "i == 0 ? 'Mon' : i == 1 ? 'Tue' : 'Wed'"
        },
        {
          name: "b",
          kind: "expr",
          expr: "i == 0 ? 'Tue' : i == 1 ? 'Wed' : 'Thu'"
        }
      ],
      answer: "diff * 10",
      hint: "The numbers up the side go up in 10s. Read both days, then subtract.",
      figure: {
        kind: "bar",
        values: "(v0 * 10) + ',' + (v1 * 10) + ',' + (v2 * 10) + ',' + (v3 * 10)",
        labels: "'Mon,Tue,Wed,Thu'",
        scale: "10",
        style: "'line'"
      },
      tags: [
        "AC9M5ST02",
        "MA3-DATA-02"
      ]
    },
    {
      id: "maths.5.data.timeline-years-between",
      subject: "maths",
      topic: "data",
      level: "5",
      prompt: "How many years are there between A and B?",
      vars: [
        {
          name: "start",
          kind: "pick",
          from: [
            1800,
            1850,
            1900
          ]
        },
        {
          name: "i",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "j",
          kind: "int",
          min: "3",
          max: "4"
        }
      ],
      constraints: [
        "j - i >= 2"
      ],
      answer: "20 * (j - i)",
      hint: "Count the ticks from A to B. Each tick is worth 20 years.",
      figure: {
        kind: "timeline",
        years: "(start + 20 * i) + ',' + (start + 20 * j)",
        labels: "'A,B'",
        from: "start",
        to: "start + 100",
        step: "20"
      },
      tags: [
        "MA3-DATA-02"
      ]
    },
    {
      id: "maths.5.data.timeline-read-year",
      subject: "maths",
      topic: "data",
      level: "5",
      prompt: "In what year did B happen?",
      vars: [
        {
          name: "start",
          kind: "pick",
          from: [
            1800,
            1820,
            1840,
            1860,
            1880
          ]
        },
        {
          name: "i",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "j",
          kind: "int",
          min: "4",
          max: "5"
        },
        {
          name: "order",
          kind: "pick",
          from: [
            "A,B",
            "B,A"
          ]
        }
      ],
      answer: "order == 'A,B' ? start + 20 * j : start + 20 * i",
      hint: "Start at the year on the left and count on 20 for every tick.",
      figure: {
        kind: "timeline",
        years: "(start + 20 * i) + ',' + (start + 20 * j)",
        labels: "order",
        from: "start",
        to: "start + 120",
        step: "20"
      },
      tags: [
        "MA3-DATA-02"
      ]
    },
    {
      id: "maths.5.chance.spinner-fraction",
      subject: "maths",
      topic: "chance",
      level: "5",
      prompt: "What is the chance the arrow stops on a shaded part?",
      vars: [
        {
          name: "which",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ]
        },
        {
          name: "n",
          kind: "expr",
          expr: "which == 0 ? 2 : which == 1 ? 3 : 4"
        },
        {
          name: "s",
          kind: "expr",
          expr: "which == 3 ? 3 : 1"
        },
        {
          name: "parts",
          kind: "expr",
          expr: "n == 2 ? '1,1' : n == 3 ? '1,1,1' : '1,1,1,1'"
        },
        {
          name: "shading",
          kind: "expr",
          expr: "which == 0 ? 'a,b' : which == 1 ? 'a,b,b' : which == 2 ? 'a,b,b,b' : 'a,a,a,b'"
        }
      ],
      answer: "s + '/' + n",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'1/2'",
          "'1/3'",
          "'1/4'",
          "'3/4'"
        ]
      },
      hint: "Count the shaded parts, then all the parts.",
      figure: {
        kind: "spinner",
        sectors: "parts",
        fills: "shading"
      },
      tags: [
        "AC9M5P01",
        "MA3-CHAN-01"
      ]
    },
    {
      id: "maths.5.chance.spinner-percentage",
      subject: "maths",
      topic: "chance",
      level: "5",
      prompt: "What is the chance of stopping on a shaded part, as a percentage?",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            4,
            5
          ]
        },
        {
          name: "s",
          kind: "int",
          min: "1",
          max: "n - 1"
        },
        {
          name: "parts",
          kind: "expr",
          expr: "n == 4 ? '1,1,1,1' : '1,1,1,1,1'"
        },
        {
          name: "shading",
          kind: "expr",
          expr: "n == 4 ? (s == 1 ? 'a,b,b,b' : s == 2 ? 'a,a,b,b' : 'a,a,a,b') : (s == 1 ? 'a,b,b,b,b' : s == 2 ? 'a,a,b,b,b' : s == 3 ? 'a,a,a,b,b' : 'a,a,a,a,b')"
        }
      ],
      answer: "s * 100 / n",
      hint: "The whole spinner is 100%. How much of it is shaded?",
      figure: {
        kind: "spinner",
        sectors: "parts",
        fills: "shading"
      },
      tags: [
        "AC9M5P01",
        "MA3-CHAN-01"
      ]
    },
    {
      id: "maths.5.chance.spinner-equally-likely",
      subject: "maths",
      topic: "chance",
      level: "5",
      prompt: "True or false: the arrow is equally likely to stop on any part.",
      vars: [
        {
          name: "even",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "n",
          kind: "pick",
          from: [
            4,
            5,
            6
          ]
        },
        {
          name: "parts",
          kind: "expr",
          expr: "even == 1 ? (n == 4 ? '1,1,1,1' : n == 5 ? '1,1,1,1,1' : '1,1,1,1,1,1') : (n == 4 ? '2,1,1,1' : n == 5 ? '2,1,1,1,1' : '2,1,1,1,1,1')"
        },
        {
          name: "shading",
          kind: "expr",
          expr: "n == 4 ? 'a,a,a,a' : n == 5 ? 'a,a,a,a,a' : 'a,a,a,a,a,a'"
        }
      ],
      answer: "even == 1",
      hint: "Equally likely means every part is the same size.",
      figure: {
        kind: "spinner",
        sectors: "parts",
        fills: "shading"
      },
      tags: [
        "AC9M5P01",
        "MA3-CHAN-01"
      ]
    },
    {
      id: "maths.5.chance.most-likely-from-trials",
      subject: "maths",
      topic: "chance",
      level: "5",
      prompt: "A spinner stopped on red {r} times, blue {b} and green {g}. Which colour is it most likely to stop on?",
      vars: [
        {
          name: "r",
          kind: "int",
          min: "5",
          max: "40"
        },
        {
          name: "b",
          kind: "int",
          min: "5",
          max: "40"
        },
        {
          name: "g",
          kind: "int",
          min: "5",
          max: "40"
        }
      ],
      constraints: [
        "r != b",
        "b != g",
        "r != g"
      ],
      answer: "r > b && r > g ? 'red' : b > g ? 'blue' : 'green'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'red'",
          "'blue'",
          "'green'"
        ]
      },
      hint: "The colour it stopped on most often is the one to expect next time.",
      tags: [
        "AC9M5P02",
        "MA3-CHAN-01"
      ]
    }
  ]
};

// ../../src/content/packs/maths.6.json
var maths_6_default = {
  version: "e5a8dfc1203f",
  subject: "maths",
  level: "6",
  templates: [
    {
      id: "maths.6.integers.temperature",
      subject: "maths",
      topic: "integers",
      level: "6",
      prompt: "The temperature is {a}\xB0C. Overnight it falls {d}\xB0C. What is the new temperature, in \xB0C?",
      vars: [
        {
          name: "u",
          kind: "pick",
          from: [
            1,
            2
          ]
        },
        {
          name: "k",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ]
        },
        {
          name: "lo",
          kind: "int",
          min: "-20",
          max: "-2 - 3 * u"
        },
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "8"
        },
        {
          name: "d",
          kind: "expr",
          expr: "a - (lo + k * u)"
        }
      ],
      answer: "a - d",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "lo",
          "lo + u",
          "lo + 2 * u",
          "lo + 3 * u"
        ]
      },
      hint: "Count down past zero.",
      tags: [
        "AC9M6N01"
      ]
    },
    {
      id: "maths.6.integers.subtract",
      subject: "maths",
      topic: "integers",
      level: "6",
      prompt: "What is {a} \u2212 {b}?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "20"
        },
        {
          name: "b",
          kind: "int",
          min: "a + 2",
          max: "a + 20"
        },
        {
          name: "u",
          kind: "pick",
          from: [
            1,
            2
          ]
        },
        {
          name: "k",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ]
        },
        {
          name: "lo",
          kind: "expr",
          expr: "a - b - k * u"
        }
      ],
      answer: "a - b",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "lo",
          "lo + u",
          "lo + 2 * u",
          "lo + 3 * u"
        ]
      },
      tags: [
        "AC9M6N01"
      ]
    },
    {
      id: "maths.6.integers.compare",
      subject: "maths",
      topic: "integers",
      level: "6",
      prompt: "True or false: \u2212{a} is greater than \u2212{b}.",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "30"
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "30"
        }
      ],
      constraints: [
        "a != b"
      ],
      answer: "-a > -b",
      hint: "On a number line, further left is smaller.",
      tags: [
        "AC9M6N01"
      ]
    },
    {
      id: "maths.6.primes-and-squares.is-prime",
      subject: "maths",
      topic: "primes and squares",
      level: "6",
      prompt: "True or false: {n} is a prime number.",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            14,
            15,
            16,
            17,
            18,
            19,
            20,
            21
          ]
        }
      ],
      answer: "n == 2 || n == 3 || n == 5 || n == 7 || n == 11 || n == 13 || n == 17 || n == 19",
      hint: "A prime has exactly two factors: 1 and itself.",
      tags: [
        "AC9M6N02",
        "MA3-RN-01"
      ]
    },
    {
      id: "maths.6.primes-and-squares.square-number",
      subject: "maths",
      topic: "primes and squares",
      level: "6",
      prompt: "What is {n} squared?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "15"
        }
      ],
      answer: "n * n",
      hint: "{n} \xD7 {n}",
      tags: [
        "AC9M6N02",
        "MA3-RN-01"
      ]
    },
    {
      id: "maths.6.primes-and-squares.square-root",
      subject: "maths",
      topic: "primes and squares",
      level: "6",
      prompt: "What is the square root of {square}?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "15"
        },
        {
          name: "square",
          kind: "expr",
          expr: "n * n"
        }
      ],
      answer: "n",
      hint: "Which number times itself gives {square}?",
      tags: [
        "AC9M6N02",
        "MA3-RN-01"
      ]
    },
    {
      id: "maths.6.decimals.add",
      subject: "maths",
      topic: "decimals",
      level: "6",
      prompt: "What is {a} + {b}?",
      vars: [
        {
          name: "na",
          kind: "int",
          min: "105",
          max: "4995"
        },
        {
          name: "nb",
          kind: "int",
          min: "105",
          max: "4995"
        },
        {
          name: "u",
          kind: "pick",
          from: [
            1,
            10,
            100
          ]
        },
        {
          name: "k",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ]
        },
        {
          name: "lo",
          kind: "expr",
          expr: "na + nb - k * u"
        },
        {
          name: "a",
          kind: "expr",
          expr: "na / 100"
        },
        {
          name: "b",
          kind: "expr",
          expr: "nb / 100"
        }
      ],
      answer: "(na + nb) / 100",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "lo / 100",
          "(lo + u) / 100",
          "(lo + 2 * u) / 100",
          "(lo + 3 * u) / 100"
        ]
      },
      tags: [
        "AC9M6N04",
        "MA3-AR-01"
      ]
    },
    {
      id: "maths.6.decimals.multiply-by-powers-of-ten",
      subject: "maths",
      topic: "decimals",
      level: "6",
      prompt: "What is {a} \xD7 {p}?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "105",
          max: "995"
        },
        {
          name: "a",
          kind: "expr",
          expr: "n / 100"
        },
        {
          name: "p",
          kind: "pick",
          from: [
            10,
            100,
            1e3
          ]
        }
      ],
      constraints: [
        "mod(n, 10) != 0"
      ],
      answer: "n * p / 100",
      hint: "Every digit moves left one place for each zero.",
      tags: [
        "AC9M6N06",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.6.decimals.divide-by-powers-of-ten",
      subject: "maths",
      topic: "decimals",
      level: "6",
      prompt: "What is {a} \xF7 {p}?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "11",
          max: "999"
        },
        {
          name: "p",
          kind: "pick",
          from: [
            10,
            100,
            1e3
          ]
        },
        {
          name: "a",
          kind: "expr",
          expr: "n * p / 100"
        }
      ],
      constraints: [
        "mod(n, 10) != 0"
      ],
      answer: "n / 100",
      hint: "Every digit moves one place to the right.",
      tags: [
        "AC9M6N06",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.6.fractions.add-with-equivalence",
      subject: "maths",
      topic: "fractions",
      level: "6",
      prompt: "{a}/{d} + {b}/{d * 2} = ?/{d * 2}  What is the missing numerator?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "3",
          max: "9"
        },
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "d - 2"
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "d - 1"
        }
      ],
      constraints: [
        "a * 2 + b <= d * 2"
      ],
      answer: "a * 2 + b",
      hint: "Rewrite {a}/{d} with {d * 2} on the bottom first.",
      tags: [
        "AC9M6N05",
        "MA3-RQF-01"
      ]
    },
    {
      id: "maths.6.fractions.subtract-with-equivalence",
      subject: "maths",
      topic: "fractions",
      level: "6",
      prompt: "{a}/{d} \u2212 {b}/{d * 2} = ?/{d * 2}  What is the missing numerator?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "3",
          max: "9"
        },
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "d - 1"
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "a * 2 - 1"
        }
      ],
      answer: "a * 2 - b",
      tags: [
        "AC9M6N05",
        "MA3-RQF-01"
      ]
    },
    {
      id: "maths.6.fractions.compare",
      subject: "maths",
      topic: "fractions",
      level: "6",
      prompt: "True or false: {a}/{d} is greater than {b}/{e}.",
      vars: [
        {
          name: "d",
          kind: "pick",
          from: [
            2,
            3,
            4,
            6
          ]
        },
        {
          name: "e",
          kind: "pick",
          from: [
            2,
            3,
            4,
            6
          ]
        },
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "d - 1"
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "e - 1"
        }
      ],
      constraints: [
        "a / d != b / e"
      ],
      answer: "a / d > b / e",
      hint: "Rewrite both with the same denominator.",
      tags: [
        "AC9M6N03",
        "MA3-RQF-01"
      ]
    },
    {
      id: "maths.6.percentages.of-a-quantity",
      subject: "maths",
      topic: "percentages",
      level: "6",
      prompt: "What is {p}% of {total}?",
      vars: [
        {
          name: "p",
          kind: "pick",
          from: [
            5,
            10,
            20,
            25,
            50
          ]
        },
        {
          name: "k",
          kind: "int",
          min: "2",
          max: "25"
        },
        {
          name: "total",
          kind: "expr",
          expr: "k * 20"
        }
      ],
      answer: "total * p / 100",
      tags: [
        "AC9M6N07",
        "MA3-RN-03"
      ]
    },
    {
      id: "maths.6.percentages.discount-saved",
      subject: "maths",
      topic: "percentages",
      level: "6",
      prompt: "A jacket costs ${cost}. It is reduced by {p}%. How many dollars do you save?",
      vars: [
        {
          name: "p",
          kind: "pick",
          from: [
            10,
            25,
            50
          ]
        },
        {
          name: "k",
          kind: "int",
          min: "1",
          max: "10"
        },
        {
          name: "cost",
          kind: "expr",
          expr: "k * 20"
        }
      ],
      answer: "cost * p / 100",
      tags: [
        "AC9M6N07",
        "MA3-RN-03"
      ]
    },
    {
      id: "maths.6.percentages.sale-price",
      subject: "maths",
      topic: "percentages",
      level: "6",
      prompt: "A game costs ${cost} and is {p}% off. What do you pay, in dollars?",
      vars: [
        {
          name: "p",
          kind: "pick",
          from: [
            10,
            25,
            50
          ]
        },
        {
          name: "k",
          kind: "int",
          min: "1",
          max: "10"
        },
        {
          name: "cost",
          kind: "expr",
          expr: "k * 20"
        }
      ],
      answer: "cost - cost * p / 100",
      hint: "Work out the saving, then subtract it from {cost} dollars.",
      tags: [
        "AC9M6N07",
        "MA3-RN-03"
      ]
    },
    {
      id: "maths.6.order-of-operations.multiply-first",
      subject: "maths",
      topic: "order of operations",
      level: "6",
      prompt: "What is {a} + {b} \xD7 {c}?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "30"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "12"
        },
        {
          name: "c",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "a + b * c",
      hint: "Multiplication happens before addition.",
      tags: [
        "AC9M6A02",
        "MA3-MR-02"
      ]
    },
    {
      id: "maths.6.order-of-operations.brackets-first",
      subject: "maths",
      topic: "order of operations",
      level: "6",
      prompt: "What is ({a} + {b}) \xD7 {c}?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "30"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "20"
        },
        {
          name: "c",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "(a + b) * c",
      hint: "Do what is inside the brackets first.",
      tags: [
        "AC9M6A02",
        "MA3-MR-02"
      ]
    },
    {
      id: "maths.6.algebra.unknown-with-brackets",
      subject: "maths",
      topic: "algebra",
      level: "6",
      prompt: "What goes in the box? ({a} + ?) \xD7 {c} = {total}",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "20"
        },
        {
          name: "b",
          kind: "int",
          min: "2",
          max: "20"
        },
        {
          name: "c",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "total",
          kind: "expr",
          expr: "(a + b) * c"
        }
      ],
      answer: "b",
      hint: "Divide {total} by {c} first.",
      tags: [
        "AC9M6A02",
        "MA3-MR-02"
      ]
    },
    {
      id: "maths.6.number-patterns.two-step-rule",
      subject: "maths",
      topic: "number patterns",
      level: "6",
      prompt: "The rule is: multiply by {k}, then add {b}. What comes after {a}?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "2",
          max: "20"
        },
        {
          name: "k",
          kind: "pick",
          from: [
            2,
            3,
            4
          ]
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "9"
        }
      ],
      answer: "a * k + b",
      tags: [
        "AC9M6A01",
        "MA3-MR-01"
      ]
    },
    {
      id: "maths.6.number-patterns.growing-pattern",
      subject: "maths",
      topic: "number patterns",
      level: "6",
      prompt: "A pattern starts at {a} and adds {d}, then {2 * d}, then {3 * d}. What is the 4th number?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "20"
        },
        {
          name: "d",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "a + d + 2 * d + 3 * d",
      tags: [
        "AC9M6A01",
        "MA3-AR-01"
      ]
    },
    {
      id: "maths.6.measurement.centimetres-to-metres",
      subject: "maths",
      topic: "measurement",
      level: "6",
      prompt: "How many metres is {cm} centimetres?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "3",
          max: "199"
        },
        {
          name: "cm",
          kind: "expr",
          expr: "n * 5"
        }
      ],
      constraints: [
        "mod(n * 5, 100) != 0"
      ],
      answer: "n * 5 / 100",
      hint: "There are 100 centimetres in a metre.",
      tags: [
        "AC9M6M01",
        "MA3-GM-02"
      ]
    },
    {
      id: "maths.6.measurement.grams-to-kilograms",
      subject: "maths",
      topic: "measurement",
      level: "6",
      prompt: "How many kilograms is {g} grams?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "3",
          max: "199"
        },
        {
          name: "g",
          kind: "expr",
          expr: "n * 50"
        }
      ],
      constraints: [
        "mod(n * 5, 100) != 0"
      ],
      answer: "n * 50 / 1000",
      hint: "There are 1000 grams in a kilogram.",
      tags: [
        "AC9M6M01",
        "MA3-NSM-01"
      ]
    },
    {
      id: "maths.6.measurement.number-line-centimetres",
      subject: "maths",
      topic: "measurement",
      level: "6",
      prompt: "The arrow shows a length in metres. How many centimetres is that?",
      vars: [
        {
          name: "w",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "9"
        },
        {
          name: "k",
          kind: "pick",
          from: [
            1,
            3,
            7,
            9
          ]
        },
        {
          name: "cm",
          kind: "expr",
          expr: "w * 100 + t * 10 + k"
        },
        {
          name: "lo",
          kind: "expr",
          expr: "(w * 100 + t * 10) / 100"
        },
        {
          name: "hi",
          kind: "expr",
          expr: "(w * 100 + t * 10 + 10) / 100"
        },
        {
          name: "m",
          kind: "expr",
          expr: "cm / 100"
        }
      ],
      answer: "cm",
      hint: "Each small tick is a hundredth of a metre, which is one centimetre.",
      figure: {
        kind: "number-line",
        at: "m",
        from: "lo",
        to: "hi",
        step: "0.1"
      },
      tags: [
        "AC9M6M01",
        "MA3-GM-02"
      ]
    },
    {
      id: "maths.6.measurement.total-mass",
      subject: "maths",
      topic: "measurement",
      level: "6",
      prompt: "{n} tins each weigh {g} grams. What is the total mass, in kilograms?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "2",
          max: "9"
        },
        {
          name: "j",
          kind: "int",
          min: "1",
          max: "8"
        },
        {
          name: "g",
          kind: "expr",
          expr: "j * 50"
        }
      ],
      answer: "n * g / 1000",
      hint: "Work out the total in grams first. There are 1000 grams in a kilogram.",
      tags: [
        "AC9M6M01",
        "MA3-NSM-01"
      ]
    },
    {
      id: "maths.6.measurement.litres-to-millilitres",
      subject: "maths",
      topic: "measurement",
      level: "6",
      prompt: "A jug holds {l} litres. How many millilitres is that?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "105",
          max: "995"
        },
        {
          name: "l",
          kind: "expr",
          expr: "n / 100"
        }
      ],
      constraints: [
        "mod(n, 10) != 0"
      ],
      answer: "n * 10",
      hint: "There are 1000 millilitres in a litre.",
      tags: [
        "AC9M6M01",
        "MA3-3DS-02"
      ]
    },
    {
      id: "maths.6.measurement.full-glasses",
      subject: "maths",
      topic: "measurement",
      level: "6",
      prompt: "A {l} litre bottle is poured into glasses holding {ml} millilitres each. How many glasses does it fill?",
      vars: [
        {
          name: "l",
          kind: "int",
          min: "2",
          max: "6"
        },
        {
          name: "ml",
          kind: "pick",
          from: [
            100,
            125,
            200,
            250,
            500
          ]
        }
      ],
      answer: "l * 1000 / ml",
      hint: "The bottle holds {l * 1000} millilitres.",
      tags: [
        "AC9M6M01",
        "MA3-3DS-02"
      ]
    },
    {
      id: "maths.6.perimeter-and-area.rectangle-formula",
      subject: "maths",
      topic: "perimeter and area",
      level: "6",
      prompt: "A rectangle is {l} m long and {w} m wide. What is its area, in square metres?",
      vars: [
        {
          name: "l",
          kind: "int",
          min: "5",
          max: "40"
        },
        {
          name: "w",
          kind: "int",
          min: "3",
          max: "25"
        }
      ],
      answer: "l * w",
      hint: "Area of a rectangle is length times width.",
      tags: [
        "AC9M6M02",
        "MA3-2DS-02"
      ]
    },
    {
      id: "maths.6.perimeter-and-area.square-area",
      subject: "maths",
      topic: "perimeter and area",
      level: "6",
      prompt: "A square has sides of {s} m. What is its area, in square metres?",
      vars: [
        {
          name: "s",
          kind: "int",
          min: "3",
          max: "20"
        }
      ],
      answer: "s * s",
      tags: [
        "AC9M6M02",
        "MA3-2DS-02"
      ]
    },
    {
      id: "maths.6.angles.on-a-straight-line",
      subject: "maths",
      topic: "angles",
      level: "6",
      prompt: "Two angles sit on a straight line. One is {a} degrees. What is the other, in degrees?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "10",
          max: "170",
          step: 5
        }
      ],
      answer: "180 - a",
      hint: "Angles on a straight line add to 180 degrees.",
      tags: [
        "AC9M6M04",
        "MA3-GM-03"
      ]
    },
    {
      id: "maths.6.angles.at-a-point",
      subject: "maths",
      topic: "angles",
      level: "6",
      prompt: "Three angles meet at a point. Two are {a} and {b} degrees. What is the third, in degrees?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "20",
          max: "170",
          step: 5
        },
        {
          name: "b",
          kind: "int",
          min: "20",
          max: "170",
          step: 5
        }
      ],
      constraints: [
        "a + b < 350"
      ],
      answer: "360 - a - b",
      hint: "Angles at a point add to 360 degrees.",
      tags: [
        "AC9M6M04",
        "MA3-GM-03"
      ]
    },
    {
      id: "maths.6.angles.vertically-opposite",
      subject: "maths",
      topic: "angles",
      level: "6",
      prompt: "Two lines cross. One angle is {a} degrees. What is the angle opposite it, in degrees?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "15",
          max: "165",
          step: 5
        }
      ],
      answer: "a",
      hint: "Vertically opposite angles are equal.",
      tags: [
        "AC9M6M04",
        "MA3-GM-03"
      ]
    },
    {
      id: "maths.6.angles.rest-of-a-turn",
      subject: "maths",
      topic: "angles",
      level: "6",
      prompt: "The marked angle is {d} degrees. How many degrees is the angle on the other side of it?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "20",
          max: "340",
          step: 5
        }
      ],
      constraints: [
        "d != 180"
      ],
      answer: "360 - d",
      hint: "Angles at a point add to 360 degrees.",
      figure: {
        kind: "angle",
        degrees: "d"
      },
      tags: [
        "AC9M6M04",
        "MA3-GM-03"
      ]
    },
    {
      id: "maths.6.angles.rest-of-a-line",
      subject: "maths",
      topic: "angles",
      level: "6",
      prompt: "Another angle beside this one would make a straight line. Is it bigger or smaller than this one?",
      vars: [
        {
          name: "d",
          kind: "int",
          min: "20",
          max: "160",
          step: 5
        }
      ],
      constraints: [
        "abs(d - 90) >= 25"
      ],
      answer: "d < 90 ? 'bigger' : 'smaller'",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "'bigger'",
          "'smaller'"
        ]
      },
      hint: "The two add to 180 degrees, so compare this one with 90.",
      figure: {
        kind: "angle",
        degrees: "d"
      },
      tags: [
        "AC9M6M04",
        "MA3-GM-03"
      ]
    },
    {
      id: "maths.6.time.journey-length",
      subject: "maths",
      topic: "time",
      level: "6",
      prompt: "A bus leaves at 9:{a} and arrives at 10:{b}. How many minutes does the journey take?",
      vars: [
        {
          name: "a",
          kind: "int",
          min: "5",
          max: "55",
          step: 5
        },
        {
          name: "b",
          kind: "int",
          min: "5",
          max: "55",
          step: 5
        }
      ],
      answer: "60 - a + b",
      hint: "Count up to 10 o\u2019clock first.",
      tags: [
        "AC9M6M03",
        "MA3-NSM-02"
      ]
    },
    {
      id: "maths.6.time.clock-arrival",
      subject: "maths",
      topic: "time",
      level: "6",
      prompt: "This clock shows when the bus leaves. The trip takes {n} minutes. What time does it arrive?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "mi",
          kind: "int",
          min: "0",
          max: "11"
        },
        {
          name: "m",
          kind: "expr",
          expr: "mi * 5"
        },
        {
          name: "g",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "n",
          kind: "expr",
          expr: "g * 5"
        },
        {
          name: "tot",
          kind: "expr",
          expr: "mi + g"
        },
        {
          name: "ah",
          kind: "expr",
          expr: "tot >= 12 ? mod(h, 12) + 1 : h"
        },
        {
          name: "am",
          kind: "expr",
          expr: "mod(tot, 12) * 5"
        },
        {
          name: "hs",
          kind: "pick",
          from: [
            1,
            -1
          ]
        },
        {
          name: "oh",
          kind: "expr",
          expr: "mod(ah - 1 + hs + 12, 12) + 1"
        },
        {
          name: "dm",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "om",
          kind: "expr",
          expr: "mod(mod(tot, 12) + dm, 12) * 5"
        },
        {
          name: "ams",
          kind: "expr",
          expr: "am == 0 ? '00' : am == 5 ? '05' : '' + am"
        },
        {
          name: "oms",
          kind: "expr",
          expr: "om == 0 ? '00' : om == 5 ? '05' : '' + om"
        }
      ],
      answer: "ah + ':' + ams",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "oh + ':' + ams",
          "ah + ':' + oms",
          "oh + ':' + oms"
        ]
      },
      hint: "Read the clock first, then count on round the face in 5s.",
      figure: {
        kind: "clock",
        hour: "h",
        minute: "m",
        numerals: "true",
        minuteTicks: "true"
      },
      tags: [
        "AC9M6M03",
        "MA3-NSM-02"
      ]
    },
    {
      id: "maths.6.time.clock-leave-by",
      subject: "maths",
      topic: "time",
      level: "6",
      prompt: "This clock shows when the train leaves. The walk takes {n} minutes. What time should you set off?",
      vars: [
        {
          name: "h",
          kind: "int",
          min: "1",
          max: "12"
        },
        {
          name: "mi",
          kind: "int",
          min: "0",
          max: "11"
        },
        {
          name: "m",
          kind: "expr",
          expr: "mi * 5"
        },
        {
          name: "g",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "n",
          kind: "expr",
          expr: "g * 5"
        },
        {
          name: "back",
          kind: "expr",
          expr: "mi - g < 0 ? 1 : 0"
        },
        {
          name: "ah",
          kind: "expr",
          expr: "back == 1 ? (h == 1 ? 12 : h - 1) : h"
        },
        {
          name: "am",
          kind: "expr",
          expr: "mod(mi - g + 12, 12) * 5"
        },
        {
          name: "hs",
          kind: "pick",
          from: [
            1,
            -1
          ]
        },
        {
          name: "oh",
          kind: "expr",
          expr: "mod(ah - 1 + hs + 12, 12) + 1"
        },
        {
          name: "dm",
          kind: "int",
          min: "1",
          max: "11"
        },
        {
          name: "om",
          kind: "expr",
          expr: "mod(mod(mi - g + 12, 12) + dm, 12) * 5"
        },
        {
          name: "ams",
          kind: "expr",
          expr: "am == 0 ? '00' : am == 5 ? '05' : '' + am"
        },
        {
          name: "oms",
          kind: "expr",
          expr: "om == 0 ? '00' : om == 5 ? '05' : '' + om"
        }
      ],
      answer: "ah + ':' + ams",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "oh + ':' + ams",
          "ah + ':' + oms",
          "oh + ':' + oms"
        ]
      },
      hint: "Read the clock first, then count back round the face in 5s.",
      figure: {
        kind: "clock",
        hour: "h",
        minute: "m",
        numerals: "true",
        minuteTicks: "true"
      },
      tags: [
        "AC9M6M03",
        "MA3-NSM-02"
      ]
    },
    {
      id: "maths.6.position.move-a-point",
      subject: "maths",
      topic: "position",
      level: "6",
      prompt: "A point sits at ({x}, {y}) on a grid. It moves {d} units to the right. What is its new x-coordinate?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "8"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "8"
        },
        {
          name: "d",
          kind: "int",
          min: "2",
          max: "9"
        }
      ],
      answer: "x + d",
      tags: [
        "AC9M6SP02",
        "MA3-GM-01"
      ]
    },
    {
      id: "maths.6.position.move-right",
      subject: "maths",
      topic: "position",
      level: "6",
      prompt: "The dot moves {d} {sq} right. What is its new x-coordinate?",
      vars: [
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "d",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "sq",
          kind: "expr",
          expr: "d == 1 ? 'square' : 'squares'"
        },
        {
          name: "cols",
          kind: "int",
          min: "max(3, x + d)",
          max: "5"
        },
        {
          name: "y",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "rws",
          kind: "int",
          min: "3",
          max: "4"
        }
      ],
      answer: "x + d",
      hint: "Read the number along the bottom the dot is standing on, then count on {d}.",
      figure: {
        kind: "grid",
        at: "x + ',' + y",
        columns: "cols",
        rows: "rws",
        onLines: "true"
      },
      tags: [
        "AC9M6SP02",
        "MA3-GM-01"
      ]
    },
    {
      id: "maths.6.position.move-back",
      subject: "maths",
      topic: "position",
      level: "6",
      prompt: "The dot has just moved {d} {sq} up. What was its y-coordinate before?",
      vars: [
        {
          name: "y",
          kind: "int",
          min: "2",
          max: "4"
        },
        {
          name: "d",
          kind: "int",
          min: "1",
          max: "2"
        },
        {
          name: "sq",
          kind: "expr",
          expr: "d == 1 ? 'square' : 'squares'"
        },
        {
          name: "x",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "cols",
          kind: "int",
          min: "max(3, x)",
          max: "5"
        },
        {
          name: "rws",
          kind: "int",
          min: "max(3, y)",
          max: "4"
        }
      ],
      answer: "y - d",
      hint: "Read the number up the side the dot is standing on, then count back {d}.",
      figure: {
        kind: "grid",
        at: "x + ',' + y",
        columns: "cols",
        rows: "rws",
        onLines: "true"
      },
      tags: [
        "AC9M6SP02",
        "MA3-GM-01"
      ]
    },
    {
      id: "maths.6.shapes.is-a-prism",
      subject: "maths",
      topic: "shapes",
      level: "6",
      prompt: "True or false: this shape is a prism.",
      vars: [
        {
          name: "prism",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "shape",
          kind: "expr",
          expr: "prism == 1 ? (i == 0 ? 'cube' : i == 1 ? 'cuboid' : 'triangular-prism') : (i == 0 ? 'square-pyramid' : i == 1 ? 'cone' : 'sphere')"
        }
      ],
      answer: "prism == 1",
      hint: "A prism has two matching ends joined by flat faces.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M6SP01",
        "MA3-3DS-01"
      ]
    },
    {
      id: "maths.6.shapes.cross-section",
      subject: "maths",
      topic: "shapes",
      level: "6",
      prompt: "This shape is cut straight across, parallel to its ends. What shape is the cut face?",
      vars: [
        {
          name: "shape",
          kind: "pick",
          from: [
            "cube",
            "triangular-prism",
            "cylinder"
          ]
        }
      ],
      answer: "shape == 'cube' ? 'square' : shape == 'triangular-prism' ? 'triangle' : 'circle'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'square'",
          "'triangle'",
          "'circle'"
        ]
      },
      hint: "The cut face is the same shape as the end you would look straight at.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'object'"
      },
      tags: [
        "AC9M6SP01",
        "MA3-3DS-01"
      ]
    },
    {
      id: "maths.6.shapes.net-is-a-prism",
      subject: "maths",
      topic: "shapes",
      level: "6",
      prompt: "True or false: this net folds up into a prism.",
      vars: [
        {
          name: "prism",
          kind: "pick",
          from: [
            1,
            0
          ]
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "j",
          kind: "int",
          min: "0",
          max: "1"
        },
        {
          name: "shape",
          kind: "expr",
          expr: "prism == 1 ? (i == 0 ? 'cube' : i == 1 ? 'cuboid' : 'triangular-prism') : (j == 0 ? 'square-pyramid' : 'cone')"
        }
      ],
      answer: "prism == 1",
      hint: "A prism folds up with two matching ends joined by flat faces.",
      figure: {
        kind: "solid",
        solid: "shape",
        view: "'net'"
      },
      tags: [
        "AC9M6SP01",
        "MA3-3DS-01"
      ]
    },
    {
      id: "maths.6.data.column-range",
      subject: "maths",
      topic: "data",
      level: "6",
      prompt: "What is the range of these scores?",
      vars: [
        {
          name: "rr",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "lo",
          kind: "int",
          min: "1",
          max: "5 - rr"
        },
        {
          name: "hi",
          kind: "expr",
          expr: "lo + rr"
        },
        {
          name: "p",
          kind: "int",
          min: "lo",
          max: "hi"
        },
        {
          name: "q",
          kind: "int",
          min: "lo",
          max: "hi"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "k",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "j",
          kind: "expr",
          expr: "mod(i + k, 4)"
        },
        {
          name: "v0",
          kind: "expr",
          expr: "i == 0 ? hi : j == 0 ? lo : p"
        },
        {
          name: "v1",
          kind: "expr",
          expr: "i == 1 ? hi : j == 1 ? lo : p"
        },
        {
          name: "v2",
          kind: "expr",
          expr: "i == 2 ? hi : j == 2 ? lo : q"
        },
        {
          name: "v3",
          kind: "expr",
          expr: "i == 3 ? hi : j == 3 ? lo : q"
        }
      ],
      answer: "rr * 10",
      hint: "The range is the highest score take away the lowest.",
      figure: {
        kind: "bar",
        values: "(v0 * 10) + ',' + (v1 * 10) + ',' + (v2 * 10) + ',' + (v3 * 10)",
        labels: "'Ada,Kai,Leo,Mia'",
        scale: "10",
        style: "'column'"
      },
      tags: [
        "AC9M6ST01",
        "MA3-DATA-02"
      ]
    },
    {
      id: "maths.6.data.column-mode",
      subject: "maths",
      topic: "data",
      level: "6",
      prompt: "Which pet is the mode?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "top",
          kind: "int",
          min: "3",
          max: "5"
        },
        {
          name: "a",
          kind: "int",
          min: "1",
          max: "top - 1"
        },
        {
          name: "b",
          kind: "int",
          min: "1",
          max: "top - 1"
        },
        {
          name: "c",
          kind: "int",
          min: "1",
          max: "top - 1"
        },
        {
          name: "d",
          kind: "int",
          min: "1",
          max: "top - 1"
        },
        {
          name: "v0",
          kind: "expr",
          expr: "i == 0 ? top : a"
        },
        {
          name: "v1",
          kind: "expr",
          expr: "i == 1 ? top : b"
        },
        {
          name: "v2",
          kind: "expr",
          expr: "i == 2 ? top : c"
        },
        {
          name: "v3",
          kind: "expr",
          expr: "i == 3 ? top : d"
        }
      ],
      answer: "i == 0 ? 'Cat' : i == 1 ? 'Dog' : i == 2 ? 'Rat' : 'Pig'",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "'Cat'",
          "'Dog'",
          "'Rat'",
          "'Pig'"
        ]
      },
      hint: "The mode is the one that comes up most often - the tallest column.",
      figure: {
        kind: "bar",
        values: "(v0 * 10) + ',' + (v1 * 10) + ',' + (v2 * 10) + ',' + (v3 * 10)",
        labels: "'Cat,Dog,Rat,Pig'",
        scale: "10",
        style: "'column'"
      },
      tags: [
        "AC9M6ST01",
        "MA3-DATA-02"
      ]
    },
    {
      id: "maths.6.data.line-graph-steepest",
      subject: "maths",
      topic: "data",
      level: "6",
      prompt: "Between which two days did the visitors rise the most?",
      vars: [
        {
          name: "g0",
          kind: "int",
          min: "-1",
          max: "2"
        },
        {
          name: "g1",
          kind: "int",
          min: "-1",
          max: "2"
        },
        {
          name: "g2",
          kind: "int",
          min: "-1",
          max: "2"
        },
        {
          name: "p1",
          kind: "expr",
          expr: "g0"
        },
        {
          name: "p2",
          kind: "expr",
          expr: "g0 + g1"
        },
        {
          name: "p3",
          kind: "expr",
          expr: "g0 + g1 + g2"
        },
        {
          name: "lo",
          kind: "expr",
          expr: "min(0, p1, p2, p3)"
        },
        {
          name: "hi",
          kind: "expr",
          expr: "max(0, p1, p2, p3)"
        },
        {
          name: "off",
          kind: "int",
          min: "0",
          max: "max(0, 4 - hi + lo)"
        },
        {
          name: "v0",
          kind: "expr",
          expr: "1 - lo + off"
        },
        {
          name: "v1",
          kind: "expr",
          expr: "v0 + g0"
        },
        {
          name: "v2",
          kind: "expr",
          expr: "v1 + g1"
        },
        {
          name: "v3",
          kind: "expr",
          expr: "v2 + g2"
        }
      ],
      constraints: [
        "max(g0, g1, g2) > 0",
        "(g0 > g1 && g0 > g2) || (g1 > g0 && g1 > g2) || (g2 > g0 && g2 > g1)"
      ],
      answer: "g0 > g1 && g0 > g2 ? 'Mon to Tue' : g1 > g2 ? 'Tue to Wed' : 'Wed to Thu'",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'Mon to Tue'",
          "'Tue to Wed'",
          "'Wed to Thu'"
        ]
      },
      hint: "The steepest climb on the line is the biggest rise.",
      figure: {
        kind: "bar",
        values: "(v0 * 10) + ',' + (v1 * 10) + ',' + (v2 * 10) + ',' + (v3 * 10)",
        labels: "'Mon,Tue,Wed,Thu'",
        scale: "10",
        style: "'line'"
      },
      tags: [
        "AC9M6ST01",
        "MA3-DATA-02"
      ]
    },
    {
      id: "maths.6.data.picture-key-total",
      subject: "maths",
      topic: "data",
      level: "6",
      prompt: "Each picture stands for 20 books. How many books did the three read altogether?",
      vars: [
        {
          name: "ha",
          kind: "int",
          min: "1",
          max: "8"
        },
        {
          name: "hb",
          kind: "int",
          min: "1",
          max: "8"
        },
        {
          name: "hc",
          kind: "int",
          min: "1",
          max: "8"
        }
      ],
      answer: "(ha + hb + hc) * 10",
      hint: "A whole picture is 20 books and half a picture is 10. Add the three rows.",
      figure: {
        kind: "pictograph",
        counts: "(ha * 10) + ',' + (hb * 10) + ',' + (hc * 10)",
        labels: "'Ada,Kai,Leo'",
        key: "20",
        halves: "true"
      },
      tags: [
        "AC9M6ST01",
        "MA3-DATA-01"
      ]
    },
    {
      id: "maths.6.chance.spinner-decimal",
      subject: "maths",
      topic: "chance",
      level: "6",
      prompt: "What is the chance of stopping on a shaded part, as a decimal?",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            5,
            10
          ]
        },
        {
          name: "s",
          kind: "int",
          min: "1",
          max: "n - 1"
        },
        {
          name: "parts",
          kind: "expr",
          expr: "n == 5 ? '1,1,1,1,1' : '1,1,1,1,1,1,1,1,1,1'"
        },
        {
          name: "shading",
          kind: "expr",
          expr: "n == 5 ? (s == 1 ? 'a,b,b,b,b' : s == 2 ? 'a,a,b,b,b' : s == 3 ? 'a,a,a,b,b' : s == 4 ? 'a,a,a,a,b' : 'a,a,a,a,a') : (s == 1 ? 'a,b,b,b,b,b,b,b,b,b' : s == 2 ? 'a,a,b,b,b,b,b,b,b,b' : s == 3 ? 'a,a,a,b,b,b,b,b,b,b' : s == 4 ? 'a,a,a,a,b,b,b,b,b,b' : s == 5 ? 'a,a,a,a,a,b,b,b,b,b' : s == 6 ? 'a,a,a,a,a,a,b,b,b,b' : s == 7 ? 'a,a,a,a,a,a,a,b,b,b' : s == 8 ? 'a,a,a,a,a,a,a,a,b,b' : s == 9 ? 'a,a,a,a,a,a,a,a,a,b' : 'a,a,a,a,a,a,a,a,a,a')"
        }
      ],
      answer: "s / n",
      hint: "Count the shaded parts, then all the parts, and divide.",
      figure: {
        kind: "spinner",
        sectors: "parts",
        fills: "shading"
      },
      tags: [
        "AC9M6P01",
        "MA3-CHAN-01"
      ]
    },
    {
      id: "maths.6.chance.spinner-not-shaded",
      subject: "maths",
      topic: "chance",
      level: "6",
      prompt: "What is the chance of not stopping on a shaded part, as a percentage?",
      vars: [
        {
          name: "n",
          kind: "pick",
          from: [
            4,
            5
          ]
        },
        {
          name: "s",
          kind: "int",
          min: "1",
          max: "n - 1"
        },
        {
          name: "parts",
          kind: "expr",
          expr: "n == 4 ? '1,1,1,1' : '1,1,1,1,1'"
        },
        {
          name: "shading",
          kind: "expr",
          expr: "n == 4 ? (s == 1 ? 'a,b,b,b' : s == 2 ? 'a,a,b,b' : s == 3 ? 'a,a,a,b' : 'a,a,a,a') : (s == 1 ? 'a,b,b,b,b' : s == 2 ? 'a,a,b,b,b' : s == 3 ? 'a,a,a,b,b' : s == 4 ? 'a,a,a,a,b' : 'a,a,a,a,a')"
        }
      ],
      answer: "(n - s) * 100 / n",
      hint: "The whole spinner is 100%. How much of it is left unshaded?",
      figure: {
        kind: "spinner",
        sectors: "parts",
        fills: "shading"
      },
      tags: [
        "AC9M6P01",
        "MA3-CHAN-01"
      ]
    },
    {
      id: "maths.6.chance.spinner-and-coin",
      subject: "maths",
      topic: "chance",
      level: "6",
      prompt: "You spin this spinner once and toss a coin. How many different results are there?",
      vars: [
        {
          name: "n",
          kind: "int",
          min: "3",
          max: "6"
        },
        {
          name: "parts",
          kind: "expr",
          expr: "n == 3 ? '1,1,1' : n == 4 ? '1,1,1,1' : n == 5 ? '1,1,1,1,1' : '1,1,1,1,1,1'"
        }
      ],
      answer: "n * 2",
      hint: "Every part of the spinner can come up with heads, or with tails.",
      figure: {
        kind: "spinner",
        sectors: "parts"
      },
      tags: [
        "AC9M6P01",
        "MA3-CHAN-01"
      ]
    }
  ]
};

// ../../src/content/packs/english.K.json
var english_K_default = {
  version: "104cbb947163",
  subject: "english",
  level: "K",
  templates: [
    {
      id: "english.K.letters-and-sounds.starts-with",
      subject: "english",
      topic: "letters and sounds",
      level: "K",
      prompt: "Which letter does {word} start with?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "7"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "7"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "7"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'cat' : i == 1 ? 'dog' : i == 2 ? 'sun' : i == 3 ? 'pig' : i == 4 ? 'bed' : i == 5 ? 'fish' : i == 6 ? 'moon' : 'ant'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'c' : i == 1 ? 'd' : i == 2 ? 's' : i == 3 ? 'p' : i == 4 ? 'b' : i == 5 ? 'f' : i == 6 ? 'm' : 'a'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 8 == 0 ? 'c' : (i + d1) % 8 == 1 ? 'd' : (i + d1) % 8 == 2 ? 's' : (i + d1) % 8 == 3 ? 'p' : (i + d1) % 8 == 4 ? 'b' : (i + d1) % 8 == 5 ? 'f' : (i + d1) % 8 == 6 ? 'm' : 'a'",
          "(i + d2) % 8 == 0 ? 'c' : (i + d2) % 8 == 1 ? 'd' : (i + d2) % 8 == 2 ? 's' : (i + d2) % 8 == 3 ? 'p' : (i + d2) % 8 == 4 ? 'b' : (i + d2) % 8 == 5 ? 'f' : (i + d2) % 8 == 6 ? 'm' : 'a'"
        ]
      },
      hint: "Say the word slowly. What sound do you hear first?",
      tags: [
        "AC9EFLY10",
        "ENE-PHOKW-01"
      ]
    },
    {
      id: "english.K.letters-and-sounds.ends-with",
      subject: "english",
      topic: "letters and sounds",
      level: "K",
      prompt: "Which letter does {word} end with?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "7"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "7"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "7"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'sun' : i == 1 ? 'dog' : i == 2 ? 'cup' : i == 3 ? 'bell' : i == 4 ? 'fish' : i == 5 ? 'web' : i == 6 ? 'jam' : 'box'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'n' : i == 1 ? 'g' : i == 2 ? 'p' : i == 3 ? 'l' : i == 4 ? 'h' : i == 5 ? 'b' : i == 6 ? 'm' : 'x'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 8 == 0 ? 'n' : (i + d1) % 8 == 1 ? 'g' : (i + d1) % 8 == 2 ? 'p' : (i + d1) % 8 == 3 ? 'l' : (i + d1) % 8 == 4 ? 'h' : (i + d1) % 8 == 5 ? 'b' : (i + d1) % 8 == 6 ? 'm' : 'x'",
          "(i + d2) % 8 == 0 ? 'n' : (i + d2) % 8 == 1 ? 'g' : (i + d2) % 8 == 2 ? 'p' : (i + d2) % 8 == 3 ? 'l' : (i + d2) % 8 == 4 ? 'h' : (i + d2) % 8 == 5 ? 'b' : (i + d2) % 8 == 6 ? 'm' : 'x'"
        ]
      },
      hint: "Say the word slowly. What sound do you hear last?",
      tags: [
        "AC9EFLY10",
        "ENE-PHOKW-01"
      ]
    },
    {
      id: "english.K.letters-and-sounds.middle-sound",
      subject: "english",
      topic: "letters and sounds",
      level: "K",
      prompt: "Which letter says the middle sound in {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'cat' : i == 1 ? 'hen' : i == 2 ? 'pig' : i == 3 ? 'dog' : 'cup'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'a' : i == 1 ? 'e' : i == 2 ? 'i' : i == 3 ? 'o' : 'u'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 5 == 0 ? 'a' : (i + d1) % 5 == 1 ? 'e' : (i + d1) % 5 == 2 ? 'i' : (i + d1) % 5 == 3 ? 'o' : 'u'",
          "(i + d2) % 5 == 0 ? 'a' : (i + d2) % 5 == 1 ? 'e' : (i + d2) % 5 == 2 ? 'i' : (i + d2) % 5 == 3 ? 'o' : 'u'"
        ]
      },
      hint: "Stretch the word out. What sound is in the middle?",
      tags: [
        "AC9EFLY10",
        "ENE-PHOKW-01"
      ]
    },
    {
      id: "english.K.letters-and-sounds.word-for-sound",
      subject: "english",
      topic: "letters and sounds",
      level: "K",
      prompt: "Which word starts with the same sound as {letter}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "7"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "7"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "7"
        },
        {
          name: "letter",
          kind: "expr",
          expr: "i == 0 ? 'c' : i == 1 ? 'd' : i == 2 ? 's' : i == 3 ? 'p' : i == 4 ? 'b' : i == 5 ? 'f' : i == 6 ? 'm' : 'a'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'cat' : i == 1 ? 'dog' : i == 2 ? 'sun' : i == 3 ? 'pig' : i == 4 ? 'bed' : i == 5 ? 'fish' : i == 6 ? 'moon' : 'ant'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 8 == 0 ? 'cat' : (i + d1) % 8 == 1 ? 'dog' : (i + d1) % 8 == 2 ? 'sun' : (i + d1) % 8 == 3 ? 'pig' : (i + d1) % 8 == 4 ? 'bed' : (i + d1) % 8 == 5 ? 'fish' : (i + d1) % 8 == 6 ? 'moon' : 'ant'",
          "(i + d2) % 8 == 0 ? 'cat' : (i + d2) % 8 == 1 ? 'dog' : (i + d2) % 8 == 2 ? 'sun' : (i + d2) % 8 == 3 ? 'pig' : (i + d2) % 8 == 4 ? 'bed' : (i + d2) % 8 == 5 ? 'fish' : (i + d2) % 8 == 6 ? 'moon' : 'ant'"
        ]
      },
      hint: "Say each word out loud and listen to the first sound.",
      tags: [
        "AC9EFLY13",
        "ENE-PHOKW-01"
      ]
    },
    {
      id: "english.K.letters-and-sounds.letter-count",
      subject: "english",
      topic: "letters and sounds",
      level: "K",
      prompt: "How many letters are in {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'cat' : i == 1 ? 'frog' : i == 2 ? 'apple' : i == 3 ? 'ox' : i == 4 ? 'sun' : 'rainbow'"
        }
      ],
      answer: "i == 0 ? 3 : i == 1 ? 4 : i == 2 ? 5 : i == 3 ? 2 : i == 4 ? 3 : 7",
      hint: "Point to each letter and count.",
      tags: [
        "AC9EFLY13",
        "ENE-PHOKW-01"
      ]
    },
    {
      id: "english.K.letters-and-sounds.alphabet-next",
      subject: "english",
      topic: "letters and sounds",
      level: "K",
      prompt: "Which letter comes right after {target} in the alphabet?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "6"
        },
        {
          name: "j1",
          kind: "int",
          min: "0",
          max: "7"
        },
        {
          name: "j2",
          kind: "int",
          min: "0",
          max: "7"
        },
        {
          name: "target",
          kind: "expr",
          expr: "i == 0 ? 'a' : i == 1 ? 'b' : i == 2 ? 'c' : i == 3 ? 'd' : i == 4 ? 'e' : i == 5 ? 'f' : i == 6 ? 'g' : 'h'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i + 1 == 0 ? 'a' : i + 1 == 1 ? 'b' : i + 1 == 2 ? 'c' : i + 1 == 3 ? 'd' : i + 1 == 4 ? 'e' : i + 1 == 5 ? 'f' : i + 1 == 6 ? 'g' : 'h'"
        }
      ],
      constraints: [
        "j1 != i + 1",
        "j2 != i + 1",
        "j1 != j2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "j1 == 0 ? 'a' : j1 == 1 ? 'b' : j1 == 2 ? 'c' : j1 == 3 ? 'd' : j1 == 4 ? 'e' : j1 == 5 ? 'f' : j1 == 6 ? 'g' : 'h'",
          "j2 == 0 ? 'a' : j2 == 1 ? 'b' : j2 == 2 ? 'c' : j2 == 3 ? 'd' : j2 == 4 ? 'e' : j2 == 5 ? 'f' : j2 == 6 ? 'g' : 'h'"
        ]
      },
      hint: "Say the alphabet from the start until you reach {target}.",
      tags: [
        "AC9EFLY13",
        "ENE-PHOKW-01"
      ]
    },
    {
      id: "english.K.rhyme.which-rhymes",
      subject: "english",
      topic: "rhyme",
      level: "K",
      prompt: "Which word rhymes with {target}?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "e1",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "e2",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "target",
          kind: "expr",
          expr: "f == 0 ? (t == 0 ? 'cat' : t == 1 ? 'hat' : t == 2 ? 'mat' : 'sat') : f == 1 ? (t == 0 ? 'dog' : t == 1 ? 'log' : t == 2 ? 'jog' : 'fog') : f == 2 ? (t == 0 ? 'pig' : t == 1 ? 'wig' : t == 2 ? 'dig' : 'fig') : (t == 0 ? 'sun' : t == 1 ? 'run' : t == 2 ? 'bun' : 'fun')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'cat' : a == 1 ? 'hat' : a == 2 ? 'mat' : 'sat') : f == 1 ? (a == 0 ? 'dog' : a == 1 ? 'log' : a == 2 ? 'jog' : 'fog') : f == 2 ? (a == 0 ? 'pig' : a == 1 ? 'wig' : a == 2 ? 'dig' : 'fig') : (a == 0 ? 'sun' : a == 1 ? 'run' : a == 2 ? 'bun' : 'fun')"
        }
      ],
      constraints: [
        "t != a",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 4 == 0 ? (e1 == 0 ? 'cat' : e1 == 1 ? 'hat' : e1 == 2 ? 'mat' : 'sat') : (f + d1) % 4 == 1 ? (e1 == 0 ? 'dog' : e1 == 1 ? 'log' : e1 == 2 ? 'jog' : 'fog') : (f + d1) % 4 == 2 ? (e1 == 0 ? 'pig' : e1 == 1 ? 'wig' : e1 == 2 ? 'dig' : 'fig') : (e1 == 0 ? 'sun' : e1 == 1 ? 'run' : e1 == 2 ? 'bun' : 'fun')",
          "(f + d2) % 4 == 0 ? (e2 == 0 ? 'cat' : e2 == 1 ? 'hat' : e2 == 2 ? 'mat' : 'sat') : (f + d2) % 4 == 1 ? (e2 == 0 ? 'dog' : e2 == 1 ? 'log' : e2 == 2 ? 'jog' : 'fog') : (f + d2) % 4 == 2 ? (e2 == 0 ? 'pig' : e2 == 1 ? 'wig' : e2 == 2 ? 'dig' : 'fig') : (e2 == 0 ? 'sun' : e2 == 1 ? 'run' : e2 == 2 ? 'bun' : 'fun')"
        ]
      },
      hint: "Say the words out loud. Rhyming words end with the same sound.",
      tags: [
        "AC9EFLY09",
        "ENE-PHOAW-01"
      ]
    },
    {
      id: "english.K.rhyme.finish-the-rhyme",
      subject: "english",
      topic: "rhyme",
      level: "K",
      prompt: "Finish the rhyme: {target} and ?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "e1",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "e2",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "target",
          kind: "expr",
          expr: "f == 0 ? (t == 0 ? 'cat' : t == 1 ? 'hat' : t == 2 ? 'mat' : 'sat') : f == 1 ? (t == 0 ? 'dog' : t == 1 ? 'log' : t == 2 ? 'jog' : 'fog') : f == 2 ? (t == 0 ? 'pig' : t == 1 ? 'wig' : t == 2 ? 'dig' : 'fig') : (t == 0 ? 'sun' : t == 1 ? 'run' : t == 2 ? 'bun' : 'fun')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'cat' : a == 1 ? 'hat' : a == 2 ? 'mat' : 'sat') : f == 1 ? (a == 0 ? 'dog' : a == 1 ? 'log' : a == 2 ? 'jog' : 'fog') : f == 2 ? (a == 0 ? 'pig' : a == 1 ? 'wig' : a == 2 ? 'dig' : 'fig') : (a == 0 ? 'sun' : a == 1 ? 'run' : a == 2 ? 'bun' : 'fun')"
        }
      ],
      constraints: [
        "t != a",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 4 == 0 ? (e1 == 0 ? 'cat' : e1 == 1 ? 'hat' : e1 == 2 ? 'mat' : 'sat') : (f + d1) % 4 == 1 ? (e1 == 0 ? 'dog' : e1 == 1 ? 'log' : e1 == 2 ? 'jog' : 'fog') : (f + d1) % 4 == 2 ? (e1 == 0 ? 'pig' : e1 == 1 ? 'wig' : e1 == 2 ? 'dig' : 'fig') : (e1 == 0 ? 'sun' : e1 == 1 ? 'run' : e1 == 2 ? 'bun' : 'fun')",
          "(f + d2) % 4 == 0 ? (e2 == 0 ? 'cat' : e2 == 1 ? 'hat' : e2 == 2 ? 'mat' : 'sat') : (f + d2) % 4 == 1 ? (e2 == 0 ? 'dog' : e2 == 1 ? 'log' : e2 == 2 ? 'jog' : 'fog') : (f + d2) % 4 == 2 ? (e2 == 0 ? 'pig' : e2 == 1 ? 'wig' : e2 == 2 ? 'dig' : 'fig') : (e2 == 0 ? 'sun' : e2 == 1 ? 'run' : e2 == 2 ? 'bun' : 'fun')"
        ]
      },
      hint: "Think of a word that ends with the same sound as {target}.",
      tags: [
        "AC9EFLY09",
        "ENE-PHOAW-01"
      ]
    },
    {
      id: "english.K.syllables.count-claps",
      subject: "english",
      topic: "syllables",
      level: "K",
      prompt: "How many claps are in {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "11"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'cat' : i == 1 ? 'dog' : i == 2 ? 'sun' : i == 3 ? 'pig' : i == 4 ? 'apple' : i == 5 ? 'garden' : i == 6 ? 'monkey' : i == 7 ? 'tiger' : i == 8 ? 'banana' : i == 9 ? 'elephant' : i == 10 ? 'umbrella' : 'butterfly'"
        }
      ],
      answer: "i <= 3 ? 1 : i <= 7 ? 2 : 3",
      hint: "Clap once for each part of the word.",
      tags: [
        "AC9EFLY09",
        "ENE-PHOAW-01"
      ]
    },
    {
      id: "english.K.syllables.count-parts",
      subject: "english",
      topic: "syllables",
      level: "K",
      prompt: "Break {word} into parts. How many parts does it have?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "11"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'cat' : i == 1 ? 'dog' : i == 2 ? 'sun' : i == 3 ? 'pig' : i == 4 ? 'apple' : i == 5 ? 'garden' : i == 6 ? 'monkey' : i == 7 ? 'tiger' : i == 8 ? 'banana' : i == 9 ? 'elephant' : i == 10 ? 'umbrella' : 'butterfly'"
        }
      ],
      answer: "i <= 3 ? 1 : i <= 7 ? 2 : 3",
      hint: "Say the word slowly and count the beats.",
      tags: [
        "AC9EFLY09",
        "ENE-PHOAW-01"
      ]
    },
    {
      id: "english.K.syllables.which-has-n",
      subject: "english",
      topic: "syllables",
      level: "K",
      prompt: "Which word has {n} claps?",
      vars: [
        {
          name: "fam",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "t1",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "t2",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "n",
          kind: "expr",
          expr: "fam + 1"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "fam == 0 ? (a == 0 ? 'cat' : a == 1 ? 'dog' : a == 2 ? 'sun' : 'pig') : fam == 1 ? (a == 0 ? 'apple' : a == 1 ? 'garden' : a == 2 ? 'monkey' : 'tiger') : (a == 0 ? 'banana' : a == 1 ? 'elephant' : a == 2 ? 'umbrella' : 'butterfly')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(fam + 1) % 3 == 0 ? (t1 == 0 ? 'cat' : t1 == 1 ? 'dog' : t1 == 2 ? 'sun' : 'pig') : (fam + 1) % 3 == 1 ? (t1 == 0 ? 'apple' : t1 == 1 ? 'garden' : t1 == 2 ? 'monkey' : 'tiger') : (t1 == 0 ? 'banana' : t1 == 1 ? 'elephant' : t1 == 2 ? 'umbrella' : 'butterfly')",
          "(fam + 2) % 3 == 0 ? (t2 == 0 ? 'cat' : t2 == 1 ? 'dog' : t2 == 2 ? 'sun' : 'pig') : (fam + 2) % 3 == 1 ? (t2 == 0 ? 'apple' : t2 == 1 ? 'garden' : t2 == 2 ? 'monkey' : 'tiger') : (t2 == 0 ? 'banana' : t2 == 1 ? 'elephant' : t2 == 2 ? 'umbrella' : 'butterfly')"
        ]
      },
      hint: "Clap each word out to count its parts.",
      tags: [
        "AC9EFLY09",
        "ENE-PHOAW-01"
      ]
    },
    {
      id: "english.K.opposites.which-opposite",
      subject: "english",
      topic: "opposites",
      level: "K",
      prompt: "What is the opposite of {target}?",
      vars: [
        {
          name: "p",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s2",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "s3",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? (p == 0 ? 'hot' : p == 1 ? 'big' : p == 2 ? 'up' : p == 3 ? 'fast' : p == 4 ? 'day' : 'wet') : (p == 0 ? 'cold' : p == 1 ? 'small' : p == 2 ? 'down' : p == 3 ? 'slow' : p == 4 ? 'night' : 'dry')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? (p == 0 ? 'hot' : p == 1 ? 'big' : p == 2 ? 'up' : p == 3 ? 'fast' : p == 4 ? 'day' : 'wet') : (p == 0 ? 'cold' : p == 1 ? 'small' : p == 2 ? 'down' : p == 3 ? 'slow' : p == 4 ? 'night' : 'dry')"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "s2 == 0 ? ((p + d1) % 6 == 0 ? 'hot' : (p + d1) % 6 == 1 ? 'big' : (p + d1) % 6 == 2 ? 'up' : (p + d1) % 6 == 3 ? 'fast' : (p + d1) % 6 == 4 ? 'day' : 'wet') : ((p + d1) % 6 == 0 ? 'cold' : (p + d1) % 6 == 1 ? 'small' : (p + d1) % 6 == 2 ? 'down' : (p + d1) % 6 == 3 ? 'slow' : (p + d1) % 6 == 4 ? 'night' : 'dry')",
          "s3 == 0 ? ((p + d2) % 6 == 0 ? 'hot' : (p + d2) % 6 == 1 ? 'big' : (p + d2) % 6 == 2 ? 'up' : (p + d2) % 6 == 3 ? 'fast' : (p + d2) % 6 == 4 ? 'day' : 'wet') : ((p + d2) % 6 == 0 ? 'cold' : (p + d2) % 6 == 1 ? 'small' : (p + d2) % 6 == 2 ? 'down' : (p + d2) % 6 == 3 ? 'slow' : (p + d2) % 6 == 4 ? 'night' : 'dry')"
        ]
      },
      hint: "An opposite means the total reverse.",
      tags: [
        "AC9EFLA08",
        "ENE-VOCAB-01"
      ]
    },
    {
      id: "english.K.opposites.opposite-of-two",
      subject: "english",
      topic: "opposites",
      level: "K",
      prompt: "Which word means the opposite of {target}?",
      vars: [
        {
          name: "p",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "sw",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? (p == 0 ? 'hot' : p == 1 ? 'big' : p == 2 ? 'up' : p == 3 ? 'fast' : p == 4 ? 'day' : 'wet') : (p == 0 ? 'cold' : p == 1 ? 'small' : p == 2 ? 'down' : p == 3 ? 'slow' : p == 4 ? 'night' : 'dry')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? (p == 0 ? 'hot' : p == 1 ? 'big' : p == 2 ? 'up' : p == 3 ? 'fast' : p == 4 ? 'day' : 'wet') : (p == 0 ? 'cold' : p == 1 ? 'small' : p == 2 ? 'down' : p == 3 ? 'slow' : p == 4 ? 'night' : 'dry')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "sw == 0 ? ((p + d) % 6 == 0 ? 'hot' : (p + d) % 6 == 1 ? 'big' : (p + d) % 6 == 2 ? 'up' : (p + d) % 6 == 3 ? 'fast' : (p + d) % 6 == 4 ? 'day' : 'wet') : ((p + d) % 6 == 0 ? 'cold' : (p + d) % 6 == 1 ? 'small' : (p + d) % 6 == 2 ? 'down' : (p + d) % 6 == 3 ? 'slow' : (p + d) % 6 == 4 ? 'night' : 'dry')"
        ]
      },
      hint: "Think of the total opposite of {target}.",
      tags: [
        "AC9EFLA08",
        "ENE-VOCAB-01"
      ]
    },
    {
      id: "english.K.opposites.worked-example",
      subject: "english",
      topic: "opposites",
      level: "K",
      prompt: "Here, {eTarget} and {eAnswer} are opposites. What is the opposite of {target}?",
      vars: [
        {
          name: "ep",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "es",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "p",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s2",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "s3",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "eTarget",
          kind: "expr",
          expr: "es == 0 ? (ep == 0 ? 'hot' : ep == 1 ? 'big' : ep == 2 ? 'up' : ep == 3 ? 'fast' : ep == 4 ? 'day' : 'wet') : (ep == 0 ? 'cold' : ep == 1 ? 'small' : ep == 2 ? 'down' : ep == 3 ? 'slow' : ep == 4 ? 'night' : 'dry')"
        },
        {
          name: "eAnswer",
          kind: "expr",
          expr: "1 - es == 0 ? (ep == 0 ? 'hot' : ep == 1 ? 'big' : ep == 2 ? 'up' : ep == 3 ? 'fast' : ep == 4 ? 'day' : 'wet') : (ep == 0 ? 'cold' : ep == 1 ? 'small' : ep == 2 ? 'down' : ep == 3 ? 'slow' : ep == 4 ? 'night' : 'dry')"
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? ((ep + p) % 6 == 0 ? 'hot' : (ep + p) % 6 == 1 ? 'big' : (ep + p) % 6 == 2 ? 'up' : (ep + p) % 6 == 3 ? 'fast' : (ep + p) % 6 == 4 ? 'day' : 'wet') : ((ep + p) % 6 == 0 ? 'cold' : (ep + p) % 6 == 1 ? 'small' : (ep + p) % 6 == 2 ? 'down' : (ep + p) % 6 == 3 ? 'slow' : (ep + p) % 6 == 4 ? 'night' : 'dry')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? ((ep + p) % 6 == 0 ? 'hot' : (ep + p) % 6 == 1 ? 'big' : (ep + p) % 6 == 2 ? 'up' : (ep + p) % 6 == 3 ? 'fast' : (ep + p) % 6 == 4 ? 'day' : 'wet') : ((ep + p) % 6 == 0 ? 'cold' : (ep + p) % 6 == 1 ? 'small' : (ep + p) % 6 == 2 ? 'down' : (ep + p) % 6 == 3 ? 'slow' : (ep + p) % 6 == 4 ? 'night' : 'dry')"
        }
      ],
      constraints: [
        "d1 != d2",
        "d1 != p",
        "d2 != p"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "s2 == 0 ? ((ep + d1) % 6 == 0 ? 'hot' : (ep + d1) % 6 == 1 ? 'big' : (ep + d1) % 6 == 2 ? 'up' : (ep + d1) % 6 == 3 ? 'fast' : (ep + d1) % 6 == 4 ? 'day' : 'wet') : ((ep + d1) % 6 == 0 ? 'cold' : (ep + d1) % 6 == 1 ? 'small' : (ep + d1) % 6 == 2 ? 'down' : (ep + d1) % 6 == 3 ? 'slow' : (ep + d1) % 6 == 4 ? 'night' : 'dry')",
          "s3 == 0 ? ((ep + d2) % 6 == 0 ? 'hot' : (ep + d2) % 6 == 1 ? 'big' : (ep + d2) % 6 == 2 ? 'up' : (ep + d2) % 6 == 3 ? 'fast' : (ep + d2) % 6 == 4 ? 'day' : 'wet') : ((ep + d2) % 6 == 0 ? 'cold' : (ep + d2) % 6 == 1 ? 'small' : (ep + d2) % 6 == 2 ? 'down' : (ep + d2) % 6 == 3 ? 'slow' : (ep + d2) % 6 == 4 ? 'night' : 'dry')"
        ]
      },
      hint: 'Use the example to see what "opposite" means.',
      tags: [
        "AC9EFLA08",
        "ENE-VOCAB-01"
      ]
    },
    {
      id: "english.K.sentences.starts-with-capital",
      subject: "english",
      topic: "sentences",
      level: "K",
      prompt: "Does this sentence start correctly? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "ok",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "i == 0 ? (ok == 1 ? 'The dog runs fast.' : 'the dog runs fast.') : i == 1 ? (ok == 1 ? 'A cat sleeps all day.' : 'a cat sleeps all day.') : i == 2 ? (ok == 1 ? 'My ball is red.' : 'my ball is red.') : i == 3 ? (ok == 1 ? 'We like the park.' : 'we like the park.') : i == 4 ? (ok == 1 ? 'She can jump high.' : 'she can jump high.') : (ok == 1 ? 'It is a sunny day.' : 'it is a sunny day.')"
        }
      ],
      answer: "ok == 1",
      hint: "A sentence always starts with a capital letter.",
      tags: [
        "AC9EFLA09",
        "ENE-CWT-01"
      ]
    },
    {
      id: "english.K.sentences.ends-with-full-stop",
      subject: "english",
      topic: "sentences",
      level: "K",
      prompt: "Does this sentence end correctly? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "ok",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "i == 0 ? (ok == 1 ? 'I like my dog.' : 'I like my dog') : i == 1 ? (ok == 1 ? 'The sun is hot.' : 'The sun is hot') : i == 2 ? (ok == 1 ? 'We play in the sand.' : 'We play in the sand') : i == 3 ? (ok == 1 ? 'She has a red hat.' : 'She has a red hat') : i == 4 ? (ok == 1 ? 'The bird can sing.' : 'The bird can sing') : (ok == 1 ? 'My mum reads to me.' : 'My mum reads to me')"
        }
      ],
      answer: "ok == 1",
      hint: "A telling sentence ends with a full stop.",
      tags: [
        "AC9EFLA09",
        "ENE-CWT-01"
      ]
    },
    {
      id: "english.K.sentences.is-a-sentence",
      subject: "english",
      topic: "sentences",
      level: "K",
      prompt: "Is this a whole sentence? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "ok",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "i == 0 ? (ok == 1 ? 'The little dog barks loudly.' : 'The little dog.') : i == 1 ? (ok == 1 ? 'My sister likes to draw.' : 'Likes to draw.') : i == 2 ? (ok == 1 ? 'We ran to the bus stop.' : 'To the bus stop.') : i == 3 ? (ok == 1 ? 'The cake smells so good.' : 'So good.') : i == 4 ? (ok == 1 ? 'A frog jumped into the pond.' : 'Into the pond.') : (ok == 1 ? 'Our teacher reads us a story.' : 'Reads us a story.')"
        }
      ],
      answer: "ok == 1",
      hint: "A whole sentence tells a complete idea.",
      tags: [
        "AC9EFLA09",
        "ENE-CWT-01"
      ]
    },
    {
      id: "english.K.sentences.is-a-question",
      subject: "english",
      topic: "sentences",
      level: "K",
      prompt: "Is this sentence asking a question? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "ok",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "i == 0 ? (ok == 1 ? 'Can you see the moon?' : 'You can see the moon.') : i == 1 ? (ok == 1 ? 'Is the cat asleep?' : 'The cat is asleep.') : i == 2 ? (ok == 1 ? 'Do dogs like to run?' : 'Dogs like to run.') : i == 3 ? (ok == 1 ? 'Will it rain today?' : 'It will rain today.') : i == 4 ? (ok == 1 ? 'Are we going to the park?' : 'We are going to the park.') : (ok == 1 ? 'Can birds fly high?' : 'Birds can fly high.')"
        }
      ],
      answer: "ok == 1",
      hint: "A question often starts with a word like Can, Is, Do or Will.",
      tags: [
        "AC9EFLA09",
        "ENE-CWT-01"
      ]
    },
    {
      id: "english.K.sentences.complete-with-noun",
      subject: "english",
      topic: "sentences",
      level: "K",
      prompt: "Which word finishes the sentence? {frame}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "frame",
          kind: "expr",
          expr: "i == 0 ? 'My pet ? can bark.' : i == 1 ? 'The furry ? can purr.' : i == 2 ? 'The bright ? is hot.' : i == 3 ? 'I kicked the round ? to my friend to play a game.' : i == 4 ? 'The little ? can fly high in the sky.' : 'The shiny ? blows bubbles under the water.'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'sun' : i == 3 ? 'ball' : i == 4 ? 'bird' : 'fish'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'dog' : (i + d1) % 6 == 1 ? 'cat' : (i + d1) % 6 == 2 ? 'sun' : (i + d1) % 6 == 3 ? 'ball' : (i + d1) % 6 == 4 ? 'bird' : 'fish'",
          "(i + d2) % 6 == 0 ? 'dog' : (i + d2) % 6 == 1 ? 'cat' : (i + d2) % 6 == 2 ? 'sun' : (i + d2) % 6 == 3 ? 'ball' : (i + d2) % 6 == 4 ? 'bird' : 'fish'"
        ]
      },
      hint: "Read the sentence and see which word makes sense.",
      tags: [
        "AC9EFLA09",
        "ENE-CWT-01"
      ]
    },
    {
      id: "english.K.sentences.complete-with-verb",
      subject: "english",
      topic: "sentences",
      level: "K",
      prompt: "Which word finishes the sentence? {frame}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "frame",
          kind: "expr",
          expr: "i == 0 ? 'The dog can ? fast on its four legs across the yard.' : i == 1 ? 'The bird can ? high in the sky.' : i == 2 ? 'The fish can ? well through the water.' : i == 3 ? 'The rabbit likes to ? around the garden on its back legs.' : i == 4 ? 'The baby likes to ? across the floor on hands and knees.' : 'The monkey can ? from branch to branch up the tall tree.'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'run' : i == 1 ? 'fly' : i == 2 ? 'swim' : i == 3 ? 'hop' : i == 4 ? 'crawl' : 'climb'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'run' : (i + d1) % 6 == 1 ? 'fly' : (i + d1) % 6 == 2 ? 'swim' : (i + d1) % 6 == 3 ? 'hop' : (i + d1) % 6 == 4 ? 'crawl' : 'climb'",
          "(i + d2) % 6 == 0 ? 'run' : (i + d2) % 6 == 1 ? 'fly' : (i + d2) % 6 == 2 ? 'swim' : (i + d2) % 6 == 3 ? 'hop' : (i + d2) % 6 == 4 ? 'crawl' : 'climb'"
        ]
      },
      hint: "Read the sentence and see which word makes sense.",
      tags: [
        "AC9EFLA09",
        "ENE-CWT-01"
      ]
    },
    {
      id: "english.K.sentences.complete-with-adjective",
      subject: "english",
      topic: "sentences",
      level: "K",
      prompt: "Which word finishes the sentence? {frame}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "frame",
          kind: "expr",
          expr: "i == 0 ? 'She smiled and laughed because she felt so ?.' : i == 1 ? 'His tummy rumbled because he was ?.' : i == 2 ? 'He yawned and rubbed his eyes because he was ?.' : i == 3 ? 'She put on a warm coat because it was ?.' : i == 4 ? 'The music was so ? that we covered our ears.' : 'The ? puppy hid behind the couch whenever visitors arrived.'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'happy' : i == 1 ? 'hungry' : i == 2 ? 'tired' : i == 3 ? 'cold' : i == 4 ? 'loud' : 'shy'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'happy' : (i + d1) % 6 == 1 ? 'hungry' : (i + d1) % 6 == 2 ? 'tired' : (i + d1) % 6 == 3 ? 'cold' : (i + d1) % 6 == 4 ? 'loud' : 'shy'",
          "(i + d2) % 6 == 0 ? 'happy' : (i + d2) % 6 == 1 ? 'hungry' : (i + d2) % 6 == 2 ? 'tired' : (i + d2) % 6 == 3 ? 'cold' : (i + d2) % 6 == 4 ? 'loud' : 'shy'"
        ]
      },
      hint: "Read the sentence and see which word makes sense.",
      tags: [
        "AC9EFLA09",
        "ENE-CWT-01"
      ]
    }
  ]
};

// ../../src/content/packs/english.1.json
var english_1_default = {
  version: "d32b6a1aca72",
  subject: "english",
  level: "1",
  templates: [
    {
      id: "english.1.letters-and-sounds.digraph-word",
      subject: "english",
      topic: "letters and sounds",
      level: "1",
      prompt: "Which word starts with the same two letters as {target}?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "e1",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "e2",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "target",
          kind: "expr",
          expr: "f == 0 ? (t == 0 ? 'ship' : t == 1 ? 'shop' : t == 2 ? 'shell' : t == 3 ? 'shed' : t == 4 ? 'shark' : 'sheep') : f == 1 ? (t == 0 ? 'chip' : t == 1 ? 'chin' : t == 2 ? 'chest' : t == 3 ? 'check' : t == 4 ? 'chill' : 'chomp') : f == 2 ? (t == 0 ? 'thin' : t == 1 ? 'thump' : t == 2 ? 'think' : t == 3 ? 'thud' : t == 4 ? 'thick' : 'thorn') : (t == 0 ? 'whale' : t == 1 ? 'wheel' : t == 2 ? 'whisk' : t == 3 ? 'whip' : t == 4 ? 'wheat' : 'white')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'ship' : a == 1 ? 'shop' : a == 2 ? 'shell' : a == 3 ? 'shed' : a == 4 ? 'shark' : 'sheep') : f == 1 ? (a == 0 ? 'chip' : a == 1 ? 'chin' : a == 2 ? 'chest' : a == 3 ? 'check' : a == 4 ? 'chill' : 'chomp') : f == 2 ? (a == 0 ? 'thin' : a == 1 ? 'thump' : a == 2 ? 'think' : a == 3 ? 'thud' : a == 4 ? 'thick' : 'thorn') : (a == 0 ? 'whale' : a == 1 ? 'wheel' : a == 2 ? 'whisk' : a == 3 ? 'whip' : a == 4 ? 'wheat' : 'white')"
        }
      ],
      constraints: [
        "t != a",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 4 == 0 ? (e1 == 0 ? 'ship' : e1 == 1 ? 'shop' : e1 == 2 ? 'shell' : e1 == 3 ? 'shed' : e1 == 4 ? 'shark' : 'sheep') : (f + d1) % 4 == 1 ? (e1 == 0 ? 'chip' : e1 == 1 ? 'chin' : e1 == 2 ? 'chest' : e1 == 3 ? 'check' : e1 == 4 ? 'chill' : 'chomp') : (f + d1) % 4 == 2 ? (e1 == 0 ? 'thin' : e1 == 1 ? 'thump' : e1 == 2 ? 'think' : e1 == 3 ? 'thud' : e1 == 4 ? 'thick' : 'thorn') : (e1 == 0 ? 'whale' : e1 == 1 ? 'wheel' : e1 == 2 ? 'whisk' : e1 == 3 ? 'whip' : e1 == 4 ? 'wheat' : 'white')",
          "(f + d2) % 4 == 0 ? (e2 == 0 ? 'ship' : e2 == 1 ? 'shop' : e2 == 2 ? 'shell' : e2 == 3 ? 'shed' : e2 == 4 ? 'shark' : 'sheep') : (f + d2) % 4 == 1 ? (e2 == 0 ? 'chip' : e2 == 1 ? 'chin' : e2 == 2 ? 'chest' : e2 == 3 ? 'check' : e2 == 4 ? 'chill' : 'chomp') : (f + d2) % 4 == 2 ? (e2 == 0 ? 'thin' : e2 == 1 ? 'thump' : e2 == 2 ? 'think' : e2 == 3 ? 'thud' : e2 == 4 ? 'thick' : 'thorn') : (e2 == 0 ? 'whale' : e2 == 1 ? 'wheel' : e2 == 2 ? 'whisk' : e2 == 3 ? 'whip' : e2 == 4 ? 'wheat' : 'white')"
        ]
      },
      hint: "Say the start of each word. Two letters together can make one sound.",
      tags: [
        "AC9E1LY11",
        "EN1-PHOKW-01"
      ]
    },
    {
      id: "english.1.letters-and-sounds.digraph-letters",
      subject: "english",
      topic: "letters and sounds",
      level: "1",
      prompt: "Which two letters does {word} start with?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "fd1",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "fd2",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "word",
          kind: "expr",
          expr: "f == 0 ? (i == 0 ? 'ship' : i == 1 ? 'shop' : i == 2 ? 'shell' : i == 3 ? 'shed' : i == 4 ? 'shark' : 'sheep') : f == 1 ? (i == 0 ? 'chip' : i == 1 ? 'chin' : i == 2 ? 'chest' : i == 3 ? 'check' : i == 4 ? 'chill' : 'chomp') : f == 2 ? (i == 0 ? 'thin' : i == 1 ? 'thump' : i == 2 ? 'think' : i == 3 ? 'thud' : i == 4 ? 'thick' : 'thorn') : (i == 0 ? 'whale' : i == 1 ? 'wheel' : i == 2 ? 'whisk' : i == 3 ? 'whip' : i == 4 ? 'wheat' : 'white')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? 'sh' : f == 1 ? 'ch' : f == 2 ? 'th' : 'wh'"
        }
      ],
      constraints: [
        "fd1 != fd2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + fd1) % 4 == 0 ? 'sh' : (f + fd1) % 4 == 1 ? 'ch' : (f + fd1) % 4 == 2 ? 'th' : 'wh'",
          "(f + fd2) % 4 == 0 ? 'sh' : (f + fd2) % 4 == 1 ? 'ch' : (f + fd2) % 4 == 2 ? 'th' : 'wh'"
        ]
      },
      hint: "Say the word slowly. What two letters make the first sound?",
      tags: [
        "AC9E1LY12",
        "EN1-PHOKW-01"
      ]
    },
    {
      id: "english.1.letters-and-sounds.blend-word",
      subject: "english",
      topic: "letters and sounds",
      level: "1",
      prompt: "Which word begins with the same blend as {target}?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "e1",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "e2",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "target",
          kind: "expr",
          expr: "f == 0 ? (t == 0 ? 'black' : t == 1 ? 'blob' : t == 2 ? 'block' : t == 3 ? 'blank' : t == 4 ? 'bloom' : 'blink') : f == 1 ? (t == 0 ? 'crab' : t == 1 ? 'crib' : t == 2 ? 'crop' : t == 3 ? 'cross' : t == 4 ? 'crown' : 'creek') : f == 2 ? (t == 0 ? 'stop' : t == 1 ? 'stamp' : t == 2 ? 'sting' : t == 3 ? 'stack' : t == 4 ? 'stone' : 'stump') : (t == 0 ? 'swim' : t == 1 ? 'swing' : t == 2 ? 'swan' : t == 3 ? 'sweep' : t == 4 ? 'sweet' : 'swift')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'black' : a == 1 ? 'blob' : a == 2 ? 'block' : a == 3 ? 'blank' : a == 4 ? 'bloom' : 'blink') : f == 1 ? (a == 0 ? 'crab' : a == 1 ? 'crib' : a == 2 ? 'crop' : a == 3 ? 'cross' : a == 4 ? 'crown' : 'creek') : f == 2 ? (a == 0 ? 'stop' : a == 1 ? 'stamp' : a == 2 ? 'sting' : a == 3 ? 'stack' : a == 4 ? 'stone' : 'stump') : (a == 0 ? 'swim' : a == 1 ? 'swing' : a == 2 ? 'swan' : a == 3 ? 'sweep' : a == 4 ? 'sweet' : 'swift')"
        }
      ],
      constraints: [
        "t != a",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 4 == 0 ? (e1 == 0 ? 'black' : e1 == 1 ? 'blob' : e1 == 2 ? 'block' : e1 == 3 ? 'blank' : e1 == 4 ? 'bloom' : 'blink') : (f + d1) % 4 == 1 ? (e1 == 0 ? 'crab' : e1 == 1 ? 'crib' : e1 == 2 ? 'crop' : e1 == 3 ? 'cross' : e1 == 4 ? 'crown' : 'creek') : (f + d1) % 4 == 2 ? (e1 == 0 ? 'stop' : e1 == 1 ? 'stamp' : e1 == 2 ? 'sting' : e1 == 3 ? 'stack' : e1 == 4 ? 'stone' : 'stump') : (e1 == 0 ? 'swim' : e1 == 1 ? 'swing' : e1 == 2 ? 'swan' : e1 == 3 ? 'sweep' : e1 == 4 ? 'sweet' : 'swift')",
          "(f + d2) % 4 == 0 ? (e2 == 0 ? 'black' : e2 == 1 ? 'blob' : e2 == 2 ? 'block' : e2 == 3 ? 'blank' : e2 == 4 ? 'bloom' : 'blink') : (f + d2) % 4 == 1 ? (e2 == 0 ? 'crab' : e2 == 1 ? 'crib' : e2 == 2 ? 'crop' : e2 == 3 ? 'cross' : e2 == 4 ? 'crown' : 'creek') : (f + d2) % 4 == 2 ? (e2 == 0 ? 'stop' : e2 == 1 ? 'stamp' : e2 == 2 ? 'sting' : e2 == 3 ? 'stack' : e2 == 4 ? 'stone' : 'stump') : (e2 == 0 ? 'swim' : e2 == 1 ? 'swing' : e2 == 2 ? 'swan' : e2 == 3 ? 'sweep' : e2 == 4 ? 'sweet' : 'swift')"
        ]
      },
      hint: "Say the start of each word. Two letters together can start a blend.",
      tags: [
        "AC9E1LY11",
        "EN1-PHOKW-01"
      ]
    },
    {
      id: "english.1.letters-and-sounds.alphabet-before",
      subject: "english",
      topic: "letters and sounds",
      level: "1",
      prompt: "Which letter comes right before {target} in the alphabet?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "1",
          max: "7"
        },
        {
          name: "j1",
          kind: "int",
          min: "0",
          max: "7"
        },
        {
          name: "j2",
          kind: "int",
          min: "0",
          max: "7"
        },
        {
          name: "target",
          kind: "expr",
          expr: "i == 0 ? 'i' : i == 1 ? 'j' : i == 2 ? 'k' : i == 3 ? 'l' : i == 4 ? 'm' : i == 5 ? 'n' : i == 6 ? 'o' : 'p'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i - 1 == 0 ? 'i' : i - 1 == 1 ? 'j' : i - 1 == 2 ? 'k' : i - 1 == 3 ? 'l' : i - 1 == 4 ? 'm' : i - 1 == 5 ? 'n' : i - 1 == 6 ? 'o' : 'p'"
        }
      ],
      constraints: [
        "j1 != i - 1",
        "j2 != i - 1",
        "j1 != j2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "j1 == 0 ? 'i' : j1 == 1 ? 'j' : j1 == 2 ? 'k' : j1 == 3 ? 'l' : j1 == 4 ? 'm' : j1 == 5 ? 'n' : j1 == 6 ? 'o' : 'p'",
          "j2 == 0 ? 'i' : j2 == 1 ? 'j' : j2 == 2 ? 'k' : j2 == 3 ? 'l' : j2 == 4 ? 'm' : j2 == 5 ? 'n' : j2 == 6 ? 'o' : 'p'"
        ]
      },
      hint: "Say the alphabet from the start and stop just before {target}.",
      tags: [
        "AC9E1LY12",
        "EN1-PHOKW-01"
      ]
    },
    {
      id: "english.1.rhyme.which-rhymes",
      subject: "english",
      topic: "rhyme",
      level: "1",
      prompt: "Which word rhymes with {target}?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "e1",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "e2",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "target",
          kind: "expr",
          expr: "f == 0 ? (t == 0 ? 'star' : t == 1 ? 'car' : t == 2 ? 'far' : t == 3 ? 'jar' : t == 4 ? 'bar' : 'tar') : f == 1 ? (t == 0 ? 'nest' : t == 1 ? 'best' : t == 2 ? 'rest' : t == 3 ? 'test' : t == 4 ? 'pest' : 'vest') : f == 2 ? (t == 0 ? 'clock' : t == 1 ? 'sock' : t == 2 ? 'rock' : t == 3 ? 'lock' : t == 4 ? 'dock' : 'block') : (t == 0 ? 'bee' : t == 1 ? 'tree' : t == 2 ? 'free' : t == 3 ? 'key' : t == 4 ? 'three' : 'see')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'star' : a == 1 ? 'car' : a == 2 ? 'far' : a == 3 ? 'jar' : a == 4 ? 'bar' : 'tar') : f == 1 ? (a == 0 ? 'nest' : a == 1 ? 'best' : a == 2 ? 'rest' : a == 3 ? 'test' : a == 4 ? 'pest' : 'vest') : f == 2 ? (a == 0 ? 'clock' : a == 1 ? 'sock' : a == 2 ? 'rock' : a == 3 ? 'lock' : a == 4 ? 'dock' : 'block') : (a == 0 ? 'bee' : a == 1 ? 'tree' : a == 2 ? 'free' : a == 3 ? 'key' : a == 4 ? 'three' : 'see')"
        }
      ],
      constraints: [
        "t != a",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 4 == 0 ? (e1 == 0 ? 'star' : e1 == 1 ? 'car' : e1 == 2 ? 'far' : e1 == 3 ? 'jar' : e1 == 4 ? 'bar' : 'tar') : (f + d1) % 4 == 1 ? (e1 == 0 ? 'nest' : e1 == 1 ? 'best' : e1 == 2 ? 'rest' : e1 == 3 ? 'test' : e1 == 4 ? 'pest' : 'vest') : (f + d1) % 4 == 2 ? (e1 == 0 ? 'clock' : e1 == 1 ? 'sock' : e1 == 2 ? 'rock' : e1 == 3 ? 'lock' : e1 == 4 ? 'dock' : 'block') : (e1 == 0 ? 'bee' : e1 == 1 ? 'tree' : e1 == 2 ? 'free' : e1 == 3 ? 'key' : e1 == 4 ? 'three' : 'see')",
          "(f + d2) % 4 == 0 ? (e2 == 0 ? 'star' : e2 == 1 ? 'car' : e2 == 2 ? 'far' : e2 == 3 ? 'jar' : e2 == 4 ? 'bar' : 'tar') : (f + d2) % 4 == 1 ? (e2 == 0 ? 'nest' : e2 == 1 ? 'best' : e2 == 2 ? 'rest' : e2 == 3 ? 'test' : e2 == 4 ? 'pest' : 'vest') : (f + d2) % 4 == 2 ? (e2 == 0 ? 'clock' : e2 == 1 ? 'sock' : e2 == 2 ? 'rock' : e2 == 3 ? 'lock' : e2 == 4 ? 'dock' : 'block') : (e2 == 0 ? 'bee' : e2 == 1 ? 'tree' : e2 == 2 ? 'free' : e2 == 3 ? 'key' : e2 == 4 ? 'three' : 'see')"
        ]
      },
      hint: "Say the words out loud. Rhyming words end with the same sound.",
      tags: [
        "AC9E1LE04",
        "EN1-PHOKW-01"
      ]
    },
    {
      id: "english.1.rhyme.finish-the-rhyme",
      subject: "english",
      topic: "rhyme",
      level: "1",
      prompt: "Finish the rhyme: {target} and ?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "e1",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "e2",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "target",
          kind: "expr",
          expr: "f == 0 ? (t == 0 ? 'star' : t == 1 ? 'car' : t == 2 ? 'far' : t == 3 ? 'jar' : t == 4 ? 'bar' : 'tar') : f == 1 ? (t == 0 ? 'nest' : t == 1 ? 'best' : t == 2 ? 'rest' : t == 3 ? 'test' : t == 4 ? 'pest' : 'vest') : f == 2 ? (t == 0 ? 'clock' : t == 1 ? 'sock' : t == 2 ? 'rock' : t == 3 ? 'lock' : t == 4 ? 'dock' : 'block') : (t == 0 ? 'bee' : t == 1 ? 'tree' : t == 2 ? 'free' : t == 3 ? 'key' : t == 4 ? 'three' : 'see')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'star' : a == 1 ? 'car' : a == 2 ? 'far' : a == 3 ? 'jar' : a == 4 ? 'bar' : 'tar') : f == 1 ? (a == 0 ? 'nest' : a == 1 ? 'best' : a == 2 ? 'rest' : a == 3 ? 'test' : a == 4 ? 'pest' : 'vest') : f == 2 ? (a == 0 ? 'clock' : a == 1 ? 'sock' : a == 2 ? 'rock' : a == 3 ? 'lock' : a == 4 ? 'dock' : 'block') : (a == 0 ? 'bee' : a == 1 ? 'tree' : a == 2 ? 'free' : a == 3 ? 'key' : a == 4 ? 'three' : 'see')"
        }
      ],
      constraints: [
        "t != a",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 4 == 0 ? (e1 == 0 ? 'star' : e1 == 1 ? 'car' : e1 == 2 ? 'far' : e1 == 3 ? 'jar' : e1 == 4 ? 'bar' : 'tar') : (f + d1) % 4 == 1 ? (e1 == 0 ? 'nest' : e1 == 1 ? 'best' : e1 == 2 ? 'rest' : e1 == 3 ? 'test' : e1 == 4 ? 'pest' : 'vest') : (f + d1) % 4 == 2 ? (e1 == 0 ? 'clock' : e1 == 1 ? 'sock' : e1 == 2 ? 'rock' : e1 == 3 ? 'lock' : e1 == 4 ? 'dock' : 'block') : (e1 == 0 ? 'bee' : e1 == 1 ? 'tree' : e1 == 2 ? 'free' : e1 == 3 ? 'key' : e1 == 4 ? 'three' : 'see')",
          "(f + d2) % 4 == 0 ? (e2 == 0 ? 'star' : e2 == 1 ? 'car' : e2 == 2 ? 'far' : e2 == 3 ? 'jar' : e2 == 4 ? 'bar' : 'tar') : (f + d2) % 4 == 1 ? (e2 == 0 ? 'nest' : e2 == 1 ? 'best' : e2 == 2 ? 'rest' : e2 == 3 ? 'test' : e2 == 4 ? 'pest' : 'vest') : (f + d2) % 4 == 2 ? (e2 == 0 ? 'clock' : e2 == 1 ? 'sock' : e2 == 2 ? 'rock' : e2 == 3 ? 'lock' : e2 == 4 ? 'dock' : 'block') : (e2 == 0 ? 'bee' : e2 == 1 ? 'tree' : e2 == 2 ? 'free' : e2 == 3 ? 'key' : e2 == 4 ? 'three' : 'see')"
        ]
      },
      hint: "Think of a word that ends with the same sound as {target}.",
      tags: [
        "AC9E1LE04",
        "EN1-PHOKW-01"
      ]
    },
    {
      id: "english.1.rhyme.rhymes-with-both",
      subject: "english",
      topic: "rhyme",
      level: "1",
      prompt: "Which word rhymes with both {target1} and {target2}?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "t1",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "t2",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "target1",
          kind: "expr",
          expr: "f == 0 ? (t1 == 0 ? 'star' : t1 == 1 ? 'car' : t1 == 2 ? 'far' : t1 == 3 ? 'jar' : t1 == 4 ? 'bar' : 'tar') : f == 1 ? (t1 == 0 ? 'nest' : t1 == 1 ? 'best' : t1 == 2 ? 'rest' : t1 == 3 ? 'test' : t1 == 4 ? 'pest' : 'vest') : f == 2 ? (t1 == 0 ? 'clock' : t1 == 1 ? 'sock' : t1 == 2 ? 'rock' : t1 == 3 ? 'lock' : t1 == 4 ? 'dock' : 'block') : (t1 == 0 ? 'bee' : t1 == 1 ? 'tree' : t1 == 2 ? 'free' : t1 == 3 ? 'key' : t1 == 4 ? 'three' : 'see')"
        },
        {
          name: "target2",
          kind: "expr",
          expr: "f == 0 ? (t2 == 0 ? 'star' : t2 == 1 ? 'car' : t2 == 2 ? 'far' : t2 == 3 ? 'jar' : t2 == 4 ? 'bar' : 'tar') : f == 1 ? (t2 == 0 ? 'nest' : t2 == 1 ? 'best' : t2 == 2 ? 'rest' : t2 == 3 ? 'test' : t2 == 4 ? 'pest' : 'vest') : f == 2 ? (t2 == 0 ? 'clock' : t2 == 1 ? 'sock' : t2 == 2 ? 'rock' : t2 == 3 ? 'lock' : t2 == 4 ? 'dock' : 'block') : (t2 == 0 ? 'bee' : t2 == 1 ? 'tree' : t2 == 2 ? 'free' : t2 == 3 ? 'key' : t2 == 4 ? 'three' : 'see')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'star' : a == 1 ? 'car' : a == 2 ? 'far' : a == 3 ? 'jar' : a == 4 ? 'bar' : 'tar') : f == 1 ? (a == 0 ? 'nest' : a == 1 ? 'best' : a == 2 ? 'rest' : a == 3 ? 'test' : a == 4 ? 'pest' : 'vest') : f == 2 ? (a == 0 ? 'clock' : a == 1 ? 'sock' : a == 2 ? 'rock' : a == 3 ? 'lock' : a == 4 ? 'dock' : 'block') : (a == 0 ? 'bee' : a == 1 ? 'tree' : a == 2 ? 'free' : a == 3 ? 'key' : a == 4 ? 'three' : 'see')"
        }
      ],
      constraints: [
        "t1 != t2",
        "a != t1",
        "a != t2",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 4 == 0 ? (t1 == 0 ? 'star' : t1 == 1 ? 'car' : t1 == 2 ? 'far' : t1 == 3 ? 'jar' : t1 == 4 ? 'bar' : 'tar') : (f + d1) % 4 == 1 ? (t1 == 0 ? 'nest' : t1 == 1 ? 'best' : t1 == 2 ? 'rest' : t1 == 3 ? 'test' : t1 == 4 ? 'pest' : 'vest') : (f + d1) % 4 == 2 ? (t1 == 0 ? 'clock' : t1 == 1 ? 'sock' : t1 == 2 ? 'rock' : t1 == 3 ? 'lock' : t1 == 4 ? 'dock' : 'block') : (t1 == 0 ? 'bee' : t1 == 1 ? 'tree' : t1 == 2 ? 'free' : t1 == 3 ? 'key' : t1 == 4 ? 'three' : 'see')",
          "(f + d2) % 4 == 0 ? (t2 == 0 ? 'star' : t2 == 1 ? 'car' : t2 == 2 ? 'far' : t2 == 3 ? 'jar' : t2 == 4 ? 'bar' : 'tar') : (f + d2) % 4 == 1 ? (t2 == 0 ? 'nest' : t2 == 1 ? 'best' : t2 == 2 ? 'rest' : t2 == 3 ? 'test' : t2 == 4 ? 'pest' : 'vest') : (f + d2) % 4 == 2 ? (t2 == 0 ? 'clock' : t2 == 1 ? 'sock' : t2 == 2 ? 'rock' : t2 == 3 ? 'lock' : t2 == 4 ? 'dock' : 'block') : (t2 == 0 ? 'bee' : t2 == 1 ? 'tree' : t2 == 2 ? 'free' : t2 == 3 ? 'key' : t2 == 4 ? 'three' : 'see')"
        ]
      },
      hint: "All the words in the family end with the same sound.",
      tags: [
        "AC9E1LE04",
        "EN1-PHOKW-01"
      ]
    },
    {
      id: "english.1.rhyme.worked-example",
      subject: "english",
      topic: "rhyme",
      level: "1",
      prompt: "Here, {eTarget} and {eAnswer} rhyme. Which word rhymes with {target}?",
      vars: [
        {
          name: "ef",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "et",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "ea",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "p",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "e1",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "e2",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "f",
          kind: "expr",
          expr: "(ef + p) % 4"
        },
        {
          name: "eTarget",
          kind: "expr",
          expr: "ef == 0 ? (et == 0 ? 'star' : et == 1 ? 'car' : et == 2 ? 'far' : et == 3 ? 'jar' : et == 4 ? 'bar' : 'tar') : ef == 1 ? (et == 0 ? 'nest' : et == 1 ? 'best' : et == 2 ? 'rest' : et == 3 ? 'test' : et == 4 ? 'pest' : 'vest') : ef == 2 ? (et == 0 ? 'clock' : et == 1 ? 'sock' : et == 2 ? 'rock' : et == 3 ? 'lock' : et == 4 ? 'dock' : 'block') : (et == 0 ? 'bee' : et == 1 ? 'tree' : et == 2 ? 'free' : et == 3 ? 'key' : et == 4 ? 'three' : 'see')"
        },
        {
          name: "eAnswer",
          kind: "expr",
          expr: "ef == 0 ? (ea == 0 ? 'star' : ea == 1 ? 'car' : ea == 2 ? 'far' : ea == 3 ? 'jar' : ea == 4 ? 'bar' : 'tar') : ef == 1 ? (ea == 0 ? 'nest' : ea == 1 ? 'best' : ea == 2 ? 'rest' : ea == 3 ? 'test' : ea == 4 ? 'pest' : 'vest') : ef == 2 ? (ea == 0 ? 'clock' : ea == 1 ? 'sock' : ea == 2 ? 'rock' : ea == 3 ? 'lock' : ea == 4 ? 'dock' : 'block') : (ea == 0 ? 'bee' : ea == 1 ? 'tree' : ea == 2 ? 'free' : ea == 3 ? 'key' : ea == 4 ? 'three' : 'see')"
        },
        {
          name: "target",
          kind: "expr",
          expr: "f == 0 ? (t == 0 ? 'star' : t == 1 ? 'car' : t == 2 ? 'far' : t == 3 ? 'jar' : t == 4 ? 'bar' : 'tar') : f == 1 ? (t == 0 ? 'nest' : t == 1 ? 'best' : t == 2 ? 'rest' : t == 3 ? 'test' : t == 4 ? 'pest' : 'vest') : f == 2 ? (t == 0 ? 'clock' : t == 1 ? 'sock' : t == 2 ? 'rock' : t == 3 ? 'lock' : t == 4 ? 'dock' : 'block') : (t == 0 ? 'bee' : t == 1 ? 'tree' : t == 2 ? 'free' : t == 3 ? 'key' : t == 4 ? 'three' : 'see')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'star' : a == 1 ? 'car' : a == 2 ? 'far' : a == 3 ? 'jar' : a == 4 ? 'bar' : 'tar') : f == 1 ? (a == 0 ? 'nest' : a == 1 ? 'best' : a == 2 ? 'rest' : a == 3 ? 'test' : a == 4 ? 'pest' : 'vest') : f == 2 ? (a == 0 ? 'clock' : a == 1 ? 'sock' : a == 2 ? 'rock' : a == 3 ? 'lock' : a == 4 ? 'dock' : 'block') : (a == 0 ? 'bee' : a == 1 ? 'tree' : a == 2 ? 'free' : a == 3 ? 'key' : a == 4 ? 'three' : 'see')"
        }
      ],
      constraints: [
        "et != ea",
        "t != a",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 4 == 0 ? (e1 == 0 ? 'star' : e1 == 1 ? 'car' : e1 == 2 ? 'far' : e1 == 3 ? 'jar' : e1 == 4 ? 'bar' : 'tar') : (f + d1) % 4 == 1 ? (e1 == 0 ? 'nest' : e1 == 1 ? 'best' : e1 == 2 ? 'rest' : e1 == 3 ? 'test' : e1 == 4 ? 'pest' : 'vest') : (f + d1) % 4 == 2 ? (e1 == 0 ? 'clock' : e1 == 1 ? 'sock' : e1 == 2 ? 'rock' : e1 == 3 ? 'lock' : e1 == 4 ? 'dock' : 'block') : (e1 == 0 ? 'bee' : e1 == 1 ? 'tree' : e1 == 2 ? 'free' : e1 == 3 ? 'key' : e1 == 4 ? 'three' : 'see')",
          "(f + d2) % 4 == 0 ? (e2 == 0 ? 'star' : e2 == 1 ? 'car' : e2 == 2 ? 'far' : e2 == 3 ? 'jar' : e2 == 4 ? 'bar' : 'tar') : (f + d2) % 4 == 1 ? (e2 == 0 ? 'nest' : e2 == 1 ? 'best' : e2 == 2 ? 'rest' : e2 == 3 ? 'test' : e2 == 4 ? 'pest' : 'vest') : (f + d2) % 4 == 2 ? (e2 == 0 ? 'clock' : e2 == 1 ? 'sock' : e2 == 2 ? 'rock' : e2 == 3 ? 'lock' : e2 == 4 ? 'dock' : 'block') : (e2 == 0 ? 'bee' : e2 == 1 ? 'tree' : e2 == 2 ? 'free' : e2 == 3 ? 'key' : e2 == 4 ? 'three' : 'see')"
        ]
      },
      hint: "Use the example to hear what sound you are listening for.",
      tags: [
        "AC9E1LE04",
        "EN1-PHOKW-01"
      ]
    },
    {
      id: "english.1.plurals.add-s",
      subject: "english",
      topic: "plurals",
      level: "1",
      prompt: "Write the plural of {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'cat' : i == 1 ? 'dog' : i == 2 ? 'hat' : i == 3 ? 'cup' : i == 4 ? 'pen' : 'bird'"
        }
      ],
      answer: "word + 's'",
      answerType: "text",
      hint: "Most words just add -s to become plural.",
      tags: [
        "AC9E1LY15",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.1.plurals.add-es",
      subject: "english",
      topic: "plurals",
      level: "1",
      prompt: "Write the plural of {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'box' : i == 1 ? 'bus' : i == 2 ? 'fox' : i == 3 ? 'dish' : i == 4 ? 'brush' : 'match'"
        }
      ],
      answer: "word + 'es'",
      answerType: "text",
      hint: "Words ending in s, x, ch or sh add -es to become plural.",
      tags: [
        "AC9E1LY15",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.1.plurals.which-is-plural",
      subject: "english",
      topic: "plurals",
      level: "1",
      prompt: "Which word means more than one {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'cat' : i == 1 ? 'box' : i == 2 ? 'dog' : i == 3 ? 'bus' : i == 4 ? 'hat' : 'fox'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'cats' : i == 1 ? 'boxes' : i == 2 ? 'dogs' : i == 3 ? 'buses' : i == 4 ? 'hats' : 'foxes'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'cats' : (i + d1) % 6 == 1 ? 'boxes' : (i + d1) % 6 == 2 ? 'dogs' : (i + d1) % 6 == 3 ? 'buses' : (i + d1) % 6 == 4 ? 'hats' : 'foxes'",
          "(i + d2) % 6 == 0 ? 'cats' : (i + d2) % 6 == 1 ? 'boxes' : (i + d2) % 6 == 2 ? 'dogs' : (i + d2) % 6 == 3 ? 'buses' : (i + d2) % 6 == 4 ? 'hats' : 'foxes'"
        ]
      },
      hint: "A plural word means more than one.",
      tags: [
        "AC9E1LY15",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.1.plurals.which-is-singular",
      subject: "english",
      topic: "plurals",
      level: "1",
      prompt: "Which word means just one, if {form} means more than one?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "form",
          kind: "expr",
          expr: "i == 0 ? 'cats' : i == 1 ? 'boxes' : i == 2 ? 'dogs' : i == 3 ? 'buses' : i == 4 ? 'hats' : 'foxes'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'cat' : i == 1 ? 'box' : i == 2 ? 'dog' : i == 3 ? 'bus' : i == 4 ? 'hat' : 'fox'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'cat' : (i + d1) % 6 == 1 ? 'box' : (i + d1) % 6 == 2 ? 'dog' : (i + d1) % 6 == 3 ? 'bus' : (i + d1) % 6 == 4 ? 'hat' : 'fox'",
          "(i + d2) % 6 == 0 ? 'cat' : (i + d2) % 6 == 1 ? 'box' : (i + d2) % 6 == 2 ? 'dog' : (i + d2) % 6 == 3 ? 'bus' : (i + d2) % 6 == 4 ? 'hat' : 'fox'"
        ]
      },
      hint: "Take away the -s or -es to find just one.",
      tags: [
        "AC9E1LY15",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.1.opposites.which-opposite",
      subject: "english",
      topic: "opposites",
      level: "1",
      prompt: "What is the opposite of {target}?",
      vars: [
        {
          name: "p",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s2",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "s3",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? (p == 0 ? 'happy' : p == 1 ? 'open' : p == 2 ? 'full' : p == 3 ? 'loud' : p == 4 ? 'early' : 'clean') : (p == 0 ? 'sad' : p == 1 ? 'shut' : p == 2 ? 'empty' : p == 3 ? 'quiet' : p == 4 ? 'late' : 'dirty')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? (p == 0 ? 'happy' : p == 1 ? 'open' : p == 2 ? 'full' : p == 3 ? 'loud' : p == 4 ? 'early' : 'clean') : (p == 0 ? 'sad' : p == 1 ? 'shut' : p == 2 ? 'empty' : p == 3 ? 'quiet' : p == 4 ? 'late' : 'dirty')"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "s2 == 0 ? ((p + d1) % 6 == 0 ? 'happy' : (p + d1) % 6 == 1 ? 'open' : (p + d1) % 6 == 2 ? 'full' : (p + d1) % 6 == 3 ? 'loud' : (p + d1) % 6 == 4 ? 'early' : 'clean') : ((p + d1) % 6 == 0 ? 'sad' : (p + d1) % 6 == 1 ? 'shut' : (p + d1) % 6 == 2 ? 'empty' : (p + d1) % 6 == 3 ? 'quiet' : (p + d1) % 6 == 4 ? 'late' : 'dirty')",
          "s3 == 0 ? ((p + d2) % 6 == 0 ? 'happy' : (p + d2) % 6 == 1 ? 'open' : (p + d2) % 6 == 2 ? 'full' : (p + d2) % 6 == 3 ? 'loud' : (p + d2) % 6 == 4 ? 'early' : 'clean') : ((p + d2) % 6 == 0 ? 'sad' : (p + d2) % 6 == 1 ? 'shut' : (p + d2) % 6 == 2 ? 'empty' : (p + d2) % 6 == 3 ? 'quiet' : (p + d2) % 6 == 4 ? 'late' : 'dirty')"
        ]
      },
      hint: "An opposite means the total reverse.",
      tags: [
        "AC9E1LA09",
        "EN1-VOCAB-01"
      ]
    },
    {
      id: "english.1.opposites.opposite-of-two",
      subject: "english",
      topic: "opposites",
      level: "1",
      prompt: "Which word means the opposite of {target}?",
      vars: [
        {
          name: "p",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "sw",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? (p == 0 ? 'happy' : p == 1 ? 'open' : p == 2 ? 'full' : p == 3 ? 'loud' : p == 4 ? 'early' : 'clean') : (p == 0 ? 'sad' : p == 1 ? 'shut' : p == 2 ? 'empty' : p == 3 ? 'quiet' : p == 4 ? 'late' : 'dirty')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? (p == 0 ? 'happy' : p == 1 ? 'open' : p == 2 ? 'full' : p == 3 ? 'loud' : p == 4 ? 'early' : 'clean') : (p == 0 ? 'sad' : p == 1 ? 'shut' : p == 2 ? 'empty' : p == 3 ? 'quiet' : p == 4 ? 'late' : 'dirty')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "sw == 0 ? ((p + d) % 6 == 0 ? 'happy' : (p + d) % 6 == 1 ? 'open' : (p + d) % 6 == 2 ? 'full' : (p + d) % 6 == 3 ? 'loud' : (p + d) % 6 == 4 ? 'early' : 'clean') : ((p + d) % 6 == 0 ? 'sad' : (p + d) % 6 == 1 ? 'shut' : (p + d) % 6 == 2 ? 'empty' : (p + d) % 6 == 3 ? 'quiet' : (p + d) % 6 == 4 ? 'late' : 'dirty')"
        ]
      },
      hint: "Think of the total opposite of {target}.",
      tags: [
        "AC9E1LA09",
        "EN1-VOCAB-01"
      ]
    },
    {
      id: "english.1.opposites.worked-example",
      subject: "english",
      topic: "opposites",
      level: "1",
      prompt: "Here, {eTarget} and {eAnswer} are opposites. What is the opposite of {target}?",
      vars: [
        {
          name: "ep",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "es",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "p",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s2",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "s3",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "eTarget",
          kind: "expr",
          expr: "es == 0 ? (ep == 0 ? 'happy' : ep == 1 ? 'open' : ep == 2 ? 'full' : ep == 3 ? 'loud' : ep == 4 ? 'early' : 'clean') : (ep == 0 ? 'sad' : ep == 1 ? 'shut' : ep == 2 ? 'empty' : ep == 3 ? 'quiet' : ep == 4 ? 'late' : 'dirty')"
        },
        {
          name: "eAnswer",
          kind: "expr",
          expr: "1 - es == 0 ? (ep == 0 ? 'happy' : ep == 1 ? 'open' : ep == 2 ? 'full' : ep == 3 ? 'loud' : ep == 4 ? 'early' : 'clean') : (ep == 0 ? 'sad' : ep == 1 ? 'shut' : ep == 2 ? 'empty' : ep == 3 ? 'quiet' : ep == 4 ? 'late' : 'dirty')"
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? ((ep + p) % 6 == 0 ? 'happy' : (ep + p) % 6 == 1 ? 'open' : (ep + p) % 6 == 2 ? 'full' : (ep + p) % 6 == 3 ? 'loud' : (ep + p) % 6 == 4 ? 'early' : 'clean') : ((ep + p) % 6 == 0 ? 'sad' : (ep + p) % 6 == 1 ? 'shut' : (ep + p) % 6 == 2 ? 'empty' : (ep + p) % 6 == 3 ? 'quiet' : (ep + p) % 6 == 4 ? 'late' : 'dirty')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? ((ep + p) % 6 == 0 ? 'happy' : (ep + p) % 6 == 1 ? 'open' : (ep + p) % 6 == 2 ? 'full' : (ep + p) % 6 == 3 ? 'loud' : (ep + p) % 6 == 4 ? 'early' : 'clean') : ((ep + p) % 6 == 0 ? 'sad' : (ep + p) % 6 == 1 ? 'shut' : (ep + p) % 6 == 2 ? 'empty' : (ep + p) % 6 == 3 ? 'quiet' : (ep + p) % 6 == 4 ? 'late' : 'dirty')"
        }
      ],
      constraints: [
        "d1 != d2",
        "d1 != p",
        "d2 != p"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "s2 == 0 ? ((ep + d1) % 6 == 0 ? 'happy' : (ep + d1) % 6 == 1 ? 'open' : (ep + d1) % 6 == 2 ? 'full' : (ep + d1) % 6 == 3 ? 'loud' : (ep + d1) % 6 == 4 ? 'early' : 'clean') : ((ep + d1) % 6 == 0 ? 'sad' : (ep + d1) % 6 == 1 ? 'shut' : (ep + d1) % 6 == 2 ? 'empty' : (ep + d1) % 6 == 3 ? 'quiet' : (ep + d1) % 6 == 4 ? 'late' : 'dirty')",
          "s3 == 0 ? ((ep + d2) % 6 == 0 ? 'happy' : (ep + d2) % 6 == 1 ? 'open' : (ep + d2) % 6 == 2 ? 'full' : (ep + d2) % 6 == 3 ? 'loud' : (ep + d2) % 6 == 4 ? 'early' : 'clean') : ((ep + d2) % 6 == 0 ? 'sad' : (ep + d2) % 6 == 1 ? 'shut' : (ep + d2) % 6 == 2 ? 'empty' : (ep + d2) % 6 == 3 ? 'quiet' : (ep + d2) % 6 == 4 ? 'late' : 'dirty')"
        ]
      },
      hint: 'Use the example to see what "opposite" means.',
      tags: [
        "AC9E1LA09",
        "EN1-VOCAB-01"
      ]
    },
    {
      id: "english.1.opposites.write-opposite",
      subject: "english",
      topic: "opposites",
      level: "1",
      prompt: "Write the opposite of {target}.",
      vars: [
        {
          name: "p",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? (p == 0 ? 'happy' : p == 1 ? 'open' : p == 2 ? 'full' : p == 3 ? 'loud' : p == 4 ? 'early' : 'clean') : (p == 0 ? 'sad' : p == 1 ? 'shut' : p == 2 ? 'empty' : p == 3 ? 'quiet' : p == 4 ? 'late' : 'dirty')"
        }
      ],
      answer: "1 - s == 0 ? (p == 0 ? 'happy' : p == 1 ? 'open' : p == 2 ? 'full' : p == 3 ? 'loud' : p == 4 ? 'early' : 'clean') : (p == 0 ? 'sad' : p == 1 ? 'shut' : p == 2 ? 'empty' : p == 3 ? 'quiet' : p == 4 ? 'late' : 'dirty')",
      answerType: "text",
      hint: "An opposite means the total reverse.",
      tags: [
        "AC9E1LA09",
        "EN1-VOCAB-01"
      ]
    },
    {
      id: "english.1.opposites.write-opposite-worked-example",
      subject: "english",
      topic: "opposites",
      level: "1",
      prompt: "Here, {eTarget} and {eAnswer} are opposites. Write the opposite of {target}.",
      vars: [
        {
          name: "ep",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "es",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "p",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "eTarget",
          kind: "expr",
          expr: "es == 0 ? (ep == 0 ? 'happy' : ep == 1 ? 'open' : ep == 2 ? 'full' : ep == 3 ? 'loud' : ep == 4 ? 'early' : 'clean') : (ep == 0 ? 'sad' : ep == 1 ? 'shut' : ep == 2 ? 'empty' : ep == 3 ? 'quiet' : ep == 4 ? 'late' : 'dirty')"
        },
        {
          name: "eAnswer",
          kind: "expr",
          expr: "1 - es == 0 ? (ep == 0 ? 'happy' : ep == 1 ? 'open' : ep == 2 ? 'full' : ep == 3 ? 'loud' : ep == 4 ? 'early' : 'clean') : (ep == 0 ? 'sad' : ep == 1 ? 'shut' : ep == 2 ? 'empty' : ep == 3 ? 'quiet' : ep == 4 ? 'late' : 'dirty')"
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? ((ep + p) % 6 == 0 ? 'happy' : (ep + p) % 6 == 1 ? 'open' : (ep + p) % 6 == 2 ? 'full' : (ep + p) % 6 == 3 ? 'loud' : (ep + p) % 6 == 4 ? 'early' : 'clean') : ((ep + p) % 6 == 0 ? 'sad' : (ep + p) % 6 == 1 ? 'shut' : (ep + p) % 6 == 2 ? 'empty' : (ep + p) % 6 == 3 ? 'quiet' : (ep + p) % 6 == 4 ? 'late' : 'dirty')"
        }
      ],
      answer: "1 - s == 0 ? ((ep + p) % 6 == 0 ? 'happy' : (ep + p) % 6 == 1 ? 'open' : (ep + p) % 6 == 2 ? 'full' : (ep + p) % 6 == 3 ? 'loud' : (ep + p) % 6 == 4 ? 'early' : 'clean') : ((ep + p) % 6 == 0 ? 'sad' : (ep + p) % 6 == 1 ? 'shut' : (ep + p) % 6 == 2 ? 'empty' : (ep + p) % 6 == 3 ? 'quiet' : (ep + p) % 6 == 4 ? 'late' : 'dirty')",
      answerType: "text",
      hint: 'Use the example to see what "opposite" means.',
      tags: [
        "AC9E1LA09",
        "EN1-VOCAB-01"
      ]
    },
    {
      id: "english.1.word-classes.naming-or-doing",
      subject: "english",
      topic: "word classes",
      level: "1",
      prompt: "Which word in this sentence is the {kind}? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "asksVerb",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "'The ' + (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'fish' : i == 4 ? 'frog' : 'rabbit') + ' can ' + (i == 0 ? 'run' : i == 1 ? 'swim' : i == 2 ? 'fly' : i == 3 ? 'dart' : i == 4 ? 'hop' : 'dig') + '.'"
        },
        {
          name: "kind",
          kind: "expr",
          expr: "asksVerb == 1 ? 'doing word' : 'naming word'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "asksVerb == 1 ? (i == 0 ? 'run' : i == 1 ? 'swim' : i == 2 ? 'fly' : i == 3 ? 'dart' : i == 4 ? 'hop' : 'dig') : (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'fish' : i == 4 ? 'frog' : 'rabbit')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - asksVerb == 1 ? (i == 0 ? 'run' : i == 1 ? 'swim' : i == 2 ? 'fly' : i == 3 ? 'dart' : i == 4 ? 'hop' : 'dig') : (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'fish' : i == 4 ? 'frog' : 'rabbit')"
        ]
      },
      hint: "The naming word names something. The doing word tells you what it does.",
      tags: [
        "AC9E1LA07",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.1.word-classes.is-doing-word",
      subject: "english",
      topic: "word classes",
      level: "1",
      prompt: "Is {word} a doing word?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "19"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'ball' : i == 4 ? 'sock' : i == 5 ? 'chair' : i == 6 ? 'table' : i == 7 ? 'apple' : i == 8 ? 'house' : i == 9 ? 'tree' : i == 10 ? 'run' : i == 11 ? 'jump' : i == 12 ? 'swim' : i == 13 ? 'sing' : i == 14 ? 'read' : i == 15 ? 'write' : i == 16 ? 'sleep' : i == 17 ? 'hop' : i == 18 ? 'skip' : 'dance'"
        }
      ],
      answer: "i >= 10",
      hint: "A doing word tells you what someone or something does.",
      tags: [
        "AC9E1LA07",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.1.word-classes.naming-word-in-context",
      subject: "english",
      topic: "word classes",
      level: "1",
      prompt: "Is {candidate} a naming word in this sentence? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "askVerb",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "objPick",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "role",
          kind: "expr",
          expr: "askVerb == 1 ? 1 : (objPick == 1 ? 2 : 0)"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "'The ' + (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'frog' : i == 4 ? 'rabbit' : 'mouse') + ' can ' + (i == 0 ? 'chase' : i == 1 ? 'catch' : i == 2 ? 'watch' : i == 3 ? 'follow' : i == 4 ? 'find' : 'see') + ' the ' + (i == 0 ? 'ball' : i == 1 ? 'bug' : i == 2 ? 'kite' : i == 3 ? 'worm' : i == 4 ? 'leaf' : 'stick') + '.'"
        },
        {
          name: "candidate",
          kind: "expr",
          expr: "role == 1 ? (i == 0 ? 'chase' : i == 1 ? 'catch' : i == 2 ? 'watch' : i == 3 ? 'follow' : i == 4 ? 'find' : 'see') : role == 2 ? (i == 0 ? 'ball' : i == 1 ? 'bug' : i == 2 ? 'kite' : i == 3 ? 'worm' : i == 4 ? 'leaf' : 'stick') : (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'frog' : i == 4 ? 'rabbit' : 'mouse')"
        }
      ],
      answer: "role != 1",
      hint: "A naming word names a person, animal or thing.",
      tags: [
        "AC9E1LA07",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.1.word-classes.is-doing-word-in-sentence",
      subject: "english",
      topic: "word classes",
      level: "1",
      prompt: "Is {candidate} the doing word in this sentence? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "ok",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "'The ' + (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'fish' : i == 4 ? 'frog' : 'rabbit') + ' can ' + (i == 0 ? 'run' : i == 1 ? 'swim' : i == 2 ? 'fly' : i == 3 ? 'dart' : i == 4 ? 'hop' : 'dig') + '.'"
        },
        {
          name: "candidate",
          kind: "expr",
          expr: "ok == 1 ? (i == 0 ? 'run' : i == 1 ? 'swim' : i == 2 ? 'fly' : i == 3 ? 'dart' : i == 4 ? 'hop' : 'dig') : (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'fish' : i == 4 ? 'frog' : 'rabbit')"
        }
      ],
      answer: "ok == 1",
      hint: "The doing word tells you what the naming word can do.",
      tags: [
        "AC9E1LA07",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.1.sentences.name-capital",
      subject: "english",
      topic: "sentences",
      level: "1",
      prompt: "Does this sentence use a capital letter correctly for the name? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "ok",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "i == 0 ? (ok == 1 ? 'I played with Tom today.' : 'I played with tom today.') : i == 1 ? (ok == 1 ? 'We visited Ben at his house.' : 'We visited ben at his house.') : i == 2 ? (ok == 1 ? 'I saw Sam at the shop.' : 'I saw sam at the shop.') : i == 3 ? (ok == 1 ? 'My friend Amy can swim.' : 'My friend amy can swim.') : i == 4 ? (ok == 1 ? 'Our dog likes Zoe the best.' : 'Our dog likes zoe the best.') : (ok == 1 ? 'I gave Max a big hug.' : 'I gave max a big hug.')"
        }
      ],
      answer: "ok == 1",
      hint: "A person's name always starts with a capital letter.",
      tags: [
        "AC9E1LA10",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.1.sentences.a-or-an-in-sentence",
      subject: "english",
      topic: "sentences",
      level: "1",
      prompt: "Does this sentence use 'a' or 'an' correctly? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "9"
        },
        {
          name: "ok",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "i == 0 ? (ok == 1 ? 'I saw an elephant.' : 'I saw a elephant.') : i == 1 ? (ok == 1 ? 'She ate an apple.' : 'She ate a apple.') : i == 2 ? (ok == 1 ? 'He picked an orange.' : 'He picked a orange.') : i == 3 ? (ok == 1 ? 'I have an umbrella.' : 'I have a umbrella.') : i == 4 ? (ok == 1 ? 'There is an ant.' : 'There is a ant.') : i == 5 ? (ok == 1 ? 'I saw a dog.' : 'I saw an dog.') : i == 6 ? (ok == 1 ? 'She has a cat.' : 'She has an cat.') : i == 7 ? (ok == 1 ? 'He kicked a ball.' : 'He kicked an ball.') : i == 8 ? (ok == 1 ? 'We live in a house.' : 'We live in an house.') : (ok == 1 ? 'I ate a banana.' : 'I ate an banana.')"
        }
      ],
      answer: "ok == 1",
      hint: "Use 'an' before a word that starts with a vowel sound.",
      tags: [
        "AC9E1LA10",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.1.sentences.a-or-an",
      subject: "english",
      topic: "sentences",
      level: "1",
      prompt: "Which word finishes the sentence? {frame}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "9"
        },
        {
          name: "frame",
          kind: "expr",
          expr: "i == 0 ? 'I saw ? elephant at the zoo.' : i == 1 ? 'She ate ? apple for lunch.' : i == 2 ? 'He picked ? orange from the tree.' : i == 3 ? 'I opened ? umbrella in the rain.' : i == 4 ? 'There is ? ant on the table.' : i == 5 ? 'I saw ? dog in the park.' : i == 6 ? 'She has ? cat at home.' : i == 7 ? 'He kicked ? ball across the yard.' : i == 8 ? 'We live in ? house on the hill.' : 'I ate ? banana for lunch.'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'an' : i == 1 ? 'an' : i == 2 ? 'an' : i == 3 ? 'an' : i == 4 ? 'an' : i == 5 ? 'a' : i == 6 ? 'a' : i == 7 ? 'a' : i == 8 ? 'a' : 'a'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "(i == 0 ? 'an' : i == 1 ? 'an' : i == 2 ? 'an' : i == 3 ? 'an' : i == 4 ? 'an' : i == 5 ? 'a' : i == 6 ? 'a' : i == 7 ? 'a' : i == 8 ? 'a' : 'a') == 'a' ? 'an' : 'a'"
        ]
      },
      hint: "Use 'an' before a word that starts with a vowel sound.",
      tags: [
        "AC9E1LA10",
        "EN1-CWT-01"
      ]
    }
  ]
};

// ../../src/content/packs/english.2.json
var english_2_default = {
  version: "8d7f7d44373c",
  subject: "english",
  level: "2",
  templates: [
    {
      id: "english.2.plurals.add-ies",
      subject: "english",
      topic: "plurals",
      level: "2",
      prompt: "Write the plural of {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "stem",
          kind: "expr",
          expr: "i == 0 ? 'bab' : i == 1 ? 'cit' : i == 2 ? 'lad' : i == 3 ? 'part' : i == 4 ? 'pupp' : 'famil'"
        },
        {
          name: "word",
          kind: "expr",
          expr: "stem + 'y'"
        }
      ],
      answer: "stem + 'ies'",
      answerType: "text",
      hint: "Change the y to an i and add -es.",
      tags: [
        "AC9E2LY12",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.plurals.add-ves",
      subject: "english",
      topic: "plurals",
      level: "2",
      prompt: "Write the plural of {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "stem",
          kind: "expr",
          expr: "i == 0 ? 'lea' : i == 1 ? 'loa' : i == 2 ? 'shel' : i == 3 ? 'wol' : i == 4 ? 'scar' : 'cal'"
        },
        {
          name: "word",
          kind: "expr",
          expr: "stem + 'f'"
        }
      ],
      answer: "stem + 'ves'",
      answerType: "text",
      hint: "Change the f to v and add -es.",
      tags: [
        "AC9E2LY12",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.plurals.which-is-plural",
      subject: "english",
      topic: "plurals",
      level: "2",
      prompt: "Which word means more than one {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'baby' : i == 1 ? 'city' : i == 2 ? 'lady' : i == 3 ? 'leaf' : i == 4 ? 'wolf' : 'shelf'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'babies' : i == 1 ? 'cities' : i == 2 ? 'ladies' : i == 3 ? 'leaves' : i == 4 ? 'wolves' : 'shelves'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'babies' : (i + d1) % 6 == 1 ? 'cities' : (i + d1) % 6 == 2 ? 'ladies' : (i + d1) % 6 == 3 ? 'leaves' : (i + d1) % 6 == 4 ? 'wolves' : 'shelves'",
          "(i + d2) % 6 == 0 ? 'babies' : (i + d2) % 6 == 1 ? 'cities' : (i + d2) % 6 == 2 ? 'ladies' : (i + d2) % 6 == 3 ? 'leaves' : (i + d2) % 6 == 4 ? 'wolves' : 'shelves'"
        ]
      },
      hint: "A plural word means more than one.",
      tags: [
        "AC9E2LY12",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.plurals.which-is-singular",
      subject: "english",
      topic: "plurals",
      level: "2",
      prompt: "Which word means just one, if {form} means more than one?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "form",
          kind: "expr",
          expr: "i == 0 ? 'babies' : i == 1 ? 'cities' : i == 2 ? 'ladies' : i == 3 ? 'leaves' : i == 4 ? 'wolves' : 'shelves'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'baby' : i == 1 ? 'city' : i == 2 ? 'lady' : i == 3 ? 'leaf' : i == 4 ? 'wolf' : 'shelf'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'baby' : (i + d1) % 6 == 1 ? 'city' : (i + d1) % 6 == 2 ? 'lady' : (i + d1) % 6 == 3 ? 'leaf' : (i + d1) % 6 == 4 ? 'wolf' : 'shelf'",
          "(i + d2) % 6 == 0 ? 'baby' : (i + d2) % 6 == 1 ? 'city' : (i + d2) % 6 == 2 ? 'lady' : (i + d2) % 6 == 3 ? 'leaf' : (i + d2) % 6 == 4 ? 'wolf' : 'shelf'"
        ]
      },
      hint: "Take away the plural ending to find just one.",
      tags: [
        "AC9E2LY12",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.past-tense.write-past-tense",
      subject: "english",
      topic: "past tense",
      level: "2",
      prompt: "Write the past tense of {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'jump' : i == 1 ? 'walk' : i == 2 ? 'play' : i == 3 ? 'look' : i == 4 ? 'call' : 'wash'"
        }
      ],
      answer: "word + 'ed'",
      answerType: "text",
      hint: "Add -ed to show it already happened.",
      tags: [
        "AC9E2LY12",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.past-tense.which-is-past-tense",
      subject: "english",
      topic: "past tense",
      level: "2",
      prompt: "Which word means {word} already happened?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'jump' : i == 1 ? 'walk' : i == 2 ? 'play' : i == 3 ? 'look' : i == 4 ? 'call' : 'wash'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "(i == 0 ? 'jump' : i == 1 ? 'walk' : i == 2 ? 'play' : i == 3 ? 'look' : i == 4 ? 'call' : 'wash') + 'ed'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "((i + d1) % 6 == 0 ? 'jump' : (i + d1) % 6 == 1 ? 'walk' : (i + d1) % 6 == 2 ? 'play' : (i + d1) % 6 == 3 ? 'look' : (i + d1) % 6 == 4 ? 'call' : 'wash') + 'ed'",
          "((i + d2) % 6 == 0 ? 'jump' : (i + d2) % 6 == 1 ? 'walk' : (i + d2) % 6 == 2 ? 'play' : (i + d2) % 6 == 3 ? 'look' : (i + d2) % 6 == 4 ? 'call' : 'wash') + 'ed'"
        ]
      },
      hint: "Add -ed to the word to make it past tense.",
      tags: [
        "AC9E2LY12",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.past-tense.which-is-present",
      subject: "english",
      topic: "past tense",
      level: "2",
      prompt: "Which word means this is happening now, if {form} means it already happened?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "form",
          kind: "expr",
          expr: "(i == 0 ? 'jump' : i == 1 ? 'walk' : i == 2 ? 'play' : i == 3 ? 'look' : i == 4 ? 'call' : 'wash') + 'ed'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'jump' : i == 1 ? 'walk' : i == 2 ? 'play' : i == 3 ? 'look' : i == 4 ? 'call' : 'wash'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'jump' : (i + d1) % 6 == 1 ? 'walk' : (i + d1) % 6 == 2 ? 'play' : (i + d1) % 6 == 3 ? 'look' : (i + d1) % 6 == 4 ? 'call' : 'wash'",
          "(i + d2) % 6 == 0 ? 'jump' : (i + d2) % 6 == 1 ? 'walk' : (i + d2) % 6 == 2 ? 'play' : (i + d2) % 6 == 3 ? 'look' : (i + d2) % 6 == 4 ? 'call' : 'wash'"
        ]
      },
      hint: "Take away the -ed to find the word for right now.",
      tags: [
        "AC9E2LY12",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.past-tense.worked-example",
      subject: "english",
      topic: "past tense",
      level: "2",
      prompt: "Here, {eWord} became {eForm} yesterday. Which word means {word} already happened?",
      vars: [
        {
          name: "ei",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "eWord",
          kind: "expr",
          expr: "ei == 0 ? 'jump' : ei == 1 ? 'walk' : ei == 2 ? 'play' : ei == 3 ? 'look' : ei == 4 ? 'call' : 'wash'"
        },
        {
          name: "eForm",
          kind: "expr",
          expr: "(ei == 0 ? 'jump' : ei == 1 ? 'walk' : ei == 2 ? 'play' : ei == 3 ? 'look' : ei == 4 ? 'call' : 'wash') + 'ed'"
        },
        {
          name: "word",
          kind: "expr",
          expr: "(ei + i) % 6 == 0 ? 'jump' : (ei + i) % 6 == 1 ? 'walk' : (ei + i) % 6 == 2 ? 'play' : (ei + i) % 6 == 3 ? 'look' : (ei + i) % 6 == 4 ? 'call' : 'wash'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "((ei + i) % 6 == 0 ? 'jump' : (ei + i) % 6 == 1 ? 'walk' : (ei + i) % 6 == 2 ? 'play' : (ei + i) % 6 == 3 ? 'look' : (ei + i) % 6 == 4 ? 'call' : 'wash') + 'ed'"
        }
      ],
      constraints: [
        "d1 != d2",
        "d1 != i",
        "d2 != i"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "((ei + d1) % 6 == 0 ? 'jump' : (ei + d1) % 6 == 1 ? 'walk' : (ei + d1) % 6 == 2 ? 'play' : (ei + d1) % 6 == 3 ? 'look' : (ei + d1) % 6 == 4 ? 'call' : 'wash') + 'ed'",
          "((ei + d2) % 6 == 0 ? 'jump' : (ei + d2) % 6 == 1 ? 'walk' : (ei + d2) % 6 == 2 ? 'play' : (ei + d2) % 6 == 3 ? 'look' : (ei + d2) % 6 == 4 ? 'call' : 'wash') + 'ed'"
        ]
      },
      hint: "Use the example to see how -ed is added.",
      tags: [
        "AC9E2LY12",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.compound-words.combine",
      subject: "english",
      topic: "compound words",
      level: "2",
      prompt: "What word do you get from {word1} and {word2}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word1",
          kind: "expr",
          expr: "i == 0 ? 'cup' : i == 1 ? 'sun' : i == 2 ? 'foot' : i == 3 ? 'rain' : i == 4 ? 'tooth' : 'bed'"
        },
        {
          name: "word2",
          kind: "expr",
          expr: "i == 0 ? 'cake' : i == 1 ? 'flower' : i == 2 ? 'ball' : i == 3 ? 'bow' : i == 4 ? 'brush' : 'room'"
        }
      ],
      answer: "word1 + word2",
      answerType: "text",
      hint: "Join the two words together, with nothing in between.",
      tags: [
        "AC9E2LY11",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.compound-words.find-missing-part",
      subject: "english",
      topic: "compound words",
      level: "2",
      prompt: "{frame}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "blankFirst",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "word1",
          kind: "expr",
          expr: "i == 0 ? 'cup' : i == 1 ? 'sun' : i == 2 ? 'foot' : i == 3 ? 'rain' : i == 4 ? 'tooth' : 'bed'"
        },
        {
          name: "word2",
          kind: "expr",
          expr: "i == 0 ? 'cake' : i == 1 ? 'flower' : i == 2 ? 'ball' : i == 3 ? 'bow' : i == 4 ? 'brush' : 'room'"
        },
        {
          name: "full",
          kind: "expr",
          expr: "word1 + word2"
        },
        {
          name: "frame",
          kind: "expr",
          expr: "blankFirst == 1 ? ('Here, ? and ' + word2 + ' make ' + full + '.') : ('Here, ' + word1 + ' and ? make ' + full + '.')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "blankFirst == 1 ? word1 : word2"
        }
      ],
      answer: "answer",
      answerType: "text",
      hint: "Say the whole word out loud and listen for the missing part.",
      tags: [
        "AC9E2LY11",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.compound-words.which-is-compound",
      subject: "english",
      topic: "compound words",
      level: "2",
      prompt: "Which word is made by joining {word1} and {word2}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word1",
          kind: "expr",
          expr: "i == 0 ? 'cup' : i == 1 ? 'sun' : i == 2 ? 'foot' : i == 3 ? 'rain' : i == 4 ? 'tooth' : 'bed'"
        },
        {
          name: "word2",
          kind: "expr",
          expr: "i == 0 ? 'cake' : i == 1 ? 'flower' : i == 2 ? 'ball' : i == 3 ? 'bow' : i == 4 ? 'brush' : 'room'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "(i == 0 ? 'cup' : i == 1 ? 'sun' : i == 2 ? 'foot' : i == 3 ? 'rain' : i == 4 ? 'tooth' : 'bed') + (i == 0 ? 'cake' : i == 1 ? 'flower' : i == 2 ? 'ball' : i == 3 ? 'bow' : i == 4 ? 'brush' : 'room')"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "((i + d1) % 6 == 0 ? 'cup' : (i + d1) % 6 == 1 ? 'sun' : (i + d1) % 6 == 2 ? 'foot' : (i + d1) % 6 == 3 ? 'rain' : (i + d1) % 6 == 4 ? 'tooth' : 'bed') + ((i + d1) % 6 == 0 ? 'cake' : (i + d1) % 6 == 1 ? 'flower' : (i + d1) % 6 == 2 ? 'ball' : (i + d1) % 6 == 3 ? 'bow' : (i + d1) % 6 == 4 ? 'brush' : 'room')",
          "((i + d2) % 6 == 0 ? 'cup' : (i + d2) % 6 == 1 ? 'sun' : (i + d2) % 6 == 2 ? 'foot' : (i + d2) % 6 == 3 ? 'rain' : (i + d2) % 6 == 4 ? 'tooth' : 'bed') + ((i + d2) % 6 == 0 ? 'cake' : (i + d2) % 6 == 1 ? 'flower' : (i + d2) % 6 == 2 ? 'ball' : (i + d2) % 6 == 3 ? 'bow' : (i + d2) % 6 == 4 ? 'brush' : 'room')"
        ]
      },
      hint: "Put the two words together to make one word.",
      tags: [
        "AC9E2LY11",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.compound-words.which-word-completes",
      subject: "english",
      topic: "compound words",
      level: "2",
      prompt: "Which word goes with {word1} to make {full}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word1",
          kind: "expr",
          expr: "i == 0 ? 'cup' : i == 1 ? 'sun' : i == 2 ? 'foot' : i == 3 ? 'rain' : i == 4 ? 'tooth' : 'bed'"
        },
        {
          name: "full",
          kind: "expr",
          expr: "(i == 0 ? 'cup' : i == 1 ? 'sun' : i == 2 ? 'foot' : i == 3 ? 'rain' : i == 4 ? 'tooth' : 'bed') + (i == 0 ? 'cake' : i == 1 ? 'flower' : i == 2 ? 'ball' : i == 3 ? 'bow' : i == 4 ? 'brush' : 'room')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'cake' : i == 1 ? 'flower' : i == 2 ? 'ball' : i == 3 ? 'bow' : i == 4 ? 'brush' : 'room'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'cake' : (i + d1) % 6 == 1 ? 'flower' : (i + d1) % 6 == 2 ? 'ball' : (i + d1) % 6 == 3 ? 'bow' : (i + d1) % 6 == 4 ? 'brush' : 'room'",
          "(i + d2) % 6 == 0 ? 'cake' : (i + d2) % 6 == 1 ? 'flower' : (i + d2) % 6 == 2 ? 'ball' : (i + d2) % 6 == 3 ? 'bow' : (i + d2) % 6 == 4 ? 'brush' : 'room'"
        ]
      },
      hint: "Think about what word finishes {full}.",
      tags: [
        "AC9E2LY11",
        "EN1-SPELL-01"
      ]
    },
    {
      id: "english.2.word-classes.identify-in-sentence",
      subject: "english",
      topic: "word classes",
      level: "2",
      prompt: "Which word in this sentence is the {kind}? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "role",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "'The ' + (i == 0 ? 'big' : i == 1 ? 'small' : i == 2 ? 'happy' : i == 3 ? 'fast' : i == 4 ? 'funny' : 'little') + ' ' + (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'horse' : i == 4 ? 'monkey' : 'mouse') + ' can ' + (i == 0 ? 'run' : i == 1 ? 'jump' : i == 2 ? 'sing' : i == 3 ? 'gallop' : i == 4 ? 'climb' : 'hide') + '.'"
        },
        {
          name: "kind",
          kind: "expr",
          expr: "role == 1 ? 'doing word' : (role == 2 ? 'describing word' : 'naming word')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "role == 1 ? (i == 0 ? 'run' : i == 1 ? 'jump' : i == 2 ? 'sing' : i == 3 ? 'gallop' : i == 4 ? 'climb' : 'hide') : role == 2 ? (i == 0 ? 'big' : i == 1 ? 'small' : i == 2 ? 'happy' : i == 3 ? 'fast' : i == 4 ? 'funny' : 'little') : (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'horse' : i == 4 ? 'monkey' : 'mouse')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(role + 1) % 3 == 1 ? (i == 0 ? 'run' : i == 1 ? 'jump' : i == 2 ? 'sing' : i == 3 ? 'gallop' : i == 4 ? 'climb' : 'hide') : (role + 1) % 3 == 2 ? (i == 0 ? 'big' : i == 1 ? 'small' : i == 2 ? 'happy' : i == 3 ? 'fast' : i == 4 ? 'funny' : 'little') : (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'horse' : i == 4 ? 'monkey' : 'mouse')",
          "(role + 2) % 3 == 1 ? (i == 0 ? 'run' : i == 1 ? 'jump' : i == 2 ? 'sing' : i == 3 ? 'gallop' : i == 4 ? 'climb' : 'hide') : (role + 2) % 3 == 2 ? (i == 0 ? 'big' : i == 1 ? 'small' : i == 2 ? 'happy' : i == 3 ? 'fast' : i == 4 ? 'funny' : 'little') : (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'horse' : i == 4 ? 'monkey' : 'mouse')"
        ]
      },
      hint: "A naming word names something, a doing word tells you what it does, and a describing word tells you what it is like.",
      tags: [
        "AC9E2LA07",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.2.word-classes.name-the-word-type",
      subject: "english",
      topic: "word classes",
      level: "2",
      prompt: "In this sentence, what kind of word is {candidate}? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "role",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "'The ' + (i == 0 ? 'big' : i == 1 ? 'small' : i == 2 ? 'happy' : i == 3 ? 'fast' : i == 4 ? 'funny' : 'little') + ' ' + (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'horse' : i == 4 ? 'monkey' : 'mouse') + ' can ' + (i == 0 ? 'run' : i == 1 ? 'jump' : i == 2 ? 'sing' : i == 3 ? 'gallop' : i == 4 ? 'climb' : 'hide') + '.'"
        },
        {
          name: "candidate",
          kind: "expr",
          expr: "role == 1 ? (i == 0 ? 'run' : i == 1 ? 'jump' : i == 2 ? 'sing' : i == 3 ? 'gallop' : i == 4 ? 'climb' : 'hide') : role == 2 ? (i == 0 ? 'big' : i == 1 ? 'small' : i == 2 ? 'happy' : i == 3 ? 'fast' : i == 4 ? 'funny' : 'little') : (i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'bird' : i == 3 ? 'horse' : i == 4 ? 'monkey' : 'mouse')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "role == 1 ? 'doing word' : (role == 2 ? 'describing word' : 'naming word')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(role + 1) % 3 == 1 ? 'doing word' : ((role + 1) % 3 == 2 ? 'describing word' : 'naming word')",
          "(role + 2) % 3 == 1 ? 'doing word' : ((role + 2) % 3 == 2 ? 'describing word' : 'naming word')"
        ]
      },
      hint: "A naming word names something, a doing word tells you what it does, and a describing word tells you what it is like.",
      tags: [
        "AC9E2LA07",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.2.word-classes.is-adjective",
      subject: "english",
      topic: "word classes",
      level: "2",
      prompt: "Is {word} a describing word?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "15"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'loud' : i == 1 ? 'quiet' : i == 2 ? 'tall' : i == 3 ? 'short' : i == 4 ? 'soft' : i == 5 ? 'bright' : i == 6 ? 'gentle' : i == 7 ? 'brave' : i == 8 ? 'table' : i == 9 ? 'chair' : i == 10 ? 'apple' : i == 11 ? 'swim' : i == 12 ? 'read' : i == 13 ? 'write' : i == 14 ? 'window' : 'pencil'"
        }
      ],
      answer: "i < 8",
      hint: "A describing word tells you what something is like.",
      tags: [
        "AC9E2LA07",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.2.word-classes.is-doing-word",
      subject: "english",
      topic: "word classes",
      level: "2",
      prompt: "Is {word} a doing word?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "15"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'skip' : i == 1 ? 'dance' : i == 2 ? 'draw' : i == 3 ? 'paint' : i == 4 ? 'laugh' : i == 5 ? 'clap' : i == 6 ? 'shout' : i == 7 ? 'crawl' : i == 8 ? 'kite' : i == 9 ? 'boat' : i == 10 ? 'shiny' : i == 11 ? 'cold' : i == 12 ? 'basket' : i == 13 ? 'sharp' : i == 14 ? 'garden' : 'quick'"
        }
      ],
      answer: "i < 8",
      hint: "A doing word tells you what someone or something does.",
      tags: [
        "AC9E2LA07",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.2.punctuation.which-mark",
      subject: "english",
      topic: "punctuation",
      level: "2",
      prompt: "Which mark finishes this sentence? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "i == 0 ? 'I like ice cream' : i == 1 ? 'What is your name' : i == 2 ? 'That is amazing' : i == 3 ? 'The sun is hot' : i == 4 ? 'Where do you live' : 'Watch out'"
        },
        {
          name: "markIdx",
          kind: "expr",
          expr: "i % 3"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "markIdx == 0 ? '.' : (markIdx == 1 ? '?' : '!')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(markIdx + 1) % 3 == 0 ? '.' : ((markIdx + 1) % 3 == 1 ? '?' : '!')",
          "(markIdx + 2) % 3 == 0 ? '.' : ((markIdx + 2) % 3 == 1 ? '?' : '!')"
        ]
      },
      hint: "A telling sentence ends with a full stop, a question ends with a question mark, and an exciting sentence ends with an exclamation mark.",
      tags: [
        "AC9E2LY06",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.2.punctuation.name-the-mark",
      subject: "english",
      topic: "punctuation",
      level: "2",
      prompt: "Which mark ends {article} {kind} sentence?",
      vars: [
        {
          name: "k",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "kind",
          kind: "expr",
          expr: "k == 0 ? 'telling' : (k == 1 ? 'asking' : 'exciting')"
        },
        {
          name: "article",
          kind: "expr",
          expr: "k == 0 ? 'a' : 'an'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "k == 0 ? '.' : (k == 1 ? '?' : '!')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(k + 1) % 3 == 0 ? '.' : ((k + 1) % 3 == 1 ? '?' : '!')",
          "(k + 2) % 3 == 0 ? '.' : ((k + 2) % 3 == 1 ? '?' : '!')"
        ]
      },
      hint: "A full stop ends telling sentences, a question mark ends asking sentences, and an exclamation mark ends exciting sentences.",
      tags: [
        "AC9E2LY06",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.2.punctuation.is-question",
      subject: "english",
      topic: "punctuation",
      level: "2",
      prompt: "Does this sentence need a question mark? {sentence}",
      vars: [
        {
          name: "ok",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "j",
          kind: "int",
          min: "0",
          max: "2"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "ok == 1 ? (j == 0 ? 'Is the dog asleep' : j == 1 ? 'What colour is your bag' : 'Can we go outside') : (j == 0 ? 'The dog is asleep' : j == 1 ? 'My bag is red' : 'The classroom is quiet')"
        }
      ],
      answer: "ok == 1",
      hint: "A question mark comes at the end of a sentence that asks something.",
      tags: [
        "AC9E2LY06",
        "EN1-CWT-01"
      ]
    },
    {
      id: "english.2.synonyms.which-synonym",
      subject: "english",
      topic: "synonyms",
      level: "2",
      prompt: "Which word means the same as {target}?",
      vars: [
        {
          name: "p",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s2",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "s3",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? (p == 0 ? 'happy' : p == 1 ? 'big' : p == 2 ? 'small' : p == 3 ? 'quick' : p == 4 ? 'sad' : 'scared') : (p == 0 ? 'glad' : p == 1 ? 'large' : p == 2 ? 'little' : p == 3 ? 'fast' : p == 4 ? 'unhappy' : 'afraid')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? (p == 0 ? 'happy' : p == 1 ? 'big' : p == 2 ? 'small' : p == 3 ? 'quick' : p == 4 ? 'sad' : 'scared') : (p == 0 ? 'glad' : p == 1 ? 'large' : p == 2 ? 'little' : p == 3 ? 'fast' : p == 4 ? 'unhappy' : 'afraid')"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "s2 == 0 ? ((p + d1) % 6 == 0 ? 'happy' : (p + d1) % 6 == 1 ? 'big' : (p + d1) % 6 == 2 ? 'small' : (p + d1) % 6 == 3 ? 'quick' : (p + d1) % 6 == 4 ? 'sad' : 'scared') : ((p + d1) % 6 == 0 ? 'glad' : (p + d1) % 6 == 1 ? 'large' : (p + d1) % 6 == 2 ? 'little' : (p + d1) % 6 == 3 ? 'fast' : (p + d1) % 6 == 4 ? 'unhappy' : 'afraid')",
          "s3 == 0 ? ((p + d2) % 6 == 0 ? 'happy' : (p + d2) % 6 == 1 ? 'big' : (p + d2) % 6 == 2 ? 'small' : (p + d2) % 6 == 3 ? 'quick' : (p + d2) % 6 == 4 ? 'sad' : 'scared') : ((p + d2) % 6 == 0 ? 'glad' : (p + d2) % 6 == 1 ? 'large' : (p + d2) % 6 == 2 ? 'little' : (p + d2) % 6 == 3 ? 'fast' : (p + d2) % 6 == 4 ? 'unhappy' : 'afraid')"
        ]
      },
      hint: "A synonym means almost the same thing.",
      tags: [
        "AC9E2LA09",
        "EN1-VOCAB-01"
      ]
    },
    {
      id: "english.2.synonyms.worked-example",
      subject: "english",
      topic: "synonyms",
      level: "2",
      prompt: "Here, {eTarget} and {eAnswer} mean the same thing. Which word means the same as {target}?",
      vars: [
        {
          name: "ep",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "es",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "p",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s2",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "s3",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "eTarget",
          kind: "expr",
          expr: "es == 0 ? (ep == 0 ? 'happy' : ep == 1 ? 'big' : ep == 2 ? 'small' : ep == 3 ? 'quick' : ep == 4 ? 'sad' : 'scared') : (ep == 0 ? 'glad' : ep == 1 ? 'large' : ep == 2 ? 'little' : ep == 3 ? 'fast' : ep == 4 ? 'unhappy' : 'afraid')"
        },
        {
          name: "eAnswer",
          kind: "expr",
          expr: "1 - es == 0 ? (ep == 0 ? 'happy' : ep == 1 ? 'big' : ep == 2 ? 'small' : ep == 3 ? 'quick' : ep == 4 ? 'sad' : 'scared') : (ep == 0 ? 'glad' : ep == 1 ? 'large' : ep == 2 ? 'little' : ep == 3 ? 'fast' : ep == 4 ? 'unhappy' : 'afraid')"
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? ((ep + p) % 6 == 0 ? 'happy' : (ep + p) % 6 == 1 ? 'big' : (ep + p) % 6 == 2 ? 'small' : (ep + p) % 6 == 3 ? 'quick' : (ep + p) % 6 == 4 ? 'sad' : 'scared') : ((ep + p) % 6 == 0 ? 'glad' : (ep + p) % 6 == 1 ? 'large' : (ep + p) % 6 == 2 ? 'little' : (ep + p) % 6 == 3 ? 'fast' : (ep + p) % 6 == 4 ? 'unhappy' : 'afraid')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? ((ep + p) % 6 == 0 ? 'happy' : (ep + p) % 6 == 1 ? 'big' : (ep + p) % 6 == 2 ? 'small' : (ep + p) % 6 == 3 ? 'quick' : (ep + p) % 6 == 4 ? 'sad' : 'scared') : ((ep + p) % 6 == 0 ? 'glad' : (ep + p) % 6 == 1 ? 'large' : (ep + p) % 6 == 2 ? 'little' : (ep + p) % 6 == 3 ? 'fast' : (ep + p) % 6 == 4 ? 'unhappy' : 'afraid')"
        }
      ],
      constraints: [
        "d1 != d2",
        "d1 != p",
        "d2 != p"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "s2 == 0 ? ((ep + d1) % 6 == 0 ? 'happy' : (ep + d1) % 6 == 1 ? 'big' : (ep + d1) % 6 == 2 ? 'small' : (ep + d1) % 6 == 3 ? 'quick' : (ep + d1) % 6 == 4 ? 'sad' : 'scared') : ((ep + d1) % 6 == 0 ? 'glad' : (ep + d1) % 6 == 1 ? 'large' : (ep + d1) % 6 == 2 ? 'little' : (ep + d1) % 6 == 3 ? 'fast' : (ep + d1) % 6 == 4 ? 'unhappy' : 'afraid')",
          "s3 == 0 ? ((ep + d2) % 6 == 0 ? 'happy' : (ep + d2) % 6 == 1 ? 'big' : (ep + d2) % 6 == 2 ? 'small' : (ep + d2) % 6 == 3 ? 'quick' : (ep + d2) % 6 == 4 ? 'sad' : 'scared') : ((ep + d2) % 6 == 0 ? 'glad' : (ep + d2) % 6 == 1 ? 'large' : (ep + d2) % 6 == 2 ? 'little' : (ep + d2) % 6 == 3 ? 'fast' : (ep + d2) % 6 == 4 ? 'unhappy' : 'afraid')"
        ]
      },
      hint: 'Use the example to see what "means the same" looks like.',
      tags: [
        "AC9E2LA09",
        "EN1-VOCAB-01"
      ]
    },
    {
      id: "english.2.synonyms.two-choices",
      subject: "english",
      topic: "synonyms",
      level: "2",
      prompt: "Which word means the same as {target}?",
      vars: [
        {
          name: "p",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "sw",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? (p == 0 ? 'happy' : p == 1 ? 'big' : p == 2 ? 'small' : p == 3 ? 'quick' : p == 4 ? 'sad' : 'scared') : (p == 0 ? 'glad' : p == 1 ? 'large' : p == 2 ? 'little' : p == 3 ? 'fast' : p == 4 ? 'unhappy' : 'afraid')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? (p == 0 ? 'happy' : p == 1 ? 'big' : p == 2 ? 'small' : p == 3 ? 'quick' : p == 4 ? 'sad' : 'scared') : (p == 0 ? 'glad' : p == 1 ? 'large' : p == 2 ? 'little' : p == 3 ? 'fast' : p == 4 ? 'unhappy' : 'afraid')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "sw == 0 ? ((p + d) % 6 == 0 ? 'happy' : (p + d) % 6 == 1 ? 'big' : (p + d) % 6 == 2 ? 'small' : (p + d) % 6 == 3 ? 'quick' : (p + d) % 6 == 4 ? 'sad' : 'scared') : ((p + d) % 6 == 0 ? 'glad' : (p + d) % 6 == 1 ? 'large' : (p + d) % 6 == 2 ? 'little' : (p + d) % 6 == 3 ? 'fast' : (p + d) % 6 == 4 ? 'unhappy' : 'afraid')"
        ]
      },
      hint: "Think of a word that means the same as {target}.",
      tags: [
        "AC9E2LA09",
        "EN1-VOCAB-01"
      ]
    }
  ]
};

// ../../src/content/packs/english.3.json
var english_3_default = {
  version: "59f80399e134",
  subject: "english",
  level: "3",
  templates: [
    {
      id: "english.3.prefixes-and-suffixes.add-un",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "3",
      prompt: "Write the word that means not {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'happy' : i == 1 ? 'kind' : i == 2 ? 'fair' : i == 3 ? 'safe' : i == 4 ? 'lucky' : 'wise'"
        }
      ],
      answer: "'un' + word",
      answerType: "text",
      hint: "Add un- to the front of the word.",
      tags: [
        "AC9E3LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.prefixes-and-suffixes.double-add-ing",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "3",
      prompt: "Write {word} with -ing added.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'hop' : i == 1 ? 'run' : i == 2 ? 'stop' : i == 3 ? 'swim' : i == 4 ? 'plan' : 'grab'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'hopping' : i == 1 ? 'running' : i == 2 ? 'stopping' : i == 3 ? 'swimming' : i == 4 ? 'planning' : 'grabbing'"
        }
      ],
      answer: "answer",
      answerType: "text",
      hint: "Double the last letter before adding -ing.",
      tags: [
        "AC9E3LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.prefixes-and-suffixes.which-means-not",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "3",
      prompt: "Which word means not {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'happy' : i == 1 ? 'kind' : i == 2 ? 'fair' : i == 3 ? 'safe' : i == 4 ? 'lucky' : 'wise'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'unhappy' : i == 1 ? 'unkind' : i == 2 ? 'unfair' : i == 3 ? 'unsafe' : i == 4 ? 'unlucky' : 'unwise'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'unhappy' : (i + d1) % 6 == 1 ? 'unkind' : (i + d1) % 6 == 2 ? 'unfair' : (i + d1) % 6 == 3 ? 'unsafe' : (i + d1) % 6 == 4 ? 'unlucky' : 'unwise'",
          "(i + d2) % 6 == 0 ? 'unhappy' : (i + d2) % 6 == 1 ? 'unkind' : (i + d2) % 6 == 2 ? 'unfair' : (i + d2) % 6 == 3 ? 'unsafe' : (i + d2) % 6 == 4 ? 'unlucky' : 'unwise'"
        ]
      },
      hint: "Un- at the start of a word means not.",
      tags: [
        "AC9E3LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.prefixes-and-suffixes.which-is-happening-now",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "3",
      prompt: "Which word means {word} is happening right now?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'hop' : i == 1 ? 'run' : i == 2 ? 'stop' : i == 3 ? 'swim' : i == 4 ? 'plan' : 'grab'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'hopping' : i == 1 ? 'running' : i == 2 ? 'stopping' : i == 3 ? 'swimming' : i == 4 ? 'planning' : 'grabbing'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'hopping' : (i + d1) % 6 == 1 ? 'running' : (i + d1) % 6 == 2 ? 'stopping' : (i + d1) % 6 == 3 ? 'swimming' : (i + d1) % 6 == 4 ? 'planning' : 'grabbing'",
          "(i + d2) % 6 == 0 ? 'hopping' : (i + d2) % 6 == 1 ? 'running' : (i + d2) % 6 == 2 ? 'stopping' : (i + d2) % 6 == 3 ? 'swimming' : (i + d2) % 6 == 4 ? 'planning' : 'grabbing'"
        ]
      },
      hint: "Double the last letter, then add -ing.",
      tags: [
        "AC9E3LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.prefixes-and-suffixes.which-means-again",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "3",
      prompt: "Which word means to {word} again?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'do' : i == 1 ? 'make' : i == 2 ? 'build' : i == 3 ? 'fill' : i == 4 ? 'play' : 'tell'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'redo' : i == 1 ? 'remake' : i == 2 ? 'rebuild' : i == 3 ? 'refill' : i == 4 ? 'replay' : 'retell'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'redo' : (i + d1) % 6 == 1 ? 'remake' : (i + d1) % 6 == 2 ? 'rebuild' : (i + d1) % 6 == 3 ? 'refill' : (i + d1) % 6 == 4 ? 'replay' : 'retell'",
          "(i + d2) % 6 == 0 ? 'redo' : (i + d2) % 6 == 1 ? 'remake' : (i + d2) % 6 == 2 ? 'rebuild' : (i + d2) % 6 == 3 ? 'refill' : (i + d2) % 6 == 4 ? 'replay' : 'retell'"
        ]
      },
      hint: "Re- at the start of a word means again.",
      tags: [
        "AC9E3LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.homophones.to-too-two",
      subject: "english",
      topic: "homophones",
      level: "3",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'j == 0 ? "We are going ? the beach." : j == 1 ? "This soup is ? hot to eat." : "I have ? brothers."'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'to' : j == 1 ? 'too' : 'two'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(j + 1) % 3 == 0 ? 'to' : (j + 1) % 3 == 1 ? 'too' : 'two'",
          "(j + 2) % 3 == 0 ? 'to' : (j + 2) % 3 == 1 ? 'too' : 'two'"
        ]
      },
      hint: "Read the whole sentence to hear which one fits.",
      tags: [
        "AC9E3LY12",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.homophones.there-their",
      subject: "english",
      topic: "homophones",
      level: "3",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'j == 0 ? "Put the ball over ?." : "The children lost ? bags."'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'there' : 'their'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - j == 0 ? 'there' : 'their'"
        ]
      },
      hint: "One of these two words points to a place, and the other shows something belongs to someone.",
      tags: [
        "AC9E3LY12",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.homophones.here-hear",
      subject: "english",
      topic: "homophones",
      level: "3",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'j == 0 ? "Come and sit over ?." : "Can you ? the birds?"'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'here' : 'hear'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - j == 0 ? 'here' : 'hear'"
        ]
      },
      hint: "One of these two words points to a place, and the other is about listening.",
      tags: [
        "AC9E3LY12",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.homophones.one-won",
      subject: "english",
      topic: "homophones",
      level: "3",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'j == 0 ? "I only have ? apple." : "Our team ? the game."'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'one' : 'won'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - j == 0 ? 'one' : 'won'"
        ]
      },
      hint: "One of these two words is a number, and the other means came first in a game.",
      tags: [
        "AC9E3LY12",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.word-classes.identify-in-sentence",
      subject: "english",
      topic: "word classes",
      level: "3",
      prompt: "Which word in this sentence is the {kind}? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "role",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "'The ' + (i == 0 ? 'tall' : i == 1 ? 'clever' : i == 2 ? 'brave' : i == 3 ? 'loud' : i == 4 ? 'curious' : 'strong') + ' ' + (i == 0 ? 'giant' : i == 1 ? 'fox' : i == 2 ? 'knight' : i == 3 ? 'lion' : i == 4 ? 'student' : 'farmer') + ' can ' + (i == 0 ? 'climb' : i == 1 ? 'hunt' : i == 2 ? 'fight' : i == 3 ? 'roar' : i == 4 ? 'study' : 'plant') + '.'"
        },
        {
          name: "kind",
          kind: "expr",
          expr: "role == 1 ? 'doing word' : (role == 2 ? 'describing word' : 'naming word')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "role == 1 ? (i == 0 ? 'climb' : i == 1 ? 'hunt' : i == 2 ? 'fight' : i == 3 ? 'roar' : i == 4 ? 'study' : 'plant') : role == 2 ? (i == 0 ? 'tall' : i == 1 ? 'clever' : i == 2 ? 'brave' : i == 3 ? 'loud' : i == 4 ? 'curious' : 'strong') : (i == 0 ? 'giant' : i == 1 ? 'fox' : i == 2 ? 'knight' : i == 3 ? 'lion' : i == 4 ? 'student' : 'farmer')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(role + 1) % 3 == 1 ? (i == 0 ? 'climb' : i == 1 ? 'hunt' : i == 2 ? 'fight' : i == 3 ? 'roar' : i == 4 ? 'study' : 'plant') : (role + 1) % 3 == 2 ? (i == 0 ? 'tall' : i == 1 ? 'clever' : i == 2 ? 'brave' : i == 3 ? 'loud' : i == 4 ? 'curious' : 'strong') : (i == 0 ? 'giant' : i == 1 ? 'fox' : i == 2 ? 'knight' : i == 3 ? 'lion' : i == 4 ? 'student' : 'farmer')",
          "(role + 2) % 3 == 1 ? (i == 0 ? 'climb' : i == 1 ? 'hunt' : i == 2 ? 'fight' : i == 3 ? 'roar' : i == 4 ? 'study' : 'plant') : (role + 2) % 3 == 2 ? (i == 0 ? 'tall' : i == 1 ? 'clever' : i == 2 ? 'brave' : i == 3 ? 'loud' : i == 4 ? 'curious' : 'strong') : (i == 0 ? 'giant' : i == 1 ? 'fox' : i == 2 ? 'knight' : i == 3 ? 'lion' : i == 4 ? 'student' : 'farmer')"
        ]
      },
      hint: "A naming word names something, a doing word tells you what it does, and a describing word tells you what it is like.",
      tags: [
        "AC9E3LA07",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.3.word-classes.name-the-word-type",
      subject: "english",
      topic: "word classes",
      level: "3",
      prompt: "In this sentence, what kind of word is {candidate}? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "role",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: "'The ' + (i == 0 ? 'tall' : i == 1 ? 'clever' : i == 2 ? 'brave' : i == 3 ? 'loud' : i == 4 ? 'curious' : 'strong') + ' ' + (i == 0 ? 'giant' : i == 1 ? 'fox' : i == 2 ? 'knight' : i == 3 ? 'lion' : i == 4 ? 'student' : 'farmer') + ' can ' + (i == 0 ? 'climb' : i == 1 ? 'hunt' : i == 2 ? 'fight' : i == 3 ? 'roar' : i == 4 ? 'study' : 'plant') + '.'"
        },
        {
          name: "candidate",
          kind: "expr",
          expr: "role == 1 ? (i == 0 ? 'climb' : i == 1 ? 'hunt' : i == 2 ? 'fight' : i == 3 ? 'roar' : i == 4 ? 'study' : 'plant') : role == 2 ? (i == 0 ? 'tall' : i == 1 ? 'clever' : i == 2 ? 'brave' : i == 3 ? 'loud' : i == 4 ? 'curious' : 'strong') : (i == 0 ? 'giant' : i == 1 ? 'fox' : i == 2 ? 'knight' : i == 3 ? 'lion' : i == 4 ? 'student' : 'farmer')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "role == 1 ? 'doing word' : (role == 2 ? 'describing word' : 'naming word')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(role + 1) % 3 == 1 ? 'doing word' : ((role + 1) % 3 == 2 ? 'describing word' : 'naming word')",
          "(role + 2) % 3 == 1 ? 'doing word' : ((role + 2) % 3 == 2 ? 'describing word' : 'naming word')"
        ]
      },
      hint: "A naming word names something, a doing word tells you what it does, and a describing word tells you what it is like.",
      tags: [
        "AC9E3LA07",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.3.word-classes.identify-verb-tense",
      subject: "english",
      topic: "word classes",
      level: "3",
      prompt: "Is this happening in the past, now, or in the future? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "tense",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: `'I ' + (tense == 0 ? (i == 0 ? 'walk' : i == 1 ? 'clean' : i == 2 ? 'cook' : i == 3 ? 'paint' : i == 4 ? 'watch' : 'wash') : tense == 1 ? ((i == 0 ? 'walk' : i == 1 ? 'clean' : i == 2 ? 'cook' : i == 3 ? 'paint' : i == 4 ? 'watch' : 'wash') + 'ed') : ('will ' + (i == 0 ? 'walk' : i == 1 ? 'clean' : i == 2 ? 'cook' : i == 3 ? 'paint' : i == 4 ? 'watch' : 'wash'))) + ' ' + (i == 0 ? "the dog" : i == 1 ? "my room" : i == 2 ? "dinner" : i == 3 ? "a picture" : i == 4 ? "a movie" : "the car") + '.'`
        },
        {
          name: "answer",
          kind: "expr",
          expr: "tense == 1 ? 'past' : (tense == 2 ? 'future' : 'now')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(tense + 1) % 3 == 1 ? 'past' : ((tense + 1) % 3 == 2 ? 'future' : 'now')",
          "(tense + 2) % 3 == 1 ? 'past' : ((tense + 2) % 3 == 2 ? 'future' : 'now')"
        ]
      },
      hint: "Look at the verb: does it end in -ed, or does it start with will?",
      tags: [
        "AC9E3LA08",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.3.word-classes.future-tense-form",
      subject: "english",
      topic: "word classes",
      level: "3",
      prompt: "Which word means {word} will happen, if {word} means it is happening now?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'walk' : i == 1 ? 'clean' : i == 2 ? 'cook' : i == 3 ? 'paint' : i == 4 ? 'watch' : 'wash'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "'will ' + word"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'will ' + ((i + d1) % 6 == 0 ? 'walk' : (i + d1) % 6 == 1 ? 'clean' : (i + d1) % 6 == 2 ? 'cook' : (i + d1) % 6 == 3 ? 'paint' : (i + d1) % 6 == 4 ? 'watch' : 'wash')",
          "'will ' + ((i + d2) % 6 == 0 ? 'walk' : (i + d2) % 6 == 1 ? 'clean' : (i + d2) % 6 == 2 ? 'cook' : (i + d2) % 6 == 3 ? 'paint' : (i + d2) % 6 == 4 ? 'watch' : 'wash')"
        ]
      },
      hint: "Add will before the word to show it will happen in the future.",
      tags: [
        "AC9E3LA08",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.3.word-classes.is-a-verb",
      subject: "english",
      topic: "word classes",
      level: "3",
      prompt: "Is {word} a doing word?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "15"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'skip' : i == 1 ? 'shout' : i == 2 ? 'laugh' : i == 3 ? 'crawl' : i == 4 ? 'whisper' : i == 5 ? 'giggle' : i == 6 ? 'stretch' : i == 7 ? 'wander' : i == 8 ? 'pumpkin' : i == 9 ? 'ladder' : i == 10 ? 'shiny' : i == 11 ? 'narrow' : i == 12 ? 'bucket' : i == 13 ? 'glossy' : i == 14 ? 'island' : 'wooden'"
        }
      ],
      answer: "i < 8",
      hint: "A doing word tells you what someone or something does.",
      tags: [
        "AC9E3LA07",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.3.punctuation.which-is-contraction",
      subject: "english",
      topic: "punctuation",
      level: "3",
      prompt: "Which word means the same as {long}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "long",
          kind: "expr",
          expr: 'i == 0 ? "do not" : i == 1 ? "is not" : i == 2 ? "are not" : i == 3 ? "have not" : i == 4 ? "was not" : "will not"'
        },
        {
          name: "answer",
          kind: "expr",
          expr: `i == 0 ? "don't" : i == 1 ? "isn't" : i == 2 ? "aren't" : i == 3 ? "haven't" : i == 4 ? "wasn't" : "won't"`
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          `(i + d1) % 6 == 0 ? "don't" : (i + d1) % 6 == 1 ? "isn't" : (i + d1) % 6 == 2 ? "aren't" : (i + d1) % 6 == 3 ? "haven't" : (i + d1) % 6 == 4 ? "wasn't" : "won't"`,
          `(i + d2) % 6 == 0 ? "don't" : (i + d2) % 6 == 1 ? "isn't" : (i + d2) % 6 == 2 ? "aren't" : (i + d2) % 6 == 3 ? "haven't" : (i + d2) % 6 == 4 ? "wasn't" : "won't"`
        ]
      },
      hint: "A contraction joins two words and uses an apostrophe for the missing letters.",
      tags: [
        "AC9E3LA11",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.3.punctuation.which-is-long-form",
      subject: "english",
      topic: "punctuation",
      level: "3",
      prompt: "Which words mean the same as {short}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "short",
          kind: "expr",
          expr: `i == 0 ? "don't" : i == 1 ? "isn't" : i == 2 ? "aren't" : i == 3 ? "haven't" : i == 4 ? "wasn't" : "won't"`
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'i == 0 ? "do not" : i == 1 ? "is not" : i == 2 ? "are not" : i == 3 ? "have not" : i == 4 ? "was not" : "will not"'
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(i + d1) % 6 == 0 ? "do not" : (i + d1) % 6 == 1 ? "is not" : (i + d1) % 6 == 2 ? "are not" : (i + d1) % 6 == 3 ? "have not" : (i + d1) % 6 == 4 ? "was not" : "will not"',
          '(i + d2) % 6 == 0 ? "do not" : (i + d2) % 6 == 1 ? "is not" : (i + d2) % 6 == 2 ? "are not" : (i + d2) % 6 == 3 ? "have not" : (i + d2) % 6 == 4 ? "was not" : "will not"'
        ]
      },
      hint: "Say the contraction slowly to hear the two words inside it.",
      tags: [
        "AC9E3LA11",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.3.punctuation.which-is-possessive",
      subject: "english",
      topic: "punctuation",
      level: "3",
      prompt: "Which word means belonging to the {noun}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "noun",
          kind: "expr",
          expr: "i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'teacher' : i == 3 ? 'sister' : i == 4 ? 'boy' : 'girl'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: `(i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'teacher' : i == 3 ? 'sister' : i == 4 ? 'boy' : 'girl') + "'s"`
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          `((i + d1) % 6 == 0 ? 'dog' : (i + d1) % 6 == 1 ? 'cat' : (i + d1) % 6 == 2 ? 'teacher' : (i + d1) % 6 == 3 ? 'sister' : (i + d1) % 6 == 4 ? 'boy' : 'girl') + "'s"`,
          `((i + d2) % 6 == 0 ? 'dog' : (i + d2) % 6 == 1 ? 'cat' : (i + d2) % 6 == 2 ? 'teacher' : (i + d2) % 6 == 3 ? 'sister' : (i + d2) % 6 == 4 ? 'boy' : 'girl') + "'s"`
        ]
      },
      hint: "Add an apostrophe and an s to show something belongs to someone.",
      tags: [
        "AC9E3LA11",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.3.punctuation.which-is-the-owner",
      subject: "english",
      topic: "punctuation",
      level: "3",
      prompt: "Which word means just the owner, if {poss} means it belongs to them?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "poss",
          kind: "expr",
          expr: `(i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'teacher' : i == 3 ? 'sister' : i == 4 ? 'boy' : 'girl') + "'s"`
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'dog' : i == 1 ? 'cat' : i == 2 ? 'teacher' : i == 3 ? 'sister' : i == 4 ? 'boy' : 'girl'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'dog' : (i + d1) % 6 == 1 ? 'cat' : (i + d1) % 6 == 2 ? 'teacher' : (i + d1) % 6 == 3 ? 'sister' : (i + d1) % 6 == 4 ? 'boy' : 'girl'",
          "(i + d2) % 6 == 0 ? 'dog' : (i + d2) % 6 == 1 ? 'cat' : (i + d2) % 6 == 2 ? 'teacher' : (i + d2) % 6 == 3 ? 'sister' : (i + d2) % 6 == 4 ? 'boy' : 'girl'"
        ]
      },
      hint: "Take away the apostrophe and s to find the owner.",
      tags: [
        "AC9E3LA11",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.3.spelling-patterns.add-ion",
      subject: "english",
      topic: "spelling patterns",
      level: "3",
      prompt: "Write the noun made by adding -ion to {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'act' : i == 1 ? 'invent' : i == 2 ? 'collect' : i == 3 ? 'connect' : i == 4 ? 'direct' : 'correct'"
        }
      ],
      answer: "word + 'ion'",
      answerType: "text",
      hint: "Add -ion to the end of the word.",
      tags: [
        "AC9E3LY11",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.spelling-patterns.which-is-ion-noun",
      subject: "english",
      topic: "spelling patterns",
      level: "3",
      prompt: "Which word is made by adding -ion to {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'act' : i == 1 ? 'invent' : i == 2 ? 'collect' : i == 3 ? 'connect' : i == 4 ? 'direct' : 'correct'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "word + 'ion'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "((i + d1) % 6 == 0 ? 'act' : (i + d1) % 6 == 1 ? 'invent' : (i + d1) % 6 == 2 ? 'collect' : (i + d1) % 6 == 3 ? 'connect' : (i + d1) % 6 == 4 ? 'direct' : 'correct') + 'ion'",
          "((i + d2) % 6 == 0 ? 'act' : (i + d2) % 6 == 1 ? 'invent' : (i + d2) % 6 == 2 ? 'collect' : (i + d2) % 6 == 3 ? 'connect' : (i + d2) % 6 == 4 ? 'direct' : 'correct') + 'ion'"
        ]
      },
      hint: "Add -ion to the end of the word.",
      tags: [
        "AC9E3LY11",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.spelling-patterns.find-base-word",
      subject: "english",
      topic: "spelling patterns",
      level: "3",
      prompt: "Write the base word that {noun} comes from.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'act' : i == 1 ? 'invent' : i == 2 ? 'collect' : i == 3 ? 'connect' : i == 4 ? 'direct' : 'correct'"
        },
        {
          name: "noun",
          kind: "expr",
          expr: "word + 'ion'"
        }
      ],
      answer: "word",
      answerType: "text",
      hint: "Take away -ion to find the base word.",
      tags: [
        "AC9E3LY11",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.3.spelling-patterns.which-same-pattern",
      subject: "english",
      topic: "spelling patterns",
      level: "3",
      prompt: "Which word has the same letter pattern as {target}?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "e1",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "e2",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "target",
          kind: "expr",
          expr: "f == 0 ? (t == 0 ? 'rain' : t == 1 ? 'pain' : t == 2 ? 'main' : 'chain') : f == 1 ? (t == 0 ? 'tree' : t == 1 ? 'free' : t == 2 ? 'green' : 'sheep') : f == 2 ? (t == 0 ? 'boat' : t == 1 ? 'coat' : t == 2 ? 'road' : 'soap') : (t == 0 ? 'light' : t == 1 ? 'night' : t == 2 ? 'right' : 'sight')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'rain' : a == 1 ? 'pain' : a == 2 ? 'main' : 'chain') : f == 1 ? (a == 0 ? 'tree' : a == 1 ? 'free' : a == 2 ? 'green' : 'sheep') : f == 2 ? (a == 0 ? 'boat' : a == 1 ? 'coat' : a == 2 ? 'road' : 'soap') : (a == 0 ? 'light' : a == 1 ? 'night' : a == 2 ? 'right' : 'sight')"
        }
      ],
      constraints: [
        "t != a",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 4 == 0 ? (e1 == 0 ? 'rain' : e1 == 1 ? 'pain' : e1 == 2 ? 'main' : 'chain') : (f + d1) % 4 == 1 ? (e1 == 0 ? 'tree' : e1 == 1 ? 'free' : e1 == 2 ? 'green' : 'sheep') : (f + d1) % 4 == 2 ? (e1 == 0 ? 'boat' : e1 == 1 ? 'coat' : e1 == 2 ? 'road' : 'soap') : (e1 == 0 ? 'light' : e1 == 1 ? 'night' : e1 == 2 ? 'right' : 'sight')",
          "(f + d2) % 4 == 0 ? (e2 == 0 ? 'rain' : e2 == 1 ? 'pain' : e2 == 2 ? 'main' : 'chain') : (f + d2) % 4 == 1 ? (e2 == 0 ? 'tree' : e2 == 1 ? 'free' : e2 == 2 ? 'green' : 'sheep') : (f + d2) % 4 == 2 ? (e2 == 0 ? 'boat' : e2 == 1 ? 'coat' : e2 == 2 ? 'road' : 'soap') : (e2 == 0 ? 'light' : e2 == 1 ? 'night' : e2 == 2 ? 'right' : 'sight')"
        ]
      },
      hint: "Look for the same group of letters making the same sound.",
      tags: [
        "AC9E3LY11",
        "EN2-SPELL-01"
      ]
    }
  ]
};

// ../../src/content/packs/english.4.json
var english_4_default = {
  version: "92b2162f60ad",
  subject: "english",
  level: "4",
  templates: [
    {
      id: "english.4.prefixes-and-suffixes.write-dis",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "4",
      prompt: "Write the word that means the opposite of {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'agree' : i == 1 ? 'obey' : i == 2 ? 'like' : i == 3 ? 'trust' : i == 4 ? 'connect' : 'approve'"
        }
      ],
      answer: "'dis' + word",
      answerType: "text",
      hint: "Add dis- to the front of the word.",
      tags: [
        "AC9E4LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.prefixes-and-suffixes.which-means-opposite",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "4",
      prompt: "Which word means the opposite of {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'agree' : i == 1 ? 'obey' : i == 2 ? 'like' : i == 3 ? 'trust' : i == 4 ? 'connect' : 'approve'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "'dis' + word"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "'dis' + ((i + d1) % 6 == 0 ? 'agree' : (i + d1) % 6 == 1 ? 'obey' : (i + d1) % 6 == 2 ? 'like' : (i + d1) % 6 == 3 ? 'trust' : (i + d1) % 6 == 4 ? 'connect' : 'approve')",
          "'dis' + ((i + d2) % 6 == 0 ? 'agree' : (i + d2) % 6 == 1 ? 'obey' : (i + d2) % 6 == 2 ? 'like' : (i + d2) % 6 == 3 ? 'trust' : (i + d2) % 6 == 4 ? 'connect' : 'approve')"
        ]
      },
      hint: "Dis- at the start of a word means the opposite.",
      tags: [
        "AC9E4LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.prefixes-and-suffixes.write-with-ly",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "4",
      prompt: "Write {word} with -ly added.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'happy' : i == 1 ? 'angry' : i == 2 ? 'easy' : i == 3 ? 'hungry' : i == 4 ? 'lazy' : 'busy'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'happily' : i == 1 ? 'angrily' : i == 2 ? 'easily' : i == 3 ? 'hungrily' : i == 4 ? 'lazily' : 'busily'"
        }
      ],
      answer: "answer",
      answerType: "text",
      hint: "Change the y to i, then add -ly.",
      tags: [
        "AC9E4LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.prefixes-and-suffixes.which-means-that-way",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "4",
      prompt: "Which word means done in a way that is {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'happy' : i == 1 ? 'angry' : i == 2 ? 'easy' : i == 3 ? 'hungry' : i == 4 ? 'lazy' : 'busy'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'happily' : i == 1 ? 'angrily' : i == 2 ? 'easily' : i == 3 ? 'hungrily' : i == 4 ? 'lazily' : 'busily'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'happily' : (i + d1) % 6 == 1 ? 'angrily' : (i + d1) % 6 == 2 ? 'easily' : (i + d1) % 6 == 3 ? 'hungrily' : (i + d1) % 6 == 4 ? 'lazily' : 'busily'",
          "(i + d2) % 6 == 0 ? 'happily' : (i + d2) % 6 == 1 ? 'angrily' : (i + d2) % 6 == 2 ? 'easily' : (i + d2) % 6 == 3 ? 'hungrily' : (i + d2) % 6 == 4 ? 'lazily' : 'busily'"
        ]
      },
      hint: "Change the y to i, then add -ly.",
      tags: [
        "AC9E4LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.prefixes-and-suffixes.find-base-word",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "4",
      prompt: "Which word means {word} without the -ly ending?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'happily' : i == 1 ? 'angrily' : i == 2 ? 'easily' : i == 3 ? 'hungrily' : i == 4 ? 'lazily' : 'busily'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'happy' : i == 1 ? 'angry' : i == 2 ? 'easy' : i == 3 ? 'hungry' : i == 4 ? 'lazy' : 'busy'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'happy' : (i + d1) % 6 == 1 ? 'angry' : (i + d1) % 6 == 2 ? 'easy' : (i + d1) % 6 == 3 ? 'hungry' : (i + d1) % 6 == 4 ? 'lazy' : 'busy'",
          "(i + d2) % 6 == 0 ? 'happy' : (i + d2) % 6 == 1 ? 'angry' : (i + d2) % 6 == 2 ? 'easy' : (i + d2) % 6 == 3 ? 'hungry' : (i + d2) % 6 == 4 ? 'lazy' : 'busy'"
        ]
      },
      hint: "Change the i back to y, then take away -ly.",
      tags: [
        "AC9E4LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.homophones.which-witch",
      subject: "english",
      topic: "homophones",
      level: "4",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: `j == 0 ? "I don't know ? bus to catch." : "The ? cast a magic spell."`
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'which' : 'witch'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - j == 0 ? 'which' : 'witch'"
        ]
      },
      hint: "One of these words asks a question, and the other names a person from a story.",
      tags: [
        "AC9E4LY11",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.homophones.weight-wait",
      subject: "english",
      topic: "homophones",
      level: "4",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'j == 0 ? "What is the ? of this box?" : "Please ? for me outside."'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'weight' : 'wait'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - j == 0 ? 'weight' : 'wait'"
        ]
      },
      hint: "One of these words means to stay until something happens, and the other is how heavy something is.",
      tags: [
        "AC9E4LY11",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.homophones.break-brake",
      subject: "english",
      topic: "homophones",
      level: "4",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'j == 0 ? "Please do not ? the plate." : "The car has a new ?."'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'break' : 'brake'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - j == 0 ? 'break' : 'brake'"
        ]
      },
      hint: "One of these words is a part of a car, and the other means to snap or smash something.",
      tags: [
        "AC9E4LY11",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.homophones.flower-flour",
      subject: "english",
      topic: "homophones",
      level: "4",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'j == 0 ? "She picked a beautiful ? from the garden." : "Add more ? to the cake mixture."'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'flower' : 'flour'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - j == 0 ? 'flower' : 'flour'"
        ]
      },
      hint: "One of these words is used in baking, and the other grows in a garden.",
      tags: [
        "AC9E4LY11",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.word-classes.identify-in-sentence",
      subject: "english",
      topic: "word classes",
      level: "4",
      prompt: "Which word in this sentence is the {label}? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "role",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: `'The ' + (i == 0 ? 'dog' : i == 1 ? 'bird' : i == 2 ? 'boy' : i == 3 ? 'girl' : i == 4 ? 'horse' : 'driver') + ' ' + (i == 0 ? 'ran' : i == 1 ? 'flew' : i == 2 ? 'walked' : i == 3 ? 'jumped' : i == 4 ? 'galloped' : 'drove') + ' ' + (i == 0 ? 'quickly' : i == 1 ? 'high' : i == 2 ? 'slowly' : i == 3 ? 'carefully' : i == 4 ? 'fast' : 'gently') + ' ' + (i == 0 ? 'under' : i == 1 ? 'above' : i == 2 ? 'behind' : i == 3 ? 'over' : i == 4 ? 'near' : 'beside') + ' ' + (i == 0 ? "the table" : i == 1 ? "the trees" : i == 2 ? "the bus" : i == 3 ? "the puddle" : i == 4 ? "the fence" : "the river") + '.'`
        },
        {
          name: "label",
          kind: "expr",
          expr: "role == 1 ? 'verb' : role == 2 ? 'adverb' : role == 3 ? 'preposition' : 'noun'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "role == 1 ? (i == 0 ? 'ran' : i == 1 ? 'flew' : i == 2 ? 'walked' : i == 3 ? 'jumped' : i == 4 ? 'galloped' : 'drove') : role == 2 ? (i == 0 ? 'quickly' : i == 1 ? 'high' : i == 2 ? 'slowly' : i == 3 ? 'carefully' : i == 4 ? 'fast' : 'gently') : role == 3 ? (i == 0 ? 'under' : i == 1 ? 'above' : i == 2 ? 'behind' : i == 3 ? 'over' : i == 4 ? 'near' : 'beside') : (i == 0 ? 'dog' : i == 1 ? 'bird' : i == 2 ? 'boy' : i == 3 ? 'girl' : i == 4 ? 'horse' : 'driver')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "(role + 1) % 4 == 1 ? (i == 0 ? 'ran' : i == 1 ? 'flew' : i == 2 ? 'walked' : i == 3 ? 'jumped' : i == 4 ? 'galloped' : 'drove') : (role + 1) % 4 == 2 ? (i == 0 ? 'quickly' : i == 1 ? 'high' : i == 2 ? 'slowly' : i == 3 ? 'carefully' : i == 4 ? 'fast' : 'gently') : (role + 1) % 4 == 3 ? (i == 0 ? 'under' : i == 1 ? 'above' : i == 2 ? 'behind' : i == 3 ? 'over' : i == 4 ? 'near' : 'beside') : (i == 0 ? 'dog' : i == 1 ? 'bird' : i == 2 ? 'boy' : i == 3 ? 'girl' : i == 4 ? 'horse' : 'driver')",
          "(role + 2) % 4 == 1 ? (i == 0 ? 'ran' : i == 1 ? 'flew' : i == 2 ? 'walked' : i == 3 ? 'jumped' : i == 4 ? 'galloped' : 'drove') : (role + 2) % 4 == 2 ? (i == 0 ? 'quickly' : i == 1 ? 'high' : i == 2 ? 'slowly' : i == 3 ? 'carefully' : i == 4 ? 'fast' : 'gently') : (role + 2) % 4 == 3 ? (i == 0 ? 'under' : i == 1 ? 'above' : i == 2 ? 'behind' : i == 3 ? 'over' : i == 4 ? 'near' : 'beside') : (i == 0 ? 'dog' : i == 1 ? 'bird' : i == 2 ? 'boy' : i == 3 ? 'girl' : i == 4 ? 'horse' : 'driver')",
          "(role + 3) % 4 == 1 ? (i == 0 ? 'ran' : i == 1 ? 'flew' : i == 2 ? 'walked' : i == 3 ? 'jumped' : i == 4 ? 'galloped' : 'drove') : (role + 3) % 4 == 2 ? (i == 0 ? 'quickly' : i == 1 ? 'high' : i == 2 ? 'slowly' : i == 3 ? 'carefully' : i == 4 ? 'fast' : 'gently') : (role + 3) % 4 == 3 ? (i == 0 ? 'under' : i == 1 ? 'above' : i == 2 ? 'behind' : i == 3 ? 'over' : i == 4 ? 'near' : 'beside') : (i == 0 ? 'dog' : i == 1 ? 'bird' : i == 2 ? 'boy' : i == 3 ? 'girl' : i == 4 ? 'horse' : 'driver')"
        ]
      },
      hint: "A noun names something, a verb is the action, an adverb tells you how, and a preposition tells you where.",
      tags: [
        "AC9E4LA08",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.4.word-classes.name-the-word-class",
      subject: "english",
      topic: "word classes",
      level: "4",
      prompt: "What kind of word is {candidate} in this sentence? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "role",
          kind: "pick",
          from: [
            0,
            1,
            2,
            3
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: `'The ' + (i == 0 ? 'dog' : i == 1 ? 'bird' : i == 2 ? 'boy' : i == 3 ? 'girl' : i == 4 ? 'horse' : 'driver') + ' ' + (i == 0 ? 'ran' : i == 1 ? 'flew' : i == 2 ? 'walked' : i == 3 ? 'jumped' : i == 4 ? 'galloped' : 'drove') + ' ' + (i == 0 ? 'quickly' : i == 1 ? 'high' : i == 2 ? 'slowly' : i == 3 ? 'carefully' : i == 4 ? 'fast' : 'gently') + ' ' + (i == 0 ? 'under' : i == 1 ? 'above' : i == 2 ? 'behind' : i == 3 ? 'over' : i == 4 ? 'near' : 'beside') + ' ' + (i == 0 ? "the table" : i == 1 ? "the trees" : i == 2 ? "the bus" : i == 3 ? "the puddle" : i == 4 ? "the fence" : "the river") + '.'`
        },
        {
          name: "candidate",
          kind: "expr",
          expr: "role == 1 ? (i == 0 ? 'ran' : i == 1 ? 'flew' : i == 2 ? 'walked' : i == 3 ? 'jumped' : i == 4 ? 'galloped' : 'drove') : role == 2 ? (i == 0 ? 'quickly' : i == 1 ? 'high' : i == 2 ? 'slowly' : i == 3 ? 'carefully' : i == 4 ? 'fast' : 'gently') : role == 3 ? (i == 0 ? 'under' : i == 1 ? 'above' : i == 2 ? 'behind' : i == 3 ? 'over' : i == 4 ? 'near' : 'beside') : (i == 0 ? 'dog' : i == 1 ? 'bird' : i == 2 ? 'boy' : i == 3 ? 'girl' : i == 4 ? 'horse' : 'driver')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "role == 1 ? 'verb' : role == 2 ? 'adverb' : role == 3 ? 'preposition' : 'noun'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          "(role + 1) % 4 == 1 ? 'verb' : (role + 1) % 4 == 2 ? 'adverb' : (role + 1) % 4 == 3 ? 'preposition' : 'noun'",
          "(role + 2) % 4 == 1 ? 'verb' : (role + 2) % 4 == 2 ? 'adverb' : (role + 2) % 4 == 3 ? 'preposition' : 'noun'",
          "(role + 3) % 4 == 1 ? 'verb' : (role + 3) % 4 == 2 ? 'adverb' : (role + 3) % 4 == 3 ? 'preposition' : 'noun'"
        ]
      },
      hint: "A noun names something, a verb is the action, an adverb tells you how, and a preposition tells you where.",
      tags: [
        "AC9E4LA08",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.4.word-classes.is-future-tense",
      subject: "english",
      topic: "word classes",
      level: "4",
      prompt: "Is this sentence in the future tense? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "ok",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "alt",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "tense",
          kind: "expr",
          expr: "ok == 1 ? 2 : alt"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: `'I ' + (tense == 0 ? (i == 0 ? 'go' : i == 1 ? 'see' : i == 2 ? 'eat' : i == 3 ? 'run' : i == 4 ? 'give' : 'take') : tense == 1 ? (i == 0 ? 'went' : i == 1 ? 'saw' : i == 2 ? 'ate' : i == 3 ? 'ran' : i == 4 ? 'gave' : 'took') : ('will ' + (i == 0 ? 'go' : i == 1 ? 'see' : i == 2 ? 'eat' : i == 3 ? 'run' : i == 4 ? 'give' : 'take'))) + ' ' + (i == 0 ? "to school" : i == 1 ? "a movie" : i == 2 ? "breakfast" : i == 3 ? "in the park" : i == 4 ? "a gift" : "the bus") + '.'`
        }
      ],
      answer: "ok == 1",
      hint: "Future tense verbs start with will.",
      tags: [
        "AC9E4LA09",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.4.word-classes.past-tense-form",
      subject: "english",
      topic: "word classes",
      level: "4",
      prompt: "Which word means {word} already happened?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'go' : i == 1 ? 'see' : i == 2 ? 'eat' : i == 3 ? 'run' : i == 4 ? 'give' : 'take'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'went' : i == 1 ? 'saw' : i == 2 ? 'ate' : i == 3 ? 'ran' : i == 4 ? 'gave' : 'took'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'went' : (i + d1) % 6 == 1 ? 'saw' : (i + d1) % 6 == 2 ? 'ate' : (i + d1) % 6 == 3 ? 'ran' : (i + d1) % 6 == 4 ? 'gave' : 'took'",
          "(i + d2) % 6 == 0 ? 'went' : (i + d2) % 6 == 1 ? 'saw' : (i + d2) % 6 == 2 ? 'ate' : (i + d2) % 6 == 3 ? 'ran' : (i + d2) % 6 == 4 ? 'gave' : 'took'"
        ]
      },
      hint: "This verb changes completely in the past tense - it does not just add -ed.",
      tags: [
        "AC9E4LA09",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.4.word-classes.identify-verb-tense",
      subject: "english",
      topic: "word classes",
      level: "4",
      prompt: "Is this happening in the past, now, or in the future? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "tense",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: `'I ' + (tense == 0 ? (i == 0 ? 'go' : i == 1 ? 'see' : i == 2 ? 'eat' : i == 3 ? 'run' : i == 4 ? 'give' : 'take') : tense == 1 ? (i == 0 ? 'went' : i == 1 ? 'saw' : i == 2 ? 'ate' : i == 3 ? 'ran' : i == 4 ? 'gave' : 'took') : ('will ' + (i == 0 ? 'go' : i == 1 ? 'see' : i == 2 ? 'eat' : i == 3 ? 'run' : i == 4 ? 'give' : 'take'))) + ' ' + (i == 0 ? "to school" : i == 1 ? "a movie" : i == 2 ? "breakfast" : i == 3 ? "in the park" : i == 4 ? "a gift" : "the bus") + '.'`
        },
        {
          name: "answer",
          kind: "expr",
          expr: "tense == 1 ? 'past' : (tense == 2 ? 'future' : 'now')"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(tense + 1) % 3 == 1 ? 'past' : ((tense + 1) % 3 == 2 ? 'future' : 'now')",
          "(tense + 2) % 3 == 1 ? 'past' : ((tense + 2) % 3 == 2 ? 'future' : 'now')"
        ]
      },
      hint: "Look at the verb: does it change completely, or does it start with will?",
      tags: [
        "AC9E4LA09",
        "EN2-CWT-01"
      ]
    },
    {
      id: "english.4.plurals.write-plural",
      subject: "english",
      topic: "plurals",
      level: "4",
      prompt: "Write the plural of {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'mouse' : i == 1 ? 'goose' : i == 2 ? 'child' : i == 3 ? 'foot' : i == 4 ? 'tooth' : 'person'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'mice' : i == 1 ? 'geese' : i == 2 ? 'children' : i == 3 ? 'feet' : i == 4 ? 'teeth' : 'people'"
        }
      ],
      answer: "answer",
      answerType: "text",
      hint: "This word does not just add -s - the whole word changes.",
      tags: [
        "AC9E4LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.plurals.write-singular",
      subject: "english",
      topic: "plurals",
      level: "4",
      prompt: "Write the singular of {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'mice' : i == 1 ? 'geese' : i == 2 ? 'children' : i == 3 ? 'feet' : i == 4 ? 'teeth' : 'people'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'mouse' : i == 1 ? 'goose' : i == 2 ? 'child' : i == 3 ? 'foot' : i == 4 ? 'tooth' : 'person'"
        }
      ],
      answer: "answer",
      answerType: "text",
      hint: "Think of just one - what would you call it?",
      tags: [
        "AC9E4LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.plurals.which-is-plural",
      subject: "english",
      topic: "plurals",
      level: "4",
      prompt: "Which word is the plural of {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'mouse' : i == 1 ? 'goose' : i == 2 ? 'child' : i == 3 ? 'foot' : i == 4 ? 'tooth' : 'person'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'mice' : i == 1 ? 'geese' : i == 2 ? 'children' : i == 3 ? 'feet' : i == 4 ? 'teeth' : 'people'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'mice' : (i + d1) % 6 == 1 ? 'geese' : (i + d1) % 6 == 2 ? 'children' : (i + d1) % 6 == 3 ? 'feet' : (i + d1) % 6 == 4 ? 'teeth' : 'people'",
          "(i + d2) % 6 == 0 ? 'mice' : (i + d2) % 6 == 1 ? 'geese' : (i + d2) % 6 == 2 ? 'children' : (i + d2) % 6 == 3 ? 'feet' : (i + d2) % 6 == 4 ? 'teeth' : 'people'"
        ]
      },
      hint: "This word does not just add -s - the whole word changes.",
      tags: [
        "AC9E4LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.plurals.which-is-singular",
      subject: "english",
      topic: "plurals",
      level: "4",
      prompt: "Which word is the singular of {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'mice' : i == 1 ? 'geese' : i == 2 ? 'children' : i == 3 ? 'feet' : i == 4 ? 'teeth' : 'people'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'mouse' : i == 1 ? 'goose' : i == 2 ? 'child' : i == 3 ? 'foot' : i == 4 ? 'tooth' : 'person'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'mouse' : (i + d1) % 6 == 1 ? 'goose' : (i + d1) % 6 == 2 ? 'child' : (i + d1) % 6 == 3 ? 'foot' : (i + d1) % 6 == 4 ? 'tooth' : 'person'",
          "(i + d2) % 6 == 0 ? 'mouse' : (i + d2) % 6 == 1 ? 'goose' : (i + d2) % 6 == 2 ? 'child' : (i + d2) % 6 == 3 ? 'foot' : (i + d2) % 6 == 4 ? 'tooth' : 'person'"
        ]
      },
      hint: "Think of just one - what would you call it?",
      tags: [
        "AC9E4LY10",
        "EN2-SPELL-01"
      ]
    },
    {
      id: "english.4.synonyms.which-synonym",
      subject: "english",
      topic: "synonyms",
      level: "4",
      prompt: "Which word means the same as {target}?",
      vars: [
        {
          name: "p",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s2",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "s3",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? (p == 0 ? 'furious' : p == 1 ? 'exhausted' : p == 2 ? 'gigantic' : p == 3 ? 'ancient' : p == 4 ? 'delighted' : 'terrified') : (p == 0 ? 'angry' : p == 1 ? 'weary' : p == 2 ? 'huge' : p == 3 ? 'old' : p == 4 ? 'pleased' : 'frightened')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? (p == 0 ? 'furious' : p == 1 ? 'exhausted' : p == 2 ? 'gigantic' : p == 3 ? 'ancient' : p == 4 ? 'delighted' : 'terrified') : (p == 0 ? 'angry' : p == 1 ? 'weary' : p == 2 ? 'huge' : p == 3 ? 'old' : p == 4 ? 'pleased' : 'frightened')"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "s2 == 0 ? ((p + d1) % 6 == 0 ? 'furious' : (p + d1) % 6 == 1 ? 'exhausted' : (p + d1) % 6 == 2 ? 'gigantic' : (p + d1) % 6 == 3 ? 'ancient' : (p + d1) % 6 == 4 ? 'delighted' : 'terrified') : ((p + d1) % 6 == 0 ? 'angry' : (p + d1) % 6 == 1 ? 'weary' : (p + d1) % 6 == 2 ? 'huge' : (p + d1) % 6 == 3 ? 'old' : (p + d1) % 6 == 4 ? 'pleased' : 'frightened')",
          "s3 == 0 ? ((p + d2) % 6 == 0 ? 'furious' : (p + d2) % 6 == 1 ? 'exhausted' : (p + d2) % 6 == 2 ? 'gigantic' : (p + d2) % 6 == 3 ? 'ancient' : (p + d2) % 6 == 4 ? 'delighted' : 'terrified') : ((p + d2) % 6 == 0 ? 'angry' : (p + d2) % 6 == 1 ? 'weary' : (p + d2) % 6 == 2 ? 'huge' : (p + d2) % 6 == 3 ? 'old' : (p + d2) % 6 == 4 ? 'pleased' : 'frightened')"
        ]
      },
      hint: "A synonym means almost the same thing.",
      tags: [
        "AC9E4LA11",
        "EN2-VOCAB-01"
      ]
    },
    {
      id: "english.4.synonyms.worked-example",
      subject: "english",
      topic: "synonyms",
      level: "4",
      prompt: "Here, {eTarget} and {eAnswer} mean the same thing. Which word means the same as {target}?",
      vars: [
        {
          name: "ep",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "es",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "p",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s2",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "s3",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "eTarget",
          kind: "expr",
          expr: "es == 0 ? (ep == 0 ? 'furious' : ep == 1 ? 'exhausted' : ep == 2 ? 'gigantic' : ep == 3 ? 'ancient' : ep == 4 ? 'delighted' : 'terrified') : (ep == 0 ? 'angry' : ep == 1 ? 'weary' : ep == 2 ? 'huge' : ep == 3 ? 'old' : ep == 4 ? 'pleased' : 'frightened')"
        },
        {
          name: "eAnswer",
          kind: "expr",
          expr: "1 - es == 0 ? (ep == 0 ? 'furious' : ep == 1 ? 'exhausted' : ep == 2 ? 'gigantic' : ep == 3 ? 'ancient' : ep == 4 ? 'delighted' : 'terrified') : (ep == 0 ? 'angry' : ep == 1 ? 'weary' : ep == 2 ? 'huge' : ep == 3 ? 'old' : ep == 4 ? 'pleased' : 'frightened')"
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? ((ep + p) % 6 == 0 ? 'furious' : (ep + p) % 6 == 1 ? 'exhausted' : (ep + p) % 6 == 2 ? 'gigantic' : (ep + p) % 6 == 3 ? 'ancient' : (ep + p) % 6 == 4 ? 'delighted' : 'terrified') : ((ep + p) % 6 == 0 ? 'angry' : (ep + p) % 6 == 1 ? 'weary' : (ep + p) % 6 == 2 ? 'huge' : (ep + p) % 6 == 3 ? 'old' : (ep + p) % 6 == 4 ? 'pleased' : 'frightened')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? ((ep + p) % 6 == 0 ? 'furious' : (ep + p) % 6 == 1 ? 'exhausted' : (ep + p) % 6 == 2 ? 'gigantic' : (ep + p) % 6 == 3 ? 'ancient' : (ep + p) % 6 == 4 ? 'delighted' : 'terrified') : ((ep + p) % 6 == 0 ? 'angry' : (ep + p) % 6 == 1 ? 'weary' : (ep + p) % 6 == 2 ? 'huge' : (ep + p) % 6 == 3 ? 'old' : (ep + p) % 6 == 4 ? 'pleased' : 'frightened')"
        }
      ],
      constraints: [
        "d1 != d2",
        "d1 != p",
        "d2 != p"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "s2 == 0 ? ((ep + d1) % 6 == 0 ? 'furious' : (ep + d1) % 6 == 1 ? 'exhausted' : (ep + d1) % 6 == 2 ? 'gigantic' : (ep + d1) % 6 == 3 ? 'ancient' : (ep + d1) % 6 == 4 ? 'delighted' : 'terrified') : ((ep + d1) % 6 == 0 ? 'angry' : (ep + d1) % 6 == 1 ? 'weary' : (ep + d1) % 6 == 2 ? 'huge' : (ep + d1) % 6 == 3 ? 'old' : (ep + d1) % 6 == 4 ? 'pleased' : 'frightened')",
          "s3 == 0 ? ((ep + d2) % 6 == 0 ? 'furious' : (ep + d2) % 6 == 1 ? 'exhausted' : (ep + d2) % 6 == 2 ? 'gigantic' : (ep + d2) % 6 == 3 ? 'ancient' : (ep + d2) % 6 == 4 ? 'delighted' : 'terrified') : ((ep + d2) % 6 == 0 ? 'angry' : (ep + d2) % 6 == 1 ? 'weary' : (ep + d2) % 6 == 2 ? 'huge' : (ep + d2) % 6 == 3 ? 'old' : (ep + d2) % 6 == 4 ? 'pleased' : 'frightened')"
        ]
      },
      hint: 'Use the example to see what "means the same" looks like.',
      tags: [
        "AC9E4LA11",
        "EN2-VOCAB-01"
      ]
    },
    {
      id: "english.4.synonyms.which-antonym",
      subject: "english",
      topic: "synonyms",
      level: "4",
      prompt: "Which word means the opposite of {target}?",
      vars: [
        {
          name: "p",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "s",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "s2",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "s3",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "target",
          kind: "expr",
          expr: "s == 0 ? (p == 0 ? 'brave' : p == 1 ? 'polite' : p == 2 ? 'generous' : p == 3 ? 'honest' : p == 4 ? 'careful' : 'patient') : (p == 0 ? 'cowardly' : p == 1 ? 'rude' : p == 2 ? 'selfish' : p == 3 ? 'dishonest' : p == 4 ? 'careless' : 'impatient')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "1 - s == 0 ? (p == 0 ? 'brave' : p == 1 ? 'polite' : p == 2 ? 'generous' : p == 3 ? 'honest' : p == 4 ? 'careful' : 'patient') : (p == 0 ? 'cowardly' : p == 1 ? 'rude' : p == 2 ? 'selfish' : p == 3 ? 'dishonest' : p == 4 ? 'careless' : 'impatient')"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "s2 == 0 ? ((p + d1) % 6 == 0 ? 'brave' : (p + d1) % 6 == 1 ? 'polite' : (p + d1) % 6 == 2 ? 'generous' : (p + d1) % 6 == 3 ? 'honest' : (p + d1) % 6 == 4 ? 'careful' : 'patient') : ((p + d1) % 6 == 0 ? 'cowardly' : (p + d1) % 6 == 1 ? 'rude' : (p + d1) % 6 == 2 ? 'selfish' : (p + d1) % 6 == 3 ? 'dishonest' : (p + d1) % 6 == 4 ? 'careless' : 'impatient')",
          "s3 == 0 ? ((p + d2) % 6 == 0 ? 'brave' : (p + d2) % 6 == 1 ? 'polite' : (p + d2) % 6 == 2 ? 'generous' : (p + d2) % 6 == 3 ? 'honest' : (p + d2) % 6 == 4 ? 'careful' : 'patient') : ((p + d2) % 6 == 0 ? 'cowardly' : (p + d2) % 6 == 1 ? 'rude' : (p + d2) % 6 == 2 ? 'selfish' : (p + d2) % 6 == 3 ? 'dishonest' : (p + d2) % 6 == 4 ? 'careless' : 'impatient')"
        ]
      },
      hint: "An antonym means the opposite thing.",
      tags: [
        "AC9E4LA11",
        "EN2-VOCAB-01"
      ]
    },
    {
      id: "english.4.synonyms.in-context",
      subject: "english",
      topic: "synonyms",
      level: "4",
      prompt: "Which word means the same as {target} in this sentence? {sentence}",
      vars: [
        {
          name: "p",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'p == 0 ? "The customer was furious about the mistake." : p == 1 ? "After the race, the runner felt exhausted." : p == 2 ? "The elephant is a gigantic animal." : p == 3 ? "The castle was built in ancient times." : p == 4 ? "She was delighted with her new bike." : "The child was terrified of the thunder."'
        },
        {
          name: "target",
          kind: "expr",
          expr: "p == 0 ? 'furious' : p == 1 ? 'exhausted' : p == 2 ? 'gigantic' : p == 3 ? 'ancient' : p == 4 ? 'delighted' : 'terrified'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "p == 0 ? 'angry' : p == 1 ? 'weary' : p == 2 ? 'huge' : p == 3 ? 'old' : p == 4 ? 'pleased' : 'frightened'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(p + d1) % 6 == 0 ? 'angry' : (p + d1) % 6 == 1 ? 'weary' : (p + d1) % 6 == 2 ? 'huge' : (p + d1) % 6 == 3 ? 'old' : (p + d1) % 6 == 4 ? 'pleased' : 'frightened'",
          "(p + d2) % 6 == 0 ? 'angry' : (p + d2) % 6 == 1 ? 'weary' : (p + d2) % 6 == 2 ? 'huge' : (p + d2) % 6 == 3 ? 'old' : (p + d2) % 6 == 4 ? 'pleased' : 'frightened'"
        ]
      },
      hint: "A synonym means almost the same thing.",
      tags: [
        "AC9E4LA11",
        "EN2-VOCAB-01"
      ]
    }
  ]
};

// ../../src/content/packs/english.5.json
var english_5_default = {
  version: "f6812b9e84fe",
  subject: "english",
  level: "5",
  templates: [
    {
      id: "english.5.word-roots.same-root",
      subject: "english",
      topic: "word roots",
      level: "5",
      prompt: "Which word has the same root as {target}?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "e1",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "e2",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "target",
          kind: "expr",
          expr: "f == 0 ? (t == 0 ? 'transport' : t == 1 ? 'export' : t == 2 ? 'import' : 'report') : f == 1 ? (t == 0 ? 'predict' : t == 1 ? 'verdict' : t == 2 ? 'dictate' : 'contradict') : f == 2 ? (t == 0 ? 'inspect' : t == 1 ? 'respect' : t == 2 ? 'suspect' : 'spectator') : f == 3 ? (t == 0 ? 'construct' : t == 1 ? 'instruct' : t == 2 ? 'destruct' : 'structure') : f == 4 ? (t == 0 ? 'reject' : t == 1 ? 'inject' : t == 2 ? 'project' : 'eject') : (t == 0 ? 'describe' : t == 1 ? 'subscribe' : t == 2 ? 'inscribe' : 'prescribe')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'transport' : a == 1 ? 'export' : a == 2 ? 'import' : 'report') : f == 1 ? (a == 0 ? 'predict' : a == 1 ? 'verdict' : a == 2 ? 'dictate' : 'contradict') : f == 2 ? (a == 0 ? 'inspect' : a == 1 ? 'respect' : a == 2 ? 'suspect' : 'spectator') : f == 3 ? (a == 0 ? 'construct' : a == 1 ? 'instruct' : a == 2 ? 'destruct' : 'structure') : f == 4 ? (a == 0 ? 'reject' : a == 1 ? 'inject' : a == 2 ? 'project' : 'eject') : (a == 0 ? 'describe' : a == 1 ? 'subscribe' : a == 2 ? 'inscribe' : 'prescribe')"
        }
      ],
      constraints: [
        "t != a",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 6 == 0 ? (e1 == 0 ? 'transport' : e1 == 1 ? 'export' : e1 == 2 ? 'import' : 'report') : (f + d1) % 6 == 1 ? (e1 == 0 ? 'predict' : e1 == 1 ? 'verdict' : e1 == 2 ? 'dictate' : 'contradict') : (f + d1) % 6 == 2 ? (e1 == 0 ? 'inspect' : e1 == 1 ? 'respect' : e1 == 2 ? 'suspect' : 'spectator') : (f + d1) % 6 == 3 ? (e1 == 0 ? 'construct' : e1 == 1 ? 'instruct' : e1 == 2 ? 'destruct' : 'structure') : (f + d1) % 6 == 4 ? (e1 == 0 ? 'reject' : e1 == 1 ? 'inject' : e1 == 2 ? 'project' : 'eject') : (e1 == 0 ? 'describe' : e1 == 1 ? 'subscribe' : e1 == 2 ? 'inscribe' : 'prescribe')",
          "(f + d2) % 6 == 0 ? (e2 == 0 ? 'transport' : e2 == 1 ? 'export' : e2 == 2 ? 'import' : 'report') : (f + d2) % 6 == 1 ? (e2 == 0 ? 'predict' : e2 == 1 ? 'verdict' : e2 == 2 ? 'dictate' : 'contradict') : (f + d2) % 6 == 2 ? (e2 == 0 ? 'inspect' : e2 == 1 ? 'respect' : e2 == 2 ? 'suspect' : 'spectator') : (f + d2) % 6 == 3 ? (e2 == 0 ? 'construct' : e2 == 1 ? 'instruct' : e2 == 2 ? 'destruct' : 'structure') : (f + d2) % 6 == 4 ? (e2 == 0 ? 'reject' : e2 == 1 ? 'inject' : e2 == 2 ? 'project' : 'eject') : (e2 == 0 ? 'describe' : e2 == 1 ? 'subscribe' : e2 == 2 ? 'inscribe' : 'prescribe')"
        ]
      },
      hint: "Look for the part of the word that stays the same and means the same thing.",
      tags: [
        "AC9E5LY09",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.word-roots.which-comes-from-root",
      subject: "english",
      topic: "word roots",
      level: "5",
      prompt: "Which word comes from a root meaning to {meaning}?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "e1",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "e2",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "meaning",
          kind: "expr",
          expr: 'f == 0 ? "carry" : f == 1 ? "say" : f == 2 ? "look" : f == 3 ? "build" : f == 4 ? "throw" : "write"'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (i == 0 ? 'transport' : i == 1 ? 'export' : i == 2 ? 'import' : 'report') : f == 1 ? (i == 0 ? 'predict' : i == 1 ? 'verdict' : i == 2 ? 'dictate' : 'contradict') : f == 2 ? (i == 0 ? 'inspect' : i == 1 ? 'respect' : i == 2 ? 'suspect' : 'spectator') : f == 3 ? (i == 0 ? 'construct' : i == 1 ? 'instruct' : i == 2 ? 'destruct' : 'structure') : f == 4 ? (i == 0 ? 'reject' : i == 1 ? 'inject' : i == 2 ? 'project' : 'eject') : (i == 0 ? 'describe' : i == 1 ? 'subscribe' : i == 2 ? 'inscribe' : 'prescribe')"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 6 == 0 ? (e1 == 0 ? 'transport' : e1 == 1 ? 'export' : e1 == 2 ? 'import' : 'report') : (f + d1) % 6 == 1 ? (e1 == 0 ? 'predict' : e1 == 1 ? 'verdict' : e1 == 2 ? 'dictate' : 'contradict') : (f + d1) % 6 == 2 ? (e1 == 0 ? 'inspect' : e1 == 1 ? 'respect' : e1 == 2 ? 'suspect' : 'spectator') : (f + d1) % 6 == 3 ? (e1 == 0 ? 'construct' : e1 == 1 ? 'instruct' : e1 == 2 ? 'destruct' : 'structure') : (f + d1) % 6 == 4 ? (e1 == 0 ? 'reject' : e1 == 1 ? 'inject' : e1 == 2 ? 'project' : 'eject') : (e1 == 0 ? 'describe' : e1 == 1 ? 'subscribe' : e1 == 2 ? 'inscribe' : 'prescribe')",
          "(f + d2) % 6 == 0 ? (e2 == 0 ? 'transport' : e2 == 1 ? 'export' : e2 == 2 ? 'import' : 'report') : (f + d2) % 6 == 1 ? (e2 == 0 ? 'predict' : e2 == 1 ? 'verdict' : e2 == 2 ? 'dictate' : 'contradict') : (f + d2) % 6 == 2 ? (e2 == 0 ? 'inspect' : e2 == 1 ? 'respect' : e2 == 2 ? 'suspect' : 'spectator') : (f + d2) % 6 == 3 ? (e2 == 0 ? 'construct' : e2 == 1 ? 'instruct' : e2 == 2 ? 'destruct' : 'structure') : (f + d2) % 6 == 4 ? (e2 == 0 ? 'reject' : e2 == 1 ? 'inject' : e2 == 2 ? 'project' : 'eject') : (e2 == 0 ? 'describe' : e2 == 1 ? 'subscribe' : e2 == 2 ? 'inscribe' : 'prescribe')"
        ]
      },
      hint: "The root inside each word shows which family it belongs to.",
      tags: [
        "AC9E5LY09",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.word-roots.root-meaning",
      subject: "english",
      topic: "word roots",
      level: "5",
      prompt: "What does the root in {word} mean?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "f == 0 ? (i == 0 ? 'transport' : i == 1 ? 'export' : i == 2 ? 'import' : 'report') : f == 1 ? (i == 0 ? 'predict' : i == 1 ? 'verdict' : i == 2 ? 'dictate' : 'contradict') : f == 2 ? (i == 0 ? 'inspect' : i == 1 ? 'respect' : i == 2 ? 'suspect' : 'spectator') : f == 3 ? (i == 0 ? 'construct' : i == 1 ? 'instruct' : i == 2 ? 'destruct' : 'structure') : f == 4 ? (i == 0 ? 'reject' : i == 1 ? 'inject' : i == 2 ? 'project' : 'eject') : (i == 0 ? 'describe' : i == 1 ? 'subscribe' : i == 2 ? 'inscribe' : 'prescribe')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'f == 0 ? "carry" : f == 1 ? "say" : f == 2 ? "look" : f == 3 ? "build" : f == 4 ? "throw" : "write"'
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(f + d1) % 6 == 0 ? "carry" : (f + d1) % 6 == 1 ? "say" : (f + d1) % 6 == 2 ? "look" : (f + d1) % 6 == 3 ? "build" : (f + d1) % 6 == 4 ? "throw" : "write"',
          '(f + d2) % 6 == 0 ? "carry" : (f + d2) % 6 == 1 ? "say" : (f + d2) % 6 == 2 ? "look" : (f + d2) % 6 == 3 ? "build" : (f + d2) % 6 == 4 ? "throw" : "write"'
        ]
      },
      hint: "Think about what all the words in that family have in common.",
      tags: [
        "AC9E5LY09",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.word-roots.write-root",
      subject: "english",
      topic: "word roots",
      level: "5",
      prompt: "Write the root inside {word}.",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "word",
          kind: "expr",
          expr: "f == 0 ? (i == 0 ? 'transport' : i == 1 ? 'export' : i == 2 ? 'import' : 'report') : f == 1 ? (i == 0 ? 'predict' : i == 1 ? 'verdict' : i == 2 ? 'dictate' : 'contradict') : f == 2 ? (i == 0 ? 'inspect' : i == 1 ? 'respect' : i == 2 ? 'suspect' : 'spectator') : f == 3 ? (i == 0 ? 'construct' : i == 1 ? 'instruct' : i == 2 ? 'destruct' : 'structure') : f == 4 ? (i == 0 ? 'reject' : i == 1 ? 'inject' : i == 2 ? 'project' : 'eject') : (i == 0 ? 'describe' : i == 1 ? 'subscribe' : i == 2 ? 'inscribe' : 'prescribe')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'f == 0 ? "port" : f == 1 ? "dict" : f == 2 ? "spect" : f == 3 ? "struct" : f == 4 ? "ject" : "scrib"'
        }
      ],
      constraints: [
        "f != 5"
      ],
      answer: "answer",
      answerType: "text",
      hint: "Look for the meaningful chunk of letters shared by that word family.",
      tags: [
        "AC9E5LY09",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.word-roots.write-by-clue",
      subject: "english",
      topic: "word roots",
      level: "5",
      prompt: "Write the word that {clue}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "clue",
          kind: "expr",
          expr: 'i == 0 ? "carries something from one place to another" : i == 1 ? "says what will happen in the future" : i == 2 ? "looks closely to check something" : i == 3 ? "builds something out of parts" : i == 4 ? "says words for someone else to write down" : "shows admiration for someone or something"'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'transport' : i == 1 ? 'predict' : i == 2 ? 'inspect' : i == 3 ? 'construct' : i == 4 ? 'dictate' : 'respect'"
        }
      ],
      answer: "answer",
      answerType: "text",
      hint: "Break the clue down into the single action it describes.",
      tags: [
        "AC9E5LY09",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.prefixes-and-suffixes.write-able",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "5",
      prompt: "Write the adjective made by adding -able to {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'afford' : i == 1 ? 'accept' : i == 2 ? 'adjust' : i == 3 ? 'avoid' : i == 4 ? 'prevent' : 'defend'"
        }
      ],
      answer: "word + 'able'",
      answerType: "text",
      hint: "Add -able to the end of the word.",
      tags: [
        "AC9E5LY10",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.prefixes-and-suffixes.write-ness",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "5",
      prompt: "Write the noun made by adding -ness to {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'kind' : i == 1 ? 'sad' : i == 2 ? 'dark' : i == 3 ? 'weak' : i == 4 ? 'calm' : 'quiet'"
        }
      ],
      answer: "word + 'ness'",
      answerType: "text",
      hint: "Add -ness to the end of the word.",
      tags: [
        "AC9E5LY10",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.prefixes-and-suffixes.which-can-be-done",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "5",
      prompt: "Which word describes something that can be {word}ed?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'afford' : i == 1 ? 'accept' : i == 2 ? 'adjust' : i == 3 ? 'avoid' : i == 4 ? 'prevent' : 'defend'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "word + 'able'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "((i + d1) % 6 == 0 ? 'afford' : (i + d1) % 6 == 1 ? 'accept' : (i + d1) % 6 == 2 ? 'adjust' : (i + d1) % 6 == 3 ? 'avoid' : (i + d1) % 6 == 4 ? 'prevent' : 'defend') + 'able'",
          "((i + d2) % 6 == 0 ? 'afford' : (i + d2) % 6 == 1 ? 'accept' : (i + d2) % 6 == 2 ? 'adjust' : (i + d2) % 6 == 3 ? 'avoid' : (i + d2) % 6 == 4 ? 'prevent' : 'defend') + 'able'"
        ]
      },
      hint: "Add -able to the end of the word.",
      tags: [
        "AC9E5LY10",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.prefixes-and-suffixes.which-is-the-state",
      subject: "english",
      topic: "prefixes and suffixes",
      level: "5",
      prompt: "Which word means the state of being {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'kind' : i == 1 ? 'sad' : i == 2 ? 'dark' : i == 3 ? 'weak' : i == 4 ? 'calm' : 'quiet'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "word + 'ness'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "((i + d1) % 6 == 0 ? 'kind' : (i + d1) % 6 == 1 ? 'sad' : (i + d1) % 6 == 2 ? 'dark' : (i + d1) % 6 == 3 ? 'weak' : (i + d1) % 6 == 4 ? 'calm' : 'quiet') + 'ness'",
          "((i + d2) % 6 == 0 ? 'kind' : (i + d2) % 6 == 1 ? 'sad' : (i + d2) % 6 == 2 ? 'dark' : (i + d2) % 6 == 3 ? 'weak' : (i + d2) % 6 == 4 ? 'calm' : 'quiet') + 'ness'"
        ]
      },
      hint: "Add -ness to the end of the word.",
      tags: [
        "AC9E5LY10",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.homophones.stationary-stationery",
      subject: "english",
      topic: "homophones",
      level: "5",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'j == 0 ? "The car remained ? at the red light." : "She bought new pens and paper at the ? shop."'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'stationary' : 'stationery'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - j == 0 ? 'stationary' : 'stationery'"
        ]
      },
      hint: "One of these words means not moving, and the other is paper and pens for writing.",
      tags: [
        "AC9E5LY08",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.homophones.principal-principle",
      subject: "english",
      topic: "homophones",
      level: "5",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'j == 0 ? "The ? of the school greeted the new students." : "Honesty is an important ? to live by."'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'principal' : 'principle'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - j == 0 ? 'principal' : 'principle'"
        ]
      },
      hint: "One of these words is the head of a school, and the other is a rule you believe in.",
      tags: [
        "AC9E5LY08",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.homophones.council-counsel",
      subject: "english",
      topic: "homophones",
      level: "5",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'j == 0 ? "The local ? decided to build a new park." : "The teacher gave her some helpful ? about her studies."'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'council' : 'counsel'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - j == 0 ? 'council' : 'counsel'"
        ]
      },
      hint: "One of these words is a group that governs, and the other is advice.",
      tags: [
        "AC9E5LY08",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.homophones.affect-effect",
      subject: "english",
      topic: "homophones",
      level: "5",
      prompt: "Which word completes the sentence? {sentence}",
      vars: [
        {
          name: "j",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'j == 0 ? "The rain did not ? our plans." : "The medicine had a strong ? on her."'
        },
        {
          name: "answer",
          kind: "expr",
          expr: "j == 0 ? 'affect' : 'effect'"
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          "1 - j == 0 ? 'affect' : 'effect'"
        ]
      },
      hint: "One of these words is usually a verb meaning to change something, and the other is usually a noun for a result.",
      tags: [
        "AC9E5LY08",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.figurative-language.identify",
      subject: "english",
      topic: "figurative language",
      level: "5",
      prompt: "Which one is this? {sentence}",
      vars: [
        {
          name: "type",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'type == 0 ? (i == 0 ? "The wind roared like a lion through the valley." : i == 1 ? "Her smile was as bright as the morning sun." : i == 2 ? "He ran as fast as a cheetah chasing its prey." : i == 3 ? "The old car rattled like a bag of tin cans." : "Her voice was as smooth as silk.") : type == 1 ? (i == 0 ? "The classroom was a zoo during the fire drill." : i == 1 ? "Time is a thief that steals our best moments." : i == 2 ? "The stars were diamonds scattered across the sky." : i == 3 ? "Her eyes were pools of sparkling water." : "The kitchen was a disaster zone after the party.") : (i == 0 ? "The wind whispered secrets through the trees." : i == 1 ? "The old house groaned when the storm rolled in." : i == 2 ? "The sun smiled down on the sleepy village." : i == 3 ? "The angry clouds glared at the picnic below." : "The leaves danced across the playground.")'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? "simile" : type == 1 ? "metaphor" : "personification"'
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(type + 1) % 3 == 0 ? "simile" : (type + 1) % 3 == 1 ? "metaphor" : "personification"',
          '(type + 2) % 3 == 0 ? "simile" : (type + 2) % 3 == 1 ? "metaphor" : "personification"'
        ]
      },
      hint: "A simile uses like or as, a metaphor says one thing is another, and personification gives human actions to something that is not human.",
      tags: [
        "AC9E5LE04",
        "EN3-UARL-01"
      ]
    },
    {
      id: "english.5.figurative-language.what-signals-it",
      subject: "english",
      topic: "figurative language",
      level: "5",
      prompt: "What makes this sentence figurative? {sentence}",
      vars: [
        {
          name: "type",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'type == 0 ? (i == 0 ? "The wind roared like a lion through the valley." : i == 1 ? "Her smile was as bright as the morning sun." : i == 2 ? "He ran as fast as a cheetah chasing its prey." : i == 3 ? "The old car rattled like a bag of tin cans." : "Her voice was as smooth as silk.") : type == 1 ? (i == 0 ? "The classroom was a zoo during the fire drill." : i == 1 ? "Time is a thief that steals our best moments." : i == 2 ? "The stars were diamonds scattered across the sky." : i == 3 ? "Her eyes were pools of sparkling water." : "The kitchen was a disaster zone after the party.") : (i == 0 ? "The wind whispered secrets through the trees." : i == 1 ? "The old house groaned when the storm rolled in." : i == 2 ? "The sun smiled down on the sleepy village." : i == 3 ? "The angry clouds glared at the picnic below." : "The leaves danced across the playground.")'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? "the word like or as" : type == 1 ? "saying one thing is another" : "giving human actions to something that is not human"'
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(type + 1) % 3 == 0 ? "the word like or as" : (type + 1) % 3 == 1 ? "saying one thing is another" : "giving human actions to something that is not human"',
          '(type + 2) % 3 == 0 ? "the word like or as" : (type + 2) % 3 == 1 ? "saying one thing is another" : "giving human actions to something that is not human"'
        ]
      },
      hint: "A simile uses like or as, a metaphor says one thing is another, and personification gives human actions to something that is not human.",
      tags: [
        "AC9E5LE04",
        "EN3-UARL-01"
      ]
    },
    {
      id: "english.5.figurative-language.match-the-example",
      subject: "english",
      topic: "figurative language",
      level: "5",
      prompt: "Which sentence is an example of {label}?",
      vars: [
        {
          name: "type",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "i0",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i1",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i2",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "label",
          kind: "expr",
          expr: 'type == 0 ? "simile" : type == 1 ? "metaphor" : "personification"'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? (i0 == 0 ? "The wind roared like a lion through the valley." : i0 == 1 ? "Her smile was as bright as the morning sun." : i0 == 2 ? "He ran as fast as a cheetah chasing its prey." : i0 == 3 ? "The old car rattled like a bag of tin cans." : "Her voice was as smooth as silk.") : type == 1 ? (i0 == 0 ? "The classroom was a zoo during the fire drill." : i0 == 1 ? "Time is a thief that steals our best moments." : i0 == 2 ? "The stars were diamonds scattered across the sky." : i0 == 3 ? "Her eyes were pools of sparkling water." : "The kitchen was a disaster zone after the party.") : (i0 == 0 ? "The wind whispered secrets through the trees." : i0 == 1 ? "The old house groaned when the storm rolled in." : i0 == 2 ? "The sun smiled down on the sleepy village." : i0 == 3 ? "The angry clouds glared at the picnic below." : "The leaves danced across the playground.")'
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(type + 1) % 3 == 0 ? (i1 == 0 ? "The wind roared like a lion through the valley." : i1 == 1 ? "Her smile was as bright as the morning sun." : i1 == 2 ? "He ran as fast as a cheetah chasing its prey." : i1 == 3 ? "The old car rattled like a bag of tin cans." : "Her voice was as smooth as silk.") : (type + 1) % 3 == 1 ? (i1 == 0 ? "The classroom was a zoo during the fire drill." : i1 == 1 ? "Time is a thief that steals our best moments." : i1 == 2 ? "The stars were diamonds scattered across the sky." : i1 == 3 ? "Her eyes were pools of sparkling water." : "The kitchen was a disaster zone after the party.") : (i1 == 0 ? "The wind whispered secrets through the trees." : i1 == 1 ? "The old house groaned when the storm rolled in." : i1 == 2 ? "The sun smiled down on the sleepy village." : i1 == 3 ? "The angry clouds glared at the picnic below." : "The leaves danced across the playground.")',
          '(type + 2) % 3 == 0 ? (i2 == 0 ? "The wind roared like a lion through the valley." : i2 == 1 ? "Her smile was as bright as the morning sun." : i2 == 2 ? "He ran as fast as a cheetah chasing its prey." : i2 == 3 ? "The old car rattled like a bag of tin cans." : "Her voice was as smooth as silk.") : (type + 2) % 3 == 1 ? (i2 == 0 ? "The classroom was a zoo during the fire drill." : i2 == 1 ? "Time is a thief that steals our best moments." : i2 == 2 ? "The stars were diamonds scattered across the sky." : i2 == 3 ? "Her eyes were pools of sparkling water." : "The kitchen was a disaster zone after the party.") : (i2 == 0 ? "The wind whispered secrets through the trees." : i2 == 1 ? "The old house groaned when the storm rolled in." : i2 == 2 ? "The sun smiled down on the sleepy village." : i2 == 3 ? "The angry clouds glared at the picnic below." : "The leaves danced across the playground.")'
        ]
      },
      hint: "A simile uses like or as, a metaphor says one thing is another, and personification gives human actions to something that is not human.",
      tags: [
        "AC9E5LE04",
        "EN3-UARL-01"
      ]
    },
    {
      id: "english.5.figurative-language.same-device",
      subject: "english",
      topic: "figurative language",
      level: "5",
      prompt: "Same figurative language as this one? {sentence}",
      vars: [
        {
          name: "type",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "i0",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "iSame",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "i1",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i2",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'type == 0 ? (i0 == 0 ? "The wind roared like a lion through the valley." : i0 == 1 ? "Her smile was as bright as the morning sun." : i0 == 2 ? "He ran as fast as a cheetah chasing its prey." : i0 == 3 ? "The old car rattled like a bag of tin cans." : "Her voice was as smooth as silk.") : type == 1 ? (i0 == 0 ? "The classroom was a zoo during the fire drill." : i0 == 1 ? "Time is a thief that steals our best moments." : i0 == 2 ? "The stars were diamonds scattered across the sky." : i0 == 3 ? "Her eyes were pools of sparkling water." : "The kitchen was a disaster zone after the party.") : (i0 == 0 ? "The wind whispered secrets through the trees." : i0 == 1 ? "The old house groaned when the storm rolled in." : i0 == 2 ? "The sun smiled down on the sleepy village." : i0 == 3 ? "The angry clouds glared at the picnic below." : "The leaves danced across the playground.")'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? ((i0 + iSame) % 5 == 0 ? "The wind roared like a lion through the valley." : (i0 + iSame) % 5 == 1 ? "Her smile was as bright as the morning sun." : (i0 + iSame) % 5 == 2 ? "He ran as fast as a cheetah chasing its prey." : (i0 + iSame) % 5 == 3 ? "The old car rattled like a bag of tin cans." : "Her voice was as smooth as silk.") : type == 1 ? ((i0 + iSame) % 5 == 0 ? "The classroom was a zoo during the fire drill." : (i0 + iSame) % 5 == 1 ? "Time is a thief that steals our best moments." : (i0 + iSame) % 5 == 2 ? "The stars were diamonds scattered across the sky." : (i0 + iSame) % 5 == 3 ? "Her eyes were pools of sparkling water." : "The kitchen was a disaster zone after the party.") : ((i0 + iSame) % 5 == 0 ? "The wind whispered secrets through the trees." : (i0 + iSame) % 5 == 1 ? "The old house groaned when the storm rolled in." : (i0 + iSame) % 5 == 2 ? "The sun smiled down on the sleepy village." : (i0 + iSame) % 5 == 3 ? "The angry clouds glared at the picnic below." : "The leaves danced across the playground.")'
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(type + 1) % 3 == 0 ? (i1 == 0 ? "The wind roared like a lion through the valley." : i1 == 1 ? "Her smile was as bright as the morning sun." : i1 == 2 ? "He ran as fast as a cheetah chasing its prey." : i1 == 3 ? "The old car rattled like a bag of tin cans." : "Her voice was as smooth as silk.") : (type + 1) % 3 == 1 ? (i1 == 0 ? "The classroom was a zoo during the fire drill." : i1 == 1 ? "Time is a thief that steals our best moments." : i1 == 2 ? "The stars were diamonds scattered across the sky." : i1 == 3 ? "Her eyes were pools of sparkling water." : "The kitchen was a disaster zone after the party.") : (i1 == 0 ? "The wind whispered secrets through the trees." : i1 == 1 ? "The old house groaned when the storm rolled in." : i1 == 2 ? "The sun smiled down on the sleepy village." : i1 == 3 ? "The angry clouds glared at the picnic below." : "The leaves danced across the playground.")',
          '(type + 2) % 3 == 0 ? (i2 == 0 ? "The wind roared like a lion through the valley." : i2 == 1 ? "Her smile was as bright as the morning sun." : i2 == 2 ? "He ran as fast as a cheetah chasing its prey." : i2 == 3 ? "The old car rattled like a bag of tin cans." : "Her voice was as smooth as silk.") : (type + 2) % 3 == 1 ? (i2 == 0 ? "The classroom was a zoo during the fire drill." : i2 == 1 ? "Time is a thief that steals our best moments." : i2 == 2 ? "The stars were diamonds scattered across the sky." : i2 == 3 ? "Her eyes were pools of sparkling water." : "The kitchen was a disaster zone after the party.") : (i2 == 0 ? "The wind whispered secrets through the trees." : i2 == 1 ? "The old house groaned when the storm rolled in." : i2 == 2 ? "The sun smiled down on the sleepy village." : i2 == 3 ? "The angry clouds glared at the picnic below." : "The leaves danced across the playground.")'
        ]
      },
      hint: "Look for what the sentences do, not just what they are about.",
      tags: [
        "AC9E5LE04",
        "EN3-UARL-01"
      ]
    },
    {
      id: "english.5.figurative-language.eliminate-one",
      subject: "english",
      topic: "figurative language",
      level: "5",
      prompt: "This is not a {wrongLabel}. What is it? {sentence}",
      vars: [
        {
          name: "type",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "off",
          kind: "pick",
          from: [
            1,
            2
          ]
        },
        {
          name: "wrongType",
          kind: "expr",
          expr: "(type + off) % 3"
        },
        {
          name: "wrongLabel",
          kind: "expr",
          expr: 'wrongType == 0 ? "simile" : wrongType == 1 ? "metaphor" : "personification"'
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'type == 0 ? (i == 0 ? "The wind roared like a lion through the valley." : i == 1 ? "Her smile was as bright as the morning sun." : i == 2 ? "He ran as fast as a cheetah chasing its prey." : i == 3 ? "The old car rattled like a bag of tin cans." : "Her voice was as smooth as silk.") : type == 1 ? (i == 0 ? "The classroom was a zoo during the fire drill." : i == 1 ? "Time is a thief that steals our best moments." : i == 2 ? "The stars were diamonds scattered across the sky." : i == 3 ? "Her eyes were pools of sparkling water." : "The kitchen was a disaster zone after the party.") : (i == 0 ? "The wind whispered secrets through the trees." : i == 1 ? "The old house groaned when the storm rolled in." : i == 2 ? "The sun smiled down on the sleepy village." : i == 3 ? "The angry clouds glared at the picnic below." : "The leaves danced across the playground.")'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? "simile" : type == 1 ? "metaphor" : "personification"'
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(type + 1) % 3 == 0 ? "simile" : (type + 1) % 3 == 1 ? "metaphor" : "personification"',
          '(type + 2) % 3 == 0 ? "simile" : (type + 2) % 3 == 1 ? "metaphor" : "personification"'
        ]
      },
      hint: "A simile uses like or as, a metaphor says one thing is another, and personification gives human actions to something that is not human.",
      tags: [
        "AC9E5LE04",
        "EN3-UARL-01"
      ]
    },
    {
      id: "english.5.spelling-patterns.write-plural",
      subject: "english",
      topic: "spelling patterns",
      level: "5",
      prompt: "Write the plural of {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'leaf' : i == 1 ? 'wolf' : i == 2 ? 'thief' : i == 3 ? 'life' : i == 4 ? 'shelf' : 'wife'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'leaves' : i == 1 ? 'wolves' : i == 2 ? 'thieves' : i == 3 ? 'lives' : i == 4 ? 'shelves' : 'wives'"
        }
      ],
      answer: "answer",
      answerType: "text",
      hint: "Change the f or fe to v, then add -es.",
      tags: [
        "AC9E5LY08",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.spelling-patterns.write-singular",
      subject: "english",
      topic: "spelling patterns",
      level: "5",
      prompt: "Write the singular of {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'leaves' : i == 1 ? 'wolves' : i == 2 ? 'thieves' : i == 3 ? 'lives' : i == 4 ? 'shelves' : 'wives'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'leaf' : i == 1 ? 'wolf' : i == 2 ? 'thief' : i == 3 ? 'life' : i == 4 ? 'shelf' : 'wife'"
        }
      ],
      answer: "answer",
      answerType: "text",
      hint: "Change the v back to f or fe.",
      tags: [
        "AC9E5LY08",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.spelling-patterns.which-is-plural",
      subject: "english",
      topic: "spelling patterns",
      level: "5",
      prompt: "Which word is the plural of {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'leaf' : i == 1 ? 'wolf' : i == 2 ? 'thief' : i == 3 ? 'life' : i == 4 ? 'shelf' : 'wife'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'leaves' : i == 1 ? 'wolves' : i == 2 ? 'thieves' : i == 3 ? 'lives' : i == 4 ? 'shelves' : 'wives'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'leaves' : (i + d1) % 6 == 1 ? 'wolves' : (i + d1) % 6 == 2 ? 'thieves' : (i + d1) % 6 == 3 ? 'lives' : (i + d1) % 6 == 4 ? 'shelves' : 'wives'",
          "(i + d2) % 6 == 0 ? 'leaves' : (i + d2) % 6 == 1 ? 'wolves' : (i + d2) % 6 == 2 ? 'thieves' : (i + d2) % 6 == 3 ? 'lives' : (i + d2) % 6 == 4 ? 'shelves' : 'wives'"
        ]
      },
      hint: "Change the f or fe to v, then add -es.",
      tags: [
        "AC9E5LY08",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.5.spelling-patterns.same-silent-pattern",
      subject: "english",
      topic: "spelling patterns",
      level: "5",
      prompt: "Which word has the same silent letter pattern as {target}?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "e1",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "e2",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "target",
          kind: "expr",
          expr: "f == 0 ? (t == 0 ? 'knee' : t == 1 ? 'knife' : t == 2 ? 'knot' : t == 3 ? 'knock' : t == 4 ? 'know' : 'knight') : f == 1 ? (t == 0 ? 'wrist' : t == 1 ? 'wrong' : t == 2 ? 'write' : t == 3 ? 'wreck' : t == 4 ? 'wrap' : 'wrinkle') : f == 2 ? (t == 0 ? 'thumb' : t == 1 ? 'climb' : t == 2 ? 'comb' : t == 3 ? 'lamb' : t == 4 ? 'limb' : 'crumb') : f == 3 ? (t == 0 ? 'gnome' : t == 1 ? 'gnat' : t == 2 ? 'sign' : t == 3 ? 'design' : t == 4 ? 'gnaw' : 'foreign') : f == 4 ? (t == 0 ? 'listen' : t == 1 ? 'castle' : t == 2 ? 'often' : t == 3 ? 'fasten' : t == 4 ? 'soften' : 'hasten') : (t == 0 ? 'walk' : t == 1 ? 'talk' : t == 2 ? 'half' : t == 3 ? 'yolk' : t == 4 ? 'chalk' : 'folk')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'knee' : a == 1 ? 'knife' : a == 2 ? 'knot' : a == 3 ? 'knock' : a == 4 ? 'know' : 'knight') : f == 1 ? (a == 0 ? 'wrist' : a == 1 ? 'wrong' : a == 2 ? 'write' : a == 3 ? 'wreck' : a == 4 ? 'wrap' : 'wrinkle') : f == 2 ? (a == 0 ? 'thumb' : a == 1 ? 'climb' : a == 2 ? 'comb' : a == 3 ? 'lamb' : a == 4 ? 'limb' : 'crumb') : f == 3 ? (a == 0 ? 'gnome' : a == 1 ? 'gnat' : a == 2 ? 'sign' : a == 3 ? 'design' : a == 4 ? 'gnaw' : 'foreign') : f == 4 ? (a == 0 ? 'listen' : a == 1 ? 'castle' : a == 2 ? 'often' : a == 3 ? 'fasten' : a == 4 ? 'soften' : 'hasten') : (a == 0 ? 'walk' : a == 1 ? 'talk' : a == 2 ? 'half' : a == 3 ? 'yolk' : a == 4 ? 'chalk' : 'folk')"
        }
      ],
      constraints: [
        "t != a",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 6 == 0 ? (e1 == 0 ? 'knee' : e1 == 1 ? 'knife' : e1 == 2 ? 'knot' : e1 == 3 ? 'knock' : e1 == 4 ? 'know' : 'knight') : (f + d1) % 6 == 1 ? (e1 == 0 ? 'wrist' : e1 == 1 ? 'wrong' : e1 == 2 ? 'write' : e1 == 3 ? 'wreck' : e1 == 4 ? 'wrap' : 'wrinkle') : (f + d1) % 6 == 2 ? (e1 == 0 ? 'thumb' : e1 == 1 ? 'climb' : e1 == 2 ? 'comb' : e1 == 3 ? 'lamb' : e1 == 4 ? 'limb' : 'crumb') : (f + d1) % 6 == 3 ? (e1 == 0 ? 'gnome' : e1 == 1 ? 'gnat' : e1 == 2 ? 'sign' : e1 == 3 ? 'design' : e1 == 4 ? 'gnaw' : 'foreign') : (f + d1) % 6 == 4 ? (e1 == 0 ? 'listen' : e1 == 1 ? 'castle' : e1 == 2 ? 'often' : e1 == 3 ? 'fasten' : e1 == 4 ? 'soften' : 'hasten') : (e1 == 0 ? 'walk' : e1 == 1 ? 'talk' : e1 == 2 ? 'half' : e1 == 3 ? 'yolk' : e1 == 4 ? 'chalk' : 'folk')",
          "(f + d2) % 6 == 0 ? (e2 == 0 ? 'knee' : e2 == 1 ? 'knife' : e2 == 2 ? 'knot' : e2 == 3 ? 'knock' : e2 == 4 ? 'know' : 'knight') : (f + d2) % 6 == 1 ? (e2 == 0 ? 'wrist' : e2 == 1 ? 'wrong' : e2 == 2 ? 'write' : e2 == 3 ? 'wreck' : e2 == 4 ? 'wrap' : 'wrinkle') : (f + d2) % 6 == 2 ? (e2 == 0 ? 'thumb' : e2 == 1 ? 'climb' : e2 == 2 ? 'comb' : e2 == 3 ? 'lamb' : e2 == 4 ? 'limb' : 'crumb') : (f + d2) % 6 == 3 ? (e2 == 0 ? 'gnome' : e2 == 1 ? 'gnat' : e2 == 2 ? 'sign' : e2 == 3 ? 'design' : e2 == 4 ? 'gnaw' : 'foreign') : (f + d2) % 6 == 4 ? (e2 == 0 ? 'listen' : e2 == 1 ? 'castle' : e2 == 2 ? 'often' : e2 == 3 ? 'fasten' : e2 == 4 ? 'soften' : 'hasten') : (e2 == 0 ? 'walk' : e2 == 1 ? 'talk' : e2 == 2 ? 'half' : e2 == 3 ? 'yolk' : e2 == 4 ? 'chalk' : 'folk')"
        ]
      },
      hint: "Look for the same silent letter combination.",
      tags: [
        "AC9E5LY08",
        "EN3-SPELL-01"
      ]
    }
  ]
};

// ../../src/content/packs/english.6.json
var english_6_default = {
  version: "e5b103321590",
  subject: "english",
  level: "6",
  templates: [
    {
      id: "english.6.word-roots.same-root",
      subject: "english",
      topic: "word roots",
      level: "6",
      prompt: "Which word has the same root as {target}?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "t",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "a",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "i1",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "i2",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "target",
          kind: "expr",
          expr: "f == 0 ? (t == 0 ? 'transport' : t == 1 ? 'import' : t == 2 ? 'export' : 'portable') : f == 1 ? (t == 0 ? 'photograph' : t == 1 ? 'autograph' : t == 2 ? 'paragraph' : 'graphic') : f == 2 ? (t == 0 ? 'aquarium' : t == 1 ? 'aquatic' : t == 2 ? 'aqueduct' : 'aquamarine') : f == 3 ? (t == 0 ? 'telephone' : t == 1 ? 'television' : t == 2 ? 'telescope' : 'telepathy') : f == 4 ? (t == 0 ? 'scribble' : t == 1 ? 'ascribe' : t == 2 ? 'inscribe' : 'describe') : (t == 0 ? 'dictionary' : t == 1 ? 'dictator' : t == 2 ? 'predict' : 'verdict')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "f == 0 ? (a == 0 ? 'transport' : a == 1 ? 'import' : a == 2 ? 'export' : 'portable') : f == 1 ? (a == 0 ? 'photograph' : a == 1 ? 'autograph' : a == 2 ? 'paragraph' : 'graphic') : f == 2 ? (a == 0 ? 'aquarium' : a == 1 ? 'aquatic' : a == 2 ? 'aqueduct' : 'aquamarine') : f == 3 ? (a == 0 ? 'telephone' : a == 1 ? 'television' : a == 2 ? 'telescope' : 'telepathy') : f == 4 ? (a == 0 ? 'scribble' : a == 1 ? 'ascribe' : a == 2 ? 'inscribe' : 'describe') : (a == 0 ? 'dictionary' : a == 1 ? 'dictator' : a == 2 ? 'predict' : 'verdict')"
        }
      ],
      constraints: [
        "t != a",
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(f + d1) % 6 == 0 ? (i1 == 0 ? 'transport' : i1 == 1 ? 'import' : i1 == 2 ? 'export' : 'portable') : (f + d1) % 6 == 1 ? (i1 == 0 ? 'photograph' : i1 == 1 ? 'autograph' : i1 == 2 ? 'paragraph' : 'graphic') : (f + d1) % 6 == 2 ? (i1 == 0 ? 'aquarium' : i1 == 1 ? 'aquatic' : i1 == 2 ? 'aqueduct' : 'aquamarine') : (f + d1) % 6 == 3 ? (i1 == 0 ? 'telephone' : i1 == 1 ? 'television' : i1 == 2 ? 'telescope' : 'telepathy') : (f + d1) % 6 == 4 ? (i1 == 0 ? 'scribble' : i1 == 1 ? 'ascribe' : i1 == 2 ? 'inscribe' : 'describe') : (i1 == 0 ? 'dictionary' : i1 == 1 ? 'dictator' : i1 == 2 ? 'predict' : 'verdict')",
          "(f + d2) % 6 == 0 ? (i2 == 0 ? 'transport' : i2 == 1 ? 'import' : i2 == 2 ? 'export' : 'portable') : (f + d2) % 6 == 1 ? (i2 == 0 ? 'photograph' : i2 == 1 ? 'autograph' : i2 == 2 ? 'paragraph' : 'graphic') : (f + d2) % 6 == 2 ? (i2 == 0 ? 'aquarium' : i2 == 1 ? 'aquatic' : i2 == 2 ? 'aqueduct' : 'aquamarine') : (f + d2) % 6 == 3 ? (i2 == 0 ? 'telephone' : i2 == 1 ? 'television' : i2 == 2 ? 'telescope' : 'telepathy') : (f + d2) % 6 == 4 ? (i2 == 0 ? 'scribble' : i2 == 1 ? 'ascribe' : i2 == 2 ? 'inscribe' : 'describe') : (i2 == 0 ? 'dictionary' : i2 == 1 ? 'dictator' : i2 == 2 ? 'predict' : 'verdict')"
        ]
      },
      hint: "Look for the part of the word that stays the same and means the same thing.",
      tags: [
        "AC9E6LY09",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.6.word-roots.which-root-is-in",
      subject: "english",
      topic: "word roots",
      level: "6",
      prompt: "Which root is inside the word {word}?",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "f == 0 ? (i == 0 ? 'transport' : i == 1 ? 'import' : i == 2 ? 'export' : 'portable') : f == 1 ? (i == 0 ? 'photograph' : i == 1 ? 'autograph' : i == 2 ? 'paragraph' : 'graphic') : f == 2 ? (i == 0 ? 'aquarium' : i == 1 ? 'aquatic' : i == 2 ? 'aqueduct' : 'aquamarine') : f == 3 ? (i == 0 ? 'telephone' : i == 1 ? 'television' : i == 2 ? 'telescope' : 'telepathy') : f == 4 ? (i == 0 ? 'scribble' : i == 1 ? 'ascribe' : i == 2 ? 'inscribe' : 'describe') : (i == 0 ? 'dictionary' : i == 1 ? 'dictator' : i == 2 ? 'predict' : 'verdict')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'f == 0 ? "port" : f == 1 ? "graph" : f == 2 ? "aqua" : f == 3 ? "tele" : f == 4 ? "scrib" : "dict"'
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(f + d1) % 6 == 0 ? "port" : (f + d1) % 6 == 1 ? "graph" : (f + d1) % 6 == 2 ? "aqua" : (f + d1) % 6 == 3 ? "tele" : (f + d1) % 6 == 4 ? "scrib" : "dict"',
          '(f + d2) % 6 == 0 ? "port" : (f + d2) % 6 == 1 ? "graph" : (f + d2) % 6 == 2 ? "aqua" : (f + d2) % 6 == 3 ? "tele" : (f + d2) % 6 == 4 ? "scrib" : "dict"'
        ]
      },
      hint: "Look for the meaningful chunk of letters shared by that word family.",
      tags: [
        "AC9E6LY09",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.6.word-roots.root-meaning",
      subject: "english",
      topic: "word roots",
      level: "6",
      prompt: "What does the root {root} mean?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "root",
          kind: "expr",
          expr: 'i == 0 ? "port" : i == 1 ? "aqua" : i == 2 ? "tele" : "dict"'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'i == 0 ? "carry" : i == 1 ? "water" : i == 2 ? "far" : "say"'
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(i + d1) % 4 == 0 ? "carry" : (i + d1) % 4 == 1 ? "water" : (i + d1) % 4 == 2 ? "far" : "say"',
          '(i + d2) % 4 == 0 ? "carry" : (i + d2) % 4 == 1 ? "water" : (i + d2) % 4 == 2 ? "far" : "say"'
        ]
      },
      hint: "Think about what all the words built from that root have in common.",
      tags: [
        "AC9E6LY09",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.6.word-roots.write-root",
      subject: "english",
      topic: "word roots",
      level: "6",
      prompt: "Write the root inside {word}.",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "word",
          kind: "expr",
          expr: "f == 0 ? (i == 0 ? 'transport' : i == 1 ? 'import' : i == 2 ? 'export' : 'portable') : f == 1 ? (i == 0 ? 'photograph' : i == 1 ? 'autograph' : i == 2 ? 'paragraph' : 'graphic') : f == 2 ? (i == 0 ? 'aquarium' : i == 1 ? 'aquatic' : i == 2 ? 'aqueduct' : 'aquamarine') : f == 3 ? (i == 0 ? 'telephone' : i == 1 ? 'television' : i == 2 ? 'telescope' : 'telepathy') : f == 4 ? (i == 0 ? 'scribble' : i == 1 ? 'ascribe' : i == 2 ? 'inscribe' : 'describe') : (i == 0 ? 'dictionary' : i == 1 ? 'dictator' : i == 2 ? 'predict' : 'verdict')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'f == 0 ? "port" : f == 1 ? "graph" : f == 2 ? "aqua" : f == 3 ? "tele" : f == 4 ? "scrib" : "dict"'
        }
      ],
      constraints: [
        "f != 4",
        "!(f == 2 && i == 2)"
      ],
      answer: "answer",
      answerType: "text",
      hint: "Look for the meaningful chunk of letters shared by that word family.",
      tags: [
        "AC9E6LY09",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.6.word-roots.write-meaning",
      subject: "english",
      topic: "word roots",
      level: "6",
      prompt: "Write what the root in {word} means.",
      vars: [
        {
          name: "f",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "word",
          kind: "expr",
          expr: "f == 0 ? (i == 0 ? 'transport' : i == 1 ? 'import' : i == 2 ? 'export' : 'portable') : f == 1 ? (i == 0 ? 'photograph' : i == 1 ? 'autograph' : i == 2 ? 'paragraph' : 'graphic') : f == 2 ? (i == 0 ? 'aquarium' : i == 1 ? 'aquatic' : i == 2 ? 'aqueduct' : 'aquamarine') : f == 3 ? (i == 0 ? 'telephone' : i == 1 ? 'television' : i == 2 ? 'telescope' : 'telepathy') : f == 4 ? (i == 0 ? 'scribble' : i == 1 ? 'ascribe' : i == 2 ? 'inscribe' : 'describe') : (i == 0 ? 'dictionary' : i == 1 ? 'dictator' : i == 2 ? 'predict' : 'verdict')"
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'f == 0 ? "carry" : f == 1 ? "write" : f == 2 ? "water" : f == 3 ? "far" : f == 4 ? "write" : "say"'
        }
      ],
      answer: "answer",
      answerType: "text",
      hint: "Think about what all the words built from that root have in common.",
      tags: [
        "AC9E6LY09",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.6.word-classes.identify-tense",
      subject: "english",
      topic: "word classes",
      level: "6",
      prompt: "Which one is this? {sentence}",
      vars: [
        {
          name: "type",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'type == 0 ? (i == 0 ? "The chef cooked dinner for the whole family." : i == 1 ? "She had finished her homework before dinner." : i == 2 ? "The dog was barking loudly all morning." : "They walked to the park after school.") : type == 1 ? (i == 0 ? "The chef cooks dinner for the whole family." : i == 1 ? "She is finishing her homework before dinner." : i == 2 ? "The dog barks loudly every morning." : "They walk to the park after school.") : (i == 0 ? "The chef will cook dinner for the whole family." : i == 1 ? "She will finish her homework before dinner." : i == 2 ? "The dog will bark loudly tomorrow morning." : "They will walk to the park after school.")'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? "past" : type == 1 ? "present" : "future"'
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(type + 1) % 3 == 0 ? "past" : (type + 1) % 3 == 1 ? "present" : "future"',
          '(type + 2) % 3 == 0 ? "past" : (type + 2) % 3 == 1 ? "present" : "future"'
        ]
      },
      hint: "Look at the verb group to see when the action happens.",
      tags: [
        "AC9E6LA06",
        "EN3-CWT-01"
      ]
    },
    {
      id: "english.6.word-classes.same-tense",
      subject: "english",
      topic: "word classes",
      level: "6",
      prompt: "Which sentence is in the same tense as this one? {sentence}",
      vars: [
        {
          name: "type",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "i0",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "iSame",
          kind: "int",
          min: "1",
          max: "3"
        },
        {
          name: "i1",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "i2",
          kind: "int",
          min: "0",
          max: "3"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'type == 0 ? (i0 == 0 ? "The chef cooked dinner for the whole family." : i0 == 1 ? "She had finished her homework before dinner." : i0 == 2 ? "The dog was barking loudly all morning." : "They walked to the park after school.") : type == 1 ? (i0 == 0 ? "The chef cooks dinner for the whole family." : i0 == 1 ? "She is finishing her homework before dinner." : i0 == 2 ? "The dog barks loudly every morning." : "They walk to the park after school.") : (i0 == 0 ? "The chef will cook dinner for the whole family." : i0 == 1 ? "She will finish her homework before dinner." : i0 == 2 ? "The dog will bark loudly tomorrow morning." : "They will walk to the park after school.")'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? ((i0 + iSame) % 4 == 0 ? "The chef cooked dinner for the whole family." : (i0 + iSame) % 4 == 1 ? "She had finished her homework before dinner." : (i0 + iSame) % 4 == 2 ? "The dog was barking loudly all morning." : "They walked to the park after school.") : type == 1 ? ((i0 + iSame) % 4 == 0 ? "The chef cooks dinner for the whole family." : (i0 + iSame) % 4 == 1 ? "She is finishing her homework before dinner." : (i0 + iSame) % 4 == 2 ? "The dog barks loudly every morning." : "They walk to the park after school.") : ((i0 + iSame) % 4 == 0 ? "The chef will cook dinner for the whole family." : (i0 + iSame) % 4 == 1 ? "She will finish her homework before dinner." : (i0 + iSame) % 4 == 2 ? "The dog will bark loudly tomorrow morning." : "They will walk to the park after school.")'
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(type + 1) % 3 == 0 ? (i1 == 0 ? "The chef cooked dinner for the whole family." : i1 == 1 ? "She had finished her homework before dinner." : i1 == 2 ? "The dog was barking loudly all morning." : "They walked to the park after school.") : (type + 1) % 3 == 1 ? (i1 == 0 ? "The chef cooks dinner for the whole family." : i1 == 1 ? "She is finishing her homework before dinner." : i1 == 2 ? "The dog barks loudly every morning." : "They walk to the park after school.") : (i1 == 0 ? "The chef will cook dinner for the whole family." : i1 == 1 ? "She will finish her homework before dinner." : i1 == 2 ? "The dog will bark loudly tomorrow morning." : "They will walk to the park after school.")',
          '(type + 2) % 3 == 0 ? (i2 == 0 ? "The chef cooked dinner for the whole family." : i2 == 1 ? "She had finished her homework before dinner." : i2 == 2 ? "The dog was barking loudly all morning." : "They walked to the park after school.") : (type + 2) % 3 == 1 ? (i2 == 0 ? "The chef cooks dinner for the whole family." : i2 == 1 ? "She is finishing her homework before dinner." : i2 == 2 ? "The dog barks loudly every morning." : "They walk to the park after school.") : (i2 == 0 ? "The chef will cook dinner for the whole family." : i2 == 1 ? "She will finish her homework before dinner." : i2 == 2 ? "The dog will bark loudly tomorrow morning." : "They will walk to the park after school.")'
        ]
      },
      hint: "Look at what each verb group is doing, not just what the sentence is about.",
      tags: [
        "AC9E6LA06",
        "EN3-CWT-01"
      ]
    },
    {
      id: "english.6.word-classes.which-is-adverb",
      subject: "english",
      topic: "word classes",
      level: "6",
      prompt: "Which of these adverbs is used in this sentence? {sentence}",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'i == 0 ? "She sang beautifully during the concert." : i == 1 ? "The children played quietly in the library." : i == 2 ? "He quickly finished his lunch before class." : i == 3 ? "The old bridge creaked loudly in the storm." : "They arrived early for the school assembly."'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'i == 0 ? "beautifully" : i == 1 ? "quietly" : i == 2 ? "quickly" : i == 3 ? "loudly" : "early"'
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(i + d1) % 5 == 0 ? "beautifully" : (i + d1) % 5 == 1 ? "quietly" : (i + d1) % 5 == 2 ? "quickly" : (i + d1) % 5 == 3 ? "loudly" : "early"',
          '(i + d2) % 5 == 0 ? "beautifully" : (i + d2) % 5 == 1 ? "quietly" : (i + d2) % 5 == 2 ? "quickly" : (i + d2) % 5 == 3 ? "loudly" : "early"'
        ]
      },
      hint: "Find the word that describes how the action happens, and check it is the one used here.",
      tags: [
        "AC9E6LA06",
        "EN3-CWT-01"
      ]
    },
    {
      id: "english.6.word-classes.has-adverb",
      subject: "english",
      topic: "word classes",
      level: "6",
      prompt: "Does this sentence contain an adverb group? {sentence}",
      vars: [
        {
          name: "ok",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'ok == 1 ? (i == 0 ? "She sang beautifully during the concert." : i == 1 ? "The children played quietly in the library." : i == 2 ? "He quickly finished his lunch before class." : i == 3 ? "The old bridge creaked loudly in the storm." : "They arrived early for the school assembly.") : (i == 0 ? "The teacher read a book to the class." : i == 1 ? "The farmer grew vegetables in the field." : i == 2 ? "The builder fixed the broken window." : i == 3 ? "The artist painted a picture of the harbour." : "The baker made bread for the shop.")'
        }
      ],
      answer: "ok == 1",
      hint: "An adverb usually describes how, when or where something happens.",
      tags: [
        "AC9E6LA06",
        "EN3-CWT-01"
      ]
    },
    {
      id: "english.6.figurative-language.identify",
      subject: "english",
      topic: "figurative language",
      level: "6",
      prompt: "Which one is this? {sentence}",
      vars: [
        {
          name: "type",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d3",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'type == 0 ? (i == 0 ? "Her skin was as soft as a rose petal." : i == 1 ? "He fought like a lion to win the match." : i == 2 ? "The lake was as still as glass in the morning." : i == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : type == 1 ? (i == 0 ? "The library was a treasure chest of stories." : i == 1 ? "His words were daggers to her pride." : i == 2 ? "The playground was a battlefield." : i == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : type == 2 ? (i == 0 ? "The fireworks kissed the night sky." : i == 1 ? "The old clock coughed out its final chime." : i == 2 ? "The waves raced each other onto the shore." : i == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : type == 3 ? (i == 0 ? "Grandpa says it is raining cats and dogs." : i == 1 ? "By lunchtime the cat was out of the bag." : i == 2 ? "She told him to break a leg on stage." : i == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : (i == 0 ? "I have told you a million times to tidy up." : i == 1 ? "This backpack weighs a tonne after school." : i == 2 ? "I am so hungry I could eat an elephant." : i == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? "simile" : type == 1 ? "metaphor" : type == 2 ? "personification" : type == 3 ? "idiom" : "hyperbole"'
        }
      ],
      constraints: [
        "d1 != d2",
        "d1 != d3",
        "d2 != d3"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          '(type + d1) % 5 == 0 ? "simile" : (type + d1) % 5 == 1 ? "metaphor" : (type + d1) % 5 == 2 ? "personification" : (type + d1) % 5 == 3 ? "idiom" : "hyperbole"',
          '(type + d2) % 5 == 0 ? "simile" : (type + d2) % 5 == 1 ? "metaphor" : (type + d2) % 5 == 2 ? "personification" : (type + d2) % 5 == 3 ? "idiom" : "hyperbole"',
          '(type + d3) % 5 == 0 ? "simile" : (type + d3) % 5 == 1 ? "metaphor" : (type + d3) % 5 == 2 ? "personification" : (type + d3) % 5 == 3 ? "idiom" : "hyperbole"'
        ]
      },
      hint: "A simile uses like or as, a metaphor says one thing is another, personification gives human actions to something not human, an idiom does not mean its literal words, and hyperbole is a wild exaggeration.",
      tags: [
        "AC9E6LA08",
        "EN3-UARL-01"
      ]
    },
    {
      id: "english.6.figurative-language.what-signals-it",
      subject: "english",
      topic: "figurative language",
      level: "6",
      prompt: "What makes this sentence figurative? {sentence}",
      vars: [
        {
          name: "type",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d3",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'type == 0 ? (i == 0 ? "Her skin was as soft as a rose petal." : i == 1 ? "He fought like a lion to win the match." : i == 2 ? "The lake was as still as glass in the morning." : i == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : type == 1 ? (i == 0 ? "The library was a treasure chest of stories." : i == 1 ? "His words were daggers to her pride." : i == 2 ? "The playground was a battlefield." : i == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : type == 2 ? (i == 0 ? "The fireworks kissed the night sky." : i == 1 ? "The old clock coughed out its final chime." : i == 2 ? "The waves raced each other onto the shore." : i == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : type == 3 ? (i == 0 ? "Grandpa says it is raining cats and dogs." : i == 1 ? "By lunchtime the cat was out of the bag." : i == 2 ? "She told him to break a leg on stage." : i == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : (i == 0 ? "I have told you a million times to tidy up." : i == 1 ? "This backpack weighs a tonne after school." : i == 2 ? "I am so hungry I could eat an elephant." : i == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? "the word like or as" : type == 1 ? "saying one thing is another thing" : type == 2 ? "giving human actions to something that is not human" : type == 3 ? "a saying whose words do not mean what they seem to say" : "a wild exaggeration not meant to be taken literally"'
        }
      ],
      constraints: [
        "d1 != d2",
        "d1 != d3",
        "d2 != d3"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          '(type + d1) % 5 == 0 ? "the word like or as" : (type + d1) % 5 == 1 ? "saying one thing is another thing" : (type + d1) % 5 == 2 ? "giving human actions to something that is not human" : (type + d1) % 5 == 3 ? "a saying whose words do not mean what they seem to say" : "a wild exaggeration not meant to be taken literally"',
          '(type + d2) % 5 == 0 ? "the word like or as" : (type + d2) % 5 == 1 ? "saying one thing is another thing" : (type + d2) % 5 == 2 ? "giving human actions to something that is not human" : (type + d2) % 5 == 3 ? "a saying whose words do not mean what they seem to say" : "a wild exaggeration not meant to be taken literally"',
          '(type + d3) % 5 == 0 ? "the word like or as" : (type + d3) % 5 == 1 ? "saying one thing is another thing" : (type + d3) % 5 == 2 ? "giving human actions to something that is not human" : (type + d3) % 5 == 3 ? "a saying whose words do not mean what they seem to say" : "a wild exaggeration not meant to be taken literally"'
        ]
      },
      hint: "A simile uses like or as, a metaphor says one thing is another, personification gives human actions to something not human, an idiom does not mean its literal words, and hyperbole is a wild exaggeration.",
      tags: [
        "AC9E6LA08",
        "EN3-UARL-01"
      ]
    },
    {
      id: "english.6.figurative-language.match-the-example",
      subject: "english",
      topic: "figurative language",
      level: "6",
      prompt: "Which sentence is an example of {label}?",
      vars: [
        {
          name: "type",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i0",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d3",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "i1",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i2",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i3",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "label",
          kind: "expr",
          expr: 'type == 0 ? "simile" : type == 1 ? "metaphor" : type == 2 ? "personification" : type == 3 ? "idiom" : "hyperbole"'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? (i0 == 0 ? "Her skin was as soft as a rose petal." : i0 == 1 ? "He fought like a lion to win the match." : i0 == 2 ? "The lake was as still as glass in the morning." : i0 == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : type == 1 ? (i0 == 0 ? "The library was a treasure chest of stories." : i0 == 1 ? "His words were daggers to her pride." : i0 == 2 ? "The playground was a battlefield." : i0 == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : type == 2 ? (i0 == 0 ? "The fireworks kissed the night sky." : i0 == 1 ? "The old clock coughed out its final chime." : i0 == 2 ? "The waves raced each other onto the shore." : i0 == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : type == 3 ? (i0 == 0 ? "Grandpa says it is raining cats and dogs." : i0 == 1 ? "By lunchtime the cat was out of the bag." : i0 == 2 ? "She told him to break a leg on stage." : i0 == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : (i0 == 0 ? "I have told you a million times to tidy up." : i0 == 1 ? "This backpack weighs a tonne after school." : i0 == 2 ? "I am so hungry I could eat an elephant." : i0 == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")'
        }
      ],
      constraints: [
        "d1 != d2",
        "d1 != d3",
        "d2 != d3"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          '(type + d1) % 5 == 0 ? (i1 == 0 ? "Her skin was as soft as a rose petal." : i1 == 1 ? "He fought like a lion to win the match." : i1 == 2 ? "The lake was as still as glass in the morning." : i1 == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : (type + d1) % 5 == 1 ? (i1 == 0 ? "The library was a treasure chest of stories." : i1 == 1 ? "His words were daggers to her pride." : i1 == 2 ? "The playground was a battlefield." : i1 == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : (type + d1) % 5 == 2 ? (i1 == 0 ? "The fireworks kissed the night sky." : i1 == 1 ? "The old clock coughed out its final chime." : i1 == 2 ? "The waves raced each other onto the shore." : i1 == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : (type + d1) % 5 == 3 ? (i1 == 0 ? "Grandpa says it is raining cats and dogs." : i1 == 1 ? "By lunchtime the cat was out of the bag." : i1 == 2 ? "She told him to break a leg on stage." : i1 == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : (i1 == 0 ? "I have told you a million times to tidy up." : i1 == 1 ? "This backpack weighs a tonne after school." : i1 == 2 ? "I am so hungry I could eat an elephant." : i1 == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")',
          '(type + d2) % 5 == 0 ? (i2 == 0 ? "Her skin was as soft as a rose petal." : i2 == 1 ? "He fought like a lion to win the match." : i2 == 2 ? "The lake was as still as glass in the morning." : i2 == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : (type + d2) % 5 == 1 ? (i2 == 0 ? "The library was a treasure chest of stories." : i2 == 1 ? "His words were daggers to her pride." : i2 == 2 ? "The playground was a battlefield." : i2 == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : (type + d2) % 5 == 2 ? (i2 == 0 ? "The fireworks kissed the night sky." : i2 == 1 ? "The old clock coughed out its final chime." : i2 == 2 ? "The waves raced each other onto the shore." : i2 == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : (type + d2) % 5 == 3 ? (i2 == 0 ? "Grandpa says it is raining cats and dogs." : i2 == 1 ? "By lunchtime the cat was out of the bag." : i2 == 2 ? "She told him to break a leg on stage." : i2 == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : (i2 == 0 ? "I have told you a million times to tidy up." : i2 == 1 ? "This backpack weighs a tonne after school." : i2 == 2 ? "I am so hungry I could eat an elephant." : i2 == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")',
          '(type + d3) % 5 == 0 ? (i3 == 0 ? "Her skin was as soft as a rose petal." : i3 == 1 ? "He fought like a lion to win the match." : i3 == 2 ? "The lake was as still as glass in the morning." : i3 == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : (type + d3) % 5 == 1 ? (i3 == 0 ? "The library was a treasure chest of stories." : i3 == 1 ? "His words were daggers to her pride." : i3 == 2 ? "The playground was a battlefield." : i3 == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : (type + d3) % 5 == 2 ? (i3 == 0 ? "The fireworks kissed the night sky." : i3 == 1 ? "The old clock coughed out its final chime." : i3 == 2 ? "The waves raced each other onto the shore." : i3 == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : (type + d3) % 5 == 3 ? (i3 == 0 ? "Grandpa says it is raining cats and dogs." : i3 == 1 ? "By lunchtime the cat was out of the bag." : i3 == 2 ? "She told him to break a leg on stage." : i3 == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : (i3 == 0 ? "I have told you a million times to tidy up." : i3 == 1 ? "This backpack weighs a tonne after school." : i3 == 2 ? "I am so hungry I could eat an elephant." : i3 == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")'
        ]
      },
      hint: "A simile uses like or as, a metaphor says one thing is another, personification gives human actions to something not human, an idiom does not mean its literal words, and hyperbole is a wild exaggeration.",
      tags: [
        "AC9E6LA08",
        "EN3-UARL-01"
      ]
    },
    {
      id: "english.6.figurative-language.same-device",
      subject: "english",
      topic: "figurative language",
      level: "6",
      prompt: "Same figurative language as this one? {sentence}",
      vars: [
        {
          name: "type",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i0",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "iSame",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d3",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "i1",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i2",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i3",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'type == 0 ? (i0 == 0 ? "Her skin was as soft as a rose petal." : i0 == 1 ? "He fought like a lion to win the match." : i0 == 2 ? "The lake was as still as glass in the morning." : i0 == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : type == 1 ? (i0 == 0 ? "The library was a treasure chest of stories." : i0 == 1 ? "His words were daggers to her pride." : i0 == 2 ? "The playground was a battlefield." : i0 == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : type == 2 ? (i0 == 0 ? "The fireworks kissed the night sky." : i0 == 1 ? "The old clock coughed out its final chime." : i0 == 2 ? "The waves raced each other onto the shore." : i0 == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : type == 3 ? (i0 == 0 ? "Grandpa says it is raining cats and dogs." : i0 == 1 ? "By lunchtime the cat was out of the bag." : i0 == 2 ? "She told him to break a leg on stage." : i0 == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : (i0 == 0 ? "I have told you a million times to tidy up." : i0 == 1 ? "This backpack weighs a tonne after school." : i0 == 2 ? "I am so hungry I could eat an elephant." : i0 == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? ((i0 + iSame) % 5 == 0 ? "Her skin was as soft as a rose petal." : (i0 + iSame) % 5 == 1 ? "He fought like a lion to win the match." : (i0 + iSame) % 5 == 2 ? "The lake was as still as glass in the morning." : (i0 + iSame) % 5 == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : type == 1 ? ((i0 + iSame) % 5 == 0 ? "The library was a treasure chest of stories." : (i0 + iSame) % 5 == 1 ? "His words were daggers to her pride." : (i0 + iSame) % 5 == 2 ? "The playground was a battlefield." : (i0 + iSame) % 5 == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : type == 2 ? ((i0 + iSame) % 5 == 0 ? "The fireworks kissed the night sky." : (i0 + iSame) % 5 == 1 ? "The old clock coughed out its final chime." : (i0 + iSame) % 5 == 2 ? "The waves raced each other onto the shore." : (i0 + iSame) % 5 == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : type == 3 ? ((i0 + iSame) % 5 == 0 ? "Grandpa says it is raining cats and dogs." : (i0 + iSame) % 5 == 1 ? "By lunchtime the cat was out of the bag." : (i0 + iSame) % 5 == 2 ? "She told him to break a leg on stage." : (i0 + iSame) % 5 == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : ((i0 + iSame) % 5 == 0 ? "I have told you a million times to tidy up." : (i0 + iSame) % 5 == 1 ? "This backpack weighs a tonne after school." : (i0 + iSame) % 5 == 2 ? "I am so hungry I could eat an elephant." : (i0 + iSame) % 5 == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")'
        }
      ],
      constraints: [
        "d1 != d2",
        "d1 != d3",
        "d2 != d3"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          '(type + d1) % 5 == 0 ? (i1 == 0 ? "Her skin was as soft as a rose petal." : i1 == 1 ? "He fought like a lion to win the match." : i1 == 2 ? "The lake was as still as glass in the morning." : i1 == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : (type + d1) % 5 == 1 ? (i1 == 0 ? "The library was a treasure chest of stories." : i1 == 1 ? "His words were daggers to her pride." : i1 == 2 ? "The playground was a battlefield." : i1 == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : (type + d1) % 5 == 2 ? (i1 == 0 ? "The fireworks kissed the night sky." : i1 == 1 ? "The old clock coughed out its final chime." : i1 == 2 ? "The waves raced each other onto the shore." : i1 == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : (type + d1) % 5 == 3 ? (i1 == 0 ? "Grandpa says it is raining cats and dogs." : i1 == 1 ? "By lunchtime the cat was out of the bag." : i1 == 2 ? "She told him to break a leg on stage." : i1 == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : (i1 == 0 ? "I have told you a million times to tidy up." : i1 == 1 ? "This backpack weighs a tonne after school." : i1 == 2 ? "I am so hungry I could eat an elephant." : i1 == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")',
          '(type + d2) % 5 == 0 ? (i2 == 0 ? "Her skin was as soft as a rose petal." : i2 == 1 ? "He fought like a lion to win the match." : i2 == 2 ? "The lake was as still as glass in the morning." : i2 == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : (type + d2) % 5 == 1 ? (i2 == 0 ? "The library was a treasure chest of stories." : i2 == 1 ? "His words were daggers to her pride." : i2 == 2 ? "The playground was a battlefield." : i2 == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : (type + d2) % 5 == 2 ? (i2 == 0 ? "The fireworks kissed the night sky." : i2 == 1 ? "The old clock coughed out its final chime." : i2 == 2 ? "The waves raced each other onto the shore." : i2 == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : (type + d2) % 5 == 3 ? (i2 == 0 ? "Grandpa says it is raining cats and dogs." : i2 == 1 ? "By lunchtime the cat was out of the bag." : i2 == 2 ? "She told him to break a leg on stage." : i2 == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : (i2 == 0 ? "I have told you a million times to tidy up." : i2 == 1 ? "This backpack weighs a tonne after school." : i2 == 2 ? "I am so hungry I could eat an elephant." : i2 == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")',
          '(type + d3) % 5 == 0 ? (i3 == 0 ? "Her skin was as soft as a rose petal." : i3 == 1 ? "He fought like a lion to win the match." : i3 == 2 ? "The lake was as still as glass in the morning." : i3 == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : (type + d3) % 5 == 1 ? (i3 == 0 ? "The library was a treasure chest of stories." : i3 == 1 ? "His words were daggers to her pride." : i3 == 2 ? "The playground was a battlefield." : i3 == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : (type + d3) % 5 == 2 ? (i3 == 0 ? "The fireworks kissed the night sky." : i3 == 1 ? "The old clock coughed out its final chime." : i3 == 2 ? "The waves raced each other onto the shore." : i3 == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : (type + d3) % 5 == 3 ? (i3 == 0 ? "Grandpa says it is raining cats and dogs." : i3 == 1 ? "By lunchtime the cat was out of the bag." : i3 == 2 ? "She told him to break a leg on stage." : i3 == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : (i3 == 0 ? "I have told you a million times to tidy up." : i3 == 1 ? "This backpack weighs a tonne after school." : i3 == 2 ? "I am so hungry I could eat an elephant." : i3 == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")'
        ]
      },
      hint: "Look at what each sentence does, not just what it is about.",
      tags: [
        "AC9E6LA08",
        "EN3-UARL-01"
      ]
    },
    {
      id: "english.6.figurative-language.eliminate-one",
      subject: "english",
      topic: "figurative language",
      level: "6",
      prompt: "Not {wrongLabel}. Which one is it? {sentence}",
      vars: [
        {
          name: "type",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "off",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "d3",
          kind: "int",
          min: "1",
          max: "4"
        },
        {
          name: "wrongType",
          kind: "expr",
          expr: "(type + off) % 5"
        },
        {
          name: "wrongLabel",
          kind: "expr",
          expr: 'wrongType == 0 ? "simile" : wrongType == 1 ? "metaphor" : wrongType == 2 ? "personification" : wrongType == 3 ? "idiom" : "hyperbole"'
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'type == 0 ? (i == 0 ? "Her skin was as soft as a rose petal." : i == 1 ? "He fought like a lion to win the match." : i == 2 ? "The lake was as still as glass in the morning." : i == 3 ? "She moved through the crowd like a shadow." : "The ice was as cold as a winter night.") : type == 1 ? (i == 0 ? "The library was a treasure chest of stories." : i == 1 ? "His words were daggers to her pride." : i == 2 ? "The playground was a battlefield." : i == 3 ? "Her laughter was music in the house." : "The city streets were rivers of moving cars.") : type == 2 ? (i == 0 ? "The fireworks kissed the night sky." : i == 1 ? "The old clock coughed out its final chime." : i == 2 ? "The waves raced each other onto the shore." : i == 3 ? "The garden gate creaked a complaint." : "The storm clouds argued loudly overhead.") : type == 3 ? (i == 0 ? "Grandpa says it is raining cats and dogs." : i == 1 ? "By lunchtime the cat was out of the bag." : i == 2 ? "She told him to break a leg on stage." : i == 3 ? "After the flight he felt under the weather." : "Our class had to hit the books all week.") : (i == 0 ? "I have told you a million times to tidy up." : i == 1 ? "This backpack weighs a tonne after school." : i == 2 ? "I am so hungry I could eat an elephant." : i == 3 ? "Grandma is older than the mountains." : "The queue went on forever and ever.")'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'type == 0 ? "simile" : type == 1 ? "metaphor" : type == 2 ? "personification" : type == 3 ? "idiom" : "hyperbole"'
        }
      ],
      constraints: [
        "off != d1",
        "off != d2",
        "off != d3",
        "d1 != d2",
        "d1 != d3",
        "d2 != d3"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 4,
        distractors: [
          '(type + d1) % 5 == 0 ? "simile" : (type + d1) % 5 == 1 ? "metaphor" : (type + d1) % 5 == 2 ? "personification" : (type + d1) % 5 == 3 ? "idiom" : "hyperbole"',
          '(type + d2) % 5 == 0 ? "simile" : (type + d2) % 5 == 1 ? "metaphor" : (type + d2) % 5 == 2 ? "personification" : (type + d2) % 5 == 3 ? "idiom" : "hyperbole"',
          '(type + d3) % 5 == 0 ? "simile" : (type + d3) % 5 == 1 ? "metaphor" : (type + d3) % 5 == 2 ? "personification" : (type + d3) % 5 == 3 ? "idiom" : "hyperbole"'
        ]
      },
      hint: "A simile uses like or as, a metaphor says one thing is another, personification gives human actions to something not human, an idiom does not mean its literal words, and hyperbole is a wild exaggeration.",
      tags: [
        "AC9E6LA08",
        "EN3-UARL-01"
      ]
    },
    {
      id: "english.6.punctuation.list-issue",
      subject: "english",
      topic: "punctuation",
      level: "6",
      prompt: "Which sentence {label} in its list?",
      vars: [
        {
          name: "cat",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "i0",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i1",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i2",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "label",
          kind: "expr",
          expr: 'cat == 0 ? "is punctuated correctly" : cat == 1 ? "is missing a comma" : "has a comma in the wrong place"'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'cat == 0 ? (i0 == 0 ? "We packed apples, bananas and grapes for the picnic." : i0 == 1 ? "The zoo has lions, tigers and bears in the north wing." : i0 == 2 ? "She bought pencils, rulers and erasers for school." : i0 == 3 ? "We saw dolphins, turtles and seals at the aquarium." : "The recipe needs flour, sugar and butter for the cake.") : cat == 1 ? (i0 == 0 ? "We packed apples bananas and grapes for the picnic." : i0 == 1 ? "The zoo has lions tigers and bears in the north wing." : i0 == 2 ? "She bought pencils rulers and erasers for school." : i0 == 3 ? "We saw dolphins turtles and seals at the aquarium." : "The recipe needs flour sugar and butter for the cake.") : (i0 == 0 ? "We packed apples, bananas and, grapes for the picnic." : i0 == 1 ? "The zoo has lions, tigers and, bears in the north wing." : i0 == 2 ? "She bought pencils, rulers and, erasers for school." : i0 == 3 ? "We saw dolphins, turtles and, seals at the aquarium." : "The recipe needs flour, sugar and, butter for the cake.")'
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(cat + 1) % 3 == 0 ? (i1 == 0 ? "We packed apples, bananas and grapes for the picnic." : i1 == 1 ? "The zoo has lions, tigers and bears in the north wing." : i1 == 2 ? "She bought pencils, rulers and erasers for school." : i1 == 3 ? "We saw dolphins, turtles and seals at the aquarium." : "The recipe needs flour, sugar and butter for the cake.") : (cat + 1) % 3 == 1 ? (i1 == 0 ? "We packed apples bananas and grapes for the picnic." : i1 == 1 ? "The zoo has lions tigers and bears in the north wing." : i1 == 2 ? "She bought pencils rulers and erasers for school." : i1 == 3 ? "We saw dolphins turtles and seals at the aquarium." : "The recipe needs flour sugar and butter for the cake.") : (i1 == 0 ? "We packed apples, bananas and, grapes for the picnic." : i1 == 1 ? "The zoo has lions, tigers and, bears in the north wing." : i1 == 2 ? "She bought pencils, rulers and, erasers for school." : i1 == 3 ? "We saw dolphins, turtles and, seals at the aquarium." : "The recipe needs flour, sugar and, butter for the cake.")',
          '(cat + 2) % 3 == 0 ? (i2 == 0 ? "We packed apples, bananas and grapes for the picnic." : i2 == 1 ? "The zoo has lions, tigers and bears in the north wing." : i2 == 2 ? "She bought pencils, rulers and erasers for school." : i2 == 3 ? "We saw dolphins, turtles and seals at the aquarium." : "The recipe needs flour, sugar and butter for the cake.") : (cat + 2) % 3 == 1 ? (i2 == 0 ? "We packed apples bananas and grapes for the picnic." : i2 == 1 ? "The zoo has lions tigers and bears in the north wing." : i2 == 2 ? "She bought pencils rulers and erasers for school." : i2 == 3 ? "We saw dolphins turtles and seals at the aquarium." : "The recipe needs flour sugar and butter for the cake.") : (i2 == 0 ? "We packed apples, bananas and, grapes for the picnic." : i2 == 1 ? "The zoo has lions, tigers and, bears in the north wing." : i2 == 2 ? "She bought pencils, rulers and, erasers for school." : i2 == 3 ? "We saw dolphins, turtles and, seals at the aquarium." : "The recipe needs flour, sugar and, butter for the cake.")'
        ]
      },
      hint: "Put a comma after every item in the list except the last one.",
      tags: [
        "AC9E6LA09",
        "EN3-CWT-01"
      ]
    },
    {
      id: "english.6.punctuation.clause-issue",
      subject: "english",
      topic: "punctuation",
      level: "6",
      prompt: "Which sentence {label} after its opening clause?",
      vars: [
        {
          name: "cat",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "i0",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i1",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i2",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "label",
          kind: "expr",
          expr: 'cat == 0 ? "is punctuated correctly" : cat == 1 ? "is missing a comma" : "has a comma in the wrong place"'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'cat == 0 ? (i0 == 0 ? "After the game finished, the players shook hands." : i0 == 1 ? "Although it was raining, the match went ahead." : i0 == 2 ? "Before the bell rang, the students packed their bags." : i0 == 3 ? "Since the bus was late, we walked to school instead." : "While the teacher spoke, the class listened quietly.") : cat == 1 ? (i0 == 0 ? "After the game finished the players shook hands." : i0 == 1 ? "Although it was raining the match went ahead." : i0 == 2 ? "Before the bell rang the students packed their bags." : i0 == 3 ? "Since the bus was late we walked to school instead." : "While the teacher spoke the class listened quietly.") : (i0 == 0 ? "After the game, finished the players shook hands." : i0 == 1 ? "Although it, was raining the match went ahead." : i0 == 2 ? "Before the bell, rang the students packed their bags." : i0 == 3 ? "Since the bus, was late we walked to school instead." : "While the teacher, spoke the class listened quietly.")'
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(cat + 1) % 3 == 0 ? (i1 == 0 ? "After the game finished, the players shook hands." : i1 == 1 ? "Although it was raining, the match went ahead." : i1 == 2 ? "Before the bell rang, the students packed their bags." : i1 == 3 ? "Since the bus was late, we walked to school instead." : "While the teacher spoke, the class listened quietly.") : (cat + 1) % 3 == 1 ? (i1 == 0 ? "After the game finished the players shook hands." : i1 == 1 ? "Although it was raining the match went ahead." : i1 == 2 ? "Before the bell rang the students packed their bags." : i1 == 3 ? "Since the bus was late we walked to school instead." : "While the teacher spoke the class listened quietly.") : (i1 == 0 ? "After the game, finished the players shook hands." : i1 == 1 ? "Although it, was raining the match went ahead." : i1 == 2 ? "Before the bell, rang the students packed their bags." : i1 == 3 ? "Since the bus, was late we walked to school instead." : "While the teacher, spoke the class listened quietly.")',
          '(cat + 2) % 3 == 0 ? (i2 == 0 ? "After the game finished, the players shook hands." : i2 == 1 ? "Although it was raining, the match went ahead." : i2 == 2 ? "Before the bell rang, the students packed their bags." : i2 == 3 ? "Since the bus was late, we walked to school instead." : "While the teacher spoke, the class listened quietly.") : (cat + 2) % 3 == 1 ? (i2 == 0 ? "After the game finished the players shook hands." : i2 == 1 ? "Although it was raining the match went ahead." : i2 == 2 ? "Before the bell rang the students packed their bags." : i2 == 3 ? "Since the bus was late we walked to school instead." : "While the teacher spoke the class listened quietly.") : (i2 == 0 ? "After the game, finished the players shook hands." : i2 == 1 ? "Although it, was raining the match went ahead." : i2 == 2 ? "Before the bell, rang the students packed their bags." : i2 == 3 ? "Since the bus, was late we walked to school instead." : "While the teacher, spoke the class listened quietly.")'
        ]
      },
      hint: "A comma follows the opening clause, before the main part of the sentence begins.",
      tags: [
        "AC9E6LA09",
        "EN3-CWT-01"
      ]
    },
    {
      id: "english.6.punctuation.compound-issue",
      subject: "english",
      topic: "punctuation",
      level: "6",
      prompt: "Which sentence is {label} before the joining word?",
      vars: [
        {
          name: "cat",
          kind: "pick",
          from: [
            0,
            1
          ]
        },
        {
          name: "i0",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "i1",
          kind: "int",
          min: "0",
          max: "4"
        },
        {
          name: "label",
          kind: "expr",
          expr: 'cat == 0 ? "punctuated correctly" : "missing a comma"'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'cat == 0 ? (i0 == 0 ? "The rain stopped, but the sun did not come out." : i0 == 1 ? "She wanted to go outside, but it started to rain." : i0 == 2 ? "The team trained hard, and they won the final." : i0 == 3 ? "He forgot his lunch, so he borrowed some money." : "The power went out, but the lights came back on soon.") : (i0 == 0 ? "The rain stopped but the sun did not come out." : i0 == 1 ? "She wanted to go outside but it started to rain." : i0 == 2 ? "The team trained hard and they won the final." : i0 == 3 ? "He forgot his lunch so he borrowed some money." : "The power went out but the lights came back on soon.")'
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 2,
        distractors: [
          '1 - cat == 0 ? (i1 == 0 ? "The rain stopped, but the sun did not come out." : i1 == 1 ? "She wanted to go outside, but it started to rain." : i1 == 2 ? "The team trained hard, and they won the final." : i1 == 3 ? "He forgot his lunch, so he borrowed some money." : "The power went out, but the lights came back on soon.") : (i1 == 0 ? "The rain stopped but the sun did not come out." : i1 == 1 ? "She wanted to go outside but it started to rain." : i1 == 2 ? "The team trained hard and they won the final." : i1 == 3 ? "He forgot his lunch so he borrowed some money." : "The power went out but the lights came back on soon.")'
        ]
      },
      hint: "Two complete sentences joined by and, but or so need a comma before the joining word.",
      tags: [
        "AC9E6LA09",
        "EN3-CWT-01"
      ]
    },
    {
      id: "english.6.punctuation.identify-issue",
      subject: "english",
      topic: "punctuation",
      level: "6",
      prompt: "What is true of the commas in this sentence? {sentence}",
      vars: [
        {
          name: "cat",
          kind: "pick",
          from: [
            0,
            1,
            2
          ]
        },
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "9"
        },
        {
          name: "sentence",
          kind: "expr",
          expr: 'cat == 0 ? (i == 0 ? "We packed apples, bananas and grapes for the picnic." : i == 1 ? "The zoo has lions, tigers and bears in the north wing." : i == 2 ? "She bought pencils, rulers and erasers for school." : i == 3 ? "We saw dolphins, turtles and seals at the aquarium." : i == 4 ? "The recipe needs flour, sugar and butter for the cake." : i == 5 ? "After the game finished, the players shook hands." : i == 6 ? "Although it was raining, the match went ahead." : i == 7 ? "Before the bell rang, the students packed their bags." : i == 8 ? "Since the bus was late, we walked to school instead." : "While the teacher spoke, the class listened quietly.") : cat == 1 ? (i == 0 ? "We packed apples bananas and grapes for the picnic." : i == 1 ? "The zoo has lions tigers and bears in the north wing." : i == 2 ? "She bought pencils rulers and erasers for school." : i == 3 ? "We saw dolphins turtles and seals at the aquarium." : i == 4 ? "The recipe needs flour sugar and butter for the cake." : i == 5 ? "After the game finished the players shook hands." : i == 6 ? "Although it was raining the match went ahead." : i == 7 ? "Before the bell rang the students packed their bags." : i == 8 ? "Since the bus was late we walked to school instead." : "While the teacher spoke the class listened quietly.") : (i == 0 ? "We packed apples, bananas and, grapes for the picnic." : i == 1 ? "The zoo has lions, tigers and, bears in the north wing." : i == 2 ? "She bought pencils, rulers and, erasers for school." : i == 3 ? "We saw dolphins, turtles and, seals at the aquarium." : i == 4 ? "The recipe needs flour, sugar and, butter for the cake." : i == 5 ? "After the game, finished the players shook hands." : i == 6 ? "Although it, was raining the match went ahead." : i == 7 ? "Before the bell, rang the students packed their bags." : i == 8 ? "Since the bus, was late we walked to school instead." : "While the teacher, spoke the class listened quietly.")'
        },
        {
          name: "answer",
          kind: "expr",
          expr: 'cat == 0 ? "punctuated correctly" : cat == 1 ? "missing a comma" : "with a comma in the wrong place"'
        }
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          '(cat + 1) % 3 == 0 ? "punctuated correctly" : (cat + 1) % 3 == 1 ? "missing a comma" : "with a comma in the wrong place"',
          '(cat + 2) % 3 == 0 ? "punctuated correctly" : (cat + 2) % 3 == 1 ? "missing a comma" : "with a comma in the wrong place"'
        ]
      },
      hint: "Check whether every comma is needed, missing, or in the wrong place.",
      tags: [
        "AC9E6LA09",
        "EN3-CWT-01"
      ]
    },
    {
      id: "english.6.spelling-patterns.write-doubled-ing",
      subject: "english",
      topic: "spelling patterns",
      level: "6",
      prompt: "Write the word formed by adding -ing to {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'run' : i == 1 ? 'stop' : i == 2 ? 'plan' : i == 3 ? 'drop' : i == 4 ? 'swim' : 'grab'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'running' : i == 1 ? 'stopping' : i == 2 ? 'planning' : i == 3 ? 'dropping' : i == 4 ? 'swimming' : 'grabbing'"
        }
      ],
      answer: "answer",
      answerType: "text",
      hint: "Double the final consonant before adding -ing.",
      tags: [
        "AC9E6LY08",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.6.spelling-patterns.which-is-doubled-ing",
      subject: "english",
      topic: "spelling patterns",
      level: "6",
      prompt: "Which word is formed by adding -ing to {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'run' : i == 1 ? 'stop' : i == 2 ? 'plan' : i == 3 ? 'drop' : i == 4 ? 'swim' : 'grab'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'running' : i == 1 ? 'stopping' : i == 2 ? 'planning' : i == 3 ? 'dropping' : i == 4 ? 'swimming' : 'grabbing'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'running' : (i + d1) % 6 == 1 ? 'stopping' : (i + d1) % 6 == 2 ? 'planning' : (i + d1) % 6 == 3 ? 'dropping' : (i + d1) % 6 == 4 ? 'swimming' : 'grabbing'",
          "(i + d2) % 6 == 0 ? 'running' : (i + d2) % 6 == 1 ? 'stopping' : (i + d2) % 6 == 2 ? 'planning' : (i + d2) % 6 == 3 ? 'dropping' : (i + d2) % 6 == 4 ? 'swimming' : 'grabbing'"
        ]
      },
      hint: "Double the final consonant before adding -ing.",
      tags: [
        "AC9E6LY08",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.6.spelling-patterns.write-plural-y",
      subject: "english",
      topic: "spelling patterns",
      level: "6",
      prompt: "Write the plural of {word}.",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'baby' : i == 1 ? 'city' : i == 2 ? 'puppy' : i == 3 ? 'story' : i == 4 ? 'family' : 'country'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'babies' : i == 1 ? 'cities' : i == 2 ? 'puppies' : i == 3 ? 'stories' : i == 4 ? 'families' : 'countries'"
        }
      ],
      answer: "answer",
      answerType: "text",
      hint: "Change the y to i, then add -es.",
      tags: [
        "AC9E6LY08",
        "EN3-SPELL-01"
      ]
    },
    {
      id: "english.6.spelling-patterns.which-is-plural-y",
      subject: "english",
      topic: "spelling patterns",
      level: "6",
      prompt: "Which word is the plural of {word}?",
      vars: [
        {
          name: "i",
          kind: "int",
          min: "0",
          max: "5"
        },
        {
          name: "d1",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "d2",
          kind: "int",
          min: "1",
          max: "5"
        },
        {
          name: "word",
          kind: "expr",
          expr: "i == 0 ? 'baby' : i == 1 ? 'city' : i == 2 ? 'puppy' : i == 3 ? 'story' : i == 4 ? 'family' : 'country'"
        },
        {
          name: "answer",
          kind: "expr",
          expr: "i == 0 ? 'babies' : i == 1 ? 'cities' : i == 2 ? 'puppies' : i == 3 ? 'stories' : i == 4 ? 'families' : 'countries'"
        }
      ],
      constraints: [
        "d1 != d2"
      ],
      answer: "answer",
      answerType: "choice",
      choices: {
        count: 3,
        distractors: [
          "(i + d1) % 6 == 0 ? 'babies' : (i + d1) % 6 == 1 ? 'cities' : (i + d1) % 6 == 2 ? 'puppies' : (i + d1) % 6 == 3 ? 'stories' : (i + d1) % 6 == 4 ? 'families' : 'countries'",
          "(i + d2) % 6 == 0 ? 'babies' : (i + d2) % 6 == 1 ? 'cities' : (i + d2) % 6 == 2 ? 'puppies' : (i + d2) % 6 == 3 ? 'stories' : (i + d2) % 6 == 4 ? 'families' : 'countries'"
        ]
      },
      hint: "Change the y to i, then add -es.",
      tags: [
        "AC9E6LY08",
        "EN3-SPELL-01"
      ]
    }
  ]
};

// ../../src/content/packs/index.ts
var packs = [
  maths_K_default,
  maths_1_default,
  maths_2_default,
  maths_3_default,
  maths_4_default,
  maths_5_default,
  maths_6_default,
  english_K_default,
  english_1_default,
  english_2_default,
  english_3_default,
  english_4_default,
  english_5_default,
  english_6_default
];
var CONTENT_MANIFEST = manifest_default;
function contentPack(subject, level) {
  return packs.find((pack) => pack.subject === subject && pack.level === level);
}

// src/routes/content.ts
var contentRoutes = async (fastify) => {
  const app2 = fastify.withTypeProvider();
  app2.get("/content/manifest", {
    // 304 is declared `z.undefined()` rather than left off the map: the
    // route always calls `.send()` with no argument for it - Fastify's own
    // `send()` short-circuits on an undefined payload before serialization
    // ever runs, which is what keeps a 304 genuinely bodyless - and the
    // declaration is what lets that no-argument call typecheck at all,
    // since a code absent from `response` isn't one `reply.code()` accepts.
    schema: {
      operationId: "readContentManifest",
      headers: z9.object({ "if-none-match": z9.string().optional() }),
      response: { 200: contentManifestSchema, 304: z9.undefined() }
    }
  }, async (request, reply) => {
    const etag = `"${CONTENT_MANIFEST.version}"`;
    if (request.headers["if-none-match"] === etag) {
      return reply.header("etag", etag).code(304).send();
    }
    return reply.header("etag", etag).header("cache-control", "public, max-age=0, must-revalidate").send(CONTENT_MANIFEST);
  });
  app2.get("/content/:subject/:level", {
    schema: {
      operationId: "readContentPack",
      params: z9.object({ subject: z9.string(), level: z9.string() }),
      headers: z9.object({ "if-none-match": z9.string().optional() }),
      response: { 200: contentPackSchema, 304: z9.undefined(), 404: errorSchema }
    }
  }, async (request, reply) => {
    const level = parseYearLevel(request.params.level);
    if (!level) return reply.code(404).send({ error: "No such level" });
    const pack = contentPack(request.params.subject, level);
    if (!pack) return reply.code(404).send({ error: "No such content" });
    const etag = `"${pack.version}"`;
    if (request.headers["if-none-match"] === etag) {
      return reply.header("etag", etag).code(304).send();
    }
    return reply.header("etag", etag).header("cache-control", "public, max-age=0, must-revalidate").send(pack);
  });
};

// src/routes/reports.ts
import { z as z10 } from "zod";

// ../../src/lib/speedrun/records.ts
function isRecord(previousBest, score) {
  return previousBest !== null && score > previousBest;
}

// ../../src/lib/speedrun/modes.ts
var DIFFICULTIES = ["easy", "moderate", "hard"];
var OPERATIONS = ["add", "subtract", "multiply", "divide", "mixed"];
var TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
var SINGLE_TABLES = TABLES.filter((table) => table !== 10);
var TABLE_BUNDLES = ["2-5", "6-9", "11-12", "all"];
var MODES = [
  ...DIFFICULTIES.map((difficulty) => ({ op: "add", difficulty })),
  ...DIFFICULTIES.map((difficulty) => ({ op: "subtract", difficulty })),
  ...SINGLE_TABLES.map((tables) => ({ op: "multiply", tables })),
  ...TABLE_BUNDLES.map((tables) => ({ op: "multiply", tables })),
  ...DIFFICULTIES.map((difficulty) => ({ op: "divide", difficulty })),
  ...DIFFICULTIES.map((difficulty) => ({ op: "mixed", difficulty }))
];
function modeKey(mode) {
  return mode.op === "multiply" ? `multiply.${mode.tables}` : `${mode.op}.${mode.difficulty}`;
}
var MODE_BY_KEY = new Map(MODES.map((mode) => [modeKey(mode), mode]));
function parseMode(key2) {
  return MODE_BY_KEY.get(key2) ?? null;
}
var OPERATION_SET = new Set(OPERATIONS);
var RAMP = new Map(
  SINGLE_TABLES.map((table, index) => [table, index / (SINGLE_TABLES.length - 1)])
);

// ../../src/lib/speedrun/leaderboard.ts
function standingChange(rivalBests, previousBest, best) {
  if (rivalBests.length === 0) return null;
  const rank = (score) => 1 + rivalBests.filter((rival) => rival > score).length;
  const place = rank(best);
  const previousPlace = previousBest === null ? null : rank(previousBest);
  if (previousPlace === place) return null;
  return { place, previousPlace, rivals: rivalBests.length };
}

// ../../src/lib/speedrun/history.ts
var HISTORY_RUNS = 5;

// src/data/speed-records.ts
async function readSpeedAttempts(userId) {
  if (!prisma) return [];
  try {
    return await prisma.$queryRaw`
      SELECT "mode", "correct", "playedAt"
      FROM (
        SELECT "mode", "correct", "playedAt",
               ROW_NUMBER() OVER (
                 PARTITION BY "mode"
                 -- The earlier run set a tied score, so it is the one kept and
                 -- the one starred; the id settles the rest so two reads cannot
                 -- return different rows.
                 ORDER BY "correct" DESC, "playedAt" ASC, "id" ASC
               ) AS place
        FROM "SpeedAttempt"
        WHERE "userId" = ${userId}
      ) ranked
      WHERE "place" <= ${HISTORY_RUNS}
    `;
  } catch (error) {
    console.error("Failed to read speed attempts", error);
    return null;
  }
}
var SUMMARY_RUNS = 2;
async function readSpeedSummaries(userId) {
  if (!prisma) return [];
  try {
    return await prisma.$queryRaw`
      SELECT "mode", "correct", "playedAt"
      FROM (
        SELECT "mode", "correct", "playedAt",
               ROW_NUMBER() OVER (
                 PARTITION BY "mode"
                 -- The earlier run set a tied best, exactly as the cabinet reads it.
                 ORDER BY "correct" DESC, "playedAt" ASC, "id" ASC
               ) AS best_place,
               ROW_NUMBER() OVER (
                 PARTITION BY "mode"
                 ORDER BY "playedAt" DESC, "id" DESC
               ) AS recent_place
        FROM "SpeedAttempt"
        WHERE "userId" = ${userId}
      ) ranked
      WHERE "best_place" = 1 OR "recent_place" <= ${SUMMARY_RUNS}
    `;
  } catch (error) {
    console.error("Failed to read speed summaries", error);
    return null;
  }
}
var isUniqueViolation3 = (error) => typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
async function submitSpeedRun(userId, run) {
  if (!prisma) return null;
  const { id, mode, correct, playedAt } = run;
  const [, banked] = await Promise.all([
    recordAttempt2(id, userId, modeKey(mode), correct, playedAt),
    bankRecord(userId, modeKey(mode), correct, playedAt)
  ]);
  if (banked === null) return null;
  return { ...banked, standing: await readStanding(userId, modeKey(mode), banked) };
}
async function readStanding(userId, key2, banked) {
  if (!prisma) return null;
  try {
    const account = await readAccount(userId);
    const household = account ? householdId(account) : null;
    if (household === null) return null;
    const rivals = await prisma.speedRecord.findMany({
      where: { mode: key2, userId: { in: await householdMemberIds(household), not: userId } },
      select: { best: true }
    });
    return standingChange(
      rivals.map((rival) => rival.best),
      banked.previousBest,
      banked.best
    );
  } catch (error) {
    console.error("Failed to read family standing", error);
    return null;
  }
}
async function recordAttempt2(id, userId, mode, correct, playedAt) {
  if (!prisma) return;
  try {
    await prisma.speedAttempt.create({ data: { id, userId, mode, correct, playedAt } });
  } catch (error) {
    if (isUniqueViolation3(error)) return;
    console.error("Failed to record speed attempt", error);
  }
}
async function bankRecord(userId, key2, correct, playedAt) {
  if (!prisma) return null;
  const db = prisma;
  try {
    const initial = await db.speedRecord.findUnique({ where: { userId_mode: { userId, mode: key2 } } });
    const previousBest = initial?.best ?? null;
    const beatsPreviousBest = isRecord(previousBest, correct);
    const guardedUpdate = () => db.speedRecord.updateMany({
      where: { userId, mode: key2, best: { lt: correct } },
      data: { best: correct, achievedAt: playedAt, seen: !beatsPreviousBest }
    });
    let updated = await guardedUpdate();
    if (updated.count === 0 && initial === null) {
      try {
        await db.speedRecord.create({
          data: { userId, mode: key2, best: correct, achievedAt: playedAt, seen: true }
        });
        return { previousBest: null, best: correct, isRecord: false };
      } catch (error) {
        if (!isUniqueViolation3(error)) throw error;
        updated = await guardedUpdate();
      }
    }
    if (updated.count > 0) {
      return { previousBest, best: correct, isRecord: beatsPreviousBest };
    }
    const current = await db.speedRecord.findUnique({ where: { userId_mode: { userId, mode: key2 } } });
    return { previousBest, best: current?.best ?? correct, isRecord: false };
  } catch (error) {
    console.error("Failed to submit speed run", error);
    return null;
  }
}
async function readUnseenRecords(parentId) {
  if (!prisma) return [];
  try {
    const rows = await prisma.speedRecord.findMany({
      where: { seen: false, user: { parentId } },
      orderBy: { achievedAt: "desc" },
      select: { userId: true, mode: true, best: true, achievedAt: true, user: { select: { name: true } } }
    });
    return rows.map((row) => ({
      childId: row.userId,
      childName: row.user.name ?? "",
      mode: row.mode,
      best: row.best,
      achievedAt: row.achievedAt
    }));
  } catch (error) {
    console.error("Failed to read unseen speed records", error);
    return null;
  }
}
async function dismissSpeedRecords(parentId, childId) {
  if (!prisma) return false;
  try {
    await prisma.speedRecord.updateMany({
      where: { userId: childId, seen: false, user: { parentId } },
      data: { seen: true }
    });
    return true;
  } catch (error) {
    console.error("Failed to dismiss speed records", error);
    return false;
  }
}
async function householdMemberIds(parentId) {
  if (!prisma) return [];
  const [household, shares] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ id: parentId }, { parentId }] },
      select: { id: true }
    }),
    prisma.childShare.findMany({
      where: { OR: [{ child: { parentId } }, { viewerId: parentId }] },
      select: { childId: true, viewerId: true, child: { select: { parentId: true } } }
    })
  ]);
  return extendHouseholdWithShares(
    household.map((user) => user.id),
    shares.map((share2) => ({
      childId: share2.childId,
      viewerId: share2.viewerId,
      ownerId: share2.child.parentId ?? parentId
    }))
  );
}
async function readFamilyRecords(parentId) {
  if (!prisma) return [];
  try {
    const memberIds = await householdMemberIds(parentId);
    const rows = await prisma.speedRecord.findMany({
      where: { userId: { in: memberIds } },
      select: {
        userId: true,
        mode: true,
        best: true,
        achievedAt: true,
        // The board draws faces, so it reads what a face is made of: the
        // photograph a parent cropped, then the animal the player picked, then
        // the picture Google gave a grown-up - who has no avatar and never had a
        // photo cropped for them, so it is the only face they own.
        user: {
          select: {
            name: true,
            avatar: true,
            image: true,
            photo: { select: { dataUrl: true } }
          }
        }
      }
    });
    return rows.map((row) => ({
      playerId: row.userId,
      playerName: row.user.name ?? "",
      playerPhoto: parsePhoto(row.user.photo?.dataUrl),
      playerAvatar: parseAvatar(row.user.avatar),
      playerImage: row.user.image,
      mode: row.mode,
      best: row.best,
      achievedAt: row.achievedAt
    }));
  } catch (error) {
    console.error("Failed to read family speed records", error);
    return null;
  }
}

// ../../src/lib/analytics/errors.ts
var ORDER = [
  "copied",
  "sign-dropped",
  "clock-format",
  "added-not-multiplied",
  "power-of-ten"
];
var NUMBER = /-?\d+(?:\.\d+)?/g;
var numeric = (text) => {
  const value = Number(text.trim());
  return Number.isFinite(value) ? value : null;
};
var promptNumbers = (prompt) => (prompt.match(NUMBER) ?? []).map(Number).filter(Number.isFinite);
var near = (a, b) => Math.abs(a - b) < 1e-9;
function classifyError(answer) {
  if (answer.correct) return null;
  const expected = numeric(answer.expected);
  const response = numeric(answer.response);
  const numbers = promptNumbers(answer.prompt);
  for (const kind of ORDER) {
    if (matches(kind, { answer, expected, response, numbers })) return kind;
  }
  return null;
}
function matches(kind, { answer, expected, response, numbers }) {
  switch (kind) {
    /**
     * The response is a number the question already contained. It covers the
     * child who answers "415 centimetres in metres" with 415 and the one who
     * answers "3/8 + 7/16 = ?/16" with 7, which look like different mistakes
     * and are the same one: a number was taken from the question rather than
     * made from it. Two detectors with one body would only be two names for
     * this line.
     */
    case "copied":
      return response !== null && expected !== null && !near(response, expected) && numbers.some((value) => near(value, response));
    /** The magnitude is right and only the sign is missing. */
    case "sign-dropped":
      return expected !== null && response !== null && expected < 0 && near(response, -expected);
    /**
     * A duration written as a clock reading: `1.45` and `10.55` were both given
     * for 55 minutes, on questions asking how long a bus took.
     *
     * The test is not that the digits after the point are the answer - in the
     * first of those they are not. It is that they are a *minutes figure the
     * question itself contained* (`10:45` and `9:55` respectively), on a
     * question whose answer is a whole number of minutes. That is what tells
     * this apart from an answer that is merely decimal and merely wrong: the
     * child has read a time off the question and typed it in clock form, which
     * is a mistake about what to type rather than one about time.
     */
    case "clock-format": {
      const shape = /^\s*\d{1,2}[.:](\d{2})\s*$/.exec(answer.response);
      if (shape === null || expected === null || !Number.isInteger(expected)) return false;
      const minutes = Number(shape[1]);
      if (minutes === 0 || minutes >= 60) return false;
      return near(minutes, expected) || numbers.some((value) => near(value, minutes));
    }
    /** The answer wanted a product of two of the question's numbers and got their sum. */
    case "added-not-multiplied":
      return expected !== null && response !== null && numbers.some(
        (a, i) => numbers.slice(i + 1).some((b) => near(a * b, expected) && near(a + b, response))
      );
    /**
     * Out by a factor of ten, a hundred, a thousand - in either direction. The
     * ratio has to be an exact power of ten, so `10` answered for `5` is not
     * this and `1000` answered for `100` is.
     */
    case "power-of-ten": {
      if (expected === null || response === null) return false;
      if (expected === 0 || response === 0) return false;
      const exponent = Math.log10(Math.abs(expected / response));
      return Math.abs(exponent - Math.round(exponent)) < 1e-9 && Math.round(exponent) !== 0;
    }
  }
}
var MIN_CLUSTER = 2;
var CLUSTER_EXAMPLES = 4;
function errorClusters(answers, minimum = MIN_CLUSTER) {
  const clusters = /* @__PURE__ */ new Map();
  for (const answer of answers) {
    const kind = classifyError(answer);
    if (kind === null) continue;
    const cluster = clusters.get(kind) ?? { kind, count: 0, topics: [], examples: [] };
    cluster.count += 1;
    if (!cluster.topics.some((seen) => seen.topic === answer.topic && seen.level === answer.level)) {
      cluster.topics.push({ topic: answer.topic, level: answer.level });
    }
    cluster.examples.push(answer);
    clusters.set(kind, cluster);
  }
  return [...clusters.values()].filter((cluster) => cluster.count >= minimum).map((cluster) => ({
    ...cluster,
    examples: [...cluster.examples].sort((a, b) => b.answeredAt - a.answeredAt).slice(0, CLUSTER_EXAMPLES)
  })).sort((a, b) => b.count - a.count || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

// src/routes/reports.ts
var CALENDAR_WINDOW_MS = 29 * 24 * 60 * 60 * 1e3;
async function mayRead(parentId, childId) {
  const viewable = await readViewableChildren(parentId);
  return Boolean(viewable?.some((child) => child.id === childId));
}
var reportRoutes = async (fastify) => {
  const app2 = fastify.withTypeProvider();
  app2.get("/children/:id/report", {
    schema: {
      operationId: "readReport",
      params: z10.object({ id: z10.string() }),
      querystring: z10.object({ subject: z10.string().default("maths") }),
      response: { 200: reportSchema, 404: errorSchema, 503: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const { id } = request.params;
    const { subject } = request.query;
    if (!await mayRead(parentId, id)) return reply.code(404).send({ error: "No such child" });
    const observations = await readObservations(id, subject);
    const answers = await readAnsweredQuestions(id, subject);
    const sittings = await readSittings(id, subject);
    if (observations === null || answers === null || sittings === null) {
      return reply.code(503).send({ error: "Could not read the record" });
    }
    const now = Date.now();
    const reports = topicReports(observations, now);
    return reply.send({
      headline: headline(observations, { now }),
      topics: reports,
      problems: problemTopics(reports),
      due: dueForReview(reports),
      strengths: strengths(reports),
      progress: progressOverTime(observations, { now }),
      clusters: errorClusters(answers),
      sittings
    });
  });
  app2.get("/children/:id/record", {
    schema: {
      operationId: "readChildRecord",
      params: z10.object({ id: z10.string() }),
      querystring: z10.object({
        subject: z10.string().default("maths"),
        // Answers *per topic*, not a row cap - the report unfolds
        // `EXAMPLE_ANSWERS` of each and the lab asks for fifty, because a
        // pattern across a child's answers cannot show in three.
        perTopic: z10.coerce.number().int().min(1).max(50).default(EXAMPLE_ANSWERS),
        // A duration, not an instant: the server keeps the clock, exactly as
        // `/play/state` decides its own `TARGET_WINDOW_MS`.
        windowMs: z10.coerce.number().int().min(1).max(CALENDAR_WINDOW_MS).default(CALENDAR_WINDOW_MS),
        // A speed run has no curriculum topic, so only the subject that draws
        // them asks for them - an English report would be paying for a query
        // nothing renders.
        speedRuns: z10.enum(["true", "false"]).default("false")
      }),
      response: { 200: childHistorySchema, 404: errorSchema, 503: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const { id } = request.params;
    const { subject, perTopic, windowMs, speedRuns } = request.query;
    if (!await mayRead(parentId, id)) return reply.code(404).send({ error: "No such child" });
    const [observations, sittings, answers, recentAnswers, runs] = await Promise.all([
      readObservations(id, subject),
      readSittings(id, subject),
      readAnsweredQuestions(id, subject, perTopic),
      // Cross-subject, both of them: the calendar measures the child's whole
      // day against their goal, and a speed run has no subject to be scoped by.
      readRecentAnswers(id, Date.now() - windowMs),
      speedRuns === "true" ? readSpeedSummaries(id) : Promise.resolve(null)
    ]);
    if (observations === null || sittings === null) {
      return reply.code(503).send({ error: "Could not read the record" });
    }
    return reply.send({ observations, sittings, answers, recentAnswers, speedRuns: runs });
  });
  app2.get("/children/:id/answers", {
    schema: {
      operationId: "readAnsweredQuestions",
      params: z10.object({ id: z10.string() }),
      querystring: z10.object({
        subject: z10.string().default("maths"),
        // The third argument to readAnsweredQuestions is answers *per topic*,
        // not a row cap - it defaults to EXAMPLE_ANSWERS (3). Naming it
        // `limit` here would quietly change what the parent screen asks for.
        perTopic: z10.coerce.number().int().min(1).max(50).default(3)
      }),
      response: { 200: z10.array(answeredQuestionSchema), 404: errorSchema, 503: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const { id } = request.params;
    if (!await mayRead(parentId, id)) return reply.code(404).send({ error: "No such child" });
    const answers = await readAnsweredQuestions(id, request.query.subject, request.query.perTopic);
    if (answers === null) return reply.code(503).send({ error: "Could not read the answers" });
    return reply.send(answers);
  });
};

// src/routes/shares.ts
import { z as z11 } from "zod";
var shareRoutes = async (fastify) => {
  const app2 = fastify.withTypeProvider();
  app2.get("/shares", {
    schema: {
      operationId: "readShares",
      response: {
        200: sharesSchema,
        503: errorSchema
      }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const [invites, viewers] = await Promise.all([
      listPendingInvites(parentId),
      listSharedViewers(parentId)
    ]);
    if (invites === null || viewers === null) {
      return reply.code(503).send({ error: "Could not read the sharing" });
    }
    return reply.send({ invites, viewers });
  });
  app2.post("/shares", {
    schema: {
      operationId: "createShareInvite",
      body: z11.object({ childIds: z11.array(z11.string()).min(1) }),
      response: {
        201: z11.object({ token: z11.string(), expiresAt: z11.string() }),
        400: errorSchema
      }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const invite = await createShareInvite(parentId, request.body.childIds);
    if (!invite) return reply.code(400).send({ error: "Could not create the link" });
    return reply.code(201).send({ token: invite.token, expiresAt: invite.expiresAt.toISOString() });
  });
  app2.get("/shares/:token", {
    schema: {
      operationId: "readShareInvite",
      params: z11.object({ token: z11.string() }),
      response: { 200: inviteDetailsSchema, 404: errorSchema }
    }
  }, async (request, reply) => {
    const invite = await readShareInvite(request.params.token);
    if (!invite) return reply.code(404).send({ error: "No such link" });
    return reply.send(invite);
  });
  app2.delete("/shares/:id", {
    schema: {
      operationId: "cancelShareInvite",
      params: z11.object({ id: z11.string() }),
      response: { 204: z11.null(), 404: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const ok = await cancelShareInvite(parentId, request.params.id);
    if (!ok) return reply.code(404).send({ error: "No such link" });
    return reply.code(204).send(null);
  });
  app2.post("/shares/:token/accept", {
    schema: {
      operationId: "acceptShareInvite",
      params: z11.object({ token: z11.string() }),
      response: { 200: acceptResultSchema }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const result = await acceptShareInvite(request.params.token, userId);
    return reply.send(result);
  });
  app2.delete("/shares/viewers/:viewerId", {
    schema: {
      operationId: "revokeShare",
      params: z11.object({ viewerId: z11.string() }),
      querystring: z11.object({ childId: z11.string().optional() }),
      response: { 204: z11.null(), 404: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const ok = await revokeShare(parentId, request.params.viewerId, request.query.childId);
    if (!ok) return reply.code(404).send({ error: "No such grant" });
    return reply.code(204).send(null);
  });
  app2.delete("/shares/mine/:childId", {
    schema: {
      operationId: "leaveShare",
      params: z11.object({ childId: z11.string() }),
      response: { 204: z11.null(), 404: errorSchema }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const ok = await leaveShare(userId, request.params.childId);
    if (!ok) return reply.code(404).send({ error: "No such grant" });
    return reply.code(204).send(null);
  });
};

// src/routes/speed.ts
import { z as z12 } from "zod";
var MAX_SCORE = 1e4;
var speedRoutes = async (fastify) => {
  const app2 = fastify.withTypeProvider();
  app2.get("/speed/modes", {
    schema: {
      operationId: "listSpeedModes",
      response: { 200: z12.array(modeListingSchema) }
    }
  }, async () => MODES.map((mode) => ({ key: modeKey(mode), ...mode })));
  app2.post("/speed/runs", {
    schema: {
      operationId: "submitSpeedRun",
      body: z12.object({
        id: z12.uuid(),
        mode: z12.string().min(1),
        correct: z12.number().int().min(0).max(MAX_SCORE),
        playedAt: z12.string().meta({
          format: "date-time",
          description: "When the run was played, ISO 8601. Omit it and the server stamps receipt. Hold one stamp per run across every flush of it, as with `id`."
        }).optional()
      }),
      response: { 200: speedOutcomeSchema, 400: errorSchema, 503: errorSchema }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const mode = parseMode(request.body.mode);
    if (!mode) return reply.code(400).send({ error: "No such mode" });
    const playedAt = parsePlayedAt(request.body.playedAt, Date.now()) ?? /* @__PURE__ */ new Date();
    const outcome = await submitSpeedRun(userId, {
      id: request.body.id,
      mode,
      correct: request.body.correct,
      playedAt
    });
    if (!outcome) return reply.code(503).send({ error: "Could not record the run" });
    return reply.send(outcome);
  });
  app2.get("/speed/records", {
    schema: {
      operationId: "readFamilyRecords",
      response: { 200: speedRecordsSchema, 503: errorSchema }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const account = await readAccount(userId);
    const household = account ? householdId(account) : null;
    const [attempts, family] = await Promise.all([
      readSpeedAttempts(userId),
      household === null ? Promise.resolve(null) : readFamilyRecords(household)
    ]);
    if (attempts === null || household !== null && family === null) {
      return reply.code(503).send({ error: "Could not read the records" });
    }
    return reply.send({ attempts, family });
  });
  app2.get("/speed/summaries", {
    schema: {
      operationId: "readSpeedSummaries",
      response: { 200: z12.array(summaryRunSchema), 503: errorSchema }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const summaries = await readSpeedSummaries(userId);
    if (summaries === null) return reply.code(503).send({ error: "Could not read the runs" });
    return reply.send(summaries);
  });
  app2.get("/speed/unseen", {
    schema: {
      operationId: "readUnseenRecords",
      response: { 200: z12.array(childRecordSchema), 503: errorSchema }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const records = await readUnseenRecords(parentId);
    if (records === null) return reply.code(503).send({ error: "Could not read the records" });
    return reply.send(records);
  });
  app2.delete("/speed/unseen/:childId", {
    schema: {
      operationId: "dismissSpeedRecords",
      params: z12.object({ childId: z12.string() }),
      response: { 204: z12.null() }
    }
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    await dismissSpeedRecords(parentId, request.params.childId);
    return reply.code(204).send(null);
  });
};

// src/routes/play.ts
import { z as z13 } from "zod";
async function targetAnswersFor(userId, target) {
  if (!target) return [];
  return await readRecentAnswers(userId, Date.now() - TARGET_WINDOW_MS) ?? [];
}
var playRoutes = async (fastify) => {
  const app2 = fastify.withTypeProvider();
  app2.get("/me/player", {
    schema: {
      operationId: "readPlayerState",
      response: { 200: playerReadSchema }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const player = await readPlayerState(userId);
    return reply.send({ player, targetAnswers: await targetAnswersFor(userId, player.target) });
  });
  app2.get("/play/state", {
    schema: {
      operationId: "readPlayState",
      querystring: z13.object({
        subject: z13.string().min(1).default("maths"),
        level: yearLevelSchema.optional(),
        recentTopics: z13.coerce.number().int().min(1).max(50).default(5)
      }),
      response: { 200: playStateSchema }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    const { subject, level, recentTopics: count } = request.query;
    const [profile, recentTopics, player] = await Promise.all([
      readLearnerProfile(userId, subject),
      level ? readRecentTopics(userId, subject, level, count) : Promise.resolve([]),
      readPlayerState(userId)
    ]);
    const targetAnswers = await targetAnswersFor(userId, player.target);
    return reply.send({ player, profile, recentTopics, targetAnswers });
  });
  app2.put("/me/level", {
    schema: {
      operationId: "writeSelectedLevel",
      body: z13.object({ level: yearLevelSchema }),
      response: { 204: z13.null(), 400: errorSchema }
    }
  }, async (request, reply) => {
    const userId = requireUser(request);
    await writeSelectedLevel(userId, request.body.level);
    return reply.code(204).send(null);
  });
};

// src/server.ts
registerComponents();
function buildServer() {
  const app2 = Fastify({ logger: false }).withTypeProvider();
  app2.setValidatorCompiler(validatorCompiler);
  app2.setSerializerCompiler(serializerCompiler);
  app2.setErrorHandler((error, _request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) console.error(error);
    reply.code(status).send({ error: error.message });
  });
  app2.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "LearnR API", version: "0.1.0" }
    },
    transform: jsonSchemaTransform,
    transformObject
  });
  app2.register(fastifyCors, {
    origin: webOrigins(),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type"],
    maxAge: 86400
  });
  app2.register(timingPlugin);
  app2.register(authPlugin);
  app2.register(authRoutes);
  app2.register(sessionRoutes);
  app2.register(childRoutes);
  app2.register(reportRoutes);
  app2.register(shareRoutes);
  app2.register(speedRoutes);
  app2.register(playRoutes);
  app2.register(contentRoutes);
  app2.get("/openapi.json", async () => app2.swagger());
  app2.get("/health", async () => ({ ok: true }));
  return app2;
}

// src/main.ts
var app = buildServer();
app.listen({ port: PORT, host: "0.0.0.0" }).catch((error) => {
  console.error(error);
  process.exit(1);
});
//# sourceMappingURL=main.js.map
