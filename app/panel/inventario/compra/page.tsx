import { requireUser } from "@/lib/auth";
import Tabs, { INVENTORY_TABS } from "@/components/Tabs";
import PurchaseForm from "./PurchaseForm";

export const metadata = { title: "Entrada de compra" };

export default async function Compra() {
  await requireUser();
  return (
    <div className="space-y-5 max-w-4xl">
      <h1 className="text-[28px] font-bold tracking-tight">Inventario</h1>
      <Tabs tabs={INVENTORY_TABS} active="compra" />
      <p className="text-muted">Registra lo que llegó del proveedor. El stock sube y el costo se recalcula como promedio.</p>
      <PurchaseForm />
    </div>
  );
}
