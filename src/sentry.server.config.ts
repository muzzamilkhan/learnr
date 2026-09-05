import * as Sentry from '@sentry/nextjs';

/**
 * Sentry on the Node runtime - the page renders, the server actions and the six
 * route handlers under `/api/v1`.
 *
 * **`dataCollection` is deliberately absent, and that is the privacy decision.**
 * Omitting it leaves the SDK on `sendDefaultPii: false`; passing the object at
 * all - *even empty* - flips every unset category to its permissive default and
 * starts sending user info, cookies, headers and request bodies. This app's
 * users are children, and a request body here is a child's answer. So the
 * object is not passed, and any category wanted later has to be turned on by
 * name.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Vercel sets both; without them every event is tagged an unknown release,
  // which is what makes "did the deploy cause this?" unanswerable.
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  /*
    Every trace, rather than the 10% Sentry recommends for production. That
    recommendation is about keeping a busy app inside its quota; this one serves
    one family, and the free tier is 5M spans a month. Sampling a handful of
    sessions down to a tenth would throw away exactly the traces worth reading.
    Lower it the moment traffic makes that untrue.
  */
  tracesSampleRate: 1.0,

  /*
    `includeLocalVariables` is deliberately OFF, and it is the most expensive
    line this file ever had. It attaches a `node:inspector` session at init -
    `setupOnce` → `configureAndConnect` → `Debugger.enable` +
    `Debugger.setPauseOnExceptions: 'all'` - which happens in
    `instrumentation.ts`, *before* Next loads a single page module. Everything
    the cold start then resolves is resolved with the V8 debugger attached and
    pausing on every caught exception, and Node's module resolution throws and
    catches constantly.

    Measured on preview deployments, one variable at a time, first request to a
    fresh instance:

      Sentry as shipped, this on                      21.23s
      the same, plus registerEsmLoaderHooks: false    18.70s
      the same, this off                               1.09s
      Sentry removed from the server build entirely    0.86s

    So this one option was ~95% of a twenty-second cold start, and turning it
    off recovers all of what deleting Sentry would - at no cost to error
    reporting. Warm requests get faster too, from 0.8-1.2s to 0.08-0.22s.

    A local experiment badly underestimated it: the same module graph required
    with and without the inspector costs 335ms against 469ms on a laptop, about
    40%. Do not re-derive this one locally - the fast disk hides it, and the
    only honest measurement is a cold instance on Vercel
    (`npm run test:timings`).

    What it buys, when it is on, is the values of locals on a stack frame. That
    is genuinely useful and it is not worth twenty seconds in front of a child
    - but it is a line to turn back on deliberately, for one deploy, while
    chasing a specific bug.
  */
});
