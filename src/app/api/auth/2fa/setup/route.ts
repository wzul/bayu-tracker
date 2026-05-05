import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

export async function POST() {
  try {
    const session = await requireAuth();
    const user = session.user;

    const secret = speakeasy.generateSecret({
      name: `Bayu Condo (${user.email})`,
      length: 32,
    });

    // Store secret temporarily (not enabled yet)
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret.base32 },
    });

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return NextResponse.json({
      success: true,
      secret: secret.base32,
      qrCode: qrDataUrl,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("2FA setup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
