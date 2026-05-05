import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { verifyChipWebhookSignature } from "@/lib/chip-webhook";

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const limit = await rateLimit(ip, "webhook");
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const signature = request.headers.get("x-signature") || "";
    const bodyText = await request.text();

    // Verify webhook signature if header present
    if (signature) {
      const valid = await verifyChipWebhookSignature(signature, bodyText);
      if (!valid) {
        console.error("CHIP webhook signature invalid");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const body = JSON.parse(bodyText);
    const event = body.event;
    const purchase = body.purchase;

    if (!purchase?.id) {
      return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
    }

    const chipPurchaseId = String(purchase.id);

    // Handle purchase.settled for bank reconciliation
    if (event === "purchase.settled") {
      const settledAt = purchase.settled_at ? new Date(purchase.settled_at * 1000) : new Date();
      const amount = purchase.amount ? purchase.amount / 100 : 0;

      // Find bills associated with this purchase
      const bills = await db.bill.findMany({
        where: { chipBillId: chipPurchaseId },
        select: { id: true },
      });

      for (const bill of bills) {
        await db.chipSettlement.upsert({
          where: { chipPurchaseId },
          create: {
            chipPurchaseId,
            billId: bill.id,
            settledAt,
            amount,
            status: "settled",
            rawWebhook: body,
          },
          update: {
            settledAt,
            amount,
            status: "settled",
            rawWebhook: body,
          },
        });
      }

      console.log(`[webhook] CHIP purchase ${chipPurchaseId} settled at ${settledAt.toISOString()}`);
      return NextResponse.json({ success: true, event: "purchase.settled" });
    }

    // Handle purchase.paid — mark bills as paid
    if (event === "purchase.paid" || purchase.status === "paid") {
      await db.bill.updateMany({
        where: { chipBillId: chipPurchaseId, status: { not: "PAID" } },
        data: {
          status: "PAID",
          paidAt: new Date(),
          chipTransactionId: chipPurchaseId,
          paymentMethod: "CARD",
        },
      });

      const updatedCount = await db.bill.count({
        where: { chipBillId: chipPurchaseId, status: "PAID" },
      });
      console.log(`[webhook] CHIP purchase ${chipPurchaseId}: ${updatedCount} bills marked paid`);
      return NextResponse.json({ success: true, billsUpdated: updatedCount });
    }

    return NextResponse.json({ success: true, event: event || "unknown" });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
