import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { DEVICE_TYPES, deviceType } from "@/lib/constants";
import { dateOnly, whatsappLink } from "@/lib/format";
import { publicBaseUrl } from "@/lib/orders";
import { CopyButton } from "../orden/[id]/client";

export const metadata = { title: "Citas" };

async function setStatus(fd: FormData) {
  "use server";
  await requireUser();
  const status = String(fd.get("status"));
  if (!["pendiente", "confirmada", "cancelada"].includes(status)) return;
  (await dbx.run("UPDATE appointments SET status = ? WHERE id = ?", status, parseInt(String(fd.get("id")), 10)));
  revalidatePath("/panel/citas");
}

async function createAppointment(fd: FormData) {
  "use server";
  await requireUser();
  const name = String(fd.get("name") || "").trim();
  const phone = String(fd.get("phone") || "").trim();
  if (!name || !phone || !fd.get("date") || !fd.get("time")) return;
  (await dbx.run("INSERT INTO appointments (name, phone, device_type, model, problem, date, time, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada', 'local')", name, phone, String(fd.get("device_type")), String(fd.get("model") || "") || null, String(fd.get("problem") || "") || null, String(fd.get("date")), String(fd.get("time"))));
  revalidatePath("/panel/citas");
}

const STATUS: Record<string, string> = { pendiente: "bg-amber-100 text-amber-800", confirmada: "bg-sky-100 text-sky-800", llego: "bg-good-soft text-good", cancelada: "bg-zinc-100 text-zinc-500" };
const STATUS_LABEL: Record<string, string> = { pendiente: "Por confirmar", confirmada: "Confirmada", llego: "Llegó · orden creada", cancelada: "Cancelada" };

export default async function Citas() {
  await requireUser();
  const rows = (await dbx.all("SELECT * FROM appointments WHERE date >= date('now', '-5 hours', '-1 day') ORDER BY date, time")) as { id: number; name: string; phone: string; device_type: string; model: string | null; problem: string | null; date: string; time: string; status: string; source: string; order_id: number | null }[];
  const bookingUrl = `${await publicBaseUrl()}/agendar`;
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Citas</h1>
          <p className="text-muted">Los clientes agendan en <a className="text-accent font-semibold" href={bookingUrl} target="_blank">{bookingUrl}</a></p>
        </div>
        <CopyButton text={bookingUrl} label="Copiar enlace para agendar" />
      </div>

      {rows.length === 0 && <p className="card p-6 text-muted">No hay citas próximas.</p>}
      {[...byDate.entries()].map(([date, list]) => (
        <section key={date} className="space-y-2">
          <h2 className="font-bold capitalize">{dateOnly(date)}</h2>
          <div className="card divide-y divide-line">
            {list.map((a) => (
              <div key={a.id} className="p-4 flex flex-wrap items-center gap-3">
                <span className="font-mono font-bold w-14">{a.time}</span>
                <div className="flex-1 min-w-52">
                  <p className="font-semibold">{deviceType(a.device_type).icon} {a.model || deviceType(a.device_type).label} · {a.name}</p>
                  <p className="text-sm text-muted">{a.phone}{a.problem ? ` · ${a.problem}` : ""}</p>
                </div>
                <span className={`chip ${STATUS[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                {a.status === "llego" && a.order_id ? (
                  <Link className="btn-ghost !min-h-10" href={`/panel/orden/${a.order_id}`}>Ver orden</Link>
                ) : a.status !== "cancelada" ? (
                  <div className="flex gap-2">
                    {a.status === "pendiente" && (
                      <a
                        className="btn-ghost !min-h-10"
                        target="_blank"
                        href={whatsappLink(a.phone, `Hola ${a.name.split(" ")[0]}, confirmamos tu cita el ${dateOnly(a.date)} a las ${a.time}. ¡Te esperamos!`)}
                      >
                        Confirmar por WhatsApp
                      </a>
                    )}
                    <form action={setStatus}>
                      <input type="hidden" name="id" value={a.id} />
                      {a.status === "pendiente" ? (
                        <button name="status" value="confirmada" className="btn-ghost !min-h-10">Marcar confirmada</button>
                      ) : (
                        <button name="status" value="cancelada" className="btn-ghost !min-h-10">Cancelar</button>
                      )}
                    </form>
                    <Link className="btn-primary !min-h-10" href={`/panel/nueva?cita=${a.id}`}>Llegó: recibir</Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      <details className="card p-5">
        <summary className="section-title cursor-pointer">+ Agendar cita manualmente</summary>
        <form action={createAppointment} className="grid sm:grid-cols-3 gap-3 mt-4">
          <input name="name" className="input" placeholder="Nombre" required />
          <input name="phone" className="input" placeholder="Celular" required />
          <select name="device_type" className="input">{DEVICE_TYPES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select>
          <input name="model" className="input" placeholder="Modelo" />
          <input name="date" type="date" className="input" required />
          <input name="time" type="time" className="input" required />
          <input name="problem" className="input sm:col-span-2" placeholder="Falla" />
          <button className="btn-primary">Agendar</button>
        </form>
      </details>
    </div>
  );
}
