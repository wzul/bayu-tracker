import { db } from "./db";

export const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours
export const LONG_SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateToken() {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for older Node
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(userId: string, rememberMe = false) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + (rememberMe ? LONG_SESSION_DURATION : SESSION_DURATION));

  await db.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function validateSession(token: string) {
  const session = await db.session.findUnique({
    where: { token },
    include: { user: { include: { unit: true } } },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  // Refresh expiry if within last 24h of session
  const refreshThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (session.expiresAt < refreshThreshold) {
    const isLongSession = session.expiresAt.getTime() > Date.now() + SESSION_DURATION;
    const newExpiresAt = new Date(Date.now() + (isLongSession ? LONG_SESSION_DURATION : SESSION_DURATION));
    await db.session.update({
      where: { id: session.id },
      data: { expiresAt: newExpiresAt },
    });
    session.expiresAt = newExpiresAt;
  }

  return session;
}

export async function deleteSession(token: string) {
  await db.session.deleteMany({ where: { token } });
}
