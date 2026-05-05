import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const configSchema = z.object({
  penaltyDays: z.number().min(0),
  penaltyPercent: z.number().min(0),
  retryDays: z.number().min(0),
  retryAttemptsPerDay: z.number().min(0),
  gatewayFeePercent: z.number().min(0),
  gatewayFeeFixed: z.number().min(0),
});

export async function GET() {
  try {
    const user = await requireAdmin();
    const config = await db.config.findFirst();
    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    return NextResponse.json({ config });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await request.json();
    const data = configSchema.parse(body);

    const existing = await db.config.findFirst();
    let config;
    if (existing) {
      config = await db.config.update({
        where: { id: existing.id },
        data,
      });
    } else {
      config = await db.config.create({ data });
    }

    await logAudit({
      action: "CONFIG_UPDATED",
      actorId: user.user.id,
      actorType: "admin",
      details: data,
    });

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.name === "ZodError") return NextResponse.json({ error: err.errors }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
