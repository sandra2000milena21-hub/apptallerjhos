import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { getProduct } from "@/lib/inventory";
import { code128Svg } from "@/lib/barcode";
import { dateTime, money } from "@/lib/format";
import ProductForm from "@/components/ProductForm";
import { adjustStock, archiveProduct, saveProduct } from "../actions";

export const metadata = { title: "Producto" };

const REASONS: Record<string, string> = {
  compra: "Compra",
  venta: "Venta",
  reparacion: "Usado en reparación",
  devolucion: "Devuelto de reparación",
  ajuste: "Ajuste por conteo",
  retoma: "Retoma (compra a cliente)",
  inicial: "Stock inicial",
};

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requireUser();
  const p = await getProduct(parseInt((await params).id, 10));
  if (!p) notFound();
  const { ok } = await searchParams;
  const moves = (await dbx.all("SELECT m.*, u.name AS user_name FROM stock_moves m LEFT JOIN users u ON u.id = m.user_id WHERE product_id = ? ORDER BY m.id DESC LIMIT 50", p.id)) as { id: number; qty: number; reason: string; ref: string | null; unit_cost: number | null; note: string | null; user_name: string | null; created_at: string }[];
  const margin = p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;

  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/panel/inventario" className="text-sm font-semibold text-accent">← Inventario</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">{p.name}</h1>
          <p className="text-muted">Costo {money(p.cost)} · Precio {money(p.price)} · Margen {margin}% {p.track_stock ? `· Stock ${p.stock}` : ""}</p>
        </div>
        {p.barcode && (
          <div className="card p-3 text-center">
            <div className="h-12 w-48 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: code128Svg(p.barcode) }} />
            <p className="font-mono text-xs mt-1">{p.barcode}</p>
            <Link href={`/panel/inventario/${p.id}/etiqueta`} target="_blank" className="text-sm font-semibold text-accent">Imprimir etiquetas</Link>
          </div>
        )}
      </div>
      {ok && <p className="rounded-xl bg-good-soft text-good font-semibold px-4 py-3">Cambios guardados.</p>}

      {p.track_stock ? (
        <form action={adjustStock} className="card p-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={p.id} />
          <div>
            <label className="label">Conteo físico</label>
            <input name="counted" type="number" className="input !w-32" defaultValue={p.stock} />
          </div>
          <div className="flex-1 min-w-48">
            <label className="label">Motivo</label>
            <input name="note" className="input" placeholder="Conteo mensual, pieza dañada…" />
          </div>
          <button className="btn-ghost">Ajustar stock</button>
        </form>
      ) : null}

      <section className="card p-5">
        <p className="section-title">Editar</p>
        <ProductForm action={saveProduct} p={p as unknown as Record<string, unknown>} />
      </section>

      <section className="card p-4">
        <p className="section-title mb-2">Movimientos</p>
        {moves.length === 0 ? (
          <p className="text-sm text-muted">Sin movimientos.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">{dateTime(m.created_at)}</td>
                  <td className="py-2 pr-3">{REASONS[m.reason] ?? m.reason}{m.ref ? ` · ${m.ref}` : ""}{m.note ? ` · ${m.note}` : ""}</td>
                  <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${m.qty > 0 ? "text-good" : "text-bad"}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                  <td className="py-2 text-right text-muted">{m.user_name ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <form action={archiveProduct}>
        <input type="hidden" name="id" value={p.id} />
        <button className="btn-bad">Archivar producto</button>
      </form>
    </div>
  );
}
