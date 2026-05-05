import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("session_token")?.value;
  if (token) {
    await deleteSession(token);
  }

  // Use Host header (respects reverse proxy) instead of request.url
  // which shows 0.0.0.0:3000 inside Docker
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const redirectUrl = `${protocol}://${host}/login`;

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set("session_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
  });

  return response;
}
