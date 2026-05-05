// Shared in-memory OTP store (used by Telegram bot and forgot-password)
// In production, migrate to Redis or database

interface OtpState {
  code: string;        // for web OTP (numeric)
  planet: string;      // for Telegram bot (planet name)
  email: string;
  expiresAt: Date;
}

const otpStore = new Map<string, OtpState>();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

const PLANETS = [
  "Mercury", "Venus", "Earth", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune",
];

function makeKey(prefix: string, id: string) {
  return `${prefix}:${id}`;
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generatePlanetOtp(): { planet: string; options: string[] } {
  const correctIndex = Math.floor(Math.random() * PLANETS.length);
  const correct = PLANETS[correctIndex];

  const distractors: string[] = [];
  const remaining = PLANETS.filter((_, i) => i !== correctIndex);
  while (distractors.length < 3) {
    const idx = Math.floor(Math.random() * remaining.length);
    const p = remaining.splice(idx, 1)[0];
    distractors.push(p);
  }

  const options = [correct, ...distractors];
  // Fisher-Yates shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { planet: correct, options };
}

export function setOtp(prefix: string, id: string, email: string): string {
  const code = generateOtp();
  otpStore.set(makeKey(prefix, id), {
    code,
    planet: "",
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

// ── Telegram bot planet OTP ───────────────────────────────────────────

const telegramOtpStore = new Map<number, OtpState>();

export function initTelegramOtp(chatId: number) {
  telegramOtpStore.set(chatId, {
    code: "",
    planet: "",
    email: "",
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
}

export function setTelegramOtp(chatId: number, email: string, planet?: string): string {
  const selectedPlanet = planet || generatePlanetOtp().planet;
  telegramOtpStore.set(chatId, {
    code: "",
    planet: selectedPlanet,
    email,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  return selectedPlanet;
}

export function verifyTelegramPlanet(chatId: number, planet: string): boolean {
  const state = telegramOtpStore.get(chatId);
  if (!state) return false;
  if (state.expiresAt < new Date()) {
    telegramOtpStore.delete(chatId);
    return false;
  }
  return state.planet === planet;
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

export function clearTelegramOtp(chatId: number) {
  telegramOtpStore.delete(chatId);
}
