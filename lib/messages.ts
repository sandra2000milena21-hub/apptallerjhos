import type { OrderWithCustomer } from "./orders";
import { dateOnly, money } from "./format";

export function whatsappTemplates(o: OrderWithCustomer, trackUrl: string, s: Record<string, string>, t: { quoteTotal: number; balance: number }) {
  const first = o.customer_name.split(" ")[0];
  const shop = s.shop_name;
  return [
    {
      key: "recibido",
      label: "Orden recibida",
      text: `Hola ${first}, en ${shop} recibimos tu ${o.model} con la orden ${o.number}. Aquí puedes ver el estado, las fotos de cómo llegó y tu orden firmada: ${trackUrl}`,
    },
    {
      key: "cotizacion",
      label: "Cotización",
      text: `${first}, ya revisamos tu ${o.model} (orden ${o.number}). La reparación cuesta ${money(t.quoteTotal)} con garantía de ${o.warranty_months} meses. Puedes ver el detalle, las fotos y aprobarla aquí: ${trackUrl}`,
    },
    {
      key: "repuesto",
      label: "Esperando repuesto",
      text: `${first}, estamos consiguiendo el repuesto para tu ${o.model} (orden ${o.number}). Te avisamos apenas llegue. Seguimiento: ${trackUrl}`,
    },
    {
      key: "listo",
      label: "Listo para recoger",
      text: `¡${first}, tu ${o.model} está listo! Puedes recogerlo con tu orden ${o.number} y tu cédula. Horario: ${s.shop_hours}.${t.balance > 0 ? ` Saldo: ${money(t.balance)}.` : ""} ${trackUrl}`,
    },
    {
      key: "recordatorio",
      label: "Recordatorio sin recoger",
      text: `${first}, tu ${o.model} (orden ${o.number}) te espera desde el ${dateOnly(o.ready_at)}. Te recordamos que, según las condiciones de la orden, después de un tiempo se cobra almacenamiento. ${trackUrl}`,
    },
    {
      key: "seguimiento",
      label: "Seguimiento postventa",
      text: `${first}, ¿cómo va tu ${o.model}? Recuerda que tu reparación tiene garantía de ${o.warranty_months} meses. Cualquier cosa, aquí estamos. — ${shop}`,
    },
  ];
}
