"use client";

import { useState } from "react";
import Link from "next/link";

export default function UnitTransferPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState({
    newOwnerName: "",
    newOwnerIc: "",
    newEmail: "",
    newPhone: "",
    transferDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const res = await fetch(`/api/admin/units/${params.id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        transferDate: new Date(form.transferDate).toISOString(),
      }),
    });

    setLoading(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      const data = await res.json();
      setError(data.error || "Gagal memindahkan unit");
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <Link href={`/admin/units/${params.id}`} className="text-blue-600 text-sm hover:underline mb-4 inline-block">
        ← Kembali ke Unit
      </Link>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Pindah Milik Unit</h1>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          Unit berjaya dipindah. Akaun pengguna baharu telah dicipta dengan kata laluan: resident123
          <div className="mt-2">
            <Link href={`/admin/units/${params.id}`} className="text-blue-600 hover:underline text-sm">
              Lihat unit →
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Pemilik Baru</label>
            <input
              required
              className="w-full px-3 py-2 border rounded-lg"
              value={form.newOwnerName}
              onChange={(e) => setForm({ ...form, newOwnerName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">No KP Baru</label>
            <input
              required
              className="w-full px-3 py-2 border rounded-lg"
              value={form.newOwnerIc}
              onChange={(e) => setForm({ ...form, newOwnerIc: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email Baru</label>
            <input
              required
              type="email"
              className="w-full px-3 py-2 border rounded-lg"
              value={form.newEmail}
              onChange={(e) => setForm({ ...form, newEmail: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Telefon Baru</label>
            <input
              className="w-full px-3 py-2 border rounded-lg"
              value={form.newPhone}
              onChange={(e) => setForm({ ...form, newPhone: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tarikh Pindah Milik</label>
          <input
            required
            type="date"
            className="w-full px-3 py-2 border rounded-lg"
            value={form.transferDate}
            onChange={(e) => setForm({ ...form, transferDate: e.target.value })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Jika tarikh bukan 1hb bulan, bil prorata akan dijana untuk kedua-dua pemilik.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link href={`/admin/units/${params.id}`} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Batal
          </Link>
          <button
            type="submit"
            disabled={loading || success}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Pindah Milik"}
          </button>
        </div>
      </form>
    </div>
  );
}
