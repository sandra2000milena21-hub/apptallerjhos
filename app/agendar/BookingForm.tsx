"use client";

import { useState } from "react";

export default function BookingForm({
  action,
  slots,
  types,
}: {
  action: (fd: FormData) => Promise<void>;
  slots: { date: string; label: string; times: string[] }[];
  types: { key: string; label: string; icon: string }[];
}) {
  const [type, setType] = useState("celular");
  const [date, setDate] = useState(slots[0]?.date ?? "");
  const [time, setTime] = useState("");
  const day = slots.find((s) => s.date === date);
  return (
    <form action={action} className="card p-5 space-y-4">
      <input type="hidden" name="device_type" value={type} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <div>
        <label className="label">¿Qué equipo traes?</label>
        <div className="grid grid-cols-3 gap-2">
          {types.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={`rounded-2xl border min-h-14 font-semibold text-sm transition-all ${
                type === t.key
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20"
                  : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Modelo</label>
        <input name="model" className="input" placeholder="iPhone 14 Pro, PS5, MacBook Air…" />
      </div>
      <div>
        <label className="label">¿Qué le pasa?</label>
        <textarea name="problem" className="input" rows={3} />
      </div>
      <div>
        <label className="label">Día</label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slots.map((s) => (
            <button
              key={s.date}
              type="button"
              onClick={() => { setDate(s.date); setTime(""); }}
              className={`rounded-2xl border px-4 min-h-12 text-sm font-semibold whitespace-nowrap capitalize transition-all ${
                date === s.date
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20"
                  : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {day && (
        <div>
          <label className="label">Hora</label>
          <div className="flex flex-wrap gap-2">
            {day.times.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                className={`rounded-2xl border px-4 min-h-11 font-semibold transition-all ${
                  time === t
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20"
                    : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Tu nombre</label>
          <input name="name" className="input" required />
        </div>
        <div>
          <label className="label">Celular (WhatsApp)</label>
          <input name="phone" className="input" inputMode="tel" required />
        </div>
      </div>
      <button className="btn-primary w-full" disabled={!time}>Agendar cita</button>
    </form>
  );
}
