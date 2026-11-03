export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return "$" + Math.round(n).toLocaleString("es-CO");
}

export function parseMoney(v: FormDataEntryValue | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const digits = String(v).replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

// Las fechas se guardan en UTC (datetime('now') de SQLite) y se muestran en hora de Colombia.
function toDate(s: string): Date {
  return new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
}

export function dateTime(s: string | null | undefined): string {
  if (!s) return "—";
  return toDate(s).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dateOnly(s: string | null | undefined): string {
  if (!s) return "—";
  const d = s.length === 10 ? new Date(s + "T12:00:00-05:00") : toDate(s);
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" });
}

export function daysSince(s: string | null | undefined): number {
  if (!s) return 0;
  return Math.floor((Date.now() - toDate(s).getTime()) / 86400000);
}

export function whatsappLink(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("3")) digits = "57" + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function last4(phone: string): string {
  return phone.replace(/\D/g, "").slice(-4);
}
