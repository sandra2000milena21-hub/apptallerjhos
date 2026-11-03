import { requireUser } from "@/lib/auth";
import { listCatalog, searchProducts } from "@/lib/inventory";
import { DEVICE_TYPES, deviceType } from "@/lib/constants";
import { money } from "@/lib/format";
import Tabs, { INVENTORY_TABS } from "@/components/Tabs";
import { deleteCatalogItem, saveCatalogItem } from "../actions";

export const metadata = { title: "Catálogo de reparaciones" };

export default async function Catalogo() {
  await requireUser();
  const items = await listCatalog();
  const parts = await searchProducts("", { kind: "repuesto", limit: 1000 });

  return (
    <div className="space-y-5">
      <h1 className="text-[28px] font-bold tracking-tight">Inventario</h1>
      <Tabs tabs={INVENTORY_TABS} active="catalogo" />
      <p className="text-muted max-w-2xl">
        Las reparaciones que más haces, con su precio y el repuesto que usan. En la orden se agregan con un toque y el repuesto sale del inventario.
      </p>

      <form action={saveCatalogItem} className="card p-4 grid sm:grid-cols-[150px_1fr_140px_1fr_auto] gap-2 items-end">
        <div>
          <label className="label">Equipo</label>
          <select name="device_type" className="input">
            {DEVICE_TYPES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Reparación</label>
          <input name="name" className="input" placeholder="Cambio de pantalla iPhone 13" required />
        </div>
        <div>
          <label className="label">Precio</label>
          <input name="price" className="input" inputMode="numeric" placeholder="$" required />
        </div>
        <div>
          <label className="label">Repuesto que usa</label>
          <select name="product_id" className="input" defaultValue="">
            <option value="">Ninguno (solo mano de obra)</option>
            {parts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.stock})</option>)}
          </select>
        </div>
        <button className="btn-primary">Agregar</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead className="text-left text-sm text-muted border-b border-line">
            <tr>
              <th className="p-3 font-semibold">Reparación</th>
              <th className="p-3 font-semibold">Repuesto</th>
              <th className="p-3 font-semibold text-right">Precio</th>
              <th className="p-3 font-semibold text-right">Margen</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-muted">Aún no hay reparaciones en el catálogo.</td></tr>}
            {items.map((c) => {
              const cost = c.product_cost ?? 0;
              return (
                <tr key={c.id}>
                  <td className="p-3"><span aria-hidden>{deviceType(c.device_type).icon}</span> {c.name}</td>
                  <td className="p-3 text-sm">{c.product_name ? `${c.product_name} · ${c.product_stock} en stock` : <span className="text-muted">—</span>}</td>
                  <td className="p-3 text-right tabular-nums font-semibold">{money(c.price)}</td>
                  <td className="p-3 text-right tabular-nums">{money(c.price - cost)}</td>
                  <td className="p-3 text-right">
                    <form action={deleteCatalogItem}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-sm text-muted hover:text-bad font-semibold">Quitar</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
