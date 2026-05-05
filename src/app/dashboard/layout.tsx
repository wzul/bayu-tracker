export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50">
    <nav className="bg-white border-b shadow-sm" >
      <div className="px-8 py-3 flex items-center justify-between" >
        <span className="font-bold text-slate-800" >My Condo</span >
        <form action="/api/auth/logout" method="POST" >
          <button type="submit" className="text-sm text-gray-600 hover:text-gray-800" >Log Keluar</button >
        </form >
      </div >
    </nav >
    {children}
  </div >;
}
