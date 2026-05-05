"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const billId = searchParams.get("bill");
  const [bill, setBill] = useState<any>(null);
  const [verifying, setVerifying] = useState(true);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    if (billId) {
      fetch("/api/dashboard/bills")
        .then((r) => r.json())
        .then((data) => {
          const found = data.bills?.find((b: any) => b.id === billId);
          setBill(found);

          if (found && found.status !== "PAID") {
            verifyPayment(billId);
          } else {
            setVerifying(false);
          }
        })
        .catch(() => setVerifying(false));
    } else {
      setVerifying(false);
    }
  }, [billId]);

  async function verifyPayment(id: string, attempt = 1) {
    try {
      const res = await fetch("/api/dashboard/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId: id }),
      });
      const data = await res.json();

      if (data.status === "PAID") {
        setVerifyResult(t("paymentVerified", lang));
        const refresh = await fetch("/api/dashboard/bills");
        const refreshed = await refresh.json();
        const updated = refreshed.bills?.find((b: any) => b.id === id);
        setBill(updated);
      } else if (attempt < 3) {
        setTimeout(() => verifyPayment(id, attempt + 1), 2000);
        return;
      } else {
        setVerifyResult(t("checkDashboard", lang));
      }
    } catch {
      if (attempt < 3) {
        setTimeout(() => verifyPayment(id, attempt + 1), 2000);
        return;
      }
      setVerifyResult(t("checkDashboard", lang));
    }
    setVerifying(false);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t("paymentSuccess", lang)}</h1>
        <p className="text-gray-500 mb-6">{t("thankYou", lang)}</p>

        {verifying && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-blue-700">{t("verifyingPayment", lang)}</p>
          </div>
        )}

        {verifyResult && !verifying && (
          <div className={`rounded-lg p-4 mb-6 ${verifyResult.includes(t("paymentVerified", lang).slice(0, 5)) ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
            <p>{verifyResult}</p>
          </div>
        )}

        {bill && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-500">{t("month", lang)}</p>
            <p className="font-medium text-lg">{bill.monthYear}</p>
            <p className="text-sm text-gray-500 mt-2">{t("amount", lang)}</p>
            <p className="font-medium text-lg text-green-600">
              RM {Number(bill.totalAmount).toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 mt-2">{t("status", lang)}</p>
            <p className={`font-medium ${bill.status === "PAID" ? "text-green-600" : "text-yellow-600"}`}>
              {bill.status === "PAID" ? t("alreadyPaid", lang) : bill.status}
            </p>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <Link
            href="/dashboard"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t("backToDashboard", lang)}
          </Link>
          <Link
            href="/dashboard/history"
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            {t("viewHistory", lang)}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Memuat...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
