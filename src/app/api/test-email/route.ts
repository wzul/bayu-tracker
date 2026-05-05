import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { to } = body;

    if (!to) {
      return NextResponse.json({ error: "Missing 'to' address" }, { status: 400 });
    }

    const ok = await sendEmail({
      to,
      subject: "Ujian Emel — Bayu Condo",
      html: `<h1>Ujian Emel Berjaya</h1><p>Ini adalah emel ujian daripada sistem Bayu Condo.</p>`,
      text: "Ujian emel berjaya daripada sistem Bayu Condo.",
    });

    return NextResponse.json({ success: ok });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
