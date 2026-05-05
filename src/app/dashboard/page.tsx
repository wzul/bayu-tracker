"use client";

import { useState, useEffect, useCallback } from "react";
import { fmtMYT, fmtMonthYear } from "@/lib/date";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

interface Bill {
  id: string;
  uuid: string;
  monthYear: string;
  baseAmount: number;
  additionalFee: number;
  totalAmount: number;
  dueDate: string;
  status: string;
  chipBillId: string | null;
}

interface Unit {
  block: string;
  floor: string;
  unitNo: string;
  ownerName: string;
  monthlyFee: number;
}

export default function ResidentDashboard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPayLoading, setBulkPayLoading] = useState(false);
  const [gatewayFeeFixed, setGatewayFeeFixed] = useState(0);
  const [gatewayFeePercent, setGatewayFeePercent] = useState(0);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterUuid, setFilterUuid] = useState("");
  const { lang } = useLanguage();

  const fetchBills = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterMonth) params.set("monthYear", filterMonth);
    if (filterUuid) params.set("uuid", filterUuid.trim().toLowerCase());
    const res = await fetch(`/api/dashboard/bills?${params}`);
    const data = await res.json();
    setBills(data.bills || []);
    setGatewayFeeFixed(Number(data.gatewayFeeFixed ?? 0));
    setGatewayFeePercent(Number(data.gatewayFeePercent ?? 0));
    setSelected(new Set());
  }, [filterStatus, filterMonth, filterUuid]);

  useEffect(() => {
    fetch("/api/dashboard/profile")
      .then(r => r.json())
      .then(data => {
        if (data.unit) setUnit(data.unit);
      });
  }, []);

  // Debounced auto-search: 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBills();
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchBills]);

  const pendingBills = bills.filter(b => b.status === "PENDING" || b.status === "OVERDUE");
  const paidBills = bills.filter(b => b.status === "PAID");
  const selectedBills = pendingBills.filter(b => selected.has(b.id));
  const selectedBaseTotal = selectedBills.reduce((s, b) => s + Number(b.totalAmount) - Number(b.additionalFee), 0);
  const selectedPercentFee = selectedBaseTotal * (gatewayFeePercent / 100);
  const selectedFixedFee = selected.size > 0 ? gatewayFeeFixed / 100 : 0;
  const selectedTotalWithFee = selectedBaseTotal + selectedPercentFee + selectedFixedFee;

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === pendingBills.length && pendingBills.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingBills.map(b => b.id)));
    }
  };

  const handleBulkPay = async () => {
    if (selectedBills.length === 0) return;
    setBulkPayLoading(true);
    const res = await fetch("/api/dashboard/pay-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billIds: Array.from(selected) }),
    });
    const data = await res.json();
    setBulkPayLoading(false);
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      alert(data.error || (lang === "ms" ? "Gagal memulakan pembayaran pukal" : "Failed to start bulk payment"));
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-600 dark:text-gray-300">{t("loading", lang)}</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t("dashboard", lang)}</h1>
        {unit && (
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t("unit", lang)} {unit.block}-{unit.floor}-{unit.unitNo} | {unit.ownerName}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("pendingBills", lang)}</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{pendingBills.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("totalDue", lang)}</p>
          <p className="text-3xl font-bold text-red-600">
            RM {pendingBills.reduce((s,b)=>s+Number(b.totalAmount),0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("paidBills", lang)}</p>
          <p className="text-3xl font-bold text-green-600">{paidBills.length}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t("bills", lang)}</h2>
        {pendingBills.length > 0 && (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.size === pendingBills.length && pendingBills.length > 0}
                onChange={selectAll}
              />
              {t("selectAll", lang)}
            </label>
            {selected.size > 0 && (
              <button
                onClick={handleBulkPay}
                disabled={bulkPayLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {bulkPayLoading
                  ? t("loading", lang)
                  : t("paySelected", lang, { count: String(selected.size), amount: selectedTotalWithFee.toFixed(2) })}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4 flex gap-3 flex-wrap">
        <input
          type="text"
          value={filterUuid}
          onChange={(e) => setFilterUuid(e.target.value)}
          placeholder={lang === "ms" ? "No. Rujukan (7 aksara)" : "Ref No. (7 chars)"}
          className="px-3 py-2 border rounded-lg text-sm w-40 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100"
          maxLength={7}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100">
          <option value="">{lang === "ms" ? "Semua Status" : "All Status"}</option>
          <option value="PENDING">{t("statusPending", lang)}</option>
          <option value="PAID">{t("statusPaid", lang)}</option>
          <option value="OVERDUE">{t("statusOverdue", lang)}</option>
        </select>
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100"
        />
        <button
          onClick={() => { setFilterStatus(""); setFilterMonth(""); setFilterUuid(""); }}
          className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700"
        >
          {lang === "ms" ? "Reset" : "Reset"}
        </button>
      </div>

      {selected.size > 0 && (gatewayFeeFixed > 0 || gatewayFeePercent > 0) && (
        <div className="mb-3 text-sm text-gray-500 dark:text-gray-400 text-right space-y-1">
          <div>{lang === "ms" ? "Jumlah bil:" : "Bills total:"} RM {selectedBaseTotal.toFixed(2)}</div>
          {selectedPercentFee > 0 && <div>{lang === "ms" ? "Yuran gateway (%)" : "Gateway fee (%)"}: RM {selectedPercentFee.toFixed(2)}</div>}
          {selectedFixedFee > 0 && <div>{lang === "ms" ? "Yuran gateway (tetap)" : "Gateway fee (fixed)"}: RM {selectedFixedFee.toFixed(2)}</div>}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">{lang === "ms" ? "No. Rujukan" : "Ref No."}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">{t("month", lang)}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">{t("amount", lang)}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">{t("dueDate", lang)} (MYT)</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">{t("status", lang)}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300"></th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {bills.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t("noBills", lang)}</td></tr>
            ) : bills.map(b => (
              <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-4 py-3">
                  {(b.status === "PENDING" || b.status === "OVERDUE") && (
                    <input
                      type="checkbox"
                      checked={selected.has(b.id)}
                      onChange={() => toggleSelect(b.id)}
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">{b.uuid.slice(0, 7)}</td>
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{fmtMonthYear(b.monthYear, lang)}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">RM {Number(b.totalAmount).toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{fmtMYT(b.dueDate)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    b.status === "PAID" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                    : b.status === "OVERDUE" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                  }`}>
                    {b.status === "PAID" ? t("statusPaid", lang)
                    : b.status === "OVERDUE" ? t("statusOverdue", lang)
                    : t("statusPending", lang)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {(b.status === "PENDING" || b.status === "OVERDUE") && (
                    <PayButton billId={b.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayButton({ billId }: { billId: string }) {
  const [loading, setLoading] = useState(false);
  const { lang } = useLanguage();

  const handlePay = async () => {
    setLoading(true);
    const res = await fetch("/api/dashboard/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billId }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      alert(data.error || (lang === "ms" ? "Gagal memulakan pembayaran" : "Failed to start payment"));
    }
  };

  return (
    <button onClick={handlePay} disabled={loading}
      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
      {loading ? t("loading", lang) : t("pay", lang)}
    </button>
  );
}
