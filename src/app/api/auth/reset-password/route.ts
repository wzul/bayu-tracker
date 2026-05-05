import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOtp } from "@/lib/otp";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const limit = await rateLimit(ip, "reset_password");
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, otp, password } = schema.parse(body);

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (!verifyOtp("reset", user.id, otp)) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
