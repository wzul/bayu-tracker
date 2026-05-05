import { db } from "./db";

const token = () => process.env.TELEGRAM_BOT_TOKEN;

export async function tgSend(chatId: number, text: string, opts?: { parse_mode?: string }) {
  if (!token()) { console.warn("TELEGRAM_BOT_TOKEN not set"); return null; }
  return fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...opts }),
  });
}

function isAdmin(id: number): boolean {
  const ids = (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map((s) => parseInt(s.trim())).filter(Boolean);
  return ids.includes(id);
}

// PUBLIC: Cek bil
async function cmdCek(phoneOrEmail: string, chatId: number) {
  const unit = await db.unit.findFirst({ where: { OR: [{ email: phoneOrEmail }, { phone: phoneOrEmail }] }, include: { bills: { orderBy: { dueDate: "desc" } } } });
  if (!unit) { await tgSend(chatId, "❌ Unit tidak dijumpai."); return; }
  const pending = unit.bills.filter((b) => b.status === "PENDING" || b.status === "OVERDUE");
  const totalPending = pending.reduce((s, b) => s + Number(b.totalAmount), 0);
  let text = "<b> Unit " + unit.block + "-" + unit.floor + "-" + unit.unitNo + "</b>\n<b>" + unit.ownerName + "</b>\n\n<b>Bil Tertunggak: " + pending.length + "</b>\nJumlah: RM " + totalPending.toFixed(2) + "\n\n";
  pending.slice(0, 5).forEach((b) => { text += "• " + b.monthYear + " — RM " + Number(b.totalAmount).toFixed(2) + " — " + b.status + "\n"; });
  if (pending.length > 5) text += "...dan " + (pending.length - 5) + " lagi\n";
  await tgSend(chatId, text);
}

// ADMIN: Summary
async function cmdSummary(chatId: number) {
  const [pendingCount, paidCount, overdueCount, totalCollected] = await Promise.all([
    db.bill.count({ where: { status: "PENDING" } }),
    db.bill.count({ where: { status: "PAID" } }),
    db.bill.count({ where: { status: "OVERDUE" } }),
    db.bill.aggregate({ where: { status: "PAID" }, _sum: { totalAmount: true } }),
  ]);
  const paidToday = await db.bill.count({ where: { status: "PAID", paidAt: { gte: new Date(Date.now() - 86400000) } } });
  const text = "<b>Ringkasan Sistem Bayu</b>\n\n• Lunas: " + paidCount + "  |  Tertunggak: " + pendingCount + "  |  Lewat: " + overdueCount + "\n• Jumlah Kutipan: RM " + Number(totalCollected._sum.totalAmount || 0).toFixed(2) + "\n• Bayar Hari Ini: " + paidToday;
  await tgSend(chatId, text);
}

// ADMIN: Bills
async function cmdBills(month: string, chatId: number) {
  const bills = await db.bill.findMany({ where: { monthYear: month }, include: { unit: true }, orderBy: { status: "asc" } });
  if (bills.length === 0) { await tgSend(chatId, "<b>Bil " + month + "</b>\nTiada rekod bil."); return; }
  const total = bills.reduce((s, b) => s + Number(b.totalAmount), 0);
  let text = "<b>Bil " + month + "</b>\nJumlah: RM " + total.toFixed(2) + "\n\n";
  bills.slice(0, 15).forEach((b) => { text += "• " + b.unit.block + "-" + b.unit.floor + "-" + b.unit.unitNo + ": RM " + Number(b.totalAmount).toFixed(2) + " (" + b.status + ")\n"; });
  if (bills.length > 15) text += "\n...dan " + (bills.length - 15) + " lagi\n";
  await tgSend(chatId, text);
}

// ADMIN: Overdue
async function cmdOverdue(chatId: number) {
  const bills = await db.bill.findMany({ where: { status: "OVERDUE" }, include: { unit: true }, orderBy: { dueDate: "asc" }, take: 20 });
  if (bills.length === 0) { await tgSend(chatId, "<b>Bil Lewat</b>\n\nTiada bil lewat. Semua unit kemas!"); return; }
  let text = "<b>Bil Lewat</b>\n" + bills.length + " unit:\n\n";
  bills.forEach((b) => { text += "• " + b.unit.block + "-" + b.unit.floor + "-" + b.unit.unitNo + " (" + b.unit.ownerName + ")\n  " + b.monthYear + " — RM " + Number(b.totalAmount).toFixed(2) + "\n"; });
  await tgSend(chatId, text);
}

// ADMIN: Unit detail
async function cmdUnit(query: string, chatId: number) {
  const parts = query.split("-");
  let unit;
  if (parts.length === 3) {
    unit = await db.unit.findFirst({ where: { block: parts[0], floor: parts[1], unitNo: parts[2] }, include: { bills: { orderBy: { monthYear: "desc" } } } });
  }
  if (!unit) unit = await db.unit.findFirst({ where: { ownerName: { contains: query, mode: "insensitive" } }, include: { bills: { orderBy: { monthYear: "desc" } } } });
  if (!unit) { await tgSend(chatId, "❌ Unit tidak dijumpai. Cuba <b>A-1-01</b> atau nama pemilik."); return; }
  const pending = unit.bills.filter((b) => b.status === "PENDING" || b.status === "OVERDUE");
  let text = "<b>Unit " + unit.block + "-" + unit.floor + "-" + unit.unitNo + "</b>\n" + unit.ownerName + "\nEmail: " + unit.email + "\nYuran: RM " + Number(unit.monthlyFee).toFixed(2) + "\n\n<b>Bil Tertunggak: " + pending.length + "</b>\n";
  pending.slice(0, 5).forEach((b) => { text += "• " + b.monthYear + ": RM " + Number(b.totalAmount).toFixed(2) + " (" + b.status + ")\n"; });
  await tgSend(chatId, text);
}

// HELP
async function cmdHelp(chatId: number, admin: boolean) {
  let text = "<b>Bot Bayu Condo</b>\n\n<b>Penduduk:</b>\n/cek <email/telefon> — Semak bil anda\n\n";
  if (admin) { text += "<b>Admin:</b>\n/summary — Ringkasan kutipan\n/bills <bulan> — Bil mengikut bulan\n/unit <unit> — Detail unit (A-1-01)\n/overdue — Senarai bil lewat\n"; }
  await tgSend(chatId, text);
}

// Main handler
export async function handleTelegramUpdate(update: any) {
  const msg = update.message; if (!msg?.text) return;
  const text = msg.text.trim(); const chatId = msg.chat.id; const userId = msg.from.id; const admin = isAdmin(userId);
  const parts = text.split(/\s+/); const cmd = parts[0].toLowerCase();
  try {
    switch (cmd) {
      case "/start": case "/help": await cmdHelp(chatId, admin); break;
      case "/cek":
        if (!parts[1]) await tgSend(chatId, "❌ Guna: /cek <email> atau /cek <nombor telefon>");
        else await cmdCek(parts[1], chatId); break;
      case "/summary": if (!admin) return await tgSend(chatId, "❌ Akses ditolak."); await cmdSummary(chatId); break;
      case "/bills": if (!admin) return await tgSend(chatId, "❌ Akses ditolak."); await cmdBills(parts[1] || (new Date().getFullYear() + "-" + String(new Date().getMonth()+1).padStart(2, "0")), chatId); break;
      case "/unit": if (!admin) return await tgSend(chatId, "❌ Akses ditolak."); if (!parts[1]) await tgSend(chatId, "❌ Guna: /unit A-1-01"); else await cmdUnit(parts[1], chatId); break;
      case "/overdue": if (!admin) return await tgSend(chatId, "❌ Akses ditolak."); await cmdOverdue(chatId); break;
      default: break;
    }
  } catch (err) { console.error("Telegram command error:", err); await tgSend(chatId, "❌ Ralat sistem. Sila cuba sebentar lagi."); }
}
