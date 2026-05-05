import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  phone: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
      },
      unit: session.user.unit,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const data = updateSchema.parse(body);

    if (session.user.unitId && data.phone !== undefined) {
      await db.unit.update({
        where: { id: session.user.unitId },
        data: { phone: data.phone },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.name === "ZodError") return NextResponse.json({ error: err.errors }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
