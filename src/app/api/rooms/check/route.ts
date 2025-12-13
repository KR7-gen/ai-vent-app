import { NextRequest, NextResponse } from 'next/server';
import { activeRooms } from '@/lib/rooms';

export async function POST(request: NextRequest) {
  try {
    const { roomId } = await request.json();
    console.log('[API] Room check request:', roomId);
    console.log('[API] Active rooms:', Array.from(activeRooms));

    if (!roomId || typeof roomId !== 'string') {
      console.log('[API] Invalid roomId');
      return NextResponse.json(
        { error: 'Invalid roomId' },
        { status: 400 }
      );
    }

    const exists = activeRooms.has(roomId);
    console.log('[API] Room exists:', exists);
    return NextResponse.json({ exists });
  } catch (error) {
    console.error('[API] Room check error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

