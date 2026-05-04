# Condo Maintenance System — Implementation Plan

> **For Hermes:** Use `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** Build a full-stack monthly maintenance billing system for a 500-unit low-cost condo, with dual payment support (CHIP card subscriptions + CHIP FPX one-time), admin Telegram bot, and automated billing.

**Architecture:** Monolithic Next.js 14 app (App Router) with Prisma ORM, PostgreSQL, Valkey (Redis), RustFS object storage, and Docker Compose. Background jobs via BullMQ + Valkey. Telegram bot as a separate lightweight Express server (or Next.js API routes) for admin queries.

**Tech Stack:** Next.js 14 · TypeScript · Prisma · PostgreSQL 16 · Valkey (Redis fork) · BullMQ · NextAuth.js v5 (Auth.js) · CHIP Collect API · Nodemailer · RustFS (S3-compatible) · Telegram Bot API · Docker · Dokploy

---

## Phase 0: Project Bootstrap & Infrastructure

### Task 0.1: Initialize Next.js Project with TypeScript

**Objective:** Scaffold the project with all required dependencies.

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `.env.example`

**Steps:**
1. Run `npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --no-turbopack`
2. Install deps: `npm install prisma @prisma/client @auth/prisma-adapter next-auth@beta bullmq nodemailer react-hook-form zod bcryptjs date-fns uuid @aws-sdk/client-s3`
3. Install dev deps: `npm install -D @types/bcryptjs @types/nodemailer @types/uuid prisma`
4. Init Prisma: `npx prisma init`
5. Add `CHIP_API_URL=https://sandbox-api.chip-in.asia` to `.env.example` (sandbox only)
6. Create `.env.example` with all required keys (no real values)
7. Commit

---

### Task 0.2: Docker Compose Stack

**Objective:** Define PostgreSQL, Valkey, and App services.

**Files:**
- Create: `docker-compose.yml`
- Create: `Dockerfile`
- Create: `.dockerignore`

**Steps:**
1. Write `docker-compose.yml`:
   - `postgres:16-alpine` with volume `postgres_data`
   - `valkey/valkey:latest` with volume `valkey_data`
   - `app` built from Dockerfile, depends on postgres + valkey
   - `rustfs` or mount S3-compatible (if self-hosted RustFS, add service; else configure endpoint in env)
2. Write multi-stage `Dockerfile` (deps → build → runner)
3. Add healthcheck for postgres in compose
4. Commit

---

### Task 0.3: Prisma Schema

**Objective:** Define all database models.

**Files:**
- Create: `prisma/schema.prisma`

**Schema overview:**
```prisma
model Unit {
  id           String   @id @default(cuid())
  block        String
  floor        String
  unitNo       String
  ownerName    String
  ownerIc      String   @unique
  email        String
  phone        String?
  monthlyFee   Decimal  @db.Decimal(10, 2)
  status       UnitStatus @default(ACTIVE)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  bills        Bill[]
  users        User[]
  subscriptions Subscription[]
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  unitId        String?
  unit          Unit?     @relation(fields: [unitId], references: [id])
  role          UserRole  @default(RESIDENT)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token        String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())
}

model Bill {
  id              String   @id @default(cuid())
  unitId          String
  unit            Unit     @relation(fields: [unitId], references: [id])
  monthYear       String   // "2026-05"
  baseAmount      Decimal  @db.Decimal(10, 2)
  additionalFee   Decimal  @db.Decimal(10, 2) @default(0)
  discount        Decimal  @db.Decimal(10, 2) @default(0)
  adjustment      Decimal  @db.Decimal(10, 2) @default(0)
  penaltyAmount   Decimal  @db.Decimal(10, 2) @default(0)
  totalAmount     Decimal  @db.Decimal(10, 2)
  dueDate         DateTime
  status          BillStatus @default(PENDING)
  receiptNo       String?  @unique
  paidAt          DateTime?
  chipBillId      String?
  chipTransactionId String?
  paymentMethod   PaymentMethod?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Subscription {
  id              String   @id @default(cuid())
  unitId          String   @unique
  unit            Unit     @relation(fields: [unitId], references: [id])
  chipSubscriptionId String @unique
  status          SubscriptionStatus @default(ACTIVE)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```prisma
model Config {
  id                  String @id @default(cuid())
  penaltyDays         Int    @default(20)
  penaltyPercent      Decimal @db.Decimal(5, 2) @default(10.00)
  retryDays           Int    @default(3)
  retryAttemptsPerDay Int    @default(2)
  gatewayFeePercent   Decimal @db.Decimal(5, 2) @default(0)
  updatedAt           DateTime @updatedAt
}

model UnitTransfer {
  id            String   @id @default(cuid())
  unitId        String
  unit          Unit     @relation(fields: [unitId], references: [id])
  oldOwnerName  String
  oldOwnerIc    String
  oldEmail      String
  oldPhone      String?
  newOwnerName  String
  newOwnerIc    String
  newEmail      String
  newPhone      String?
  transferDate  DateTime
  proratedOldOwnerBillId String? // Reference to prorated bill for previous owner
  proratedNewOwnerBillId String? // Reference to prorated bill for new owner
  createdAt     DateTime @default(now())
  processedBy   String   // admin ID
}
```
model TelegramAdmin {
  id            String @id @default(cuid())
  telegramId    String @unique
  name          String
  isActive      Boolean @default(true)
  createdAt     DateTime @default(now())
}

model AuditLog {
  id          String   @id @default(cuid())
  action      String
  actorId     String?
  actorType   String   // 'admin' | 'system' | 'telegram'
  targetId    String?
  details     Json?
  createdAt   DateTime @default(now())
}
```

1. Define all enums: `UnitStatus`, `UserRole`, `BillStatus`, `PaymentMethod`, `SubscriptionStatus`
2. Run `npx prisma generate`
3. Commit

---

### Task 0.4: Database Migrations & Seeding

**Objective:** Create initial migration and seed default config.

**Files:**
- Create: `prisma/migrations/.../migration.sql` (auto-generated)
- Create: `prisma/seed.ts`

**Steps:**
1. `npx prisma migrate dev --name init`
2. Seed script inserts one `Config` row with defaults
3. `npx prisma db seed`
4. Commit

---

## Phase 1: Authentication & Authorization

### Task 1.1: NextAuth.js Setup (Auth.js v5)

**Objective:** Configure credentials provider with session strategy.

**Files:**
- Create: `src/auth.ts`
- Create: `src/middleware.ts`
- Modify: `src/app/layout.tsx`

**Steps:**
1. Configure `Auth.js` with Prisma adapter (custom — because schema is hand-rolled, use Credentials provider only)
2. Actually: since schema is custom and residents register via admin CSV, use **Credentials provider only** with manual session management in Postgres (Session model above)
3. Session expiry: 2 hours default. If Remember Me checked → 30 days.
4. Middleware: protect `/dashboard/*`, `/admin/*`, `/api/admin/*`
5. Commit

---

### Task 1.2: Login & Session Pages

**Objective:** Build resident login UI and session hooks.

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/auth.ts`

**Steps:**
1. Login page: email + password + "Remember me" checkbox
2. Server action: `login(email, password, remember)`
3. Create session row in DB, set httpOnly cookie with session token
4. Logout: clear cookie + delete session row
5. Commit

---

### Task 1.3: Role-Based Access Control

**Objective:** Helper to check admin vs resident.

**Files:**
- Create: `src/lib/rbac.ts`
- Create: `src/app/unauthorized/page.tsx`

**Steps:**
1. `isAdmin(session)` helper
2. `requireAdmin()` server function — throws redirect to /unauthorized
3. Apply to all admin routes
4. Commit

---

### Task 1.4: Rate Limiting Middleware

**Objective:** Protect public API routes (login, webhook) from abuse using Valkey.

**Files:**
- Create: `src/lib/rate-limit.ts`
- Modify: `src/app/api/auth/[...nextauth]/route.ts`
- Modify: `src/app/api/webhooks/chip/route.ts`
- Modify: `src/middleware.ts`

**Steps:**
1. Implement sliding window rate limiter using Valkey (Redis) `INCR` + `EXPIRE`
2. Login: max 5 attempts per 15 min per IP. Return `429` with `Retry-After` header
3. Webhook: max 100 requests per 1 min per IP. Return `429`
4. General API: max 60 requests per 1 min per IP
5. Track rate limit hits in logs (for monitoring)
6. Commit

---

## Phase 2: Admin Dashboard (Web)

### Task 2.1: Admin Layout & Navigation

**Objective:** Sidebar navigation for admin panel.

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/components/admin/sidebar.tsx`

**Steps:**
1. Routes: Dashboard, Units, Bills, Payments, Config, Telegram Admins
2. Commit

---

### Task 2.2: Units Management

**Objective:** CRUD for 500 units + CSV import.

**Files:**
- Create: `src/app/admin/units/page.tsx`
- Create: `src/app/api/admin/units/route.ts`
- Create: `src/lib/csv.ts`
- Create: `src/components/admin/units-table.tsx`

**Steps:**
1. Units table with search/filter (block, floor, status)
2. CSV upload: columns `block,floor,unitNo,ownerName,ownerIc,email,phone,monthlyFee`
3. Import logic: parse CSV, skip existing `ownerIc`, create new Unit rows
4. Single unit edit modal
5. Commit

---

### Task 2.3: Bills Management

**Objective:** View all bills, manual mark-as-paid, apply adjustments/discounts.

**Files:**
- Create: `src/app/admin/bills/page.tsx`
- Create: `src/app/api/admin/bills/route.ts`
- Create: `src/components/admin/bills-table.tsx`

**Steps:**
1. Bills table: filter by month, block, status
2. Click bill → modal with details + actions:
   - Apply discount (amount or %)
   - Apply adjustment (+/- amount)
   - Mark as paid (cash/manual) → generate receipt
   - Send reminder email
3. Audit log every action
4. **Language:** Admin UI supports EN/BM toggle. Store admin preference in db.
5. Commit

---

### Task 2.6: Unit Transfer with Proration

**Objective:** Admin can transfer unit ownership with automatic prorated billing for both old and new owner.

**Files:**
- Create: `src/app/admin/units/[id]/transfer/page.tsx`
- Create: `src/app/api/admin/units/[id]/transfer/route.ts`
- Modify: `src/lib/billing.ts` (add proration logic)

**Steps:**
1. Transfer form: new owner details (name, IC, email, phone), transfer effective date
2. Validation: new IC unique (not already in use by active unit)
3. If transfer is mid-month:
   - Generate prorated bill for old owner (1st of month → transfer date - 1)
   - Mark old bill as `TRANSFERRED`
   - Generate prorated bill for new owner (transfer date → end of month)
   - Archive old user account (deactivate, keep for audit)
   - Create new user account for new owner with unit association
4. If transfer is on month boundary (1st of month): no proration needed, just swap ownership
5. Send notification emails to both old and new owner
6. Audit log: record in `UnitTransfer` table
7. Commit

---

### Task 2.4: Configuration Panel

**Objective:** Admin can edit all system configs.

**Files:**
- Create: `src/app/admin/config/page.tsx`
- Create: `src/app/api/admin/config/route.ts`

**Steps:**
1. Form fields:
   - Penalty grace period (days)
   - Penalty percentage (%)
   - Retry duration (days)
   - Retry attempts per day
   - Gateway fee percentage (%)
2. Save updates Config row
3. Changes reflect immediately (no restart needed)
4. Commit

---

### Task 2.5: Receipt Viewer & Export

**Objective:** Generate receipt PDFs, store in RustFS.

**Files:**
- Create: `src/lib/receipt.ts`
- Create: `src/lib/rustfs.ts`
- Create: `src/app/api/receipts/[id]/route.ts`

**Steps:**
1. Receipt template HTML → PDF via `puppeteer-core` or `playwright-core` (or lightweight `pdf-lib`)
2. Receipt number format: `RCP-YYYY-NNNNNN` (auto-increment per year)
3. Upload PDF to RustFS bucket `receipts/YYYY/MM/`
4. Store public URL or presigned URL in Bill.receiptUrl
5. Commit

---

## Phase 3: Resident Portal

### Task 3.1: Resident Dashboard

**Objective:** Landing page after login showing current bill.

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/api/dashboard/route.ts`

**Steps:**
1. Fetch current month bill for user's unit
2. Show: month, base amount, additional fee, discount, penalty, total, due date, status
3. If paid → show receipt link, paid date
4. If pending → show payment options (Card Auto-Debit / FPX One-Time)
5. **Language:** Portal UI primarily in **Bahasa Malaysia** (BM). Add EN toggle. Use `next-intl` for i18n.
6. Commit

---

### Task 3.4: i18n Setup

**Objective:** Setup multi-language throughout the app.

**Files:**
- Create: `src/i18n/config.ts`
- Create: `src/messages/ms.json` (Bahasa Malaysia — primary for resident)
- Create: `src/messages/en.json` (English — primary for admin)
- Modify: `src/app/layout.tsx`
- Modify: `middleware.ts` (locale routing)

**Steps:**
1. Install `next-intl`
2. Resident routes prefixed with `/ms/*`, admin routes default to `/en/*` with option to switch
3. All UI text extracted to JSON files
4. Language preference stored in cookie + db per user
5. Email templates also support both languages (send based on user preference)
6. Commit

---

### Task 3.2: Payment History

**Objective:** List all past bills with status.

**Files:**
- Create: `src/app/dashboard/history/page.tsx`
- Create: `src/components/dashboard/bill-history.tsx`

**Steps:**
1. Table: month, amount, status, paid date, receipt link
2. Commit

---

### Task 3.3: Profile Management

**Objective:** Resident can update email/phone, view unit info.

**Files:**
- Create: `src/app/dashboard/profile/page.tsx`
- Create: `src/app/api/dashboard/profile/route.ts`

**Steps:**
1. Editable: email, phone
2. Read-only: unit info, owner name, IC
3. Commit

---

## Phase 4: CHIP Payment Integration

### Task 4.1: CHIP API Client

**Objective:** Type-safe wrapper for CHIP Collect API.

**Files:**
- Create: `src/lib/chip.ts`
- Create: `src/types/chip.ts`

**Steps:**
1. Functions:
   - `createOneTimeBill(amount, redirectUrl, callbackUrl, metadata)` → FPX/Card one-time
   - `createSubscription(amount, redirectUrl, callbackUrl, metadata)` → Card tokenization
   - `chargeSubscription(subscriptionId, amount)` → trigger monthly charge
   - `cancelSubscription(subscriptionId)` → admin unsubscribe
   - `verifyWebhook(signature, body)` → HMAC verification
2. Use `x-api-key` header (per user memory)
3. Commit

---

### Task 4.2: One-Time Payment Flow (FPX / Card)

**Objective:** Resident clicks "Bayar Sekali" → redirect to CHIP → webhook updates.

**Files:**
- Create: `src/app/api/payments/onetime/create/route.ts`
- Create: `src/app/api/payments/onetime/callback/route.ts`
- Create: `src/app/api/webhooks/chip/route.ts`

**Steps:**
1. Create route: accepts `billId`, calls CHIP `createOneTimeBill`, stores `chipBillId` in Bill row, returns redirect URL
2. Callback route: CHIP redirects here after payment. Show success/fail UI
3. Webhook route: definitive source of truth. CHIP sends `payment.paid` event → update Bill status to PAID, generate receipt, send email
4. Verify webhook HMAC signature
5. Commit

---

### Task 4.3: Subscription Flow (Card Auto-Debit)

**Objective:** First-time card tokenization + monthly charging.

**Files:**
- Create: `src/app/api/payments/subscription/create/route.ts`
- Create: `src/app/api/payments/subscription/callback/route.ts`
- Create: `src/app/api/payments/subscription/charge/route.ts`

**Steps:**
1. Create route: resident clicks "Daftar Auto-Debit". Call CHIP `createSubscription`. Store `chipSubscriptionId` in Subscription table
2. Callback: show success (subscription active) or failure
3. Webhook: CHIP confirms subscription active → update Subscription.status = ACTIVE
4. Charge route (internal API, called by cron job): for each active subscription with pending bill, call `chargeSubscription(subscriptionId, bill.totalAmount)`. On success update bill to PAID. On failure increment retry counter
5. Commit

---

### Task 4.4: Admin Unsubscribe

**Objective:** Admin can cancel a unit's subscription.

**Files:**
- Modify: `src/app/admin/units/page.tsx` (add action)
- Create: `src/app/api/admin/subscriptions/[id]/cancel/route.ts`

**Steps:**
1. Unit row action: "Cancel Auto-Debit"
2. Calls CHIP cancel API
3. Updates Subscription.status = CANCELLED
4. Audit log
5. Commit

---

## Phase 5: Billing Engine & Background Jobs

### Task 5.1: Monthly Bill Generation Job

**Objective:** Auto-generate bills for all active units on 1st of month @ 00:00.

**Files:**
- Create: `src/jobs/generateBills.ts`
- Create: `src/lib/billing.ts`
- Create: `src/app/api/cron/generate-bills/route.ts`

**Steps:**
1. Cron: HTTP endpoint protected by secret header (called by Dokploy cron or external scheduler)
2. For each active unit:
   - Check if bill exists for current month → skip
   - Calculate `baseAmount = unit.monthlyFee`
   - Calculate `additionalFee = baseAmount * config.gatewayFeePercent / 100`
   - `totalAmount = baseAmount + additionalFee` (discount/penalty applied later)
   - Create Bill row with status PENDING
3. Queue job in BullMQ for each unit (parallel)
4. Send "Bill Ready" email notification to each resident
5. Commit

---

### Task 5.2: Prorated Billing

**Objective:** Handle new residents joining mid-month.

**Files:**
- Modify: `src/lib/billing.ts`
- Modify: `src/app/admin/units/page.tsx`

**Steps:**
1. When admin creates/imports unit with `effectiveDate` (move-in date):
   - If effectiveDate is current month, prorated = monthlyFee * (remainingDays / totalDaysInMonth)
   - Round to 2 decimal places
2. Generate prorated bill immediately (not wait for 1st of next month)
3. From next month onward, full amount
4. Commit

---

### Task 5.3: Penalty Calculation Job

**Objective:** Apply penalty to overdue bills after grace period.

**Files:**
- Create: `src/jobs/applyPenalties.ts`
- Create: `src/app/api/cron/apply-penalties/route.ts`

**Steps:**
1. Daily cron (e.g., 01:00 AM)
2. Find all PENDING bills where `now() > dueDate + config.penaltyDays`
3. If penalty not yet applied:
   - `penaltyAmount = (baseAmount + additionalFee - discount - adjustment) * config.penaltyPercent / 100`
   - Recalculate `totalAmount`
   - Update bill
   - Send penalty notification email
4. Commit

---

### Task 5.4: Subscription Retry Job

**Objective:** Retry failed subscription charges.

**Files:**
- Create: `src/jobs/retrySubscriptions.ts`
- Create: `src/app/api/cron/retry-subscriptions/route.ts`

**Steps:**
1. Run every 12 hours (2x per day)
2. Find bills with:
   - status PENDING
   - has active subscription
   - previous charge attempts failed
   - within retry window (config.retryDays from first failure)
3. For each: call CHIP charge. Track attempt count per day and total days
4. If success → mark PAID
5. If exhausted → update bill status to `RETRY_EXHAUSTED`, send email to resident + admin notification
6. Commit

---

## Phase 6: Notifications & Email

### Task 6.1: SMTP Email Service

**Objective:** Generic email sender with templates.

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/lib/email-templates.ts`
- Create: `src/app/api/test-email/route.ts`

**Steps:**
1. Nodemailer transport with env SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
2. Templates (plain text + HTML):
   - Bill ready
   - Payment successful (with receipt link)
   - Payment failed / retry
   - Retry exhausted (manual fallback)
   - Penalty applied
   - Subscription cancelled
3. Test endpoint for admin to verify SMTP config
4. Commit

---

### Task 6.2: Notification Queue

**Objective:** Use BullMQ to send emails asynchronously.

**Files:**
- Create: `src/queues/email.ts`
- Modify: `src/lib/email.ts`

**Steps:**
1. Define BullMQ queue `email-queue`
2. Producer: `sendEmailJob(template, to, data)` adds job to queue
3. Worker: processes jobs, calls nodemailer, logs result
4. Retry failed emails 3x with backoff
5. Commit

---

## Phase 7: Telegram Admin Bot

### Task 7.1: Bot Setup & Auth

**Objective:** Telegram bot that only responds to whitelisted admin Telegram IDs.

**Files:**
- Create: `src/bot/index.ts`
- Create: `src/bot/commands.ts`
- Create: `src/bot/middleware.ts`
- Create: `src/app/api/telegram/webhook/route.ts`

**Steps:**
1. Use `node-telegram-bot-api` or `telegraf`
2. Webhook mode: Telegram POSTs to `/api/telegram/webhook`
3. Middleware: check if `chat.id` exists in `TelegramAdmin` table and `isActive = true`
4. If not whitelisted → silently ignore or reply "Unauthorized"
5. Commit

---

### Task 7.2: Bot Commands — Queries

**Objective:** Admin queries via Telegram.

**Files:**
- Modify: `src/bot/commands.ts`

**Commands:**
1. `/summary [month]` — total collected, outstanding, collection rate
2. `/unit <unit-id>` — unit details, owner, contact, current bill status
3. `/unpaid [month]` — paginated list of unpaid units (20 per page)
4. `/receipt <receipt-no>` — link to receipt PDF
5. `/history <unit-id>` — last 6 months payment history
6. Commit

---

### Task 7.3: Bot Commands — Config Management

**Objective:** Admin can change system config via Telegram.

**Files:**
- Modify: `src/bot/commands.ts`
- Create: `src/bot/conversations.ts`

**Commands:**
1. `/config` — show current config
2. `/setpenaltydays <days>`
3. `/setpenaltypercent <percent>`
4. `/setretrydays <days>`
5. `/setretryattempts <count>`
6. `/setgatewayfee <percent>`
7. Use conversation state machine for confirmation ("Confirm change penalty days to 15? Yes/No")
8. Audit log all changes
9. Commit

---

### Task 7.4: Bot Commands — Admin Management

**Objective:** Add/remove Telegram admins.

**Files:**
- Modify: `src/bot/commands.ts`

**Commands:**
1. `/addadmin <telegramId> <name>` — add new Telegram admin (only existing admin can do)
2. `/removeadmin <telegramId>` — deactivate
3. `/listadmins` — list all
4. Commit

---

### Task 7.5: Bot Notifications

**Objective:** Bot sends proactive alerts to admin group/channel.

**Files:**
- Create: `src/bot/notifications.ts`
- Modify: relevant job files

**Events:**
1. Payment successful (optional, maybe too spammy for 500 units — make configurable)
2. Payment failed after retry exhausted
3. New unit imported
4. Subscription cancelled by admin
5. Daily summary (optional cron)
6. Commit

---

## Phase 8: Reports & Export

### Task 8.1: Collection Report

**Objective:** Monthly collection summary.

**Files:**
- Create: `src/app/admin/reports/page.tsx`
- Create: `src/app/api/admin/reports/route.ts`

**Steps:**
1. Select month → show:
   - Total expected
   - Total collected
   - Total outstanding
   - Collection rate %
   - Breakdown by block
   - Breakdown by payment method
2. Export to CSV
3. Commit

---

### Task 8.3: Bank Reconciliation Export

**Objective:** Monthly export formatted for treasurer to reconcile against bank statement.

**Files:**
- Create: `src/app/admin/reports/reconciliation/page.tsx`
- Create: `src/app/api/admin/reports/reconciliation/route.ts`
- Create: `src/lib/reconciliation.ts`

**Steps:**
1. Generate month-end report with columns:
   - Date, Receipt No, Unit, Owner Name, Amount, Payment Method (CARD/FPX/CASH), CHIP Transaction ID, Status
2. Group by payment method (CARD auto-debit vs FPX vs manual cash)
3. Totals per method + grand total
4. Highlight pending/incomplete entries
5. Export to Excel (with formatting) + CSV
6. Include CHIP transaction IDs for cross-reference with CHIP dashboard
7. Upload to RustFS `reports/YYYY/MM/reconciliation.xlsx`
8. Commit

---

### Task 8.2: Audit Log Viewer

**Objective:** View system audit trail.

**Files:**
- Create: `src/app/admin/audit/page.tsx`
- Create: `src/app/api/admin/audit/route.ts`

**Steps:**
1. Table: timestamp, action, actor, target, details
2. Filter by action type, date range
3. Export CSV
4. Commit

---

## Phase 9: DevOps & Infrastructure Polish

### Task 9.1: Environment Configuration

**Objective:** Full `.env` documentation and validation.

**Files:**
- Create: `.env.example`
- Create: `src/lib/env.ts` (Zod validation)

Required env vars:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CHIP_API_KEY=...
CHIP_BRAND_ID=...
CHIP_API_URL=https://sandbox-api.chip-in.asia  // Sandbox only for dev
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
RUSTFS_ENDPOINT=...
RUSTFS_ACCESS_KEY=...
RUSTFS_SECRET_KEY=...
RUSTFS_BUCKET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
NEXTAUTH_SECRET=...
CRON_SECRET=...
RATE_LIMIT_LOGIN_MAX=5          // Max login attempts per window
RATE_LIMIT_LOGIN_WINDOW=900     // Window in seconds (15 min)
RATE_LIMIT_WEBHOOK_MAX=100      // Max webhook requests per window
RATE_LIMIT_WEBHOOK_WINDOW=60    // Window in seconds (1 min)
```

1. Validate all at startup — fail fast if missing
2. Commit

---

### Task 9.2: Postgres Backup Script

**Objective:** Automated daily dump to RustFS.

**Files:**
- Create: `scripts/backup-postgres.sh`
- Modify: `docker-compose.yml`

**Steps:**
1. `pg_dump` to compressed file with timestamp
2. Upload to RustFS `backups/postgres/YYYY/MM/`
3. Keep last 30 days (cleanup old backups)
4. Run via Dokploy cron or container cron
5. Commit

---

### Task 9.3: Healthchecks & Monitoring

**Objective:** Basic health endpoints.

**Files:**
- Create: `src/app/api/health/route.ts`

**Steps:**
1. Check DB connectivity
2. Check Valkey connectivity
3. Check RustFS connectivity
4. Return JSON status
5. Dokploy can use for uptime monitoring
6. Commit

---

### Task 9.4: Dokploy Deployment Config

**Objective:** Dokploy-specific files.

**Files:**
- Create: `dokploy.yml` (if Dokploy uses it)
- Modify: `docker-compose.yml` (production overrides)
- Create: `README.md`

**Steps:**
1. Document deployment steps
2. Document cron job setup in Dokploy (external cron calling HTTP endpoints with CRON_SECRET)
3. Document Telegram webhook setup
4. Commit

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library)
- `src/lib/billing.ts` — penalty calculation, prorated calculation
- `src/lib/chip.ts` — webhook signature verification
- `src/lib/rbac.ts` — role checks

### Integration Tests (Playwright)
## Open Questions / Future Considerations

All requirements confirmed and implemented in plan above.

### Additional Considerations
1. **WhatsApp integration:** When budget opens up — can add as Phase 10
2. **SMS fallback:** For critical reminders (retry exhausted, penalty applied)
3. **Mobile app (PWA):** Add to home screen capability for residents
4. **Bank integration direct:** If condo gets corporate bank account with API access
5. **Auto-reconciliation:** Match CHIP payouts automatically when API supports it

---

## Order of Implementation (Dependency Chain)

**Week 1:** Tasks 0.1 → 0.2 → 0.3 → 0.4 → 1.1 → 1.2 → 1.3 → 1.4  
**Week 2:** Tasks 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 3.4 → 3.1 → 3.2 → 3.3  
**Week 3:** Tasks 4.1 → 4.2 → 4.3 → 4.4 → 5.1 → 5.2 → 5.3 → 5.4  
**Week 4:** Tasks 6.1 → 6.2 → 7.1 → 7.2 → 7.3 → 7.4 → 7.5  
**Week 5:** Tasks 8.1 → 8.3 → 8.2 → 9.1 → 9.2 → 9.3 → 9.4 → Testing → Polish → Deploy

---

## Open Questions / Future Considerations

1. **CHIP Sandbox:** Ensure all dev/testing uses CHIP sandbox environment
2. **Rate Limiting:** Add rate limiting to public API routes (login, webhook)
3. **Multi-language:** Resident portal in BM? Admin in EN/BM?
4. **WhatsApp fallback:** If budget opens up later, WhatsApp Business API for resident notifications
5. **Bank reconciliation:** Monthly export for treasurer to reconcile with bank statement
6. **Unit transfer:** If owner jual rumah, admin perlu update ownership → handle mid-month proration

---

*Plan written on 2026-05-04. Next step: Execute Phase 0.*
