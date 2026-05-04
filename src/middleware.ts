import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSession } from "@/lib/session";

export async function middleware(request: NextRequest) {
  // Skip public paths
  const publicPaths = ["/login", "/unauthorized", "/api/auth/login", "/api/auth/logout", "/api/webhooks/chip"];
  if (publicPaths.some((p) => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session_token")?.value;
  if (!token) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await validateSession(token);
  if (!session) {
    const response =
      request.nextUrl.pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("session_token");
    return response;
  }

  // Admin routes check
  if (request.nextUrl.pathname.startsWith("/admin/") || request.nextUrl.pathname.startsWith("/api/admin/")) {
    if (session.user.role !== "ADMIN") {
      return request.nextUrl.pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/admin/:path*", "/api/dashboard/:path*"],
};
