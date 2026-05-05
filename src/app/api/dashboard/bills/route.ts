import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "";
    const monthYear = searchParams.get("monthYear") ?? "";
    const uuidQuery = searchParams.get("uuid") ?? "";

    const where: any = { unitId: session.user.unitId ?? undefined };
    if (status) where.status = status;
    if (monthYear) where.monthYear = monthYear;
    if (uuidQuery) {
      where.uuid = { startsWith: uuidQuery };
    }

    const bills = await db.bill.findMany({
      where,
      orderBy: { dueDate: "desc" },
      take: 50,
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
