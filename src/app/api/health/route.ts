import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Query simple ke database
    const unitCount = await db.unit.count();
    const billCount = await db.bill.count();
    const userCount = await db.user.count();

    return NextResponse.json({
      status: 'ok',
      database: {
        connected: true,
        units: unitCount,
        bills: billCount,
        users: userCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      database: {
        connected: false,
        error: error.message,
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
