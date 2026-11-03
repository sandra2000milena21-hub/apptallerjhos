import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProduct } from "@/lib/inventory";
import { code128Svg } from "@/lib/barcode";
import { money } from "@/lib/format";
import PrintButton from "../../../orden/[id]/imprimir/PrintButton";

export const metadata = { title: "Etiquetas de producto" };

export default async function ProductLabels({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ n?: string }> }) {
  await requireUser();
  const p = await getProduct(parseInt((await params).id, 10));
  if (!p || !p.barcode) notFound();
  const n = Math.min(Math.max(parseInt((await searchParams).n || String(Math.max(p.stock, 1)), 10) || 1, 1), 60);
  const svg = code128Svg(p.barcode);
  return (
    <div>
      <style>{`@page { size: 50mm 25mm; margin: 0; } @media print { .label { page-break-after: always; margin: 0 !important; border: 0 !important; } }`}</style>
      <form className="no-print flex items-center gap-3 mb-4">
        <PrintButton />
        <label className="text-sm">Copias <input name="n" type="number" min={1} max={60} defaultValue={n} className="input !w-20 !min-h-10 inline-block" /></label>
        <button className="btn-ghost">Actualizar</button>
      </form>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="label bg-white border border-line rounded" style={{ width: "50mm", height: "25mm", padding: "1.5mm 2mm" }}>
            <p className="truncate font-semibold" style={{ fontSize: "7pt" }}>{p.name}</p>
            <div style={{ height: "10mm" }} className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="flex justify-between" style={{ fontSize: "7pt" }}>
              <span className="font-mono">{p.barcode}</span>
              <b>{money(p.price)}</b>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
