import Link from "next/link";
import { redirect } from "next/navigation";
import { listOrders, parseJSON, type OrderWithCustomer } from "@/lib/orders";
import { deviceType, serviceLabel } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { dateOnly, daysSince, money } from "@/lib/format";
import { dbx } from "@/lib/db";
import { lowStockCount } from "@/lib/inventory";
import Board, { type BoardCard } from "./Board";
import SearchBar from "./SearchBar";
import DailyAssistantBubble from "@/components/DailyAssistantBubble";

export const metadata = { title: "Tablero" };

const TODAY = "date('now', '-5 hours')";
const LOCAL = (col: string) => `date(${col}, '-5 hours')`;

async function kpis() {
  const one = async (sql: string) => Number(((await dbx.get(sql)) as { n: number | null }).n ?? 0);
  const [received, delivered, inc1, inc2, appointments, lowStock] = await Promise.all([
    one(`SELECT COUNT(*) n FROM orders WHERE ${LOCAL("created_at")} = ${TODAY}`),
    one(`SELECT COUNT(*) n FROM orders WHERE ${LOCAL("delivered_at")} = ${TODAY}`),
    one(`SELECT SUM(amount) n FROM payments WHERE sale_id IS NULL AND ${LOCAL("created_at")} = ${TODAY}`),
    one(`SELECT SUM(sp.amount) n FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.status = 'pagada' AND sp.method != 'Saldo a favor' AND ${LOCAL("s.created_at")} = ${TODAY}`),
    one(`SELECT COUNT(*) n FROM appointments WHERE date = ${TODAY} AND status IN ('pendiente','confirmada')`),
    lowStockCount(),
  ]);
  return { received, delivered, income: inc1 + inc2, appointments, lowStock };
}

export default async function Tablero({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const orders = await listOrders({ q });

  // Un código escaneado (número de orden exacto) abre la orden directamente.
  if (q) {
    const exact = orders.find((o) => o.number.toUpperCase() === q.trim().toUpperCase());
    if (exact) redirect(`/panel/orden/${exact.id}`);
  }

  const k = await kpis();
  const services = (o: OrderWithCustomer) => parseJSON<string[]>(o.services, []);
  const wetWaiting = orders.filter((o) => o.status === "recibido" && services(o).includes("mojado"));
  const legalNotice = orders.filter((o) => o.status === "listo" && daysSince(o.ready_at) >= 30);
  const decided = orders.filter((o) => o.status === "cotizado" && ["aprobada", "rechazada"].includes(o.quote_status));
  const active = orders.filter((o) => o.status !== "entregado").length;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

  const cards: BoardCard[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    model: o.model,
    brand: o.brand,
    customer: o.customer_name,
    phone: o.customer_phone,
    status: o.status,
    icon: deviceType(o.device_type).icon,
    services: services(o).map((x) => serviceLabel(o.device_type, x)),
    priority: o.priority,
    days: daysSince(o.created_at),
    quote: o.quote_status,
    overdue: o.due_date && o.due_date < today && !["listo", "entregado"].includes(o.status) ? dateOnly(o.due_date) : null,
    readyDays: o.status === "listo" ? daysSince(o.ready_at) : 0,
    wet: services(o).includes("mojado"),
    token: o.token,
    problem: o.problem,
    deviceType: o.device_type,
    diagnosticFee: o.diagnostic_fee,
    estimate: o.estimate,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Taller en vivo</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Tablero de Control</h1>
          <p className="text-sm text-slate-400 mt-0.5">{active} equipos activos · Arrastra las tarjetas entre columnas</p>
        </div>
        <SearchBar defaultValue={q} />
      </div>

      {!q && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <Kpi label="Recibidos hoy" value={String(k.received)} icon="📥" color="bg-blue-500/15 text-blue-400" />
          <Kpi label="Entregados hoy" value={String(k.delivered)} icon="✅" color="bg-indigo-500/15 text-indigo-400" />
          <Kpi label="Ingresos de hoy" value={money(k.income)} href="/panel/reportes" icon="💰" color="bg-emerald-500/15 text-emerald-400" />
          <Kpi label="Citas de hoy" value={String(k.appointments)} href="/panel/citas" icon="📅" color="bg-purple-500/15 text-purple-400" />
          <Kpi label="Stock bajo" value={String(k.lowStock)} href="/panel/inventario?bajo=1" warn={k.lowStock > 0} icon="⚠️" color="bg-amber-500/15 text-amber-400" />
        </div>
      )}

      {(wetWaiting.length > 0 || legalNotice.length > 0 || decided.length > 0) && !q && (
        <div className="grid gap-3.5 md:grid-cols-3">
          {wetWaiting.length > 0 && (
            <Alert tone="sky" title={`${wetWaiting.length} equipo(s) mojado(s) sin diagnosticar`} orders={wetWaiting} hint="La corrosión avanza: pásalos a diagnóstico hoy." />
          )}
          {decided.length > 0 && (
            <Alert tone="amber" title={`${decided.length} cotización(es) respondida(s)`} orders={decided} hint="El cliente ya aprobó o rechazó. Revisa la orden." />
          )}
          {legalNotice.length > 0 && (
            <Alert tone="red" title={`${legalNotice.length} equipo(s) listos hace >30 días`} orders={legalNotice} hint="Enviar aviso escrito por correo certificado (Ley 1480)." />
          )}
        </div>
      )}

      {q ? (
        <div className="card divide-y divide-white/[0.08] overflow-hidden">
          {orders.length === 0 && <p className="p-6 text-slate-400 text-center">No hay órdenes que coincidan con “{q}”.</p>}
          {orders.map((o) => (
            <Link key={o.id} href={`/panel/orden/${o.id}`} className="flex items-center gap-4 p-4 hover:bg-white/[0.04] transition">
              <span className="font-mono font-bold text-sm w-20 text-blue-400">{o.number}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{deviceType(o.device_type).icon} {o.model} · {o.customer_name}</p>
                <p className="text-sm text-slate-400">{o.customer_phone} · {o.imei || o.serial || "sin IMEI"} · {dateOnly(o.created_at)}</p>
              </div>
              <StatusBadge status={o.status} short />
            </Link>
          ))}
        </div>
      ) : (
        <Board cards={cards} />
      )}

      {/* Burbuja Asistente de Taller y Recordatorios Diarios */}
      <DailyAssistantBubble cards={cards} lowStock={k.lowStock} appointments={k.appointments} />
    </div>
  );
}

function Kpi({
  label,
  value,
  href,
  warn,
  icon,
  color,
}: {
  label: string;
  value: string;
  href?: string;
  warn?: boolean;
  icon: string;
  color: string;
}) {
  const body = (
    <div
      className={`card p-4 h-full relative overflow-hidden group hover:border-blue-500/40 transition-all duration-200 ${
        warn ? "border-amber-500/40 bg-amber-500/[0.06]" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-white">{value}</p>
      <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-white/[0.02] pointer-events-none group-hover:scale-125 transition-transform" />
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

function Alert({
  tone,
  title,
  hint,
  orders,
}: {
  tone: "sky" | "amber" | "red";
  title: string;
  hint: string;
  orders: OrderWithCustomer[];
}) {
  const styles = {
    sky: "bg-sky-500/10 border-sky-500/25 text-sky-200",
    amber: "bg-amber-500/10 border-amber-500/25 text-amber-200",
    red: "bg-rose-500/10 border-rose-500/25 text-rose-200",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 backdrop-blur-sm ${styles}`}>
      <p className="font-bold leading-snug text-white">{title}</p>
      <p className="text-xs text-slate-300 mt-0.5">{hint}</p>
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {orders.slice(0, 6).map((o) => (
          <Link
            key={o.id}
            href={`/panel/orden/${o.id}`}
            className="chip bg-white/[0.12] hover:bg-white/[0.22] border border-white/10 font-mono text-white text-xs"
          >
            {o.number}
          </Link>
        ))}
      </div>
    </div>
  );
}
