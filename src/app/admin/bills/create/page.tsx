"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Unit {
  id: string;
  block: string;
  floor: string;
  unitNo: string;
  ownerName: string;
  monthlyFee: number;
}

export default function CreateBillPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [monthYear, setMonthYear] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [additionalFee, setAdditionalFee] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [adjustment, setAdjustment] = useState("0");
  const [penaltyAmount, setPenaltyAmount] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/units?limit=1000")
      .then((r) => r.json())
      .then((data) => setUnits(data.units || []));
  }, []);

  const selectedUnit = units.find((u) => u.id === unitId);
  const totalAmount =
    Number(baseAmount || 0) +
    Number(additionalFee || 0) -
    Number(discount || 0) +
    Number(adjustment || 0) +
    Number(penaltyAmount || 0);

  useEffect(() => {
    if (selectedUnit && !baseAmount) {
      setBaseAmount(String(selectedUnit.monthlyFee));
    }
  }, [selectedUnit, baseAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId,
        monthYear,
        baseAmount: Number(baseAmount),
        dueDate: new Date(dueDate).toISOString(),
        additionalFee: Number(additionalFee),
        discount: Number(discount),
        adjustment: Number(adjustment),
        penaltyAmount: Number(penaltyAmount),
      }),
    });

    setLoading(false);
    if (res.ok) {
      window.location.href = "/admin/bills";
    } else {
      const data = await res.json();
      setError(data.error || "Gagal menjana bil");
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href="/admin/bills"
        className="text-blue-600 text-sm hover:underline mb-4 inline-block"
      >
        ← Kembali ke Bil
      </Link>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Jana Bil Baru</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div>
          <label className="block text-sm font-medium mb-1">Unit</label>
          <select
            required
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Pilih unit...</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.block}-{u.floor}-{u.unitNo} — {u.ownerName} (RM {u.monthlyFee.toFixed(2)})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Bulan-Tahun</label>
            <input
              required
              type="month"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tarikh Akhir</label>
            <input
              required
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah Asas (RM)</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Yuran Tambahan (RM)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={additionalFee}
              onChange={(e) => setAdditionalFee(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Diskaun (RM)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pelarasan (RM)</label>
            <input
              type="number"
              step="0.01"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Penalti (RM)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={penaltyAmount}
            onChange={(e) => setPenaltyAmount(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="border-t pt-4">
          <p className="text-lg font-bold text-gray-800">
            Jumlah Keseluruhan: RM {totalAmount.toFixed(2)}
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/admin/bills"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Menjana..." : "Jana Bil"}
          </button>
        </div>
      </form>
    </div>
  );
}
