import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { dateTime, money, parseMoney } from "@/lib/format";
import { getOrder, totals } from "@/lib/orders";
import PrintButton from "../orden/[id]/imprimir/PrintButton";

export const metadata = { title: "Reportes" };

const L = (col: string) => `date(${col}, '-5 hours')`;

async function addExpense(fd: FormData) {
  "use server";
  const user = await requireUser();
  if (user.role === "tecnico") return;
  const amount = parseMoney(fd.get("amount"));
  const description = String(fd.get("description") || "").trim();
  if (!amount || !description) return;
  (await dbx.run("INSERT INTO expenses (description, category, amount, method, user_id) VALUES (?, ?, ?, ?, ?)", description, String(fd.get("category") || "Otro"), amount, String(fd.get("method") || "Efectivo"), user.id));
  revalidatePath("/panel/reportes");
}

async function deleteExpense(fd: FormData) {
  "use server";
  const user = await requireUser();
  if (user.role !== "admin") return;
  (await dbx.run("DELETE FROM expenses WHERE id = ?", parseInt(String(fd.get("id")), 10)));
  revalidatePath("/panel/reportes");
}

type Row = { method: string; n: number };

export default async function Reportes({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const user = await requireUser();
  if (user.role === "tecnico") redirect("/panel");
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const from = sp.desde || today;
  const to = sp.hasta || from;
  const d = dbx;
  const range = [from, to];

  // Entradas de dinero
  const orderPays = (await dbx.all(`SELECT method, SUM(amount) n FROM payments WHERE sale_id IS NULL AND ${L("created_at")} BETWEEN ? AND ? GROUP BY method`, ...range)) as Row[];
  const salePays = (await dbx.all(`SELECT sp.method, SUM(sp.amount) n FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
       WHERE s.status = 'pagada' AND sp.method != 'Saldo a favor' AND ${L("s.created_at")} BETWEEN ? AND ? GROUP BY sp.method`, ...range)) as Row[];
  // Salidas de dinero
  const buyOut = (await dbx.all(`SELECT payout AS method, SUM(price) n FROM buybacks WHERE status = 'pagada' AND payout != 'Saldo a favor' AND ${L("created_at")} BETWEEN ? AND ? GROUP BY payout`, ...range)) as Row[];
  const expOut = (await dbx.all(`SELECT method, SUM(amount) n FROM expenses WHERE ${L("created_at")} BETWEEN ? AND ? GROUP BY method`, ...range)) as Row[];

  const methods = Array.from(new Set([...PAYMENT_METHODS.filter((m) => m !== "Saldo a favor"), ...orderPays.map((r) => r.method), ...salePays.map((r) => r.method)]));
  const sum = (rows: Row[], m: string) => rows.filter((r) => r.method === m).reduce((s, r) => s + (r.n ?? 0), 0);
  const cash = methods
    .map((m) => {
      const inn = sum(orderPays, m) + sum(salePays, m);
      const out = sum(buyOut, m) + sum(expOut, m);
      return { method: m, inn, out, net: inn - out };
    })
    .filter((r) => r.inn || r.out);
  const totalIn = cash.reduce((s, r) => s + r.inn, 0);
  const totalOut = cash.reduce((s, r) => s + r.out, 0);

  // Rentabilidad
  const prod = (await dbx.get(`SELECT COALESCE(SUM(si.qty * si.unit_price),0) rev, COALESCE(SUM(si.qty * si.unit_cost),0) cost FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'pagada' AND si.order_id IS NULL AND ${L("s.created_at")} BETWEEN ? AND ?`, ...range)) as { rev: number; cost: number };
  const discounts = ((await dbx.get(`SELECT COALESCE(SUM(discount),0) n FROM sales WHERE status = 'pagada' AND ${L("created_at")} BETWEEN ? AND ?`, ...range)) as { n: number }).n;
  const delivered = (await dbx.all(`SELECT id, technician_id FROM orders WHERE status = 'entregado' AND ${L("delivered_at")} BETWEEN ? AND ?`, ...range)) as { id: number; technician_id: number | null }[];
  let repairRev = 0;
  let partsCost = 0;
  for (const r of delivered) {
    const o = (await getOrder(r.id))!;
    const t = await totals(r.id, o);
    repairRev += t.total;
    partsCost += t.items.reduce((s, i) => s + i.unit_cost * i.qty, 0);
  }
  const expenses = (await dbx.all(`SELECT e.*, u.name AS user_name FROM expenses e LEFT JOIN users u ON u.id = e.user_id WHERE ${L("e.created_at")} BETWEEN ? AND ? ORDER BY e.id DESC`, ...range)) as {
    id: number; description: string; category: string; amount: number; method: string; created_at: string; user_name: string | null;
  }[];
  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const gross = prod.rev - discounts - prod.cost + repairRev - partsCost;

  // Por empleado
  const staff = (await dbx.all(`SELECT u.id, u.name,
        (SELECT COUNT(*) FROM orders o WHERE o.received_by = u.id AND ${L("o.created_at")} BETWEEN ? AND ?) received,
        (SELECT COUNT(*) FROM orders o WHERE o.technician_id = u.id AND o.status = 'entregado' AND ${L("o.delivered_at")} BETWEEN ? AND ?) repaired,
        (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.user_id = u.id AND s.status = 'pagada' AND ${L("s.created_at")} BETWEEN ? AND ?) sold
       FROM users u WHERE u.active = 1 ORDER BY u.name`, from, to, from, to, from, to)) as { id: number; name: string; received: number; repaired: number; sold: number }[];
  const counts = (await dbx.get(`SELECT (SELECT COUNT(*) FROM orders WHERE ${L("created_at")} BETWEEN ? AND ?) received,
              (SELECT COUNT(*) FROM sales WHERE status = 'pagada' AND ${L("created_at")} BETWEEN ? AND ?) sales,
              (SELECT COUNT(*) FROM buybacks WHERE status = 'pagada' AND ${L("created_at")} BETWEEN ? AND ?) buybacks`, from, to, from, to, from, to)) as { received: number; sales: number; buybacks: number };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Reportes</h1>
          <p className="text-muted">{from === to ? `Día ${from}` : `Del ${from} al ${to}`} · {counts.received} órdenes recibidas · {delivered.length} entregadas · {counts.sales} ventas · {counts.buybacks} retomas</p>
        </div>
        <form className="no-print flex flex-wrap gap-2 items-end">
          <div>
            <label className="label">Desde</label>
            <input type="date" name="desde" defaultValue={from} className="input !min-h-10" />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" name="hasta" defaultValue={to} className="input !min-h-10" />
          </div>
          <button className="btn-ghost !min-h-10">Ver</button>
          <PrintButton />
        </form>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Entró a caja" value={money(totalIn)} />
        <Stat label="Salió de caja" value={money(totalOut)} />
        <Stat label="Utilidad bruta" value={money(gross)} hint="Ventas − costo + reparaciones entregadas − repuestos" />
        <Stat label="Utilidad después de gastos" value={money(gross - expTotal)} strong />
      </div>

      <section className="card p-4">
        <p className="section-title mb-2">Cierre de caja por medio de pago</p>
        <table className="w-full text-[15px]">
          <thead className="text-left text-sm text-muted">
            <tr><th className="py-1.5 font-semibold">Medio</th><th className="font-semibold text-right">Entradas</th><th className="font-semibold text-right">Salidas</th><th className="font-semibold text-right">Neto</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {cash.length === 0 && <tr><td colSpan={4} className="py-3 text-muted">Sin movimientos en el periodo.</td></tr>}
            {cash.map((r) => (
              <tr key={r.method}>
                <td className="py-2">{r.method}</td>
                <td className="text-right tabular-nums">{money(r.inn)}</td>
                <td className="text-right tabular-nums">{r.out ? `-${money(r.out)}` : "—"}</td>
                <td className="text-right tabular-nums font-bold">{money(r.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-muted mt-2">El neto en “Efectivo” es lo que debe haber en el cajón (más la base). Las retomas pagadas con saldo a favor no mueven caja.</p>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="card p-4 space-y-2">
          <p className="section-title">Rentabilidad</p>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[15px]">
            <dt>Venta de productos</dt><dd className="text-right tabular-nums">{money(prod.rev)}</dd>
            <dt className="text-muted">Descuentos</dt><dd className="text-right tabular-nums text-muted">-{money(discounts)}</dd>
            <dt className="text-muted">Costo de productos vendidos</dt><dd className="text-right tabular-nums text-muted">-{money(prod.cost)}</dd>
            <dt>Reparaciones entregadas ({delivered.length})</dt><dd className="text-right tabular-nums">{money(repairRev)}</dd>
            <dt className="text-muted">Costo de repuestos usados</dt><dd className="text-right tabular-nums text-muted">-{money(partsCost)}</dd>
            <dt className="font-bold border-t border-line pt-1.5">Utilidad bruta</dt><dd className="text-right tabular-nums font-bold border-t border-line pt-1.5">{money(gross)}</dd>
            <dt className="text-muted">Gastos</dt><dd className="text-right tabular-nums text-muted">-{money(expTotal)}</dd>
            <dt className="font-bold">Utilidad</dt><dd className="text-right tabular-nums font-bold">{money(gross - expTotal)}</dd>
          </dl>
        </section>

        <section className="card p-4">
          <p className="section-title mb-2">Por empleado</p>
          <table className="w-full text-[15px]">
            <thead className="text-left text-sm text-muted">
              <tr><th className="py-1.5 font-semibold">Empleado</th><th className="font-semibold text-right">Recibió</th><th className="font-semibold text-right">Reparó</th><th className="font-semibold text-right">Vendió</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {staff.map((u) => (
                <tr key={u.id}><td className="py-2">{u.name}</td><td className="text-right tabular-nums">{u.received}</td><td className="text-right tabular-nums">{u.repaired}</td><td className="text-right tabular-nums">{money(u.sold)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-muted mt-2">“Reparó” cuenta órdenes entregadas con ese técnico asignado.</p>
        </section>
      </div>

      <section className="card p-4 space-y-3">
        <p className="section-title">Gastos</p>
        <form action={addExpense} className="no-print grid sm:grid-cols-[1fr_180px_140px_150px_auto] gap-2">
          <input name="description" className="input" placeholder="Descripción" required />
          <select name="category" className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <input name="amount" className="input" inputMode="numeric" placeholder="$" required />
          <select name="method" className="input">{["Efectivo", "Transferencia", "Tarjeta", "Nequi", "Daviplata"].map((m) => <option key={m}>{m}</option>)}</select>
          <button className="btn-primary">Registrar</button>
        </form>
        {expenses.length > 0 && (
          <ul className="divide-y divide-line">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                <span>{e.description} <span className="text-sm text-muted">· {e.category} · {e.method} · {dateTime(e.created_at)}</span></span>
                <span className="flex items-center gap-3">
                  <b className="tabular-nums">{money(e.amount)}</b>
                  {user.role === "admin" && (
                    <form action={deleteExpense} className="no-print"><input type="hidden" name="id" value={e.id} /><button className="text-muted hover:text-bad text-lg">×</button></form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`card p-4 ${strong ? "bg-ink text-white border-ink" : ""}`}>
      <p className={`text-[13px] font-semibold ${strong ? "text-white/70" : "text-muted"}`}>{label}</p>
      <p className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}
