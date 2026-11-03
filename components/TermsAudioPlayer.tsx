"use client";

import { useEffect, useState } from "react";

/**
 * Botón con ícono de parlante que lee las condiciones de ley en voz alta
 * usando la síntesis de voz nativa del iPad / navegador (Web Speech API).
 * 100% gratis, sin APIs externas y con dicción natural en español.
 */
export default function TermsAudioPlayer({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setSupported(true);
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function toggleSpeech() {
    if (!supported) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();

    // Texto adaptado para lectura auditiva fluida y comprensible en español
    const speechText = `A continuación escuchará las condiciones legales del servicio de nuestro taller. ${text
      .replace(/(\d+)\.\s*/g, "Punto $1: ")
      .replace(/Ley 1480 de 2011/g, "Ley 1480 de 2011, Estatuto del Consumidor")
      .replace(/Ley 1581 de 2012/g, "Ley 1581 de 2012, Protección de Datos Personales")}`;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = "es-CO";
    utterance.rate = 0.95; // Velocidad pausada y clara para documentos legales
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const esVoice =
      voices.find((v) => v.lang === "es-CO") ||
      voices.find((v) => v.lang.startsWith("es-419")) ||
      voices.find((v) => v.lang.startsWith("es"));
    if (esVoice) utterance.voice = esVoice;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggleSpeech}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer select-none active:scale-95 ${
        speaking
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/40"
          : "bg-blue-600/15 text-blue-300 border-blue-500/30 hover:bg-blue-600/25 hover:text-white hover:border-blue-400/50"
      }`}
      title={speaking ? "Detener lectura" : "Escuchar condiciones de ley en voz alta"}
      aria-label="Escuchar condiciones de ley"
    >
      <svg
        className={`w-4 h-4 shrink-0 ${speaking ? "text-emerald-300 animate-pulse" : "text-blue-400"}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
        />
      </svg>
      <span>{speaking ? "Pausar lectura" : "Escuchar condiciones"}</span>
      {speaking && (
        <span className="flex gap-0.5 items-end h-3 ml-0.5">
          <span className="w-0.5 h-2 bg-emerald-400 animate-pulse" />
          <span className="w-0.5 h-3 bg-emerald-400 animate-pulse delay-75" />
          <span className="w-0.5 h-1.5 bg-emerald-400 animate-pulse delay-150" />
        </span>
      )}
    </button>
  );
}
