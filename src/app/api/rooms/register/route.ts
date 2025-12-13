import { NextRequest, NextResponse } from 'next/server';
import { activeRooms } from '@/lib/rooms';

export async function POST(request: NextRequest) {
  try {
    const { roomId } = await request.json();
    console.log('[API] Room register request:', roomId);

    if (!roomId || typeof roomId !== 'string') {
      console.log('[API] Invalid roomId');
      return NextResponse.json(
        { error: 'Invalid roomId' },
        { status: 400 }
      );
    }

    activeRooms.add(roomId);
    console.log('[API] Room registered:', roomId);
    console.log('[API] Active rooms:', Array.from(activeRooms));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Room registration error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

