"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const billId = searchParams.get("bill");
  const [bill, setBill] = useState<any>(null);

  useEffect(() => {
    if (billId) {
      fetch("/api/dashboard/bills")
        .then((r) => r.json())
        .then((data) => {
          const found = data.bills?.find((b: any) => b.id === billId);
          setBill(found);
        });
    }
  }, [billId]);

  return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Pembayaran Berjaya</h1>
        <p className="text-gray-500 mb-6">Terima kasih atas pembayaran anda.</p>

        {bill && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-500">Bulan</p>
            <p className="font-medium text-lg">{bill.monthYear}</p>
            <p className="text-sm text-gray-500 mt-2">Jumlah</p>
            <p className="font-medium text-lg text-green-600">
              RM {Number(bill.totalAmount).toFixed(2)}
            </p>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <Link
            href="/dashboard"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Kembali ke Dashboard
          </Link>
          <Link
            href="/dashboard/history"
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Lihat Sejarah
          </Link>
        </div>
      </div>
    </div>
  );
}
