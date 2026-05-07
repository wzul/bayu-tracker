"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        close: () => void;
        ready: () => void;
        expand: () => void;
      };
    };
  }
}

function TelegramPaymentContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "success";
  const botUsername = searchParams.get("bot");

  const isSuccess = status === "success";
  const isCancelled = status === "cancelled";
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (window.Telegram?.WebApp) {
      e.preventDefault();
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.close();
      return;
    }

    e.preventDefault();
    window.close();
    window.open("about:blank", "_self")?.close();

    // If still here after a moment, navigate to Telegram bot link
    setTimeout(() => {
      if (botUsername) {
        window.location.href = `https://t.me/${botUsername}`;
      } else {
        setAttempted(true);
      }
    }, 300);
  }

  const telegramHref = botUsername ? `https://t.me/${botUsername}` : "#";

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
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              Anda boleh menutup tab ini dan kembali ke Telegram.
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
          </>
        )}

        <a
          href={telegramHref}
          onClick={handleClick}
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full text-center"
        >
          {attempted ? "Kembali ke Telegram" : "Tutup Tab"}
        </a>

        {attempted && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-4">
            Jika butang di atas tidak berfungsi, sila tutup tab ini secara manual.
          </p>
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
