"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-100 transition-colors">
      <nav className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm">
        <div className="px-8 py-3 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-6">
            <span className="font-bold text-slate-800 dark:text-gray-100">{t("condoName", lang)}</span>
            <Link href="/dashboard" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">{t("dashboard", lang)}</Link>
            <Link href="/dashboard/history" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">{t("history", lang)}</Link>
            <Link href="/dashboard/profile" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">{t("profile", lang)}</Link>
            <Link href="/dashboard/security" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">{lang === "ms" ? "Keselamatan" : "Security"}</Link>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LanguageSwitcher />
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">{t("logout", lang)}</button>
            </form>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
