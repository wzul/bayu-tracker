import { PrismaClient, UnitStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. Config
  const existingConfig = await prisma.config.findFirst();
  if (!existingConfig) {
    await prisma.config.create({
      data: {
        penaltyDays: 20,
        penaltyPercent: 10.00,
        retryDays: 3,
        retryAttemptsPerDay: 2,
        gatewayFeePercent: 0,
      },
    });
    console.log("✅ Config seeded");
  }

  // 2. Admin user
  const adminEmail = "admin@bayu.local";
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) {
    const passwordHash = await bcrypt.hash("admin123", 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
      },
    });
    console.log("✅ Admin user seeded: admin@bayu.local / admin123");
  }

  // 3. Sample units (10 units, 2 blocks)
  const existingUnits = await prisma.unit.count();
  if (existingUnits === 0) {
    const units = [
      { block: "A", floor: "1", unitNo: "01", ownerName: "Ahmad Bin Ali", ownerIc: "800101-01-1234", email: "ahmad@test.com", monthlyFee: 120 },
      { block: "A", floor: "1", unitNo: "02", ownerName: "Siti Binti Abdullah", ownerIc: "850202-02-5678", email: "siti@test.com", monthlyFee: 120 },
      { block: "A", floor: "2", unitNo: "01", ownerName: "Muhammad Faiz", ownerIc: "780303-03-9012", email: "faiz@test.com", monthlyFee: 120 },
      { block: "A", floor: "2", unitNo: "02", ownerName: "Nurul Huda", ownerIc: "900404-04-3456", email: "nurul@test.com", monthlyFee: 120 },
      { block: "B", floor: "1", unitNo: "01", ownerName: "Razak Bin Omar", ownerIc: "820505-05-7890", email: "razak@test.com", monthlyFee: 120 },
      { block: "B", floor: "1", unitNo: "02", ownerName: "Liyana Binti Ismail", ownerIc: "880606-06-1234", email: "liyana@test.com", monthlyFee: 120 },
      { block: "B", floor: "2", unitNo: "01", ownerName: "Hafiz Abdullah", ownerIc: "750707-07-5678", email: "hafiz@test.com", monthlyFee: 120 },
      { block: "B", floor: "2", unitNo: "02", ownerName: "Aisyah bt Yusof", ownerIc: "920808-08-9012", email: "aisyah@test.com", monthlyFee: 120 },
      { block: "C", floor: "1", unitNo: "01", ownerName: "Kamaruddin", ownerIc: "810909-09-3456", email: "kamar@test.com", monthlyFee: 120 },
      { block: "C", floor: "1", unitNo: "02", ownerName: "Faridah bt Ali", ownerIc: "931010-10-7890", email: "faridah@test.com", monthlyFee: 120 },
    ];

    for (const u of units) {
      await prisma.unit.create({ data: { ...u, status: UnitStatus.ACTIVE } });
    }
    console.log("✅ 10 sample units seeded");

    // Create resident users for first 2 units
    const unitA101 = await prisma.unit.findFirst({ where: { block: "A", floor: "1", unitNo: "01" } });
    if (unitA101) {
      const hash = await bcrypt.hash("resident123", 12);
      await prisma.user.create({
        data: {
          email: "ahmad@test.com",
          passwordHash: hash,
          role: UserRole.RESIDENT,
          unitId: unitA101.id,
        },
      });
      console.log("✅ Resident user seeded: ahmad@test.com / resident123");
    }
  }

  console.log("\n🎉 Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
