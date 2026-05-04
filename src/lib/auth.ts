import { cookies } from "next/headers";
import { validateSession } from "@/lib/session";
import { cache } from "react";

export const getUser = cache(async () => {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return null;

  return validateSession(token);
});

export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user || user.user.role !== "ADMIN") {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function isAdmin(): Promise<boolean> {
  try {
    const user = await getUser();
    return user?.user.role === "ADMIN";
  } catch {
    return false;
  }
}
