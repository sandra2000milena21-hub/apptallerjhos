import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { dbx, getSettings } from "@/lib/db";
import { dateTime, money } from "@/lib/format";
import PrintButton from "../../orden/[id]/imprimir/PrintButton";
import { voidSale } from "../../caja/actions";
import { ConfirmButton } from "../../orden/[id]/client";

export const metadata = { title: "Recibo de venta" };

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = parseInt((await params).id, 10);
  const sale = (await dbx.get(
    `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, c.points AS customer_points, u.name AS user_name 
     FROM sales s 
     LEFT JOIN customers c ON c.id = s.customer_id 
     LEFT JOIN users u ON u.id = s.user_id 
     WHERE s.id = ?`,
    id,
  )) as
    | {
        id: number;
        number: string;
        subtotal: number;
        discount: number;
        total: number;
        points_earned: number;
        points_redeemed: number;
        status: string;
        created_at: string;
        customer_name: string | null;
        customer_phone: string | null;
        customer_points: number | null;
        user_name: string;
      }
    | undefined;
  if (!sale) notFound();
  const items = (await dbx.all("SELECT * FROM sale_items WHERE sale_id = ?", id)) as { id: number; description: string; qty: number; unit_price: number; order_id: number | null }[];
  const pays = (await dbx.all("SELECT * FROM sale_payments WHERE sale_id = ?", id)) as { method: string; amount: number }[];
  const s = await getSettings();

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap gap-2 items-center">
        <Link href="/panel/caja" className="btn-primary">Nueva venta</Link>
        <PrintButton />
        {sale.status !== "anulada" && user.role !== "tecnico" && (
          <form action={voidSale}>
            <input type="hidden" name="id" value={sale.id} />
            <ConfirmButton className="btn-bad" message="¿Anular esta venta? El inventario y los pagos de órdenes se revierten.">Anular venta</ConfirmButton>
          </form>
        )}
      </div>
      <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } }`}</style>
      <div className="bg-white text-slate-900 mx-auto p-5 text-[13px] leading-snug print:p-0 rounded-2xl shadow-2xl print:shadow-none" style={{ width: "80mm" }}>
        <div className="text-center">
          <p className="font-bold text-base">{s.shop_name}</p>
          <p>{s.shop_address}</p>
          {s.shop_phone && <p>Tel. {s.shop_phone}</p>}
        </div>
        <div className="border-y border-dashed border-slate-400 my-2 py-1.5">
          <p className="flex justify-between"><span>Venta</span><b className="font-mono">{sale.number}</b></p>
          <p>{dateTime(sale.created_at)} · {sale.user_name}</p>
          {sale.customer_name && <p>Cliente: {sale.customer_name}</p>}
          {sale.status === "anulada" && <p className="font-bold text-rose-600">VENTA ANULADA</p>}
        </div>
        {items.map((it) => (
          <div key={it.id} className="py-0.5">
            <p>{it.description}</p>
            <p className="flex justify-between text-slate-500"><span>{it.qty} × {money(it.unit_price)}</span><span className="text-slate-900 font-semibold">{money(it.qty * it.unit_price)}</span></p>
          </div>
        ))}
        <div className="border-t border-dashed border-slate-400 mt-2 pt-1.5 space-y-0.5">
          {sale.discount > 0 && <p className="flex justify-between"><span>Descuento</span><span>-{money(sale.discount)}</span></p>}
          <p className="flex justify-between font-bold text-base"><span>Total</span><span>{money(sale.total)}</span></p>
          {pays.map((p, i) => <p key={i} className="flex justify-between"><span>{p.method}</span><span>{money(p.amount)}</span></p>)}
        </div>

        {/* Bloque Club de Puntos y Fidelización en Ticket */}
        {sale.customer_name && (sale.points_earned > 0 || sale.points_redeemed > 0 || (sale.customer_points ?? 0) > 0) && (
          <div className="border-t border-dashed border-slate-400 mt-2.5 pt-2 text-center space-y-1">
            <p className="font-bold text-[11px] uppercase tracking-wider text-slate-800">⭐ CLUB DE PUNTOS ⭐</p>
            <div className="bg-slate-100 rounded-lg p-2 text-left space-y-0.5 border border-slate-300">
              {sale.points_earned > 0 && (
                <p className="flex justify-between font-bold text-emerald-800">
                  <span>Puntos ganados hoy:</span>
                  <span>+{sale.points_earned} pts</span>
                </p>
              )}
              {sale.points_redeemed > 0 && (
                <p className="flex justify-between text-slate-600">
                  <span>Puntos redimidos:</span>
                  <span className="font-semibold">-{sale.points_redeemed} pts</span>
                </p>
              )}
              <p className="flex justify-between font-black text-slate-950 border-t border-slate-300 pt-1 text-[13px]">
                <span>Saldo disponible:</span>
                <span>{sale.customer_points ?? 0} pts</span>
              </p>
              <p className="text-[11px] text-slate-600 text-center pt-0.5 font-medium">
                Equivalente a {money((sale.customer_points ?? 0) * 20)} para tu próximo servicio
              </p>
            </div>
            <p className="text-[10px] text-slate-600 italic">¡Acumula y redime en reparaciones y accesorios!</p>
          </div>
        )}

        <p className="text-center mt-3 text-[11px] text-slate-500">Documento interno, no es factura electrónica. ¡Gracias por tu compra!</p>
      </div>
    </div>
  );
}
