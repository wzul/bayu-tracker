"use client";

import { useState } from "react";
import Link from "next/link";

export default function ImportUnitsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; total: number } | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/units/import", {
      method: "POST",
      body: formData,
    });

    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setResult(data);
    } else {
      const data = await res.json();
      setError(data.error || "Import gagal");
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/admin/units" className="text-blue-600 text-sm hover:underline mb-4 inline-block">
        ← Kembali ke Unit
      </Link>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Import Unit (CSV)</h1>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
      {result && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          Import selesai: {result.created} unit diimport, {result.skipped} dilangkau (jumlah: {result.total})
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-2">Format CSV</h2>
        <p className="text-sm text-gray-500 mb-2">
          Header mesti mengandungi: block, floor, unitNo, ownerName, ownerIc, email, phone, monthlyFee
        </p>
        <code className="block bg-gray-100 p-2 rounded text-sm text-gray-700">
          block,floor,unitNo,ownerName,ownerIc,email,phone,monthlyFee
          <br />
          A,1,01,Ahmad Ali,800101-01-1234,ahmad@test.com,0123456789,120.00
        </code>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <input
          type="file"
          accept=".csv"
          required
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full"
        />
        <div className="flex justify-end gap-3">
          <Link href="/admin/units" className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Batal
          </Link>
          <button
            type="submit"
            disabled={loading || !file}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Mengimport..." : "Import"}
          </button>
        </div>
      </form>
    </div>
  );
}
