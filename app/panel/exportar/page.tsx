import { requireUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import ExportView from "./ExportView";

export const metadata = {
  title: "Exportar a Excel · Taller Jhos",
};

export default async function ExportarPage() {
  await requireUser();

  // Fecha actual en Colombia (UTC-5)
  const now = new Date();
  const fmtCol = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = fmtCol.format(now);

  const startOfDay = `${todayStr} 05:00:00`;
  const nextDay = new Date(new Date(todayStr + "T12:00:00Z").getTime() + 86400000);
  const nextDayStr = fmtCol.format(nextDay);
  const endOfDay = `${nextDayStr} 04:59:59`;

  const range = [startOfDay, endOfDay];

  // Métricas rápidas de hoy
  const ordersToday = (await dbx.get(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'entregado' THEN 1 ELSE 0 END) AS delivered FROM orders WHERE created_at BETWEEN ? AND ?",
    ...range,
  )) as { total: number; delivered: number } | undefined;

  const orderIncome = (await dbx.get(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE created_at BETWEEN ? AND ?",
    ...range,
  )) as { total: number } | undefined;

  const salesToday = (await dbx.get(
    "SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM sales WHERE status = 'pagada' AND created_at BETWEEN ? AND ?",
    ...range,
  )) as { count: number; total: number } | undefined;

  const expensesToday = (await dbx.get(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE created_at BETWEEN ? AND ?",
    ...range,
  )) as { total: number } | undefined;

  const totalIncome = (orderIncome?.total ?? 0) + (salesToday?.total ?? 0);
  const totalExpenses = expensesToday?.total ?? 0;
  const netCash = totalIncome - totalExpenses;

  const initialSummary = {
    orderCount: ordersToday?.total ?? 0,
    deliveredCount: ordersToday?.delivered ?? 0,
    totalIncome,
    totalExpenses,
    netCash,
    salesCount: salesToday?.count ?? 0,
  };

  return <ExportView initialSummary={initialSummary} todayStr={todayStr} />;
}
