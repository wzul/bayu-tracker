// All DB dates stored in UTC. Display to users in Asia/Kuala_Lumpur (MYT)
const TZ = "Asia/Kuala_Lumpur";

export function fmtMYT(
  date: Date | string | null | undefined,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ms-MY", {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...opts,
  });
}

export function fmtMYTFull(date: Date | string | null | undefined): string {
  return fmtMYT(date, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtMYTShort(date: Date | string | null | undefined): string {
  return fmtMYT(date, { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Format "2026-03" → "Mac 2026" (MS) or "March 2026" (EN)
export function fmtMonthYear(monthYear: string, lang: "ms" | "en" = "ms"): string {
  const [year, month] = monthYear.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(lang === "ms" ? "ms-MY" : "en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "long",
  });
}
