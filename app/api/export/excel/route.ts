import { NextRequest, NextResponse } from "next/server";
import { currentUser, hasPermission } from "@/lib/auth";
import { generateExcelReport, type ExportFilter, type ExportKind, type ExportRange } from "@/lib/excel";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });
  const url = new URL(req.url);
  const RANGES: ExportRange[] = ["today", "yesterday", "this_week", "this_month", "all", "custom"];
  const KINDS: ExportKind[] = ["full", "intakes", "daily"];
  const rangeRaw = url.searchParams.get("range") || "today";
  const kindRaw = url.searchParams.get("kind") || "full";
  if (!RANGES.includes(rangeRaw as ExportRange) || !KINDS.includes(kindRaw as ExportKind)) return new NextResponse("Parámetros inválidos", { status: 400 });
  const range = rangeRaw as ExportRange;
  const kind = kindRaw as ExportKind;
  // El listado de equipos lo puede bajar quien ve órdenes; lo que trae dinero (caja, ventas, gastos) exige ver reportes.
  const allowed = kind === "intakes" ? hasPermission(user, "orders_view") || hasPermission(user, "reports_view") : hasPermission(user, "reports_view");
  if (!allowed) return new NextResponse("No tienes permiso para exportar este reporte", { status: 403 });
  const isDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const from = isDate(url.searchParams.get("from"));
  const to = isDate(url.searchParams.get("to"));
  if (range === "custom" && !from) return new NextResponse("Falta la fecha inicial", { status: 400 });

  try {

    const filter: ExportFilter = { range, kind, from, to };
    const buffer = await generateExcelReport(filter, user.name);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `TallerJhos_${kind}_${range}_${dateStr}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Error generating excel:", err);
    return new NextResponse("Error generating Excel report", { status: 500 });
  }
}
