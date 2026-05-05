"use client";

import { useState, useEffect } from "react";
import { fmtMYT, fmtMonthYear } from "@/lib/date";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

interface Bill {
  id: string;
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
  const { lang } = useLanguage();

  useEffect(() => {
    fetch("/api/dashboard/profile")
      .then(r => r.json())
      .then(data => {
        if (data.unit) setUnit(data.unit);
        return fetch("/api/dashboard/bills");
      })
      .then(r => r.json())
      .then(data => {
        setBills(data.bills || []);
        setGatewayFeeFixed(Number(data.gatewayFeeFixed ?? 0));
        setGatewayFeePercent(Number(data.gatewayFeePercent ?? 0));
        setLoading(false);
      });
  }, []);

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

  if (loading) return <div className="p-8 text-center">{t("loading", lang)}</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">{t("dashboard", lang)}</h1>
        {unit && (
          <p className="text-gray-500 mt-1">{t("unit", lang)} {unit.block}-{unit.floor}-{unit.unitNo} | {unit.ownerName}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">{t("pendingBills", lang)}</p>
          <p className="text-3xl font-bold text-gray-800">{pendingBills.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">{t("totalDue", lang)}</p>
          <p className="text-3xl font-bold text-red-600">
            RM {pendingBills.reduce((s,b)=>s+Number(b.totalAmount),0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">{t("paidBills", lang)}</p>
          <p className="text-3xl font-bold text-green-600">{paidBills.length}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t("bills", lang)}</h2>
        {pendingBills.length > 0 && (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
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

      {selected.size > 0 && (gatewayFeeFixed > 0 || gatewayFeePercent > 0) && (
        <div className="mb-3 text-sm text-gray-500 text-right space-y-1">
          <div>{lang === "ms" ? "Jumlah bil:" : "Bills total:"} RM {selectedBaseTotal.toFixed(2)}</div>
          {selectedPercentFee > 0 && <div>{lang === "ms" ? "Yuran gateway (%)" : "Gateway fee (%)"}: RM {selectedPercentFee.toFixed(2)}</div>}
          {selectedFixedFee > 0 && <div>{lang === "ms" ? "Yuran gateway (tetap)" : "Gateway fee (fixed)"}: RM {selectedFixedFee.toFixed(2)}</div>}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("month", lang)}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{t("amount", lang)}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("dueDate", lang)} (MYT)</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("status", lang)}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bills.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">{t("noBills", lang)}</td></tr>
            ) : bills.map(b => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {(b.status === "PENDING" || b.status === "OVERDUE") && (
                    <input
                      type="checkbox"
                      checked={selected.has(b.id)}
                      onChange={() => toggleSelect(b.id)}
                    />
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{fmtMonthYear(b.monthYear, lang)}</td>
                <td className="px-4 py-3 text-right">RM {Number(b.totalAmount).toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{fmtMYT(b.dueDate)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    b.status === "PAID" ? "bg-green-100 text-green-800"
                    : b.status === "OVERDUE" ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {b.status === "PAID" ? t("statusPaid", lang)
                    : b.status === "OVERDUE" ? t("statusOverdue", lang)
                    : t("statusPending", lang)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {(b.status === "PENDING" || b.status === "OVERDUE") && (
                    <PayButton billId={b.id} amount={b.totalAmount} />
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

function PayButton({ billId, amount }: { billId: string; amount: number }) {
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
