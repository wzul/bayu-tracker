"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { lang } = useLanguage();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("serverError", lang));
        return;
      }

      setSent(true);
    } catch {
      setError(t("serverError", lang));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded shadow">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t("condoSystem", lang)}</h1>
          <LanguageSwitcher />
        </div>

        <h2 className="text-lg font-semibold mb-4">
          {lang === "ms" ? "Tetapan Semula Kata Laluan" : "Reset Password"}
        </h2>

        {sent ? (
          <div className="space-y-4">
            <div className="p-3 bg-green-100 text-green-700 rounded">
              {lang === "ms"
                ? "Kod OTP telah dihantar ke emel anda. Sila semak inbox anda."
                : "An OTP code has been sent to your email. Please check your inbox."}
            </div>
            <Link href="/reset-password" className="block text-center text-blue-600 hover:underline">
              {lang === "ms" ? "Teruskan ke tetapan semula" : "Continue to reset"}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">{t("email", lang)}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? lang === "ms" ? "Menghantar..." : "Sending..."
                : lang === "ms" ? "Hantar Kod OTP" : "Send OTP Code"}
            </button>

            <Link href="/login" className="block text-center text-sm text-blue-600 hover:underline">
              {lang === "ms" ? "← Kembali ke log masuk" : "← Back to login"}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
