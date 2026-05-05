"use client";

import { useState, useEffect } from "react";
import { fmtMYT, fmtMonthYear } from "@/lib/date";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

interface Bill {
  id: string;
  monthYear: string;
  totalAmount: number;
  status: string;
  paidAt: string | null;
  paymentMethod: string | null;
  receiptUrl: string | null;
}

export default function PaymentHistoryPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();

  useEffect(() => {
    fetch("/api/dashboard/bills")
      .then((r) => r.json())
      .then((data) => {
        setBills(data.bills || []);
        setLoading(false);
      });
  }, []);

  const paidBills = bills.filter((b) => b.status === "PAID");

  const statusColor = (s: string) => {
    if (s === "PAID") return "bg-green-100 text-green-800";
    if (s === "PENDING") return "bg-yellow-100 text-yellow-800";
    if (s === "OVERDUE") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  const methodLabel = (m: string | null) => {
    if (!m) return "-";
    if (m === "CARD") return t("methodCard", lang);
    if (m === "FPX") return t("methodFpx", lang);
    if (m === "CASH") return t("methodCash", lang);
    return m;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t("history", lang)}</h1>

      {loading ? (
        <div className="text-center text-gray-500">{t("loading", lang)}</div>
      ) : paidBills.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          {lang === "ms" ? "Tiada rekod pembayaran lagi." : "No payment records yet."}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("month", lang)}</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{t("amount", lang)}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("status", lang)}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{lang === "ms" ? "Dibayar Pada" : "Paid On"}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{lang === "ms" ? "Kaedah" : "Method"}</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{lang === "ms" ? "Resit" : "Receipt"}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paidBills.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{fmtMonthYear(b.monthYear, lang)}</td>
                  <td className="px-4 py-3 text-right">RM {Number(b.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColor(b.status)}`}>{t("statusPaid", lang)}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{fmtMYT(b.paidAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{methodLabel(b.paymentMethod)}</td>
                  <td className="px-4 py-3 text-right">
                    {b.receiptUrl ? (
                      <a href={b.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                        {lang === "ms" ? "Muat Turun" : "Download"}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
