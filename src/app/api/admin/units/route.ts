import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createSchema = z.object({
  block: z.string().min(1),
  floor: z.string().min(1),
  unitNo: z.string().min(1),
  ownerName: z.string().min(1),
  ownerIc: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  monthlyFee: z.number().min(0),
  createUser: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const search = searchParams.get("search") ?? "";
    const block = searchParams.get("block") ?? "";
    const status = searchParams.get("status") ?? "";
    
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (search) {
      where.OR = [
        { ownerName: { contains: search, mode: "insensitive" } },
        { ownerIc: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { unitNo: { contains: search, mode: "insensitive" } },
      ];
    }
    if (block) where.block = block;
    if (status) where.status = status;
    
    const [units, total] = await Promise.all([
      db.unit.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ block: "asc" }, { floor: "asc" }, { unitNo: "asc" }],
        include: { _count: { select: { bills: true, users: true } } },
      }),
      db.unit.count({ where }),
    ]);
    
    return NextResponse.json({ units, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("List units error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = createSchema.parse(body);
    
    const existing = await db.unit.findUnique({ where: { ownerIc: data.ownerIc } });
    if (existing) {
      return NextResponse.json({ error: "IC already exists" }, { status: 409 });
    }
    
    const unit = await db.unit.create({
      data: {
        block: data.block,
        floor: data.floor,
        unitNo: data.unitNo,
        ownerName: data.ownerName,
        ownerIc: data.ownerIc,
        email: data.email,
        phone: data.phone,
        monthlyFee: data.monthlyFee,
        status: "ACTIVE",
      },
    });
    
    if (data.createUser) {
      const passwordHash = await bcrypt.hash("resident123", 12);
      await db.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: "RESIDENT",
          unitId: unit.id,
        },
      });
    }
    
    return NextResponse.json({ success: true, unit }, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.name === "ZodError") {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error("Create unit error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
