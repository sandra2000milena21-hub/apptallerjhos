"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrder, lookupCustomer, lookupDevice, quickFill, type NewOrderInput } from "./actions";
import { DEVICE_TYPES, PAYMENT_METHODS, PRIORITIES, DIAGNOSTIC_PLANS, deviceType, statusInfo, type CheckValue } from "@/lib/constants";
import Checklist from "@/components/Checklist";
import MediaUploader, { type Uploaded } from "@/components/MediaUploader";
import SignaturePad from "@/components/SignaturePad";
import ScanButton from "@/components/Scanner";
import TermsAudioPlayer from "@/components/TermsAudioPlayer";
import Combobox from "@/components/Combobox";

const STEPS = ["Cliente", "Equipo y falla", "Estado y pruebas", "Fotos y video", "Valores y firma"];

function money(n: number) {
  return n ? "$" + n.toLocaleString("es-CO") : "";
}
function digits(v: string) {
  const d = v.replace(/\D/g, "");
  return d ? parseInt(d, 10) : 0;
}

type History = Awaited<ReturnType<typeof lookupDevice>>;
type Appointment = { id: number; name: string; phone: string; email: string | null; device_type: string; model: string | null; problem: string | null };

export default function Wizard({
  terms,
  defaults,
  aiEnabled,
  appointment,
}: {
  terms: string;
  defaults: { diagnostic_fee: number; warranty_months: number };
  aiEnabled: boolean;
  appointment: Appointment | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [found, setFound] = useState<string | null>(null);
  const [history, setHistory] = useState<History>(null);
  const [sentence, setSentence] = useState("");
  const [fillNote, setFillNote] = useState<string | null>(null);

  const [customer, setCustomer] = useState<NewOrderInput["customer"]>({
    name: appointment?.name ?? "",
    doc_id: "",
    phone: appointment?.phone ?? "",
    email: appointment?.email ?? "",
  });
  const [device, setDevice] = useState<NewOrderInput["device"]>({
    device_type: appointment?.device_type ?? "celular",
    brand: "",
    model: appointment?.model ?? "",
    color: "",
    capacity: "",
    imei: "",
    serial: "",
    passcode: "",
    services: [],
    problem: appointment?.problem ?? "",
    accessories: "",
    priority: "normal",
  });
  const [enteredOff, setEnteredOff] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, CheckValue>>({});
  const [battery, setBattery] = useState("");
  const [condition, setCondition] = useState("");
  const [media, setMedia] = useState<Uploaded[]>([]);

  function getPlanDueDate(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  const [values, setValues] = useState({
    diagnostic_fee: defaults.diagnostic_fee,
    estimate: 0,
    deposit: 0,
    deposit_method: "Efectivo",
    due_date: getPlanDueDate(4),
    warranty_months: defaults.warranty_months,
  });

  function selectPlan(planKey: string) {
    const plan = DIAGNOSTIC_PLANS.find((p) => p.key === planKey) ?? DIAGNOSTIC_PLANS[0];
    setDevice((d) => ({ ...d, priority: planKey }));
    setValues((v) => ({ ...v, due_date: getPlanDueDate(plan.days) }));
  }

  const [consent, setConsent] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const dt = useMemo(() => deviceType(device.device_type), [device.device_type]);

  function validate(s: number): string | null {
    if (s === 0) {
      if (!customer.name.trim()) return "Escribe el nombre del cliente.";
      if (customer.phone.replace(/\D/g, "").length < 7) return "Escribe un celular válido.";
    }
    if (s === 1) {
      if (!device.model.trim()) return "Escribe el modelo del equipo.";
      if (!device.services.length) return "Elige al menos un tipo de servicio.";
      if (!device.problem.trim()) return "Escribe la falla en palabras del cliente.";
    }
    if (s === 2) {
      const missing = dt.checklist.filter((i) => !checklist[i.key]);
      if (missing.length) return `Marca todas las pruebas (faltan ${missing.length}).`;
    }
    return null;
  }

  function next() {
    const err = validate(step);
    setError(err);
    if (!err) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function searchCustomer() {
    setBusy("cliente");
    setFound(null);
    const c = await lookupCustomer(customer.phone);
    setBusy(null);
    if (c) {
      setCustomer({ id: c.id, name: c.name, doc_id: c.doc_id ?? "", phone: c.phone, email: c.email ?? "" });
      setFound(`Cliente encontrado: ${c.name}${c.store_credit > 0 ? ` · saldo a favor $${c.store_credit.toLocaleString("es-CO")}` : ""}`);
    } else {
      setCustomer((x) => ({ ...x, id: undefined }));
      setFound("Cliente nuevo: completa sus datos.");
    }
  }

  async function checkDevice(imei = device.imei, serial = device.serial) {
    if (!imei.trim() && !serial.trim()) return;
    const h = await lookupDevice(imei, serial);
    setHistory(h);
    if (h) {
      setDevice((d) => ({
        ...d,
        device_type: h.device.device_type,
        brand: d.brand || h.device.brand || "",
        model: d.model || h.device.model,
        color: d.color || h.device.color || "",
        capacity: d.capacity || h.device.capacity || "",
      }));
    }
  }

  async function runQuickFill() {
    setBusy("ia");
    const g = await quickFill(sentence);
    setBusy(null);
    if (!g) return;
    setDevice((d) => ({
      ...d,
      device_type: g.device_type,
      brand: g.brand || d.brand,
      model: g.model || d.model,
      color: g.color || d.color,
      capacity: g.capacity || d.capacity,
      services: g.services.length ? g.services : d.services,
      problem: g.problem || d.problem,
      priority: g.priority,
    }));
    setChecklist({});
    setFillNote(g.source === "ia" ? "Llenado con IA. Revisa los datos." : "Llenado automático. Revisa los datos.");
  }

  function setType(key: string) {
    setDevice((d) => ({ ...d, device_type: key, services: [], model: d.device_type === key ? d.model : "" }));
    setChecklist({});
  }

  function toggleService(key: string) {
    const adding = !device.services.includes(key);
    setDevice((d) => ({
      ...d,
      services: adding ? [...d.services, key] : d.services.filter((s) => s !== key),
      priority: adding && key === "mojado" && d.priority === "normal" ? "alta" : d.priority,
    }));
    if (key === "no_enciende" && adding) {
      setEnteredOff(true);
      setChecklist(Object.fromEntries(dt.checklist.map((i) => [i.key, "np"])) as Record<string, CheckValue>);
    }
  }

  function submit() {
    for (let s = 0; s < 3; s++) {
      const err = validate(s);
      if (err) {
        setStep(s);
        setError(err);
        return;
      }
    }
    if (!consent) return setError("El cliente debe aceptar las condiciones.");
    if (!signature) return setError("Falta la firma del cliente.");
    setError(null);
    startSaving(async () => {
      const res = await createOrder({
        customer,
        device,
        intake: { entered_off: enteredOff, checklist, battery_health: battery, condition_notes: condition },
        mediaIds: media.map((m) => m.id),
        values: { ...values, estimate: values.estimate || null },
        terms,
        data_consent: consent,
        signature,
        appointmentId: appointment?.id ?? null,
      });
      if (res.ok) router.push(`/panel/orden/${res.id}?nueva=1`);
      else setError(res.error);
    });
  }

  const warnings = dt.services.filter((s) => device.services.includes(s.key) && s.warning);
  const photos = media.filter((m) => m.kind === "photo").length;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-[28px] font-bold tracking-tight">Nueva recepción</h1>
      {appointment && <p className="text-muted">Desde la cita de {appointment.name}</p>}
      <ol className="flex gap-1.5 mt-4 mb-6 overflow-x-auto">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1 min-w-[96px]">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`w-full text-left rounded-2xl px-3.5 py-2.5 border transition-all ${
                i === step
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400/40 shadow-lg shadow-blue-500/20"
                  : i < step
                  ? "bg-white/[0.08] border-white/15 text-slate-200"
                  : "bg-white/[0.03] border-white/[0.06] text-slate-500"
              }`}
            >
              <span className="block text-[11px] font-semibold opacity-70">Paso {i + 1}</span>
              <span className="block text-sm font-semibold leading-tight">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="card p-5 sm:p-6 space-y-5">
        {step === 0 && (
          <>
            <div>
              <label className="label">Celular (WhatsApp)</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  inputMode="tel"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && searchCustomer()}
                  placeholder="300 123 4567"
                  autoFocus
                />
                <button type="button" className="btn-ghost shrink-0" onClick={searchCustomer} disabled={busy === "cliente"}>
                  {busy === "cliente" ? "Buscando…" : "Buscar"}
                </button>
              </div>
              {found && <p className="text-sm mt-1.5 font-medium text-accent">{found}</p>}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Nombre completo</label>
                <input className="input" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} autoCapitalize="words" />
              </div>
              <div>
                <label className="label">Cédula</label>
                <input className="input" inputMode="numeric" value={customer.doc_id} onChange={(e) => setCustomer({ ...customer, doc_id: e.target.value })} />
              </div>
              <div>
                <label className="label">Correo (opcional)</label>
                <input className="input" type="email" autoCapitalize="none" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="rounded-xl bg-accent-soft p-3.5 space-y-2">
              <label className="label !text-accent">Recepción rápida: describe el equipo y la falla en una frase</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runQuickFill()}
                  placeholder="PS5 no da video, el puerto HDMI está suelto"
                />
                <button type="button" className="btn-accent shrink-0" onClick={runQuickFill} disabled={busy === "ia" || !sentence.trim()}>
                  {busy === "ia" ? "Llenando…" : aiEnabled ? "Llenar con IA" : "Llenar"}
                </button>
              </div>
              {fillNote && <p className="text-sm font-medium text-accent">{fillNote}</p>}
            </div>

            <div>
              <label className="label">Tipo de equipo</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {DEVICE_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setType(t.key)}
                    className={`rounded-2xl border min-h-16 flex flex-col items-center justify-center gap-1 font-semibold text-sm transition-all ${
                      device.device_type === t.key
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20"
                        : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <span className="text-xl" aria-hidden>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
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
                    // Si el modelo seleccionado pertenece a una marca conocida, autoseleccionar la marca si está vacía
                    const matchedBrand = dt.brands.find((b) => m.toLowerCase().includes(b.toLowerCase()));
                    setDevice((prev) => ({
                      ...prev,
                      model: m,
                      brand: prev.brand || matchedBrand || prev.brand,
                    }));
                  }}
                  options={dt.models}
                  placeholder={dt.models[0] || "Selecciona o escribe el modelo…"}
                />
              </div>
              <div>
                <label className="label">Color</label>
                <input className="input" value={device.color} onChange={(e) => setDevice({ ...device, color: e.target.value })} />
              </div>
              <div>
                <label className="label">Capacidad</label>
                <input className="input" value={device.capacity} onChange={(e) => setDevice({ ...device, capacity: e.target.value })} placeholder="256 GB" />
              </div>
              <div>
                <label className="label">{dt.passcodeLabel}</label>
                <input className="input" value={device.passcode} onChange={(e) => setDevice({ ...device, passcode: e.target.value })} autoComplete="off" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">{device.device_type === "celular" ? "IMEI (marcar *#06#)" : "IMEI (si tiene)"}</label>
                <div className="flex gap-2">
                  <input className="input font-mono" inputMode="numeric" value={device.imei} onChange={(e) => setDevice({ ...device, imei: e.target.value })} onBlur={() => checkDevice()} />
                  <ScanButton label="" onResult={(t) => { setDevice((d) => ({ ...d, imei: t })); checkDevice(t, device.serial); }} />
                </div>
              </div>
              <div>
                <label className="label">Serial</label>
                <div className="flex gap-2">
                  <input className="input font-mono" autoCapitalize="characters" value={device.serial} onChange={(e) => setDevice({ ...device, serial: e.target.value })} onBlur={() => checkDevice()} />
                  <ScanButton label="" onResult={(t) => { setDevice((d) => ({ ...d, serial: t })); checkDevice(device.imei, t); }} />
                </div>
              </div>
            </div>

            {history && (
              <div className="rounded-xl border border-accent/30 bg-accent-soft p-4">
                <p className="font-bold">Este equipo ya vino {history.history.length} vez(ces)</p>
                <ul className="mt-1 text-sm space-y-0.5">
                  {history.history.slice(0, 5).map((h) => (
                    <li key={h.id}>
                      <a className="font-mono font-semibold text-accent" href={`/panel/orden/${h.id}`} target="_blank">{h.number}</a> · {new Date(h.created_at.replace(" ", "T") + "Z").toLocaleDateString("es-CO")} · {statusInfo(h.status).short} · {h.problem?.slice(0, 60)}
                    </li>
                  ))}
                </ul>
                <a className="text-sm font-semibold text-accent" href={`/panel/equipos/${history.device.id}`} target="_blank">Ver historial completo</a>
              </div>
            )}

            <div>
              <label className="label">Tipo de servicio</label>
              <div className="flex flex-wrap gap-2">
                {dt.services.map((s) => {
                  const on = device.services.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleService(s.key)}
                      className={`rounded-2xl border px-3.5 min-h-11 font-semibold text-[15px] transition-all ${
                        on
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20"
                          : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="rounded-xl bg-warn-soft border border-warn/20 p-4 space-y-1.5">
                <p className="font-bold text-warn text-sm">Dile al cliente antes de recibir:</p>
                {warnings.map((w) => (
                  <p key={w.key} className="text-sm"><span className="font-semibold">{w.label}:</span> {w.warning}</p>
                ))}
              </div>
            )}

            <div>
              <label className="label">¿Qué le pasó al equipo? (en palabras del cliente)</label>
              <textarea className="input" rows={4} value={device.problem} onChange={(e) => setDevice({ ...device, problem: e.target.value })} placeholder="Se cayó ayer, la pantalla quedó con líneas verdes…" />
              <p className="text-xs text-muted mt-1">Consejo: en el iPad toca el micrófono del teclado para dictar.</p>
            </div>
            <div>
              <label className="label">Accesorios que deja</label>
              <input className="input" value={device.accessories} onChange={(e) => setDevice({ ...device, accessories: e.target.value })} placeholder={dt.accessoriesHint} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label !mb-0 text-white font-bold text-sm">
                  Tipo de Diagnóstico y Tiempo de Entrega
                </label>
                <span className="text-xs text-slate-400">Selecciona según la urgencia del cliente</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {DIAGNOSTIC_PLANS.map((plan) => {
                  const active = device.priority === plan.key;
                  return (
                    <button
                      key={plan.key}
                      type="button"
                      onClick={() => selectPlan(plan.key)}
                      className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden ${
                        active
                          ? plan.key === "urgente"
                            ? "bg-gradient-to-br from-purple-950/80 via-pink-950/60 to-slate-900 border-pink-500/70 shadow-lg shadow-purple-500/25 ring-2 ring-pink-500/35"
                            : plan.key === "alta"
                            ? "bg-gradient-to-br from-amber-950/80 via-orange-950/60 to-slate-900 border-amber-500/70 shadow-lg shadow-amber-500/25 ring-2 ring-amber-500/35"
                            : "bg-gradient-to-br from-blue-950/80 via-indigo-950/60 to-slate-900 border-blue-500/70 shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/35"
                          : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">
                          {plan.key === "urgente" ? "👑" : plan.key === "alta" ? "⚡" : "⏱️"}
                        </span>
                        <span
                          className={`chip text-[11px] font-bold ${
                            active
                              ? plan.key === "urgente"
                                ? "bg-pink-500 text-white"
                                : plan.key === "alta"
                                ? "bg-amber-500 text-slate-950 font-extrabold"
                                : "bg-blue-600 text-white"
                              : "bg-white/[0.08] text-slate-400"
                          }`}
                        >
                          {plan.time}
                        </span>
                      </div>
                      <p className="font-bold text-white text-[15px]">{plan.title}</p>
                      <p className="text-xs text-slate-300 mt-1 leading-snug">{plan.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <label className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0e1828] p-4 text-white cursor-pointer hover:border-white/20 transition">
              <input
                type="checkbox"
                className="size-5"
                checked={enteredOff}
                onChange={(e) => {
                  setEnteredOff(e.target.checked);
                  if (e.target.checked) setChecklist(Object.fromEntries(dt.checklist.map((i) => [i.key, "np"])) as Record<string, CheckValue>);
                }}
              />
              <span>
                <span className="font-semibold block">El equipo ingresa apagado o no se puede probar</span>
                <span className="text-sm text-muted">Queda escrito: no fue posible verificar sus funciones.</span>
              </span>
            </label>
            <div>
              <p className="section-title mb-2">Pruebas de ingreso · {dt.label}</p>
              <Checklist items={dt.checklist} value={checklist} onChange={setChecklist} />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Salud de batería</label>
                <input className="input" value={battery} onChange={(e) => setBattery(e.target.value)} placeholder="87 %" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Estado físico (rayones, golpes, marco, tornillos)</label>
                <input className="input" value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Rayón en esquina superior izquierda" />
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <p className="section-title">Fotos y video de cómo llega</p>
              <p className="text-sm text-muted mt-1">Mínimo 6 fotos: frente, reverso, los costados y el equipo encendido. Un video corto girando el equipo ayuda mucho.</p>
            </div>
            <MediaUploader category="ingreso" onUploaded={(m) => setMedia((x) => [...x, m])} />
            <div className="flex items-center gap-2">
              <span className={`chip ${photos >= 6 ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>{photos} de 6 fotos</span>
              {media.some((m) => m.kind === "video") && <span className="chip bg-good-soft text-good">Video ✓</span>}
            </div>
            {media.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {media.map((m) => (
                  <div key={m.id} className="relative aspect-square rounded-xl overflow-hidden bg-black/5">
                    {m.kind === "video" ? (
                      <video src={m.preview} className="w-full h-full object-cover" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.preview} alt="" className="w-full h-full object-cover" />
                    )}
                    <button type="button" onClick={() => setMedia((x) => x.filter((y) => y.id !== m.id))} className="absolute top-1.5 right-1.5 size-8 rounded-full bg-black/60 text-white text-lg leading-none" aria-label="Quitar">×</button>
                    {m.kind === "video" && <span className="absolute bottom-1.5 left-1.5 chip bg-black/60 text-white">Video</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <div className="p-4 rounded-2xl border border-white/[0.1] bg-[#0d1726]/90 space-y-3 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Modalidad de diagnóstico:</span>
                  <span
                    className={`chip font-bold text-xs ${
                      device.priority === "urgente"
                        ? "bg-pink-500/20 text-pink-300 border border-pink-500/40"
                        : device.priority === "alta"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                    }`}
                  >
                    {device.priority === "urgente"
                      ? "👑 Premium VIP (En vivo frente al cliente)"
                      : device.priority === "alta"
                      ? "⚡ Express (De un día para otro)"
                      : "⏱️ Normal (3 a 5 días)"}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {DIAGNOSTIC_PLANS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => selectPlan(p.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        device.priority === p.key
                          ? "bg-white text-slate-950 font-bold border-white shadow-sm"
                          : "bg-white/[0.05] text-slate-400 border-white/[0.08] hover:text-white hover:bg-white/[0.1]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {device.priority === "urgente"
                  ? "👑 Servicio VIP prioritario: Se realiza frente al cliente con herramientas especializadas a la vista en la brevedad de lo posible. Fecha estimada: Hoy mismo."
                  : device.priority === "alta"
                  ? "⚡ Servicio Express: Dictamen de un día para otro (24 horas). Fecha estimada: Mañana."
                  : "⏱️ Servicio Normal: Diagnóstico estándar en orden de turno en laboratorio (3 a 5 días hábiles)."}
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Diagnóstico</label>
                <input className="input" inputMode="numeric" value={money(values.diagnostic_fee)} onChange={(e) => setValues({ ...values, diagnostic_fee: digits(e.target.value) })} placeholder="$0" />
              </div>
              <div>
                <label className="label">Valor estimado</label>
                <input className="input" inputMode="numeric" value={money(values.estimate)} onChange={(e) => setValues({ ...values, estimate: digits(e.target.value) })} placeholder="Se cotiza tras diagnóstico" />
              </div>
              <div>
                <label className="label">Fecha estimada de entrega</label>
                <input className="input" type="date" value={values.due_date} onChange={(e) => setValues({ ...values, due_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Abono</label>
                <input className="input" inputMode="numeric" value={money(values.deposit)} onChange={(e) => setValues({ ...values, deposit: digits(e.target.value) })} placeholder="$0" />
              </div>
              <div>
                <label className="label">Medio de pago</label>
                <select className="input" value={values.deposit_method} onChange={(e) => setValues({ ...values, deposit_method: e.target.value })}>
                  {PAYMENT_METHODS.filter((m) => m !== "Wompi" && m !== "Saldo a favor").map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Garantía (meses)</label>
                <input className="input" type="number" min={3} value={values.warranty_months} onChange={(e) => setValues({ ...values, warranty_months: Math.max(3, parseInt(e.target.value || "3", 10)) })} />
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="section-title">Condiciones del servicio</p>
                <TermsAudioPlayer text={terms} />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0d1726] p-4 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line shadow-inner">
                {terms}
              </div>
            </div>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="size-5 mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="text-[15px]">El cliente leyó y acepta las condiciones, el estado en que entrega el equipo y el tratamiento de sus datos personales.</span>
            </label>
            <div>
              <p className="label">Firma del cliente</p>
              <SignaturePad onChange={setSignature} />
            </div>
          </>
        )}

        {error && <p className="rounded-xl bg-bad-soft text-bad font-medium px-4 py-3">{error}</p>}

        <div className="flex items-center justify-between gap-3 pt-2">
          <button type="button" className="btn-ghost" onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0}>Atrás</button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-primary min-w-36" onClick={next}>Siguiente</button>
          ) : (
            <button type="button" className="btn-good min-w-44" onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Crear orden"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
