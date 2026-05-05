"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setTheme("light")}
        className={`p-2 rounded-lg text-sm transition ${
          theme === "light"
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
            : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
        title="Light"
      >
        ☀️
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-2 rounded-lg text-sm transition ${
          theme === "dark"
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
            : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
        title="Dark"
      >
        🌙
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`p-2 rounded-lg text-sm transition ${
          theme === "system"
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
            : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
        title="System"
      >
        💻
      </button>
    </div>
  );
}
