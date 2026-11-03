"use client";

import { CHECK_LABELS, type CheckValue } from "@/lib/constants";

const STYLE: Record<CheckValue, string> = {
  ok: "bg-emerald-500 text-white border-emerald-300 shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400/40 font-bold scale-[1.03]",
  falla: "bg-rose-500 text-white border-rose-300 shadow-lg shadow-rose-500/40 ring-2 ring-rose-400/40 font-bold scale-[1.03]",
  np: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-300 shadow-lg shadow-blue-500/40 ring-2 ring-blue-400/40 font-bold scale-[1.03]",
};

const ROW_BORDER: Record<CheckValue, string> = {
  ok: "border-l-4 border-l-emerald-400 bg-emerald-500/[0.04]",
  falla: "border-l-4 border-l-rose-500 bg-rose-500/[0.04]",
  np: "border-l-4 border-l-blue-400 bg-blue-500/[0.04]",
};

export default function Checklist({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[];
  value: Record<string, CheckValue>;
  onChange: (v: Record<string, CheckValue>) => void;
}) {
  function setAll(v: CheckValue) {
    onChange(Object.fromEntries(items.map((i) => [i.key, v])));
  }

  function handleSelect(itemKey: string, v: CheckValue, idx: number) {
    onChange({ ...value, [itemKey]: v });

    // Se baja automáticamente al siguiente ítem de la lista para agilizar el diagnóstico en el iPad
    if (idx < items.length - 1) {
      const nextKey = items[idx + 1].key;
      setTimeout(() => {
        const nextEl = document.querySelector(`[data-check="${nextKey}"]`);
        if (nextEl) {
          nextEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 70);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs font-semibold">
          <button
            type="button"
            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20"
            onClick={() => setAll("ok")}
          >
            ✓ Marcar Todo OK
          </button>
          <button
            type="button"
            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20"
            onClick={() => setAll("np")}
          >
            — Todo No probado
          </button>
        </div>
        <span className="text-xs text-slate-400">
          {Object.keys(value).length} de {items.length} verificados
        </span>
      </div>

      <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#142136] overflow-hidden shadow-xl">
        {items.map((item, idx) => {
          const currentVal = value[item.key];
          const rowStyle = currentVal ? ROW_BORDER[currentVal] : "border-l-4 border-l-transparent";

          return (
            <div
              key={item.key}
              data-check={item.key}
              className={`flex flex-wrap items-center gap-3 px-4 py-3.5 transition-all duration-200 ${rowStyle} hover:bg-white/[0.02]`}
            >
              <div className="flex-1 min-w-44 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/[0.06] text-[10px] font-bold text-slate-400 flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="font-semibold text-white text-[15px]">{item.label}</span>
              </div>

              <div className="flex gap-2">
                {(Object.keys(CHECK_LABELS) as CheckValue[]).map((v) => {
                  const isSelected = currentVal === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleSelect(item.key, v, idx)}
                      className={`rounded-xl border px-4 min-h-11 text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                        isSelected
                          ? STYLE[v]
                          : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08]"
                      }`}
                    >
                      {v === "np" ? "No probado" : CHECK_LABELS[v]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
