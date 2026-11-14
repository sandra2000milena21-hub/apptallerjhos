import { requirePermission } from "@/lib/auth";
import BuybackForm from "./BuybackForm";

export const metadata = { title: "Nueva retoma" };

export default async function NuevaRetoma() {
  await requirePermission("buybacks_view");
  return <BuybackForm />;
}
