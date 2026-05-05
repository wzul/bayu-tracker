import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const monthYear = searchParams.get("monthYear") || "";

    const where: any = { status: "PAID" };
    if (monthYear) where.monthYear = monthYear;

    const bills = await db.bill.findMany({
      where,
      include: {
        unit: { select: { block: true, floor: true, unitNo: true, ownerName: true } },
        chipSettlement: true,
      },
      orderBy: { paidAt: "asc" },
    });

    const rows = bills.map((b) => ({
      id: b.id,
      monthYear: b.monthYear,
      receiptNo: b.receiptNo,
      unit: `${b.unit.block}-${b.unit.floor}-${b.unit.unitNo}`,
      ownerName: b.unit.ownerName,
      amount: Number(b.totalAmount),
      paymentMethod: b.paymentMethod,
      chipTransactionId: b.chipTransactionId,
      paidAt: b.paidAt,
      settledAt: b.chipSettlement?.settledAt || null,
      settled: !!b.chipSettlement,
    }));

    const totals = {
      card: rows.filter((r) => r.paymentMethod === "CARD").reduce((s, r) => s + r.amount, 0),
      fpx: rows.filter((r) => r.paymentMethod === "FPX").reduce((s, r) => s + r.amount, 0),
      cash: rows.filter((r) => r.paymentMethod === "CASH").reduce((s, r) => s + r.amount, 0),
      grandTotal: rows.reduce((s, r) => s + r.amount, 0),
    };

    return NextResponse.json({ rows, totals, monthYear });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
