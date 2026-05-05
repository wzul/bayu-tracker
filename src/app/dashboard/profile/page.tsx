"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

interface ProfileData {
  user: { email: string; role: string; twoFactorEnabled?: boolean };
  unit: {
    block: string;
    floor: string;
    unitNo: string;
    ownerName: string;
    ownerIc: string;
    phone: string | null;
    monthlyFee: number;
  } | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { lang } = useLanguage();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState("");
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setPhone(data.unit?.phone || "");
        setEmail(data.user?.email || "");
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/dashboard/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, email }),
    });

    setSaving(false);
    if (res.ok) {
      setMessage(lang === "ms" ? "Profil dikemaskini." : "Profile updated.");
      if (profile) {
        setProfile({ ...profile, user: { ...profile.user, email } });
      }
    } else {
      const data = await res.json();
      setError(data.error || (lang === "ms" ? "Gagal mengemaskini profil." : "Failed to update profile."));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true);
    setPwMessage("");
    setPwError("");

    if (newPassword !== confirmPassword) {
      setPwError(lang === "ms" ? "Kata laluan baharu tidak sepadan." : "New passwords do not match.");
      setPwLoading(false);
      return;
    }

    const res = await fetch("/api/dashboard/profile/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    setPwLoading(false);
    if (res.ok) {
      setPwMessage(lang === "ms" ? "Kata laluan berjaya dikemaskini." : "Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      const data = await res.json();
      setPwError(data.error || (lang === "ms" ? "Gagal mengemaskini kata laluan." : "Failed to update password."));
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-600 dark:text-gray-300">{t("loading", lang)}</div>;
  if (!profile) return <div className="p-8 text-center text-red-600">{lang === "ms" ? "Tiada profil dijumpai" : "No profile found"}</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">{t("profile", lang)}</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">{lang === "ms" ? "Maklumat Unit" : "Unit Information"}</h2>
        {profile.unit ? (
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-sm text-gray-500 dark:text-gray-400">{t("unit", lang)}</p><p className="font-medium text-gray-800 dark:text-gray-100">{profile.unit.block}-{profile.unit.floor}-{profile.unit.unitNo}</p></div>
            <div><p className="text-sm text-gray-500 dark:text-gray-400">{t("ownerName", lang)}</p><p className="font-medium text-gray-800 dark:text-gray-100">{profile.unit.ownerName}</p></div>
            <div><p className="text-sm text-gray-500 dark:text-gray-400">{lang === "ms" ? "No KP" : "IC No."}</p><p className="font-medium text-gray-800 dark:text-gray-100">{profile.unit.ownerIc}</p></div>
            <div><p className="text-sm text-gray-500 dark:text-gray-400">{t("monthlyFee", lang)}</p><p className="font-medium text-gray-800 dark:text-gray-100">RM {Number(profile.unit.monthlyFee).toFixed(2)}</p></div>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">{lang === "ms" ? "Tiada unit dihubungkan." : "No unit linked."}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">{lang === "ms" ? "Kemaskini Profil" : "Update Profile"}</h2>

        {message && (
          <div className="p-3 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">{message}</div>
        )}
        {error && (
          <div className="p-3 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t("email", lang)}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t("phone", lang)}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100"
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

      <form onSubmit={handleChangePassword} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">{lang === "ms" ? "Tukar Kata Laluan" : "Change Password"}</h2>

        {pwMessage && (
          <div className="p-3 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">{pwMessage}</div>
        )}
        {pwError && (
          <div className="p-3 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">{pwError}</div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{lang === "ms" ? "Kata Laluan Semasa" : "Current Password"}</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{lang === "ms" ? "Kata Laluan Baharu" : "New Password"}</label>
          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{lang === "ms" ? "Sahkan Kata Laluan Baharu" : "Confirm New Password"}</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pwLoading}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
          >
            {pwLoading
              ? lang === "ms" ? "Menyimpan..." : "Saving..."
              : lang === "ms" ? "Tukar Kata Laluan" : "Change Password"}
          </button>
        </div>
      </form>
    </div>
  );
}
