import * as Sentry from '@sentry/nextjs';

/**
 * Sentry in the browser - which on this app is a child's iPad.
 *
 * **No session replay, and that is a decision rather than an omission.** Replay
 * records the screen, and the screen here belongs to a child: their name, their
 * face on the profile menu, their answers and the family leaderboard. This is
 * the same judgement that keeps preview deployments off - a preview reads the
 * production database, and handing a family's data somewhere it needn't go
 * costs more than the debugging it buys. Turning it on is one integration and a
 * conversation about masking, not a default to drift into.
 *
 * `dataCollection` is omitted for the reason `sentry.server.config.ts` gives:
 * passing it at all, even empty, opts *in* to sending user info and request
 * bodies.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

  // Every trace - see `sentry.server.config.ts` for why this is not 0.1.
  tracesSampleRate: 1.0,
});

/**
 * App Router navigations, which are what a child's taps actually are: the door,
 * the level picker and the way into a speed run are all client transitions, and
 * without this hook none of them are a span.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
