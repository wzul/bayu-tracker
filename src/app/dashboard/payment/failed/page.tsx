"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const billId = searchParams.get("bill");

  return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Pembayaran Gagal</h1>
        <p className="text-gray-500 mb-6">
          Pembayaran tidak dapat diproses. Sila cuba sekali lagi.
        </p>

        <div className="flex justify-center gap-4">
          {billId && (
            <Link
              href="/dashboard"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Cuba Semula
            </Link>
          )}
          <Link
            href="/dashboard"
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Memuat...</div>}>
      <PaymentFailedContent />
    </Suspense>
  );
}
