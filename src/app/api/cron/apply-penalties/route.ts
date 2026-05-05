import { NextResponse } from "next/server";
import { applyPenalties } from "@/lib/billing";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await applyPenalties();

    console.log(`[cron] apply-penalties: ${result.updated} bills penalized`);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Apply penalties cron error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
