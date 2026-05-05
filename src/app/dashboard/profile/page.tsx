"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

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
  const { lang } = useLanguage();

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
      setMessage(lang === "ms" ? "Profil dikemaskini." : "Profile updated.");
    } else {
      setMessage(lang === "ms" ? "Gagal mengemaskini profil." : "Failed to update profile.");
    }
  };

  if (loading) return <div className="p-8 text-center">{t("loading", lang)}</div>;
  if (!profile) return <div className="p-8 text-center text-red-600">{lang === "ms" ? "Tiada profil dijumpai" : "No profile found"}</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t("profile", lang)}</h1>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes(lang === "ms" ? "Gagal" : "Failed") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{lang === "ms" ? "Maklumat Unit" : "Unit Information"}</h2>
        {profile.unit ? (
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-sm text-gray-500">{t("unit", lang)}</p><p className="font-medium">{profile.unit.block}-{profile.unit.floor}-{profile.unit.unitNo}</p></div>
            <div><p className="text-sm text-gray-500">{t("ownerName", lang)}</p><p className="font-medium">{profile.unit.ownerName}</p></div>
            <div><p className="text-sm text-gray-500">{lang === "ms" ? "No KP" : "IC No."}</p><p className="font-medium">{profile.unit.ownerIc}</p></div>
            <div><p className="text-sm text-gray-500">{t("email", lang)}</p><p className="font-medium">{profile.unit.email}</p></div>
            <div><p className="text-sm text-gray-500">{t("monthlyFee", lang)}</p><p className="font-medium">RM {Number(profile.unit.monthlyFee).toFixed(2)}</p></div>
          </div>
        ) : (
          <p className="text-gray-500">{lang === "ms" ? "Tiada unit dihubungkan." : "No unit linked."}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold mb-4">{lang === "ms" ? "Kemaskini Profil" : "Update Profile"}</h2>
        <div>
          <label className="block text-sm font-medium mb-1">{t("email", lang)}</label>
          <input type="email" value={profile.user.email} disabled className="w-full px-3 py-2 border rounded-lg bg-gray-100" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("phone", lang)}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder={lang === "ms" ? "Nombor telefon" : "Phone number"}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t("loading", lang) : t("save", lang)}
          </button>
        </div>
      </form>
    </div>
  );
}
