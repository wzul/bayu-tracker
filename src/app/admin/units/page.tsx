"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Unit {
  id: string;
  block: string;
  floor: string;
  unitNo: string;
  ownerName: string;
  ownerIc: string;
  phone: string | null;
  monthlyFee: number;
  status: string;
  _count: { bills: number; users: number };
  users?: { email: string }[];
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [block, setBlock] = useState("");
  const [status, setStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      ...(search && { search }),
      ...(block && { block }),
      ...(status && { status }),
    });
    const res = await fetch(`/api/admin/units?${params}`);
    const data = await res.json();
    if (res.ok) {
      setUnits(data.units);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [page, search, block, status]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const handleDelete = async (id: string) => {
    if (!confirm("Padam unit ini? Tindakan ini tidak boleh dibatalkan.")) return;
    const res = await fetch(`/api/admin/units/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUnits();
    } else {
      alert("Gagal memadam unit");
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "ACTIVE": return "bg-green-100 text-green-800";
      case "INACTIVE": return "bg-gray-100 text-gray-800";
      case "TRANSFERRED": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Unit Rumah</h1>
          <p className="text-gray-500 text-sm">Senarai unit dan pemilik</p>
        </div>
        <button
          onClick={() => { setEditingUnit(null); setShowModal(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Tambah Unit
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Cari nama/IC/unit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border rounded-lg min-w-[200px]"
        />
        <select value={block} onChange={(e) => setBlock(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">Semua Blok</option>
          <option value="A">Blok A</option>
          <option value="B">Blok B</option>
          <option value="C">Blok C</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">Semua Status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="INACTIVE">Tidak Aktif</option>
          <option value="TRANSFERRED">Dipindah</option>
        </select>
        <button
          onClick={() => { setPage(1); fetchUnits(); }}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Cari
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Unit</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Pemilik</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">IC</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Yuran</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Bil</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Memuat...</td></tr>
            ) : units.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Tiada unit dijumpai</td></tr>
            ) : (
              units.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{u.block}-{u.floor}-{u.unitNo}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{u.ownerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{u.ownerIc}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">RM {Number(u.monthlyFee).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${statusColor(u.status)}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u._count.bills}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link href={`/admin/units/${u.id}`} className="text-blue-600 hover:underline text-sm">Lihat</Link>
                    <button
                      onClick={() => { setEditingUnit(u); setShowModal(true); }}
                      className="text-gray-600 hover:text-gray-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Padam
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            Sebelum
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            Muka {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            Seterusnya
          </button>
        </div>
      )}

      {/* Modal - simplified */}
      {showModal && (
        <UnitModal
          unit={editingUnit}
          onClose={() => setShowModal(false)}
          onSaved={fetchUnits}
        />
      )}
    </div>
  );
}

function UnitModal({ unit, onClose, onSaved }: {
  unit: Unit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    block: unit?.block ?? "",
    floor: unit?.floor ?? "",
    unitNo: unit?.unitNo ?? "",
    ownerName: unit?.ownerName ?? "",
    ownerIc: unit?.ownerIc ?? "",
    email: unit?.users?.[0]?.email ?? "",
    phone: unit?.phone ?? "",
    monthlyFee: unit?.monthlyFee ?? 120,
    createUser: true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const url = unit ? `/api/admin/units/${unit.id}` : "/api/admin/units";
    const method = unit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        monthlyFee: Number(form.monthlyFee),
      }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      const data = await res.json();
      alert(data.error || "Gagal menyimpan");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">{unit ? "Edit Unit" : "Tambah Unit"}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <input required placeholder="Blok" className="px-3 py-2 border rounded" value={form.block} onChange={e => setForm(f => ({ ...f, block: e.target.value }))} />
            <input required placeholder="Tingkat" className="px-3 py-2 border rounded" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} />
            <input required placeholder="No Unit" className="px-3 py-2 border rounded" value={form.unitNo} onChange={e => setForm(f => ({ ...f, unitNo: e.target.value }))} />
          </div>
          <input required placeholder="Nama Pemilik" className="w-full px-3 py-2 border rounded" value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} />
          <input required placeholder="No KP" className="w-full px-3 py-2 border rounded" value={form.ownerIc} onChange={e => setForm(f => ({ ...f, ownerIc: e.target.value }))} />
          <input required type="email" placeholder="Emel Pengguna" className="w-full px-3 py-2 border rounded" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <input placeholder="Telefon" className="w-full px-3 py-2 border rounded" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <input required type="number" min="0" step="0.01" placeholder="Yuran Bulanan" className="w-full px-3 py-2 border rounded" value={form.monthlyFee} onChange={e => setForm(f => ({ ...f, monthlyFee: Number(e.target.value) }))} />
          {!unit && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.createUser} onChange={e => setForm(f => ({ ...f, createUser: e.target.checked }))} />
              <span className="text-sm text-gray-600">Cipta akaun pengguna (password: resident123)</span>
            </label>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
