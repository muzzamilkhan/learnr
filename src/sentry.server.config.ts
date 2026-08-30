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

  // Server only: the values of locals are attached to a stack frame, which is
  // most of what makes a production stack trace worth reading.
  includeLocalVariables: true,
});
