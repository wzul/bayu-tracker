"use client";

import { useState, useEffect } from "react";
import { fmtMYTFull } from "@/lib/date";

interface AuditLog {
  id: string;
  action: string;
  actorId: string | null;
  actorType: string;
  targetId: string | null;
  details: any;
  createdAt: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [action, setAction] = useState("");

  useEffect(() => {
    fetchLogs();
  }, [page, action]);

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
      ...(action && { action }),
    });
    const res = await fetch(`/api/admin/audit?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
    }
    setLoading(false);
  };

  const handleExport = () => {
    const csv = [
      ["Timestamp", "Action", "Actor Type", "Actor ID", "Target ID", "Details"],
      ...logs.map((l) => [
        fmtMYTFull(l.createdAt),
        l.action,
        l.actorType,
        l.actorId || "",
        l.targetId || "",
        JSON.stringify(l.details || {}),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Audit Log</h1>
          <p className="text-gray-500 text-sm">Rekod tindakan sistem</p>
        </div>
        <button
          onClick={handleExport}
          disabled={logs.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          Eksport CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex gap-3">
        <input
          type="text"
          placeholder="Filter action..."
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg min-w-[200px]"
        />
        <button onClick={fetchLogs} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
          Cari
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Timestamp</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Action</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actor</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Target</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Memuat...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Tiada rekod</td></tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{fmtMYTFull(l.createdAt)}</td>
                  <td className="px-4 py-3 text-sm font-medium">{l.action}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{l.actorType} {l.actorId ? `(${l.actorId.slice(0, 8)}...)` : ""}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{l.targetId ? l.targetId.slice(0, 8) + "..." : "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{JSON.stringify(l.details || {})}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50">Sebelum</button>
          <span className="px-3 py-1 text-sm text-gray-600">Muka {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50">Seterusnya</button>
        </div>
      )}
    </div>
  );
}
