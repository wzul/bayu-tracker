import { db } from "./db";
import { sendEmail } from "./email";
import {
  initTelegramOtp,
  setTelegramOtp,
  verifyTelegramPlanet,
  getTelegramOtpEmail,
  hasTelegramOtp,
  generatePlanetOtp,
  clearTelegramOtp,
} from "./otp";
import { classifyIntent } from "./intent";

const token = () => process.env.TELEGRAM_BOT_TOKEN;

// ── In-memory state ─────────────────────────────────────────────────
interface UserSession {
  userId: string;
  email: string;
  unitId: string | null;
  role: string;
  authenticatedAt: Date;
}

// Multi-step flow state (e.g. awaiting unit search input)
interface ChatState {
  mode: "awaiting_unit_query" | "awaiting_config_value" | "awaiting_createbill" | "awaiting_createunit";
  field?: string;
  messageId?: number;
  step?: number;
  data?: Record<string, any>;
}
const chatState = new Map<number, ChatState>();

// OTP expires in 10 minutes
const OTP_TTL_MS = 10 * 60 * 1000;

// ── Telegram API helpers ─────────────────────────────────────────────
export async function tgSend(
  chatId: number,
  text: string,
  opts?: { parse_mode?: string; reply_markup?: any }
) {
  if (!token()) {
    console.warn("TELEGRAM_BOT_TOKEN not set");
    return null;
  }
  return fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...opts }),
  });
}

export async function tgEditMessage(
  chatId: number,
  messageId: number,
  text: string,
  opts?: { parse_mode?: string; reply_markup?: any }
) {
  if (!token()) return null;
  return fetch(`https://api.telegram.org/bot${token()}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      ...opts,
    }),
  });
}

export async function tgAnswerCallback(callbackQueryId: string, text?: string) {
  if (!token()) return null;
  return fetch(`https://api.telegram.org/bot${token()}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// ── Admin check ──────────────────────────────────────────────────────
// Admin access is based solely on database User.role — no env var needed.
// All admin features require logging in first (same flow as residents).
async function isAdmin(chatId: number): Promise<boolean> {
  const sess = await db.telegramSession.findUnique({ where: { chatId: String(chatId) } });
  return sess?.role === "ADMIN";
}

// ── Auth helpers ─────────────────────────────────────────────────────
async function requireAuth(chatId: number): Promise<UserSession | null> {
  const sess = await db.telegramSession.findUnique({ where: { chatId: String(chatId) } });
  if (!sess) return null;
  return {
    userId: sess.userId,
    email: sess.email,
    unitId: sess.unitId ?? null,
    role: sess.role,
    authenticatedAt: sess.authenticatedAt,
  };
}

// ── Inline keyboards ─────────────────────────────────────────────────
function residentMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📋 Semak Bil", callback_data: "cek" }],
      [{ text: "💰 Bayar Bil", callback_data: "pay_menu" }],
      [{ text: "📊 Statistik", callback_data: "stats" }],
      [{ text: "📜 Sejarah Bayaran", callback_data: "history" }],
      [{ text: "❓ Bantuan", callback_data: "help" }],
    ],
  };
}

function adminMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📊 Ringkasan", callback_data: "summary" },
        { text: "💳 Pembayaran", callback_data: "payments_menu" },
      ],
      [
        { text: "🏠 Cari Unit", callback_data: "unit_search" },
        { text: "🧾 Bil Bulanan", callback_data: "bills_menu" },
      ],
      [
        { text: "📈 Laporan", callback_data: "reports_menu" },
        { text: "📋 Audit", callback_data: "audit_menu" },
      ],
      [
        { text: "⚙️ Tetapan", callback_data: "config" },
        { text: "👥 Admin Telegram", callback_data: "admin_menu" },
      ],
      [
        { text: "❓ Bantuan", callback_data: "help" },
        { text: "🚪 Log Keluar", callback_data: "logout" },
      ],
    ],
  };
}

function backButton(data: string) {
  return { inline_keyboard: [[{ text: "← Kembali", callback_data: data }]] };
}

function paginationKeyboard(current: number, total: number, prefix: string) {
  const buttons: any[] = [];
  if (current > 1) buttons.push({ text: "⬅️ Sebelum", callback_data: `${prefix}_page_${current - 1}` });
  buttons.push({ text: `${current}/${total}`, callback_data: "noop" });
  if (current < total) buttons.push({ text: "Seterusnya ➡️", callback_data: `${prefix}_page_${current + 1}` });
  return { inline_keyboard: [buttons, [{ text: "← Kembali", callback_data: "menu" }]] };
}

// ── Main dispatcher ──────────────────────────────────────────────────
export async function handleTelegramUpdate(update: any) {
  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return;
    }
    if (update.message?.text) {
      await handleMessage(update.message);
      return;
    }
  } catch (err) {
    console.error("Telegram handler error:", err);
    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    if (chatId) {
      await tgSend(chatId, "❌ Ralat sistem. Sila cuba sebentar lagi.");
    }
  }
}

async function handleCallbackQuery(cb: any) {
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;
  const data = cb.data;
  const userId = cb.from.id;

  await tgAnswerCallback(cb.id);

  // Auth-required callbacks (except menu/help/logout/planet)
  const publicCallbacks = ["menu", "help", "login", "logout"];
  if (!publicCallbacks.includes(data) && !data.startsWith("noop") && !data.startsWith("planet_")) {
    const session = await requireAuth(chatId);
    if (!session && !await isAdmin(chatId)) {
      await tgEditMessage(chatId, messageId, "🔒 Sila log masuk terlebih dahulu.", {
        reply_markup: {
          inline_keyboard: [[{ text: "🔑 Log Masuk", callback_data: "login" }]],
        },
      });
      return;
    }
  }

  // Planet OTP verification
  if (data.startsWith("planet_")) {
    const selectedPlanet = data.replace("planet_", "");

    if (!hasTelegramOtp(chatId)) {
      await tgEditMessage(chatId, messageId, "🔒 Sesi OTP tamat. Sila log masuk semula.", {
        reply_markup: {
          inline_keyboard: [[{ text: "🔑 Log Masuk", callback_data: "login" }]],
        },
      });
      return;
    }

    if (!verifyTelegramPlanet(chatId, selectedPlanet)) {
      await tgAnswerCallback(cb.id, "❌ Salah! Cuba lagi.");
      return;
    }

    // Success!
    const otpEmail = getTelegramOtpEmail(chatId);
    clearTelegramOtp(chatId);

    const user = await db.user.findUnique({
      where: { email: otpEmail || "" },
      include: { unit: true },
    });
    if (!user) {
      await tgEditMessage(chatId, messageId, "❌ Ralat pengesahan. Sila cuba lagi.", {
        reply_markup: {
          inline_keyboard: [[{ text: "🔑 Log Masuk", callback_data: "login" }]],
        },
      });
      return;
    }

    await db.telegramSession.upsert({
      where: { chatId: String(chatId) },
      create: {
        chatId: String(chatId),
        userId: user.id,
        email: user.email,
        unitId: user.unitId,
        role: user.role,
        authenticatedAt: new Date(),
      },
      update: {
        userId: user.id,
        email: user.email,
        unitId: user.unitId,
        role: user.role,
        authenticatedAt: new Date(),
      },
    });

    await tgEditMessage(
      chatId,
      messageId,
      `✅ Log masuk berjaya! Selamat datang, <b>${user.unit?.ownerName || user.email}</b>.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "📋 Menu Utama", callback_data: "menu" }]],
        },
      }
    );
    return;
  }

  // Route callbacks
  if (data === "menu") {
    await showMainMenu(chatId, await isAdmin(chatId));
    return;
  }
  if (data === "help") {
    await cmdHelp(chatId, await isAdmin(chatId));
    return;
  }
  if (data === "login") {
    await startOtpFlow(chatId);
    return;
  }
  if (data === "logout") {
    await db.telegramSession.deleteMany({ where: { chatId: String(chatId) } });
    await tgEditMessage(chatId, messageId, "👋 Anda telah log keluar. Tekan /start untuk mula.");
    return;
  }
  if (data === "cek") {
    const session = await requireAuth(chatId);
    if (session) await cmdCek(session.email, chatId);
    else await tgSend(chatId, "❌ Sesi tamat. Sila log masuk semula.", { reply_markup: backButton("menu") });
    return;
  }
  if (data === "pay_menu") {
    const session = await requireAuth(chatId);
    if (session) await showPayMenu(chatId, session);
    else await tgSend(chatId, "❌ Sesi tamat. Sila log masuk semula.", { reply_markup: backButton("menu") });
    return;
  }
  if (data === "pay_all") {
    const session = await requireAuth(chatId);
    if (session) await cmdPayAll(chatId, session);
    else await tgSend(chatId, "❌ Sesi tamat. Sila log masuk semula.", { reply_markup: backButton("menu") });
    return;
  }
  if (data === "history") {
    const session = await requireAuth(chatId);
    if (session) await cmdHistory(chatId, session);
    else await tgSend(chatId, "❌ Sesi tamat. Sila log masuk semula.", { reply_markup: backButton("menu") });
    return;
  }
  if (data === "stats") {
    const session = await requireAuth(chatId);
    if (session) await cmdStats(chatId, session);
    else await tgSend(chatId, "❌ Sesi tamat. Sila log masuk semula.", { reply_markup: backButton("menu") });
    return;
  }
  if (data === "summary") {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await cmdSummary(chatId);
    return;
  }
  if (data === "unit_search") {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    chatState.set(chatId, { mode: "awaiting_unit_query" });
    await tgSend(chatId, "🔍 Hantar nama pemilik atau unit (cth: <b>A-1-01</b>):");
    return;
  }
  if (data === "bills_menu") {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await showBillsMenu(chatId);
    return;
  }
  if (data === "config") {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await cmdConfig(chatId);
    return;
  }
  if (data === "reports_menu") {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await showReportsMenu(chatId);
    return;
  }
  if (data === "payments_menu") {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await cmdPayments(chatId, "", 1);
    return;
  }
  if (data === "audit_menu") {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await cmdAudit(chatId, 1);
    return;
  }
  if (data === "admin_menu") {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await showAdminManagementMenu(chatId);
    return;
  }
  if (data === "overdue") {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await cmdOverdue(chatId);
    return;
  }
  if (data === "listadmins") {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await cmdListAdmins(chatId);
    return;
  }
  if (data.startsWith("pay_")) {
    const billId = data.replace("pay_", "");
    const session = await requireAuth(chatId);
    if (session) await cmdPayBill(chatId, billId, session);
    else await tgSend(chatId, "❌ Sesi tamat. Sila log masuk semula.", { reply_markup: backButton("menu") });
    return;
  }
  if (data.startsWith("config_edit_")) {
    const field = data.replace("config_edit_", "");
    chatState.set(chatId, { mode: "awaiting_config_value", field });
    await tgSend(chatId, `✏️ Masukkan nilai baru untuk <b>${field}</b>:\n\n<i>Taip dalam mesej seterusnya.</i>`);
    return;
  }
  if (data.startsWith("bills_page_")) {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.");
      return;
    }
    const page = parseInt(data.replace("bills_page_", ""), 10);
    const month = new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0");
    await cmdBillsPaged(chatId, month, page);
    return;
  }
  if (data.startsWith("payments_page_")) {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.");
      return;
    }
    const page = parseInt(data.replace("payments_page_", ""), 10);
    await cmdPayments(chatId, "", page);
    return;
  }
  if (data.startsWith("audit_page_")) {
    if (!await isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.");
      return;
    }
    const page = parseInt(data.replace("audit_page_", ""), 10);
    await cmdAudit(chatId, page);
    return;
  }

  // Default
  await tgSend(chatId, "👋 Pilihan tidak sah.", { reply_markup: backButton("menu") });
}

async function handleMessage(msg: any) {
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const userId = msg.from.id;

  // Multi-step flow handling
  const state = chatState.get(chatId);
  if (state) {
    if (state.mode === "awaiting_unit_query" && await isAdmin(chatId)) {
      chatState.delete(chatId);
      await cmdUnit(text, chatId);
      return;
    }
    if (state.mode === "awaiting_config_value" && await isAdmin(chatId) && state.field) {
      chatState.delete(chatId);
      await cmdSetConfig(state.field, Number(text), chatId);
      return;
    }
    if (state.mode === "awaiting_createunit" && await isAdmin(chatId)) {
      await handleCreateUnitStep(chatId, text, state);
      return;
    }
  }

  // OTP reply handling
  if (hasTelegramOtp(chatId)) {
    await handleOtpReply(chatId, text);
    return;
  }

  // AI smart-command routing for natural-language messages
  if (!text.startsWith("/")) {
    const session = await requireAuth(chatId);
    const intent = await classifyIntent(text, {
      isAdmin: await isAdmin(chatId),
      hasSession: !!session,
      email: session?.email,
    });

    if (intent) {
      switch (intent.command) {
        case "cek":
          await cmdCek(session?.email || intent.target || "", chatId);
          return;
        case "summary":
          if (await isAdmin(chatId)) {
            await cmdSummary(chatId);
            return;
          }
          break;
        case "unit":
          if (await isAdmin(chatId) && intent.target) {
            await cmdUnit(intent.target, chatId);
            return;
          }
          break;
        case "overdue":
          if (await isAdmin(chatId)) {
            await cmdOverdue(chatId);
            return;
          }
          break;
        case "bills":
          if (await isAdmin(chatId)) {
            const month =
              intent.target ||
              new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0");
            await cmdBillsPaged(chatId, month, 1);
            return;
          }
          break;
        case "payments":
          if (await isAdmin(chatId)) {
            await cmdPayments(chatId, intent.target || "", 1);
            return;
          }
          break;
        case "reports":
          if (await isAdmin(chatId)) {
            const month =
              intent.target ||
              new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0");
            await cmdReports(chatId, month);
            return;
          }
          break;
        case "audit":
          if (await isAdmin(chatId)) {
            await cmdAudit(chatId, 1);
            return;
          }
          break;
        case "deletebill":
          if (await isAdmin(chatId) && intent.target) {
            await cmdDeleteBill(intent.target, chatId);
            return;
          }
          break;
        case "markpaid":
          if (await isAdmin(chatId) && intent.target) {
            await cmdMarkPaid(intent.target, chatId);
            return;
          }
          break;
        case "createunit":
          if (await isAdmin(chatId)) {
            chatState.set(chatId, { mode: "awaiting_createunit", step: 0, data: {} });
            await tgSend(chatId, "🏠 <b>Cipta Unit Baharu</b>\n\nLangkah 1/7: Sila masukkan <b>Blok</b> (cth: A):");
            return;
          }
          break;
        case "deleteunit":
          if (await isAdmin(chatId) && intent.target) {
            await cmdDeleteUnit(intent.target, chatId);
            return;
          }
          break;
        case "pay":
          if (session) {
            await showPayMenu(chatId, session);
            return;
          }
          break;
        case "history":
          if (session) {
            await cmdHistory(chatId, session);
            return;
          }
          break;
        case "stats":
          if (session) {
            await cmdStats(chatId, session);
            return;
          }
          break;
        case "contact":
          await cmdContact(chatId);
          return;
        case "logout":
          await db.telegramSession.deleteMany({ where: { chatId: String(chatId) } });
          await tgSend(chatId, "👋 Anda telah log keluar.");
          return;
        case "help":
          await cmdHelp(chatId, await isAdmin(chatId));
          return;
        case "login":
          await startOtpFlow(chatId);
          return;
        case "menu":
          await showMainMenu(chatId, await isAdmin(chatId));
          return;
      }
    }
    // No high-confidence intent: fall through to menu
    await showMainMenu(chatId, await isAdmin(chatId));
    return;
  }

  // Commands
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case "/start":
    case "/menu":
      await showMainMenu(chatId, await isAdmin(chatId));
      return;
    case "/help":
      await cmdHelp(chatId, await isAdmin(chatId));
      return;
    case "/login":
      await startOtpFlow(chatId);
      return;
    case "/logout": {
      await db.telegramSession.deleteMany({ where: { chatId: String(chatId) } });
      await tgSend(chatId, "👋 Anda telah log keluar.");
      return;
    }
    case "/stats": {
      const session = await requireAuth(chatId);
      if (!session) {
        await tgSend(chatId, "🔒 Sila log masuk terlebih dahulu.", {
          reply_markup: { inline_keyboard: [[{ text: "🔑 Log Masuk", callback_data: "login" }]] },
        });
        return;
      }
      await cmdStats(chatId, session);
      return;
    }
    case "/contact": {
      await cmdContact(chatId);
      return;
    }
    case "/cek": {
      const session = await requireAuth(chatId);
      if (!session) {
        await tgSend(chatId, "🔒 Sila log masuk terlebih dahulu.", {
          reply_markup: { inline_keyboard: [[{ text: "🔑 Log Masuk", callback_data: "login" }]] },
        });
        return;
      }
      if (!parts[1]) {
        await cmdCek(session.email, chatId);
        return;
      }
      await cmdCek(parts[1], chatId);
      return;
    }
    case "/summary":
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      await cmdSummary(chatId);
      return;
    case "/bills": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      const month =
        parts[1] ||
        new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0");
      await cmdBillsPaged(chatId, month, 1);
      return;
    }
    case "/unit": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      if (!parts[1]) {
        await tgSend(chatId, "❌ Guna: /unit <A-1-01> atau /unit <nama>");
        return;
      }
      await cmdUnit(parts[1], chatId);
      return;
    }
    case "/overdue": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      await cmdOverdue(chatId);
      return;
    }
    case "/config": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      await cmdConfig(chatId);
      return;
    }
    case "/listadmins": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      await cmdListAdmins(chatId);
      return;
    }
    case "/addadmin": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      if (parts.length < 3) {
        await tgSend(chatId, "❌ Guna: /addadmin <telegramId> <nama>");
        return;
      }
      await cmdAddAdmin(parts.slice(1), chatId);
      return;
    }
    case "/removeadmin": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      if (!parts[1]) {
        await tgSend(chatId, "❌ Guna: /removeadmin <telegramId>");
        return;
      }
      await cmdRemoveAdmin(parts[1], chatId);
      return;
    }
    case "/payments": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      const month = parts[1] || "";
      await cmdPayments(chatId, month, 1);
      return;
    }
    case "/reports": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      const month = parts[1] || new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0");
      await cmdReports(chatId, month);
      return;
    }
    case "/audit": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      await cmdAudit(chatId, 1);
      return;
    }
    case "/deletebill": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      if (!parts[1]) {
        await tgSend(chatId, "❌ Guna: /deletebill <id-atau-uuid>");
        return;
      }
      await cmdDeleteBill(parts[1], chatId);
      return;
    }
    case "/markpaid": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      if (!parts[1]) {
        await tgSend(chatId, "❌ Guna: /markpaid <id-atau-uuid>");
        return;
      }
      await cmdMarkPaid(parts[1], chatId);
      return;
    }
    case "/createunit": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      chatState.set(chatId, { mode: "awaiting_createunit", step: 0, data: {} });
      await tgSend(chatId, "🏠 <b>Cipta Unit Baharu</b>\n\nLangkah 1/7: Sila masukkan <b>Blok</b> (cth: A):");
      return;
    }
    case "/deleteunit": {
      if (!await isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      if (!parts[1]) {
        await tgSend(chatId, "❌ Guna: /deleteunit <unit-atau-nama>");
        return;
      }
      await cmdDeleteUnit(parts[1], chatId);
      return;
    }
  }

  // Admin config set commands
  if (cmd.startsWith("/set") && await isAdmin(chatId)) {
    const fieldMap: Record<string, string> = {
      "/setpenaltydays": "penaltyDays",
      "/setpenaltypercent": "penaltyPercent",
      "/setretrydays": "retryDays",
      "/setretryattempts": "retryAttemptsPerDay",
      "/setgatewayfee": "gatewayFeePercent",
    };
    const field = fieldMap[cmd];
    if (field && parts[1]) {
      await cmdSetConfig(field, Number(parts[1]), chatId);
      return;
    }
  }

  // Default: if text looks like an email (for admin searching or fallback)
  if (await isAdmin(chatId) && text.includes("@")) {
    await cmdUnit(text, chatId);
    return;
  }

  // Show menu for authenticated users, auth prompt for guests
  const session = await requireAuth(chatId);
  if (session || await isAdmin(chatId)) {
    await showMainMenu(chatId, await isAdmin(chatId));
  } else {
    await tgSend(chatId, "👋 Selamat datang ke <b>Bot Bayu Condo</b>.\n\nSila log masuk untuk mula.", {
      reply_markup: {
        inline_keyboard: [[{ text: "🔑 Log Masuk", callback_data: "login" }]],
      },
    });
  }
}

// ── Auth flows ───────────────────────────────────────────────────────
async function startOtpFlow(chatId: number) {
  initTelegramOtp(chatId);
  await tgSend(chatId, "🔐 <b>Log Masuk</b>\n\nSila masukkan alamat emel anda:");
}

async function handleOtpReply(chatId: number, text: string) {
  const email = getTelegramOtpEmail(chatId);

  // Allow commands to escape OTP flow
  if (text.startsWith("/")) {
    if (text.toLowerCase().startsWith("/login")) {
      await startOtpFlow(chatId);
      return;
    }
    if (text.toLowerCase().startsWith("/start") || text.toLowerCase().startsWith("/menu")) {
      clearTelegramOtp(chatId);
      await showMainMenu(chatId, await isAdmin(chatId));
      return;
    }
    if (text.toLowerCase().startsWith("/help")) {
      clearTelegramOtp(chatId);
      await cmdHelp(chatId, await isAdmin(chatId));
      return;
    }
    clearTelegramOtp(chatId);
    await tgSend(chatId, "❌ Log masuk dibatalkan. Taip /login untuk mula semula.");
    return;
  }

  // Step 1: email input
  if (!email) {
    const inputEmail = text.trim().toLowerCase();
    if (!inputEmail.includes("@") || !inputEmail.includes(".")) {
      await tgSend(chatId, "❌ Emel tidak sah. Sila masukkan emel yang betul.");
      return;
    }

    // Check if email exists in system
    const user = await db.user.findUnique({
      where: { email: inputEmail },
      include: { unit: true },
    });
    if (!user) {
      await tgSend(chatId, "❌ Emel tidak dijumpai dalam sistem. Sila cuba lagi atau hubungi pentadbiran.");
      return;
    }

    const { planet, options } = generatePlanetOtp();
    setTelegramOtp(chatId, inputEmail, planet);

    const sent = await sendEmail({
      to: inputEmail,
      subject: "Pengesahan Log Masuk — Bayu Condo",
      html: `<h2>Pengesahan Log Masuk Bayu Condo</h2>
        <p>Nama planet anda: <strong style="font-size:24px; letter-spacing:2px;">${planet}</strong></p>
        <p>Sila pilih nama planet yang betul di aplikasi Telegram.</p>
        <p>Pengesahan ini sah selama 10 minit.</p>
        <p>Jika anda tidak meminta pengesahan ini, sila abaikan emel ini.</p>
      `,
      text: `Nama planet pengesahan Bayu Condo anda: ${planet}. Pilih yang betul di Telegram. Sah selama 10 minit.`,
    });

    if (!sent) {
      await tgSend(chatId, "❌ Gagal menghantar emel. Sila cuba sebentar lagi.");
      return;
    }

    // Build inline keyboard with 4 planet buttons (2 per row)
    const keyboard: any[] = [];
    for (let i = 0; i < options.length; i += 2) {
      const row: any[] = [];
      row.push({ text: options[i], callback_data: `planet_${options[i]}` });
      if (options[i + 1]) {
        row.push({ text: options[i + 1], callback_data: `planet_${options[i + 1]}` });
      }
      keyboard.push(row);
    }

    await tgSend(
      chatId,
      `📧 Emel pengesahan telah dihantar ke <b>${inputEmail}</b>.\n\nSila pilih nama planet yang betul:`,
      { reply_markup: { inline_keyboard: keyboard } }
    );
    return;
  }

  // If email is already set, user should be clicking inline keyboard buttons
  await tgSend(
    chatId,
    "❌ Sila pilih nama planet yang betul dari butang di atas, atau taip /login untuk mula semula."
  );
}

// ── Menu display ─────────────────────────────────────────────────────
async function showMainMenu(chatId: number, admin: boolean) {
  const text = admin
    ? "🏢 <b>Menu Pentadbir Bayu Condo</b>\n\nPilih tindakan:"
    : "🏠 <b>Menu Penduduk Bayu Condo</b>\n\nPilih tindakan:";
  await tgSend(chatId, text, {
    reply_markup: admin ? adminMenuKeyboard() : residentMenuKeyboard(),
  });
}

async function showPayMenu(chatId: number, session: UserSession) {
  if (!session.unitId) {
    await tgSend(chatId, "❌ Tiada unit dihubungkan dengan akaun ini.", { reply_markup: backButton("menu") });
    return;
  }

  const bills = await db.bill.findMany({
    where: { unitId: session.unitId, status: { in: ["PENDING", "OVERDUE"] } },
    orderBy: { dueDate: "asc" },
  });

  if (bills.length === 0) {
    await tgSend(chatId, "✅ Tiada bil tertunggak. Semua bil telah dibayar!", { reply_markup: backButton("menu") });
    return;
  }

  let text = "💰 <b>Bil Tertunggak</b>\n\n";
  const keyboard: any[] = [];

  bills.slice(0, 10).forEach((b) => {
    const ref = b.uuid ? ` [${b.uuid.slice(0, 7)}]` : "";
    text += `• ${b.monthYear}${ref} — RM ${Number(b.totalAmount).toFixed(2)}\n`;
    keyboard.push([
      {
        text: `💳 Bayar ${b.monthYear}${ref} (RM ${Number(b.totalAmount).toFixed(2)})`,
        callback_data: `pay_${b.id}`,
      },
    ]);
  });

  if (bills.length > 10) text += `\n...dan ${bills.length - 10} lagi\n`;

  if (bills.length > 1) {
    const total = bills.reduce((s, b) => s + Number(b.totalAmount), 0);
    keyboard.push([{ text: `💳 Bayar Semua (${bills.length} bil — RM ${total.toFixed(2)})`, callback_data: "pay_all" }]);
  }

  keyboard.push([{ text: "← Kembali", callback_data: "menu" }]);
  await tgSend(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
}

async function showBillsMenu(chatId: number) {
  const now = new Date();
  const month = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  await cmdBillsPaged(chatId, month, 1);
}

async function showReportsMenu(chatId: number) {
  const text = "📈 <b>Laporan</b>\n\nPilih jenis laporan:";
  await tgSend(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 Penyelarasan Bulanan", callback_data: "reconciliation" }],
        [{ text: "📋 Bil Lewat", callback_data: "overdue" }],
        [{ text: "← Kembali", callback_data: "menu" }],
      ],
    },
  });
}

async function showAdminManagementMenu(chatId: number) {
  await tgSend(chatId, "👥 <b>Pengurusan Admin Telegram</b>", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Senarai Admin", callback_data: "listadmins" }],
        [{ text: "← Kembali", callback_data: "menu" }],
      ],
    },
  });
}

// ── Resident commands ────────────────────────────────────────────────
async function cmdCek(phoneOrEmail: string, chatId: number) {
  // Search by user email or unit phone
  const user = await db.user.findFirst({
    where: { email: phoneOrEmail },
    include: { unit: { include: { bills: { orderBy: { dueDate: "desc" } } } } },
  });
  let unit = user?.unit;
  if (!unit) {
    unit = await db.unit.findFirst({
      where: { phone: phoneOrEmail },
      include: { bills: { orderBy: { dueDate: "desc" } } },
    });
  }
  if (!unit) {
    await tgSend(chatId, "❌ Unit tidak dijumpai.");
    return;
  }
  const pending = unit.bills.filter((b) => b.status === "PENDING" || b.status === "OVERDUE");
  const paid = unit.bills.filter((b) => b.status === "PAID");
  const totalPending = pending.reduce((s, b) => s + Number(b.totalAmount), 0);

  let text = `🏠 <b>Unit ${unit.block}-${unit.floor}-${unit.unitNo}</b>\n👤 <b>${unit.ownerName}</b>\n\n`;

  if (pending.length > 0) {
    text += `⚠️ <b>Bil Tertunggak: ${pending.length}</b>\n💰 Jumlah: RM ${totalPending.toFixed(2)}\n\n`;
    pending.slice(0, 5).forEach((b) => {
      const status = b.status === "OVERDUE" ? "🔴 LEWAT" : "🟡 TERTUNGGAK";
      const ref = b.uuid ? ` [${b.uuid.slice(0, 7)}]` : "";
      text += `• ${b.monthYear}${ref} — RM ${Number(b.totalAmount).toFixed(2)} — ${status}\n`;
    });
    if (pending.length > 5) text += `\n...dan ${pending.length - 5} lagi\n`;
  } else {
    text += "✅ Tiada bil tertunggak!\n";
  }

  const totalPaid = paid.reduce((s, b) => s + Number(b.totalAmount), 0);
  text += `\n📜 Bil Lunas: ${paid.length} (Jumlah: RM ${totalPaid.toFixed(2)})`;

  await tgSend(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💰 Bayar Sekarang", callback_data: "pay_menu" }],
        [{ text: "← Kembali", callback_data: "menu" }],
      ],
    },
  });
}

async function cmdHistory(chatId: number, session: UserSession) {
  if (!session.unitId) {
    await tgSend(chatId, "❌ Tiada unit dihubungkan.");
    return;
  }
  const bills = await db.bill.findMany({
    where: { unitId: session.unitId, status: "PAID" },
    orderBy: { paidAt: "desc" },
    take: 10,
  });

  if (bills.length === 0) {
    await tgSend(chatId, "📜 Tiada rekod pembayaran lagi.", { reply_markup: backButton("menu") });
    return;
  }

  const totalPaid = bills.reduce((s, b) => s + Number(b.totalAmount), 0);

  let text = "📜 <b>Sejarah Pembayaran</b>\n\n";
  bills.forEach((b) => {
    const date = b.paidAt
      ? new Date(b.paidAt).toLocaleDateString("ms-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric" })
      : "-";
    text += `• ${b.monthYear} — RM ${Number(b.totalAmount).toFixed(2)} — ${date}\n`;
  });
  text += `\n💰 <b>Jumlah Dibayar: RM ${totalPaid.toFixed(2)}</b>`;

  await tgSend(chatId, text, { reply_markup: backButton("menu") });
}

async function cmdStats(chatId: number, session: UserSession) {
  if (!session.unitId) {
    await tgSend(chatId, "❌ Tiada unit dihubungkan.");
    return;
  }

  const allBills = await db.bill.findMany({
    where: { unitId: session.unitId },
  });

  const currentYear = new Date().getFullYear();
  const paidThisYear = allBills.filter((b) => b.status === "PAID" && b.monthYear.startsWith(String(currentYear)));
  const pending = allBills.filter((b) => b.status === "PENDING" || b.status === "OVERDUE");
  const totalPaidThisYear = paidThisYear.reduce((s, b) => s + Number(b.totalAmount), 0);
  const totalPending = pending.reduce((s, b) => s + Number(b.totalAmount), 0);

  const yearly: Record<string, { paid: number; count: number }> = {};
  allBills.filter((b) => b.status === "PAID").forEach((b) => {
    const year = b.monthYear.split("-")[0];
    if (!yearly[year]) yearly[year] = { paid: 0, count: 0 };
    yearly[year].paid += Number(b.totalAmount);
    yearly[year].count += 1;
  });

  let text = `📊 <b>Statistik Pembayaran</b>\n\n`;
  text += `💰 <b>Jumlah Dibayar (${currentYear}):</b> RM ${totalPaidThisYear.toFixed(2)}\n`;
  text += `⚠️ <b>Jumlah Tertunggak:</b> RM ${totalPending.toFixed(2)}\n`;
  text += `📜 Bil Lunas: ${allBills.filter((b) => b.status === "PAID").length}\n`;
  text += `🟡 Bil Tertunggak: ${pending.length}\n\n`;

  const years = Object.keys(yearly).sort().reverse();
  if (years.length > 0) {
    text += `<b>Rumusan Tahunan:</b>\n`;
    years.forEach((y) => {
      text += `• ${y}: RM ${yearly[y].paid.toFixed(2)} (${yearly[y].count} bil)\n`;
    });
  }

  await tgSend(chatId, text, { reply_markup: backButton("menu") });
}

async function cmdContact(chatId: number) {
  await tgSend(chatId, "📞 <b>Hubungi Pentadbiran Bayu Condo</b>\n\nSila hubungi pihak pengurusan melalui emel atau telefon yang telah disediakan di portal web.", { reply_markup: backButton("menu") });
}

async function cmdPayBill(chatId: number, billId: string, session: UserSession) {
  if (!session.unitId) {
    await tgSend(chatId, "❌ Tiada unit dihubungkan.");
    return;
  }

  const bill = await db.bill.findUnique({
    where: { id: billId, unitId: session.unitId },
    include: { unit: true },
  });

  if (!bill) {
    await tgSend(chatId, "❌ Bil tidak dijumpai.");
    return;
  }
  if (bill.status === "PAID") {
    await tgSend(chatId, "✅ Bil ini telah dibayar.");
    return;
  }

  // Apply gateway fee at payment time (same as web app)
  const config = await db.config.findFirst();
  const fixedFeeInRM = Number(config?.gatewayFeeFixed ?? 0) / 100;
  const percentFee = Number(bill.baseAmount) * (Number(config?.gatewayFeePercent ?? 0) / 100);
  const newAdditionalFee = percentFee + fixedFeeInRM;
  const newTotalAmount =
    Number(bill.baseAmount) +
    newAdditionalFee -
    Number(bill.discount) +
    Number(bill.adjustment) +
    Number(bill.penaltyAmount);

  await db.bill.update({
    where: { id: bill.id },
    data: {
      additionalFee: newAdditionalFee,
      totalAmount: newTotalAmount,
    },
  });

  const chipSecret = process.env.CHIP_SECRET_KEY;
  const chipBrandId = process.env.CHIP_BRAND_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const chipApiUrl = process.env.CHIP_API_URL || "https://gate.chip-in.asia/api/v1/";

  if (!chipSecret || !chipBrandId) {
    await tgSend(chatId, "❌ Sistem pembayaran tidak dikonfigurasi.");
    return;
  }

  const chipRes = await fetch(`${chipApiUrl}purchases/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chipSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      brand_id: chipBrandId,
      client: {
        email: session.email,
        full_name: bill.unit.ownerName,
      },
      purchase: {
        products: [{
          name: `Maintenance ${bill.monthYear}`,
          price: Math.round(newTotalAmount * 100),
          quantity: 1,
        }],
      },
      success_redirect: `${appUrl}/payment/telegram-success?status=success`,
      failure_redirect: `${appUrl}/payment/telegram-success?status=failed`,
      cancel_redirect: `${appUrl}/payment/telegram-success?status=cancelled`,
      success_callback: `${appUrl}/api/webhooks/chip`,
      send_receipt: false,
      due_strict: true,
    }),
  });

  const chipData = await chipRes.json();
  if (!chipRes.ok) {
    console.error("CHIP error:", chipData);
    await tgSend(chatId, "❌ Ralat gateway pembayaran. Sila cuba lagi.");
    return;
  }

  await db.bill.update({
    where: { id: bill.id },
    data: { chipBillId: String(chipData.id) },
  });

  const text = `💳 <b>Pembayaran Bil ${bill.monthYear}</b>\n\nJumlah: RM ${newTotalAmount.toFixed(2)}\n\nSila klik pautan di bawah untuk membayar:`;
  await tgSend(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔗 Bayar Sekarang", url: chipData.checkout_url }],
        [{ text: "← Kembali", callback_data: "pay_menu" }],
      ],
    },
  });
}

async function cmdPayAll(chatId: number, session: UserSession) {
  if (!session.unitId) {
    await tgSend(chatId, "❌ Tiada unit dihubungkan.");
    return;
  }

  const bills = await db.bill.findMany({
    where: { unitId: session.unitId, status: { in: ["PENDING", "OVERDUE"] } },
    include: { unit: true },
    orderBy: { dueDate: "asc" },
  });

  if (bills.length === 0) {
    await tgSend(chatId, "✅ Tiada bil tertunggak.", { reply_markup: backButton("menu") });
    return;
  }

  const config = await db.config.findFirst();
  const fixedFeeInRM = Number(config?.gatewayFeeFixed ?? 0) / 100;
  const gatewayFeePercent = Number(config?.gatewayFeePercent ?? 0);

  // Recalculate gateway fees for each bill
  for (const b of bills) {
    const percentFee = Number(b.baseAmount) * (gatewayFeePercent / 100);
    const total =
      Number(b.baseAmount) +
      percentFee -
      Number(b.discount) +
      Number(b.adjustment) +
      Number(b.penaltyAmount);
    await db.bill.update({
      where: { id: b.id },
      data: { additionalFee: percentFee, totalAmount: total },
    });
  }

  // Add fixed fee to the first bill (one fixed fee per transaction)
  const firstBill = bills[0];
  const firstPercent = Number(firstBill.baseAmount) * (gatewayFeePercent / 100);
  const firstNewAdditionalFee = firstPercent + fixedFeeInRM;
  const firstNewTotal =
    Number(firstBill.baseAmount) +
    firstNewAdditionalFee -
    Number(firstBill.discount) +
    Number(firstBill.adjustment) +
    Number(firstBill.penaltyAmount);
  await db.bill.update({
    where: { id: firstBill.id },
    data: { additionalFee: firstNewAdditionalFee, totalAmount: firstNewTotal },
  });

  const updatedBills = await db.bill.findMany({
    where: { id: { in: bills.map((b) => b.id) } },
    orderBy: { dueDate: "asc" },
  });

  const totalAmount = updatedBills.reduce((s, b) => s + Number(b.totalAmount), 0);

  const chipSecret = process.env.CHIP_SECRET_KEY;
  const chipBrandId = process.env.CHIP_BRAND_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const chipApiUrl = process.env.CHIP_API_URL || "https://gate.chip-in.asia/api/v1/";

  if (!chipSecret || !chipBrandId) {
    await tgSend(chatId, "❌ Sistem pembayaran tidak dikonfigurasi.");
    return;
  }

  const chipRes = await fetch(`${chipApiUrl}purchases/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chipSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      brand_id: chipBrandId,
      client: {
        email: session.email,
        full_name: firstBill.unit.ownerName,
      },
      purchase: {
        products: updatedBills.map((b) => ({
          name: `Maintenance ${b.monthYear}`,
          price: Math.round(Number(b.totalAmount) * 100),
          quantity: 1,
        })),
      },
      success_redirect: `${appUrl}/payment/telegram-success?status=success`,
      failure_redirect: `${appUrl}/payment/telegram-success?status=failed`,
      cancel_redirect: `${appUrl}/payment/telegram-success?status=cancelled`,
      success_callback: `${appUrl}/api/webhooks/chip`,
      send_receipt: false,
      due_strict: true,
    }),
  });

  const chipData = await chipRes.json();
  if (!chipRes.ok) {
    console.error("CHIP bulk error:", chipData);
    await tgSend(chatId, "❌ Ralat gateway pembayaran. Sila cuba lagi.");
    return;
  }

  const chipPurchaseId = String(chipData.id);
  await db.bill.updateMany({
    where: { id: { in: bills.map((b) => b.id) } },
    data: { chipBillId: chipPurchaseId },
  });

  const text = `💳 <b>Pembayaran Pukal (${updatedBills.length} bil)</b>\n\nJumlah: RM ${totalAmount.toFixed(2)}\n\nSila klik pautan di bawah untuk membayar:`;
  await tgSend(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔗 Bayar Sekarang", url: chipData.checkout_url }],
        [{ text: "← Kembali", callback_data: "pay_menu" }],
      ],
    },
  });
}

// ── Admin commands ─────────────────────────────────────────────────
async function cmdSummary(chatId: number) {
  const [pendingCount, paidCount, overdueCount, totalCollected] = await Promise.all([
    db.bill.count({ where: { status: "PENDING" } }),
    db.bill.count({ where: { status: "PAID" } }),
    db.bill.count({ where: { status: "OVERDUE" } }),
    db.bill.aggregate({ where: { status: "PAID" }, _sum: { totalAmount: true } }),
  ]);
  const paidToday = await db.bill.count({
    where: { status: "PAID", paidAt: { gte: new Date(Date.now() - 86400000) } },
  });
  const text =
    `📊 <b>Ringkasan Sistem Bayu</b>\n\n` +
    `✅ Lunas: ${paidCount}\n` +
    `⏳ Tertunggak: ${pendingCount}\n` +
    `🔴 Lewat: ${overdueCount}\n` +
    `💰 Jumlah Kutipan: RM ${Number(totalCollected._sum.totalAmount || 0).toFixed(2)}\n` +
    `📅 Bayar Hari Ini: ${paidToday}`;
  await tgSend(chatId, text, { reply_markup: backButton("menu") });
}

async function cmdBillsPaged(chatId: number, month: string, page: number) {
  const limit = 15;
  const skip = (page - 1) * limit;

  const [bills, total] = await Promise.all([
    db.bill.findMany({
      where: { monthYear: month },
      include: { unit: true },
      orderBy: { status: "asc" },
      skip,
      take: limit,
    }),
    db.bill.count({ where: { monthYear: month } }),
  ]);

  if (bills.length === 0) {
    await tgSend(chatId, `<b>Bil ${month}</b>\n\nTiada rekod bil.`, { reply_markup: backButton("menu") });
    return;
  }

  const totalAmount = bills.reduce((s, b) => s + Number(b.totalAmount), 0);
  let text = `🧾 <b>Bil ${month}</b>\n💰 Jumlah dipapar: RM ${totalAmount.toFixed(2)}\n\n`;

  bills.forEach((b) => {
    const status = b.status === "PAID" ? "✅" : b.status === "OVERDUE" ? "🔴" : "⏳";
    text += `${status} ${b.unit.block}-${b.unit.floor}-${b.unit.unitNo}: RM ${Number(b.totalAmount).toFixed(2)}\n`;
  });

  const totalPages = Math.ceil(total / limit);
  await tgSend(chatId, text, { reply_markup: paginationKeyboard(page, totalPages, "bills") });
}

async function cmdOverdue(chatId: number) {
  const bills = await db.bill.findMany({
    where: { status: "OVERDUE" },
    include: { unit: true },
    orderBy: { dueDate: "asc" },
    take: 20,
  });
  if (bills.length === 0) {
    await tgSend(chatId, "✅ Tiada bil lewat. Semua unit kemas!", { reply_markup: backButton("menu") });
    return;
  }
  let text = `🔴 <b>Bil Lewat</b> — ${bills.length} unit\n\n`;
  bills.forEach((b) => {
    text += `• ${b.unit.block}-${b.unit.floor}-${b.unit.unitNo} (${b.unit.ownerName})\n  ${b.monthYear} — RM ${Number(b.totalAmount).toFixed(2)}\n`;
  });
  await tgSend(chatId, text, { reply_markup: backButton("menu") });
}

async function cmdUnit(query: string, chatId: number) {
  const parts = query.split("-");
  let unit;
  if (parts.length === 3) {
    unit = await db.unit.findFirst({
      where: { block: parts[0], floor: parts[1], unitNo: parts[2] },
      include: { bills: { orderBy: { monthYear: "desc" } }, users: true },
    });
  }
  if (!unit) {
    unit = await db.unit.findFirst({
      where: { ownerName: { contains: query, mode: "insensitive" } },
      include: { bills: { orderBy: { monthYear: "desc" } }, users: true },
    });
  }
  if (!unit) {
    await tgSend(chatId, "❌ Unit tidak dijumpai. Cuba <b>A-1-01</b> atau nama pemilik.");
    return;
  }
  const pending = unit.bills.filter((b) => b.status === "PENDING" || b.status === "OVERDUE");
  let text =
    `🏠 <b>Unit ${unit.block}-${unit.floor}-${unit.unitNo}</b>\n` +
    `👤 ${unit.ownerName}\n` +
    `📧 ${unit.users[0]?.email || "-"}\n` +
    `💰 Yuran: RM ${Number(unit.monthlyFee).toFixed(2)}\n\n` +
    `⚠️ <b>Bil Tertunggak: ${pending.length}</b>\n`;
  pending.slice(0, 5).forEach((b) => {
    text += `• ${b.monthYear}: RM ${Number(b.totalAmount).toFixed(2)} (${b.status})\n`;
  });
  await tgSend(chatId, text, { reply_markup: backButton("menu") });
}

async function cmdConfig(chatId: number) {
  const config = await db.config.findFirst();
  if (!config) {
    await tgSend(chatId, "❌ Tiada tetapan dijumpai.", { reply_markup: backButton("menu") });
    return;
  }

  const text =
    `⚙️ <b>Tetapan Sistem</b>\n\n` +
    `• Hari Tangguh Penalti: ${config.penaltyDays}\n` +
    `• Peratusan Penalti: ${Number(config.penaltyPercent).toFixed(2)}%\n` +
    `• Hari Retry: ${config.retryDays}\n` +
    `• Cubaan Retry Sehari: ${config.retryAttemptsPerDay}\n` +
    `• Yuran Gateway (%): ${Number(config.gatewayFeePercent).toFixed(2)}%\n` +
    `• Yuran Gateway (tetap): ${config.gatewayFeeFixed} sen (RM ${(config.gatewayFeeFixed / 100).toFixed(2)})`;

  await tgSend(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✏️ Hari Penalti", callback_data: "config_edit_penaltyDays" }],
        [{ text: "✏️ % Penalti", callback_data: "config_edit_penaltyPercent" }],
        [{ text: "✏️ Hari Retry", callback_data: "config_edit_retryDays" }],
        [{ text: "✏️ Cubaan Retry", callback_data: "config_edit_retryAttemptsPerDay" }],
        [{ text: "✏️ % Gateway", callback_data: "config_edit_gatewayFeePercent" }],
        [{ text: "← Kembali", callback_data: "menu" }],
      ],
    },
  });
}

async function cmdSetConfig(field: string, value: number, chatId: number) {
  const config = await db.config.findFirst();
  if (!config) {
    await tgSend(chatId, "❌ Tiada tetapan dijumpai.");
    return;
  }

  const validFields = [
    "penaltyDays",
    "penaltyPercent",
    "retryDays",
    "retryAttemptsPerDay",
    "gatewayFeePercent",
  ];
  if (!validFields.includes(field)) {
    await tgSend(chatId, "❌ Medan tidak sah.");
    return;
  }

  const oldValue = (config as any)[field];
  await db.config.update({ where: { id: config.id }, data: { [field]: value } });

  await tgSend(chatId, `✅ Tetapan <b>${field}</b> dikemaskini.\n\nLama: <b>${oldValue}</b>\nBaru: <b>${value}</b>`, {
    reply_markup: backButton("config"),
  });
}

async function cmdListAdmins(chatId: number) {
  const admins = await db.telegramAdmin.findMany({ orderBy: { createdAt: "desc" } });
  if (admins.length === 0) {
    await tgSend(chatId, "👥 Tiada admin Telegram didaftarkan.", { reply_markup: backButton("admin_menu") });
    return;
  }
  let text = "👥 <b>Senarai Admin Telegram</b>\n\n";
  admins.forEach((a) => {
    text += `• ${a.name} (${a.telegramId}) — ${a.isActive ? "✅ Aktif" : "❌ Tidak Aktif"}\n`;
  });
  await tgSend(chatId, text, { reply_markup: backButton("admin_menu") });
}

async function cmdAddAdmin(args: string[], chatId: number) {
  if (args.length < 2) {
    await tgSend(chatId, "❌ Guna: /addadmin <telegramId> <nama>");
    return;
  }
  const telegramId = args[0];
  const name = args.slice(1).join(" ");

  await db.telegramAdmin.upsert({
    where: { telegramId },
    create: { telegramId, name, isActive: true },
    update: { name, isActive: true },
  });

  await tgSend(chatId, `✅ Admin <b>${name}</b> (${telegramId}) ditambah.`);
}

async function cmdRemoveAdmin(telegramId: string, chatId: number) {
  if (!telegramId) {
    await tgSend(chatId, "❌ Guna: /removeadmin <telegramId>");
    return;
  }

  await db.telegramAdmin.updateMany({
    where: { telegramId },
    data: { isActive: false },
  });

  await tgSend(chatId, `✅ Admin ${telegramId} ditamatkan.`);
}

// ── DELETE UNIT ──────────────────────────────────────────────────────
async function cmdDeleteUnit(query: string, chatId: number) {
  const unit = await db.unit.findFirst({
    where: {
      OR: [
        { ownerName: { contains: query, mode: "insensitive" } },
        { ownerIc: query },
        { unitNo: query },
      ],
    },
  });

  if (!unit) {
    await tgSend(chatId, "❌ Unit tidak dijumpai.");
    return;
  }

  await db.unit.delete({ where: { id: unit.id } });
  await tgSend(chatId, `🗑️ Unit ${unit.block}-${unit.floor}-${unit.unitNo} (${unit.ownerName}) telah dipadam.`);
}

// ── PAYMENTS ─────────────────────────────────────────────────────────
async function cmdPayments(chatId: number, monthYear: string, page: number) {
  const limit = 10;
  const where: any = { status: "PAID" };
  if (monthYear) where.monthYear = monthYear;

  const skip = (page - 1) * limit;
  const [payments, total, summary] = await Promise.all([
    db.bill.findMany({
      where,
      skip,
      take: limit,
      orderBy: { paidAt: "desc" },
      select: {
        uuid: true,
        monthYear: true,
        totalAmount: true,
        paidAt: true,
        paymentMethod: true,
        unit: { select: { block: true, floor: true, unitNo: true, ownerName: true } },
      },
    }),
    db.bill.count({ where }),
    db.bill.aggregate({ where, _sum: { totalAmount: true }, _count: { id: true } }),
  ]);

  let text = `💳 <b>Pembayaran</b>${monthYear ? ` — ${monthYear}` : ""}\n`;
  text += `💰 Jumlah: ${summary._count.id} bil (RM ${Number(summary._sum.totalAmount || 0).toFixed(2)})\n\n`;

  payments.forEach((p: any) => {
    const date = p.paidAt
      ? new Date(p.paidAt).toLocaleDateString("ms-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric" })
      : "-";
    text += `• ${p.uuid.slice(0, 7)} — ${p.unit.block}-${p.unit.floor}-${p.unit.unitNo} — RM ${Number(p.totalAmount).toFixed(2)} — ${p.paymentMethod || "?"} — ${date}\n`;
  });

  if (payments.length === 0) text += "Tiada rekod.";

  const totalPages = Math.ceil(total / limit);
  await tgSend(chatId, text, totalPages > 1 ? { reply_markup: paginationKeyboard(page, totalPages, "payments") } : { reply_markup: backButton("menu") });
}

// ── REPORTS ──────────────────────────────────────────────────────────
async function cmdReports(chatId: number, monthYear: string) {
  const [totalExpectedAgg, totalCollectedAgg, pendingAgg, paidAgg, overdueAgg] = await Promise.all([
    db.bill.aggregate({ where: { monthYear }, _sum: { totalAmount: true } }),
    db.bill.aggregate({ where: { monthYear, status: "PAID" }, _sum: { totalAmount: true } }),
    db.bill.count({ where: { monthYear, status: "PENDING" } }),
    db.bill.count({ where: { monthYear, status: "PAID" } }),
    db.bill.count({ where: { monthYear, status: "OVERDUE" } }),
  ]);

  const totalExpected = Number(totalExpectedAgg._sum.totalAmount || 0);
  const totalCollected = Number(totalCollectedAgg._sum.totalAmount || 0);
  const collectionRate = totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(2) : "0.00";

  const bills = await db.bill.findMany({
    where: { monthYear },
    include: { unit: { select: { block: true } } },
  });

  const byBlock: Record<string, { expected: number; collected: number }> = {};
  const byMethod: Record<string, number> = {};

  for (const b of bills) {
    const block = b.unit.block;
    if (!byBlock[block]) byBlock[block] = { expected: 0, collected: 0 };
    byBlock[block].expected += Number(b.totalAmount);
    if (b.status === "PAID") byBlock[block].collected += Number(b.totalAmount);
    if (b.paymentMethod) {
      byMethod[b.paymentMethod] = (byMethod[b.paymentMethod] || 0) + Number(b.totalAmount);
    }
  }

  let text = `📈 <b>Laporan Kutipan — ${monthYear}</b>\n\n`;
  text += `💰 Jangkaan: RM ${totalExpected.toFixed(2)}\n`;
  text += `✅ Dikutip: RM ${totalCollected.toFixed(2)}\n`;
  text += `📊 Kadar Kutipan: ${collectionRate}%\n`;
  text += `🟡 Tertunggak: ${pendingAgg}\n`;
  text += `🔴 Lewat: ${overdueAgg}\n`;
  text += `✅ Lunas: ${paidAgg}\n\n`;

  const blocks = Object.keys(byBlock).sort();
  if (blocks.length > 0) {
    text += `<b>Mengikut Blok:</b>\n`;
    blocks.forEach((blk) => {
      const rate = byBlock[blk].expected > 0 ? ((byBlock[blk].collected / byBlock[blk].expected) * 100).toFixed(1) : "0";
      text += `• ${blk}: RM ${byBlock[blk].collected.toFixed(2)} / RM ${byBlock[blk].expected.toFixed(2)} (${rate}%)\n`;
    });
    text += `\n`;
  }

  const methods = Object.keys(byMethod).sort();
  if (methods.length > 0) {
    text += `<b>Mengikut Kaedah:</b>\n`;
    methods.forEach((m) => {
      text += `• ${m}: RM ${byMethod[m].toFixed(2)}\n`;
    });
  }

  await tgSend(chatId, text, { reply_markup: backButton("menu") });
}

// ── AUDIT ────────────────────────────────────────────────────────────
async function cmdAudit(chatId: number, page: number) {
  const limit = 10;
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({ skip, take: limit, orderBy: { createdAt: "desc" } }),
    db.auditLog.count(),
  ]);

  let text = `📋 <b>Audit Log</b>\n\n`;
  logs.forEach((log: any) => {
    const date = new Date(log.createdAt).toLocaleDateString("ms-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    text += `• [${date}] ${log.action}${log.targetId ? ` — ${log.targetId}` : ""}\n`;
  });

  if (logs.length === 0) text += "Tiada rekod.";

  const totalPages = Math.ceil(total / limit);
  await tgSend(chatId, text, totalPages > 1 ? { reply_markup: paginationKeyboard(page, totalPages, "audit") } : { reply_markup: backButton("menu") });
}

// ── DELETE BILL ──────────────────────────────────────────────────────
async function cmdDeleteBill(query: string, chatId: number) {
  const bill = await db.bill.findFirst({
    where: { OR: [{ id: query }, { uuid: { startsWith: query } }] },
    include: { unit: { select: { block: true, floor: true, unitNo: true } } },
  });

  if (!bill) {
    await tgSend(chatId, "❌ Bil tidak dijumpai.");
    return;
  }

  await db.bill.delete({ where: { id: bill.id } });
  await tgSend(chatId, `🗑️ Bil ${bill.uuid.slice(0, 7)} (${bill.unit.block}-${bill.unit.floor}-${bill.unit.unitNo} — ${bill.monthYear}) telah dipadam.`);
}

// ── MARK PAID ────────────────────────────────────────────────────────
async function cmdMarkPaid(query: string, chatId: number) {
  const bill = await db.bill.findFirst({
    where: { OR: [{ id: query }, { uuid: { startsWith: query } }] },
    include: { unit: { select: { block: true, floor: true, unitNo: true } } },
  });

  if (!bill) {
    await tgSend(chatId, "❌ Bil tidak dijumpai.");
    return;
  }

  if (bill.status === "PAID") {
    await tgSend(chatId, `⚠️ Bil ${bill.uuid.slice(0, 7)} sudah ditandai lunas.`);
    return;
  }

  await db.bill.update({
    where: { id: bill.id },
    data: { status: "PAID", paidAt: new Date(), paymentMethod: "CASH" },
  });

  await tgSend(chatId, `✅ Bil ${bill.uuid.slice(0, 7)} (${bill.unit.block}-${bill.unit.floor}-${bill.unit.unitNo} — ${bill.monthYear}) ditandai lunas (CASH).`);
}

// ── CREATE UNIT (multi-step) ─────────────────────────────────────────
async function handleCreateUnitStep(chatId: number, text: string, state: ChatState) {
  const step = state.step || 0;
  const data = state.data || {};

  const prompts = [
    "Langkah 2/7: Sila masukkan <b>Tingkat</b> (cth: 1):",
    "Langkah 3/7: Sila masukkan <b>Nombor Unit</b> (cth: 01):",
    "Langkah 4/7: Sila masukkan <b>Nama Pemilik</b>:",
    "Langkah 5/7: Sila masukkan <b>No. Kad Pengenalan</b>:",
    "Langkah 6/7: Sila masukkan <b>Yuran Bulanan (RM)</b>:",
    "Langkah 7/7: Sila masukkan <b>Emel</b> untuk akaun penduduk:",
  ];

  const fields = ["block", "floor", "unitNo", "ownerName", "ownerIc", "monthlyFee", "email"];

  if (step > 0 && step <= fields.length) {
    const field = fields[step - 1];
    data[field] = text.trim();
  }

  if (step >= fields.length) {
    chatState.delete(chatId);

    try {
      const existing = await db.unit.findUnique({ where: { ownerIc: data.ownerIc } });
      if (existing) {
        await tgSend(chatId, `❌ No. KP ${data.ownerIc} sudah wujud dalam sistem.`);
        return;
      }

      const unit = await db.unit.create({
        data: {
          block: data.block,
          floor: data.floor,
          unitNo: data.unitNo,
          ownerName: data.ownerName,
          ownerIc: data.ownerIc,
          monthlyFee: Number(data.monthlyFee),
          status: "ACTIVE",
        },
      });

      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash("resident123", 12);
      await db.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: "RESIDENT",
          unitId: unit.id,
        },
      });

      await tgSend(chatId, `✅ Unit ${unit.block}-${unit.floor}-${unit.unitNo} (${unit.ownerName}) berjaya dicipta.\nEmel akaun: ${data.email}\nKata laluan: resident123`);
    } catch (err: any) {
      console.error("Create unit error:", err);
      await tgSend(chatId, "❌ Gagal mencipta unit. Sila cuba lagi.");
    }
    return;
  }

  chatState.set(chatId, { mode: "awaiting_createunit", step: step + 1, data });
  await tgSend(chatId, prompts[step]);
}

// ── HELP ─────────────────────────────────────────────────────────────
async function cmdHelp(chatId: number, admin: boolean) {
  let text = "🏢 <b>Bot Bayu Condo</b>\n\n";

  text += "<b>Penduduk:</b>\n";
  text += "• /login — Log masuk dengan emel + pilihan planet\n";
  text += "• /cek — Semak bil tertunggak\n";
  text += "• /stats — Statistik pembayaran\n";
  text += "• /history — Sejarah pembayaran\n";
  text += "• /contact — Hubungi pentadbiran\n";
  text += "• /logout — Log keluar\n";
  text += "• /menu — Papar menu utama\n\n";

  if (admin) {
    text += "<b>Admin:</b>\n";
    text += "• /summary — Ringkasan kutipan\n";
    text += "• /bills <bulan> — Bil mengikut bulan\n";
    text += "• /payments <bulan> — Senarai pembayaran\n";
    text += "• /reports <bulan> — Laporan kutipan\n";
    text += "• /audit — Log audit\n";
    text += "• /unit <unit> — Detail unit (A-1-01)\n";
    text += "• /overdue — Senarai bil lewat\n";
    text += "• /config — Tetapan sistem\n";
    text += "• /createunit — Cipta unit baharu\n";
    text += "• /deleteunit <unit> — Padam unit\n";
    text += "• /deletebill <id> — Padam bil\n";
    text += "• /markpaid <id> — Tandai lunas (CASH)\n";
    text += "• /listadmins — Senarai admin\n";
    text += "• /addadmin <id> <nama>\n";
    text += "• /removeadmin <id>\n\n";
    text += "<b>Pintasan Tetapan:</b>\n";
    text += "• /setpenaltydays <hari>\n";
    text += "• /setpenaltypercent <%>\n";
    text += "• /setretrydays <hari>\n";
    text += "• /setretryattempts <bilangan>\n";
    text += "• /setgatewayfee <%>\n";
  }

  text += "\n💡 Guna butang di bawah untuk navigasi pantas.";

  await tgSend(chatId, text, {
    reply_markup: admin
      ? adminMenuKeyboard()
      : { inline_keyboard: [[{ text: "📋 Menu Utama", callback_data: "menu" }]] },
  });
}

// ── Command registration ─────────────────────────────────────────────
export async function registerTelegramCommands() {
  if (!token()) {
    console.warn("TELEGRAM_BOT_TOKEN not set — skipping command registration");
    return;
  }

  const commands = [
    { command: "start", description: "Mula / Papar menu" },
    { command: "login", description: "Log masuk dengan emel + OTP" },
    { command: "cek", description: "Semak bil tertunggak" },
    { command: "menu", description: "Papar menu utama" },
    { command: "help", description: "Bantuan" },
    { command: "summary", description: "[Admin] Ringkasan sistem" },
    { command: "bills", description: "[Admin] Bil mengikut bulan" },
    { command: "unit", description: "[Admin] Cari unit" },
    { command: "overdue", description: "[Admin] Bil lewat" },
    { command: "config", description: "[Admin] Tetapan sistem" },
    { command: "listadmins", description: "[Admin] Senarai admin" },
  ];

  const res = await fetch(`https://api.telegram.org/bot${token()}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });

  if (!res.ok) {
    console.error("Failed to register Telegram commands:", await res.text());
  } else {
    console.log("Telegram commands registered successfully");
  }
}

// ── Proactive notifications ──────────────────────────────────────────
export async function notifyAdmins(text: string) {
  const admins = (process.env.TELEGRAM_ADMIN_IDS || "")
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter(Boolean);
  for (const id of admins) {
    await tgSend(id, text);
  }
}

export async function notifyResident(email: string, text: string) {
  const sessions = await db.telegramSession.findMany({ where: { email } });
  for (const sess of sessions) {
    await tgSend(Number(sess.chatId), text);
  }
}
