import * as Sentry from '@sentry/nextjs';

/**
 * Sentry on the Edge runtime. Nothing in this app runs there today - there is no
 * middleware - but Next loads this config when `NEXT_RUNTIME` says `edge`, and a
 * runtime that reports nothing is worse than one with nothing to report.
 *
 * `dataCollection` is omitted for the reason `sentry.server.config.ts` gives.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,

  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  tracesSampleRate: 1.0,
});
