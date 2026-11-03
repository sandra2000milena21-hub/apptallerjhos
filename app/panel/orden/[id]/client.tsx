"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MediaUploader from "@/components/MediaUploader";
import Checklist from "@/components/Checklist";
import SignaturePad from "@/components/SignaturePad";
import { MEDIA_CATEGORIES, type CheckValue } from "@/lib/constants";
import { addProductItem, createWompiLink, deliver, saveChecklistOut, processDeliveryAction } from "./actions";
import { searchProductsAction } from "@/app/panel/inventario/actions";
import { PAYMENT_METHODS } from "@/lib/constants";

export function OrderUploader({ orderId, defaultCategory }: { orderId: number; defaultCategory: string }) {
  const [category, setCategory] = useState(defaultCategory);
  const [isPublic, setIsPublic] = useState(true);
  return (
    <div className="space-y-3 rounded-xl bg-paper p-3.5">
      <div className="flex flex-wrap gap-3 items-center">
        <select className="input !w-auto !min-h-10" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoría">
          {MEDIA_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-5" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Visible para el cliente
        </label>
      </div>
      <MediaUploader orderId={orderId} category={category} isPublic={isPublic} compact />
    </div>
  );
}

export function ChecklistOutForm({ orderId, initial, items }: { orderId: number; initial: Record<string, CheckValue>; items: { key: string; label: string }[] }) {
  const [value, setValue] = useState<Record<string, CheckValue>>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <form
      action={(fd) =>
        start(async () => {
          await saveChecklistOut(fd);
          setSaved(true);
        })
      }
      className="space-y-3"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="checklist" value={JSON.stringify(value)} />
      <Checklist items={items} value={value} onChange={(v) => { setValue(v); setSaved(false); }} />
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Guardar control de calidad"}</button>
        {saved && <span className="text-sm text-good font-semibold">Guardado</span>}
      </div>
    </form>
  );
}

export function DeliverForm({ orderId, customerName, balance }: { orderId: number; customerName: string; balance: number }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [to, setTo] = useState(customerName);
  const [payRemaining, setPayRemaining] = useState(balance > 0);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [customAmount, setCustomAmount] = useState(balance > 0 ? String(balance) : "0");
  const [finalNote, setFinalNote] = useState("");
  const [noteIsPublic, setNoteIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ saleId?: number } | null>(null);
  const [pending, start] = useTransition();

  const num = (v: string) => parseInt(v.replace(/\D/g, "") || "0", 10);
  const payAmount = payRemaining ? (customAmount ? num(customAmount) : balance) : 0;
  const pointsToEarn = Math.floor(payAmount / 1000);

  if (success) {
    return (
      <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3 animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400 flex items-center justify-center text-2xl mx-auto">
          ✓
        </div>
        <div>
          <p className="font-extrabold text-white text-base">¡Equipo Entregado con Éxito!</p>
          <p className="text-xs text-slate-300 mt-0.5">
            Entregado a <b className="text-white">{to}</b>
            {payAmount > 0 ? ` · Pago de $${payAmount.toLocaleString("es-CO")} en ${paymentMethod}` : ""}.
          </p>
          {pointsToEarn > 0 && (
            <p className="text-xs text-amber-300 font-bold mt-1">
              ⭐ Se acreditaron +{pointsToEarn} puntos al cliente
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 pt-1">
          {success.saleId && (
            <a
              href={`/panel/ventas/${success.saleId}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
            >
              <span>🖨️</span>
              <span>Imprimir Ticket Térmico (80 mm)</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="w-full py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 font-semibold text-xs transition"
          >
            Actualizar pantalla
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Saldo y cobro */}
      {balance > 0 ? (
        <div className="rounded-2xl p-3 bg-[#0a121e] border border-white/[0.08] space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Saldo Pendiente</span>
              <span className="text-xl font-black text-amber-400 tabular-nums">${balance.toLocaleString("es-CO")}</span>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={payRemaining}
                onChange={(e) => setPayRemaining(e.target.checked)}
                className="size-4 rounded accent-emerald-500"
              />
              <span>Cobrar ahora</span>
            </label>
          </div>

          {payRemaining && (
            <div className="space-y-2 pt-1.5 border-t border-white/[0.06] animate-in fade-in duration-150">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Método de Pago:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {["Efectivo", "Transferencia", "Tarjeta"].map((m) => {
                  const isSel = paymentMethod === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSel
                          ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/40 border border-emerald-400/50"
                          : "bg-white/[0.05] hover:bg-white/[0.10] text-slate-300 border border-white/[0.06]"
                      }`}
                    >
                      {m === "Efectivo" ? "💵 Efectivo" : m === "Transferencia" ? "📲 Transf." : "💳 Tarjeta"}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-slate-300">Monto:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    className="input !min-h-8 !w-28 text-right font-bold text-emerald-400 text-xs"
                    inputMode="numeric"
                    value={customAmount ? Number(customAmount).toLocaleString("es-CO") : ""}
                    onChange={(e) => setCustomAmount(String(num(e.target.value)))}
                  />
                  <button
                    type="button"
                    onClick={() => setCustomAmount(String(balance))}
                    className="btn-ghost !min-h-8 !px-2 text-[11px]"
                  >
                    Exacto
                  </button>
                </div>
              </div>

              {pointsToEarn > 0 && (
                <p className="text-[10px] text-amber-300/90 font-medium">
                  ⭐ Acumulará <b>+{pointsToEarn} pts</b> de fidelización con este pago.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-bold">
          <span>✓</span>
          <span>Orden totalmente saldada ($0 pendiente).</span>
        </div>
      )}

      {/* Nota final de reparación */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300">Nota final de reparación (opcional)</label>
          <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={noteIsPublic}
              onChange={(e) => setNoteIsPublic(e.target.checked)}
              className="size-3 rounded accent-blue-500"
            />
            <span>Visible al cliente</span>
          </label>
        </div>
        <textarea
          rows={2}
          value={finalNote}
          onChange={(e) => setFinalNote(e.target.value)}
          placeholder="Ej. Se probó táctil y audio con el cliente. Garantía de 3 meses."
          className="input !text-xs !min-h-14 resize-none"
        />
      </div>

      {/* Nombre de quien recibe */}
      <div>
        <label className="text-xs font-bold text-slate-300 block mb-1">Nombre de quien retira</label>
        <input className="input !min-h-9 text-xs" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {/* Firma opcional */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">Firma de recibido</span>
          <button
            type="button"
            onClick={() => setShowSignature((v) => !v)}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
          >
            {showSignature ? "Ocultar firma" : "✍️ Agregar firma"}
          </button>
        </div>
        {showSignature && (
          <div className="rounded-2xl border border-white/[0.12] bg-white p-1 overflow-hidden animate-in fade-in duration-150">
            <SignaturePad onChange={setSignature} height={110} />
          </div>
        )}
      </div>

      {error && <p className="text-rose-400 font-bold text-xs bg-rose-500/10 p-2 rounded-xl border border-rose-500/25">{error}</p>}

      <button
        type="button"
        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs shadow-lg shadow-emerald-950/60 border border-emerald-400/50 transition active:scale-95 cursor-pointer disabled:opacity-50"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await processDeliveryAction({
              orderId,
              deliveredTo: to.trim() || customerName,
              payRemaining: payRemaining && balance > 0,
              paymentMethod,
              paymentAmount: payAmount,
              finalNote: finalNote.trim() || undefined,
              noteIsPublic,
              signature: showSignature ? signature : null,
            });
            if (!res.ok) {
              setError(res.error ?? "Ocurrió un error al entregar.");
            } else {
              setSuccess({ saleId: res.saleId });
            }
          })
        }
      >
        {pending ? "Procesando entrega y cobro…" : `✅ Confirmar Entrega ${payRemaining && payAmount > 0 ? `y Cobro ($${payAmount.toLocaleString("es-CO")})` : ""}`}
      </button>
    </div>
  );
}

export function CopyButton({ text, label = "Copiar enlace" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt("Copia el enlace:", text);
        }
      }}
    >
      {done ? "¡Copiado!" : label}
    </button>
  );
}

export function ConfirmButton({ children, className, message }: { children: React.ReactNode; className: string; message: string }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

type FoundProduct = { id: number; name: string; price: number; stock: number; track_stock: number };

export function PartPicker({ orderId }: { orderId: number }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoundProduct[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  async function search(v: string) {
    setQ(v);
    if (v.trim().length < 2) return setResults([]);
    setResults(await searchProductsAction(v));
  }
  return (
    <div className="space-y-2">
      <input className="input !min-h-10" value={q} onChange={(e) => search(e.target.value)} placeholder="Buscar repuesto en inventario…" />
      {results.length > 0 && (
        <ul className="rounded-2xl border border-white/[0.12] divide-y divide-white/[0.06] bg-[#0f1b2c] max-h-56 overflow-y-auto shadow-2xl">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={pending}
                className="w-full text-left px-3.5 py-2.5 hover:bg-white/[0.06] flex justify-between gap-2 text-white transition"
                onClick={() =>
                  start(async () => {
                    const fd = new FormData();
                    fd.set("orderId", String(orderId));
                    fd.set("productId", String(p.id));
                    await addProductItem(fd);
                    setQ("");
                    setResults([]);
                    router.refresh();
                  })
                }
              >
                <span>{p.name}</span>
                <span className="text-sm text-muted whitespace-nowrap">
                  ${p.price.toLocaleString("es-CO")} · {p.track_stock ? `${p.stock} en stock` : "servicio"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WompiButton({ orderId, phone, orderNumber }: { orderId: number; phone: string; orderNumber: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ url?: string; error?: string } | null>(null);
  const wa = (url: string) => {
    let d = phone.replace(/\D/g, "");
    if (d.length === 10 && d.startsWith("3")) d = "57" + d;
    return `https://wa.me/${d}?text=${encodeURIComponent(`Puedes pagar el saldo de tu orden ${orderNumber} en línea aquí: ${url}`)}`;
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-ghost w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("orderId", String(orderId));
            setResult(await createWompiLink(fd));
          })
        }
      >
        {pending ? "Creando link…" : "Crear link de pago (Wompi)"}
      </button>
      {result?.error && <p className="text-sm text-bad">{result.error}</p>}
      {result?.url && (
        <div className="flex flex-wrap gap-2">
          <CopyButton text={result.url} label="Copiar link" />
          <a className="btn-good" target="_blank" href={wa(result.url)}>Enviar por WhatsApp</a>
        </div>
      )}
    </div>
  );
}
