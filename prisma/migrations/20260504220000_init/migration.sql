-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RESIDENT');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'RETRY_EXHAUSTED', 'TRANSFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'FPX', 'CASH');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PENDING', 'CANCELLED');

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "unitNo" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerIc" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "monthlyFee" DECIMAL(10,2) NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "unitId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'RESIDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "monthYear" TEXT NOT NULL,
    "baseAmount" DECIMAL(10,2) NOT NULL,
    "additionalFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "penaltyAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "receiptNo" TEXT,
    "receiptUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "chipBillId" TEXT,
    "chipTransactionId" TEXT,
    "paymentMethod" "PaymentMethod",
    "einvoiceDocumentId" TEXT,
    "einvoiceValidationLink" TEXT,
    "einvoiceQrCodeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "chipSubscriptionId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChipWebhookConfig" (
    "id" TEXT NOT NULL,
    "chipWebhookId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChipWebhookConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChipSettlement" (
    "id" TEXT NOT NULL,
    "chipPurchaseId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "rawWebhook" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChipSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" TEXT NOT NULL,
    "penaltyDays" INTEGER NOT NULL DEFAULT 20,
    "penaltyPercent" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "retryDays" INTEGER NOT NULL DEFAULT 3,
    "retryAttemptsPerDay" INTEGER NOT NULL DEFAULT 2,
    "gatewayFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitTransfer" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "oldOwnerName" TEXT NOT NULL,
    "oldOwnerIc" TEXT NOT NULL,
    "oldEmail" TEXT NOT NULL,
    "oldPhone" TEXT,
    "newOwnerName" TEXT NOT NULL,
    "newOwnerIc" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "newPhone" TEXT,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "proratedOldOwnerBillId" TEXT,
    "proratedNewOwnerBillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedBy" TEXT NOT NULL,

    CONSTRAINT "UnitTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramAdmin" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_ownerIc_key" ON "Unit"("ownerIc");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_receiptNo_key" ON "Bill"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_unitId_key" ON "Subscription"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_chipSubscriptionId_key" ON "Subscription"("chipSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChipWebhookConfig_chipWebhookId_key" ON "ChipWebhookConfig"("chipWebhookId");

-- CreateIndex
CREATE UNIQUE INDEX "ChipSettlement_chipPurchaseId_key" ON "ChipSettlement"("chipPurchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ChipSettlement_billId_key" ON "ChipSettlement"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAdmin_telegramId_key" ON "TelegramAdmin"("telegramId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChipSettlement" ADD CONSTRAINT "ChipSettlement_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitTransfer" ADD CONSTRAINT "UnitTransfer_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
