import ExcelJS from "exceljs";
import { dbx, type Exec } from "./db";
import { dateOnly, dateTime, money } from "./format";
import { STATUSES, PRIORITIES } from "./constants";

export type ExportRange = "today" | "yesterday" | "this_week" | "this_month" | "all" | "custom";
export type ExportKind = "full" | "intakes" | "daily";

export interface ExportFilter {
  range: ExportRange;
  kind: ExportKind;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

// Convertir hora local Colombia a ventana de consulta SQLite en UTC
export function getFilterDates(filter: ExportFilter): { startStr: string; endStr: string; label: string } {
  const now = new Date();
  // Formateador fecha Colombia
  const fmtCol = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" });
  const todayCol = fmtCol.format(now); // "YYYY-MM-DD"

  let fromDate = todayCol;
  let toDate = todayCol;
  let label = "Hoy";

  if (filter.range === "yesterday") {
    const y = new Date(now.getTime() - 86400000);
    const yCol = fmtCol.format(y);
    fromDate = yCol;
    toDate = yCol;
    label = "Ayer (" + yCol + ")";
  } else if (filter.range === "this_week") {
    const d = new Date();
    // lunes de la semana actual
    const day = d.getDay(); // 0 domingo, 1 lunes...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    fromDate = fmtCol.format(monday);
    toDate = todayCol;
    label = `Esta semana (${fromDate} a ${toDate})`;
  } else if (filter.range === "this_month") {
    fromDate = todayCol.slice(0, 7) + "-01";
    toDate = todayCol;
    label = `Este mes (${todayCol.slice(0, 7)})`;
  } else if (filter.range === "all") {
    fromDate = "2020-01-01";
    toDate = "2099-12-31";
    label = "Histórico Completo (Todo el Taller)";
  } else if (filter.range === "custom" && filter.from) {
    fromDate = filter.from;
    toDate = filter.to || filter.from;
    label = `${fromDate} a ${toDate}`;
  }

  // En Colombia la zona horaria es UTC-5
  // Inicio del día local: YYYY-MM-DD 00:00:00 -> en UTC +5 horas
  // Fin del día local: YYYY-MM-DD 23:59:59 -> en UTC +5 horas
  const startStr = `${fromDate} 05:00:00`;
  const nextDay = new Date(new Date(toDate + "T12:00:00Z").getTime() + 86400000);
  const nextDayCol = fmtCol.format(nextDay);
  const endStr = `${nextDayCol} 04:59:59`;

  return { startStr, endStr, label };
}

export async function generateExcelReport(filter: ExportFilter, userName: string = "Administrador", ex: Exec = dbx): Promise<Buffer> {
  const { startStr, endStr, label } = getFilterDates(filter);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `Taller Jhos (v7.0) - ${userName}`;
  workbook.created = new Date();

  // 1. Obtener datos de órdenes / ingresos de equipos
  const orderCondition = filter.range === "all" ? "1=1" : "o.created_at BETWEEN ? AND ?";
  const orderParams = filter.range === "all" ? [] : [startStr, endStr];

  const orders = (await ex.all(
    `SELECT o.*, 
            c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email, c.doc_id AS customer_doc,
            t.name AS tech_name, r.name AS receiver_name
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     LEFT JOIN users t ON t.id = o.technician_id
     LEFT JOIN users r ON r.id = o.received_by
     WHERE ${orderCondition}
     ORDER BY o.created_at DESC`,
    ...orderParams,
  )) as Array<{
    id: number;
    number: string;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    customer_doc: string | null;
    device_type: string;
    brand: string | null;
    model: string;
    color: string | null;
    capacity: string | null;
    imei: string | null;
    serial: string | null;
    status: string;
    priority: string;
    problem: string | null;
    entered_off: number;
    battery_health: string | null;
    accessories: string | null;
    condition_notes: string | null;
    diagnostic_fee: number;
    estimate: number | null;
    warranty_months: number;
    due_date: string | null;
    created_at: string;
    ready_at: string | null;
    delivered_at: string | null;
    delivered_to: string | null;
    tech_name: string | null;
    receiver_name: string | null;
    quote_status: string;
  }>;

  // Totales financieros por orden (cotizaciones y pagos)
  const orderIds = orders.map((o) => o.id);
  const quotesMap = new Map<number, number>();
  const paymentsMap = new Map<number, number>();

  if (orderIds.length > 0) {
    // Quote items sum
    const quoteRows = (await ex.all(
      `SELECT order_id, SUM(amount) AS total FROM quote_items WHERE order_id IN (${orderIds.map(() => "?").join(",")}) GROUP BY order_id`,
      ...orderIds,
    )) as Array<{ order_id: number; total: number }>;
    for (const q of quoteRows) quotesMap.set(q.order_id, q.total);

    // Payments sum
    const payRows = (await ex.all(
      `SELECT order_id, SUM(amount) AS total FROM payments WHERE order_id IN (${orderIds.map(() => "?").join(",")}) GROUP BY order_id`,
      ...orderIds,
    )) as Array<{ order_id: number; total: number }>;
    for (const p of payRows) paymentsMap.set(p.order_id, p.total);
  }

  // 2. Obtener movimientos de caja / pagos en el período
  const rangeParams = [startStr, endStr];
  const orderPayments = (await ex.all(
    `SELECT p.id, p.order_id, p.amount, p.method, p.note, p.created_at, p.sale_id,
            o.number AS order_number, o.model, c.name AS customer_name, u.name AS user_name
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     JOIN customers c ON c.id = o.customer_id
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.created_at BETWEEN ? AND ?
     ORDER BY p.created_at DESC`,
    ...rangeParams,
  )) as Array<{
    id: number;
    order_id: number;
    amount: number;
    method: string;
    note: string | null;
    created_at: string;
    sale_id: number | null;
    order_number: string;
    model: string;
    customer_name: string;
    user_name: string | null;
  }>;

  // Ventas de mostrador
  const sales = (await ex.all(
    `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, u.name AS user_name
     FROM sales s
     LEFT JOIN customers c ON c.id = s.customer_id
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.created_at BETWEEN ? AND ?
     ORDER BY s.created_at DESC`,
    ...rangeParams,
  )) as Array<{
    id: number;
    number: string;
    customer_name: string | null;
    customer_phone: string | null;
    subtotal: number;
    discount: number;
    total: number;
    points_earned: number;
    points_redeemed: number;
    status: string;
    note: string | null;
    created_at: string;
    user_name: string | null;
  }>;

  // Gastos
  const expenses = (await ex.all(
    `SELECT e.*, u.name AS user_name
     FROM expenses e
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.created_at BETWEEN ? AND ?
     ORDER BY e.created_at DESC`,
    ...rangeParams,
  )) as Array<{
    id: number;
    description: string;
    category: string;
    amount: number;
    method: string;
    created_at: string;
    user_name: string | null;
  }>;

  // Retomas
  const buybacks = (await ex.all(
    `SELECT b.*, c.name AS customer_name, u.name AS user_name
     FROM buybacks b
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN users u ON u.id = b.user_id
     WHERE b.created_at BETWEEN ? AND ?
     ORDER BY b.created_at DESC`,
    ...rangeParams,
  )) as Array<{
    id: number;
    number: string;
    customer_name: string;
    model: string;
    grade: string;
    price: number;
    payout: string;
    status: string;
    created_at: string;
    user_name: string | null;
  }>;

  // Estilos de Excel Reutilizables
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // Navy slate oscuro
  };
  const headerFont: Partial<ExcelJS.Font> = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  const titleFont: Partial<ExcelJS.Font> = {
    name: "Calibri",
    size: 16,
    bold: true,
    color: { argb: "FF0F172A" },
  };
  const subTitleFont: Partial<ExcelJS.Font> = {
    name: "Calibri",
    size: 11,
    italic: true,
    color: { argb: "FF475569" },
  };
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };
  const zebraFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };

  // Helper para status labels
  const getStatusLabel = (code: string) => STATUSES.find((s) => s.key === code)?.label || code;
  const getPriorityLabel = (code: string) => PRIORITIES.find((p) => p.key === code)?.label || code;

  // ==========================================
  // HOJA 1: RESUMEN EJECUTIVO / INFO DIARIA
  // ==========================================
  if (filter.kind === "full" || filter.kind === "daily") {
    const wsSummary = workbook.addWorksheet("Resumen Diario", {
      views: [{ showGridLines: true }],
    });

    wsSummary.addRow(["TALLER JHOS · REPORTE FINANCIERO Y OPERATIVO"]);
    wsSummary.getRow(1).font = titleFont;
    wsSummary.addRow([`Período: ${label} | Generado el: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })} | Por: ${userName}`]);
    wsSummary.getRow(2).font = subTitleFont;
    wsSummary.addRow([]); // espacio

    // Calcular KPIs
    const totalOrderIncome = orderPayments.reduce((s, p) => s + p.amount, 0);
    const totalSalesIncome = sales.filter((s) => s.status === "pagada").reduce((s, sRow) => s + sRow.total, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalBuybacks = buybacks.filter((b) => b.status === "pagada" && b.payout === "Efectivo").reduce((s, b) => s + b.price, 0);
    const totalOut = totalExpenses + totalBuybacks;
    const netCash = totalOrderIncome + totalSalesIncome - totalOut;

    const countDelivered = orders.filter((o) => o.status === "entregado").length;

    // Métricas por método de pago
    const methodTotals: Record<string, { in: number; out: number }> = {};
    for (const p of orderPayments) {
      if (!methodTotals[p.method]) methodTotals[p.method] = { in: 0, out: 0 };
      methodTotals[p.method].in += p.amount;
    }
    for (const e of expenses) {
      if (!methodTotals[e.method]) methodTotals[e.method] = { in: 0, out: 0 };
      methodTotals[e.method].out += e.amount;
    }
    for (const b of buybacks) {
      if (b.status === "pagada") {
        if (!methodTotals[b.payout]) methodTotals[b.payout] = { in: 0, out: 0 };
        methodTotals[b.payout].out += b.price;
      }
    }

    // Tabla de Métricas Clave
    wsSummary.addRow(["INDICADOR OPERATIVO", "VALOR"]);
    const kpiHeader = wsSummary.lastRow!;
    kpiHeader.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
    });

    const kpis: [string, number | string][] = [
      ["Equipos ingresados en el período", orders.length],
      ["Equipos entregados en el período", countDelivered],
      ["Ventas de mostrador realizadas", sales.length],
      ["Recaudado por reparación de órdenes", totalOrderIncome],
      ["Recaudado por ventas de mostrador", totalSalesIncome],
      ["Total ingresos a caja", totalOrderIncome + totalSalesIncome],
      ["Total egresos (gastos + retomas)", totalOut],
      ["Flujo neto de caja", netCash],
    ];

    for (const [k, v] of kpis) {
      const r = wsSummary.addRow([k, v]);
      r.border = borderThin;
      if (typeof v === "number" && (k.includes("Recaudado") || k.includes("ingresos") || k.includes("egresos") || k.includes("Flujo"))) {
        r.getCell(2).numFmt = '"$"#,##0.00;[Red]"-$"#,##0.00;"$0.00"';
      }
    }

    wsSummary.addRow([]);
    wsSummary.addRow(["DESGLOSE POR MÉTODO DE PAGO", "INGRESOS (+)", "EGRESOS (-)", "NETO"]);
    const mHeader = wsSummary.lastRow!;
    mHeader.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
    });

    for (const [method, vals] of Object.entries(methodTotals)) {
      const net = vals.in - vals.out;
      const r = wsSummary.addRow([method, vals.in, vals.out, net]);
      r.border = borderThin;
      r.getCell(2).numFmt = '"$"#,##0.00';
      r.getCell(3).numFmt = '"$"#,##0.00';
      r.getCell(4).numFmt = '"$"#,##0.00;[Red]"-$"#,##0.00;"$0.00"';
    }

    wsSummary.columns = [
      { width: 38 },
      { width: 22 },
      { width: 22 },
      { width: 22 },
    ];
  }

  // ==========================================
  // HOJA 2: INGRESOS DE EQUIPOS (ÓRDENES)
  // ==========================================
  if (filter.kind === "full" || filter.kind === "intakes") {
    const wsOrders = workbook.addWorksheet("Ingresos de Equipos", {
      views: [{ showGridLines: true }],
    });

    wsOrders.addRow(["TALLER JHOS · REGISTRO DETALLADO DE INGRESOS DE EQUIPOS"]);
    wsOrders.getRow(1).font = titleFont;
    wsOrders.addRow([`Período: ${label} | Total Equipos: ${orders.length} | Exportado: ${new Date().toLocaleDateString("es-CO")}`]);
    wsOrders.getRow(2).font = subTitleFont;
    wsOrders.addRow([]);

    const orderCols = [
      "N° Orden",
      "Fecha Ingreso",
      "Cliente",
      "Teléfono",
      "Documento / Cédula",
      "Correo",
      "Tipo de Equipo",
      "Marca",
      "Modelo",
      "Color / Capacidad",
      "IMEI",
      "Serial",
      "Estado",
      "Prioridad",
      "Falla / Problema",
      "Enciende",
      "Batería",
      "Accesorios",
      "Observaciones de Condición",
      "Diagnóstico ($)",
      "Cotización ($)",
      "Pagado ($)",
      "Saldo Pendiente ($)",
      "Fecha Prometida",
      "Fecha Entrega",
      "Entregado A",
      "Garantía (Meses)",
      "Recibió",
      "Técnico Asignado",
    ];

    wsOrders.addRow(orderCols);
    const oHeaderRow = wsOrders.lastRow!;
    oHeaderRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    oHeaderRow.height = 28;

    let rowIdx = 0;
    for (const o of orders) {
      rowIdx++;
      const quoteTotal = quotesMap.get(o.id) ?? (o.estimate || o.diagnostic_fee || 0);
      const paid = paymentsMap.get(o.id) ?? 0;
      const balance = Math.max(0, quoteTotal - paid);

      const row = wsOrders.addRow([
        o.number,
        dateTime(o.created_at),
        o.customer_name,
        o.customer_phone,
        o.customer_doc || "—",
        o.customer_email || "—",
        o.device_type,
        o.brand || "—",
        o.model,
        `${o.color || ""} ${o.capacity || ""}`.trim() || "—",
        o.imei || "—",
        o.serial || "—",
        getStatusLabel(o.status),
        getPriorityLabel(o.priority),
        o.problem || "—",
        o.entered_off ? "No (Apagado)" : "Sí (Encendido)",
        o.battery_health ? `${o.battery_health}%` : "—",
        o.accessories || "—",
        o.condition_notes || "—",
        o.diagnostic_fee,
        quoteTotal,
        paid,
        balance,
        o.due_date ? dateOnly(o.due_date) : "—",
        o.delivered_at ? dateTime(o.delivered_at) : "—",
        o.delivered_to || "—",
        o.warranty_months,
        o.receiver_name || "—",
        o.tech_name || "Sin asignar",
      ]);

      row.border = borderThin;
      if (rowIdx % 2 === 0) {
        row.eachCell((cell) => { cell.fill = zebraFill; });
      }

      // Formato moneda en columnas numéricas
      row.getCell(20).numFmt = '"$"#,##0.00';
      row.getCell(21).numFmt = '"$"#,##0.00';
      row.getCell(22).numFmt = '"$"#,##0.00';
      row.getCell(23).numFmt = '"$"#,##0.00';
    }

    // Fila de totales
    if (orders.length > 0) {
      const totRow = wsOrders.addRow([
        "TOTALES",
        "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
        { formula: `SUM(T5:T${orders.length + 4})` },
        { formula: `SUM(U5:U${orders.length + 4})` },
        { formula: `SUM(V5:V${orders.length + 4})` },
        { formula: `SUM(W5:W${orders.length + 4})` },
      ]);
      totRow.font = { bold: true };
      totRow.getCell(20).numFmt = '"$"#,##0.00';
      totRow.getCell(21).numFmt = '"$"#,##0.00';
      totRow.getCell(22).numFmt = '"$"#,##0.00';
      totRow.getCell(23).numFmt = '"$"#,##0.00';
    }

    // Auto-ajuste de anchos de columna
    wsOrders.columns = [
      { width: 14 }, // Orden
      { width: 18 }, // Fecha Ingreso
      { width: 22 }, // Cliente
      { width: 15 }, // Teléfono
      { width: 16 }, // Doc
      { width: 22 }, // Correo
      { width: 14 }, // Tipo
      { width: 14 }, // Marca
      { width: 22 }, // Modelo
      { width: 16 }, // Color/Cap
      { width: 18 }, // IMEI
      { width: 16 }, // Serial
      { width: 18 }, // Estado
      { width: 14 }, // Prioridad
      { width: 30 }, // Falla
      { width: 14 }, // Enciende
      { width: 12 }, // Batería
      { width: 18 }, // Accesorios
      { width: 26 }, // Condición
      { width: 16 }, // Diagnóstico
      { width: 16 }, // Cotización
      { width: 16 }, // Pagado
      { width: 16 }, // Saldo
      { width: 16 }, // Fecha Prometida
      { width: 18 }, // Fecha Entrega
      { width: 20 }, // Entregado A
      { width: 15 }, // Garantía
      { width: 16 }, // Recibió
      { width: 18 }, // Técnico
    ];
  }

  // ==========================================
  // HOJA 3: MOVIMIENTOS DETALLADOS DE CAJA
  // ==========================================
  if (filter.kind === "full" || filter.kind === "daily") {
    const wsCash = workbook.addWorksheet("Movimientos de Caja", {
      views: [{ showGridLines: true }],
    });

    wsCash.addRow(["TALLER JHOS · HISTORIAL DE MOVIMIENTOS DE CAJA"]);
    wsCash.addRow([`Período: ${label} | Total Movimientos Registrados: ${orderPayments.length + expenses.length + buybacks.length}`]);
    wsCash.getRow(1).font = titleFont;
    wsCash.getRow(2).font = subTitleFont;
    wsCash.addRow([]);

    const cashCols = [
      "Fecha y Hora",
      "Tipo de Transacción",
      "Referencia",
      "Concepto / Cliente / Proveedor",
      "Método de Pago",
      "Ingreso (+)",
      "Egreso (-)",
      "Registrado Por",
    ];

    wsCash.addRow(cashCols);
    wsCash.lastRow!.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // Combinar pagos de órdenes, gastos y retomas en una sola cronología
    type CashRow = {
      date: string;
      type: string;
      ref: string;
      concept: string;
      method: string;
      inn: number;
      out: number;
      user: string;
    };

    const allMoves: CashRow[] = [
      ...orderPayments.map((p) => ({
        date: p.created_at,
        type: p.sale_id ? "Cobro en Entrega / Venta" : "Abono a Orden",
        ref: p.order_number,
        concept: `${p.customer_name} · ${p.model} ${p.note ? `(${p.note})` : ""}`,
        method: p.method,
        inn: p.amount,
        out: 0,
        user: p.user_name || "Asesor",
      })),
      ...expenses.map((e) => ({
        date: e.created_at,
        type: `Gasto (${e.category})`,
        ref: `G-${String(e.id).padStart(4, "0")}`,
        concept: e.description,
        method: e.method,
        inn: 0,
        out: e.amount,
        user: e.user_name || "Admin",
      })),
      ...buybacks.filter((b) => b.status === "pagada").map((b) => ({
        date: b.created_at,
        type: "Pago de Retoma / Compra Usado",
        ref: b.number,
        concept: `Retoma ${b.model} a ${b.customer_name}`,
        method: b.payout,
        inn: 0,
        out: b.price,
        user: b.user_name || "Asesor",
      })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));

    let moveIdx = 0;
    for (const m of allMoves) {
      moveIdx++;
      const r = wsCash.addRow([
        dateTime(m.date),
        m.type,
        m.ref,
        m.concept,
        m.method,
        m.inn,
        m.out,
        m.user,
      ]);
      r.border = borderThin;
      if (moveIdx % 2 === 0) r.eachCell((cell) => { cell.fill = zebraFill; });

      r.getCell(6).numFmt = '"$"#,##0.00';
      r.getCell(7).numFmt = '"$"#,##0.00';
    }

    if (allMoves.length > 0) {
      const totRow = wsCash.addRow([
        "TOTAL",
        "", "", "", "",
        { formula: `SUM(F5:F${allMoves.length + 4})` },
        { formula: `SUM(G5:G${allMoves.length + 4})` },
        "",
      ]);
      totRow.font = { bold: true };
      totRow.getCell(6).numFmt = '"$"#,##0.00';
      totRow.getCell(7).numFmt = '"$"#,##0.00';
    }

    wsCash.columns = [
      { width: 18 },
      { width: 26 },
      { width: 16 },
      { width: 36 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
    ];
  }

  // ==========================================
  // HOJA 4: VENTAS DE MOSTRADOR
  // ==========================================
  if (filter.kind === "full" && sales.length > 0) {
    const wsSales = workbook.addWorksheet("Ventas Mostrador", {
      views: [{ showGridLines: true }],
    });

    wsSales.addRow(["TALLER JHOS · FACTURACIÓN EN CAJA Y VENTAS"]);
    wsSales.addRow([`Período: ${label} | Total Ventas: ${sales.length}`]);
    wsSales.getRow(1).font = titleFont;
    wsSales.getRow(2).font = subTitleFont;
    wsSales.addRow([]);

    wsSales.addRow([
      "N° Venta",
      "Fecha y Hora",
      "Cliente",
      "Teléfono",
      "Subtotal ($)",
      "Descuento ($)",
      "Total Cobrado ($)",
      "Puntos Redimidos",
      "Puntos Ganados",
      "Estado",
      "Vendedor",
    ]);
    wsSales.lastRow!.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
    });

    let sIdx = 0;
    for (const s of sales) {
      sIdx++;
      const r = wsSales.addRow([
        s.number,
        dateTime(s.created_at),
        s.customer_name || "Cliente General",
        s.customer_phone || "—",
        s.subtotal,
        s.discount,
        s.total,
        s.points_redeemed || 0,
        s.points_earned || 0,
        s.status,
        s.user_name || "Asesor",
      ]);
      r.border = borderThin;
      if (sIdx % 2 === 0) r.eachCell((cell) => { cell.fill = zebraFill; });

      r.getCell(5).numFmt = '"$"#,##0.00';
      r.getCell(6).numFmt = '"$"#,##0.00';
      r.getCell(7).numFmt = '"$"#,##0.00';
    }

    wsSales.columns = [
      { width: 14 },
      { width: 18 },
      { width: 22 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 18 },
    ];
  }

  // Generar Buffer del archivo Excel
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
