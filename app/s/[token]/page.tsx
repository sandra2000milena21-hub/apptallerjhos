import { notFound } from "next/navigation";
import { getSettings } from "@/lib/db";
import { getEvents, getMedia, getOrderByToken, parseJSON, totals } from "@/lib/orders";
import { CLIENT_STEPS, MEDIA_CATEGORIES, serviceLabel, statusInfo } from "@/lib/constants";
import { dateOnly, dateTime, money, whatsappLink } from "@/lib/format";
import { clientDecideQuote } from "./actions";

export const metadata = { title: "Estado de tu reparación", robots: { index: false } };

const STEP_LABELS: Record<string, string> = {
  recibido: "Recibido",
  diagnostico: "En diagnóstico",
  cotizado: "Cotización",
  en_reparacion: "En reparación",
  control_calidad: "Control de calidad",
  listo: "Listo para recoger",
  entregado: "Entregado",
};

export default async function ClientTracking({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const o = await getOrderByToken(token);
  if (!o) notFound();
  const s = await getSettings();
  const media = (await getMedia(o.id)).filter((m) => m.public === 1 && m.kind !== "signature");
  const events = await getEvents(o.id, true);
  const t = await totals(o.id, o);
  const services = parseJSON<string[]>(o.services, []).map((k) => serviceLabel(o.device_type, k));
  const info = statusInfo(o.status);

  // El paso "Esperando repuesto" se muestra como parte de "Reparación".
  const effective = o.status === "esperando_repuesto" ? "en_reparacion" : o.status;
  const stepIndex = CLIENT_STEPS.indexOf(effective as (typeof CLIENT_STEPS)[number]);
  const firstName = o.customer_name.split(" ")[0];
  const shopWa = s.shop_whatsapp || s.shop_phone;

  return (
    <main className="mx-auto max-w-xl px-4 py-6 space-y-4">
      <header className="flex items-center justify-between">
        <p className="font-bold tracking-tight text-[17px]">{s.shop_name}</p>
        <span className="font-mono text-sm font-bold text-muted">{o.number}</span>
      </header>

      <section className="card p-5">
        <p className="text-muted text-[15px]">Hola {firstName}, tu {o.model}</p>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight mt-0.5">{info.client}</h1>
        {o.status === "esperando_repuesto" && <p className="mt-1 text-warn font-semibold">Estamos esperando el repuesto.</p>}
        {o.due_date && !["listo", "entregado"].includes(o.status) && (
          <p className="text-[15px] mt-2">Entrega estimada: <b className="text-white">{dateOnly(o.due_date)}</b></p>
        )}
        {o.priority === "urgente" && (
          <div className="mt-3 p-3 rounded-2xl bg-pink-500/15 border border-pink-500/30 text-pink-200 text-xs flex items-center gap-2">
            <span className="text-base">👑</span>
            <div>
              <p className="font-bold">Servicio Premium VIP</p>
              <p className="text-pink-300/80">Revisión prioritaria inmediata con instrumental especializado a la vista.</p>
            </div>
          </div>
        )}
        {o.priority === "alta" && (
          <div className="mt-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
            <span className="text-base">⚡</span>
            <div>
              <p className="font-bold">Servicio Express (24 horas)</p>
              <p className="text-amber-300/80">Prioridad alta con entrega de dictamen de un día para otro.</p>
            </div>
          </div>
        )}
        <ol className="mt-5 space-y-0">
          {CLIENT_STEPS.map((k, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={k} className="flex gap-3 items-stretch">
                <div className="flex flex-col items-center">
                  <span
                    className={`size-6 rounded-full grid place-items-center text-[12px] font-bold shrink-0 ${
                      done ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30" : current ? "bg-blue-600 text-white ring-4 ring-blue-500/25" : "bg-white/[0.08] text-slate-500 border border-white/[0.08]"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  {i < CLIENT_STEPS.length - 1 && <span className={`w-0.5 flex-1 min-h-4 ${done ? "bg-emerald-500/60" : "bg-white/[0.08]"}`} />}
                </div>
                <p className={`pb-3 text-[15px] ${current ? "font-bold text-white" : done ? "text-slate-200" : "text-slate-500"}`}>{STEP_LABELS[k]}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {t.items.length > 0 && o.quote_status !== "ninguna" && (
        <section className={`card p-5 space-y-3 ${o.quote_status === "pendiente" ? "ring-2 ring-accent" : ""}`}>
          <h2 className="section-title">Cotización</h2>
          <ul className="divide-y divide-line">
            {t.items.map((it) => (
              <li key={it.id} className="flex justify-between py-2 text-[15px]">
                <span>{it.description}</span>
                <span className="font-semibold tabular-nums">{money(it.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between py-2 font-bold text-[17px]"><span>Total</span><span>{money(t.quoteTotal)}</span></li>
          </ul>
          <p className="text-sm text-muted">Garantía de {o.warranty_months} meses sobre la pieza cambiada y la mano de obra.</p>
          {o.quote_status === "pendiente" ? (
            <div className="grid grid-cols-2 gap-2">
              <form action={clientDecideQuote}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="decision" value="rechazada" />
                <button className="btn-bad w-full">No, gracias</button>
              </form>
              <form action={clientDecideQuote}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="decision" value="aprobada" />
                <button className="btn-good w-full">Apruebo la reparación</button>
              </form>
            </div>
          ) : (
            <p className={`rounded-xl px-3 py-2 font-semibold ${o.quote_status === "aprobada" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
              {o.quote_status === "aprobada" ? "Aprobada" : "Rechazada"} el {dateTime(o.quote_decided_at)}
            </p>
          )}
        </section>
      )}

      {media.length > 0 && (
        <section className="card p-5 space-y-4">
          <h2 className="section-title">Fotos y videos de tu equipo</h2>
          {MEDIA_CATEGORIES.map((cat) => {
            const items = media.filter((m) => m.category === cat.key);
            if (!items.length) return null;
            return (
              <div key={cat.key}>
                <p className="font-semibold text-sm mb-2">{cat.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {items.map((m) => {
                    const src = `/api/media/${m.id}?t=${token}`;
                    return m.kind === "video" ? (
                      <video key={m.id} src={src} controls playsInline preload="metadata" className="col-span-3 w-full rounded-xl bg-black" />
                    ) : (
                      <a key={m.id} href={src} target="_blank" className="block aspect-square rounded-xl overflow-hidden bg-black/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={cat.label} loading="lazy" className="w-full h-full object-cover" />
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="card p-5 space-y-3">
        <h2 className="section-title">Novedades</h2>
        <ol className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="mt-1.5 size-2 rounded-full bg-accent shrink-0" />
              <div>
                <p className="text-[15px] whitespace-pre-line">{e.body}</p>
                <p className="text-xs text-muted">{dateTime(e.created_at)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-5 space-y-2 text-[15px]">
        <h2 className="section-title">Tu orden</h2>
        <dl className="grid grid-cols-[130px_1fr] gap-y-1.5">
          <dt className="text-muted">Equipo</dt><dd>{o.model} {o.capacity ?? ""} {o.color ?? ""}</dd>
          <dt className="text-muted">Servicio</dt><dd>{services.join(", ")}</dd>
          <dt className="text-muted">Recibido</dt><dd>{dateTime(o.created_at)}</dd>
          <dt className="text-muted">Total</dt><dd className="font-semibold">{money(t.total)}</dd>
          <dt className="text-muted">Abonado</dt><dd>{money(t.paid)}</dd>
          <dt className="text-muted">Saldo</dt><dd className="font-semibold">{money(t.balance)}</dd>
          {o.delivered_at && (<><dt className="text-muted">Garantía</dt><dd>{o.warranty_months} meses desde {dateOnly(o.delivered_at)}</dd></>)}
        </dl>
        <details className="pt-2">
          <summary className="font-semibold cursor-pointer text-accent">Condiciones que aceptaste</summary>
          <p className="whitespace-pre-line text-sm text-muted mt-2 leading-relaxed">{o.terms_text}</p>
        </details>
      </section>

      <footer className="text-center text-sm text-muted space-y-2 pb-8">
        <p>{s.shop_address} · {s.shop_hours}</p>
        {shopWa && (
          <a className="btn-ghost" href={whatsappLink(shopWa, `Hola, quiero preguntar por mi orden ${o.number}`)} target="_blank">
            Escríbenos por WhatsApp
          </a>
        )}
      </footer>
    </main>
  );
}
