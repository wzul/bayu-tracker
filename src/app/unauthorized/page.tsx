export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">403</h1>
        <p className="text-lg mb-4">Akses tidak dibenarkan.</p>
        <a href="/login" className="text-blue-500 hover:underline">
          Kembali ke Login
        </a>
      </div>
    </div>
  );
}
