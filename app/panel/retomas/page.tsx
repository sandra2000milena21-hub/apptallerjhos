import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { deviceType } from "@/lib/constants";
import { dateOnly, money } from "@/lib/format";

export const metadata = { title: "Retomas" };

export default async function Retomas() {
  await requireUser();
  const rows = (await dbx.all(`SELECT b.*, c.name AS seller, p.stock AS in_stock FROM buybacks b JOIN customers c ON c.id = b.customer_id
       LEFT JOIN products p ON p.id = b.product_id ORDER BY b.id DESC LIMIT 200`,)) as { id: number; number: string; device_type: string; model: string; imei: string | null; grade: string; price: number; sale_price: number | null; payout: string; status: string; created_at: string; seller: string; in_stock: number | null }[];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Retomas</h1>
          <p className="text-muted">Equipos usados que compras a clientes. Entran al inventario con su costo y grado.</p>
        </div>
        <Link href="/panel/retomas/nueva" className="btn-accent">+ Nueva retoma</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead className="text-left text-sm text-muted border-b border-line">
            <tr>
              <th className="p-3 font-semibold">Retoma</th>
              <th className="p-3 font-semibold">Equipo</th>
              <th className="p-3 font-semibold">Vendedor</th>
              <th className="p-3 font-semibold text-right">Pagado</th>
              <th className="p-3 font-semibold text-right">Precio venta</th>
              <th className="p-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-muted">Aún no hay retomas.</td></tr>}
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-paper">
                <td className="p-3"><Link href={`/panel/retomas/${b.id}`} className="font-mono font-bold hover:text-accent">{b.number}</Link><p className="text-xs text-muted">{dateOnly(b.created_at)}</p></td>
                <td className="p-3">{deviceType(b.device_type).icon} {b.model} <span className="chip bg-paper border border-line">Grado {b.grade}</span><p className="text-xs text-muted font-mono">{b.imei}</p></td>
                <td className="p-3">{b.seller}</td>
                <td className="p-3 text-right tabular-nums">{money(b.price)}<p className="text-xs text-muted">{b.payout}</p></td>
                <td className="p-3 text-right tabular-nums">{money(b.sale_price)}</td>
                <td className="p-3 text-sm">{b.status === "anulada" ? <span className="text-bad">Anulada</span> : b.in_stock ? "En inventario" : "Vendido"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
