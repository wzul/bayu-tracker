"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b shadow-sm">
        <div className="px-8 py-3 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-6">
            <span className="font-bold text-slate-800">{t("condoName", lang)}</span>
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-800">{t("dashboard", lang)}</Link>
            <Link href="/dashboard/history" className="text-sm text-gray-600 hover:text-gray-800">{t("history", lang)}</Link>
            <Link href="/dashboard/profile" className="text-sm text-gray-600 hover:text-gray-800">{t("profile", lang)}</Link>
            <Link href="/dashboard/security" className="text-sm text-gray-600 hover:text-gray-800">{lang === "ms" ? "Keselamatan" : "Security"}</Link>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-sm text-gray-600 hover:text-gray-800">{t("logout", lang)}</button>
            </form>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
