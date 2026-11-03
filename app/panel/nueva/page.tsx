import { dbx, getSettings } from "@/lib/db";
import Wizard from "./Wizard";

export const metadata = { title: "Nueva recepción" };

export default async function NuevaPage({ searchParams }: { searchParams: Promise<{ cita?: string }> }) {
  const s = await getSettings();
  const { cita } = await searchParams;
  const appt = cita
    ? ((await dbx.get("SELECT * FROM appointments WHERE id = ?", parseInt(cita, 10))) as
        | { id: number; name: string; phone: string; email: string | null; device_type: string; model: string | null; problem: string | null }
        | undefined)
    : undefined;
  return (
    <Wizard
      terms={s.terms}
      aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY || s.ai_key)}
      defaults={{
        diagnostic_fee: parseInt(s.default_diagnostic_fee || "0", 10),
        warranty_months: parseInt(s.default_warranty_months || "3", 10),
      }}
      appointment={appt ?? null}
    />
  );
}
