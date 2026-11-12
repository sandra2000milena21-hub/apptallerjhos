"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUSES, statusInfo } from "@/lib/constants";
import { changeStatus } from "./orden/[id]/actions";
import DeliveryModal from "@/components/DeliveryModal";

export type BoardCard = {
  id: number;
  number: string;
  model: string;
  brand?: string | null;
  customer: string;
  phone?: string;
  status: string;
  icon: string;
  services: string[];
  priority: string;
  days: number;
  quote: string;
  overdue: string | null;
  readyDays: number;
  wet: boolean;
  token?: string;
  problem?: string | null;
  deviceType?: string;
  diagnosticFee?: number;
  estimate?: number | null;
};

const QUOTE: Record<string, [string, string]> = {
  pendiente: ["Cotización enviada", "bg-amber-500/20 text-amber-300 border border-amber-500/35"],
  aprobada: ["Cliente aprobó", "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35"],
  rechazada: ["Cliente rechazó", "bg-rose-500/20 text-rose-300 border border-rose-500/35"],
};

// Color de cada columna (el mismo de la etiqueta de estado).
const DOT: Record<string, string> = {
  recibido: "bg-slate-400",
  diagnostico: "bg-sky-400",
  cotizado: "bg-amber-400",
  esperando_repuesto: "bg-orange-400",
  en_reparacion: "bg-indigo-400",
  control_calidad: "bg-purple-400",
  listo: "bg-emerald-400",
  entregado: "bg-slate-600",
};

type CardProps = {
  o: BoardCard;
  isExpanded: boolean;
  isDragging: boolean;
  copied: boolean;
  onToggle: (id: number) => void;
  onDeliver: (card: BoardCard) => void;
  onMove: (id: number, status: string) => void;
  onCopy: (token: string) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
};

/** Tarjeta memorizada: al arrastrar, expandir o mover una orden solo se redibujan las tarjetas afectadas. */
const OrderCard = memo(function OrderCard({ o, isExpanded, isDragging, copied, onToggle, onDeliver, onMove, onCopy, onDragStart, onDragEnd }: CardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(o.id));
        onDragStart(o.id);
      }}
      onDragEnd={onDragEnd}
      className={`card p-3.5 bg-[#142136] hover:bg-[#182842] border transition rounded-2xl select-none ${
        isExpanded
          ? "border-blue-500/60 ring-2 ring-blue-500/30 shadow-xl shadow-blue-950/40"
          : "border-white/[0.08] hover:border-blue-500/35"
      } ${isDragging ? "opacity-30 scale-95" : ""} ${
        o.priority === "urgente"
          ? "border-l-4 border-l-rose-500 shadow-rose-950/20"
          : o.priority === "alta"
          ? "border-l-4 border-l-amber-500 shadow-amber-950/20"
          : ""
      } ${o.wet && o.status === "recibido" ? "ring-2 ring-sky-400" : ""}`}
    >
      {/* PARTE SUPERIOR DE LA TARJETA (TOCABLE PARA EXPANDIR) */}
      <div
        onClick={() => onToggle(o.id)}
        className="cursor-pointer"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
            {o.number}
          </span>
          <div className="flex items-center gap-1.5">
            {o.status !== "entregado" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeliver(o);
                }}
                className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm shadow-emerald-950/40 flex items-center gap-1 transition active:scale-95 cursor-pointer"
                title="Entregar equipo al cliente (cobro y nota)"
              >
                <span>✅</span>
                <span>Entregar</span>
              </button>
            )}
            <span className="text-xs text-slate-400 font-medium">{o.days} d</span>
            {/* Flecha de expansión */}
            <span
              className={`text-slate-400 hover:text-white text-xs transition-transform duration-200 inline-block p-1 rounded-md hover:bg-white/[0.08] ${
                isExpanded ? "rotate-180 text-blue-400 font-bold" : ""
              }`}
              title={isExpanded ? "Contraer" : "Abrir detalles rápidos"}
            >
              ▼
            </span>
          </div>
        </div>

        <p className="font-semibold text-white leading-tight mt-1.5 text-[15px] flex items-center gap-1">
          <span aria-hidden className="text-base">{o.icon}</span>
          <span className="truncate">{o.model}</span>
        </p>

        <p className="text-xs text-slate-400 truncate mt-0.5">{o.customer}</p>

        <div className="flex flex-wrap gap-1 mt-2.5">
          {o.priority === "urgente" && (
            <span className="chip bg-pink-500/25 text-pink-300 border border-pink-500/40 font-bold text-[11px] shadow-sm shadow-pink-500/20">
              👑 Premium VIP
            </span>
          )}
          {o.priority === "alta" && (
            <span className="chip bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold text-[11px] shadow-sm shadow-amber-500/20">
              ⚡ Express (24h)
            </span>
          )}
          {o.wet && (
            <span className="chip bg-sky-500/25 text-sky-300 border border-sky-500/40 font-bold text-[11px]">
              💧 Mojado
            </span>
          )}
          {o.services.slice(0, 2).map((x) => (
            <span key={x} className="chip bg-white/[0.06] text-slate-300 border border-white/[0.08] text-[11px]">
              {x}
            </span>
          ))}
          {QUOTE[o.quote] && (
            <span className={`chip text-[11px] font-semibold ${QUOTE[o.quote][1]}`}>
              {QUOTE[o.quote][0]}
            </span>
          )}
          {o.overdue && (
            <span className="chip bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px]">
              Vencida {o.overdue}
            </span>
          )}
          {o.readyDays >= 7 && (
            <span className="chip bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px]">
              Sin recoger {o.readyDays} d
            </span>
          )}
        </div>
      </div>

      {/* MÓDULO INTERACTIVO EXPANDIBLE HACIA ABAJO (EN ESE MISMO BLOQUE) */}
      {isExpanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3.5 pt-3 border-t border-white/[0.10] space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Cliente + Botón Directo de WhatsApp */}
          <div className="flex items-center justify-between gap-2 bg-[#0c1524] p-2.5 rounded-xl border border-white/[0.07]">
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{o.customer}</p>
              <p className="text-[11px] text-slate-400 font-mono">{o.phone || "Sin teléfono"}</p>
            </div>
            {o.phone && (
              <a
                href={`https://wa.me/57${o.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  `Hola ${o.customer}, te escribimos de tu taller sobre tu ${o.model} (Orden ${o.number}).`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-emerald-600/30 transition hover:scale-105 shrink-0"
                title="Abrir WhatsApp"
              >
                <span>💬</span>
                <span>WhatsApp</span>
              </a>
            )}
          </div>

          {/* Falla o problema reportado */}
          {o.problem ? (
            <div className="rounded-xl bg-amber-500/[0.07] border border-amber-500/25 p-2.5 text-xs">
              <span className="text-amber-400 font-bold block mb-0.5">⚠️ Falla reportada:</span>
              <p className="text-slate-200 line-clamp-3 leading-relaxed">{o.problem}</p>
            </div>
          ) : (
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-2 text-xs text-slate-400">
              Sin falla adicional especificada
            </div>
          )}

          {/* Plan de diagnóstico */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-400 font-medium">Diagnóstico:</span>
            <span className="font-bold text-slate-200">
              {o.priority === "urgente"
                ? "👑 Premium VIP (Inmediato)"
                : o.priority === "alta"
                ? "⚡ Express (24h)"
                : "⏱️ Normal (3-5 d)"}
            </span>
          </div>

          {/* CAMBIAR ESTADO RÁPIDO CON 1 TOQUE (IDÉNTICO A LA PANTALLA DE ORDEN) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px] px-1 text-slate-400 font-semibold uppercase tracking-wider">
              <span>Mover estado:</span>
              <span className="text-blue-400 font-bold">{statusInfo(o.status).short}</span>
            </div>

            {/* BOTÓN ULTRA LLAMATIVO: ENTREGADO (ABRE PROCESO DE PAGO Y NOTA) */}
            <button
              type="button"
              onClick={() => onDeliver(o)}
              disabled={o.status === "entregado"}
              className={`w-full py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                o.status === "entregado"
                  ? "bg-emerald-950/40 text-emerald-400/60 border border-emerald-500/20"
                  : "bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-xl shadow-emerald-950/70 border border-emerald-400/60 ring-2 ring-emerald-400/30 hover:scale-[1.01] active:scale-95"
              }`}
            >
              <span className="text-base animate-pulse">🎁</span>
              <span>{o.status === "entregado" ? "Equipo ya entregado" : "Entregar Equipo (Cobro y Nota)"}</span>
              <span className="text-emerald-100 text-[10px] font-bold bg-black/30 px-2 py-0.5 rounded-md">
                PROCESO →
              </span>
            </button>

            <div className="grid grid-cols-2 gap-1.5">
              {STATUSES.map((st) => {
                const isCurrent = o.status === st.key;
                const isDeliver = st.key === "entregado";
                return (
                  <button
                    key={st.key}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => {
                      if (isDeliver) {
                        onDeliver(o);
                      } else {
                        onMove(o.id, st.key);
                      }
                    }}
                    className={`px-2 py-2 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer ${
                      isCurrent
                        ? isDeliver
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black ring-2 ring-emerald-400 shadow-md shadow-emerald-500/30"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold ring-2 ring-blue-400 shadow-md shadow-blue-500/30"
                        : isDeliver
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white font-bold border border-emerald-400/40"
                        : "bg-white/[0.05] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/[0.06] active:scale-95"
                    }`}
                  >
                    {isDeliver ? "✅ Entregado" : st.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* BARRA DE ACCIONES RÁPIDAS */}
          <div className="pt-2 border-t border-white/[0.08] grid grid-cols-2 gap-1.5">
            {o.token && (
              <button
                type="button"
                onClick={() => onCopy(o.token!)}
                className="px-2 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>{copied ? "✅" : "📋"}</span>
                <span>{copied ? "¡Copiado!" : "Copiar link"}</span>
              </button>
            )}

            {o.token && (
              <a
                href={`/s/${o.token}`}
                target="_blank"
                rel="noreferrer"
                className="px-2 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-1"
              >
                <span>👁️</span>
                <span>Ver cliente</span>
              </a>
            )}

            <a
              href={`/panel/orden/${o.id}/etiqueta`}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-1"
            >
              <span>🏷️</span>
              <span>Etiqueta</span>
            </a>

            <a
              href={`/panel/orden/${o.id}/imprimir`}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-1"
            >
              <span>🖨️</span>
              <span>Imprimir</span>
            </a>

            <Link
              href={`/panel/orden/${o.id}`}
              className="col-span-2 mt-1 px-3 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 text-xs font-bold text-center transition flex items-center justify-center gap-1.5"
            >
              <span>🔍 Ver orden completa</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
});

export default function Board({ cards }: { cards: BoardCard[] }) {
  const router = useRouter();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [local, setLocal] = useState(cards);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<BoardCard | null>(null);
  const [, start] = useTransition();

  // Sincroniza cuando el servidor manda datos nuevos.
  useEffect(() => setLocal(cards), [cards]);

  const localRef = useRef(local);
  localRef.current = local;

  // Funciones estables (useCallback) para que las tarjetas memorizadas no se redibujen sin necesidad.
  const move = useCallback((id: number, status: string) => {
    const card = localRef.current.find((c) => c.id === id);
    if (!card || card.status === status) return;
    setLocal((l) => l.map((c) => (c.id === id ? { ...c, status } : c)));
    start(async () => {
      const fd = new FormData();
      fd.set("orderId", String(id));
      fd.set("status", status);
      fd.set("public", "on");
      // changeStatus ya revalida /panel: el tablero llega actualizado en la misma respuesta (sin segunda petición).
      await changeStatus(fd);
    });
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const endDrag = useCallback(() => {
    setDragging(null);
    setOver(null);
  }, []);

  // Agrupa las órdenes por estado una sola vez por cambio de datos.
  const byStatus = useMemo(() => {
    const groups: Record<string, BoardCard[]> = {};
    for (const c of local) (groups[c.status] ??= []).push(c);
    return groups;
  }, [local]);

  function fallbackCopy(text: string) {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      el.style.top = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    } catch {
      // Fallback seguro
    }
  }

  const copyTrackingLink = useCallback((token: string) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/s/${token}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).catch(() => fallbackCopy(url));
      } else {
        fallbackCopy(url);
      }
    } catch {
      fallbackCopy(url);
    }
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  }, []);

  return (
    <>
      <div className="flex gap-3.5 overflow-x-auto pb-4 -mx-4 px-4 snap-x overscroll-x-contain scrollbar-none">
      {STATUSES.map((s) => {
        const col = byStatus[s.key] ?? [];
        return (
          <section
            key={s.key}
            data-status-col={s.key}
            className="w-[280px] shrink-0 snap-start"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== s.key) setOver(s.key);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = dragging ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
              if (id) {
                if (s.key === "entregado") {
                  const card = local.find((c) => c.id === id);
                  if (card) {
                    setDeliveryOrder(card);
                  } else {
                    move(id, "entregado");
                  }
                } else {
                  move(id, s.key);
                }
              }
              setDragging(null);
            }}
          >
            {/* Header de Columna */}
            <div className="flex items-center justify-between mb-2.5 px-2">
              <h2 className="font-bold text-[14px] text-slate-200 uppercase tracking-wide flex items-center gap-2">
                <span aria-hidden className={`w-2 h-2 rounded-full ${DOT[s.key] ?? "bg-slate-500"}`} />
                <span>{s.short}</span>
              </h2>
              <span className="text-xs text-slate-400 font-bold bg-white/[0.08] px-2.5 py-0.5 rounded-full">
                {col.length}
              </span>
            </div>

            {/* Contenedor de Tarjetas */}
            <div
              className={`space-y-3 min-h-36 rounded-2xl p-2.5 transition border ${
                over === s.key
                  ? "bg-blue-600/20 border-blue-400/80 ring-2 ring-blue-400/40 shadow-lg shadow-blue-950/50"
                  : "bg-[#0d1626]/70 border-white/[0.05]"
              }`}
            >
              {col.map((o) => (
                <OrderCard
                  key={o.id}
                  o={o}
                  isExpanded={expandedId === o.id}
                  isDragging={dragging === o.id}
                  copied={Boolean(o.token) && copiedToken === o.token}
                  onToggle={toggleExpand}
                  onDeliver={setDeliveryOrder}
                  onMove={move}
                  onCopy={copyTrackingLink}
                  onDragStart={setDragging}
                  onDragEnd={endDrag}
                />
              ))}

              {col.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-8">
                  {s.key === "entregado" ? "Últimos 3 días" : "Arrastra aquí"}
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>

    {deliveryOrder && (
      <DeliveryModal
        orderId={deliveryOrder.id}
        orderNumber={deliveryOrder.number}
        model={deliveryOrder.model}
        customerName={deliveryOrder.customer}
        onClose={() => setDeliveryOrder(null)}
        onDelivered={() => {
          setDeliveryOrder(null);
          router.refresh();
        }}
      />
    )}
  </>
  );
}
