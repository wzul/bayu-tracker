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

const userSessions = new Map<number, UserSession>();

// Multi-step flow state (e.g. awaiting unit search input)
interface ChatState {
  mode: "awaiting_unit_query" | "awaiting_config_value";
  field?: string;
  messageId?: number;
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
function isAdmin(chatId: number): boolean {
  const session = userSessions.get(chatId);
  return session?.role === "ADMIN";
}

// ── Auth helpers ─────────────────────────────────────────────────────
function requireAuth(chatId: number): UserSession | null {
  const session = userSessions.get(chatId);
  if (!session) return null;
  // Auto-logout after 24 hours
  if (Date.now() - session.authenticatedAt.getTime() > 24 * 60 * 60 * 1000) {
    userSessions.delete(chatId);
    return null;
  }
  return session;
}

// ── Inline keyboards ─────────────────────────────────────────────────
function residentMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📋 Semak Bil", callback_data: "cek" }],
      [{ text: "💰 Bayar Bil", callback_data: "pay_menu" }],
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
        { text: "🏠 Cari Unit", callback_data: "unit_search" },
      ],
      [
        { text: "🧾 Bil Bulanan", callback_data: "bills_menu" },
        { text: "⚙️ Tetapan", callback_data: "config" },
      ],
      [
        { text: "📈 Laporan", callback_data: "reports_menu" },
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
    const session = requireAuth(chatId);
    if (!session && !isAdmin(chatId)) {
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

    userSessions.set(chatId, {
      userId: user.id,
      email: user.email,
      unitId: user.unitId,
      role: user.role,
      authenticatedAt: new Date(),
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
    await showMainMenu(chatId, isAdmin(chatId));
    return;
  }
  if (data === "help") {
    await cmdHelp(chatId, isAdmin(chatId));
    return;
  }
  if (data === "login") {
    await startOtpFlow(chatId);
    return;
  }
  if (data === "logout") {
    userSessions.delete(chatId);
    await tgEditMessage(chatId, messageId, "👋 Anda telah log keluar. Tekan /start untuk mula.");
    return;
  }
  if (data === "cek") {
    const session = requireAuth(chatId);
    if (session) await cmdCek(session.email, chatId);
    else await tgSend(chatId, "❌ Sesi tamat. Sila log masuk semula.", { reply_markup: backButton("menu") });
    return;
  }
  if (data === "pay_menu") {
    const session = requireAuth(chatId);
    if (session) await showPayMenu(chatId, session);
    else await tgSend(chatId, "❌ Sesi tamat. Sila log masuk semula.", { reply_markup: backButton("menu") });
    return;
  }
  if (data === "history") {
    const session = requireAuth(chatId);
    if (session) await cmdHistory(chatId, session);
    else await tgSend(chatId, "❌ Sesi tamat. Sila log masuk semula.", { reply_markup: backButton("menu") });
    return;
  }
  if (data === "summary") {
    if (!isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await cmdSummary(chatId);
    return;
  }
  if (data === "unit_search") {
    if (!isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    chatState.set(chatId, { mode: "awaiting_unit_query" });
    await tgSend(chatId, "🔍 Hantar nama pemilik atau unit (cth: <b>A-1-01</b>):");
    return;
  }
  if (data === "bills_menu") {
    if (!isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await showBillsMenu(chatId);
    return;
  }
  if (data === "config") {
    if (!isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await cmdConfig(chatId);
    return;
  }
  if (data === "reports_menu") {
    if (!isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await showReportsMenu(chatId);
    return;
  }
  if (data === "admin_menu") {
    if (!isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await showAdminManagementMenu(chatId);
    return;
  }
  if (data === "overdue") {
    if (!isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await cmdOverdue(chatId);
    return;
  }
  if (data === "listadmins") {
    if (!isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.", { reply_markup: backButton("menu") });
      return;
    }
    await cmdListAdmins(chatId);
    return;
  }
  if (data.startsWith("pay_")) {
    const billId = data.replace("pay_", "");
    const session = requireAuth(chatId);
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
    if (!isAdmin(chatId)) {
      await tgSend(chatId, "❌ Akses ditolak.");
      return;
    }
    const page = parseInt(data.replace("bills_page_", ""), 10);
    const month = new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0");
    await cmdBillsPaged(chatId, month, page);
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
    chatState.delete(chatId);
    if (state.mode === "awaiting_unit_query" && isAdmin(chatId)) {
      await cmdUnit(text, chatId);
      return;
    }
    if (state.mode === "awaiting_config_value" && isAdmin(chatId) && state.field) {
      await cmdSetConfig(state.field, Number(text), chatId);
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
    const session = requireAuth(chatId);
    const intent = await classifyIntent(text, {
      isAdmin: isAdmin(chatId),
      hasSession: !!session,
      email: session?.email,
    });

    if (intent) {
      switch (intent.command) {
        case "cek":
          await cmdCek(session?.email || intent.target || "", chatId);
          return;
        case "summary":
          if (isAdmin(chatId)) {
            await cmdSummary(chatId);
            return;
          }
          break;
        case "unit":
          if (isAdmin(chatId) && intent.target) {
            await cmdUnit(intent.target, chatId);
            return;
          }
          break;
        case "overdue":
          if (isAdmin(chatId)) {
            await cmdOverdue(chatId);
            return;
          }
          break;
        case "bills":
          if (isAdmin(chatId)) {
            const month =
              intent.target ||
              new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0");
            await cmdBillsPaged(chatId, month, 1);
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
        case "help":
          await cmdHelp(chatId, isAdmin(chatId));
          return;
        case "login":
          await startOtpFlow(chatId);
          return;
        case "menu":
          await showMainMenu(chatId, isAdmin(chatId));
          return;
      }
    }
    // No high-confidence intent: fall through to menu
    await showMainMenu(chatId, isAdmin(chatId));
    return;
  }

  // Commands
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case "/start":
    case "/menu":
      await showMainMenu(chatId, isAdmin(chatId));
      return;
    case "/help":
      await cmdHelp(chatId, isAdmin(chatId));
      return;
    case "/login":
      await startOtpFlow(chatId);
      return;
    case "/cek": {
      const session = requireAuth(chatId);
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
      if (!isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      await cmdSummary(chatId);
      return;
    case "/bills": {
      if (!isAdmin(chatId)) {
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
      if (!isAdmin(chatId)) {
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
      if (!isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      await cmdOverdue(chatId);
      return;
    }
    case "/config": {
      if (!isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      await cmdConfig(chatId);
      return;
    }
    case "/listadmins": {
      if (!isAdmin(chatId)) {
        await tgSend(chatId, "❌ Akses ditolak.");
        return;
      }
      await cmdListAdmins(chatId);
      return;
    }
    case "/addadmin": {
      if (!isAdmin(chatId)) {
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
      if (!isAdmin(chatId)) {
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
  }

  // Admin config set commands
  if (cmd.startsWith("/set") && isAdmin(chatId)) {
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
  if (isAdmin(chatId) && text.includes("@")) {
    await cmdUnit(text, chatId);
    return;
  }

  // Show menu for authenticated users, auth prompt for guests
  const session = requireAuth(chatId);
  if (session || isAdmin(chatId)) {
    await showMainMenu(chatId, isAdmin(chatId));
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
      await showMainMenu(chatId, isAdmin(chatId));
      return;
    }
    if (text.toLowerCase().startsWith("/help")) {
      clearTelegramOtp(chatId);
      await cmdHelp(chatId, isAdmin(chatId));
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
    text += `• ${b.monthYear} — RM ${Number(b.totalAmount).toFixed(2)}\n`;
    keyboard.push([
      {
        text: `💳 Bayar ${b.monthYear} (RM ${Number(b.totalAmount).toFixed(2)})`,
        callback_data: `pay_${b.id}`,
      },
    ]);
  });

  if (bills.length > 10) text += `\n...dan ${bills.length - 10} lagi\n`;

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
      text += `• ${b.monthYear} — RM ${Number(b.totalAmount).toFixed(2)} — ${status}\n`;
    });
    if (pending.length > 5) text += `\n...dan ${pending.length - 5} lagi\n`;
  } else {
    text += "✅ Tiada bil tertunggak!\n";
  }

  text += `\n📜 Bil Lunas: ${paid.length}`;

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

  let text = "📜 <b>Sejarah Pembayaran</b>\n\n";
  bills.forEach((b) => {
    const date = b.paidAt
      ? new Date(b.paidAt).toLocaleDateString("ms-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric" })
      : "-";
    text += `• ${b.monthYear} — RM ${Number(b.totalAmount).toFixed(2)} — ${date}\n`;
  });

  await tgSend(chatId, text, { reply_markup: backButton("menu") });
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
      success_redirect: `${appUrl}/dashboard/payment/success?bill=${bill.id}`,
      failure_redirect: `${appUrl}/dashboard/payment/failed?bill=${bill.id}`,
      cancel_redirect: `${appUrl}/dashboard/payment/cancelled?bill=${bill.id}`,
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

// ── HELP ─────────────────────────────────────────────────────────────
async function cmdHelp(chatId: number, admin: boolean) {
  let text = "🏢 <b>Bot Bayu Condo</b>\n\n";

  text += "<b>Penduduk:</b>\n";
  text += "• /login — Log masuk dengan emel + pilihan planet\n";
  text += "• /cek — Semak bil tertunggak\n";
  text += "• /menu — Papar menu utama\n\n";

  if (admin) {
    text += "<b>Admin:</b>\n";
    text += "• /summary — Ringkasan kutipan\n";
    text += "• /bills <bulan> — Bil mengikut bulan\n";
    text += "• /unit <unit> — Detail unit (A-1-01)\n";
    text += "• /overdue — Senarai bil lewat\n";
    text += "• /config — Tetapan sistem\n";
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
  // Find any active session for this user
  userSessions.forEach(async (session, chatId) => {
    if (session.email === email) {
      await tgSend(chatId, text);
    }
  });
}
