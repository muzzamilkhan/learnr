import * as Sentry from '@sentry/nextjs';

/**
 * Next's server-side registration hook, and the one place the two server
 * runtimes are told apart. The browser half is `instrumentation-client.ts`,
 * which Next loads itself.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Every unhandled error thrown while rendering a page or serving a route
 * handler. This is what catches a failed Neon read on `/progress` - the case
 * the null convention is careful to *render* rather than crash on, and which
 * therefore has never been visible anywhere.
 */
export const onRequestError = Sentry.captureRequestError;
