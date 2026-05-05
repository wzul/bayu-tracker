import { NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await handleTelegramUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}
