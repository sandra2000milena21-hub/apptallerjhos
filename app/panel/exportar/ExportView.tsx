"use client";

import { useState, useTransition } from "react";
import { money } from "@/lib/format";

type SummaryPreview = {
  orderCount: number;
  deliveredCount: number;
  totalIncome: number;
  totalExpenses: number;
  netCash: number;
  salesCount: number;
};

interface ExportViewProps {
  initialSummary: SummaryPreview;
  todayStr: string;
}

export default function ExportView({ initialSummary, todayStr }: ExportViewProps) {
  const [range, setRange] = useState<"today" | "yesterday" | "this_week" | "this_month" | "all" | "custom">("today");
  const [kind, setKind] = useState<"full" | "intakes" | "daily">("full");
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [downloading, setDownloading] = useState(false);

  const getDownloadUrl = () => {
    let url = `/api/export/excel?range=${range}&kind=${kind}`;
    if (range === "custom") {
      url += `&from=${fromDate}&to=${toDate}`;
    }
    return url;
  };

  const handleDownload = () => {
    setDownloading(true);
    const link = document.createElement("a");
    link.href = getDownloadUrl();
    link.setAttribute("download", "");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 2000);
  };

  const getRangeLabel = () => {
    switch (range) {
      case "today": return "Hoy";
      case "yesterday": return "Ayer";
      case "this_week": return "Esta semana";
      case "this_month": return "Este mes";
      case "all": return "Histórico completo (Todo el taller)";
      case "custom": return `${fromDate} al ${toDate}`;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📊</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Exportar a Excel (.xlsx)
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              v7.0 Excel Engine
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Genera y descarga libros contables con el historial completo de ingresos de equipos, auditoría de caja e indicadores diarios.
          </p>
        </div>
      </div>

      {/* Selector de Rango */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            1. Selecciona el período a exportar
          </label>
          <span className="text-xs text-blue-400 font-semibold">{getRangeLabel()}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { id: "today", label: "⚡ Hoy", desc: "Operación de hoy" },
            { id: "yesterday", label: "📅 Ayer", desc: "Cierre anterior" },
            { id: "this_week", label: "🗓️ Semana", desc: "Desde el lunes" },
            { id: "this_month", label: "📆 Mes", desc: "Mes en curso" },
            { id: "all", label: "♾️ Todo", desc: "Histórico total" },
            { id: "custom", label: "🎯 Rango", desc: "Fechas específicas" },
          ].map((item) => {
            const active = range === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id as typeof range)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  active
                    ? "bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/10 ring-1 ring-blue-500"
                    : "bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <div className="font-bold text-sm">{item.label}</div>
                <div className="text-[11px] text-slate-400 truncate">{item.desc}</div>
              </button>
            );
          })}
        </div>

        {range === "custom" && (
          <div className="pt-3 border-t border-white/[0.08] grid sm:grid-cols-2 gap-4 animate-in fade-in duration-200">
            <div>
              <label className="label">Desde fecha</label>
              <input
                type="date"
                className="input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Hasta fecha</label>
              <input
                type="date"
                className="input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Selector de Tipo de Contenido */}
      <div className="card p-5 space-y-4">
        <label className="text-sm font-bold text-slate-300 uppercase tracking-wider">
          2. Tipo de informe Excel
        </label>

        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              id: "full",
              title: "Libro Completo (Recomendado)",
              icon: "📑",
              desc: "Multi-hoja: Resumen Ejecutivo + Ingresos de Equipos + Movimientos de Caja + Ventas Mostrador.",
              badge: "Completo",
            },
            {
              id: "intakes",
              title: "Solo Ingresos de Equipos",
              icon: "📱",
              desc: "Historial completo de órdenes con datos del cliente, equipo, fallas, técnico, diagnóstico y saldos.",
              badge: "Equipos",
            },
            {
              id: "daily",
              title: "Solo Caja e Info Diaria",
              icon: "💰",
              desc: "Auditoría de ingresos a caja, salidas, medios de pago (Efectivo/Nequi/Daviplata/Tarjetas) y balance neto.",
              badge: "Caja",
            },
          ].map((item) => {
            const active = kind === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setKind(item.id as typeof kind)}
                className={`p-4 rounded-xl border text-left transition-all relative ${
                  active
                    ? "bg-blue-600/15 border-blue-500 text-white shadow-md ring-1 ring-blue-500"
                    : "bg-white/[0.02] border-white/[0.08] text-slate-300 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{item.icon}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      active ? "bg-blue-500 text-white" : "bg-white/10 text-slate-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>
                <div className="font-bold text-sm mb-1">{item.title}</div>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumen del Día Actual (Vista Rápida) */}
      {range === "today" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-3.5">
            <span className="text-xs text-slate-400 font-semibold">Equipos hoy</span>
            <p className="text-2xl font-extrabold text-white mt-0.5">{initialSummary.orderCount}</p>
            <span className="text-[11px] text-muted">{initialSummary.deliveredCount} entregados</span>
          </div>
          <div className="card p-3.5">
            <span className="text-xs text-slate-400 font-semibold">Ventas mostrador</span>
            <p className="text-2xl font-extrabold text-white mt-0.5">{initialSummary.salesCount}</p>
            <span className="text-[11px] text-muted">Facturadas en caja</span>
          </div>
          <div className="card p-3.5">
            <span className="text-xs text-slate-400 font-semibold">Ingresos a caja hoy</span>
            <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">{money(initialSummary.totalIncome)}</p>
            <span className="text-[11px] text-muted">Órdenes y ventas</span>
          </div>
          <div className="card p-3.5">
            <span className="text-xs text-slate-400 font-semibold">Flujo neto hoy</span>
            <p className={`text-2xl font-extrabold mt-0.5 ${initialSummary.netCash >= 0 ? "text-blue-400" : "text-rose-400"}`}>
              {money(initialSummary.netCash)}
            </p>
            <span className="text-[11px] text-muted">Gastos: -{money(initialSummary.totalExpenses)}</span>
          </div>
        </div>
      )}

      {/* Botón Principal de Descarga */}
      <div className="card p-5 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <p className="font-bold text-white text-base">
            Listo para exportar: <span className="text-blue-300 font-semibold">{getRangeLabel()}</span>
          </p>
          <p className="text-xs text-slate-400">
            Formato: <b>Microsoft Excel (.xlsx)</b> con diseño tabular, fórmulas automáticas de suma y compatibilidad total con Google Sheets, LibreOffice y Excel.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="btn-primary !h-12 !px-6 rounded-xl font-bold flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-blue-600/30 hover:scale-105 transition disabled:opacity-50"
        >
          {downloading ? (
            <>
              <span className="animate-spin text-base">⏳</span>
              <span>Generando Excel…</span>
            </>
          ) : (
            <>
              <span className="text-lg">📥</span>
              <span>Descargar Archivo Excel</span>
            </>
          )}
        </button>
      </div>

      {/* Guía informativa de contenido del reporte */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-slate-400 space-y-2">
        <p className="font-bold text-slate-200">ℹ️ Información incluida en el archivo Excel:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
          <li><b>Ingresos de Equipos:</b> Número de orden, fecha exacta, nombre del cliente, teléfono, cédula, modelo, IMEI/serial, falla reportada, costo de diagnóstico, cotización aprobada, abonos y saldo restante.</li>
          <li><b>Info Diaria y Caja:</b> Cada entrada y salida de dinero clasificada por método de pago (Efectivo, Nequi, Daviplata, Tarjeta o Transferencia) y usuario que la registró.</li>
          <li><b>Ventas de Mostrador:</b> Detalles de productos comercializados directamente en mostrador con sus descuentos y márgenes.</li>
        </ul>
      </div>
    </div>
  );
}
