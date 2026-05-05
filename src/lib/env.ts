import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  CHIP_API_KEY: z.string().optional(),
  CHIP_BRAND_ID: z.string().optional(),
  CHIP_SECRET_KEY: z.string().optional(),
  CHIP_API_URL: z.string().default("https://gate.chip-in.asia/api/v1/"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default("587"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("noreply@bayu.local"),
  RUSTFS_ENDPOINT: z.string().optional(),
  RUSTFS_ACCESS_KEY: z.string().optional(),
  RUSTFS_SECRET_KEY: z.string().optional(),
  RUSTFS_BUCKET: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_ADMIN_IDS: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  RATE_LIMIT_LOGIN_MAX: z.string().default("5"),
  RATE_LIMIT_LOGIN_WINDOW: z.string().default("900"),
  RATE_LIMIT_WEBHOOK_MAX: z.string().default("100"),
  RATE_LIMIT_WEBHOOK_WINDOW: z.string().default("60"),
  ENABLE_EINVOICE: z.string().default("false"),
  LHDN_CLIENT_ID: z.string().optional(),
  LHDN_CLIENT_SECRET: z.string().optional(),
  LHDN_API_URL: z.string().optional(),
  NODE_ENV: z.string().default("development"),
  PORT: z.string().default("3000"),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
});

export function validateEnv() {
  try {
    envSchema.parse(process.env);
    console.log("✅ Environment variables validated");
  } catch (err: any) {
    console.error("❌ Invalid environment variables:", err.errors);
    throw new Error("Environment validation failed");
  }
}
