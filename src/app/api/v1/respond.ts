import { NextResponse } from 'next/server';
import { Forbidden, Unauthorized } from '@/server/session';

/**
 * One place the four failures a handler can have become responses.
 *
 * `src/browser-api.ts` turns every non-2xx into the same `null`, so the status
 * is for a person reading a log rather than for the caller. It still has to be
 * right: a 401 and a 500 mean very different things when play stops recording.
 */
export function failed(error: unknown): NextResponse {
  if (error instanceof Unauthorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (error instanceof Forbidden) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  console.error(error);
  return NextResponse.json({ error: 'failed' }, { status: 500 });
}
