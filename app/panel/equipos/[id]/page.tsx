import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { deviceHistory, type Device } from "@/lib/devices";
import { deviceType, serviceLabel } from "@/lib/constants";
import { parseJSON } from "@/lib/orders";
import { StatusBadge } from "@/components/StatusBadge";
import { dateOnly } from "@/lib/format";

export const metadata = { title: "Historial del equipo" };

export default async function DevicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const d = (await dbx.get("SELECT * FROM devices WHERE id = ?", parseInt((await params).id, 10))) as Device | undefined;
  if (!d) notFound();
  const owner = d.customer_id ? ((await dbx.get("SELECT id, name, phone FROM customers WHERE id = ?", d.customer_id)) as { id: number; name: string; phone: string }) : null;
  const history = await deviceHistory(d.id);
  const dt = deviceType(d.device_type);
  const notes = (await dbx.all(`SELECT e.body, e.created_at, o.number FROM events e JOIN orders o ON o.id = e.order_id
       WHERE o.device_id = ? AND e.type = 'note' ORDER BY e.created_at DESC LIMIT 30`, d.id)) as { body: string; created_at: string; number: string }[];

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <p className="text-muted font-semibold text-sm">Historial clínico del equipo</p>
        <h1 className="text-[28px] font-bold tracking-tight">{dt.icon} {d.brand ? `${d.brand} ` : ""}{d.model}</h1>
        <p className="text-muted">
          {[d.color, d.capacity].filter(Boolean).join(" · ")} {d.imei && <>· IMEI <span className="font-mono">{d.imei}</span></>} {d.serial && <>· Serial <span className="font-mono">{d.serial}</span></>}
        </p>
        {owner && (
          <p className="mt-1">Dueño actual: <Link className="text-accent font-semibold" href={`/panel/clientes/${owner.id}`}>{owner.name}</Link> · {owner.phone}</p>
        )}
      </div>

      <section className="card divide-y divide-line">
        <p className="section-title p-4">{history.length} reparación(es)</p>
        {history.map((h) => (
          <Link key={h.id} href={`/panel/orden/${h.id}`} className="flex gap-4 p-4 hover:bg-paper">
            <div className="w-24 shrink-0">
              <p className="font-mono font-bold">{h.number}</p>
              <p className="text-sm text-muted">{dateOnly(h.created_at)}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{parseJSON<string[]>(h.services, []).map((k) => serviceLabel(d.device_type, k)).join(", ")}</p>
              <p className="text-sm text-muted line-clamp-2">{h.problem}</p>
              <p className="text-xs text-muted mt-0.5">Cliente: {h.customer_name}</p>
            </div>
            <StatusBadge status={h.status} short />
          </Link>
        ))}
      </section>

      {notes.length > 0 && (
        <section className="card p-4 space-y-3">
          <p className="section-title">Notas técnicas</p>
          {notes.map((n, i) => (
            <div key={i}>
              <p className="text-[15px] whitespace-pre-line">{n.body}</p>
              <p className="text-xs text-muted">{n.number} · {dateOnly(n.created_at)}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
