"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type BoardCard } from "@/app/panel/Board";
import { STATUSES, statusInfo } from "@/lib/constants";
import DeliveryModal from "@/components/DeliveryModal";

/**
 * =========================================================================
 * MOTOR DE AUDIO SINTETIZADO WEB AUDIO API (CALIDAD DE ESTUDIO / 0 LATENCIA)
 * =========================================================================
 */
class CyberAudioEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Chime armónico de inicio (acorde Do mayor 7: C5, E5, G5, B5 con envolvente suave)
  playStartup() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 987.77]; // C5, E5, G5, B5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.045);

        gain.gain.setValueAtTime(0.001, now + idx * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.045 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.045 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.045);
        osc.stop(now + idx * 0.045 + 0.5);
      });
    } catch {
      // Ignorar bloqueos de autoplay
    }
  }

  // Chime de alerta para misiones críticas (doble tono futurista)
  playAlert() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.09); // E6

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Silencioso si no interactuó
    }
  }

  // Micro-clic háptico para interacción táctil
  playClick() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.025);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Silencioso
    }
  }

  // Descenso armónico al pausar / detener
  playStop() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.12);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Silencioso
    }
  }
}

const audioFx = new CyberAudioEngine();

/**
 * Limpieza fonética para voz en español natural
 */
function cleanSpeechText(text: string): string {
  return text
    .replace(/R-0*(\d+)/gi, "orden número $1")
    .replace(/\$\s*([\d\.]+)/g, (_, val) => {
      const n = parseInt(val.replace(/\./g, ""), 10);
      return isNaN(n) ? "" : `${n.toLocaleString("es-CO")} pesos`;
    })
    .replace(/\bVIP\b/gi, "V I P")
    .replace(/\b24h\b/gi, "veinticuatro horas")
    .replace(/\bd\b/gi, "días")
    .replace(/\bpts\b/gi, "puntos")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/[·•—]/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

type VoicePersona = "jhos" | "sofia" | "jarvis";
type BriefingMode = "express" | "completo" | "cobros";

export default function DailyAssistantBubble({
  cards,
  lowStock = 0,
  appointments = 0,
  incomeToday = 0,
  deliveredToday = 0,
  receivedToday = 0,
}: {
  cards: BoardCard[];
  lowStock?: number;
  appointments?: number;
  incomeToday?: number;
  deliveredToday?: number;
  receivedToday?: number;
}) {
  const router = useRouter();

  // Estados de vista
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"radar" | "preguntas" | "ajustes">("radar");
  const [deliveryOrder, setDeliveryOrder] = useState<BoardCard | null>(null);

  // Estados de audio y síntesis de voz
  const [speaking, setSpeaking] = useState(false);
  const [currentSentence, setCurrentSentence] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voicePersona, setVoicePersona] = useState<VoicePersona>("jhos");
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [briefingMode, setBriefingMode] = useState<BriefingMode>("express");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [aiAnswer, setAiAnswer] = useState<{ q: string; a: string } | null>(null);

  // Animaciones periódicas
  const [wiggling, setWiggling] = useState(false);
  const sentenceQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  // Clasificación de misiones clave
  const urgentCards = cards.filter(
    (c) => (c.priority === "urgente" || c.priority === "alta") && !["listo", "entregado"].includes(c.status)
  );
  const wetCards = cards.filter((c) => c.wet && c.status === "recibido");
  const approvedCards = cards.filter((c) => c.quote === "aprobada" && !["listo", "entregado"].includes(c.status));
  const readyCards = cards.filter((c) => c.status === "listo");
  const overdueCards = cards.filter((c) => c.overdue !== null);

  // Estimación de cobros pendientes en equipos listos
  const readyTotalEstimated = readyCards.reduce(
    (acc, c) => acc + (c.estimate || c.diagnosticFee || 0),
    0
  );

  const totalAlerts = urgentCards.length + wetCards.length + overdueCards.length + (lowStock > 0 ? 1 : 0);

  // Carga de voces del navegador (con soporte para eventos asíncronos en Safari / iOS / Edge)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices();
      if (all && all.length > 0) {
        setVoices(all);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    const t = setTimeout(loadVoices, 300);

    // Cargar preferencias guardadas
    try {
      const savedSound = localStorage.getItem("radar_sound_fx");
      if (savedSound !== null) {
        const val = savedSound === "1";
        setSoundEnabled(val);
        audioFx.enabled = val;
      }
      const savedPersona = localStorage.getItem("radar_voice_persona") as VoicePersona;
      if (savedPersona) setVoicePersona(savedPersona);
      const savedRate = localStorage.getItem("radar_speech_rate");
      if (savedRate) setSpeechRate(parseFloat(savedRate));
    } catch {
      // Fallback seguro
    }

    return () => {
      clearTimeout(t);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Animación wiggle periódica para llamar la atención sutilmente
  useEffect(() => {
    const timer = setInterval(() => {
      if (!open && !speaking) {
        setWiggling(true);
        setTimeout(() => setWiggling(false), 1200);
      }
    }, 18000);
    return () => clearInterval(timer);
  }, [open, speaking]);

  // Selección inteligente de la mejor voz disponible
  function getBestVoice(persona: VoicePersona): SpeechSynthesisVoice | null {
    if (voices.length === 0) return null;
    const es = voices.filter(
      (v) => v.lang.startsWith("es") || v.lang.includes("es-") || v.lang.includes("es_")
    );
    if (es.length === 0) return voices[0] || null;

    const isNatural = (v: SpeechSynthesisVoice) =>
      /natural|online|neural/i.test(v.name);
    const isColombian = (v: SpeechSynthesisVoice) =>
      /co|colombia/i.test(v.lang) || /colombia/i.test(v.name);
    const isMexican = (v: SpeechSynthesisVoice) =>
      /mx|mexico/i.test(v.lang) || /mexico/i.test(v.name);

    if (persona === "sofia") {
      const female = es.find((v) =>
        /salome|dalia|monica|paulina|helena|sabina|elvira|female|mujer|zira/i.test(v.name)
      );
      if (female) return female;
    }

    if (persona === "jhos") {
      const male = es.find((v) =>
        /jorge|alvaro|pablo|diego|male|hombre|raul|carlos/i.test(v.name)
      );
      if (male) return male;
    }

    // Por defecto, mejor voz natural colombiana o mexicana
    const bestNatural = es.find((v) => isColombian(v) && isNatural(v)) ||
      es.find((v) => isNatural(v)) ||
      es.find((v) => isColombian(v)) ||
      es.find((v) => isMexican(v)) ||
      es.find((v) => /google/i.test(v.name));

    return bestNatural || es[0];
  }

  // Generador de guiones según modo de briefing
  function generateBriefingSentences(mode: BriefingMode): string[] {
    const hour = new Date().getHours();
    const greeting =
      hour < 12
        ? "¡Buenos días Jhos y equipo del taller!"
        : hour < 18
        ? "¡Buenas tardes Jhos! Este es el radar de tu taller."
        : "¡Buenas noches Jhos! Resumen de cierre de jornada.";

    const sentences: string[] = [greeting];

    if (mode === "express") {
      // MODO EXPRESS (30 SEGUNDOS)
      if (urgentCards.length > 0) {
        sentences.push(
          `Atención inmediata: tienes ${urgentCards.length} orden${
            urgentCards.length > 1 ? "es" : ""
          } urgente${urgentCards.length > 1 ? "s" : ""} o VIP que debes priorizar en mesa.`
        );
      }
      if (wetCards.length > 0) {
        sentences.push(
          `Alerta crítica de corrosión: hay ${wetCards.length} equipo mojado en espera de desarme urgente.`
        );
      }
      if (readyCards.length > 0) {
        sentences.push(
          `Tienes ${readyCards.length} equipo${readyCards.length > 1 ? "s" : ""} listo${
            readyCards.length > 1 ? "s" : ""
          } para entrega con cobro pendiente.`
        );
      } else {
        sentences.push("No tienes equipos pendientes por entregar ahora mismo.");
      }
      if (urgentCards.length === 0 && wetCards.length === 0 && readyCards.length === 0) {
        sentences.push(`Tienes ${cards.length} órdenes activas y el flujo está totalmente al día.`);
      }
      sentences.push("¡Muchos éxitos hoy en el taller!");
      return sentences;
    }

    if (mode === "cobros") {
      // MODO COBROS Y ENTREGAS (FOCO EN DINERO)
      sentences.push("Revisemos las entregas y el dinero listo para recaudar hoy.");
      if (readyCards.length > 0) {
        sentences.push(
          `Tienes ${readyCards.length} equipo${readyCards.length > 1 ? "s" : ""} listo${
            readyCards.length > 1 ? "s" : ""
          } esperando a sus dueños.`
        );
        if (readyTotalEstimated > 0) {
          sentences.push(
            `Hay un estimado de $${readyTotalEstimated.toLocaleString(
              "es-CO"
            )} pendientes por ingresar a caja.`
          );
        }
        const firstTwo = readyCards.slice(0, 2);
        firstTwo.forEach((c) => {
          sentences.push(
            `El ${c.model} de ${c.customer} (orden ${c.number}) está listo para entregar.`
          );
        });
      } else {
        sentences.push("Por ahora no tienes equipos en estado listo pendientes por cobrar.");
      }
      if (incomeToday > 0) {
        sentences.push(
          `Ya se han registrado $${incomeToday.toLocaleString("es-CO")} en ingresos el día de hoy.`
        );
      }
      return sentences;
    }

    // MODO COMPLETO
    sentences.push(
      `Actualmente tienes ${cards.length} equipos activos en el tablero de reparaciones.`
    );

    if (incomeToday > 0) {
      sentences.push(
        `Hoy se han cobrado $${incomeToday.toLocaleString("es-CO")} en caja y entregado ${deliveredToday} equipo${
          deliveredToday !== 1 ? "s" : ""
        }.`
      );
    }

    if (urgentCards.length > 0) {
      sentences.push(
        `Tienes ${urgentCards.length} equipo${
          urgentCards.length > 1 ? "s" : ""
        } con prioridad Express o VIP.`
      );
    }

    if (wetCards.length > 0) {
      sentences.push(
        `¡Peligro de sulfatación! Tienes ${wetCards.length} equipo que entró mojado y sigue en recibido. Necesita baño químico.`
      );
    }

    if (approvedCards.length > 0) {
      sentences.push(
        `Tienes ${approvedCards.length} cotización aprobada por el cliente lista para iniciar reparación.`
      );
    }

    if (readyCards.length > 0) {
      sentences.push(
        `Hay ${readyCards.length} equipo${
          readyCards.length > 1 ? "s" : ""
        } listo para entrega y cobro.`
      );
    }

    if (lowStock > 0) {
      sentences.push(
        `Recuerda que tienes ${lowStock} repuesto${
          lowStock > 1 ? "s" : ""
        } en nivel crítico de inventario.`
      );
    }

    if (appointments > 0) {
      sentences.push(
        `Tienes ${appointments} cita${appointments > 1 ? "s" : ""} técnica agendada para hoy.`
      );
    }

    sentences.push("¡Todo listo, Jhos! A dar el mejor servicio técnico.");
    return sentences;
  }

  // Reproducción secuencial por frases (Elimina el corte de 15 segundos en iPad / iOS Safari)
  function speakSentences(rawSentences: string[]) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Tu navegador no soporta síntesis de voz nativa.");
      return;
    }

    // Cancelar cualquier audio anterior
    window.speechSynthesis.cancel();
    isPlayingRef.current = false;
    sentenceQueueRef.current = rawSentences.map((s) => cleanSpeechText(s)).filter(Boolean);

    if (sentenceQueueRef.current.length === 0) {
      setSpeaking(false);
      setCurrentSentence("");
      return;
    }

    isPlayingRef.current = true;
    setSpeaking(true);
    audioFx.playStartup();

    const voice = getBestVoice(voicePersona);

    function speakNext() {
      if (!isPlayingRef.current || sentenceQueueRef.current.length === 0) {
        isPlayingRef.current = false;
        setSpeaking(false);
        setCurrentSentence("");
        return;
      }

      const nextText = sentenceQueueRef.current.shift()!;
      setCurrentSentence(nextText);

      const utterance = new SpeechSynthesisUtterance(nextText);
      utterance.lang = voice?.lang || "es-CO";
      if (voice) utterance.voice = voice;

      // Parámetros afinados según la personalidad
      if (voicePersona === "jhos") {
        utterance.rate = speechRate * 0.98;
        utterance.pitch = 0.96;
      } else if (voicePersona === "sofia") {
        utterance.rate = speechRate * 1.0;
        utterance.pitch = 1.04;
      } else {
        utterance.rate = speechRate * 1.12;
        utterance.pitch = 1.0;
      }

      utterance.onend = () => {
        // Pausa natural de 120ms entre frases para respiración humana
        setTimeout(() => {
          speakNext();
        }, 120);
      };

      utterance.onerror = () => {
        speakNext();
      };

      window.speechSynthesis.speak(utterance);
    }

    speakNext();
  }

  // Detener la voz en cualquier momento
  function stopSpeaking() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isPlayingRef.current = false;
    setSpeaking(false);
    setCurrentSentence("");
    audioFx.playStop();
  }

  // Iniciar briefing del modo seleccionado
  function startBriefing(mode: BriefingMode = briefingMode) {
    if (speaking) {
      stopSpeaking();
      return;
    }
    const sentences = generateBriefingSentences(mode);
    speakSentences(sentences);
  }

  // Responder consultas directas de "Pregúntale a la IA"
  function handleAskQuestion(queryKey: string) {
    audioFx.playClick();
    let q = "";
    let a = "";

    switch (queryKey) {
      case "dinero": {
        q = "¿Cuánto dinero hay por recaudar hoy?";
        if (readyCards.length > 0) {
          a = `Tienes ${readyCards.length} equipo${
            readyCards.length > 1 ? "s" : ""
          } listos para entregar. Hay aproximadamente $${readyTotalEstimated.toLocaleString(
            "es-CO"
          )} pesos por ingresar a caja una vez los clientes retiren.`;
        } else {
          a = "Por el momento no tienes equipos en estado listo pendientes de cobro.";
        }
        break;
      }
      case "mojados": {
        q = "¿Hay equipos con riesgo de corrosión?";
        if (wetCards.length > 0) {
          a = `¡Atención! Hay ${wetCards.length} equipo${
            wetCards.length > 1 ? "s" : ""
          } que ingresó mojado y continúa en recibido. Es urgente desarmarlo y pasar la placa por tina ultrasónica.`;
        } else {
          a = "Excelente noticia: no tienes ningún equipo mojado sin atender en este momento.";
        }
        break;
      }
      case "listos_dias": {
        q = "¿Cuáles equipos llevan más de 3 días listos?";
        const stale = readyCards.filter((c) => c.readyDays >= 3);
        if (stale.length > 0) {
          a = `Tienes ${stale.length} equipo${
            stale.length > 1 ? "s" : ""
          } que lleva más de 3 días listo sin recoger. Te sugiero enviarles un recordatorio por WhatsApp para liberar espacio y asegurar el cobro.`;
        } else {
          a = "Todos los equipos listos tienen menos de 3 días. Los clientes están retirando a buen ritmo.";
        }
        break;
      }
      case "vip": {
        q = "¿Qué órdenes tienen prioridad VIP o Express?";
        if (urgentCards.length > 0) {
          const names = urgentCards.map((c) => `${c.number} (${c.model})`).join(", ");
          a = `Tienes ${urgentCards.length} orden${
            urgentCards.length > 1 ? "es" : ""
          } de alta prioridad: ${names}. Recomiendo dejarlas listas antes del mediodía.`;
        } else {
          a = "No tienes órdenes VIP ni Express pendientes en este momento. Puedes trabajar con tu flujo habitual.";
        }
        break;
      }
      case "salud": {
        q = "¿Cuál es el diagnóstico de salud del taller?";
        const total = cards.length;
        a = `El taller cuenta con ${total} órdenes activas. ${
          urgentCards.length === 0 && overdueCards.length === 0
            ? "El flujo de trabajo está impecable, sin vencimientos ni cuellos de botella."
            : `Tienes ${overdueCards.length} órdenes vencidas y ${urgentCards.length} urgentes que requieren atención hoy.`
        }`;
        break;
      }
    }

    setAiAnswer({ q, a });
    speakSentences([a]);
  }

  function handleToggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      if (totalAlerts > 0) audioFx.playAlert();
      else audioFx.playStartup();
    } else {
      if (speaking) stopSpeaking();
    }
  }

  function toggleSoundFx() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioFx.enabled = next;
    try {
      localStorage.setItem("radar_sound_fx", next ? "1" : "0");
    } catch {
      // Ignorar
    }
    if (next) audioFx.playClick();
  }

  function handleChangePersona(p: VoicePersona) {
    audioFx.playClick();
    setVoicePersona(p);
    try {
      localStorage.setItem("radar_voice_persona", p);
    } catch {
      // Ignorar
    }
  }

  function handleChangeSpeed(s: number) {
    audioFx.playClick();
    setSpeechRate(s);
    try {
      localStorage.setItem("radar_speech_rate", String(s));
    } catch {
      // Ignorar
    }
  }

  return (
    <>
      {/* =========================================================================
          1. BURBUJA FLOTANTE TECNOLÓGICA (ORB CYBERPUNK)
          ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {/* Tooltip de notificación flotante */}
        {!open && totalAlerts > 0 && (
          <div
            onClick={handleToggleOpen}
            className="mb-2.5 mr-1 px-3.5 py-1.5 rounded-2xl bg-[#0f1b2c]/95 border border-cyan-400/50 text-cyan-200 text-xs font-bold shadow-2xl shadow-cyan-950/70 cursor-pointer hover:scale-105 transition-all flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 touch-manipulation transform-gpu backdrop-blur-md"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Radar: {totalAlerts} misión{totalAlerts > 1 ? "es" : ""} hoy</span>
            <span className="text-[10px] text-cyan-400/80 font-normal">· Toca aquí</span>
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
              <div className="flex items-center gap-0.5 h-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <span key={i} className="w-1 bg-white rounded-full sound-bar" />
                ))}
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

      {/* =========================================================================
          2. MODAL HUD HOLOGRÁFICO DEL ASISTENTE PERSONAL
          ========================================================================= */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleToggleOpen();
          }}
        >
          <div
            className="w-full max-w-xl rounded-3xl bg-[#0d1626]/98 border border-cyan-500/35 shadow-2xl shadow-cyan-950/70 p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 transform-gpu text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Asistente */}
            <div className="flex items-start justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/30 border border-white/20">
                    🤖
                  </div>
                  {speaking && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0d1626] animate-ping" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white tracking-tight">Radar del Taller</h2>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                      Asistente Pro
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Voz ejecutiva y misiones críticas en tiempo real
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleSoundFx}
                  className={`p-2 rounded-xl text-xs transition cursor-pointer ${
                    soundEnabled
                      ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/25"
                      : "text-slate-500 bg-white/[0.04] border border-white/[0.06]"
                  }`}
                  title={soundEnabled ? "Efectos de sonido activados" : "Sonido silenciado"}
                >
                  {soundEnabled ? "🔔" : "🔕"}
                </button>
                <button
                  type="button"
                  onClick={handleToggleOpen}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition text-sm cursor-pointer"
                  aria-label="Cerrar radar"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* BARRA REPRODUCTORA DE VOZ ULTRA TECNOLÓGICA */}
            <div className="rounded-2xl p-4 bg-gradient-to-r from-blue-950/60 via-indigo-950/60 to-cyan-950/60 border border-cyan-500/40 space-y-3 shadow-lg shadow-cyan-950/40">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white flex items-center gap-1.5">
                      {speaking ? "🎙️ Hablando..." : "🎙️ Briefing Ejecutivo de Voz"}
                    </span>
                    {speaking && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        En vivo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 truncate mt-0.5">
                    {speaking
                      ? "Toca detener para pausar la lectura"
                      : "Escucha el estado del taller en segundos"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startBriefing(briefingMode)}
                    className={`px-4 py-2 rounded-xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95 ${
                      speaking
                        ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-600/30"
                        : "bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 shadow-cyan-500/30 hover:scale-105"
                    }`}
                  >
                    <span>{speaking ? "⏹️" : "🔊"}</span>
                    <span>{speaking ? "Detener" : "Escuchar"}</span>
                  </button>
                </div>
              </div>

              {/* ECUALIZADOR DINÁMICO DE 9 BARRAS AL HABLAR */}
              {speaking && (
                <div className="pt-2 border-t border-cyan-500/25 flex flex-col gap-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-center gap-1.5 h-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 bg-gradient-to-t from-cyan-400 to-indigo-400 rounded-full sound-bar"
                      />
                    ))}
                  </div>
                  {currentSentence && (
                    <p className="text-xs text-center text-cyan-200 font-medium italic bg-cyan-950/40 p-2 rounded-xl border border-cyan-500/25 line-clamp-2">
                      “{currentSentence}”
                    </p>
                  )}
                </div>
              )}

              {/* SELECTOR RÁPIDO DE MODOS DE BRIEFING */}
              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Modo:
                </span>
                <div className="flex items-center gap-1">
                  {(
                    [
                      { key: "express", label: "⚡ 30s Express" },
                      { key: "cobros", label: "💰 Cobros" },
                      { key: "completo", label: "📋 Completo" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => {
                        audioFx.playClick();
                        setBriefingMode(m.key);
                        if (speaking) startBriefing(m.key);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        briefingMode === m.key
                          ? "bg-cyan-500 text-slate-950 shadow-sm"
                          : "bg-white/[0.05] hover:bg-white/[0.10] text-slate-300"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* PESTAÑAS HUD (RADAR, PREGUNTAS A LA IA, AJUSTES DE VOZ) */}
            <div className="grid grid-cols-3 gap-1.5 bg-[#0a121e] p-1 rounded-2xl border border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  audioFx.playClick();
                  setActiveTab("radar");
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "radar"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/50"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>📋</span>
                <span>Misiones ({totalAlerts + readyCards.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  audioFx.playClick();
                  setActiveTab("preguntas");
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "preguntas"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/50"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>⚡</span>
                <span>Consultar IA</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  audioFx.playClick();
                  setActiveTab("ajustes");
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "ajustes"
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>🎙️</span>
                <span>Voz & Audio</span>
              </button>
            </div>

            {/* =========================================================================
                PESTAÑA 1: MISIONES CRÍTICAS DEL RADAR
                ========================================================================= */}
            {activeTab === "radar" && (
              <div className="space-y-3 animate-in fade-in duration-150">
                {/* 1. LISTOS PARA ENTREGA (CON BOTÓN DE ENTREGA DIRECTA) */}
                {readyCards.length > 0 && (
                  <div className="rounded-2xl border border-indigo-500/35 bg-indigo-500/[0.08] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1.5">
                        📦 Listos para Entrega ({readyCards.length})
                      </span>
                      <span className="text-xs text-emerald-400 font-extrabold tabular-nums">
                        {readyTotalEstimated > 0
                          ? `~$${readyTotalEstimated.toLocaleString("es-CO")} por cobrar`
                          : "Cobro en entrega"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {readyCards.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl bg-[#142136] p-2.5 border border-white/[0.06] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                              <span>{c.icon}</span>
                              <span className="font-mono text-blue-400">{c.number}</span>
                              <span>·</span>
                              <span className="truncate">{c.model}</span>
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {c.customer} {c.phone ? `· ${c.phone}` : ""}
                              {c.readyDays >= 3 ? (
                                <span className="text-amber-400 font-semibold ml-1">
                                  ({c.readyDays} d en espera)
                                </span>
                              ) : null}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {c.phone && (
                              <a
                                href={`https://wa.me/57${c.phone.replace(
                                  /\D/g,
                                  ""
                                )}?text=¡Hola%20${encodeURIComponent(
                                  c.customer
                                )}!%20Te%20saludamos%20de%20tu%20taller.%20Tu%20equipo%20${encodeURIComponent(
                                  c.model
                                )}%20(Orden%20${c.number})%20ya%20está%20listo%20para%20entrega.`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30 flex items-center gap-1"
                                title="Avisar por WhatsApp"
                              >
                                <span>💬</span>
                                <span>Avisar</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                audioFx.playClick();
                                setDeliveryOrder(c);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-md shadow-emerald-900/50 cursor-pointer active:scale-95"
                            >
                              Entregar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. URGENTES / VIP */}
                {urgentCards.length > 0 && (
                  <div className="rounded-2xl border border-rose-500/35 bg-rose-500/[0.08] p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-300 uppercase tracking-wide flex items-center gap-1.5">
                        🚨 Prioridad Máxima ({urgentCards.length})
                      </span>
                      <span className="text-[11px] text-rose-300/80 font-bold">Express o VIP</span>
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
                                href={`https://wa.me/57${c.phone.replace(
                                  /\D/g,
                                  ""
                                )}?text=Hola%20${encodeURIComponent(
                                  c.customer
                                )},%20te%20escribimos%20de%20tu%20taller%20sobre%20tu%20${encodeURIComponent(
                                  c.model
                                )}%20(${c.number})`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold"
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

                {/* 3. MOJADOS */}
                {wetCards.length > 0 && (
                  <div className="rounded-2xl border border-sky-500/35 bg-sky-500/[0.08] p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-300 uppercase tracking-wide flex items-center gap-1.5">
                        💧 Alerta Corrosión ({wetCards.length})
                      </span>
                      <span className="text-[11px] text-sky-300 font-bold">Desarmar urgente</span>
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

                {/* 4. COTIZACIONES APROBADAS */}
                {approvedCards.length > 0 && (
                  <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.08] p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                        ✅ Aprobadas por Cliente ({approvedCards.length})
                      </span>
                      <span className="text-[11px] text-emerald-300/80 font-bold">Listas para reparar</span>
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
                            <span className="text-emerald-400 font-semibold">Cliente aprobó</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{c.customer}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* SIN ALERTAS */}
                {totalAlerts === 0 && readyCards.length === 0 && (
                  <div className="p-6 text-center rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-3xl">🎉</span>
                    <p className="text-sm font-bold text-white mt-2">¡Todo al día en el taller!</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No tienes órdenes vencidas ni equipos con alertas críticas pendientes.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* =========================================================================
                PESTAÑA 2: CONSULTAR A LA IA (PREGUNTAS INTERACTIVAS POR VOZ)
                ========================================================================= */}
            {activeTab === "preguntas" && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <p className="text-xs text-slate-300">
                  Toca cualquier consulta para que el Asistente analice tus órdenes en tiempo real y te responda con voz y texto:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAskQuestion("dinero")}
                    className="p-3 rounded-2xl bg-[#142136] hover:bg-[#182842] border border-emerald-500/30 hover:border-emerald-400 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                      <span>💰</span>
                      <span>¿Cuánto dinero hay por recaudar?</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Calcula los equipos listos para entrega</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAskQuestion("mojados")}
                    className="p-3 rounded-2xl bg-[#142136] hover:bg-[#182842] border border-sky-500/30 hover:border-sky-400 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                      <span>💧</span>
                      <span>¿Equipos mojados en peligro?</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Revisa riesgos de sulfatación activa</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAskQuestion("listos_dias")}
                    className="p-3 rounded-2xl bg-[#142136] hover:bg-[#182842] border border-amber-500/30 hover:border-amber-400 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                      <span>📦</span>
                      <span>¿Equipos listos (+3 días)?</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Clientes pendientes por llamar</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAskQuestion("vip")}
                    className="p-3 rounded-2xl bg-[#142136] hover:bg-[#182842] border border-pink-500/30 hover:border-pink-400 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-pink-300">
                      <span>👑</span>
                      <span>¿Órdenes VIP o Express?</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Prioridades de diagnósticos rápidos</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAskQuestion("salud")}
                    className="sm:col-span-2 p-3 rounded-2xl bg-[#142136] hover:bg-[#182842] border border-cyan-500/30 hover:border-cyan-400 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                      <span>📊</span>
                      <span>¿Diagnóstico y salud general del taller?</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Flujo de trabajo, cuellos de botella y balance general
                    </p>
                  </button>
                </div>

                {/* RESPUESTA VISUAL DE LA IA */}
                {aiAnswer && (
                  <div className="rounded-2xl p-4 bg-gradient-to-r from-blue-900/30 via-indigo-900/30 to-cyan-900/30 border border-cyan-400/40 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between text-xs text-cyan-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <span>🤖</span>
                        <span>{aiAnswer.q}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => speakSentences([aiAnswer.a])}
                        className="text-[11px] text-cyan-400 hover:text-white underline cursor-pointer"
                      >
                        Repetir voz
                      </button>
                    </div>
                    <p className="text-xs text-white leading-relaxed">{aiAnswer.a}</p>
                  </div>
                )}
              </div>
            )}

            {/* =========================================================================
                PESTAÑA 3: AJUSTES DE VOZ, PERSONALIDAD Y AUDIO
                ========================================================================= */}
            {activeTab === "ajustes" && (
              <div className="space-y-4 animate-in fade-in duration-150 text-xs">
                {/* 1. Selector de Personalidad de Voz */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    Personalidad de la Voz:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { key: "jhos", name: "Jhos (Técnico)", desc: "Voz masculina segura" },
                        { key: "sofia", name: "Sofia (Pro)", desc: "Voz femenina ejecutiva" },
                        { key: "jarvis", name: "Jarvis IA", desc: "Tono dinámico y rápido" },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => handleChangePersona(p.key)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          voicePersona === p.key
                            ? "bg-cyan-600/20 border-cyan-400 text-white shadow-md shadow-cyan-950/50 ring-2 ring-cyan-500/30"
                            : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]"
                        }`}
                      >
                        <p className="font-bold text-xs">{p.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Selector de Velocidad */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    Velocidad de Lectura:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 0.9, label: "0.9x · Pausado" },
                      { val: 1.0, label: "1.0x · Natural" },
                      { val: 1.15, label: "1.15x · Ágil" },
                    ].map((s) => (
                      <button
                        key={s.val}
                        type="button"
                        onClick={() => handleChangeSpeed(s.val)}
                        className={`py-2 px-2 rounded-xl border text-center font-bold text-xs transition cursor-pointer ${
                          speechRate === s.val
                            ? "bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-900/50"
                            : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Prueba de Audio */}
                <div className="p-3.5 rounded-2xl bg-[#0a121e] border border-white/[0.08] flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-white text-xs">Probar Voz Seleccionada</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Verifica la pronunciación en tus parlantes o iPad
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      audioFx.playClick();
                      speakSentences([
                        "Prueba de audio completada con éxito. Soy tu asistente personal de taller.",
                      ]);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer shadow-md transition"
                  >
                    🔊 Probar ahora
                  </button>
                </div>
              </div>
            )}

            {/* Footer con resumen */}
            <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-white/[0.08]">
              <span>{cards.length} equipos activos en tablero</span>
              <button
                type="button"
                onClick={handleToggleOpen}
                className="text-cyan-400 font-bold hover:underline cursor-pointer"
              >
                Volver al tablero
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ENTREGA DIRECTA DESDE EL RADAR */}
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
