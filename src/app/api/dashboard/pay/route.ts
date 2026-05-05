import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { z } from "zod";

const paySchema = z.object({
  billId: z.string(),
});

export async function POST(request: Request) {
  try {
    const session = await getUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    if (!session.user.unitId) {
      return NextResponse.json({ error: "No unit assigned" }, { status: 400 });
    }
    
    const body = await request.json();
    const { billId } = paySchema.parse(body);
    
    const bill = await db.bill.findUnique({
      where: { 
        id: billId,
        unitId: session.user.unitId,
      },
      include: { unit: true },
    });
    
    if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    if (bill.status === "PAID") return NextResponse.json({ error: "Bill already paid" }, { status: 409 });

    // Apply gateway fee at payment time
    const config = await db.config.findFirst();
    const fixedFeeInRM = Number(config?.gatewayFeeFixed ?? 0) / 100;
    const percentFee = Number(bill.baseAmount) * (Number(config?.gatewayFeePercent ?? 0) / 100);
    const newAdditionalFee = percentFee + fixedFeeInRM;
    const newTotalAmount =
      Number(bill.baseAmount) +
      newAdditionalFee -
      Number(bill.discount) +
      Number(bill.adjustment) +
      Number(bill.penaltyAmount);

    await db.bill.update({
      where: { id: bill.id },
      data: {
        additionalFee: newAdditionalFee,
        totalAmount: newTotalAmount,
      },
    });

    const chipSecret = process.env.CHIP_SECRET_KEY;
    const chipBrandId = process.env.CHIP_BRAND_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const chipApiUrl = process.env.CHIP_API_URL || "https://gate.chip-in.asia/api/v1/";
    
    if (!chipSecret || !chipBrandId) {
      return NextResponse.json({ error: "CHIP not configured" }, { status: 500 });
    }
    
    const chipRes = await fetch(`${chipApiUrl}purchases/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${chipSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        brand_id: chipBrandId,
        client: {
          email: bill.unit.email,
          full_name: bill.unit.ownerName,
        },
        purchase: {
          products: [{
            name: `Maintenance Fee ${bill.monthYear}`,
            price: Math.round(newTotalAmount * 100),
            quantity: 1,
          }],
        },
        success_redirect: `${appUrl}/dashboard/payment/success?bill=${bill.id}`,
        failure_redirect: `${appUrl}/dashboard/payment/failed?bill=${bill.id}`,
        cancel_redirect: `${appUrl}/dashboard/payment/cancelled?bill=${bill.id}`,
        success_callback: `${appUrl}/api/webhooks/chip`,
        send_receipt: false,
        due_strict: true,
      }),
    });
    
    const chipData = await chipRes.json();
    if (!chipRes.ok) {
      console.error("CHIP error:", chipData);
      return NextResponse.json({ error: "Payment gateway error" }, { status: 502 });
    }
    
    await db.bill.update({
      where: { id: bill.id },
      data: { chipBillId: String(chipData.id) },
    });
    
    return NextResponse.json({
      success: true,
      checkoutUrl: chipData.checkout_url,
      purchaseId: String(chipData.id),
    });
  } catch (err: any) {
    if (err.name === "ZodError") return NextResponse.json({ error: err.errors }, { status: 400 });
    console.error("Pay error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
