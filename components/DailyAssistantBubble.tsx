"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { type BoardCard } from "@/app/panel/Board";
import { STATUSES, statusInfo } from "@/lib/constants";

/**
 * Burbuja Tecnológica Flotante · Radar del Taller
 * - Flota en la esquina inferior con movimientos suaves y animaciones de atención periódicas.
 * - Sintetiza efectos de sonido sci-fi / ping con Web Audio API (100% gratis, sin archivos externos).
 * - Lee por voz (Web Speech API) el resumen y misiones críticas del día.
 * - Abre un HUD holográfico interactivo con accesos directos, llamadas y WhatsApp.
 */
export default function DailyAssistantBubble({
  cards,
  lowStock = 0,
  appointments = 0,
}: {
  cards: BoardCard[];
  lowStock?: number;
  appointments?: number;
}) {
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [wiggling, setWiggling] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Misiones críticas del día
  const urgentCards = cards.filter(
    (c) => (c.priority === "urgente" || c.priority === "alta") && !["listo", "entregado"].includes(c.status)
  );
  const wetCards = cards.filter((c) => c.wet && c.status === "recibido");
  const approvedCards = cards.filter((c) => c.quote === "aprobada" && !["listo", "entregado"].includes(c.status));
  const readyCards = cards.filter((c) => c.status === "listo");
  const overdueCards = cards.filter((c) => c.overdue !== null);

  const totalAlerts = urgentCards.length + wetCards.length + overdueCards.length + (lowStock > 0 ? 1 : 0);

  // Reproducir sonido ping futurista (Web Audio API)
  function playCyberChime(alert = false) {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      if (alert) {
        osc1.type = "sawtooth";
        osc2.type = "sine";
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(740, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      } else {
        osc1.type = "sine";
        osc2.type = "sine";
        osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
        osc2.frequency.setValueAtTime(880, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.18); // D6
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      }

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.4);
      osc2.stop(ctx.currentTime + 0.4);
    } catch {
      // Navegador bloqueó audio o no soportado
    }
  }

  // Wiggle periódico cada 14 segundos para invitar a interactuar
  useEffect(() => {
    const timer = setInterval(() => {
      if (!open && !speaking) {
        setWiggling(true);
        setTimeout(() => setWiggling(false), 1200);
      }
    }, 14000);
    return () => clearInterval(timer);
  }, [open, speaking]);

  // Generar texto del briefing por voz
  function buildBriefingText(): string {
    const parts: string[] = ["¡Hola! Este es tu radar de tareas para hoy."];
    if (urgentCards.length > 0) {
      parts.push(
        `Atención prioritaria: tienes ${urgentCards.length} equipo${
          urgentCards.length > 1 ? "s" : ""
        } de diagnóstico express o VIP que debes revisar primero.`
      );
    }
    if (wetCards.length > 0) {
      parts.push(
        `¡Alerta de corrosión! Tienes ${wetCards.length} equipo${
          wetCards.length > 1 ? "s" : ""
        } que ingresó mojado y sigue en recibido. Revísalo de inmediato.`
      );
    }
    if (approvedCards.length > 0) {
      parts.push(
        `Tienes ${approvedCards.length} cotización aprobada por el cliente lista para reparar.`
      );
    }
    if (readyCards.length > 0) {
      parts.push(
        `Tienes ${readyCards.length} equipo${
          readyCards.length > 1 ? "s" : ""
        } listo${readyCards.length > 1 ? "s" : ""} esperando entrega o pago.`
      );
    }
    if (lowStock > 0) {
      parts.push(`Recuerda que tienes ${lowStock} producto${lowStock > 1 ? "s" : ""} con stock bajo en el inventario.`);
    }
    if (urgentCards.length === 0 && wetCards.length === 0 && readyCards.length === 0) {
      parts.push(
        `Tienes ${cards.length} equipos activos en el taller y todo está bajo control. ¡Excelente trabajo!`
      );
    } else {
      parts.push("¡Mucho éxito en tu jornada de hoy!");
    }
    return parts.join(" ");
  }

  // Activar síntesis de voz en español
  function toggleSpeech() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Tu navegador no soporta síntesis de voz.");
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const text = buildBriefingText();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-CO";
    u.rate = 1.05;
    u.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const esVoice =
      voices.find((v) => v.lang.startsWith("es-CO")) ||
      voices.find((v) => v.lang.startsWith("es-MX")) ||
      voices.find((v) => v.lang.startsWith("es-"));
    if (esVoice) u.voice = esVoice;

    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);

    synthRef.current = u;
    window.speechSynthesis.speak(u);
    playCyberChime(false);
  }

  function handleToggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      playCyberChime(totalAlerts > 0);
    }
  }

  return (
    <>
      {/* BURBUJA FLOTANTE */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {/* Tooltip de notificación flotante */}
        {!open && totalAlerts > 0 && (
          <div
            onClick={handleToggleOpen}
            className="mb-2 mr-1 px-3 py-1.5 rounded-2xl bg-[#0f1b2c] border border-cyan-400/40 text-cyan-200 text-xs font-bold shadow-xl shadow-cyan-950/50 cursor-pointer hover:scale-105 transition-transform flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 touch-manipulation transform-gpu"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Radar: {totalAlerts} misión{totalAlerts > 1 ? "es" : ""} hoy</span>
            <span className="text-[10px] text-cyan-400/80">· Toca aquí</span>
          </div>
        )}

        {/* Botón Orb interactivo */}
        <div className="relative group transform-gpu">
          {/* Ondas radar animadas */}
          <div className="absolute inset-0 rounded-full bg-cyan-500/25 animate-radar-pulse pointer-events-none" />
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 opacity-70 blur-md group-hover:opacity-100 transition duration-300 pointer-events-none" />

          <button
            type="button"
            onClick={handleToggleOpen}
            className={`relative w-15 h-15 rounded-full flex items-center justify-center bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-500 text-white shadow-2xl shadow-blue-500/50 border-2 border-white/25 cursor-pointer transition-transform duration-300 active:scale-95 touch-manipulation transform-gpu ${
              wiggling ? "animate-cyber-wiggle" : "animate-cyber-float"
            }`}
            aria-label="Abrir asistente de taller"
          >
            {speaking ? (
              // Ecualizador animado mientras habla
              <div className="flex items-center gap-1 h-5">
                <span className="w-1 bg-white rounded-full sound-bar" />
                <span className="w-1 bg-white rounded-full sound-bar" />
                <span className="w-1 bg-white rounded-full sound-bar" />
                <span className="w-1 bg-white rounded-full sound-bar" />
              </div>
            ) : (
              // Icono Tecnológico
              <div className="relative flex items-center justify-center">
                <span className="text-2xl drop-shadow-md select-none">🤖</span>
                <span className="absolute -bottom-1 -right-1 text-xs">⚡</span>
              </div>
            )}

            {/* Badge contador */}
            {totalAlerts > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1.5 rounded-full bg-rose-600 border-2 border-[#0b1320] text-white text-[11px] font-black flex items-center justify-center shadow-lg shadow-rose-600/40 animate-pulse">
                {totalAlerts}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* MODAL / HUD HOLOGRÁFICO */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/70 animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-3xl bg-[#0d1626]/98 border border-cyan-500/30 shadow-2xl shadow-cyan-950/60 p-5 sm:p-6 space-y-4 max-h-[88vh] overflow-y-auto animate-in zoom-in-95 duration-150 transform-gpu"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Asistente */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-xl shadow-lg shadow-blue-500/30 border border-white/20">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-white tracking-tight">Radar del Taller</h2>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                      Asistente IA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Tus misiones y recordatorios clave para hoy</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSoundEnabled((v) => !v)}
                  className={`p-2 rounded-xl text-xs transition cursor-pointer ${
                    soundEnabled ? "text-cyan-400 bg-cyan-500/10" : "text-slate-500 bg-white/[0.04]"
                  }`}
                  title={soundEnabled ? "Sonido activado" : "Sonido silenciado"}
                >
                  {soundEnabled ? "🔔" : "🔕"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (speaking) {
                      window.speechSynthesis.cancel();
                      setSpeaking(false);
                    }
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition text-sm cursor-pointer"
                  aria-label="Cerrar radar"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* BOTÓN AUDIO BRIEFING */}
            <div className="rounded-2xl p-3.5 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-cyan-500/20 border border-cyan-500/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>{speaking ? "🎙️ Hablando..." : "🎙️ Briefing por voz"}</span>
                  {speaking && (
                    <span className="flex items-center gap-0.5 h-3 ml-1">
                      <span className="w-1 bg-cyan-400 rounded-full sound-bar" />
                      <span className="w-1 bg-cyan-400 rounded-full sound-bar" />
                      <span className="w-1 bg-cyan-400 rounded-full sound-bar" />
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-300 truncate">
                  {speaking ? "Toca para detener la lectura" : "Escucha el resumen de prioridades"}
                </p>
              </div>

              <button
                type="button"
                onClick={toggleSpeech}
                className={`shrink-0 px-3.5 py-2 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  speaking
                    ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-600/30"
                    : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-cyan-500/30 hover:scale-105"
                }`}
              >
                {speaking ? "⏹️ Detener" : "🔊 Escuchar"}
              </button>
            </div>

            {/* LISTA DE MISIONES */}
            <div className="space-y-3 pt-1">
              {/* URGENTES / VIP */}
              {urgentCards.length > 0 && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.08] p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-300 uppercase tracking-wide flex items-center gap-1.5">
                      🚨 Prioridad Máxima ({urgentCards.length})
                    </span>
                    <span className="text-[11px] text-rose-300/80">Express o VIP</span>
                  </div>
                  <div className="space-y-2">
                    {urgentCards.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl bg-[#142136] p-2.5 border border-white/[0.06] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {c.number} · {c.icon} {c.model}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {c.customer} {c.phone ? `· ${c.phone}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.phone && (
                            <a
                              href={`https://wa.me/57${c.phone.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(
                                c.customer
                              )},%20te%20escribimos%20de%20tu%20taller%20sobre%20tu%20${encodeURIComponent(
                                c.model
                              )}%20(${c.number})`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30"
                              title="Escribir al WhatsApp"
                            >
                              💬
                            </a>
                          )}
                          <Link
                            href={`/panel/orden/${c.id}`}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500"
                          >
                            Ver
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MOJADOS */}
              {wetCards.length > 0 && (
                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.08] p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300 uppercase tracking-wide flex items-center gap-1.5">
                      💧 Alerta Corrosión ({wetCards.length})
                    </span>
                    <span className="text-[11px] text-sky-300/80">Desarmar urgente</span>
                  </div>
                  <div className="space-y-1.5">
                    {wetCards.map((c) => (
                      <Link
                        key={c.id}
                        href={`/panel/orden/${c.id}`}
                        className="block rounded-xl bg-[#142136] p-2.5 border border-white/[0.06] hover:border-sky-400/40 transition"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">
                            {c.number} · {c.model}
                          </span>
                          <span className="text-sky-300 font-semibold">{c.days} d en espera</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{c.customer}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* COTIZACIONES APROBADAS */}
              {approvedCards.length > 0 && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                      ✅ Aprobadas por Cliente ({approvedCards.length})
                    </span>
                    <span className="text-[11px] text-emerald-300/80">Listas para reparar</span>
                  </div>
                  <div className="space-y-1.5">
                    {approvedCards.map((c) => (
                      <Link
                        key={c.id}
                        href={`/panel/orden/${c.id}`}
                        className="block rounded-xl bg-[#142136] p-2.5 border border-white/[0.06] hover:border-emerald-400/40 transition"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">
                            {c.number} · {c.model}
                          </span>
                          <span className="text-emerald-400 font-semibold">Aprobó reparación</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{c.customer}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* EQUIPOS LISTOS PARA ENTREGA */}
              {readyCards.length > 0 && (
                <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.08] p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1.5">
                      📦 Listos para Entrega ({readyCards.length})
                    </span>
                    <span className="text-[11px] text-indigo-300/80">Cobro pendiente</span>
                  </div>
                  <div className="space-y-1.5">
                    {readyCards.slice(0, 4).map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl bg-[#142136] p-2.5 border border-white/[0.06] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {c.number} · {c.model}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">{c.customer}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {c.phone && (
                            <a
                              href={`https://wa.me/57${c.phone.replace(/\D/g, "")}?text=¡Hola%20${encodeURIComponent(
                                c.customer
                              )}!%20Te%20avisamos%20que%20tu%20equipo%20${encodeURIComponent(
                                c.model
                              )}%20ya%20está%20listo%20para%20recoger%20en%20el%20taller.`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold"
                              title="Avisar por WhatsApp"
                            >
                              💬 Avisar
                            </a>
                          )}
                          <Link
                            href={`/panel/orden/${c.id}`}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500"
                          >
                            Entregar
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SIN ALERTAS */}
              {totalAlerts === 0 && (
                <div className="p-6 text-center rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-3xl">🎉</span>
                  <p className="text-sm font-bold text-white mt-2">¡Todo al día en el taller!</p>
                  <p className="text-xs text-slate-400 mt-1">
                    No tienes órdenes vencidas ni equipos con alertas críticas pendientes.
                  </p>
                </div>
              )}
            </div>

            {/* Footer con resumen */}
            <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-white/[0.08]">
              <span>{cards.length} equipos activos en tablero</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-cyan-400 font-bold hover:underline cursor-pointer"
              >
                Volver al tablero
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
