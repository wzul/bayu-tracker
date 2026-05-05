# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sistem Maintenance Kondo Bayu** — a Next.js app for managing condominium maintenance fee billing and payments for Malaysian residents. UI language is Malay. Admins create bills and manage units; residents log in to view and pay their bills.

## Common Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (runs on `localhost:3000`) |
| Production build | `npm run build` |
| Start production | `npm start` |
| Lint | `npm run lint` |
| Prisma generate | `npx prisma generate` |
| Prisma migrate dev | `npx prisma migrate dev` |
| Seed database | `npx prisma db seed` |
| Docker compose up | `docker compose up --build` |

There is no test runner configured in this project.

## Architecture

### Stack
- **Next.js 16** with App Router
- **Prisma 5.22** + **PostgreSQL**
- **Tailwind CSS 3**
- **Valkey/Redis** (for BullMQ queues — not heavily used yet)
- **RustFS/MinIO** (S3-compatible object storage for backups)
- Deployed via Docker multi-stage build with `output: 'standalone'`

### Authentication
This project uses **custom cookie-based session auth**, not NextAuth. A session token is stored in an HTTP-only `session_token` cookie.
- `src/lib/session.ts` — creates, validates, and deletes sessions via the Prisma `Session` model. Sessions expire after 2 hours (30 days with "remember me"). Expiry refreshes when within the last 24h of the session.
- `src/lib/auth.ts` — `getUser()` reads the cookie and returns the cached user (with their `unit`). `requireAdmin()` throws `"UNAUTHORIZED"` if the user is not an `ADMIN`.
- `src/app/api/auth/login/route.ts` — verifies bcrypt password and sets the cookie.
- `src/app/api/auth/logout/route.ts` — deletes the cookie and session record.
- Admin pages use `requireAdmin()` in their page component or layout. Resident pages use `getUser()` in API routes.

### Database & Models
All Prisma models are in `prisma/schema.prisma`. Key entities:
- **Unit** — condo unit (block/floor/unitNo, owner, monthly fee). One unit can have multiple `User`s and `Bill`s.
- **User** — `role` is `ADMIN` or `RESIDENT`. A resident is linked to a `Unit` via `unitId`.
- **Bill** — monthly maintenance bill. `totalAmount` is computed from `baseAmount + additionalFee + adjustment + penaltyAmount - discount`. Status enum: `PENDING`, `PAID`, `OVERDUE`, `RETRY_EXHAUSTED`, `TRANSFERRED`, `CANCELLED`.
- **Session** — token-based sessions linked to `User`.
- **Config** — singleton table with penalty rules, retry settings, and gateway fee percent.
- **ChipSettlement** — records CHIP payment gateway settlement webhooks.
- **Subscription** — for CHIP recurring subscriptions (not yet actively used).

Money is stored as Prisma `Decimal` (`@db.Decimal(10, 2)`). Do not use plain JS numbers for monetary calculations.

### Date Handling
All dates are stored in the database as **UTC**. All user-facing dates are displayed in **Asia/Kuala_Lumpur (MYT)** using helpers in `src/lib/date.ts` (`fmtMYT`, `fmtMYTFull`, `fmtMYTShort`). Do not use `toLocaleDateString` directly without the `timeZone` option.

### Payment Flow (CHIP)
The app integrates with the **CHIP** Malaysian payment gateway.
- `src/app/api/dashboard/pay/route.ts` — single bill payment. Creates a CHIP `purchase`, stores `chipBillId`, and redirects the user to CHIP's checkout URL.
- `src/app/api/dashboard/pay-bulk/route.ts` — bulk payment. Creates one CHIP purchase with multiple products, then stores the same `chipPurchaseId` on all selected bills.
- `src/app/api/webhooks/chip/route.ts` — CHIP webhook. On `purchase.paid`, updates all bills with matching `chipBillId` to `PAID`.
- CHIP requires `CHIP_SECRET_KEY`, `CHIP_BRAND_ID`, and `CHIP_API_URL` env vars.

### Telegram Bot
A Telegram bot handles resident queries and admin commands.
- `src/lib/telegram.ts` — `handleTelegramUpdate()` dispatches commands. Residents can `/cek <email/phone>` to check pending bills. Admins (IDs in `TELEGRAM_ADMIN_IDS`) can run `/summary`, `/bills <month>`, `/unit <block-floor-unit>`, `/overdue`.
- Webhook endpoint: `src/app/api/webhooks/telegram/route.ts`.

### Admin Panel
The admin panel lives under `src/app/admin/` with a shared layout (`layout.tsx`) that renders a sidebar (`src/components/admin/Sidebar.tsx`) and guards with `requireAdmin()`. Admin API routes are under `src/app/api/admin/`.

### Docker & Deployment
- `docker-compose.yml` defines `postgres`, `valkey`, `rustfs` (MinIO), `app`, and `backup` services. The app runs migrations (`prisma migrate deploy`) on startup before starting the server.
- `Dockerfile` is a multi-stage build that generates Prisma client, builds standalone output, and copies only the necessary files to the runner stage.
- `docker-compose.dokploy.yml` is a production variant for Dokploy.

### Environment Variables
See `.env.example` for the full list. Required for local dev:
- `DATABASE_URL`
- `REDIS_URL`
- `CHIP_API_KEY`, `CHIP_BRAND_ID`, `CHIP_API_URL`
- `SMTP_*` (for email)
- `RUSTFS_*` (for S3 storage)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
- `NEXTAUTH_SECRET` (used for session crypto, despite not using NextAuth)
- `CRON_SECRET` (for cron API routes)
- `RATE_LIMIT_*` (login and webhook rate limits)

## Important Code Patterns

- Use `db` from `src/lib/db.ts` (singleton PrismaClient) for all database access.
- Validate API input with **Zod**. Return `400` for Zod errors, `401` for `UNAUTHORIZED`/`UNAUTHENTICATED`, `500` for unexpected errors.
- Use React `cache()` in `getUser()` so the same session is not fetched multiple times during a single request.
- When creating a bill, always compute `totalAmount` server-side; do not trust the client total.
- For CHIP callbacks, the same `chipPurchaseId` may be shared across multiple bills in a bulk payment. Use `updateMany` with `chipBillId`.
