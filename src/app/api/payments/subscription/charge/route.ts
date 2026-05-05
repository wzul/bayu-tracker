import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chipChargeSubscription } from "@/lib/chip";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId, billId } = body;

    if (!subscriptionId || !billId) {
      return NextResponse.json({ error: "Missing subscriptionId or billId" }, { status: 400 });
    }

    const bill = await db.bill.findUnique({
      where: { id: billId },
      include: { unit: true },
    });

    if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    if (bill.status === "PAID") return NextResponse.json({ error: "Bill already paid" }, { status: 409 });

    const chipData = await chipChargeSubscription(subscriptionId, Number(bill.totalAmount));

    if (chipData.status === "paid" || chipData.purchase?.status === "paid") {
      await db.bill.update({
        where: { id: billId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          chipTransactionId: String(chipData.purchase?.id || chipData.id),
          paymentMethod: "CARD",
        },
      });

      return NextResponse.json({ success: true, status: "PAID" });
    }

    return NextResponse.json({ success: false, status: chipData.status || "unknown" });
  } catch (err: any) {
    console.error("Subscription charge error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
