import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { searchProducts } from "@/lib/inventory";
import { PRODUCT_KINDS } from "@/lib/constants";
import ProductForm from "@/components/ProductForm";
import { money } from "@/lib/format";
import Tabs, { INVENTORY_TABS } from "@/components/Tabs";
import { saveProduct } from "./actions";

export const metadata = { title: "Inventario" };

export default async function Inventario({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string; bajo?: string; nuevo?: string; error?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const products = await searchProducts(sp.q ?? "", { kind: sp.tipo || undefined, lowOnly: sp.bajo === "1" });
  const value = products.filter((p) => p.track_stock).reduce((s, p) => s + Math.max(p.stock, 0) * p.cost, 0);

  return (
    <div className="space-y-5">
      <h1 className="text-[28px] font-bold tracking-tight">Inventario</h1>
      <Tabs tabs={INVENTORY_TABS} active="productos" />

      {sp.nuevo && <p className="rounded-xl bg-good-soft text-good font-semibold px-4 py-3">Producto creado. <Link className="underline" href={`/panel/inventario/${sp.nuevo}`}>Ver o imprimir etiqueta</Link></p>}
      {sp.error && <p className="rounded-xl bg-bad-soft text-bad font-semibold px-4 py-3">Escribe el nombre del producto.</p>}

      <form className="flex flex-wrap gap-2 items-center">
        <input name="q" defaultValue={sp.q} className="input !w-72" placeholder="Nombre, SKU, código, compatible…" type="search" />
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="input !w-auto">
          <option value="">Todos los tipos</option>
          {PRODUCT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="bajo" value="1" defaultChecked={sp.bajo === "1"} className="size-5" /> Solo stock bajo
        </label>
        <button className="btn-ghost">Filtrar</button>
        <span className="ml-auto text-sm text-muted">Valor del inventario al costo: <b className="text-ink">{money(value)}</b></span>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead className="text-left text-sm text-muted border-b border-line">
            <tr>
              <th className="p-3 font-semibold">Producto</th>
              <th className="p-3 font-semibold">Tipo</th>
              <th className="p-3 font-semibold text-right">Costo</th>
              <th className="p-3 font-semibold text-right">Precio</th>
              <th className="p-3 font-semibold text-right">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-muted">No hay productos. Crea el primero abajo.</td></tr>
            )}
            {products.map((p) => {
              const low = p.track_stock && p.stock <= p.min_stock;
              return (
                <tr key={p.id} className="hover:bg-paper">
                  <td className="p-3">
                    <Link href={`/panel/inventario/${p.id}`} className="font-semibold hover:text-accent">{p.name}</Link>
                    <p className="text-xs text-muted font-mono">{[p.sku, p.barcode, p.imei].filter(Boolean).join(" · ")}{p.compatible ? ` · ${p.compatible}` : ""}</p>
                  </td>
                  <td className="p-3 text-sm">{PRODUCT_KINDS.find((k) => k.key === p.kind)?.label}{p.grade ? ` · Grado ${p.grade}` : ""}</td>
                  <td className="p-3 text-right tabular-nums">{money(p.cost)}</td>
                  <td className="p-3 text-right tabular-nums font-semibold">{money(p.price)}</td>
                  <td className="p-3 text-right tabular-nums">
                    {p.track_stock ? <span className={low ? "chip bg-warn-soft text-warn" : ""}>{p.stock}</span> : <span className="text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="card p-5" open={products.length === 0}>
        <summary className="section-title cursor-pointer">+ Nuevo producto o repuesto</summary>
        <ProductForm action={saveProduct} />
      </details>
    </div>
  );
}

