import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { getOrder } from "@/lib/orders";
import { code128Svg } from "@/lib/barcode";
import { dateOnly } from "@/lib/format";
import PrintButton from "../imprimir/PrintButton";

export const metadata = { title: "Etiqueta" };

// Etiqueta para pegar en el equipo o en su bolsa. Tamaño pensado para rollos de 62 × 29 mm (impresoras Brother/Zebra/térmicas).
export default async function LabelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ n?: string }> }) {
  await requireUser();
  const o = await getOrder(parseInt((await params).id, 10));
  if (!o) notFound();
  const copies = Math.min(Math.max(parseInt((await searchParams).n || "2", 10) || 2, 1), 6);
  const s = await getSettings();
  const svg = code128Svg(o.number);
  return (
    <div>
      <style>{`@page { size: 62mm 29mm; margin: 0; } @media print { .label { page-break-after: always; margin: 0 !important; border: 0 !important; } }`}</style>
      <div className="no-print flex items-center gap-3 mb-4">
        <PrintButton />
        <p className="text-sm text-muted">Se imprimen {copies} copias: una para el equipo y otra para la bolsa. Configura la impresora en 62 × 29 mm.</p>
      </div>
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: copies }).map((_, i) => (
          <div key={i} className="label bg-white text-slate-950 border border-slate-300 shadow-md print:shadow-none rounded-md overflow-hidden" style={{ width: "62mm", height: "29mm", padding: "1.5mm 2.5mm" }}>
            <div className="flex justify-between items-baseline" style={{ fontSize: "7pt" }}>
              <span className="font-bold truncate">{s.shop_name}</span>
              <span>{dateOnly(o.created_at)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono font-bold" style={{ fontSize: "14pt", lineHeight: 1.1 }}>{o.number}</span>
              {o.priority !== "normal" && <span className="font-bold uppercase" style={{ fontSize: "7pt" }}>{o.priority}</span>}
            </div>
            <div style={{ height: "8mm" }} className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="truncate" style={{ fontSize: "7pt", lineHeight: 1.25 }}>
              <b>{o.customer_name}</b> · {o.customer_phone}
            </p>
            <p className="truncate" style={{ fontSize: "7pt", lineHeight: 1.25 }}>{o.model}{o.passcode ? ` · cód. ${o.passcode}` : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
