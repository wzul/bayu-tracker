import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id } = await params;
    
    const updateData: any = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.baseAmount !== undefined) updateData.baseAmount = body.baseAmount;
    if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount;
    if (body.paidAt !== undefined) updateData.paidAt = new Date(body.paidAt);
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
    if (body.chipTransactionId !== undefined) updateData.chipTransactionId = body.chipTransactionId;
    
    const bill = await db.bill.update({
      where: { id },
      data: updateData,
    });
    
    return NextResponse.json({ success: true, bill });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await db.bill.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
