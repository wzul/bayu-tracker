"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [code, setCode] = useState("");
  const router = useRouter();
  const { lang } = useLanguage();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("loginFailed", lang));
        return;
      }

      if (data.requires2FA) {
        setRequires2FA(true);
        return;
      }

      if (data.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError(t("serverError", lang));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, code, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("loginFailed", lang));
        return;
      }

      if (data.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
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

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
        )}

        {requires2FA ? (
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {lang === "ms" ? "Kod 2FA" : "2FA Code"}
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123456"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? lang === "ms" ? "Mengesahkan..." : "Verifying..."
                : lang === "ms" ? "Sahkan" : "Verify"}
            </button>

            <button
              type="button"
              onClick={() => setRequires2FA(false)}
              className="w-full text-sm text-blue-600 hover:underline"
            >
              {lang === "ms" ? "← Kembali" : "← Back"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
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
              <label className="block text-sm font-medium mb-1">{t("password", lang)}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="remember" className="text-sm">{t("rememberMe", lang)}</label>
              </div>
              <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                {lang === "ms" ? "Lupa kata laluan?" : "Forgot password?"}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t("loggingIn", lang) : t("login", lang)}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
