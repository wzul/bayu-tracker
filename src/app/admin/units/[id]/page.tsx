"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtMYT } from "@/lib/date";

interface Bill {
  id: string;
  monthYear: string;
  totalAmount: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
  paymentMethod: string | null;
}

interface Unit {
  id: string;
  block: string;
  floor: string;
  unitNo: string;
  ownerName: string;
  ownerIc: string;
  email: string;
  phone: string | null;
  monthlyFee: number;
  status: string;
  bills: Bill[];
  users: { id: string; email: string; role: string }[];
}

export default function UnitDetailPage({ params }: { params: { id: string } }) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/units/${params.id}`)
      .then(r => r.json())
      .then(data => { setUnit(data); setLoading(false); });
  }, [params.id]);

  if (loading) return <div className="p-8 text-center">Memuat...</div>;
  if (!unit) return <div className="p-8 text-center text-red-600">Unit tidak dijumpai</div>;

  const statusColor = (s: string) => {
    switch (s) {
      case "PAID": return "bg-green-100 text-green-800";
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "OVERDUE": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/admin/units" className="text-blue-600 text-sm hover:underline mb-4 inline-block">← Kembali ke Senarai</Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Unit {unit.block}-{unit.floor}-{unit.unitNo}</h1>
            <span className={`inline-block mt-2 px-3 py-1 text-sm rounded-full ${unit.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
              {unit.status}
            </span>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-800">RM {Number(unit.monthlyFee).toFixed(2)}</p>
            <p className="text-sm text-gray-500">Yuran Bulanan</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 border-t pt-6">
          <div><p className="text-sm text-gray-500">Nama</p><p className="font-medium">{unit.ownerName}</p></div>
          <div><p className="text-sm text-gray-500">No KP</p><p className="font-medium">{unit.ownerIc}</p></div>
          <div><p className="text-sm text-gray-500">Email</p><p className="font-medium">{unit.email}</p></div>
          <div><p className="text-sm text-gray-500">Telefon</p><p className="font-medium">{unit.phone || "-"}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Sejarah Bil</h2>
        {unit.bills.length === 0 ? (
          <p className="text-gray-500">Tiada rekod bil</p>
        ) : (
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 text-sm text-gray-500">Bulan</th>
                <th className="text-right py-2 text-sm text-gray-500">Jumlah</th>
                <th className="text-left py-2 text-sm text-gray-500 px-4">Tarikh Akhir</th>
                <th className="text-left py-2 text-sm text-gray-500">Status</th>
                <th className="text-left py-2 text-sm text-gray-500">Bayar Pada</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {unit.bills.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="py-3 text-sm font-medium">{b.monthYear}</td>
                  <td className="py-3 text-sm text-right text-gray-700">RM {Number(b.totalAmount).toFixed(2)}</td>
                  <td className="py-3 text-sm text-gray-500 px-4">{fmtMYT(b.dueDate)}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColor(b.status)}`}>{b.status}</span>
                  </td>
                  <td className="py-3 text-sm text-gray-500">{fmtMYT(b.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
