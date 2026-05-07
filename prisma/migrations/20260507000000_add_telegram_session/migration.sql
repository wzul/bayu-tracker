-- Add TelegramSession table for persistent bot login sessions
CREATE TABLE "TelegramSession" (
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "unitId" TEXT,
    "role" TEXT NOT NULL,
    "authenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramSession_pkey" PRIMARY KEY ("chatId")
);
