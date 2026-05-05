import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { chipCancelSubscription } from "@/lib/chip";
import { logAudit } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    const { id } = await params;

    const subscription = await db.subscription.findUnique({
      where: { id },
      include: { unit: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    try {
      await chipCancelSubscription(subscription.chipSubscriptionId);
    } catch (err: any) {
      console.error("CHIP cancel API error:", err.message);
      // Continue to mark as cancelled locally even if CHIP API fails
    }

    await db.subscription.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await logAudit({
      action: "SUBSCRIPTION_CANCELLED",
      actorId: user.user.id,
      actorType: "admin",
      targetId: subscription.unitId,
      details: { subscriptionId: id, chipSubscriptionId: subscription.chipSubscriptionId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Cancel subscription error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
