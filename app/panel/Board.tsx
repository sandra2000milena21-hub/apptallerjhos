"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUSES, statusInfo } from "@/lib/constants";
import { changeStatus } from "./orden/[id]/actions";

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

export default function Board({ cards }: { cards: BoardCard[] }) {
  const router = useRouter();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [local, setLocal] = useState(cards);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [, start] = useTransition();

  // Sincroniza cuando el servidor manda datos nuevos.
  useEffect(() => setLocal(cards), [cards]);

  function move(id: number, status: string) {
    const card = local.find((c) => c.id === id);
    if (!card || card.status === status || status === "entregado") return;
    setLocal((l) => l.map((c) => (c.id === id ? { ...c, status } : c)));
    start(async () => {
      const fd = new FormData();
      fd.set("orderId", String(id));
      fd.set("status", status);
      fd.set("public", "on");
      await changeStatus(fd);
      router.refresh();
    });
  }

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function copyTrackingLink(token: string) {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  }

  return (
    <div className="flex gap-3.5 overflow-x-auto pb-4 -mx-4 px-4 snap-x overscroll-x-contain touch-pan-x transform-gpu">
      {STATUSES.map((s) => {
        const col = local.filter((o) => o.status === s.key);
        return (
          <section
            key={s.key}
            className="w-[280px] shrink-0 snap-start"
            onDragOver={(e) => {
              if (s.key === "entregado") return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== s.key) setOver(s.key);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = dragging ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
              if (id) move(id, s.key);
              setDragging(null);
            }}
          >
            {/* Header de Columna */}
            <div className="flex items-center justify-between mb-2.5 px-2">
              <h2 className="font-bold text-[14px] text-slate-200 uppercase tracking-wide flex items-center gap-2">
                <span>{s.short}</span>
                {s.key === "recibido" && col.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                )}
              </h2>
              <span className="text-xs text-slate-400 font-bold bg-white/[0.08] px-2.5 py-0.5 rounded-full">
                {col.length}
              </span>
            </div>

            {/* Contenedor de Tarjetas */}
            <div
              className={`space-y-3 min-h-36 rounded-2xl p-2.5 transition border ${
                over === s.key
                  ? "bg-blue-600/15 border-blue-500/50 ring-2 ring-blue-500/30"
                  : "bg-[#0d1626]/70 border-white/[0.05]"
              }`}
            >
              {col.map((o) => {
                const isExpanded = expandedId === o.id;
                return (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(o.id));
                      setDragging(o.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={`card p-3.5 bg-[#142136] hover:bg-[#182842] border transition rounded-2xl select-none touch-manipulation ${
                      isExpanded
                        ? "border-blue-500/60 ring-2 ring-blue-500/30 shadow-xl shadow-blue-950/40"
                        : "border-white/[0.08] hover:border-blue-500/35"
                    } ${dragging === o.id ? "opacity-30 scale-95" : ""} ${
                      o.priority === "urgente"
                        ? "border-l-4 border-l-rose-500 shadow-rose-950/20"
                        : o.priority === "alta"
                        ? "border-l-4 border-l-amber-500 shadow-amber-950/20"
                        : ""
                    } ${o.wet && o.status === "recibido" ? "ring-2 ring-sky-400" : ""}`}
                  >
                    {/* PARTE SUPERIOR DE LA TARJETA (TOCABLE PARA EXPANDIR) */}
                    <div
                      onClick={() => toggleExpand(o.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                          {o.number}
                        </span>
                        <div className="flex items-center gap-1.5">
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
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] px-1 text-slate-400 font-semibold uppercase tracking-wider">
                            <span>Mover estado:</span>
                            <span className="text-blue-400 font-bold">{statusInfo(o.status).short}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {STATUSES.filter((st) => st.key !== "entregado").map((st) => {
                              const isCurrent = o.status === st.key;
                              return (
                                <button
                                  key={st.key}
                                  type="button"
                                  disabled={isCurrent}
                                  onClick={() => move(o.id, st.key)}
                                  className={`px-2 py-1.5 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer ${
                                    isCurrent
                                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold ring-2 ring-blue-400 shadow-md shadow-blue-500/30"
                                      : "bg-white/[0.05] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/[0.06] active:scale-95"
                                  }`}
                                >
                                  {st.short}
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
                              onClick={() => copyTrackingLink(o.token!)}
                              className="px-2 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>{copiedToken === o.token ? "✅" : "📋"}</span>
                              <span>{copiedToken === o.token ? "¡Copiado!" : "Copiar link"}</span>
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
              })}

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
  );
}
