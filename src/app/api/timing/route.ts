import { logTiming, parseSamples } from '@/timing';

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
