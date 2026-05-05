"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Sidebar() {
  const pathname = usePathname();
  const { lang } = useLanguage();

  const menuItems = [
    { href: "/admin", label: t("dashboard", lang), icon: "📊" },
    { href: "/admin/units", label: t("units", lang), icon: "🏠" },
    { href: "/admin/bills", label: t("bills", lang), icon: "🧾" },
    { href: "/admin/payments", label: t("payments", lang), icon: "💰" },
    { href: "/admin/reports", label: t("reports", lang), icon: "📈" },
    { href: "/admin/settings", label: t("settings", lang), icon: "⚙️" },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">🏢 {t("condoName", lang)}</h1>
        <p className="text-sm text-slate-400 mt-1">{t("condoSubtitle", lang)}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700 space-y-2">
        <LanguageSwitcher />
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span>🚪</span>
            <span>{t("logout", lang)}</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
