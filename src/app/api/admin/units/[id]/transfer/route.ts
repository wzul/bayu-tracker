import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import bcrypt from "bcryptjs";

const transferSchema = z.object({
  newOwnerName: z.string().min(1),
  newOwnerIc: z.string().min(1),
  newEmail: z.string().email(),
  newPhone: z.string().optional(),
  transferDate: z.string().datetime(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    const body = await request.json();
    const data = transferSchema.parse(body);
    const { id } = await params;

    const unit = await db.unit.findUnique({
      where: { id },
      include: { bills: { where: { status: { in: ["PENDING", "OVERDUE"] } } }, users: true },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const icInUse = await db.unit.findFirst({
      where: { ownerIc: data.newOwnerIc, id: { not: id } },
    });
    if (icInUse) {
      return NextResponse.json({ error: "IC already in use by another unit" }, { status: 409 });
    }

    const transferDate = new Date(data.transferDate);
    const transferDateMYT = new Date(transferDate.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
    const isMidMonth = transferDateMYT.getDate() !== 1;

    // Archive old user accounts
    for (const oldUser of unit.users) {
      await db.user.update({
        where: { id: oldUser.id },
        data: { unitId: null },
      });
    }

    let proratedOldOwnerBillId: string | null = null;
    let proratedNewOwnerBillId: string | null = null;

    if (isMidMonth) {
      const year = transferDateMYT.getFullYear();
      const month = transferDateMYT.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const oldDays = transferDateMYT.getDate() - 1;
      const newDays = daysInMonth - oldDays;

      const oldProrated = Number(unit.monthlyFee) * (oldDays / daysInMonth);
      const newProrated = Number(unit.monthlyFee) * (newDays / daysInMonth);

      const monthYear = `${year}-${String(month + 1).padStart(2, "0")}`;

      // Mark existing pending bills as TRANSFERRED
      for (const bill of unit.bills) {
        if (bill.monthYear === monthYear) {
          await db.bill.update({
            where: { id: bill.id },
            data: { status: "TRANSFERRED" },
          });
        }
      }

      // Create prorated bill for old owner
      const oldBill = await db.bill.create({
        data: {
          unitId: id,
          monthYear,
          baseAmount: oldProrated,
          additionalFee: 0,
          discount: 0,
          adjustment: 0,
          penaltyAmount: 0,
          totalAmount: oldProrated,
          dueDate: transferDate,
          status: "PENDING",
        },
      });
      proratedOldOwnerBillId = oldBill.id;

      // Create prorated bill for new owner
      const newBill = await db.bill.create({
        data: {
          unitId: id,
          monthYear,
          baseAmount: newProrated,
          additionalFee: 0,
          discount: 0,
          adjustment: 0,
          penaltyAmount: 0,
          totalAmount: newProrated,
          dueDate: new Date(year, month + 1, 0),
          status: "PENDING",
        },
      });
      proratedNewOwnerBillId = newBill.id;
    }

    // Record transfer
    const transferRecord = await db.unitTransfer.create({
      data: {
        unitId: id,
        oldOwnerName: unit.ownerName,
        oldOwnerIc: unit.ownerIc,
        oldEmail: unit.users[0]?.email || "",
        oldPhone: unit.phone,
        newOwnerName: data.newOwnerName,
        newOwnerIc: data.newOwnerIc,
        newEmail: data.newEmail,
        newPhone: data.newPhone,
        transferDate,
        proratedOldOwnerBillId,
        proratedNewOwnerBillId,
        processedBy: user.user.id,
      },
    });

    // Update unit with new owner info
    await db.unit.update({
      where: { id },
      data: {
        ownerName: data.newOwnerName,
        ownerIc: data.newOwnerIc,
        phone: data.newPhone,
        status: "ACTIVE",
      },
    });

    // Create new user account for new owner
    const passwordHash = await bcrypt.hash("resident123", 12);
    await db.user.create({
      data: {
        email: data.newEmail,
        passwordHash,
        role: "RESIDENT",
        unitId: id,
      },
    });

    await logAudit({
      action: "UNIT_TRANSFERRED",
      actorId: user.user.id,
      actorType: "admin",
      targetId: id,
      details: {
        oldOwner: unit.ownerName,
        newOwner: data.newOwnerName,
        transferDate: data.transferDate,
        proratedOldOwnerBillId,
        proratedNewOwnerBillId,
      },
    });

    return NextResponse.json({ success: true, transfer: transferRecord });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.name === "ZodError") return NextResponse.json({ error: err.errors }, { status: 400 });
    console.error("Transfer error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
