import { db } from "./db";

// Generate monthly bills for all active units
export async function generateMonthlyBills(monthYear: string, dueDate: Date) {
  const config = await db.config.findFirst();
  if (!config) throw new Error("Config not found");

  const units = await db.unit.findMany({
    where: { status: "ACTIVE" },
  });

  let created = 0;
  let skipped = 0;

  for (const unit of units) {
    const existing = await db.bill.findFirst({
      where: { unitId: unit.id, monthYear },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const baseAmount = Number(unit.monthlyFee);
    const additionalFee = baseAmount * (Number(config.gatewayFeePercent) / 100);
    const totalAmount = baseAmount + additionalFee;

    await db.bill.create({
      data: {
        unitId: unit.id,
        monthYear,
        baseAmount,
        additionalFee,
        totalAmount,
        dueDate,
        status: "PENDING",
      },
    });
    created++;
  }

  return { created, skipped };
}

// Apply penalties to overdue bills
export async function applyPenalties() {
  const config = await db.config.findFirst();
  if (!config) throw new Error("Config not found");

  const graceMs = config.penaltyDays * 24 * 60 * 60 * 1000;
  const now = new Date();

  const overdueBills = await db.bill.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: new Date(now.getTime() - graceMs) },
      penaltyAmount: 0,
    },
  });

  let updated = 0;

  for (const bill of overdueBills) {
    const base = Number(bill.baseAmount) + Number(bill.additionalFee) - Number(bill.discount) - Number(bill.adjustment);
    const penaltyAmount = base * (Number(config.penaltyPercent) / 100);
    const totalAmount = base + penaltyAmount;

    await db.bill.update({
      where: { id: bill.id },
      data: {
        penaltyAmount,
        totalAmount,
        status: "OVERDUE",
      },
    });
    updated++;
  }

  return { updated };
}

// Retry failed subscription charges
export async function retrySubscriptionCharges() {
  const config = await db.config.findFirst();
  if (!config) throw new Error("Config not found");

  const retryWindowMs = config.retryDays * 24 * 60 * 60 * 1000;
  const now = new Date();

  // Find pending bills with active subscriptions that haven't been retried too much
  const bills = await db.bill.findMany({
    where: {
      status: { in: ["PENDING", "OVERDUE"] },
      unit: { subscriptions: { some: { status: "ACTIVE" } } },
      createdAt: { gte: new Date(now.getTime() - retryWindowMs) },
    },
    include: {
      unit: {
        include: { subscriptions: { where: { status: "ACTIVE" } } },
      },
    },
  });

  let attempted = 0;
  let succeeded = 0;
  let exhausted = 0;

  for (const bill of bills) {
    const subscription = bill.unit.subscriptions[0];
    if (!subscription) continue;

    attempted++;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/payments/subscription/charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({
          subscriptionId: subscription.chipSubscriptionId,
          billId: bill.id,
        }),
      });

      if (res.ok) {
        succeeded++;
      } else {
        // Check if retry exhausted
        const failureAge = now.getTime() - bill.createdAt.getTime();
        if (failureAge > retryWindowMs) {
          await db.bill.update({
            where: { id: bill.id },
            data: { status: "RETRY_EXHAUSTED" },
          });
          exhausted++;
        }
      }
    } catch (err) {
      console.error(`Retry failed for bill ${bill.id}:`, err);
    }
  }

  return { attempted, succeeded, exhausted };
}

// Generate prorated bill for mid-month transfers
export async function generateProratedBill(
  unitId: string,
  monthYear: string,
  monthlyFee: number,
  days: number,
  totalDaysInMonth: number,
  dueDate: Date
) {
  const proratedAmount = monthlyFee * (days / totalDaysInMonth);

  return db.bill.create({
    data: {
      unitId,
      monthYear,
      baseAmount: proratedAmount,
      totalAmount: proratedAmount,
      dueDate,
      status: "PENDING",
    },
  });
}
