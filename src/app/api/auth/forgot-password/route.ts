import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { setOtp } from "@/lib/otp";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const limit = await rateLimit(ip, "forgot_password");
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = schema.parse(body);

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return NextResponse.json({ success: true });
    }

    const code = setOtp("reset", user.id, email);

    await sendEmail({
      to: email,
      subject: "Tetapan Semula Kata Laluan — Bayu Condo",
      html: `<h2>Tetapan Semula Kata Laluan</h2>
        <p>Kod OTP anda: <strong style="font-size:24px; letter-spacing:4px;">${code}</strong></p>
        <p>Kod ini sah selama 10 minit.</p>
        <p>Jika anda tidak meminta tetapan semula kata laluan, sila abaikan emel ini.</p>
      `,
      text: `Kod OTP tetapan semula kata laluan Bayu Condo anda: ${code}. Kod ini sah selama 10 minit.`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
