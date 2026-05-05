"use client";

import { useState, useEffect } from "react";
import { fmtMYT } from "@/lib/date";

interface ReconRow {
  id: string;
  monthYear: string;
  receiptNo: string | null;
  unit: string;
  ownerName: string;
  amount: number;
  paymentMethod: string | null;
  chipTransactionId: string | null;
  paidAt: string | null;
  settledAt: string | null;
  settled: boolean;
}

export default function ReconciliationPage() {
  const [monthYear, setMonthYear] = useState("");
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [totals, setTotals] = useState({ card: 0, fpx: 0, cash: 0, grandTotal: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonthYear(defaultMonth);
    fetchData(defaultMonth);
  }, []);

  const fetchData = async (month: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/reports/reconciliation?monthYear=${month}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows || []);
      setTotals(data.totals || { card: 0, fpx: 0, cash: 0, grandTotal: 0 });
    }
    setLoading(false);
  };

  const handleExport = () => {
    const csv = [
      ["Bulan", "Resit", "Unit", "Nama", "Jumlah", "Kaedah", "CHIP ID", "Dibayar", "Settlement", "Diselesaikan"],
      ...rows.map((r) => [
        r.monthYear,
        r.receiptNo || "",
        r.unit,
        r.ownerName,
        r.amount,
        r.paymentMethod || "",
        r.chipTransactionId || "",
        r.paidAt ? fmtMYT(r.paidAt) : "",
        r.settledAt ? fmtMYT(r.settledAt) : "",
        r.settled ? "Ya" : "Tidak",
      ]),
      [],
      ["Jumlah", "", "", "", totals.grandTotal, "", "", "", "", ""],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-${monthYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Penyata Bank Reconciliation</h1>
          <p className="text-gray-500 text-sm">Padankan pembayaran dengan settlement CHIP</p>
        </div>
        <button
          onClick={handleExport}
          disabled={rows.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          Eksport CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex gap-3">
        <input
          type="month"
          value={monthYear}
          onChange={(e) => { setMonthYear(e.target.value); fetchData(e.target.value); }}
          className="px-3 py-2 border rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Jumlah Keseluruhan</p>
          <p className="text-2xl font-bold">RM {totals.grandTotal.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Kad (Auto-Debit)</p>
          <p className="text-2xl font-bold text-blue-600">RM {totals.card.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">FPX</p>
          <p className="text-2xl font-bold text-purple-600">RM {totals.fpx.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Tunai</p>
          <p className="text-2xl font-bold text-yellow-600">RM {totals.cash.toFixed(2)}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">Memuat...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Unit</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nama</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Jumlah</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Kaedah</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Dibayar</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Settlement</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">CHIP ID</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Tiada rekod pembayaran untuk bulan ini
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${!r.settled ? "bg-yellow-50" : ""}`}>
                    <td className="px-4 py-3 text-sm">{r.unit}</td>
                    <td className="px-4 py-3 text-sm">{r.ownerName}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">RM {r.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">{r.paymentMethod || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{fmtMYT(r.paidAt)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 text-xs rounded-full ${r.settled ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                        {r.settled ? "Ya" : "Belum"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{r.chipTransactionId || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
