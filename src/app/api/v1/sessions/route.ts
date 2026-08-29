import { NextResponse } from 'next/server';
import { requireUser } from '@/server/session';
import { prisma } from '@/server/db';
import { recordSessionStart } from '@/server/records';
import { createSessionSchema } from '../schemas';
import { failed } from '../respond';

/**
 * The id comes from the client so a child can open a sitting with no network
 * and reconcile later, and so one sitting can never be confused with another.
 * Repeating the call is how a retried flush behaves, so it answers 200 rather
 * than opening a second row.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userId = await requireUser(request);

    const body = createSessionSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
    const { id, subject, level, seed } = body.data;

    const existing = await prisma?.learningSession.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (existing) return NextResponse.json({ id }, { status: 200 });

    const created = await recordSessionStart({ id, userId, subject, level, seed });
    if (!created) {
      return NextResponse.json({ error: 'Could not open the sitting' }, { status: 503 });
    }

    return NextResponse.json({ id: created }, { status: 201 });
  } catch (error) {
    return failed(error);
  }
}
