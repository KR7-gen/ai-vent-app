import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[ai-reply] Request received');
    const { roomId, userText } = await request.json();
    console.log('[ai-reply] roomId:', roomId, 'userText length:', userText?.length);

    if (!userText || typeof userText !== 'string') {
      console.error('[ai-reply] Invalid userText');
      return NextResponse.json(
        { error: 'Invalid userText provided' },
        { status: 400 }
      );
    }

    if (!roomId || typeof roomId !== 'string') {
      console.error('[ai-reply] Invalid roomId');
      return NextResponse.json(
        { error: 'Invalid roomId provided' },
        { status: 400 }
      );
    }

    // OpenAI API Key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('[ai-reply] API key exists:', !!apiKey, 'API key length:', apiKey?.length || 0);
    if (!apiKey) {
      console.error('[ai-reply] OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Call OpenAI API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'あなたは優しく共感的な相談相手です。ユーザーの話に対して、1〜2文の共感と、1文の軽い質問で応答してください。カジュアルで親しみやすい口調で、短く簡潔に答えてください。',
            },
            {
              role: 'user',
              content: userText,
            },
          ],
          max_tokens: 150,
          temperature: 0.8,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const replyText = data.choices?.[0]?.message?.content?.trim();
      console.log('[ai-reply] OpenAI response received, replyText length:', replyText?.length || 0);

      if (!replyText) {
        console.error('[ai-reply] No response from OpenAI');
        throw new Error('No response from OpenAI');
      }

      console.log('[ai-reply] Returning replyText:', replyText.substring(0, 50) + '...');
      return NextResponse.json({ replyText });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('OpenAI API timeout');
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('AI reply error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}

