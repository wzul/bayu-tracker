"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { fmtMYT, fmtMonthYear } from "@/lib/date";
import { useLanguage } from "@/components/LanguageProvider";

interface Bill {
  id: string;
  uuid: string;
  monthYear: string;
  totalAmount: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
  paymentMethod: string | null;
  unit: { block: string; floor: string; unitNo: string; ownerName: string };
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("");
  const [monthYear, setMonthYear] = useState("");
  const [uuidQuery, setUuidQuery] = useState("");
  const { lang } = useLanguage();

  const fetchBills = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      ...(status && { status }),
      ...(monthYear && { monthYear }),
      ...(uuidQuery.trim() && { uuid: uuidQuery.trim().toLowerCase() }),
    });
    const res = await fetch(`/api/admin/bills?${params}`);
    const data = await res.json();
    if (res.ok) {
      setBills(data.bills);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [page, status, monthYear, uuidQuery]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const handleDelete = async (id: string) => {
    if (!confirm("Padam bil ini?")) return;
    const res = await fetch(`/api/admin/bills/${id}`, { method: "DELETE" });
    if (res.ok) fetchBills();
    else alert("Gagal memadam");
  };

  const handleMarkPaid = async (id: string) => {
    const res = await fetch(`/api/admin/bills/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString(), paymentMethod: "CASH" }),
    });
    if (res.ok) fetchBills();
    else alert("Gagal kemaskini");
  };

  const statusColor = (s: string) => {
    if (s === "PAID") return "bg-green-100 text-green-800";
    if (s === "PENDING") return "bg-yellow-100 text-yellow-800";
    if (s === "OVERDUE") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bil Bulanan</h1>
          <p className="text-gray-500 text-sm">Urus bil dan pembayaran</p>
        </div>
        <Link href="/admin/bills/create" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">+ Jana Bil</Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex gap-3 flex-wrap">
        <input
          type="text"
          value={uuidQuery}
          onChange={(e) => { setUuidQuery(e.target.value); setPage(1); }}
          placeholder="No. Rujukan (7 aksara)"
          className="px-3 py-2 border rounded-lg text-sm w-40"
          maxLength={7}
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg">
          <option value="">Semua Status</option>
          <option value="PENDING">Tertunggak</option>
          <option value="PAID">Lunas</option>
          <option value="OVERDUE">Lewat</option>
        </select>
        <input type="month" value={monthYear} onChange={(e) => { setMonthYear(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg" placeholder="YYYY-MM" />
        <button onClick={() => { setPage(1); fetchBills(); }} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Cari</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">No. Ruj</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Unit</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Bulan</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Jumlah</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tarikh Akhir</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Memuat...</td></tr>)
              : bills.length === 0 ? (<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Tiada bil</td></tr>)
              : bills.map((b) => (<tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-gray-500">{b.uuid.slice(0, 7)}</td>
                <td className="px-4 py-3"><div className="text-sm font-medium">{b.unit.block}-{b.unit.floor}-{b.unit.unitNo}</div><div className="text-xs text-gray-500">{b.unit.ownerName}</div></td>
                <td className="px-4 py-3 text-sm">{fmtMonthYear(b.monthYear, lang)}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">RM {Number(b.totalAmount).toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{fmtMYT(b.dueDate)}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${statusColor(b.status)}`}>{b.status}</span></td>
                <td className="px-4 py-3 text-right space-x-2">
                  {b.status === "PENDING" && <button onClick={() => handleMarkPaid(b.id)} className="text-green-600 hover:underline text-sm">Tandai Lunas</button>}
                  <button onClick={() => handleDelete(b.id)} className="text-red-600 hover:underline text-sm">Padam</button>
                </td>
              </tr>)
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (<div className="flex justify-center gap-2 mt-6">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50">Sebelum</button>
        <span className="px-3 py-1 text-sm text-gray-600">Muka {page} / {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50">Seterusnya</button>
      </div>)}
    </div>
  );
}
