import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const monthYear = searchParams.get("monthYear") ?? "";
    const method = searchParams.get("method") ?? "";
    const search = searchParams.get("search") ?? "";

    const where: any = { status: "PAID" };
    if (monthYear) where.monthYear = monthYear;
    if (method) where.paymentMethod = method;
    if (search) {
      where.unit = {
        OR: [
          { block: { contains: search, mode: "insensitive" } },
          { floor: { contains: search, mode: "insensitive" } },
          { unitNo: { contains: search, mode: "insensitive" } },
          { ownerName: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const skip = (page - 1) * limit;

    const [payments, total, summary] = await Promise.all([
      db.bill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          uuid: true,
          monthYear: true,
          totalAmount: true,
          paidAt: true,
          paymentMethod: true,
          chipTransactionId: true,
          receiptNo: true,
          receiptUrl: true,
          unit: { select: { block: true, floor: true, unitNo: true, ownerName: true } },
        },
      }),
      db.bill.count({ where }),
      db.bill.aggregate({
        where,
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      payments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      summary: {
        count: summary._count.id,
        totalAmount: summary._sum.totalAmount ?? 0,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
