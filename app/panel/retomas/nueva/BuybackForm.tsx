"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBuyback, type BuybackInput } from "../actions";
import { findCustomerByPhone } from "../../caja/actions";
import { BUYBACK_CHECKS, DEVICE_TYPES, GRADES, deviceType } from "@/lib/constants";
import SignaturePad from "@/components/SignaturePad";
import ScanButton from "@/components/Scanner";
import Combobox from "@/components/Combobox";

const num = (v: string) => parseInt(v.replace(/\D/g, "") || "0", 10);
const fmt = (n: number) => (n ? "$" + n.toLocaleString("es-CO") : "");

// Sugerencia de grado según las respuestas del checklist (el asesor puede cambiarlo).
function suggestGrade(c: Record<string, boolean>): string {
  if (!c.enciende) return "DOA";
  const fails = ["pantalla", "carcasa", "bateria", "camaras", "piezas"].filter((k) => !c[k]).length;
  return fails === 0 ? "A" : fails === 1 ? "B" : "C";
}

export default function BuybackForm() {
  const router = useRouter();
  const [seller, setSeller] = useState<BuybackInput["seller"]>({ name: "", doc_id: "", phone: "" });
  const [device, setDevice] = useState<BuybackInput["device"]>({ device_type: "celular", brand: "Apple", model: "", color: "", capacity: "", imei: "", serial: "" });
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [grade, setGrade] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [payout, setPayout] = useState("Efectivo");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dt = useMemo(() => deviceType(device.device_type), [device.device_type]);
  const suggested = suggestGrade(checks);

  async function lookup() {
    const c = await findCustomerByPhone(seller.phone);
    if (c) setSeller((s) => ({ ...s, id: c.id, name: c.name }));
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-[28px] font-bold tracking-tight">Nueva retoma</h1>
      <section className="card p-5 space-y-4">
        <p className="section-title">Vendedor</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Celular</label>
            <div className="flex gap-2">
              <input className="input" inputMode="tel" value={seller.phone} onChange={(e) => setSeller({ ...seller, phone: e.target.value })} onBlur={lookup} />
            </div>
          </div>
          <div>
            <label className="label">Nombre completo</label>
            <input className="input" value={seller.name} onChange={(e) => setSeller({ ...seller, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Cédula</label>
            <input className="input" inputMode="numeric" value={seller.doc_id} onChange={(e) => setSeller({ ...seller, doc_id: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <p className="section-title">Equipo</p>
        <div className="flex flex-wrap gap-2">
          {DEVICE_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setDevice({ ...device, device_type: t.key, brand: "", model: "" })}
              className={`rounded-2xl border px-3.5 min-h-11 font-semibold text-sm transition-all ${
                device.device_type === t.key
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20"
                  : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Marca</label>
            <Combobox
              value={device.brand}
              onChange={(b) => setDevice({ ...device, brand: b })}
              options={dt.brands}
              placeholder="Seleccionar marca…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Modelo</label>
            <Combobox
              value={device.model}
              onChange={(m) => {
                const matchedBrand = dt.brands.find((b) => m.toLowerCase().includes(b.toLowerCase()));
                setDevice((prev) => ({ ...prev, model: m, brand: prev.brand || matchedBrand || prev.brand }));
              }}
              options={dt.models}
              placeholder={dt.models[0] || "Selecciona o escribe el modelo…"}
            />
          </div>
          <div>
            <label className="label">Capacidad</label>
            <input className="input" value={device.capacity} onChange={(e) => setDevice({ ...device, capacity: e.target.value })} placeholder="128 GB" />
          </div>
          <div>
            <label className="label">Color</label>
            <input className="input" value={device.color} onChange={(e) => setDevice({ ...device, color: e.target.value })} />
          </div>
          <div>
            <label className="label">Serial</label>
            <input className="input font-mono" autoCapitalize="characters" value={device.serial} onChange={(e) => setDevice({ ...device, serial: e.target.value })} />
          </div>
          <div className="sm:col-span-3">
            <label className="label">{device.device_type === "celular" ? "IMEI (marcar *#06#)" : "IMEI (si tiene)"}</label>
            <div className="flex gap-2">
              <input className="input font-mono" inputMode="numeric" value={device.imei} onChange={(e) => setDevice({ ...device, imei: e.target.value })} />
              <ScanButton label="" onResult={(t) => setDevice((d) => ({ ...d, imei: t }))} />
            </div>
            <p className="text-xs text-muted mt-1">Consulta el IMEI en la base de equipos reportados de la CRC antes de comprar.</p>
          </div>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <p className="section-title">Revisión y grado</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {BUYBACK_CHECKS.map((c) => (
            <label
              key={c.key}
              className={`flex items-center gap-3 rounded-2xl border p-3.5 transition cursor-pointer ${
                checks[c.key]
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                  : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]"
              }`}
            >
              <input
                type="checkbox"
                className="size-5 rounded"
                checked={Boolean(checks[c.key])}
                onChange={(e) => setChecks({ ...checks, [c.key]: e.target.checked })}
              />
              <span className="font-semibold text-sm">{c.label}</span>
            </label>
          ))}
        </div>
        <div>
          <label className="label">Grado (sugerido: {suggested})</label>
          <div className="flex flex-wrap gap-2">
            {GRADES.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGrade(g.key)}
                className={`rounded-2xl border px-3.5 min-h-11 font-semibold text-sm transition-all ${
                  (grade || suggested) === g.key
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20"
                    : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Observaciones</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Batería 82 %, rayón leve en la tapa" />
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <p className="section-title">Pago y firma</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Valor que se paga</label>
            <input className="input" inputMode="numeric" value={fmt(price)} onChange={(e) => setPrice(num(e.target.value))} placeholder="$" />
          </div>
          <div>
            <label className="label">Forma de pago</label>
            <select className="input" value={payout} onChange={(e) => setPayout(e.target.value)}>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Saldo a favor</option>
            </select>
            {payout === "Saldo a favor" && <p className="text-xs text-muted mt-1">Queda como saldo a favor para usar como parte de pago en la caja.</p>}
          </div>
          <div>
            <label className="label">Precio de venta sugerido</label>
            <input className="input" inputMode="numeric" value={fmt(salePrice)} onChange={(e) => setSalePrice(num(e.target.value))} placeholder="$" />
            {price > 0 && salePrice > 0 && <p className="text-xs text-muted mt-1">Margen: ${(salePrice - price).toLocaleString("es-CO")}</p>}
          </div>
        </div>
        <p className="text-sm text-muted">
          El vendedor declara que el equipo es de su propiedad, de procedencia lícita, sin reporte de hurto ni deudas, y autoriza el tratamiento de sus datos.
        </p>
        <SignaturePad onChange={setSignature} height={150} />
        {error && <p className="rounded-xl bg-bad-soft text-bad font-medium px-4 py-3">{error}</p>}
        <button
          type="button"
          className="btn-good w-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createBuyback({ seller, device, checks, grade: grade || suggested, notes, price, payout, salePrice, signature });
              if (r.ok) router.push(`/panel/retomas/${r.id}`);
              else setError(r.error);
            })
          }
        >
          {pending ? "Guardando…" : "Registrar retoma"}
        </button>
      </section>
    </div>
  );
}
