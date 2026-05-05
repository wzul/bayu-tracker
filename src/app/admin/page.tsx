"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

interface DashboardStats {
  totalUnits: number;
  activeUnits: number;
  totalBills: number;
  pendingBills: number;
  paidBills: number;
  overdueBills: number;
  totalUsers: number;
  totalCollected: number;
}

export default function AdminDashboard() {
  const { lang } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard-stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center">{t("loading", lang)}</div>;
  if (!stats) return <div className="p-8 text-center text-red-600">{t("error", lang)}</div>;

  const statCards = [
    { label: t("totalUnits", lang), value: stats.totalUnits, active: stats.activeUnits, color: "bg-blue-500", href: "/admin/units" },
    { label: t("pendingBills", lang), value: stats.pendingBills, color: "bg-yellow-500", href: "/admin/bills" },
    { label: t("paidBills", lang), value: stats.paidBills, color: "bg-green-500", href: "/admin/bills" },
    { label: t("overdueBills", lang), value: stats.overdueBills, color: "bg-red-500", href: "/admin/bills" },
    { label: t("totalUsers", lang), value: stats.totalUsers, color: "bg-purple-500", href: "#" },
    { label: t("collection", lang), value: `RM ${stats.totalCollected.toFixed(2)}`, color: "bg-emerald-500", href: "/admin/payments" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">{t("dashboard", lang)}</h1>
        <p className="text-gray-500 mt-1">{t("overview", lang)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stat.value}</p>
                {stat.active !== undefined && (
                  <p className="text-xs text-green-600 mt-1">{stat.active} {t("activeUnits", lang)}</p>
                )}
              </div>
              <div className={`w-12 h-12 rounded-lg ${stat.color} bg-opacity-20 flex items-center justify-center`>
                <div className={`w-4 h-4 rounded-full ${stat.color}`}></div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{t("quickActions", lang)}</h2>
        <div className="flex gap-3">
          <Link
            href="/admin/units"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t("manageUnits", lang)}
          </Link>
          <Link
            href="/admin/bills"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            {t("generateBills", lang)}
          </Link>
          <Link
            href="/admin/settings"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            {t("settings", lang)}
          </Link>
        </div>
      </div>
    </div>
  );
}
