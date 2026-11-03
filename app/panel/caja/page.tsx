import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { dateTime, money } from "@/lib/format";
import POS from "./POS";
import { orderLineAction } from "./actions";

export const metadata = { title: "Caja" };

export default async function Caja({ searchParams }: { searchParams: Promise<{ orden?: string }> }) {
  await requireUser();
  const { orden } = await searchParams;
  const initialOrder = orden ? await orderLineAction(parseInt(orden, 10)) : null;
  const sales = (await dbx.all(`SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
       WHERE date(s.created_at, '-5 hours') = date('now', '-5 hours') ORDER BY s.id DESC`,)) as { id: number; number: string; total: number; status: string; created_at: string; customer_name: string | null }[];

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-bold tracking-tight">Caja</h1>
      <POS initialOrder={initialOrder} />
      <section className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="section-title">Ventas de hoy</p>
          <Link href="/panel/reportes" className="text-sm font-semibold text-accent">Cierre de caja →</Link>
        </div>
        {sales.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay ventas hoy.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sales.map((s) => (
              <li key={s.id}>
                <Link href={`/panel/ventas/${s.id}`} className="flex justify-between py-2 hover:bg-paper px-1">
                  <span><span className="font-mono font-bold">{s.number}</span> · {s.customer_name ?? "Cliente de mostrador"} · {dateTime(s.created_at)}</span>
                  <span className={`tabular-nums font-semibold ${s.status === "anulada" ? "line-through text-muted" : ""}`}>{money(s.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
