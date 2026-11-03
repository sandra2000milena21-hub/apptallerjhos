import { dbx, getSettings } from "./db";

export const SLOT_CAPACITY = 2;

/** Próximos días con atención (en hora de Colombia) y sus horas libres. */
export async function availableSlots(days = 14): Promise<{ date: string; label: string; times: string[] }[]> {
  const s = await getSettings();
  const weekdays = (s.booking_days || "1,2,3,4,5,6").split(",").map((x) => parseInt(x, 10));
  const hours = (s.booking_hours || "").split(",").map((h) => h.trim()).filter(Boolean);
  const nowBogota = new Date(Date.now() - 5 * 3600 * 1000);
  const out: { date: string; label: string; times: string[] }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(nowBogota.getUTCFullYear(), nowBogota.getUTCMonth(), nowBogota.getUTCDate() + i));
    if (!weekdays.includes(d.getUTCDay())) continue;
    const date = d.toISOString().slice(0, 10);
    const taken = (await dbx.all("SELECT time, COUNT(*) AS n FROM appointments WHERE date = ? AND status IN ('pendiente','confirmada') GROUP BY time", date)) as { time: string; n: number }[];
    const nowHHMM = nowBogota.toISOString().slice(11, 16);
    const times = hours.filter((h) => (taken.find((t) => t.time === h)?.n ?? 0) < SLOT_CAPACITY && (i > 0 || h > nowHHMM));
    if (times.length)
      out.push({
        date,
        label: d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
        times,
      });
  }
  return out;
}
