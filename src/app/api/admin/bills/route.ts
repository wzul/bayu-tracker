import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const createBillSchema = z.object({
  unitId: z.string(),
  monthYear: z.string().regex(/^\d{4}-\d{2}$/),
  baseAmount: z.number().min(0),
  dueDate: z.string().datetime(),
  additionalFee: z.number().optional(),
  discount: z.number().optional(),
  adjustment: z.number().optional(),
  penaltyAmount: z.number().optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const status = searchParams.get("status") ?? "";
    const monthYear = searchParams.get("monthYear") ?? "";
    const uuidQuery = searchParams.get("uuid") ?? "";

    const where: any = {};
    if (status) where.status = status;
    if (monthYear) where.monthYear = monthYear;
    if (uuidQuery) {
      where.uuid = { startsWith: uuidQuery };
    }

    const skip = (page - 1) * limit;

    const [bills, total] = await Promise.all([
      db.bill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: "desc" },
        include: { unit: { select: { block: true, floor: true, unitNo: true, ownerName: true } } },
      }),
      db.bill.count({ where }),
    ]);

    return NextResponse.json({ bills, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = createBillSchema.parse(body);

    const totalAmount = data.baseAmount
      + (data.additionalFee || 0)
      - (data.discount || 0)
      + (data.adjustment || 0)
      + (data.penaltyAmount || 0);

    const bill = await db.bill.create({
      data: {
        unitId: data.unitId,
        monthYear: data.monthYear,
        baseAmount: data.baseAmount,
        additionalFee: data.additionalFee || 0,
        discount: data.discount || 0,
        adjustment: data.adjustment || 0,
        penaltyAmount: data.penaltyAmount || 0,
        totalAmount,
        dueDate: new Date(data.dueDate),
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, bill }, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.name === "ZodError") return NextResponse.json({ error: err.errors }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
