"use client";

import { useState, useEffect } from "react";

interface ProfileData {
  user: { email: string; role: string };
  unit: {
    block: string;
    floor: string;
    unitNo: string;
    ownerName: string;
    ownerIc: string;
    email: string;
    phone: string | null;
    monthlyFee: number;
  } | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setPhone(data.unit?.phone || "");
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/dashboard/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });

    setSaving(false);
    if (res.ok) {
      setMessage("Profil dikemaskini.");
    } else {
      setMessage("Gagal mengemaskini profil.");
    }
  };

  if (loading) return <div className="p-8 text-center">Memuat...</div>;
  if (!profile) return <div className="p-8 text-center text-red-600">Tiada profil dijumpai</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Profil</h1>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes("Gagal") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Maklumat Unit</h2>
        {profile.unit ? (
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-sm text-gray-500">Unit</p><p className="font-medium">{profile.unit.block}-{profile.unit.floor}-{profile.unit.unitNo}</p></div>
            <div><p className="text-sm text-gray-500">Nama Pemilik</p><p className="font-medium">{profile.unit.ownerName}</p></div>
            <div><p className="text-sm text-gray-500">No KP</p><p className="font-medium">{profile.unit.ownerIc}</p></div>
            <div><p className="text-sm text-gray-500">Email</p><p className="font-medium">{profile.unit.email}</p></div>
            <div><p className="text-sm text-gray-500">Yuran Bulanan</p><p className="font-medium">RM {Number(profile.unit.monthlyFee).toFixed(2)}</p></div>
          </div>
        ) : (
          <p className="text-gray-500">Tiada unit dihubungkan.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold mb-4">Kemaskini Profil</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={profile.user.email} disabled className="w-full px-3 py-2 border rounded-lg bg-gray-100" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Telefon</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Nombor telefon"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
