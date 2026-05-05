import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import speakeasy from "speakeasy";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  code: z.string().length(6),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { code, password } = schema.parse(body);

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true, twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ error: "2FA not enabled" }, { status: 400 });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 400 });
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.name === "ZodError") {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error("2FA disable error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
