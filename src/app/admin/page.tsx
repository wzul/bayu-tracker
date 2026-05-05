import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";

export default async function AdminDashboard() {
  await requireAdmin();

  const [totalUnits, activeUnits, totalBills, pendingBills, paidBills, overdueBills, totalUsers, totalCollected] = await Promise.all([
    db.unit.count(),
    db.unit.count({ where: { status: "ACTIVE" } }),
    db.bill.count(),
    db.bill.count({ where: { status: "PENDING" } }),
    db.bill.count({ where: { status: "PAID" } }),
    db.bill.count({ where: { status: "OVERDUE" } }),
    db.user.count(),
    db.bill.aggregate({
      where: { status: "PAID" },
      _sum: { totalAmount: true },
    }),
  ]);

  const collectionThisMonth = totalCollected._sum?.totalAmount ?? 0;

  const stats = [
    { label: "Jumlah Unit", value: totalUnits, active: activeUnits, color: "bg-blue-500", href: "/admin/units" },
    { label: "Bil Tertunggak", value: pendingBills, color: "bg-yellow-500", href: "/admin/bills" },
    { label: "Bil Lunas", value: paidBills, color: "bg-green-500", href: "/admin/bills" },
    { label: "Bil Lewat", value: overdueBills, color: "bg-red-500", href: "/admin/bills" },
    { label: "Jumlah Pengguna", value: totalUsers, color: "bg-purple-500", href: "#" },
    { label: "Kutipan (RM)", value: `RM ${Number(collectionThisMonth).toFixed(2)}`, color: "bg-emerald-500", href: "/admin/payments" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview sistem maintenance kondo Bayu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stat.value}</p>
                {stat.active !== undefined && (
                  <p className="text-xs text-green-600 mt-1">{stat.active} aktif</p>
                )}
              </div>
              <div className={`w-12 h-12 rounded-lg ${stat.color} bg-opacity-20 flex items-center justify-center`}>
                <div className={`w-4 h-4 rounded-full ${stat.color}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Tindakan Pantas</h2>
        <div className="flex gap-3">
          <Link
            href="/admin/units"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Urus Unit
          </Link>
          <Link
            href="/admin/bills"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Jana Bil
          </Link>
          <Link
            href="/admin/settings"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Tetapan
          </Link>
        </div>
      </div>
    </div>
  );
}
