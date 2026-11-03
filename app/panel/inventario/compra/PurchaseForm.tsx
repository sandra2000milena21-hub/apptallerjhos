"use client";

import { useState, useTransition } from "react";
import { receivePurchase, searchProductsAction } from "../actions";
import ScanButton from "@/components/Scanner";

type Line = { productId: number; name: string; qty: number; cost: number };
type Found = Awaited<ReturnType<typeof searchProductsAction>>[number];

export default function PurchaseForm() {
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  async function search(v: string) {
    setQ(v);
    if (v.trim().length < 2) return setResults([]);
    setResults(await searchProductsAction(v));
  }
  function add(p: Found) {
    setLines((l) => {
      const ex = l.find((x) => x.productId === p.id);
      if (ex) return l.map((x) => (x.productId === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...l, { productId: p.id, name: p.name, qty: 1, cost: p.cost }];
    });
    setQ("");
    setResults([]);
  }
  async function scanned(code: string) {
    const r = await searchProductsAction(code);
    if (r[0]) add(r[0]);
    else setMsg({ ok: false, text: `No hay producto con el código ${code}. Créalo primero en Productos.` });
  }
  const total = lines.reduce((s, l) => s + l.qty * l.cost, 0);

  return (
    <div className="card p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Proveedor</label>
          <input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Distribuidora…" />
        </div>
        <div>
          <label className="label">Factura / nota</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="relative">
        <label className="label">Agregar producto</label>
        <div className="flex gap-2">
          <input
            className="input"
            value={q}
            onChange={(e) => search(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[0]) add(results[0]);
                else if (q.trim()) await scanned(q.trim());
              }
            }}
            placeholder="Busca o escanea el código de barras"
          />
          <ScanButton label="" onResult={scanned} />
        </div>
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-xl border border-line divide-y divide-line bg-white shadow-lg max-h-64 overflow-y-auto">
            {results.map((p) => (
              <li key={p.id}>
                <button type="button" className="w-full text-left px-3 py-2 hover:bg-paper flex justify-between" onClick={() => add(p)}>
                  <span>{p.name}</span>
                  <span className="text-sm text-muted">{p.stock} en stock</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {lines.length > 0 && (
        <table className="w-full text-[15px]">
          <thead className="text-left text-sm text-muted">
            <tr><th className="py-1">Producto</th><th className="w-24">Cantidad</th><th className="w-36">Costo unitario</th><th className="w-28 text-right">Subtotal</th><th className="w-8"></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l, i) => (
              <tr key={l.productId}>
                <td className="py-2">{l.name}</td>
                <td><input className="input !min-h-10" type="number" min={1} value={l.qty} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, qty: parseInt(e.target.value || "0", 10) } : y)))} /></td>
                <td><input className="input !min-h-10" inputMode="numeric" value={l.cost} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, cost: parseInt(e.target.value.replace(/\D/g, "") || "0", 10) } : y)))} /></td>
                <td className="text-right tabular-nums">${(l.qty * l.cost).toLocaleString("es-CO")}</td>
                <td><button type="button" className="text-muted hover:text-bad text-lg px-2" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">Total compra: ${total.toLocaleString("es-CO")}</p>
        <button
          className="btn-primary"
          disabled={pending || !lines.length}
          onClick={() =>
            start(async () => {
              const r = await receivePurchase({ supplier, note, lines });
              if (r.ok) {
                setLines([]);
                setMsg({ ok: true, text: "Compra registrada. El stock quedó actualizado." });
              } else setMsg({ ok: false, text: r.error ?? "Error" });
            })
          }
        >
          {pending ? "Guardando…" : "Registrar entrada"}
        </button>
      </div>
      {msg && <p className={`rounded-xl px-4 py-3 font-semibold ${msg.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{msg.text}</p>}
    </div>
  );
}
