# Sistem Maintenance Kondo Bayu

A full-stack condominium maintenance fee billing and payment management system built for Malaysian residents. This application enables condominium administrators to manage units, generate monthly bills, track payments, and allows residents to view and pay their bills online via the CHIP payment gateway.

## Features

### Resident Portal
- **Authentication**: Secure login with cookie-based sessions (with optional "Remember Me" for 30 days)
- **Dashboard**: View pending, paid, and overdue bills with real-time totals
- **Bill Payments**: Pay individual bills or select multiple bills for bulk payment
- **Payment History**: Track past payments with receipt numbers and dates
- **Profile Management**: View unit details and personal information
- **Bilingual UI**: Full support for Bahasa Malaysia (`ms`) and English (`en`)

### Admin Panel
- **Dashboard Analytics**: Overview of total units, pending/paid/overdue bills, collection totals, and user counts
- **Unit Management**: CRUD operations for condo units, bulk import via CSV, ownership transfer with prorated billing
- **Bill Management**: Generate monthly bills for all units, edit individual bills, apply adjustments/discounts/penalties
- **Payment Tracking**: View all payments, reconciliation reports, and settlement records
- **System Settings**: Configure penalty rules, retry settings, and gateway fees
- **Audit Logs**: Track admin actions for compliance and accountability
- **Telegram Bot Integration**: Admin commands via Telegram for quick queries and notifications

### Automation
- **Scheduled Bill Generation**: Monthly cron job to auto-generate bills for all active units
- **Penalty Application**: Automatic penalty calculation based on configurable grace days and percentage
- **Payment Retry**: Automated retry logic for subscription-based payments
- **Email Notifications**: OTP authentication, payment confirmations, and bill reminders via SMTP
- **e-Invoice (LHDN)**: Optional integration with LHDN MyInvois for tax-compliant electronic invoicing

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.9 |
| Styling | Tailwind CSS 3 |
| Database | PostgreSQL (via Prisma 5.22 ORM) |
| Cache / Queues | Valkey/Redis (BullMQ) |
| Object Storage | RustFS/MinIO (S3-compatible) |
| Payments | CHIP Collect API (Malaysian gateway) |
| Auth | Custom bcrypt + cookie-based sessions |
| Email | Nodemailer (SMTP) |
| Telegram | Bot API with inline keyboards |
| Validation | Zod |
| Dates | date-fns (UTC storage, MYT display) |

## Prerequisites

- Docker & Docker Compose
- Node.js 24+ (only if running outside Docker)

## Quick Start (Docker)

All runtime commands should run inside Docker containers to avoid polluting the host OS.

1. **Clone and configure:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Start the full stack:**
   ```bash
   docker compose up --build
   ```

   Services started:
   - App: `http://localhost:3000`
   - PostgreSQL: `localhost:5432`
   - Valkey (Redis): `localhost:6379`
   - MinIO Console: `http://localhost:9004`

3. **Seed the database (first run):**
   ```bash
   docker compose exec app npx prisma db seed
   ```

4. **Run database migrations manually (if needed):**
   ```bash
   docker compose exec app npx prisma migrate deploy
   ```

The app container automatically runs `prisma migrate deploy` on startup before starting the Next.js server.

## Project Structure

```
.
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── migrations/         # Prisma migrations
│   └── seed.ts             # Database seeder
├── src/
│   ├── app/
│   │   ├── (pages)         # Next.js App Router pages
│   │   │   ├── admin/      # Admin panel routes
│   │   │   ├── dashboard/  # Resident portal routes
│   │   │   ├── login/      # Authentication page
│   │   │   └── api/        # API routes (REST)
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Root redirect to /login
│   ├── components/
│   │   ├── admin/Sidebar.tsx
│   │   ├── LanguageProvider.tsx
│   │   ├── LanguageSwitcher.tsx
│   │   └── Providers.tsx
│   └── lib/
│       ├── auth.ts         # getUser(), requireAdmin()
│       ├── session.ts      # Session creation & validation
│       ├── chip.ts         # CHIP Collect API client
│       ├── chip-webhook.ts # CHIP webhook handler
│       ├── telegram.ts     # Telegram bot dispatcher
│       ├── email.ts        # SMTP email sender
│       ├── billing.ts      # Bill generation & penalty logic
│       ├── db.ts           # PrismaClient singleton
│       ├── i18n.ts         # ms/en translations
│       ├── date.ts         # MYT timezone formatting
│       ├── lhdn.ts         # LHDN e-Invoice client
│       ├── einvoice.ts     # e-Invoice orchestration
│       ├── audit.ts        # Audit logging
│       ├── rate-limit.ts   # Rate limiter (login/webhooks)
│       └── env.ts          # Environment validation
├── docker-compose.yml      # Local development stack
├── docker-compose.dokploy.yml  # Production Dokploy variant
├── Dockerfile              # Multi-stage Docker build
├── scripts/
│   └── backup-postgres.sh  # PostgreSQL → S3 backup script
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

## Database Schema

Key entities:

- **Unit** — condo unit (block/floor/unitNo, owner, monthly fee)
- **User** — `ADMIN` or `RESIDENT` role, linked to a Unit
- **Bill** — monthly maintenance bill with `baseAmount + additionalFee + adjustment + penaltyAmount - discount = totalAmount`
- **Session** — token-based HTTP-only cookie sessions
- **Config** — singleton table for penalty rules, retry settings, gateway fees
- **ChipSettlement** — records payment gateway settlement webhooks
- **Subscription** — CHIP recurring subscriptions
- **UnitTransfer** — ownership transfer history with prorated bills
- **TelegramAdmin** — Telegram bot administrators
- **AuditLog** — action trail for compliance

All monetary values use Prisma `Decimal` with `@db.Decimal(10, 2)`. All dates are stored in UTC and displayed in `Asia/Kuala_Lumpur` (MYT).

## Environment Variables

Required variables (see `.env.example` for full list):

```bash
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/condo_db?schema=public

# Cache
REDIS_URL=redis://valkey:6379

# CHIP Payment Gateway
CHIP_SECRET_KEY=your_secret
CHIP_BRAND_ID=your_brand_id
CHIP_API_URL=https://gate.chip-in.asia/api/v1/

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXTAUTH_SECRET=your_session_secret

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
SMTP_FROM=noreply@example.com

# Object Storage (S3/MinIO)
RUSTFS_ENDPOINT=https://s3.example.com
RUSTFS_ACCESS_KEY=key
RUSTFS_SECRET_KEY=secret
RUSTFS_BUCKET=condo-maintenance

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=webhook_secret

# Rate Limiting
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_LOGIN_WINDOW=900
RATE_LIMIT_WEBHOOK_MAX=100
RATE_LIMIT_WEBHOOK_WINDOW=60

# Cron Jobs
CRON_SECRET=your_cron_secret

# LHDN e-Invoice (optional)
ENABLE_EINVOICE=false
LHDN_CLIENT_ID=your_client_id
LHDN_CLIENT_SECRET=your_secret
LHDN_API_URL=https://preprod-api.myinvois.hasil.gov.my
```

## Payment Flow (CHIP)

1. **Single Payment**: Resident clicks "Pay" on a bill → API creates a CHIP `purchase` → stores `chipBillId` → redirects to CHIP checkout URL
2. **Bulk Payment**: Resident selects multiple bills → API creates one CHIP purchase with multiple products → stores the same `chipPurchaseId` on all selected bills
3. **Webhook**: CHIP sends `purchase.paid` event → `/api/webhooks/chip` updates all matching bills to `PAID` status
4. **Settlement**: CHIP settlement webhooks are recorded in `ChipSettlement` for reconciliation reports

## Telegram Bot

The bot supports both residents and admins with role-based access control.

**Resident commands:**
- `/login` — Email + OTP authentication
- `/cek` — Check pending bills
- `/menu` — Show main menu
- `/help` — Help text

**Admin commands:**
- `/summary` — Collection overview
- `/bills <month>` — Monthly bill listing
- `/unit <query>` — Search unit by code or owner name
- `/overdue` — Overdue bills
- `/config` — View/edit system settings
- `/listadmins` — List Telegram admins
- `/addadmin <id> <name>` — Add Telegram admin
- `/removeadmin <id>` — Remove Telegram admin

## Cron Jobs

Protected by `CRON_SECRET` header:

| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/cron/generate-bills` | Monthly (1st) | Generate bills for all active units |
| `/api/cron/apply-penalties` | Daily | Apply penalties to overdue bills |
| `/api/cron/retry-subscriptions` | Daily | Retry failed subscription payments |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (use inside Docker) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma generate` | Generate Prisma client |
| `npx prisma migrate dev` | Run development migrations |
| `npx prisma db seed` | Seed database |
| `docker compose up --build` | Start full Docker stack |

## Backup

A PostgreSQL backup script (`scripts/backup-postgres.sh`) is included. Run manually or schedule via cron:

```bash
docker compose --profile backup run --rm backup /app/backup-postgres.sh
```

Backups are uploaded to the configured S3-compatible object storage.

## Deployment

The project includes a multi-stage `Dockerfile` optimized for production with `output: 'standalone'`. A `docker-compose.dokploy.yml` is provided for Dokploy deployment.

## Authentication

This project uses **custom cookie-based session auth** (not NextAuth):
- Sessions are stored in the `Session` Prisma model with 2-hour expiry (30 days with "Remember Me")
- Session expiry refreshes automatically when within the last 24 hours
- Admin pages use `requireAdmin()` middleware
- Resident pages use `getUser()` cached per-request

## Important Notes

- **Docker-First**: All Node/Prisma commands should run inside Docker containers. Do not run `npm install`, `npx prisma migrate dev`, or `npm run dev` directly on the host.
- **Money Handling**: Always use Prisma `Decimal` for monetary calculations. Never use plain JS numbers.
- **Date Handling**: Store dates in UTC, display in MYT (`Asia/Kuala_Lumpur`) via helpers in `src/lib/date.ts`.
- **Security**: Input is validated with Zod on all API routes. Rate limiting is applied to login and webhook endpoints.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE) (GPLv3).
