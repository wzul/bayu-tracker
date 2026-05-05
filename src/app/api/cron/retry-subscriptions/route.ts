import { NextResponse } from "next/server";
import { retrySubscriptionCharges } from "@/lib/billing";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await retrySubscriptionCharges();

    console.log(`[cron] retry-subscriptions: ${result.attempted} attempted, ${result.succeeded} succeeded, ${result.exhausted} exhausted`);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Retry subscriptions cron error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
