import { NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegram';
import { rateLimit, getClientIP } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const limit = await rateLimit(ip, "webhook");
    if (!limit.allowed) {
      return NextResponse.json({ ok: true }); // Silently accept to avoid Telegram retries
    }

    const body = await request.json();
    await handleTelegramUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}
