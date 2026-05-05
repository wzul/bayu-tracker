import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { chipGetPurchase } from "@/lib/chip";

export async function POST(request: Request) {
  try {
    const session = await getUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { billId } = await request.json();
    if (!billId) {
      return NextResponse.json({ error: "billId required" }, { status: 400 });
    }

    const bill = await db.bill.findUnique({
      where: { id: billId },
      include: { unit: true },
    });

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    // Verify the user owns this bill
    if (bill.unitId !== session.user.unitId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If already paid, return immediately
    if (bill.status === "PAID") {
      return NextResponse.json({ success: true, status: "PAID", bill });
    }

    // If no chipBillId stored, cannot verify
    if (!bill.chipBillId) {
      return NextResponse.json({ success: true, status: bill.status, bill, verified: false });
    }

    // Query CHIP API for purchase status
    let chipPurchase: any;
    try {
      chipPurchase = await chipGetPurchase(bill.chipBillId);
    } catch (chipErr: any) {
      console.error("CHIP verify error:", chipErr.message);
      return NextResponse.json(
        { success: false, status: bill.status, error: "CHIP API error" },
        { status: 502 }
      );
    }

    const chipStatus = chipPurchase.status;
    const isPaid = chipStatus === "paid" || chipStatus === "closed" || chipStatus === "successful" || chipStatus === "completed";

    if (isPaid) {
      await db.bill.update({
        where: { id: bill.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          chipTransactionId: bill.chipBillId,
          paymentMethod: "CARD",
        },
      });
      console.log(`[verify] Bill ${bill.id} marked PAID via CHIP API check (status: ${chipStatus})`);
      return NextResponse.json({ success: true, status: "PAID", verified: true });
    }

    return NextResponse.json({ success: true, status: bill.status, chipStatus, verified: false });
  } catch (err: any) {
    console.error("Verify payment error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
