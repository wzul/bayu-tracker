import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b shadow-sm">
        <div className="px-8 py-3 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-6">
            <span className="font-bold text-slate-800">My Condo</span>
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-800">Dashboard</Link>
            <Link href="/dashboard/history" className="text-sm text-gray-600 hover:text-gray-800">Sejarah</Link>
            <Link href="/dashboard/profile" className="text-sm text-gray-600 hover:text-gray-800">Profil</Link>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-sm text-gray-600 hover:text-gray-800">Log Keluar</button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
