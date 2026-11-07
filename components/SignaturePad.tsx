"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export default function SignaturePad({
  onChange,
  height = 180,
}: {
  onChange: (dataUrl: string | null) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  const strokesRef = useRef<{ x: number; y: number; isStart: boolean }[]>([]);

  // Función para re-dibujar las líneas guardadas en el canvas escalado (evita que rotar el iPad borre la firma)
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    const targetW = Math.round(rect.width * ratio);
    const targetH = Math.round(height * ratio);

    if (canvas.width === targetW && canvas.height === targetH) {
      return;
    }

    canvas.width = targetW;
    canvas.height = targetH;

    if ("resetTransform" in ctx) {
      ctx.resetTransform();
    }
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";

    // Redibujar trazos previos si existen
    const strokes = strokesRef.current;
    if (strokes.length > 0) {
      ctx.beginPath();
      for (let i = 0; i < strokes.length; i++) {
        const pt = strokes[i];
        if (pt.isStart || i === 0) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();
    }
  }, [height]);

  useEffect(() => {
    redraw();

    // Soporte para rotación del iPad y cambios de orientación
    const handleResize = () => redraw();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    const canvas = canvasRef.current;
    if (!canvas) {
      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("orientationchange", handleResize);
      };
    }

    // Observer para esperar a que el modal termine la animación y tenga dimensiones reales
    const ro = new ResizeObserver(() => {
      if (canvas.getBoundingClientRect().width > 0) {
        redraw();
      }
    });
    ro.observe(canvas);

    // Safari iOS: Bloquear scroll de la página mientras el usuario firma con el dedo o Apple Pencil
    const preventScroll = (e: TouchEvent) => {
      if (drawing.current) {
        e.preventDefault();
      }
    };
    canvas.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      ro.disconnect();
      canvas.removeEventListener("touchmove", preventScroll);
    };
  }, [redraw]);

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent) {
    e.preventDefault();
    try {
      canvasRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Ignorar error de captura en WebKit antiguo
    }
    drawing.current = true;
    const p = pos(e);
    last.current = p;
    strokesRef.current.push({ x: p.x, y: p.y, isStart: true });
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const p = pos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    strokesRef.current.push({ x: p.x, y: p.y, isStart: false });
    last.current = p;
    if (empty) setEmpty(false);
  }

  function end(e?: React.PointerEvent) {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    try {
      if (e && canvasRef.current?.hasPointerCapture(e.pointerId)) {
        canvasRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignorar
    }
    if (canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    setEmpty(true);
    onChange(null);
  }

  return (
    <div>
      <div className="relative rounded-2xl border-2 border-dashed border-slate-300 bg-white shadow-inner overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          style={{ height, touchAction: "none" }}
          className="w-full block cursor-crosshair touch-none select-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          aria-label="Área de firma para iPad y pantalla táctil"
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-slate-400 text-sm font-medium select-none">
            ✍️ Firme aquí con el dedo o Apple Pencil
          </span>
        )}
        <div className="pointer-events-none absolute left-6 right-6 bottom-8 border-b border-dashed border-slate-300" />
      </div>
      <div className="flex items-center justify-between mt-2">
        <button
          type="button"
          onClick={clear}
          className="text-xs font-bold text-rose-500 hover:text-rose-600 transition px-2.5 py-1 rounded-lg hover:bg-rose-50 cursor-pointer"
        >
          Borrar firma
        </button>
        <span className="text-[11px] text-slate-400 select-none">Táctil & Apple Pencil</span>
      </div>
    </div>
  );
}
