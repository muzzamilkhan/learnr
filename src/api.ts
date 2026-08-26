import 'server-only';
import { cookies } from 'next/headers';
import { reviveDates } from '@/lib/revive';
import type {
  Account,
  AcceptResult,
  AttemptResult,
  ChildProfile,
  ChildRecord,
  InviteDetails,
  PendingInvite,
  PlayerState,
  Sitting,
  SpeedOutcome,
  ViewableChild,
} from '@/lib/dto';
import type { LearnerProfile, Observation } from '@/lib/analytics/profile';
import type { AnsweredQuestion } from '@/lib/analytics/report';
import type { SharedViewer } from '@/lib/children';
import type { YearLevel } from '@/lib/curriculum';
import type { TargetAnswer } from '@/lib/rewards/target';
import type { FamilyRecord } from '@/lib/speedrun/leaderboard';
import type { SpeedAttempt } from '@/lib/speedrun/history';
import type { SummaryRun } from '@/lib/speedrun/summary';
import type { Attempt } from '@/lib/session/session';

/**
 * Everything this app used to read and write against Prisma, over the wire.
 *
 * `apps/api` owns the database now - the schema, the migrations and the five
 * modules that used to sit in `src/lib`. What is left is this one typed client
 * whose methods mirror the endpoints, and the only thing the web app still
 * holds a Prisma connection for is Auth.js (`src/auth-db.ts`).
 *
 * It sits here rather than in `src/lib` because `src/lib` is the pure engine -
 * `packages/core/src` is a symlink to it, and nothing in there may touch React,
 * the network, the clock or the database. The five modules this replaces were
 * the standing exception to that rule; putting their replacement back in the
 * same place would re-open it for exactly the reason the extraction closed it.
 *
 * **The session cookie is forwarded as-is.** The API resolves it against the
 * very `Session` table Auth.js writes, so who a request is for is decided in
 * exactly one place and one sign-in serves both halves. That is also why there
 * is no API key: the caller's own session is the authorisation, and an endpoint
 * a child may not reach answers 403 to the child rather than trusting this
 * client to have asked nicely.
 *
 * **Null means "could not read", and it is load-bearing.** Half this app's
 * screens tell a failed read from an honest empty - `readObservations` and
 * `readSittings` most sharply, where `[]` renders as "your child has never
 * practised". So a 503, a 4xx and a dead connection all come back as null, and
 * an endpoint that means to say "nothing there" says `[]` with a 200.
 */

/**
 * Where the API is. The default is the port `npm run dev --workspace apps/api`
 * listens on, so a developer who has not set the variable still gets a working
 * pair; production sets `LEARNR_API_URL` to the Fly app.
 */
const BASE = process.env.LEARNR_API_URL ?? 'http://localhost:3001';

async function call(path: string, init: RequestInit = {}): Promise<Response | null> {
  const jar = await cookies();

  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        // **Only where there is a body to describe.** Fastify refuses a JSON
        // content-type with an empty body before any handler runs - a 400,
        // `FST_ERR_CTP_EMPTY_JSON_BODY` - so declaring it unconditionally
        // broke every bodyless write here: `claimParent`, `issueLoginCode`,
        // `acceptShare`, `awardRound` and `endSession`. The null convention
        // then made that 400 indistinguishable from a failed read, which is
        // why it reached production silently rather than as an error.
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        cookie: jar.toString(),
        ...init.headers,
      },
      // Every one of these is per-user and most are per-request. There is
      // nothing here Next may hold on to.
      cache: 'no-store',
    });
  } catch (error) {
    // A dead connection is a failed read, not an empty one, and it must not
    // throw into a page render. See the null convention above.
    console.error(`API request failed: ${path}`, error);
    return null;
  }
}

/** A read, or a write whose answer matters. Null on any failure at all. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const response = await call(path, init);
  if (!response?.ok) return null;
  if (response.status === 204) return null;

  // JSON has no date type, so everything a component treats as a `Date` arrives
  // as a string. It is revived once, here, rather than remembered at each of a
  // dozen call sites - see `reviveDates`.
  return reviveDates<T>(await response.json());
}

/**
 * A write whose whole answer is whether it worked - a 204, or a 404 because the
 * child was not this parent's. Kept apart from `request` because `null` cannot
 * be both "no content" and "no such child".
 */
async function ok(path: string, init: RequestInit = {}): Promise<boolean> {
  return Boolean((await call(path, init))?.ok);
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

/** A child's details as both the create and the update endpoint take them. */
export interface ChildBody {
  name: string;
  avatar: string;
  level: YearLevel;
  targetKind: 'questions' | 'minutes' | null;
  targetValue: number | null;
  photo: string | null;
}

/** Everything the play screen needs before it can render its first question. */
export interface PlayState {
  player: PlayerState;
  profile: LearnerProfile;
  recentTopics: string[];
  targetAnswers: TargetAnswer[];
}

/** The four numbers off a child's own row, and the window the goal bar folds. */
export interface PlayerRead {
  player: PlayerState;
  targetAnswers: TargetAnswer[];
}

/** A child's raw history, as the parent's report folds it for itself. */
export interface ChildRecordRead {
  observations: Observation[];
  sittings: Sitting[];
  /** Null is a failed read - the report is still worth showing without examples. */
  answers: AnsweredQuestion[] | null;
  /** Null is a failed read - the calendar drops the goal rather than drawing misses. */
  recentAnswers: TargetAnswer[] | null;
  /** Null when they were not asked for, and when the read failed. */
  speedRuns: SummaryRun[] | null;
}

/** Both walls of the scores screen. `family: null` is nobody to rank, not a failure. */
export interface SpeedRecordsRead {
  attempts: SpeedAttempt[];
  family: FamilyRecord[] | null;
}

const query = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : '';
};

export const api = {
  /* Who is asking ------------------------------------------------------- */

  me: () => request<Account>('/me'),

  claimParent: () => request<{ claimed: boolean }>('/me/claim-parent', post()),

  /* The child's own screens --------------------------------------------- */

  player: () => request<PlayerRead>('/me/player'),

  /**
   * `level` is deliberately allowed through as whatever the URL said. An
   * unrecognised year is simply omitted, because the read that decides whether
   * to redirect must not be refused for the year it is about to correct.
   */
  playState: (subject: string, level: YearLevel | null, recentTopics: number) =>
    request<PlayState>(
      `/play/state${query({ subject, level: level ?? undefined, recentTopics })}`,
    ),

  writeLevel: (level: YearLevel) =>
    ok('/me/level', { method: 'PUT', body: JSON.stringify({ level }) }),

  /* The children a parent manages --------------------------------------- */

  /** Their own children *plus* every child shared with them - see the endpoint. */
  viewableChildren: () => request<ViewableChild[]>('/children/viewable'),

  listChildren: () => request<ChildProfile[]>('/children'),

  createChild: (body: ChildBody) => request<{ id: string }>('/children', post(body)),

  updateChild: (id: string, body: ChildBody) =>
    ok(`/children/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  removeChild: (id: string) => ok(`/children/${id}`, { method: 'DELETE' }),

  issueLoginCode: (id: string) =>
    request<{ code: string; expiresAt: Date }>(`/children/${id}/login-code`, post()),

  /** The child's way in. Unauthenticated by design - the code is the credential. */
  redeem: (code: string) =>
    request<{ token: string; childId: string; expiresAt: Date }>('/auth/redeem', post({ code })),

  /* The report ----------------------------------------------------------- */

  childRecord: (
    id: string,
    options: { subject: string; perTopic?: number; windowMs?: number; speedRuns?: boolean },
  ) =>
    request<ChildRecordRead>(
      `/children/${id}/record${query({
        subject: options.subject,
        perTopic: options.perTopic,
        windowMs: options.windowMs,
        speedRuns: options.speedRuns ? 'true' : undefined,
      })}`,
    ),

  childAnswers: (id: string, subject: string, perTopic?: number) =>
    request<AnsweredQuestion[]>(`/children/${id}/answers${query({ subject, perTopic })}`),

  /* Sharing a child ------------------------------------------------------ */

  shares: () => request<{ invites: PendingInvite[]; viewers: SharedViewer[] }>('/shares'),

  createShare: (childIds: string[]) =>
    request<{ token: string; expiresAt: Date }>('/shares', post({ childIds })),

  /** Signed out too: a link's whole point is reaching somebody with no account. */
  readShare: (token: string) => request<InviteDetails>(`/shares/${token}`),

  acceptShare: (token: string) => request<AcceptResult>(`/shares/${token}/accept`, post()),

  cancelShare: (id: string) => ok(`/shares/${id}`, { method: 'DELETE' }),

  revokeShare: (viewerId: string, childId?: string) =>
    ok(`/shares/viewers/${viewerId}${query({ childId })}`, { method: 'DELETE' }),

  leaveShare: (childId: string) => ok(`/shares/mine/${childId}`, { method: 'DELETE' }),

  /* Recording a sitting -------------------------------------------------- */

  startSession: (body: { id: string; subject: string; level: YearLevel; seed: string }) =>
    request<{ id: string }>('/sessions', post(body)),

  recordAttempts: (id: string, attempts: (Attempt & { id: string })[]) =>
    request<AttemptResult>(`/sessions/${id}/attempts`, post({ attempts })),

  awardRound: (id: string) =>
    request<{ stars: number | null }>(`/sessions/${id}/award-round`, post()),

  awardTarget: (id: string, offsetMinutes: number) =>
    request<{ awarded: boolean }>(`/sessions/${id}/award-target`, post({ offsetMinutes })),

  endSession: (id: string) => ok(`/sessions/${id}/end`, post()),

  /* Speed runs ----------------------------------------------------------- */

  submitSpeedRun: (body: { id: string; mode: string; correct: number }) =>
    request<SpeedOutcome>('/speed/runs', post(body)),

  speedRecords: () => request<SpeedRecordsRead>('/speed/records'),

  unseenRecords: () => request<ChildRecord[]>('/speed/unseen'),

  dismissRecords: (childId: string) => ok(`/speed/unseen/${childId}`, { method: 'DELETE' }),
};
