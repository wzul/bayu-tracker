import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = body.event;
    const purchase = body.purchase;

    if (!purchase?.id) {
      return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
    }

    const chipPurchaseId = String(purchase.id);

    // CHIP purchase.id may be shared across multiple bills (bulk pay)
    // We stored the same chipPurchaseId on all bills in the batch
    await db.bill.updateMany({
      where: { chipBillId: chipPurchaseId, status: { not: "PAID" } },
      data: {
        status: event === "purchase.paid" || purchase.status === "paid" ? "PAID" : "PENDING",
        ...(event === "purchase.paid" || purchase.status === "paid"
          ? { paidAt: new Date(), chipTransactionId: chipPurchaseId, paymentMethod: "CARD" }
          : {}),
      },
    });

    const updatedCount = await db.bill.count({ where: { chipBillId: chipPurchaseId, status: "PAID" } });
    console.log(`[webhook] CHIP purchase ${chipPurchaseId}: ${updatedCount} bills marked paid`);

    return NextResponse.json({ success: true, billsUpdated: updatedCount });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
