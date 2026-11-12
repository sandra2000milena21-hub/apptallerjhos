import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { generateExcelReport, type ExportFilter, type ExportKind, type ExportRange } from "@/lib/excel";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);

    const range = (url.searchParams.get("range") || "today") as ExportRange;
    const kind = (url.searchParams.get("kind") || "full") as ExportKind;
    const from = url.searchParams.get("from") || undefined;
    const to = url.searchParams.get("to") || undefined;

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
