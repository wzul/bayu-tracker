import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const monthYear = searchParams.get("monthYear") || "";

    const where: any = {};
    if (monthYear) where.monthYear = monthYear;

    const [totalExpectedAgg, totalCollectedAgg, pendingAgg, paidAgg, overdueAgg] = await Promise.all([
      db.bill.aggregate({ where, _sum: { totalAmount: true } }),
      db.bill.aggregate({ where: { ...where, status: "PAID" }, _sum: { totalAmount: true } }),
      db.bill.count({ where: { ...where, status: "PENDING" } }),
      db.bill.count({ where: { ...where, status: "PAID" } }),
      db.bill.count({ where: { ...where, status: "OVERDUE" } }),
    ]);

    const totalExpected = Number(totalExpectedAgg._sum.totalAmount || 0);
    const totalCollected = Number(totalCollectedAgg._sum.totalAmount || 0);
    const collectionRate = totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(2) : "0.00";

    // Breakdown by block
    const bills = await db.bill.findMany({
      where: monthYear ? { monthYear } : undefined,
      include: { unit: { select: { block: true } } },
    });

    const byBlock: Record<string, { expected: number; collected: number }> = {};
    const byMethod: Record<string, number> = {};

    for (const b of bills) {
      const block = b.unit.block;
      if (!byBlock[block]) byBlock[block] = { expected: 0, collected: 0 };
      byBlock[block].expected += Number(b.totalAmount);
      if (b.status === "PAID") byBlock[block].collected += Number(b.totalAmount);

      if (b.paymentMethod) {
        byMethod[b.paymentMethod] = (byMethod[b.paymentMethod] || 0) + Number(b.totalAmount);
      }
    }

    return NextResponse.json({
      totalExpected,
      totalCollected,
      totalOutstanding: totalExpected - totalCollected,
      collectionRate,
      pendingCount: pendingAgg,
      paidCount: paidAgg,
      overdueCount: overdueAgg,
      byBlock,
      byMethod,
      monthYear,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
