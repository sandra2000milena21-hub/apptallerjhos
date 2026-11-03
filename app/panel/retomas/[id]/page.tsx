import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { dbx, getSettings } from "@/lib/db";
import { BUYBACK_CHECKS, GRADES, deviceType } from "@/lib/constants";
import { dateTime, money } from "@/lib/format";
import { parseJSON } from "@/lib/orders";
import PrintButton from "../../orden/[id]/imprimir/PrintButton";
import { ConfirmButton } from "../../orden/[id]/client";
import { voidBuyback } from "../actions";

export const metadata = { title: "Retoma" };

export default async function BuybackPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const b = (await dbx.get("SELECT b.*, c.name AS seller, c.doc_id, c.phone, u.name AS user_name FROM buybacks b JOIN customers c ON c.id = b.customer_id LEFT JOIN users u ON u.id = b.user_id WHERE b.id = ?", parseInt((await params).id, 10))) as Record<string, string | number | null> | undefined;
  if (!b) notFound();
  const s = await getSettings();
  const checks = parseJSON<Record<string, boolean>>(b.checks as string, {});
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap gap-2">
        <Link href="/panel/retomas" className="btn-ghost">← Retomas</Link>
        <PrintButton />
        {b.product_id && <Link href={`/panel/inventario/${b.product_id}`} className="btn-ghost">Ver en inventario</Link>}
        {b.status !== "anulada" && user.role === "admin" && (
          <form action={voidBuyback}>
            <input type="hidden" name="id" value={Number(b.id)} />
            <ConfirmButton className="btn-bad" message="¿Anular esta retoma?">Anular</ConfirmButton>
          </form>
        )}
      </div>
      <div className="bg-white text-slate-900 max-w-[760px] mx-auto p-8 text-[14px] space-y-4 print:p-0 rounded-3xl shadow-2xl print:shadow-none print:rounded-none">
        <header className="flex justify-between border-b-2 border-slate-900 pb-3">
          <div>
            <p className="text-xl font-bold">{s.shop_name}</p>
            <p>{s.shop_address}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Compra de equipo usado</p>
            <p className="text-2xl font-bold font-mono">{String(b.number)}</p>
            <p>{dateTime(String(b.created_at))}</p>
            {b.status === "anulada" && <p className="font-bold text-rose-600">ANULADA</p>}
          </div>
        </header>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Vendedor</p>
            <p className="font-semibold">{String(b.seller)}</p>
            <p>C.C. {String(b.doc_id ?? "—")} · Cel. {String(b.phone)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Equipo</p>
            <p className="font-semibold">{deviceType(String(b.device_type)).label}: {String(b.brand ?? "")} {String(b.model)} {String(b.capacity ?? "")} {String(b.color ?? "")}</p>
            <p>IMEI: <span className="font-mono">{String(b.imei ?? "—")}</span> · Serial: <span className="font-mono">{String(b.serial ?? "—")}</span></p>
            <p>Grado: <b>{GRADES.find((g) => g.key === b.grade)?.label}</b></p>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-slate-500 mb-1">Revisión</p>
          <div className="grid grid-cols-2 gap-x-6">
            {BUYBACK_CHECKS.map((c) => (
              <p key={c.key} className="flex justify-between border-b border-slate-200 py-0.5"><span>{c.label}</span><b>{checks[c.key] ? "Sí" : "No"}</b></p>
            ))}
          </div>
          {b.notes && <p className="mt-2 text-slate-700">Observaciones: {String(b.notes)}</p>}
        </div>
        <p className="text-lg">Valor pagado: <b>{money(Number(b.price))}</b> · {String(b.payout)}</p>
        <p className="text-[12px] leading-relaxed text-slate-600">
          El vendedor declara bajo la gravedad de juramento que el equipo descrito es de su propiedad, de procedencia lícita, que no tiene reporte de hurto,
          extravío ni obligaciones pendientes, y que no está vinculado a cuentas que impidan su uso. Autoriza el tratamiento de sus datos personales (Ley 1581 de 2012).
        </p>
        <div className="grid grid-cols-2 gap-10 pt-4">
          <div>
            {b.signature && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/media/${b.signature}`} alt="Firma del vendedor" className="h-20" />
            )}
            <p className="border-t border-slate-900 pt-1">Firma del vendedor</p>
          </div>
          <div>
            <div className="h-20" />
            <p className="border-t border-slate-900 pt-1">Recibe: {String(b.user_name ?? "")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
