export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const hasDecimals = abs % 1 !== 0 && Math.abs(Math.round(abs) - abs) > 0.001;
  return "$" + n.toLocaleString("es-CO", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function parseMoney(v: FormDataEntryValue | string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isNaN(v) ? 0 : Math.round(v * 100) / 100;
  let str = String(v).trim();
  if (!str) return 0;

  // Quitar símbolos de moneda, letras y espacios
  str = str.replace(/[$'\sA-Za-z]/g, "");
  if (!str) return 0;

  const hasDot = str.includes(".");
  const hasComma = str.includes(",");

  if (hasDot && hasComma) {
    const lastDot = str.lastIndexOf(".");
    const lastComma = str.lastIndexOf(",");
    if (lastComma > lastDot) {
      // "1.250,50" -> punto es miles, coma es decimal
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // "1,250.50" -> coma es miles, punto es decimal
      str = str.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = str.split(",");
    if (parts.length > 2) {
      // Varios separadores: "1,000,000" -> miles
      str = parts.join("");
    } else {
      // Una sola coma: "15,50" o "15,5" o "50,000"
      if (parts[1].length === 3 && parts[0].length >= 1) {
        str = parts.join("");
      } else {
        str = parts[0] + "." + parts[1];
      }
    }
  } else if (hasDot) {
    const parts = str.split(".");
    if (parts.length > 2) {
      // Varios puntos: "1.000.000" -> miles
      str = parts.join("");
    } else {
      // Un solo punto: si tiene 1 o 2 dígitos tras el punto, es decimal (ej. 15.50, 15.5)
      // Si tiene exactamente 3 dígitos y la parte entera no es 0, es miles (ej. 50.000)
      if (parts[1].length === 3 && parts[0].length >= 1 && parseInt(parts[0], 10) >= 1) {
        str = parts.join("");
      } else {
        str = parts[0] + "." + parts[1];
      }
    }
  }

  str = str.replace(/[^\d.-]/g, "");
  const num = parseFloat(str);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
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
