import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const bills = await db.bill.findMany({
      where: { unitId: session.user.unitId ?? undefined },
      orderBy: { dueDate: "desc" },
      take: 24,
    });

    const config = await db.config.findFirst();

    return NextResponse.json({
      bills,
      gatewayFeePercent: Number(config?.gatewayFeePercent ?? 0),
      gatewayFeeFixed: Number(config?.gatewayFeeFixed ?? 0),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
