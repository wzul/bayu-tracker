"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === "ms" ? "en" : "ms")}
      className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-gray-300 hover:bg-gray-100 transition-colors"
      title={t("switchLang", lang)}
    >
      <span>{lang === "ms" ? "🇲🇾" : "🇬🇧"}</span>
      <span>{lang === "ms" ? "MS" : "EN"}</span>
    </button>
  );
}
