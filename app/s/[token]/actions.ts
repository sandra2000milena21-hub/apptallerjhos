"use server";

import { revalidatePath } from "next/cache";
import { tx } from "@/lib/db";
import { clientIp, hit, isLimited } from "@/lib/ratelimit";
import { addEvent, getOrderByToken } from "@/lib/orders";
import { moveStock } from "@/lib/inventory";

export async function clientDecideQuote(fd: FormData) {
  const token = String(fd.get("token") || "").slice(0, 64);
  const decision = fd.get("decision") === "aprobada" ? "aprobada" : "rechazada";
  const ip = await clientIp();
  // Página pública: se limita la cantidad de envíos por visitante.
  if (isLimited(`quote:${ip}`, 20, 10 * 60_000)) return;
  hit(`quote:${ip}`, 10 * 60_000);
  const order = await getOrderByToken(token);
  if (!order || order.quote_status !== "pendiente") return;
  const decided = await tx(async (t) => {
    // Solo decide si sigue pendiente: dos clics (o dos pestañas) no devuelven los repuestos dos veces.
    const upd = await t.run(
      "UPDATE orders SET quote_status = ?, quote_decided_at = datetime('now'), quote_decided_by = ? WHERE id = ? AND quote_status = 'pendiente'",
      decision, `Cliente desde la página de seguimiento (IP ${ip.slice(0, 60)})`, order.id,
    );
    if (!upd.changes) return false;
    if (decision === "rechazada") {
      const items = (await t.all("SELECT * FROM quote_items WHERE order_id = ? AND product_id IS NOT NULL", order.id)) as { id: number; product_id: number; qty: number }[];
      for (const it of items) {
        await moveStock({ productId: it.product_id, qty: it.qty, reason: "devolucion", ref: `${order.number} (rechazada web)` }, t);
        await t.run("UPDATE quote_items SET product_id = NULL WHERE id = ?", it.id);
      }
    }
    await addEvent({
      orderId: order.id,
      type: "quote",
      body: decision === "aprobada" ? "Aprobaste la cotización. ¡Empezamos con la reparación!" : "Rechazaste la cotización. Te entregamos el equipo como llegó.",
      isPublic: true,
      author: order.customer_name,
    }, t);
    return true;
  });
  if (!decided) return;
  revalidatePath(`/s/${token}`);
  revalidatePath(`/panel/orden/${order.id}`);
  revalidatePath("/panel");
}
