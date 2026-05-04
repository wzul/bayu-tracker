import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.config.findFirst();
  if (!existing) {
    await prisma.config.create({
      data: {
        penaltyDays: 20,
        penaltyPercent: 10.00,
        retryDays: 3,
        retryAttemptsPerDay: 2,
        gatewayFeePercent: 0,
      },
    });
    console.log("Seeded default Config row.");
  } else {
    console.log("Config row already exists, skipping seed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
