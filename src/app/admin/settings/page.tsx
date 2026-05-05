"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

interface Config {
  id: string;
  penaltyDays: number;
  penaltyPercent: number;
  retryDays: number;
  retryAttemptsPerDay: number;
  gatewayFeePercent: number;
  gatewayFeeFixed: number;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const { lang } = useLanguage();

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data.config);
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        penaltyDays: config.penaltyDays,
        penaltyPercent: config.penaltyPercent,
        retryDays: config.retryDays,
        retryAttemptsPerDay: config.retryAttemptsPerDay,
        gatewayFeePercent: config.gatewayFeePercent,
        gatewayFeeFixed: config.gatewayFeeFixed,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setMessage(t("settingsSaved", lang));
    } else {
      setMessage(t("settingsFailed", lang));
    }
  };

  if (loading) return <div className="p-8 text-center">{t("loading", lang)}</div>;
  if (!config) return <div className="p-8 text-center text-red-600">{t("noConfig", lang)}</div>;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t("systemSettings", lang)}</h1>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes(t("settingsFailed", lang).slice(0, 5)) ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("penaltyDays", lang)}</label>
            <input
              type="number"
              min="0"
              required
              value={config.penaltyDays}
              onChange={(e) => setConfig({ ...config, penaltyDays: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">{t("penaltyDaysHelp", lang)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("penaltyPercent", lang)}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={config.penaltyPercent}
              onChange={(e) => setConfig({ ...config, penaltyPercent: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("retryDays", lang)}</label>
            <input
              type="number"
              min="0"
              required
              value={config.retryDays}
              onChange={(e) => setConfig({ ...config, retryDays: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">{t("retryDaysHelp", lang)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("retryAttemptsPerDay", lang)}</label>
            <input
              type="number"
              min="0"
              required
              value={config.retryAttemptsPerDay}
              onChange={(e) => setConfig({ ...config, retryAttemptsPerDay: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("gatewayFeePercent", lang)}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={config.gatewayFeePercent}
              onChange={(e) => setConfig({ ...config, gatewayFeePercent: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">{t("gatewayFeeHelp", lang)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("gatewayFeeFixed", lang)}</label>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={config.gatewayFeeFixed}
              onChange={(e) => setConfig({ ...config, gatewayFeeFixed: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">{t("gatewayFeeFixedHelp", lang)}</p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t("loading", lang) : t("saveSettings", lang)}
          </button>
        </div>
      </form>
    </div>
  );
}
