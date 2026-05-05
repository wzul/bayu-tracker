import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();

    const [totalUnits, activeUnits, totalBills, pendingBills, paidBills, overdueBills, totalUsers, totalCollected] = await Promise.all([
      db.unit.count(),
      db.unit.count({ where: { status: "ACTIVE" } }),
      db.bill.count(),
      db.bill.count({ where: { status: "PENDING" } }),
      db.bill.count({ where: { status: "PAID" } }),
      db.bill.count({ where: { status: "OVERDUE" } }),
      db.user.count(),
      db.bill.aggregate({
        where: { status: "PAID" },
        _sum: { totalAmount: true },
      }),
    ]);

    return NextResponse.json({
      totalUnits,
      activeUnits,
      totalBills,
      pendingBills,
      paidBills,
      overdueBills,
      totalUsers,
      totalCollected: Number(totalCollected._sum?.totalAmount ?? 0),
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
