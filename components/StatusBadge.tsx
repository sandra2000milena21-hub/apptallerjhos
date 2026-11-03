import { statusInfo } from "@/lib/constants";

const COLORS: Record<string, string> = {
  recibido: "bg-slate-700/50 text-slate-200 border border-slate-600/40",
  diagnostico: "bg-sky-500/20 text-sky-300 border border-sky-500/35",
  cotizado: "bg-amber-500/20 text-amber-300 border border-amber-500/35",
  esperando_repuesto: "bg-orange-500/20 text-orange-300 border border-orange-500/35",
  en_reparacion: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/35",
  control_calidad: "bg-purple-500/20 text-purple-300 border border-purple-500/35",
  listo: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35",
  entregado: "bg-slate-800/80 text-slate-400 border border-slate-700/40",
};

export function StatusBadge({ status, short = false }: { status: string; short?: boolean }) {
  const info = statusInfo(status);
  return (
    <span className={`chip font-medium text-[11px] ${COLORS[status] ?? COLORS.recibido}`}>
      {short ? info.short : info.label}
    </span>
  );
}

export function QuoteBadge({ quoteStatus }: { quoteStatus: string }) {
  if (quoteStatus === "pendiente")
    return <span className="chip bg-amber-500/20 text-amber-300 border border-amber-500/35">Cotización enviada</span>;
  if (quoteStatus === "aprobada")
    return <span className="chip bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">Cliente aprobó</span>;
  if (quoteStatus === "rechazada")
    return <span className="chip bg-rose-500/20 text-rose-300 border border-rose-500/35">Cliente rechazó</span>;
  return null;
}
