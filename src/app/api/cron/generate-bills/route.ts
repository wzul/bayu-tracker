import { NextResponse } from "next/server";
import { generateMonthlyBills } from "@/lib/billing";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const monthYear = `${year}-${month}`;

    // Due date: 20th of the month (or configurable)
    const dueDate = new Date(year, now.getMonth(), 20);

    const result = await generateMonthlyBills(monthYear, dueDate);

    console.log(`[cron] generate-bills: ${result.created} created, ${result.skipped} skipped for ${monthYear}`);
    return NextResponse.json({ success: true, monthYear, ...result });
  } catch (err: any) {
    console.error("Generate bills cron error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
