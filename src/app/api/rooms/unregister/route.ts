import { NextRequest, NextResponse } from 'next/server';
import { activeRooms } from '@/lib/rooms';

export async function POST(request: NextRequest) {
  try {
    const { roomId } = await request.json();

    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid roomId' },
        { status: 400 }
      );
    }

    activeRooms.delete(roomId);
    console.log('Room unregistered:', roomId, 'Active rooms:', Array.from(activeRooms));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Room unregistration error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

