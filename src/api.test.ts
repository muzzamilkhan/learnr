import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The one test of the typed client, and it exists for a bug that reached
 * production silently.
 *
 * `call` set `content-type: application/json` on every request, including the
 * five writes that send no body at all - `claimParent`, `issueLoginCode`,
 * `acceptShare`, `awardRound` and `endSession`. Fastify refuses that pairing
 * before a handler ever runs (`FST_ERR_CTP_EMPTY_JSON_BODY`, a 400), so every
 * one of those calls came back null, which the null convention makes
 * indistinguishable from a failed read. A parent's login-code button did
 * nothing, and a child's round stars were never banked.
 *
 * Nothing caught it: the API's own tests reach these routes through
 * `app.inject` with no `content-type` at all, so they exercised a request shape
 * the only client never sends.
 */

vi.mock('server-only', () => ({}));

/**
 * The raw header the "browser" sent. A test can rewrite it, because the case
 * worth covering is the one where it carries the session cookie twice.
 */
let cookieHeader = 'authjs.session-token=abc';

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => (name === 'cookie' ? cookieHeader : null) }),
}));

const { api } = await import('./api');

const sent: { url: string; init: RequestInit }[] = [];

const headersOf = (index: number): Record<string, string> =>
  sent[index].init.headers as Record<string, string>;

beforeEach(() => {
  sent.length = 0;
  cookieHeader = 'authjs.session-token=abc';
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return Promise.resolve(
      new Response(JSON.stringify({ code: 'ABCD', expiresAt: '2026-01-01T00:00:00.000Z' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
});

describe('the typed client', () => {
  it('does not claim a JSON body on a request that carries none', async () => {
    await api.issueLoginCode('child-1');

    expect(sent[0].init.body).toBeUndefined();
    expect(headersOf(0)['content-type']).toBeUndefined();
  });

  it.each([
    ['claimParent', () => api.claimParent()],
    ['issueLoginCode', () => api.issueLoginCode('child-1')],
    ['acceptShare', () => api.acceptShare('token')],
    ['awardRound', () => api.awardRound('session-1')],
    ['endSession', () => api.endSession('session-1')],
  ])('%s sends no content-type, because it sends no body', async (_name, send) => {
    await send();

    expect(sent[0].init.body).toBeUndefined();
    expect(headersOf(0)['content-type']).toBeUndefined();
  });

  it('still declares JSON where there is a body to describe', async () => {
    await api.redeem('ABCD');

    expect(sent[0].init.body).toBe(JSON.stringify({ code: 'ABCD' }));
    expect(headersOf(0)['content-type']).toBe('application/json');
  });

  it('forwards the caller\'s cookie either way', async () => {
    await api.issueLoginCode('child-1');
    await api.redeem('ABCD');

    expect(headersOf(0).cookie).toBe('authjs.session-token=abc');
    expect(headersOf(1).cookie).toBe('authjs.session-token=abc');
  });

  /**
   * The header goes across as the browser wrote it, duplicates and all - which
   * is the whole of why child sign-in broke.
   *
   * A browser can hold two cookies of one name, and every browser holding the
   * old host-only session cookie got a second one the moment that cookie gained
   * a `Domain`. Next's jar is keyed by name and collapses them, so
   * `cookies().toString()` forwarded whichever survived; when that was the
   * stale one the API answered 401 with the live session sitting unsent in the
   * very same header. Making the API try every token it is given cannot help
   * while only one is ever reaching it.
   */
  it('forwards a session cookie that appears twice, rather than picking one', async () => {
    cookieHeader = 'authjs.session-token=stale; theme=dark; authjs.session-token=live';
    await api.me();

    expect(headersOf(0).cookie).toBe(
      'authjs.session-token=stale; theme=dark; authjs.session-token=live',
    );
  });

  it('sends no cookie header content when the caller had none', async () => {
    cookieHeader = '';
    await api.me();

    expect(headersOf(0).cookie).toBe('');
  });
});
