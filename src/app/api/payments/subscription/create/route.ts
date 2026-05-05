import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { chipCreateSubscription } from "@/lib/chip";

export async function POST(request: Request) {
  try {
    const session = await getUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.user.unitId) return NextResponse.json({ error: "No unit assigned" }, { status: 400 });

    const unit = await db.unit.findUnique({
      where: { id: session.user.unitId },
    });
    if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bayu.wanzul-hosting.com";

    const chipData = await chipCreateSubscription({
      client: {
        email: unit.email,
        full_name: unit.ownerName,
      },
      subscription: {
        amount: Math.round(Number(unit.monthlyFee) * 100),
        currency: "MYR",
        title: `Maintenance Fee Auto-Debit — Unit ${unit.block}-${unit.floor}-${unit.unitNo}`,
      },
      success_redirect: `${appUrl}/dashboard?subscription=success`,
      failure_redirect: `${appUrl}/dashboard?subscription=failed`,
      cancel_redirect: `${appUrl}/dashboard`,
      success_callback: `${appUrl}/api/payments/subscription/success-callback`,
    });

    // Store subscription record
    await db.subscription.upsert({
      where: { unitId: unit.id },
      create: {
        unitId: unit.id,
        chipSubscriptionId: String(chipData.id),
        status: "PENDING",
      },
      update: {
        chipSubscriptionId: String(chipData.id),
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: chipData.checkout_url,
      subscriptionId: String(chipData.id),
    });
  } catch (err: any) {
    console.error("Subscription creation error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
