"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { lang } = useLanguage();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError(lang === "ms" ? "Kata laluan tidak sepadan." : "Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("serverError", lang));
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
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

        {success ? (
          <div className="p-3 bg-green-100 text-green-700 rounded">
            {lang === "ms"
              ? "Kata laluan berjaya dikemaskini. Mengalihkan ke log masuk..."
              : "Password updated successfully. Redirecting to login..."}
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

            <div>
              <label className="block text-sm font-medium mb-1">
                {lang === "ms" ? "Kod OTP" : "OTP Code"}
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123456"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{lang === "ms" ? "Kata Laluan Baharu" : "New Password"}</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{lang === "ms" ? "Sahkan Kata Laluan" : "Confirm Password"}</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? lang === "ms" ? "Menyimpan..." : "Saving..."
                : lang === "ms" ? "Kemaskini Kata Laluan" : "Update Password"}
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
