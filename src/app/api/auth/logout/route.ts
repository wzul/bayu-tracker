import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("session_token")?.value;
  if (token) {
    await deleteSession(token);
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set("session_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
  });

  return response;
}
