import { registerTelegramCommands } from "./telegram";

let initialized = false;

export async function initServer() {
  if (initialized) return;
  initialized = true;

  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      await registerTelegramCommands();
    } catch (err) {
      console.error("Failed to register Telegram commands:", err);
    }
  }
}
