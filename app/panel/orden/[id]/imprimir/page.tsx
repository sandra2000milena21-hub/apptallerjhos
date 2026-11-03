import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { getOrder, getPayments, parseJSON, publicBaseUrl, totals } from "@/lib/orders";
import { CHECK_LABELS, deviceType, serviceLabel, type CheckValue } from "@/lib/constants";
import { dateOnly, dateTime, money } from "@/lib/format";
import PrintButton from "./PrintButton";

export const metadata = { title: "Imprimir orden" };

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = parseInt((await params).id, 10);
  const o = await getOrder(id);
  if (!o) notFound();
  const s = await getSettings();
  const t = await totals(id, o);
  const paid = (await getPayments(id)).reduce((a, p) => a + p.amount, 0);
  const trackUrl = `${await publicBaseUrl()}/s/${o.token}`;
  const qr = await QRCode.toDataURL(trackUrl, { margin: 0, width: 220 });
  const checkIn = parseJSON<Record<string, CheckValue>>(o.checklist_in, {});
  const services = parseJSON<string[]>(o.services, []).map((k) => serviceLabel(o.device_type, k));

  return (
    <div className="mx-auto max-w-[800px] bg-white text-slate-900 p-8 text-[13px] leading-snug print:p-0 print:max-w-none rounded-3xl shadow-2xl print:shadow-none print:rounded-none">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <header className="flex justify-between gap-6 border-b-2 border-slate-900 pb-3">
        <div>
          <h1 className="text-xl font-bold">{s.shop_name}</h1>
          <p>{s.shop_address}</p>
          {s.shop_phone && <p>Tel. {s.shop_phone}</p>}
          <p>{s.shop_hours}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Orden de servicio</p>
          <p className="text-2xl font-bold font-mono">{o.number}</p>
          <p>Recibido: {dateTime(o.created_at)}</p>
          <p>Recibió: {o.received_by_name ?? "—"}</p>
        </div>
      </header>

      <div className="grid grid-cols-[1fr_auto] gap-6 mt-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Block title="Cliente">
            <p className="font-semibold">{o.customer_name}</p>
            <p>C.C. {o.customer_doc || "—"}</p>
            <p>Cel. {o.customer_phone}</p>
            {o.customer_email && <p>{o.customer_email}</p>}
          </Block>
          <Block title="Equipo">
            <p className="font-semibold">{deviceType(o.device_type).label}: {o.brand ? `${o.brand} ` : ""}{o.model} {o.capacity ?? ""} {o.color ?? ""}</p>
            <p>IMEI: <span className="font-mono">{o.imei || "—"}</span></p>
            <p>Serial: <span className="font-mono">{o.serial || "—"}</span></p>
            <p>Accesorios: {o.accessories || "Ninguno"}</p>
          </Block>
          <Block title="Servicio solicitado">
            <p>{services.join(", ")}</p>
            <p className="mt-1"><span className="font-semibold">Falla según el cliente:</span> {o.problem}</p>
          </Block>
          <Block title="Estado al recibir">
            {o.entered_off ? <p className="font-semibold">Equipo ingresa apagado; no fue posible verificar sus funciones.</p> : null}
            <p>Estado físico: {o.condition_notes || "Sin observaciones"}</p>
            <p>Batería: {o.battery_health || "—"}</p>
          </Block>
        </div>
        <div className="text-center w-[130px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR de seguimiento" className="w-[120px] h-[120px] mx-auto" />
          <p className="text-[11px] mt-1">Escanee para ver el estado y las fotos de su equipo</p>
        </div>
      </div>

      <Block title="Pruebas de ingreso" className="mt-4">
        <div className="grid grid-cols-2 gap-x-6">
          {deviceType(o.device_type).checklist.map((i) => (
            <div key={i.key} className="flex justify-between border-b border-slate-200 py-0.5">
              <span>{i.label}</span>
              <span className="font-semibold">{CHECK_LABELS[checkIn[i.key] ?? "np"]}</span>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Valores" className="mt-4">
        <div className="grid grid-cols-4 gap-4">
          <p>Diagnóstico<br /><b>{money(o.diagnostic_fee)}</b></p>
          <p>Valor estimado<br /><b>{o.estimate ? money(o.estimate) : "Se cotiza tras diagnóstico"}</b></p>
          <p>Pagado<br /><b>{money(paid)}</b></p>
          <p>Entrega estimada<br /><b>{dateOnly(o.due_date)}</b></p>
        </div>
        <p className="mt-1">Garantía: <b>{o.warranty_months} meses</b> sobre la pieza cambiada y la mano de obra, desde la entrega.{t.items.length ? ` Cotización: ${money(t.quoteTotal)}.` : ""}</p>
      </Block>

      <Block title="Condiciones del servicio" className="mt-4">
        <p className="whitespace-pre-line text-[11.5px] leading-relaxed text-slate-700">{o.terms_text || s.terms}</p>
      </Block>

      <div className="grid grid-cols-2 gap-10 mt-6">
        <div>
          {o.intake_signature && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/${o.intake_signature}`} alt="Firma" className="h-20" />
          )}
          <p className="border-t border-slate-900 pt-1">Firma del cliente · acepta condiciones y estado del equipo</p>
        </div>
        <div>
          {o.delivery_signature && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/${o.delivery_signature}`} alt="Firma de recibido" className="h-20" />
          )}
          <p className="border-t border-slate-900 pt-1">
            Recibido a satisfacción{o.delivered_at ? ` · ${dateTime(o.delivered_at)} · ${o.delivered_to}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function Block({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{title}</h2>
      {children}
    </section>
  );
}
