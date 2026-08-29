import { NextResponse } from 'next/server';
import { requireUser } from '@/server/session';
import { awardDailyTarget } from '@/server/records';
import { awardTargetBodySchema } from '../../../schemas';
import { failed } from '../../../respond';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireUser(request);
    const { id } = await params;

    const body = awardTargetBodySchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

    const awarded = await awardDailyTarget(userId, id, {
      now: Date.now(),
      offsetMinutes: body.data.offsetMinutes,
    });
    return NextResponse.json({ awarded });
  } catch (error) {
    return failed(error);
  }
}
