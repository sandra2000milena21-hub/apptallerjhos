"use client";

import { useEffect, useState, useTransition } from "react";
import { getOrderDeliveryInfo, processDeliveryAction, type OrderDeliveryInfo } from "@/app/panel/orden/[id]/actions";
import SignaturePad from "@/components/SignaturePad";
import { PAYMENT_METHODS } from "@/lib/constants";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const num = (v: string) => parseInt(v.replace(/\D/g, "") || "0", 10);

export default function DeliveryModal({
  orderId,
  orderNumber,
  model,
  customerName,
  onClose,
  onDelivered,
}: {
  orderId: number;
  orderNumber: string;
  model: string;
  customerName: string;
  onClose: () => void;
  onDelivered?: () => void;
}) {
  const [info, setInfo] = useState<OrderDeliveryInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [payRemaining, setPayRemaining] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [customAmount, setCustomAmount] = useState("");
  const [finalNote, setFinalNote] = useState("");
  const [noteIsPublic, setNoteIsPublic] = useState(true);
  const [deliveredTo, setDeliveredTo] = useState(customerName);
  const [showSignature, setShowSignature] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ saleId?: number } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getOrderDeliveryInfo(orderId).then((res) => {
      if (!active) return;
      if (res) {
        setInfo(res);
        setDeliveredTo(res.customerName || customerName);
        setCustomAmount(res.balance > 0 ? String(res.balance) : "0");
        setPayRemaining(res.balance > 0);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [orderId, customerName]);

  const balance = info?.balance ?? 0;
  const payAmount = payRemaining ? (customAmount ? num(customAmount) : balance) : 0;
  const pointsToEarn = Math.floor(payAmount / 1000);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await processDeliveryAction({
        orderId,
        deliveredTo: deliveredTo.trim() || customerName,
        payRemaining: payRemaining && balance > 0,
        paymentMethod,
        paymentAmount: payAmount,
        finalNote: finalNote.trim() || undefined,
        noteIsPublic,
        signature: showSignature ? signature : null,
      });

      if (!res.ok) {
        setError(res.error || "Ocurrió un error al procesar la entrega.");
      } else {
        setSuccessResult({ saleId: res.saleId });
        if (onDelivered) onDelivered();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-[#0f1b2c] border border-cyan-500/30 shadow-2xl shadow-cyan-950/60 p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 transform-gpu text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-lg font-black text-white tracking-tight">Proceso de Entrega</h2>
              <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                {orderNumber}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {model} · Cliente: <span className="text-white font-medium">{customerName}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Pantalla de Éxito al Completar */}
        {successResult ? (
          <div className="py-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-950/60">
              ✓
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-white">¡Equipo Entregado con Éxito!</h3>
              <p className="text-sm text-slate-300 mt-1">
                La orden <span className="font-mono font-bold text-blue-400">{orderNumber}</span> quedó marcada como entregada a{" "}
                <b className="text-white">{deliveredTo}</b>.
              </p>
              {payAmount > 0 && (
                <p className="text-xs text-emerald-400 font-bold mt-1">
                  Se registró el pago de {fmt(payAmount)} en {paymentMethod}
                  {pointsToEarn > 0 ? ` · +${pointsToEarn} pts acreditados al cliente` : ""}.
                </p>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              {successResult.saleId && (
                <a
                  href={`/panel/ventas/${successResult.saleId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-900/40 transition flex items-center justify-center gap-2"
                >
                  <span>🖨️</span>
                  <span>Imprimir Ticket Térmico (80 mm)</span>
                </a>
              )}
              <a
                href={`/panel/orden/${orderId}/imprimir`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <span>📄</span>
                <span>Imprimir Hoja de Servicio Completa</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition"
              >
                Listo / Finalizar
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <span className="inline-block w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Cargando estado de la orden…</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* SECCIÓN 1: SALDO RESTANTE Y MÉTODO DE PAGO */}
            <div className="rounded-2xl p-3.5 bg-[#0a121e] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Total de reparación: <b className="text-slate-200">{fmt(info?.total ?? 0)}</b></span>
                <span>Abonado: <b className="text-slate-200">{fmt(info?.paid ?? 0)}</b></span>
              </div>

              {balance > 0 ? (
                <div className="space-y-3 pt-1 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Saldo Restante</span>
                      <span className="text-2xl font-black text-amber-400 tabular-nums">{fmt(balance)}</span>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={payRemaining}
                        onChange={(e) => setPayRemaining(e.target.checked)}
                        className="size-4 rounded accent-emerald-500 cursor-pointer"
                      />
                      <span>Cobrar restante ahora</span>
                    </label>
                  </div>

                  {payRemaining && (
                    <div className="space-y-2.5 pt-2 border-t border-white/[0.06] animate-in fade-in duration-150">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Método de Pago del Restante:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {PAYMENT_METHODS.filter((m) => m !== "Wompi").map((m) => {
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
                                {m === "Efectivo" ? "💵 Efectivo" : m === "Transferencia" ? "📲 Transf." : m === "Tarjeta" ? "💳 Tarjeta" : m}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <span className="text-xs text-slate-300">Valor recibido:</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            className="input !min-h-9 !w-32 text-right font-bold text-emerald-400 text-sm"
                            inputMode="numeric"
                            value={customAmount ? Number(customAmount).toLocaleString("es-CO") : ""}
                            onChange={(e) => setCustomAmount(String(num(e.target.value)))}
                            placeholder={fmt(balance)}
                          />
                          <button
                            type="button"
                            onClick={() => setCustomAmount(String(balance))}
                            className="btn-ghost !min-h-9 !px-2.5 text-xs font-semibold"
                            title="Total del saldo"
                          >
                            Exacto
                          </button>
                        </div>
                      </div>

                      {pointsToEarn > 0 && (
                        <p className="text-[11px] text-amber-300/90 font-medium flex items-center gap-1">
                          <span>⭐</span>
                          <span>El cliente acumulará <b>+{pointsToEarn} puntos de fidelización</b> con este pago.</span>
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
            </div>

            {/* SECCIÓN 2: NOTA FINAL DE REPARACIÓN */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">Nota final de reparación / garantía (opcional)</label>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noteIsPublic}
                    onChange={(e) => setNoteIsPublic(e.target.checked)}
                    className="size-3.5 rounded accent-blue-500"
                  />
                  <span>Visible para el cliente</span>
                </label>
              </div>
              <textarea
                rows={2}
                value={finalNote}
                onChange={(e) => setFinalNote(e.target.value)}
                placeholder="Ej. Se probó táctil, cámaras y audio a satisfacción con el cliente. Garantía de 3 meses por sello."
                className="input !text-xs !min-h-16 resize-none"
              />
            </div>

            {/* SECCIÓN 3: PERSONA QUE RECIBE */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Nombre de quien retira el equipo</label>
              <input
                className="input !min-h-10 text-xs font-medium"
                value={deliveredTo}
                onChange={(e) => setDeliveredTo(e.target.value)}
                placeholder="Nombre del cliente o persona autorizada"
                required
              />
            </div>

            {/* SECCIÓN 4: FIRMA DIGITAL (OPCIONAL) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Firma digital de recibido</span>
                <button
                  type="button"
                  onClick={() => setShowSignature((v) => !v)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                >
                  {showSignature ? "Ocultar firma" : "✍️ Agregar firma en pantalla"}
                </button>
              </div>
              {showSignature && (
                <div className="rounded-2xl border border-white/[0.12] bg-white p-1 overflow-hidden animate-in fade-in duration-150">
                  <p className="text-[10px] text-slate-500 text-center select-none pb-0.5">Firma con el dedo o lápiz en el recuadro blanco</p>
                  <SignaturePad onChange={setSignature} height={110} />
                </div>
              )}
            </div>

            {error && <p className="text-xs text-rose-400 font-bold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/25">{error}</p>}

            {/* BOTÓN FINAL DE CONFIRMAR ENTREGA */}
            <button
              type="button"
              disabled={pending}
              onClick={handleSubmit}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm tracking-wide shadow-xl shadow-emerald-950/60 border border-emerald-400/50 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {pending ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Procesando entrega y cobro…</span>
                </>
              ) : (
                <>
                  <span>✅</span>
                  <span>
                    Confirmar Entrega {payRemaining && payAmount > 0 ? `y Cobro (${fmt(payAmount)})` : ""}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
