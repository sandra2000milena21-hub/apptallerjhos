"use client";

import { useEffect, useRef, useState } from "react";

/** Botón que abre la cámara y lee códigos de barras o QR (IMEI de la caja, etiqueta de la orden, producto). */
export default function ScanButton({
  onResult,
  label = "Escanear",
  className = "btn-ghost",
}: {
  onResult: (text: string) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} title="Escanear con la cámara">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M7 8v8M10 8v8M13 8v8M17 8v8" />
        </svg>
        {label}
      </button>
      {open && (
        <ScannerModal
          onClose={() => setOpen(false)}
          onResult={(t) => {
            setOpen(false);
            onResult(t);
          }}
        />
      )}
    </>
  );
}

function ScannerModal({ onClose, onResult }: { onClose: () => void; onResult: (t: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let done = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current!,
          (result) => {
            if (result && !done) {
              done = true;
              controls?.stop();
              onResult(result.getText().trim());
            }
          },
        );
      } catch {
        setError("No se pudo abrir la cámara. Revisa los permisos del navegador (se necesita HTTPS).");
      }
    })();
    return () => controls?.stop();
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-black overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-x-10 top-1/2 h-0.5 bg-red-500/80" />
        </div>
        <div className="p-3 flex items-center justify-between gap-3">
          <p className="text-white/80 text-sm">{error ?? "Apunta al código de barras"}</p>
          <button type="button" className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
