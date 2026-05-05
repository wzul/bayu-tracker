import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { z } from "zod";

const bulkPaySchema = z.object({
  billIds: z.array(z.string()).min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.user.unitId) return NextResponse.json({ error: "No unit assigned" }, { status: 400 });

    const body = await request.json();
    const { billIds } = bulkPaySchema.parse(body);

    // Fetch all bills, verify ownership and pending status
    const bills = await db.bill.findMany({
      where: {
        id: { in: billIds },
        unitId: session.user.unitId,
        status: { in: ["PENDING", "OVERDUE"] },
      },
      include: { unit: true },
      orderBy: { dueDate: "asc" },
    });

    if (bills.length === 0) return NextResponse.json({ error: "No valid bills found" }, { status: 404 });
    if (bills.length !== billIds.length) {
      return NextResponse.json({ error: "Some bills are invalid or already paid" }, { status: 400 });
    }

    const config = await db.config.findFirst();
    const fixedFeeInRM = Number(config?.gatewayFeeFixed ?? 0) / 100;
    const gatewayFeePercent = Number(config?.gatewayFeePercent ?? 0);

    // Normalize each bill to have percentFee only, then recalculate totalAmount
    for (const b of bills) {
      const percentFee = Number(b.baseAmount) * (gatewayFeePercent / 100);
      const total =
        Number(b.baseAmount) +
        percentFee -
        Number(b.discount) +
        Number(b.adjustment) +
        Number(b.penaltyAmount);
      await db.bill.update({
        where: { id: b.id },
        data: {
          additionalFee: percentFee,
          totalAmount: total,
        },
      });
    }

    // Add fixedFee to the first bill (one fixed fee per transaction)
    const firstBill = bills[0];
    const firstPercent = Number(firstBill.baseAmount) * (gatewayFeePercent / 100);
    const firstNewAdditionalFee = firstPercent + fixedFeeInRM;
    const firstNewTotal =
      Number(firstBill.baseAmount) +
      firstNewAdditionalFee -
      Number(firstBill.discount) +
      Number(firstBill.adjustment) +
      Number(firstBill.penaltyAmount);

    await db.bill.update({
      where: { id: firstBill.id },
      data: {
        additionalFee: firstNewAdditionalFee,
        totalAmount: firstNewTotal,
      },
    });

    // Refetch updated bills for correct total
    const updatedBills = await db.bill.findMany({
      where: { id: { in: billIds } },
      orderBy: { dueDate: "asc" },
    });

    const totalAmount = updatedBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);

    const chipSecret = process.env.CHIP_SECRET_KEY;
    const chipBrandId = process.env.CHIP_BRAND_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const chipApiUrl = process.env.CHIP_API_URL || "https://gate.chip-in.asia/api/v1/";

    if (!chipSecret || !chipBrandId) {
      return NextResponse.json({ error: "CHIP not configured" }, { status: 500 });
    }

    // CHIP: single purchase with multiple products
    const chipRes = await fetch(`${chipApiUrl}purchases/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chipSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        brand_id: chipBrandId,
        client: {
          email: bills[0].unit.email,
          full_name: bills[0].unit.ownerName,
        },
        purchase: {
          products: updatedBills.map((b) => ({
            name: `Maintenance ${b.monthYear}`,
            price: Math.round(Number(b.totalAmount) * 100),
            quantity: 1,
          })),
        },
        success_redirect: `${appUrl}/dashboard/payment/success`,
        failure_redirect: `${appUrl}/dashboard/payment/failed`,
        cancel_redirect: `${appUrl}/dashboard`,
        success_callback: `${appUrl}/api/webhooks/chip`,
        send_receipt: false,
        due_strict: true,
        reference: bills.map((b) => b.id).join(","), // comma-separated bill IDs
      }),
    });

    const chipData = await chipRes.json();
    if (!chipRes.ok) {
      console.error("CHIP error:", chipData);
      return NextResponse.json({ error: "Payment gateway error" }, { status: 502 });
    }

    const chipPurchaseId = String(chipData.id);

    // Store chipPurchaseId in metadata field for webhook lookup
    // We use chipBillId for the first bill, and save full list in a JSONB field
    // Since Prisma doesn't have JSONB on Bill, we store reference on first bill
    await db.bill.updateMany({
      where: { id: { in: billIds } },
      data: { chipBillId: chipPurchaseId },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: chipData.checkout_url,
      purchaseId: chipPurchaseId,
      billsPaid: billIds.length,
      totalAmount,
    });
  } catch (err: any) {
    if (err.name === "ZodError") return NextResponse.json({ error: err.errors }, { status: 400 });
    console.error("Bulk pay error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
