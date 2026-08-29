import type { AttemptResult, SpeedOutcome } from '@/lib/dto';
import type { Attempt } from '@/lib/session/session';
import type { YearLevel } from '@/lib/curriculum';

/**
 * What the browser writes, without going through a server action.
 *
 * Everything a child does while playing is here: opening a sitting, recording an
 * answer, banking a round's stars, banking the day's goal, closing the sitting,
 * and submitting a speed run. All of it is *recording* - none of it decides what
 * the child sees next, which is the property that made moving it off server
 * actions safe.
 *
 * **Why it is not a server action.** A server action is a POST Next serialises
 * per client, so the calls a single answer makes queue behind each other while
 * every one of them reports a healthy server-side duration - a wait that exists
 * only in the browser and appears in no log. A child answering faster than the
 * queue drained was racing a queue nobody could see. These are route handlers
 * instead, called directly with `fetch`.
 *
 * **Reads stay on the server.** Only these writes are called from the browser,
 * because only these are on the path where a round trip is something a child
 * can feel.
 */

// Same origin, so there is no base at all and no NEXT_PUBLIC_ variable to get
// wrong. The six writes are route handlers in this app.
const BASE = '/api/v1';

/**
 * A write, and null on any failure at all - a 503, a 4xx and a dead connection
 * are all "it did not land", and none of them may throw into a screen a child
 * is playing on.
 */
async function post<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      // **Only where there is a body to describe.** A JSON content-type with an
      // empty body would be a 400 the null convention would then hide.
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });

    if (!response.ok || response.status === 204) return null;
    return await response.json();
  } catch {
    // A dead connection costs history, not play. Nothing here is awaited by
    // anything the child is waiting on.
    return null;
  }
}

/**
 * A v4 UUID, from the browser.
 *
 * `crypto.randomUUID` is the obvious answer and is not quite safe to assume:
 * Safari only grew it in 15.4, and the device this app is built for is an iPad
 * that may be some years old. Calling it where it does not exist would throw
 * inside a `.then` on the play screen and cost the sitting silently - the whole
 * recording path is fire-and-forget by design, so nothing would surface it.
 *
 * The fallback is `getRandomValues`, which has been everywhere for a decade,
 * with the version and variant bits set so the result still satisfies the
 * `z.uuid()` the endpoint validates against.
 */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

export const browserApi = {
  /**
   * The id is minted here rather than by the database, so a retried call opens
   * the same sitting rather than a second one - `POST /sessions` answers 200 to
   * an id it has already seen. It is the shape the offline iOS client needs too,
   * where a sitting starts with no network at all.
   */
  startSession: (body: { id: string; subject: string; level: YearLevel; seed: string }) =>
    post<{ id: string }>('/sessions', body),

  /**
   * A batch, because that is what the endpoint takes - it was built that way for
   * the iOS sync queue. This app sends one at a time; a child answers one at a
   * time.
   */
  recordAttempts: (id: string, attempts: (Attempt & { id: string })[]) =>
    post<AttemptResult>(`/sessions/${id}/attempts`, { attempts }),

  awardRound: (id: string) => post<{ stars: number | null }>(`/sessions/${id}/award-round`),

  awardTarget: (id: string, offsetMinutes: number) =>
    post<{ awarded: boolean }>(`/sessions/${id}/award-target`, { offsetMinutes }),

  endSession: (id: string) => post<null>(`/sessions/${id}/end`),

  submitSpeedRun: (body: { id: string; mode: string; correct: number }) =>
    post<SpeedOutcome>('/speed/runs', body),
};
