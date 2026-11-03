"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { dbx } from "@/lib/db";
import { addEvent, getOrderByToken } from "@/lib/orders";

export async function clientDecideQuote(fd: FormData) {
  const token = String(fd.get("token") || "");
  const decision = fd.get("decision") === "aprobada" ? "aprobada" : "rechazada";
  const order = await getOrderByToken(token);
  if (!order || order.quote_status !== "pendiente") return;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || "desconocida";
  (await dbx.run("UPDATE orders SET quote_status = ?, quote_decided_at = datetime('now'), quote_decided_by = ? WHERE id = ?", decision, `Cliente desde la página de seguimiento (IP ${ip})`, order.id));
  await addEvent({
    orderId: order.id,
    type: "quote",
    body: decision === "aprobada" ? "Aprobaste la cotización. ¡Empezamos con la reparación!" : "Rechazaste la cotización. Te entregamos el equipo como llegó.",
    isPublic: true,
    author: order.customer_name,
  });
  revalidatePath(`/s/${token}`);
  revalidatePath(`/panel/orden/${order.id}`);
  revalidatePath("/panel");
}
