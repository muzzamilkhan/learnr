import { NextResponse } from 'next/server';
import { requireUser } from '@/server/session';
import { awardRoundStars } from '@/server/records';
import { failed } from '../../../respond';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireUser(request);
    const { id } = await params;

    const stars = await awardRoundStars(userId, id);
    return NextResponse.json({ stars });
  } catch (error) {
    return failed(error);
  }
}
