import { NextResponse } from 'next/server';

/**
 * TEMPORARY - delete once Sentry is confirmed working.
 *
 * A real error on a real route, so `onRequestError` in `src/instrumentation.ts`
 * is what reports it - the same path a genuine failure takes. A standalone
 * script would bypass `init` and prove nothing about the app.
 */
export async function GET(): Promise<NextResponse> {
  throw new Error('Sentry verification error - LearnR first error, delete this route');
}
