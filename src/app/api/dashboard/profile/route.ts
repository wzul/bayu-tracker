import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

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
