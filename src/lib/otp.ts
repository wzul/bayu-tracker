// Shared in-memory OTP store (used by Telegram bot and forgot-password)
// In production, migrate to Redis or database

interface OtpState {
  code: string;
  email: string;
  expiresAt: Date;
}

const otpStore = new Map<string, OtpState>();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function makeKey(prefix: string, id: string) {
  return `${prefix}:${id}`;
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function setOtp(prefix: string, id: string, email: string): string {
  const code = generateOtp();
  otpStore.set(makeKey(prefix, id), {
    code,
    email,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  return code;
}

export function verifyOtp(prefix: string, id: string, code: string): boolean {
  const key = makeKey(prefix, id);
  const state = otpStore.get(key);
  if (!state) return false;
  if (state.expiresAt < new Date()) {
    otpStore.delete(key);
    return false;
  }
  if (state.code !== code) return false;
  otpStore.delete(key);
  return true;
}

export function clearOtp(prefix: string, id: string) {
  otpStore.delete(makeKey(prefix, id));
}

// Backwards compat for Telegram bot
const telegramOtpStore = new Map<number, OtpState>();

export function setTelegramOtp(chatId: number, email: string, code?: string): string {
  const otp = code || generateOtp();
  telegramOtpStore.set(chatId, {
    code: otp,
    email,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  return otp;
}

export function verifyTelegramOtp(chatId: number, code: string): boolean {
  const state = telegramOtpStore.get(chatId);
  if (!state) return false;
  if (state.expiresAt < new Date()) {
    telegramOtpStore.delete(chatId);
    return false;
  }
  if (state.code !== code) return false;
  telegramOtpStore.delete(chatId);
  return true;
}

export function getTelegramOtpEmail(chatId: number): string | null {
  const state = telegramOtpStore.get(chatId);
  if (!state || state.expiresAt < new Date()) return null;
  return state.email;
}

export function hasTelegramOtp(chatId: number): boolean {
  const state = telegramOtpStore.get(chatId);
  if (!state) return false;
  if (state.expiresAt < new Date()) {
    telegramOtpStore.delete(chatId);
    return false;
  }
  return true;
}
