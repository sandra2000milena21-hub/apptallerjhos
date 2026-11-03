import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { dbx, getSettings } from "@/lib/db";
import { getEvents, getMedia, getOrder, getPayments, parseJSON, publicBaseUrl, totals, type Media } from "@/lib/orders";
import { CHECK_LABELS, MEDIA_CATEGORIES, PAYMENT_METHODS, PRIORITIES, DIAGNOSTIC_PLANS, STATUSES, deviceType, type CheckValue } from "@/lib/constants";
import { listCatalog } from "@/lib/inventory";
import { getNotifications } from "@/lib/notify";
import { dateOnly, dateTime, money, whatsappLink } from "@/lib/format";
import { whatsappTemplates } from "@/lib/messages";
import { QuoteBadge, StatusBadge } from "@/components/StatusBadge";
import {
  addCatalogItem, addNote, addPayment, addQuoteItem, assignTechnician, changeStatus, decideQuote, deleteMedia, removeQuoteItem, resendNotice,
  sendQuote, setPriority, toggleMediaPublic, updateDueDate,
} from "./actions";
import { ChecklistOutForm, ConfirmButton, CopyButton, DeliverForm, OrderUploader, PartPicker, WompiButton } from "./client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const o = await getOrder(parseInt((await params).id, 10));
  return { title: o ? `${o.number} · ${o.model}` : "Orden" };
}

const CHECK_STYLE: Record<string, string> = { ok: "text-good", falla: "text-bad font-semibold", np: "text-muted" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nueva?: string }> }) {
  await requireUser();
  const id = parseInt((await params).id, 10);
  const o = await getOrder(id);
  if (!o) notFound();
  const { nueva } = await searchParams;

  const s = await getSettings();
  const media = (await getMedia(id)).filter((m) => m.kind !== "signature");
  const events = await getEvents(id);
  const payments = await getPayments(id);
  const t = await totals(id, o);
  const base = await publicBaseUrl();
  const trackUrl = `${base}/s/${o.token}`;
  const templates = whatsappTemplates(o, trackUrl, s, t);
  const services = parseJSON<string[]>(o.services, []);
  const dt = deviceType(o.device_type);
  const catalog = await listCatalog(o.device_type);
  const notices = await getNotifications(id);
  const wompiOn = Boolean(s.wompi_private_key);
  const checkIn = parseJSON<Record<string, CheckValue>>(o.checklist_in, {});
  const checkOut = parseJSON<Record<string, CheckValue>>(o.checklist_out, {});
  const techs = (await dbx.all("SELECT id, name FROM users WHERE active = 1 ORDER BY name")) as { id: number; name: string }[];
  const delivered = o.status === "entregado";

  return (
    <div className="space-y-5">
      {nueva && (
        <div className="rounded-2xl bg-good-soft border border-good/20 p-4 flex flex-wrap items-center gap-3">
          <p className="font-bold text-good flex-1 min-w-60">Orden {o.number} creada. Envíale al cliente su enlace de seguimiento.</p>
          <a className="btn-good" target="_blank" href={whatsappLink(o.customer_phone, templates[0].text)}>Enviar por WhatsApp</a>
          <Link className="btn-ghost" href={`/panel/orden/${o.id}/imprimir`} target="_blank">Imprimir orden</Link>
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-lg">{o.number}</span>
            <StatusBadge status={o.status} />
            <QuoteBadge quoteStatus={o.quote_status} />
            {o.priority === "urgente" ? (
              <span className="chip bg-pink-500/20 text-pink-300 border border-pink-500/40 font-bold">👑 Diagnóstico Premium VIP</span>
            ) : o.priority === "alta" ? (
              <span className="chip bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">⚡ Diagnóstico Express</span>
            ) : (
              <span className="chip bg-blue-500/15 text-blue-300 border border-blue-500/30">⏱️ Diagnóstico Normal (3-5 d)</span>
            )}
          </div>
          <h1 className="text-[28px] font-bold tracking-tight leading-tight mt-1">
            <span aria-hidden>{dt.icon}</span> {o.brand && !o.model.toLowerCase().startsWith(o.brand.toLowerCase()) ? `${o.brand} ` : ""}{o.model}
          </h1>
          <p className="text-muted">
            {o.customer_name} · <a className="text-accent font-semibold" href={`tel:${o.customer_phone}`}>{o.customer_phone}</a> · recibido {dateTime(o.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <CopyButton text={trackUrl} label="Copiar enlace del cliente" />
          <a className="btn-ghost" href={trackUrl} target="_blank">Ver como cliente</a>
          <Link className="btn-ghost" href={`/panel/orden/${o.id}/etiqueta`} target="_blank">Etiqueta</Link>
          <Link className="btn-ghost" href={`/panel/orden/${o.id}/imprimir`} target="_blank">Imprimir</Link>
          {o.device_id && <Link className="btn-ghost" href={`/panel/equipos/${o.device_id}`}>Historial del equipo</Link>}
        </div>
      </div>

      {/* Estados */}
      <form action={changeStatus} className="card p-4 space-y-3">
        <input type="hidden" name="orderId" value={o.id} />
        <p className="section-title">Cambiar estado</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.filter((st) => st.key !== "entregado").map((st) => (
            <button
              key={st.key}
              name="status"
              value={st.key}
              disabled={delivered}
              className={`rounded-2xl border px-3.5 min-h-11 text-sm font-semibold transition-all ${
                o.status === st.key
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20"
                  : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {st.short}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <input name="note" className="input flex-1 min-w-64" placeholder="Nota opcional con el cambio (ej. se pidió el repuesto, llega el jueves)" />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="public" defaultChecked className="size-5" /> Nota visible para el cliente
          </label>
        </div>
      </form>

      <div className="grid lg:grid-cols-[1fr_380px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {/* Fotos y video */}
          <section className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-title">Fotos y video</p>
              <span className="text-sm text-muted">{media.length} archivo(s)</span>
            </div>
            <OrderUploader orderId={o.id} defaultCategory={["recibido"].includes(o.status) ? "ingreso" : o.status === "listo" || delivered ? "entrega" : o.status === "diagnostico" ? "diagnostico" : "reparacion"} />
            {MEDIA_CATEGORIES.map((cat) => {
              const items = media.filter((m) => m.category === cat.key);
              if (!items.length) return null;
              return (
                <div key={cat.key}>
                  <p className="font-semibold text-sm mb-2">{cat.label} <span className="text-muted">({items.length})</span></p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {items.map((m) => (
                      <MediaTile key={m.id} m={m} orderId={o.id} />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Notas */}
          <section className="card p-4 space-y-3">
            <p className="section-title">Notas y diagnóstico</p>
            <form action={addNote} className="space-y-2">
              <input type="hidden" name="orderId" value={o.id} />
              <textarea name="body" className="input" rows={3} placeholder="Ej. Al destapar se encontró corrosión en el conector de batería…" required />
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="public" className="size-5" /> Visible para el cliente
                </label>
                <button className="btn-primary">Agregar nota</button>
              </div>
            </form>
          </section>

          {/* Historial */}
          <section className="card p-4">
            <p className="section-title mb-3">Historial</p>
            <ol className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className={`mt-1.5 size-2.5 rounded-full shrink-0 ${e.type === "status" ? "bg-accent" : e.type === "note" ? "bg-ink" : "bg-line"}`} />
                  <div className="min-w-0">
                    <p className="text-[15px] whitespace-pre-line">{e.body}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {dateTime(e.created_at)} · {e.user_name ?? e.author ?? "Sistema"}
                      {e.public ? " · visible al cliente" : " · interno"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          {/* Equipo */}
          <section className="card p-4 space-y-3">
            <p className="section-title">Equipo</p>
            <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[15px]">
              <dt className="text-muted">Color</dt><dd>{o.color || "—"}</dd>
              <dt className="text-muted">Capacidad</dt><dd>{o.capacity || "—"}</dd>
              <dt className="text-muted">IMEI</dt><dd className="font-mono break-all">{o.imei || "—"}</dd>
              <dt className="text-muted">Serial</dt><dd className="font-mono break-all">{o.serial || "—"}</dd>
              <dt className="text-muted">Código</dt><dd className="font-mono">{o.passcode || "—"}</dd>
              <dt className="text-muted">Batería</dt><dd>{o.battery_health || "—"}</dd>
              <dt className="text-muted">Accesorios</dt><dd>{o.accessories || "Ninguno"}</dd>
              <dt className="text-muted">Estado físico</dt><dd>{o.condition_notes || "—"}</dd>
            </dl>
            <div className="flex flex-wrap gap-1.5">
              <span className="chip bg-blue-500/20 text-blue-300 border border-blue-500/30">{dt.label}</span>
              {services.map((k) => (
                <span key={k} className="chip bg-white/[0.06] text-slate-300 border border-white/[0.08]">{dt.services.find((x) => x.key === k)?.label ?? k}</span>
              ))}
              {o.entered_off ? <span className="chip bg-amber-500/20 text-amber-300 border border-amber-500/30">Ingresó apagado</span> : null}
            </div>
            <div className="rounded-2xl bg-[#0e1828] border border-white/[0.06] p-3.5">
              <p className="text-xs font-semibold text-slate-400 mb-1">Falla según el cliente</p>
              <p className="text-[15px] text-white whitespace-pre-line">{o.problem}</p>
            </div>
            <form action={setPriority} className="flex flex-wrap gap-1.5 items-center">
              <input type="hidden" name="orderId" value={o.id} />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Modalidad:</span>
              {DIAGNOSTIC_PLANS.map((p) => (
                <button
                  key={p.key}
                  name="priority"
                  value={p.key}
                  className={`rounded-xl border px-3 min-h-9 text-xs font-semibold transition-all ${
                    o.priority === p.key
                      ? p.key === "urgente"
                        ? "bg-pink-600 text-white border-pink-400 shadow-sm"
                        : p.key === "alta"
                        ? "bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400"
                      : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white"
                  }`}
                >
                  {p.title} ({p.time})
                </button>
              ))}
            </form>
            <form action={assignTechnician} className="flex gap-2">
              <input type="hidden" name="orderId" value={o.id} />
              <select name="technician_id" defaultValue={o.technician_id ?? ""} className="input !min-h-10">
                <option value="">Técnico sin asignar</option>
                {techs.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <button className="btn-ghost !min-h-10">Asignar</button>
            </form>
            <form action={updateDueDate} className="flex gap-2 items-end">
              <input type="hidden" name="orderId" value={o.id} />
              <div className="flex-1">
                <label className="label">Fecha estimada de entrega</label>
                <input type="date" name="due_date" defaultValue={o.due_date ?? ""} className="input !min-h-10" />
              </div>
              <button className="btn-ghost !min-h-10">Guardar</button>
            </form>
          </section>

          {/* Cotización */}
          <section className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="section-title">Cotización</p>
              <QuoteBadge quoteStatus={o.quote_status} />
            </div>
            {t.items.length > 0 ? (
              <ul className="divide-y divide-line">
                {t.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 py-2">
                    <span className="flex-1">{it.description}{it.product_id ? <span className="chip bg-paper border border-line ml-1.5">inventario</span> : null}</span>
                    <span className="font-semibold tabular-nums">{money(it.amount)}</span>
                    {o.quote_status !== "aprobada" && (
                      <form action={removeQuoteItem}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <input type="hidden" name="itemId" value={it.id} />
                        <button className="text-muted hover:text-bad px-1 text-lg" aria-label="Quitar">×</button>
                      </form>
                    )}
                  </li>
                ))}
                <li className="flex justify-between py-2 font-bold"><span>Total</span><span className="tabular-nums">{money(t.quoteTotal)}</span></li>
              </ul>
            ) : (
              <p className="text-sm text-muted">Sin ítems todavía. Estimado al recibir: {money(o.estimate)}</p>
            )}
            {o.quote_status !== "aprobada" && !delivered && catalog.length > 0 && (
              <form action={addCatalogItem} className="flex gap-2">
                <input type="hidden" name="orderId" value={o.id} />
                <select name="catalogId" className="input !min-h-10" defaultValue="">
                  <option value="" disabled>Reparación del catálogo…</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {money(c.price)}{c.product_id ? ` · ${c.product_stock ?? 0} en stock` : ""}
                    </option>
                  ))}
                </select>
                <button className="btn-ghost !min-h-10">+</button>
              </form>
            )}
            {o.quote_status !== "aprobada" && !delivered && <PartPicker orderId={o.id} />}
            {o.quote_status !== "aprobada" && !delivered && (
              <form action={addQuoteItem} className="grid grid-cols-[1fr_120px_auto] gap-2">
                <input type="hidden" name="orderId" value={o.id} />
                <input name="description" className="input !min-h-10" placeholder="Pantalla OLED" required />
                <input name="amount" className="input !min-h-10" inputMode="numeric" placeholder="$" required />
                <button className="btn-ghost !min-h-10">+</button>
              </form>
            )}
            {t.items.length > 0 && !delivered && (
              <div className="flex flex-wrap gap-2">
                {o.quote_status !== "aprobada" && (
                  <form action={sendQuote}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <button className="btn-accent">{o.quote_status === "pendiente" ? "Reenviar al cliente" : "Enviar al cliente"}</button>
                  </form>
                )}
                {o.quote_status === "pendiente" && (
                  <>
                    <form action={decideQuote}>
                      <input type="hidden" name="orderId" value={o.id} />
                      <input type="hidden" name="decision" value="aprobada" />
                      <button className="btn-ghost">Aprobó por WhatsApp</button>
                    </form>
                    <form action={decideQuote}>
                      <input type="hidden" name="orderId" value={o.id} />
                      <input type="hidden" name="decision" value="rechazada" />
                      <button className="btn-bad">Rechazó</button>
                    </form>
                  </>
                )}
              </div>
            )}
            {o.quote_decided_at && (
              <p className="text-xs text-muted">
                {o.quote_status === "aprobada" ? "Aprobada" : "Rechazada"} el {dateTime(o.quote_decided_at)} · {o.quote_decided_by}
              </p>
            )}
          </section>

          {/* Pagos */}
          <section className="card p-4 space-y-3">
            <p className="section-title">Pagos</p>
            <dl className="grid grid-cols-2 gap-y-1 text-[15px]">
              <dt className="text-muted">Diagnóstico</dt><dd className="text-right tabular-nums">{money(o.diagnostic_fee)}</dd>
              <dt className="text-muted">Total a cobrar</dt><dd className="text-right tabular-nums font-semibold">{money(t.total)}</dd>
              <dt className="text-muted">Pagado</dt><dd className="text-right tabular-nums">{money(t.paid)}</dd>
              <dt className="font-bold">Saldo</dt><dd className={`text-right tabular-nums font-bold ${t.balance > 0 ? "text-warn" : "text-good"}`}>{money(t.balance)}</dd>
            </dl>
            {payments.length > 0 && (
              <ul className="text-sm divide-y divide-line border-t border-line">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between py-1.5">
                    <span>{dateOnly(p.created_at)} · {p.method}{p.note ? ` · ${p.note}` : ""}</span>
                    <span className="tabular-nums font-semibold">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {!delivered && t.balance > 0 && (
              <div className="grid grid-cols-1 gap-2">
                <Link className="btn-primary" href={`/panel/caja?orden=${o.id}`}>Cobrar en caja ({money(t.balance)})</Link>
                {wompiOn && <WompiButton orderId={o.id} phone={o.customer_phone} orderNumber={o.number} />}
              </div>
            )}
            <form action={addPayment} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input type="hidden" name="orderId" value={o.id} />
              <input name="amount" className="input !min-h-10" inputMode="numeric" placeholder="Valor" required />
              <select name="method" className="input !min-h-10">
                {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
              <button className="btn-ghost !min-h-10">Registrar</button>
            </form>
          </section>

          {/* WhatsApp */}
          <section className="card p-4 space-y-2">
            <p className="section-title">Mensajes por WhatsApp</p>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((tpl) => (
                <a key={tpl.key} target="_blank" className="btn-ghost !justify-start !text-sm" href={whatsappLink(o.customer_phone, tpl.text)}>
                  {tpl.label}
                </a>
              ))}
            </div>
          </section>

          {/* Avisos automáticos */}
          <section className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="section-title">Avisos automáticos</p>
              <form action={resendNotice}>
                <input type="hidden" name="orderId" value={o.id} />
                <button className="text-sm font-semibold text-accent">Reenviar estado actual</button>
              </form>
            </div>
            {notices.length === 0 ? (
              <p className="text-sm text-muted">Sin avisos enviados. Actívalos en Ajustes → Integraciones (WhatsApp, SMS o correo).</p>
            ) : (
              <ul className="text-sm divide-y divide-line">
                {notices.map((n) => (
                  <li key={n.id} className="py-1.5 flex justify-between gap-2">
                    <span>{n.channel} · {dateTime(n.created_at)}</span>
                    <span className={n.status === "enviado" ? "text-good font-semibold" : "text-bad font-semibold"} title={n.detail ?? ""}>{n.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Pruebas */}
          <section className="card p-4 space-y-3">
            <p className="section-title">Pruebas: ingreso y salida</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted"><th className="font-semibold py-1">Prueba</th><th className="font-semibold">Ingreso</th><th className="font-semibold">Salida</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {dt.checklist.map((i) => (
                  <tr key={i.key}>
                    <td className="py-1.5 pr-2">{i.label}</td>
                    <td className={CHECK_STYLE[checkIn[i.key] ?? "np"]}>{CHECK_LABELS[checkIn[i.key] ?? "np"]}</td>
                    <td className={checkOut[i.key] ? CHECK_STYLE[checkOut[i.key]] : "text-muted"}>{checkOut[i.key] ? CHECK_LABELS[checkOut[i.key]] : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!delivered && (
              <details className="rounded-xl bg-paper p-3" open={o.status === "control_calidad"}>
                <summary className="font-semibold cursor-pointer">Hacer control de calidad (salida)</summary>
                <div className="mt-3">
                  <ChecklistOutForm orderId={o.id} initial={checkOut} items={dt.checklist} />
                </div>
              </details>
            )}
          </section>

          {/* Entrega */}
          <section className="card p-4 space-y-3">
            <p className="section-title">Entrega</p>
            {delivered ? (
              <div className="space-y-2 text-[15px]">
                <p>Entregado el {dateTime(o.delivered_at)} a <b>{o.delivered_to}</b>.</p>
                {o.delivery_signature && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${o.delivery_signature}`} alt="Firma de recibido" className="h-24 rounded-lg border border-line bg-white" />
                )}
                <p className="text-sm text-muted">Garantía hasta el {dateOnly(addMonths(o.delivered_at!, o.warranty_months))}.</p>
              </div>
            ) : o.status === "listo" ? (
              <DeliverForm orderId={o.id} customerName={o.customer_name} balance={t.balance} />
            ) : (
              <p className="text-sm text-muted">La entrega se habilita cuando la orden está en “Listo para entrega”.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function addMonths(utc: string, months: number): string {
  const d = new Date(utc.replace(" ", "T") + "Z");
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function MediaTile({ m, orderId }: { m: Media; orderId: number }) {
  const src = `/api/media/${m.id}`;
  return (
    <div className="rounded-xl overflow-hidden border border-line bg-white">
      <a href={src} target="_blank" className="block aspect-square bg-black/5">
        {m.kind === "video" ? (
          <video src={src} className="w-full h-full object-cover" preload="metadata" muted playsInline controls />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
        )}
      </a>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
        <form action={toggleMediaPublic}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="mediaId" value={m.id} />
          <button className={`chip ${m.public ? "bg-good-soft text-good" : "bg-paper text-muted border border-line"}`} title="Cambiar visibilidad">
            {m.public ? "Cliente la ve" : "Interna"}
          </button>
        </form>
        <form action={deleteMedia}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="mediaId" value={m.id} />
          <ConfirmButton className="text-muted hover:text-bad font-semibold" message="¿Eliminar este archivo? No se puede deshacer.">Eliminar</ConfirmButton>
        </form>
      </div>
    </div>
  );
}
