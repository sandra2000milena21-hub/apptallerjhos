import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { deviceType } from "@/lib/constants";
import { dateOnly, money, parseMoney, whatsappLink } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Cliente" };

async function saveCustomer(fd: FormData) {
  "use server";
  await requireUser();
  const id = parseInt(String(fd.get("id")), 10);
  (await dbx.run("UPDATE customers SET name = ?, doc_id = ?, phone = ?, email = ?, notes = ? WHERE id = ?", String(fd.get("name")), String(fd.get("doc_id") || "") || null, String(fd.get("phone")), String(fd.get("email") || "") || null, String(fd.get("notes") || "") || null, id));
  revalidatePath(`/panel/clientes/${id}`);
}

async function adjustCredit(fd: FormData) {
  "use server";
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = parseInt(String(fd.get("id")), 10);
  const sign = fd.get("op") === "restar" ? -1 : 1;
  (await dbx.run("UPDATE customers SET store_credit = MAX(store_credit + ?, 0) WHERE id = ?", sign * parseMoney(fd.get("amount")), id));
  revalidatePath(`/panel/clientes/${id}`);
}

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = parseInt((await params).id, 10);
  const c = (await dbx.get("SELECT * FROM customers WHERE id = ?", id)) as
    | { id: number; name: string; doc_id: string | null; phone: string; email: string | null; notes: string | null; store_credit: number; created_at: string }
    | undefined;
  if (!c) notFound();
  const orders = (await dbx.all("SELECT id, number, model, device_type, status, created_at FROM orders WHERE customer_id = ? ORDER BY id DESC", id)) as {
    id: number; number: string; model: string; device_type: string; status: string; created_at: string;
  }[];
  const devices = (await dbx.all("SELECT * FROM devices WHERE customer_id = ? ORDER BY id DESC", id)) as { id: number; model: string; device_type: string; imei: string | null; serial: string | null }[];
  const sales = (await dbx.all("SELECT id, number, total, status, created_at FROM sales WHERE customer_id = ? ORDER BY id DESC LIMIT 30", id)) as {
    id: number; number: string; total: number; status: string; created_at: string;
  }[];
  const buybacks = (await dbx.all("SELECT id, number, model, price, created_at FROM buybacks WHERE customer_id = ? ORDER BY id DESC", id)) as {
    id: number; number: string; model: string; price: number; created_at: string;
  }[];

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        <div>
          <Link href="/panel/clientes" className="text-sm font-semibold text-accent">← Clientes</Link>
          <h1 className="text-[28px] font-bold tracking-tight">{c.name}</h1>
          <p className="text-muted">Cliente desde {dateOnly(c.created_at)} · {orders.length} órdenes · {sales.length} compras</p>
          <div className="flex gap-2 mt-2">
            <a className="btn-good" target="_blank" href={whatsappLink(c.phone, `Hola ${c.name.split(" ")[0]}, `)}>WhatsApp</a>
            <Link className="btn-ghost" href={`/panel/caja`}>Nueva venta</Link>
          </div>
        </div>
        <section className="card divide-y divide-line">
          <p className="section-title p-4">Órdenes de reparación</p>
          {orders.length === 0 && <p className="p-4 text-muted text-sm">Sin órdenes.</p>}
          {orders.map((o) => (
            <Link key={o.id} href={`/panel/orden/${o.id}`} className="flex items-center gap-3 p-4 hover:bg-paper">
              <span className="font-mono font-bold w-20">{o.number}</span>
              <span className="flex-1">{deviceType(o.device_type).icon} {o.model}</span>
              <span className="text-sm text-muted">{dateOnly(o.created_at)}</span>
              <StatusBadge status={o.status} short />
            </Link>
          ))}
        </section>
        <section className="card divide-y divide-line">
          <p className="section-title p-4">Equipos</p>
          {devices.length === 0 && <p className="p-4 text-muted text-sm">Sin equipos registrados.</p>}
          {devices.map((d) => (
            <Link key={d.id} href={`/panel/equipos/${d.id}`} className="flex gap-3 p-4 hover:bg-paper">
              <span className="flex-1">{deviceType(d.device_type).icon} {d.model}</span>
              <span className="font-mono text-sm text-muted">{d.imei || d.serial || ""}</span>
            </Link>
          ))}
        </section>
        {(sales.length > 0 || buybacks.length > 0) && (
          <section className="card divide-y divide-line">
            <p className="section-title p-4">Compras y retomas</p>
            {sales.map((s) => (
              <Link key={`s${s.id}`} href={`/panel/ventas/${s.id}`} className="flex justify-between p-4 hover:bg-paper">
                <span><span className="font-mono font-bold">{s.number}</span> · {dateOnly(s.created_at)}</span>
                <span className={`tabular-nums ${s.status === "anulada" ? "line-through text-muted" : "font-semibold"}`}>{money(s.total)}</span>
              </Link>
            ))}
            {buybacks.map((b) => (
              <Link key={`b${b.id}`} href={`/panel/retomas/${b.id}`} className="flex justify-between p-4 hover:bg-paper">
                <span><span className="font-mono font-bold">{b.number}</span> · Retoma {b.model} · {dateOnly(b.created_at)}</span>
                <span className="tabular-nums text-bad">-{money(b.price)}</span>
              </Link>
            ))}
          </section>
        )}
      </div>
      <aside className="space-y-5">
        <form action={saveCustomer} className="card p-4 space-y-3">
          <input type="hidden" name="id" value={c.id} />
          <p className="section-title">Datos</p>
          <input name="name" className="input" defaultValue={c.name} required />
          <input name="phone" className="input" defaultValue={c.phone} required />
          <input name="doc_id" className="input" defaultValue={c.doc_id ?? ""} placeholder="Cédula" />
          <input name="email" className="input" defaultValue={c.email ?? ""} placeholder="Correo" />
          <textarea name="notes" className="input" rows={3} defaultValue={c.notes ?? ""} placeholder="Notas internas" />
          <button className="btn-primary w-full">Guardar</button>
        </form>
        <section className="card p-4 space-y-3">
          <p className="section-title">Saldo a favor</p>
          <p className="text-2xl font-bold">{money(c.store_credit)}</p>
          <p className="text-sm text-muted">Se genera con retomas pagadas como saldo y se usa en la caja.</p>
          {user.role === "admin" && (
            <form action={adjustCredit} className="flex gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="amount" className="input !min-h-10" inputMode="numeric" placeholder="$" required />
              <button name="op" value="sumar" className="btn-ghost !min-h-10">+</button>
              <button name="op" value="restar" className="btn-ghost !min-h-10">−</button>
            </form>
          )}
        </section>
      </aside>
    </div>
  );
}
