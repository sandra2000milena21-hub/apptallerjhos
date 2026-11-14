import { NextRequest, NextResponse } from "next/server";
import { dbx, getSettings, tx } from "@/lib/db";
import { verifyWompiEvent } from "@/lib/wompi";
import { addEvent } from "@/lib/orders";

export const runtime = "nodejs";

// Configura en el panel de Wompi la URL de eventos: https://TU-DOMINIO/api/webhooks/wompi
export async function POST(req: NextRequest) {
  const s = await getSettings();
  const event = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!event) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  if (!verifyWompiEvent(event, s.wompi_events_secret)) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  if (event.event !== "transaction.updated") return NextResponse.json({ ok: true });

  const wtx = (event.data as { transaction?: Record<string, unknown> })?.transaction;
  if (!wtx || wtx.status !== "APPROVED") return NextResponse.json({ ok: true });
  const linkId = String(wtx.payment_link_id ?? "");
  const link = (await dbx.get("SELECT * FROM payment_links WHERE id = ?", linkId)) as { id: string; order_id: number } | undefined;
  if (!link) return NextResponse.json({ ok: true, ignored: "link desconocido" });

  const txId = String(wtx.id ?? "");
  const amount = Math.round(Number(wtx.amount_in_cents) / 100);
  if (!txId || !Number.isFinite(amount) || amount <= 0 || wtx.currency !== "COP") return NextResponse.json({ ok: true, ignored: "transacción inválida" });
  // Wompi reintenta los eventos: comprobar e insertar van en una sola transacción para no registrar el pago dos veces.
  await tx(async (t) => {
    if (await t.get("SELECT id FROM payments WHERE external_ref = ?", txId)) return;
    await t.run("INSERT INTO payments (order_id, amount, method, note, external_ref) VALUES (?, ?, 'Wompi', ?, ?)", link.order_id, amount, `Pago en línea ${String(wtx.payment_method_type ?? "").slice(0, 40)}`.trim(), txId);
    await t.run("UPDATE payment_links SET status = 'pagado' WHERE id = ?", link.id);
    await addEvent({ orderId: link.order_id, type: "payment", body: `Recibimos tu pago en línea por $${amount.toLocaleString("es-CO")}. ¡Gracias!`, isPublic: true, author: "Wompi" }, t);
  });
  return NextResponse.json({ ok: true });
}
