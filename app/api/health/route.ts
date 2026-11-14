import { NextResponse } from "next/server";
import { dbHealthy } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chequeo de salud para Docker / monitoreo: responde 200 solo si la base de datos contesta. No revela datos.
export async function GET() {
  const ok = await dbHealthy();
  return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
