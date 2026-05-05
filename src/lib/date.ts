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
