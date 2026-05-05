"use client";

import { useState, useEffect } from "react";
import { fmtMYT } from "@/lib/date";

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

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Sejarah Pembayaran</h1>

      {loading ? (
        <div className="text-center text-gray-500">Memuat...</div>
      ) : paidBills.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          Tiada rekod pembayaran lagi.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Bulan</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Jumlah</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Dibayar Pada</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Kaedah</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Resit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paidBills.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{b.monthYear}</td>
                  <td className="px-4 py-3 text-right">RM {Number(b.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColor(b.status)}`}>{b.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{fmtMYT(b.paidAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{b.paymentMethod || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    {b.receiptUrl ? (
                      <a href={b.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                        Muat Turun
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
