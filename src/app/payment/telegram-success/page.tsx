"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function TelegramPaymentContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "success";

  const isSuccess = status === "success";
  const isCancelled = status === "cancelled";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center">
        {isSuccess && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Pembayaran Berjaya!
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Terima kasih. Bil anda telah dibayar.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Sila tutup tab ini untuk kembali ke Telegram.
            </p>
          </>
        )}

        {isCancelled && (
          <>
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Pembayaran Dibatalkan
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Tiada caj dikenakan. Sila cuba lagi jika perlu.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Sila tutup tab ini untuk kembali ke Telegram.
            </p>
          </>
        )}

        {!isSuccess && !isCancelled && (
          <>
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Ralat Pembayaran
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Sila cuba lagi atau hubungi pentadbiran.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Sila tutup tab ini untuk kembali ke Telegram.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function TelegramPaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-600 dark:text-gray-300">Memuat...</div>}>
      <TelegramPaymentContent />
    </Suspense>
  );
}
