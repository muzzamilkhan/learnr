import { NextResponse } from 'next/server';
import { requireUser } from '@/server/session';
import { recordSessionEnd } from '@/server/records';
import { failed } from '../../../respond';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireUser(request);
    const { id } = await params;

    await recordSessionEnd(userId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return failed(error);
  }
}
