"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

export default function SecurityPage() {
  const [has2FA, setHas2FA] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { lang } = useLanguage();

  useEffect(() => {
    fetch("/api/dashboard/profile")
      .then((r) => r.json())
      .then((data) => {
        setHas2FA(data.user?.twoFactorEnabled || false);
      });
  }, []);

  async function handleSetup() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Server error");
        return;
      }
      setQrCode(data.qrCode);
      setSecret(data.secret);
    } catch {
      setError(t("serverError", lang));
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Server error");
        return;
      }
      setHas2FA(true);
      setQrCode("");
      setSecret("");
      setCode("");
      setMessage(lang === "ms" ? "2FA berjaya diaktifkan." : "2FA enabled successfully.");
    } catch {
      setError(t("serverError", lang));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Server error");
        return;
      }
      setHas2FA(false);
      setCode("");
      setPassword("");
      setMessage(lang === "ms" ? "2FA berjaya dinyahaktifkan." : "2FA disabled successfully.");
    } catch {
      setError(t("serverError", lang));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        {lang === "ms" ? "Keselamatan Akaun" : "Account Security"}
      </h1>

      {message && (
        <div className="mb-4 p-3 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">{message}</div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
          {lang === "ms" ? "Pengesahan Dua Faktor (2FA)" : "Two-Factor Authentication (2FA)"}
        </h2>

        {has2FA ? (
          <form onSubmit={handleDisable} className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {lang === "ms"
                ? "2FA kini diaktifkan. Masukkan kod dari aplikasi pengesah anda dan kata laluan untuk menyahaktifkan."
                : "2FA is currently enabled. Enter a code from your authenticator app and your password to disable."}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                {lang === "ms" ? "Kod 2FA" : "2FA Code"}
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100"
                placeholder="123456"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                {lang === "ms" ? "Kata Laluan" : "Password"}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading
                ? lang === "ms" ? "Memproses..." : "Processing..."
                : lang === "ms" ? "Nyahaktifkan 2FA" : "Disable 2FA"}
            </button>
          </form>
        ) : qrCode ? (
          <form onSubmit={handleEnable} className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {lang === "ms"
                ? "Imbas kod QR ini dengan Google Authenticator atau aplikasi serupa, kemudian masukkan kod 6-digit."
                : "Scan this QR code with Google Authenticator or a similar app, then enter the 6-digit code."}
            </p>
            <div className="flex justify-center">
              <img src={qrCode} alt="2FA QR Code" className="w-48 h-48"></img>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {lang === "ms" ? "Atau masukkan kod rahsia:" : "Or enter secret key:"}
              </p>
              <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-sm text-gray-800 dark:text-gray-100">{secret}</code>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                {lang === "ms" ? "Kod Pengesahan" : "Verification Code"}
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100"
                placeholder="123456"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading
                  ? lang === "ms" ? "Mengesahkan..." : "Verifying..."
                  : lang === "ms" ? "Aktifkan 2FA" : "Enable 2FA"}
              </button>
              <button
                type="button"
                onClick={() => { setQrCode(""); setSecret(""); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              >
                {lang === "ms" ? "Batal" : "Cancel"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {lang === "ms"
                ? "Aktifkan 2FA untuk meningkatkan keselamatan akaun anda. Anda akan memerlukan kod dari aplikasi pengesah setiap kali log masuk."
                : "Enable 2FA to increase your account security. You will need a code from an authenticator app every time you log in."}
            </p>
            <button
              onClick={handleSetup}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? lang === "ms" ? "Memuat..." : "Loading..."
                : lang === "ms" ? "Aktifkan 2FA" : "Enable 2FA"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
