// AI intent classification via Ollama Cloud
// Routes natural-language messages to existing Telegram bot commands

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "https://ollama.com";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemini-3-flash-preview:cloud";

interface ClassifyContext {
  isAdmin: boolean;
  hasSession: boolean;
  email?: string;
}

interface IntentResult {
  command: string;
  target?: string;
  confidence: number;
}

function buildSystemPrompt(ctx: ClassifyContext): string {
  const availableCommands = [
    { cmd: "cek", desc: "Check user's pending bills. No parameters needed if user is logged in.", admin: false },
    { cmd: "summary", desc: "Admin-only. Show collection overview (paid/pending/overdue counts, total collected).", admin: true },
    { cmd: "unit", desc: "Admin-only. Search unit by code (e.g. A-1-01) or owner name.", admin: true },
    { cmd: "overdue", desc: "Admin-only. List overdue bills.", admin: true },
    { cmd: "bills", desc: "Admin-only. List bills for a month (YYYY-MM).", admin: true },
    { cmd: "config", desc: "Admin-only. View system settings.", admin: true },
    { cmd: "pay", desc: "Show payment menu for pending bills. Resident only.", admin: false },
    { cmd: "history", desc: "Show payment history. Resident only.", admin: false },
    { cmd: "help", desc: "Show help text with available commands.", admin: false },
    { cmd: "menu", desc: "Show main menu.", admin: false },
    { cmd: "login", desc: "Start login flow.", admin: false },
    { cmd: "logout", desc: "Log out.", admin: false },
  ];

  const visible = availableCommands.filter(c => !c.admin || ctx.isAdmin);

  return `You are an intent classifier for a Malaysian condominium maintenance billing Telegram bot.
Your job is to map the user's natural-language message to exactly one command from the list below.

Available commands (only show commands the user is allowed to use):
${visible.map(c => `- ${c.cmd}: ${c.desc}`).join("\n")}

Rules:
- If the user is NOT logged in and the intent requires login, return command "login".
- If the user asks something completely unrelated to the bot's functions, return command "unknown" with low confidence.
- Extract any relevant parameter (unit code, month, name) into the "target" field.
- Month format is always YYYY-MM.
- Return ONLY valid JSON. No markdown, no explanation.

User context:
- isAdmin: ${ctx.isAdmin}
- isLoggedIn: ${ctx.hasSession}
- email: ${ctx.email || "(none)"}

Return strictly JSON in this shape:
{"command":"<cmd>","target":"<param or empty>","confidence":0.0-1.0}`;
}

export async function classifyIntent(
  text: string,
  ctx: ClassifyContext
): Promise<IntentResult | null> {
  if (!OLLAMA_API_KEY) {
    console.warn("[intent] OLLAMA_API_KEY not set, skipping AI classification");
    return null;
  }

  const systemPrompt = buildSystemPrompt(ctx);
  const userPrompt = `User message: "${text}"`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        format: "json",
        options: { temperature: 0.1 },
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[intent] Ollama API error:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    const rawResponse: string = data.message?.content || data.response || "";

    let parsed: IntentResult | null = null;
    try {
      parsed = JSON.parse(rawResponse.trim()) as IntentResult;
    } catch {
      // Sometimes models wrap JSON in markdown fences — try to extract it
      const fenced = rawResponse.match(/```json\s*([\s\S]*?)```/);
      if (fenced) {
        parsed = JSON.parse(fenced[1].trim()) as IntentResult;
      }
    }

    if (!parsed || typeof parsed.confidence !== "number") {
      console.warn("[intent] Invalid response shape:", rawResponse);
      return null;
    }

    if (parsed.confidence < 0.7) {
      console.log("[intent] Low confidence:", parsed.confidence, "→ fallback");
      return null;
    }

    console.log("[intent] Classified:", text, "→", parsed.command, "(confidence:", parsed.confidence + ")");
    return parsed;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.warn("[intent] Ollama request timed out");
    } else {
      console.error("[intent] Error:", err);
    }
    return null;
  }
}
