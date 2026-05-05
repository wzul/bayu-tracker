"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";
import { fmtMYT, fmtMYTFull, fmtMonthYear } from "@/lib/date";

interface Payment {
  id: string;
  monthYear: string;
  totalAmount: number;
  paidAt: string | null;
  paymentMethod: string | null;
  chipTransactionId: string | null;
  receiptNo: string | null;
  receiptUrl: string | null;
  unit: { block: string; floor: string; unitNo: string; ownerName: string };
}

export default function PaymentsPage() {
  const { lang } = useLanguage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [monthYear, setMonthYear] = useState("");
  const [method, setMethod] = useState("");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState({ count: 0, totalAmount: 0 });

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      ...(monthYear && { monthYear }),
      ...(method && { method }),
      ...(search && { search }),
    });
    const res = await fetch(`/api/admin/payments?${params}`);
    const data = await res.json();
    if (res.ok) {
      setPayments(data.payments || []);
      setTotalPages(data.totalPages || 1);
      setSummary(data.summary || { count: 0, totalAmount: 0 });
    }
    setLoading(false);
  }, [page, monthYear, method, search]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const methodLabel = (m: string | null) => {
    if (m === "CARD") return t("methodCard", lang);
    if (m === "FPX") return t("methodFpx", lang);
    if (m === "CASH") return t("methodCash", lang);
    return m || "-";
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t("payments", lang)}</h1>
        <p className="text-gray-500 text-sm">{t("paidBills", lang)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">{t("totalPayments", lang)}</p>
          <p className="text-2xl font-bold text-gray-800">{summary.count}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">{t("totalCollected", lang)}</p>
          <p className="text-2xl font-bold text-green-600">RM {Number(summary.totalAmount).toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search", lang) + "..."}
          className="px-3 py-2 border rounded-lg"
        />
        <input
          type="month"
          value={monthYear}
          onChange={(e) => setMonthYear(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        />
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">{t("all", lang)}</option>
          <option value="CARD">{t("methodCard", lang)}</option>
          <option value="FPX">{t("methodFpx", lang)}</option>
          <option value="CASH">{t("methodCash", lang)}</option>
        </select>
        <button onClick={() => { setPage(1); fetchPayments(); }} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
          {t("search", lang)}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("unit", lang)}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("month", lang)}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{t("amount", lang)}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("paymentMethod", lang)}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("paymentDate", lang)}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">CHIP ID</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{t("receipt", lang)}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">{t("loading", lang)}</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">{t("noPayments", lang)}</td></tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{p.unit.block}-{p.unit.floor}-{p.unit.unitNo}</div>
                    <div className="text-xs text-gray-500">{p.unit.ownerName}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{fmtMonthYear(p.monthYear, lang)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">RM {Number(p.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm">{methodLabel(p.paymentMethod)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.paidAt ? fmtMYTFull(p.paidAt) : "-"}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{p.chipTransactionId || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    {p.receiptUrl ? (
                      <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                        {t("view", lang)}
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            {t("previous", lang)}
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            {t("page", lang)} {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            {t("next", lang)}
          </button>
        </div>
      )}
    </div>
  );
}
