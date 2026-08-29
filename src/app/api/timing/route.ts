import dns from 'node:dns/promises';
import net from 'node:net';

import { logTiming, parseSamples, stopwatch, uptimeMs } from '@/timing';

/**
 * Where the browser's own readings land.
 *
 * The overlay behind `?timing=1` measures the one thing no server log can see -
 * Next serialises server actions, so an answer's calls queue behind each other
 * while every one of them reports a healthy server-side duration - and those
 * numbers were stuck on the device. The screen this is felt on is an iPad, with
 * no console to open and nothing to copy out of. So they are posted here and
 * written to the same log as everything else, and one place holds both halves.
 *
 * **A route handler rather than an endpoint on the API**, which is where this
 * was first going to go. The API is on `learnr-api-syd.fly.dev` and the app on
 * `learnr.muzza.tech`: the browser cannot reach it directly - cross-site, so
 * CORS refuses the call and the `SameSite` cookie would not be sent with it
 * anyway. Everything that talks to the API goes through this origin first, and a
 * measurement is no different. It also keeps a debug sink out of
 * `contract/openapi.yaml`, which is a document an iOS client vendors.
 *
 * **Unauthenticated, deliberately.** Reading the session would cost a Prisma
 * query from Vercel to Neon - the very round trip the answer path just stopped
 * paying, and this call is made *during* play. What guards it instead is
 * `parseSamples`: the labels are a closed set, so a crafted one cannot forge a
 * log line, and a batch is capped. The worst it can do is write fifty true-shaped
 * lines about calls that never happened, into a log nobody bills for.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Malformed JSON is a beacon that arrived torn, not an attack worth a 400 -
    // and a 204 either way keeps a failed flush from showing up in the browser
    // console of a screen somebody is playing on.
    return new Response(null, { status: 204 });
  }

  for (const { label, ms } of parseSamples(body)) logTiming(`client ${label}`, ms);

  return new Response(null, { status: 204 });
}

/**
 * A probe, temporary, for one question: why does a call from here to the API
 * cost about 530ms when the API answers it in ten, and a curl from a laptop in
 * the same city completes the whole thing - DNS, TCP, TLS and all - in under
 * forty?
 *
 * The first pass ruled out the API, the region, the database, `auth()` and cold
 * start, and measured a flat ~530ms floor on both hostnames that did not fall
 * on the second and third call. It read that flatness as "not connection
 * setup", which is half right and worth restating: three equally slow calls mean
 * nothing was *saved* by a connection already being open, so there is no
 * keep-alive - and without keep-alive, connection setup is paid on every one of
 * them. It was ruled out as something amortised, not as the cost.
 *
 * So this pass separates the three things that survive, and each has its own
 * measurement rather than being inferred from the others:
 *
 * - **Vercel's egress in general.** Two third-party hosts with a Sydney
 *   presence answer a near-empty response. If those are ~530ms too, the floor
 *   is what it costs this function to reach anything and Fly is incidental.
 *   Cloudflare's `/cdn-cgi/trace` names the colo it was served from, which
 *   doubles as a check on where the egress actually lands.
 * - **Something specific to Fly.** Third parties fast and both API hostnames
 *   slow is the other arm of the same test.
 * - **A wait on an unroutable IPv6.** Both API names carry an A and an AAAA,
 *   and Node has connected happy-eyeballs-style since v20: it tries the first
 *   family, waits `autoSelectFamilyAttemptTimeout` (250ms by default), then
 *   tries the other. Two of those is 500ms, which is uncomfortably close to the
 *   floor being measured. Rather than hunt for a hostname that happens to have
 *   no AAAA, this connects a bare TCP socket to port 443 **pinned to one family
 *   at a time** (`autoSelectFamily: false`), which asks the question directly:
 *   is the AAAA reachable from here at all, and what does each family cost?
 *
 * A pinned connect is the decisive reading. If family 6 times out where family
 * 4 connects in single digits, the fetch above it was paying to discover that
 * on every call, and the fix is a resolver order rather than anything about
 * Fly. If both families connect fast, IPv6 is exonerated and the floor is above
 * the transport.
 *
 * Delete this with the overlay once the numbers are in.
 */

/** Long enough to tell "slow" from "never", short enough not to hang the probe. */
const CONNECT_TIMEOUT_MS = 3000;

/** Where the API is, however this deployment is configured to reach it. */
const apiUrl = process.env.LEARNR_API_URL ?? 'http://localhost:3001';

/**
 * What to fetch. Every target answers something tiny, so the reading is the
 * journey and not the payload: `/health` is a word, `/cdn-cgi/trace` is a few
 * lines, and `/generate_204` is empty by definition.
 */
const FETCH_TARGETS = [
  { name: 'api (LEARNR_API_URL)', url: `${apiUrl}/health` },
  { name: 'api (owned name)', url: 'https://api.learnr.muzza.tech/health' },
  { name: 'api (fly name)', url: 'https://learnr-api-syd.fly.dev/health' },
  { name: 'cloudflare', url: 'https://www.cloudflare.com/cdn-cgi/trace' },
  { name: 'google', url: 'https://www.google.com/generate_204' },
];

/** The hostnames worth resolving and connecting to a family at a time. */
const CONNECT_HOSTS = [
  'api.learnr.muzza.tech',
  'learnr-api-syd.fly.dev',
  'www.cloudflare.com',
  'www.google.com',
];

interface Attempt {
  attempt: number;
  ms: number;
  status: number;
}

/** Three in a row, sequentially - the later two say whether anything was kept open. */
async function fetchAttempts(url: string): Promise<Attempt[]> {
  const attempts: Attempt[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const elapsed = stopwatch();
    let status = 0;
    try {
      status = (await fetch(url, { cache: 'no-store' })).status;
    } catch {
      status = -1;
    }
    attempts.push({ attempt, ms: elapsed(), status });
  }
  return attempts;
}

interface ConnectResult {
  ms: number;
  ok: boolean;
  error?: string;
}

/**
 * A bare TCP connect to port 443, pinned to one address family.
 *
 * No TLS and no request: this is asking whether the far side is reachable on
 * that family and what the handshake costs, which is the part happy eyeballs is
 * choosing between. `autoSelectFamily: false` is what makes the pin stick -
 * without it Node would helpfully try the other family and the reading would
 * measure the very fallback it exists to detect.
 */
function connectOnFamily(host: string, family: 4 | 6): Promise<ConnectResult> {
  const elapsed = stopwatch();
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: 443, family, autoSelectFamily: false });
    const settle = (ok: boolean, error?: string) => {
      socket.destroy();
      resolve({ ms: elapsed(), ok, ...(error ? { error } : {}) });
    };
    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false, 'timeout'));
    socket.once('error', (cause: NodeJS.ErrnoException) => settle(false, cause.code ?? cause.message));
  });
}

const addressesOr = async (read: Promise<string[]>): Promise<string[]> =>
  read.catch((cause: NodeJS.ErrnoException) => [`error: ${cause.code ?? cause.message}`]);

export async function GET(): Promise<Response> {
  const fetches: Record<string, Attempt[]> = {};
  for (const { name, url } of FETCH_TARGETS) fetches[name] = await fetchAttempts(url);

  const connects: Record<string, unknown> = {};
  for (const host of CONNECT_HOSTS) {
    const resolveElapsed = stopwatch();
    const [a, aaaa] = await Promise.all([
      addressesOr(dns.resolve4(host)),
      addressesOr(dns.resolve6(host)),
    ]);
    const resolveMs = resolveElapsed();

    // `dns.lookup` is what undici actually calls, and it can disagree with
    // `resolve*` about ordering - which is the whole question here.
    const lookupElapsed = stopwatch();
    const lookup = await dns
      .lookup(host, { all: true })
      .catch((cause: NodeJS.ErrnoException) => [{ address: `error: ${cause.code}`, family: 0 }]);

    connects[host] = {
      resolveMs,
      a,
      aaaa,
      lookupMs: lookupElapsed(),
      lookup,
      ipv4: await connectOnFamily(host, 4),
      ipv6: await connectOnFamily(host, 6),
    };
  }

  const body = {
    upMs: uptimeMs(),
    // What Node is configured to do when a name has both families, which is the
    // arithmetic the IPv6 hypothesis rests on.
    autoSelectFamily: net.getDefaultAutoSelectFamily(),
    autoSelectFamilyAttemptTimeoutMs: net.getDefaultAutoSelectFamilyAttemptTimeout(),
    dnsResultOrder: dns.getDefaultResultOrder(),
    nodeVersion: process.version,
    fetches,
    connects,
  };

  for (const [name, attempts] of Object.entries(fetches)) {
    logTiming(`probe fetch ${name}`, attempts[attempts.length - 1]?.ms ?? -1);
  }

  return Response.json(body);
}
