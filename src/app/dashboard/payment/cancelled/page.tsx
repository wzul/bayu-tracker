"use client";

import Link from "next/link";

export default function PaymentCancelledPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Pembayaran Dibatalkan</h1>
        <p className="text-gray-500 mb-6">
          Anda telah membatalkan pembayaran. Tiada caj dikenakan.
        </p>

        <div className="flex justify-center gap-4">
          <Link
            href="/dashboard"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
