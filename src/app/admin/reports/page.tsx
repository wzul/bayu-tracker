"use client";

import { useState, useEffect } from "react";

interface ReportData {
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: string;
  pendingCount: number;
  paidCount: number;
  overdueCount: number;
  byBlock: Record<string, { expected: number; collected: number }>;
  byMethod: Record<string, number>;
  monthYear: string;
}

export default function ReportsPage() {
  const [monthYear, setMonthYear] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonthYear(defaultMonth);
    fetchReport(defaultMonth);
  }, []);

  const fetchReport = async (month: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/reports?monthYear=${month}`);
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  };

  const handleExport = () => {
    if (!data) return;
    const csv = [
      ["Bulan", "Jumlah Dijangka", "Jumlah Dikutip", "Tertunggak", "Kadar Kutipan %"],
      [data.monthYear, data.totalExpected, data.totalCollected, data.totalOutstanding, data.collectionRate],
      [],
      ["Blok", "Dijangka", "Dikutip"],
      ...Object.entries(data.byBlock).map(([block, v]) => [block, v.expected, v.collected]),
      [],
      ["Kaedah", "Jumlah"],
      ...Object.entries(data.byMethod).map(([method, v]) => [method, v]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${data.monthYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Laporan Kutipan</h1>
          <p className="text-gray-500 text-sm">Ringkasan kutipan mengikut bulan</p>
        </div>
        <button
          onClick={handleExport}
          disabled={!data}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          Eksport CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex gap-3">
        <input
          type="month"
          value={monthYear}
          onChange={(e) => { setMonthYear(e.target.value); fetchReport(e.target.value); }}
          className="px-3 py-2 border rounded-lg"
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-500">Memuat...</div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-sm text-gray-500">Jumlah Dijangka</p>
              <p className="text-2xl font-bold">RM {data.totalExpected.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-sm text-gray-500">Jumlah Dikutip</p>
              <p className="text-2xl font-bold text-green-600">RM {data.totalCollected.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-sm text-gray-500">Tertunggak</p>
              <p className="text-2xl font-bold text-red-600">RM {data.totalOutstanding.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-sm text-gray-500">Kadar Kutipan</p>
              <p className="text-2xl font-bold text-blue-600">{data.collectionRate}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Mengikut Blok</h2>
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 text-sm text-gray-500">Blok</th>
                    <th className="text-right py-2 text-sm text-gray-500">Dijangka</th>
                    <th className="text-right py-2 text-sm text-gray-500">Dikutip</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(data.byBlock).map(([block, v]) => (
                    <tr key={block}>
                      <td className="py-2">{block}</td>
                      <td className="py-2 text-right">RM {v.expected.toFixed(2)}</td>
                      <td className="py-2 text-right">RM {v.collected.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Mengikut Kaedah</h2>
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 text-sm text-gray-500">Kaedah</th>
                    <th className="text-right py-2 text-sm text-gray-500">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(data.byMethod).map(([method, v]) => (
                    <tr key={method}>
                      <td className="py-2">{method}</td>
                      <td className="py-2 text-right">RM {Number(v).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
