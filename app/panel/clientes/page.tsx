import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { money } from "@/lib/format";

export const metadata = { title: "Clientes" };

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q } = await searchParams;
  const like = `%${(q ?? "").trim()}%`;
  const rows = (await dbx.all(`SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders,
              (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.customer_id = c.id AND s.status = 'pagada') AS spent,
              (SELECT MAX(created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order
       FROM customers c WHERE c.name LIKE ? OR c.phone LIKE ? OR c.doc_id LIKE ? OR c.email LIKE ?
       ORDER BY COALESCE(last_order, c.created_at) DESC LIMIT 300`, like, like, like, like)) as { id: number; name: string; phone: string; doc_id: string | null; store_credit: number; points?: number; orders: number; spent: number }[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[28px] font-bold tracking-tight">Clientes</h1>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} className="input sm:w-80" placeholder="Nombre, celular, cédula o correo" type="search" />
          <button className="btn-ghost">Buscar</button>
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead className="text-left text-sm text-muted border-b border-line">
            <tr>
              <th className="p-3 font-semibold">Cliente</th>
              <th className="p-3 font-semibold">Celular</th>
              <th className="p-3 font-semibold text-right">Órdenes</th>
              <th className="p-3 font-semibold text-right">Compras</th>
              <th className="p-3 font-semibold text-right">Puntos</th>
              <th className="p-3 font-semibold text-right">Saldo a favor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-muted">Sin resultados.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-paper">
                <td className="p-3"><Link href={`/panel/clientes/${c.id}`} className="font-semibold hover:text-accent">{c.name}</Link><p className="text-xs text-muted">{c.doc_id ? `C.C. ${c.doc_id}` : ""}</p></td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3 text-right tabular-nums">{c.orders}</td>
                <td className="p-3 text-right tabular-nums">{money(c.spent)}</td>
                <td className="p-3 text-right tabular-nums">
                  {c.points ? <span className="chip bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">⭐ {c.points} pts</span> : "—"}
                </td>
                <td className="p-3 text-right tabular-nums">{c.store_credit ? <span className="chip bg-good-soft text-good">{money(c.store_credit)}</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
