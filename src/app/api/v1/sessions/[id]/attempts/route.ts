import { NextResponse } from 'next/server';
import { requireUser } from '@/server/session';
import { recordAttempt } from '@/server/records';
import { parseFigure } from '@/lib/figures/types';
import { attemptsBodySchema } from '../../../schemas';
import { failed } from '../../../respond';

/**
 * A route handler rather than a server action, and that is the whole point.
 *
 * Next serialises server-action requests from one client, so the calls a single
 * answer makes queued behind each other while every one of them reported a
 * healthy server-side duration - a wait that existed only in the browser and
 * appeared in no log. See #17.
 *
 * The session is resolved once, here. No handler on this path calls `auth()`:
 * that was a Prisma query whose result was thrown away, measured at 717ms on a
 * cold client (#18).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireUser(request);
    const { id } = await params;

    const body = attemptsBodySchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

    let result = null;
    for (const attempt of body.data.attempts) {
      // The stored figure is read back through parseFigure for the reason it is
      // written on the way in: one bad mark fails the whole figure rather than
      // being dropped, because silently losing the tick that said a corner was
      // square would draw a picture buildFigure never produced.
      const figure = attempt.figure ? (parseFigure(attempt.figure) ?? undefined) : undefined;
      result = await recordAttempt(userId, id, { ...attempt, figure });
    }

    if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return failed(error);
  }
}
