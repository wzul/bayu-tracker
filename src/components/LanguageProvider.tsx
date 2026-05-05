"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Language } from "@/lib/i18n";

type LangContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
};

const LanguageContext = createContext<LangContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("ms");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("lang") as Language | null;
    if (stored && (stored === "ms" || stored === "en")) {
      setLangState(stored);
    }
    setHydrated(true);
  }, []);

  const setLang = (lang: Language) => {
    setLangState(lang);
    localStorage.setItem("lang", lang);
  };

  if (!hydrated) {
    return <>{children}</>;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LangContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Return default if provider not mounted
    return { lang: "ms", setLang: () => {} };
  }
  return ctx;
}
