"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { addEvent, getOrder, totals } from "@/lib/orders";
import { STATUS_KEYS, statusInfo, deviceType, PRIORITIES } from "@/lib/constants";
import { getProduct, moveStock } from "@/lib/inventory";
import { notifyOrderStatus } from "@/lib/notify";
import { createPaymentLink } from "@/lib/wompi";
import { publicBaseUrl } from "@/lib/orders";
import { parseMoney } from "@/lib/format";
import { deleteMediaFile, saveSignature } from "@/lib/storage";

function idOf(fd: FormData) {
  const id = parseInt(String(fd.get("orderId")), 10);
  if (!id) throw new Error("Orden inválida");
  return id;
}

function refresh(id: number) {
  revalidatePath(`/panel/orden/${id}`);
  revalidatePath("/panel");
}

export async function changeStatus(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const status = String(fd.get("status"));
  if (!STATUS_KEYS.includes(status as never)) return;
  const note = String(fd.get("note") || "").trim();
  const isPublic = fd.get("public") === "on";
  const sets = ["status = ?"];
  if (status === "listo") sets.push("ready_at = datetime('now')");
  (await dbx.run(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`, status, id));
  await addEvent({
    orderId: id,
    type: "status",
    status,
    body: note ? `${statusInfo(status).label}. ${note}` : statusInfo(status).label,
    isPublic: true,
    userId: user.id,
  });
  // Si la nota es interna, se guarda aparte para que el cliente vea solo el cambio de estado.
  if (note && !isPublic) {
    (await dbx.run("UPDATE events SET body = ? WHERE id = (SELECT max(id) FROM events WHERE order_id = ?)", statusInfo(status).label, id));
    await addEvent({ orderId: id, type: "note", body: note, isPublic: false, userId: user.id });
  }
  await notifyOrderStatus(id, status);
  refresh(id);
}

export async function addNote(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const body = String(fd.get("body") || "").trim();
  if (!body) return;
  await addEvent({ orderId: id, type: "note", body, isPublic: fd.get("public") === "on", userId: user.id });
  refresh(id);
}

export async function assignTechnician(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const techId = parseInt(String(fd.get("technician_id") || "0"), 10) || null;
  (await dbx.run("UPDATE orders SET technician_id = ? WHERE id = ?", techId, id));
  const name = techId ? ((await dbx.get("SELECT name FROM users WHERE id = ?", techId)) as { name: string } | undefined)?.name : null;
  await addEvent({ orderId: id, type: "system", body: name ? `Técnico asignado: ${name}` : "Técnico sin asignar", userId: user.id });
  refresh(id);
}

export async function addQuoteItem(fd: FormData) {
  await requireUser();
  const id = idOf(fd);
  const description = String(fd.get("description") || "").trim();
  const amount = parseMoney(fd.get("amount"));
  if (!description) return;
  (await dbx.run("INSERT INTO quote_items (order_id, description, amount) VALUES (?, ?, ?)", id, description, amount));
  refresh(id);
}

async function addItemWithPart(orderId: number, description: string, amount: number, productId: number | null, userId: number) {
  const order = await getOrder(orderId);
  const product = productId ? await getProduct(productId) : undefined;
  (await dbx.run("INSERT INTO quote_items (order_id, description, amount, product_id, qty, unit_cost) VALUES (?, ?, ?, ?, 1, ?)", orderId, description, amount, product?.id ?? null, product?.cost ?? 0));
  // El repuesto sale del inventario apenas entra a la orden; si se quita, vuelve.
  if (product) await moveStock({ productId: product.id, qty: -1, reason: "reparacion", ref: order?.number, userId });
}

export async function addCatalogItem(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const c = (await dbx.get("SELECT * FROM repair_catalog WHERE id = ?", parseInt(String(fd.get("catalogId")), 10))) as
    | { id: number; name: string; price: number; product_id: number | null }
    | undefined;
  if (!c) return;
  await addItemWithPart(id, c.name, c.price, c.product_id, user.id);
  refresh(id);
}

export async function addProductItem(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const p = await getProduct(parseInt(String(fd.get("productId")), 10));
  if (!p) return;
  const price = parseMoney(fd.get("amount")) || p.price;
  await addItemWithPart(id, p.name, price, p.id, user.id);
  refresh(id);
}

export async function removeQuoteItem(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const item = (await dbx.get("SELECT * FROM quote_items WHERE id = ? AND order_id = ?", parseInt(String(fd.get("itemId")), 10), id)) as
    | { id: number; product_id: number | null; qty: number }
    | undefined;
  if (!item) return;
  (await dbx.run("DELETE FROM quote_items WHERE id = ?", item.id));
  if (item.product_id) await moveStock({ productId: item.product_id, qty: item.qty, reason: "devolucion", ref: (await getOrder(id))?.number, userId: user.id });
  refresh(id);
}

export async function setPriority(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const p = String(fd.get("priority"));
  if (!PRIORITIES.some((x) => x.key === p)) return;
  (await dbx.run("UPDATE orders SET priority = ? WHERE id = ?", p, id));
  await addEvent({ orderId: id, type: "system", body: `Prioridad: ${PRIORITIES.find((x) => x.key === p)!.label}`, userId: user.id });
  refresh(id);
}

export async function resendNotice(fd: FormData) {
  await requireUser();
  const id = idOf(fd);
  const o = await getOrder(id);
  if (!o) return;
  await notifyOrderStatus(id, o.status);
  refresh(id);
}

export async function createWompiLink(fd: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  const user = await requireUser();
  const id = idOf(fd);
  const o = await getOrder(id);
  if (!o) return { ok: false, error: "Orden no existe" };
  const t = await totals(id, o);
  if (t.balance <= 0) return { ok: false, error: "La orden no tiene saldo pendiente." };
  try {
    const link = await createPaymentLink({
      name: `Orden ${o.number}`,
      description: `Reparación ${o.model} · ${o.customer_name}`,
      amount: t.balance,
      redirectUrl: `${await publicBaseUrl()}/s/${o.token}`,
    });
    (await dbx.run("INSERT INTO payment_links (id, order_id, amount, url) VALUES (?, ?, ?, ?)", link.id, id, t.balance, link.url));
    await addEvent({ orderId: id, type: "payment", body: `Link de pago en línea creado por $${t.balance.toLocaleString("es-CO")}.`, isPublic: true, userId: user.id });
    refresh(id);
    return { ok: true, url: link.url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function sendQuote(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const order = await getOrder(id);
  if (!order) return;
  const t = await totals(id, order);
  if (!t.items.length) return;
  (await dbx.run("UPDATE orders SET quote_status = 'pendiente', quote_decided_at = NULL, quote_decided_by = NULL, status = 'cotizado' WHERE id = ?", id));
  await addEvent({
    orderId: id,
    type: "quote",
    status: "cotizado",
    body: `Cotización enviada por $${t.quoteTotal.toLocaleString("es-CO")}. Esperando tu aprobación.`,
    isPublic: true,
    userId: user.id,
  });
  await notifyOrderStatus(id, "cotizado");
  refresh(id);
}

export async function decideQuote(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const decision = fd.get("decision") === "aprobada" ? "aprobada" : "rechazada";
  (await dbx.run("UPDATE orders SET quote_status = ?, quote_decided_at = datetime('now'), quote_decided_by = ? WHERE id = ?", decision, `${user.name} (registrado en el local)`, id));
  if (decision === "rechazada") {
    const items = (await dbx.all("SELECT * FROM quote_items WHERE order_id = ? AND product_id IS NOT NULL", id)) as { id: number; product_id: number; qty: number }[];
    const order = await getOrder(id);
    for (const it of items) {
      await moveStock({ productId: it.product_id, qty: it.qty, reason: "devolucion", ref: `${order?.number} (rechazada)`, userId: user.id });
      await dbx.run("UPDATE quote_items SET product_id = NULL WHERE id = ?", it.id);
    }
  }
  await addEvent({
    orderId: id,
    type: "quote",
    body: decision === "aprobada" ? "Cotización aprobada por el cliente (WhatsApp/teléfono)." : "Cotización rechazada por el cliente. Los repuestos reservados volvieron al inventario.",
    isPublic: true,
    userId: user.id,
  });
  refresh(id);
}

export async function addPayment(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const amount = parseMoney(fd.get("amount"));
  if (amount <= 0) return;
  const method = String(fd.get("method") || "Efectivo");
  const note = String(fd.get("note") || "").trim() || null;
  (await dbx.run("INSERT INTO payments (order_id, amount, method, note, user_id) VALUES (?, ?, ?, ?, ?)", id, amount, method, note, user.id));
  await addEvent({ orderId: id, type: "payment", body: `Pago registrado: $${amount.toLocaleString("es-CO")} (${method})`, userId: user.id });
  refresh(id);
}

export async function saveChecklistOut(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const raw = JSON.parse(String(fd.get("checklist") || "{}")) as Record<string, string>;
  const order = await getOrder(id);
  const clean = Object.fromEntries(deviceType(order?.device_type).checklist.map((i) => [i.key, ["ok", "falla", "np"].includes(raw[i.key]) ? raw[i.key] : "np"]));
  (await dbx.run("UPDATE orders SET checklist_out = ? WHERE id = ?", JSON.stringify(clean), id));
  const fails = Object.values(clean).filter((v) => v === "falla").length;
  await addEvent({
    orderId: id,
    type: "system",
    body: fails ? `Control de calidad con ${fails} falla(s).` : "Control de calidad aprobado: todas las pruebas OK.",
    userId: user.id,
  });
  refresh(id);
}

export async function deliver(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const id = idOf(fd);
  const signature = String(fd.get("signature") || "");
  const receivedBy = String(fd.get("delivered_to") || "").trim();
  if (!signature) return { ok: false, error: "Falta la firma de recibido." };
  if (!receivedBy) return { ok: false, error: "Escribe quién recibe el equipo." };
  const sigId = await saveSignature(signature, id, user.id);
  (await dbx.run("UPDATE orders SET status = 'entregado', delivered_at = datetime('now'), delivery_signature = ?, delivered_to = ? WHERE id = ?", sigId, receivedBy, id));
  await addEvent({ orderId: id, type: "status", status: "entregado", body: `Equipo entregado a ${receivedBy}, recibido a satisfacción.`, isPublic: true, userId: user.id });
  await notifyOrderStatus(id, "entregado");
  refresh(id);
  return { ok: true };
}

export async function toggleMediaPublic(fd: FormData) {
  await requireUser();
  const id = idOf(fd);
  (await dbx.run("UPDATE media SET public = 1 - public WHERE id = ? AND order_id = ?", String(fd.get("mediaId")), id));
  refresh(id);
}

export async function deleteMedia(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const m = (await dbx.get("SELECT filename FROM media WHERE id = ? AND order_id = ? AND kind != 'signature'", String(fd.get("mediaId")), id)) as
    | { filename: string }
    | undefined;
  if (!m) return;
  (await dbx.run("DELETE FROM media WHERE id = ?", String(fd.get("mediaId"))));
  await deleteMediaFile(m.filename);
  await addEvent({ orderId: id, type: "system", body: "Se eliminó una foto o video.", userId: user.id });
  refresh(id);
}

export async function updateDueDate(fd: FormData) {
  const user = await requireUser();
  const id = idOf(fd);
  const due = String(fd.get("due_date") || "") || null;
  (await dbx.run("UPDATE orders SET due_date = ? WHERE id = ?", due, id));
  await addEvent({ orderId: id, type: "system", body: due ? `Nueva fecha estimada de entrega: ${due}` : "Fecha de entrega sin definir", isPublic: true, userId: user.id });
  refresh(id);
}
