import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyChipCallbackSignature } from "@/lib/chip-webhook";
import { chipGetPublicKey } from "@/lib/chip";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("x-signature") || "";
    const bodyText = await request.text();
    const body = JSON.parse(bodyText);

    if (signature) {
      const publicKey = await chipGetPublicKey();
      const valid = await verifyChipCallbackSignature(signature, bodyText, publicKey);
      if (!valid) {
        console.error("Subscription callback signature invalid");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const subscriptionId = String(body.subscription?.id || body.id);
    if (!subscriptionId) {
      return NextResponse.json({ error: "Missing subscription id" }, { status: 400 });
    }

    await db.subscription.updateMany({
      where: { chipSubscriptionId: subscriptionId },
      data: { status: "ACTIVE" },
    });

    console.log(`[subscription-callback] Subscription ${subscriptionId} activated`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Subscription callback error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
