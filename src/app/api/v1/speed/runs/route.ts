import { NextResponse } from 'next/server';
import { requireUser } from '@/server/session';
import { submitSpeedRun } from '@/server/speed-records';
import { parseMode } from '@/lib/speedrun/modes';
import { submitSpeedRunSchema } from '../../schemas';
import { failed } from '../../respond';

/**
 * No `playedAt`. It existed for an offline queue no client here has, so every
 * run is stamped with the server's own clock - `SpeedAttempt.playedAt` needed
 * no migration for this, since it already defaulted to `now()`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userId = await requireUser(request);

    const body = submitSpeedRunSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

    const mode = parseMode(body.data.mode);
    if (!mode) return NextResponse.json({ error: 'No such mode' }, { status: 400 });

    const outcome = await submitSpeedRun(userId, {
      id: body.data.id,
      mode,
      correct: body.data.correct,
      playedAt: new Date(),
    });
    if (!outcome) {
      return NextResponse.json({ error: 'Could not record the run' }, { status: 503 });
    }

    return NextResponse.json(outcome);
  } catch (error) {
    return failed(error);
  }
}
