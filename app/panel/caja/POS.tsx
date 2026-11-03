"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSale, findCustomerByPhone, findOrderForCheckout, type SaleLine } from "./actions";
import { searchProductsAction } from "../inventario/actions";
import ScanButton from "@/components/Scanner";
import { PAYMENT_METHODS } from "@/lib/constants";

type OrderLineInfo = NonNullable<Awaited<ReturnType<typeof findOrderForCheckout>>>;
type Customer = { id: number; name: string; phone: string; credit: number; points?: number };
type Found = Awaited<ReturnType<typeof searchProductsAction>>[number];

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const num = (v: string) => parseInt(v.replace(/\D/g, "") || "0", 10);

export default function POS({ initialOrder }: { initialOrder: OrderLineInfo | null }) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<SaleLine[]>(
    initialOrder && initialOrder.balance > 0
      ? [{ type: "order", orderId: initialOrder.orderId, description: initialOrder.description, qty: 1, unitPrice: initialOrder.balance }]
      : [],
  );
  const [customer, setCustomer] = useState<Customer | null>(initialOrder?.customer ?? null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [phone, setPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [orderCode, setOrderCode] = useState("");
  const [custom, setCustom] = useState({ description: "", price: "" });
  const [discount, setDiscount] = useState(0);
  const [payments, setPayments] = useState<{ method: string; amount: number }[]>([{ method: "Efectivo", amount: 0 }]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Atajo de teclado: F2 para enfocar el buscador
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const total = Math.max(subtotal - discount, 0);
  // Con un solo medio de pago vacío se asume que paga el total exacto.
  const effective = payments.length === 1 && !payments[0].amount ? [{ ...payments[0], amount: total }] : payments;
  const paid = effective.reduce((s, p) => s + p.amount, 0);
  const change = paid - total;

  async function search(v: string) {
    setQ(v);
    if (v.trim().length < 2) return setResults([]);
    setResults(await searchProductsAction(v));
  }
  function addProduct(p: Found) {
    setLines((l) => {
      const i = l.findIndex((x) => x.type === "product" && x.productId === p.id);
      if (i >= 0) return l.map((x, j) => (j === i ? ({ ...x, qty: x.qty + 1 } as SaleLine) : x));
      return [...l, { type: "product", productId: p.id, description: p.name, qty: 1, unitPrice: p.price }];
    });
    setQ("");
    setResults([]);
    searchInputRef.current?.focus();
  }
  async function scanned(code: string) {
    setMsg(null);
    const clean = code.trim();
    if (!clean) return;

    // Si tiene prefijo o formato de orden R-XXXX, priorizar búsqueda de orden
    if (/^r-?\d+/i.test(clean)) {
      const o = await findOrderForCheckout(clean);
      if (o) {
        addOrder(o);
        searchInputRef.current?.focus();
        return;
      }
    }

    const r = await searchProductsAction(clean);
    if (r[0] && (r[0].barcode === clean || r.length === 1)) {
      addProduct(r[0]);
      searchInputRef.current?.focus();
      return;
    }
    const o = await findOrderForCheckout(clean);
    if (o) {
      addOrder(o);
      searchInputRef.current?.focus();
      return;
    }
    setMsg(`No se encontró el producto u orden con código "${clean}".`);
    searchInputRef.current?.focus();
  }
  function addOrder(o: OrderLineInfo) {
    if (o.balance <= 0) return setMsg(`La orden ${o.number} no tiene saldo pendiente.`);
    if (lines.some((l) => l.type === "order" && l.orderId === o.orderId)) return;
    setLines((l) => [...l, { type: "order", orderId: o.orderId, description: o.description, qty: 1, unitPrice: o.balance }]);
    if (!customer) setCustomer(o.customer);
    setOrderCode("");
    searchInputRef.current?.focus();
  }
  async function lookupOrder() {
    setMsg(null);
    const o = await findOrderForCheckout(orderCode);
    if (!o) return setMsg("No encontramos esa orden.");
    addOrder(o);
  }
  async function lookupCustomer() {
    const c = await findCustomerByPhone(phone);
    setCustomer(c);
    if (!c) setMsg("Cliente nuevo: escribe su nombre para guardarlo con la venta (opcional).");
  }
  function fillRemaining(i: number) {
    const others = payments.reduce((s, p, j) => (j === i ? s : s + p.amount), 0);
    setPayments((ps) => ps.map((p, j) => (j === i ? { ...p, amount: Math.max(total - others, 0) } : p)));
  }

  function checkout() {
    setMsg(null);
    start(async () => {
      const r = await createSale({
        customerId: customer?.id ?? null,
        newCustomer: !customer && newName && phone ? { name: newName, phone } : null,
        lines,
        discount,
        payments: effective,
        pointsRedeemed: pointsToRedeem,
      });
      if (r.ok) router.push(`/panel/ventas/${r.id}`);
      else setMsg(r.error);
    });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-5 items-start">
      <div className="space-y-4 min-w-0">
        <div className="card p-4 space-y-3">
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Producto (busca o escanea)</label>
              <kbd className="text-[11px] font-mono text-muted bg-white/5 px-2 py-0.5 rounded border border-white/10" title="Atajo para enfocar">F2</kbd>
            </div>
            <div className="flex gap-2">
              <input
                ref={searchInputRef}
                className="input"
                value={q}
                onChange={(e) => search(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (results[0]) addProduct(results[0]);
                    else if (q.trim()) await scanned(q.trim());
                  }
                }}
                placeholder="Vidrio templado, cargador, AirPods…"
                autoFocus
              />
              <ScanButton label="" onResult={scanned} />
            </div>
            {results.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-2xl border border-white/[0.12] divide-y divide-white/[0.06] bg-[#0f1b2c] shadow-2xl max-h-72 overflow-y-auto">
                {results.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="w-full text-left px-3.5 py-3 hover:bg-white/[0.06] flex justify-between gap-3 text-white transition" onClick={() => addProduct(p)}>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-sm text-slate-400 whitespace-nowrap">{fmt(p.price)} · {p.track_stock ? `${p.stock} disp.` : "servicio"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Cobrar una orden de reparación</label>
              <div className="flex gap-2">
                <input className="input font-mono" value={orderCode} onChange={(e) => setOrderCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookupOrder()} placeholder="R-0001" />
                <button type="button" className="btn-ghost" onClick={lookupOrder}>Agregar</button>
              </div>
            </div>
            <div>
              <label className="label">Ítem libre</label>
              <div className="flex gap-2">
                <input className="input" value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} placeholder="Descripción" />
                <input className="input !w-28" inputMode="numeric" value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} placeholder="$" />
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    if (!custom.description || !num(custom.price)) return;
                    setLines((l) => [...l, { type: "custom", description: custom.description, qty: 1, unitPrice: num(custom.price) }]);
                    setCustom({ description: "", price: "" });
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          {lines.length === 0 ? (
            <p className="p-6 text-muted text-center">Agrega productos, una orden o un ítem libre.</p>
          ) : (
            <table className="w-full text-[15px]">
              <tbody className="divide-y divide-line">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="p-3">
                      {l.description}
                      {l.type === "order" && <span className="chip bg-accent-soft text-accent ml-2">orden</span>}
                    </td>
                    <td className="p-2 w-24">
                      {l.type === "order" ? (
                        <span className="text-muted pl-2">1</span>
                      ) : (
                        <input className="input !min-h-10 text-center" type="number" min={1} value={l.qty} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, qty: Math.max(1, parseInt(e.target.value || "1", 10)) } as SaleLine : y)))} />
                      )}
                    </td>
                    <td className="p-2 w-36">
                      <input className="input !min-h-10 text-right" inputMode="numeric" disabled={l.type === "order"} value={l.unitPrice.toLocaleString("es-CO")} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, unitPrice: num(e.target.value) } as SaleLine : y)))} />
                    </td>
                    <td className="p-3 text-right tabular-nums font-semibold w-32">{fmt(l.qty * l.unitPrice)}</td>
                    <td className="pr-2 w-8"><button type="button" className="text-muted hover:text-bad text-xl" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <aside className="card p-4 space-y-4 lg:sticky lg:top-20">
        <div>
          <label className="label">Cliente (opcional)</label>
          {customer ? (
            <div className="rounded-xl bg-paper p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-sm text-muted">
                    {customer.phone}
                    {customer.credit > 0 ? ` · saldo a favor ${fmt(customer.credit)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm text-accent font-semibold"
                  onClick={() => {
                    setCustomer(null);
                    if (pointsToRedeem > 0) {
                      setDiscount((d) => Math.max(0, d - pointsToRedeem * 20));
                      setPointsToRedeem(0);
                    }
                  }}
                >
                  Cambiar
                </button>
              </div>
              {(customer.points ?? 0) > 0 && (
                <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-bold text-amber-400">⭐ {customer.points} pts</span>
                    <span className="text-slate-400"> ({fmt((customer.points ?? 0) * 20)})</span>
                  </div>
                  {pointsToRedeem > 0 ? (
                    <button
                      type="button"
                      className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                      onClick={() => {
                        setDiscount((d) => Math.max(0, d - pointsToRedeem * 20));
                        setPointsToRedeem(0);
                      }}
                    >
                      Quitar descuento
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition"
                      onClick={() => {
                        const maxPointsPossible = Math.floor(subtotal / 20);
                        const redeemable = Math.min(customer.points ?? 0, maxPointsPossible);
                        if (redeemable <= 0) return;
                        const discountVal = redeemable * 20;
                        setDiscount(discountVal);
                        setPointsToRedeem(redeemable);
                      }}
                    >
                      Redimir pts ({fmt(Math.min((customer.points ?? 0) * 20, subtotal))})
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookupCustomer()} placeholder="Celular" />
                <button type="button" className="btn-ghost" onClick={lookupCustomer}>Buscar</button>
              </div>
              {phone && <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre (si es cliente nuevo)" />}
            </div>
          )}
        </div>

        <dl className="space-y-1.5 text-[15px]">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{fmt(subtotal)}</dd></div>
          <div className="flex justify-between items-center gap-3">
            <dt className="text-muted">Descuento</dt>
            <dd><input className="input !min-h-9 !w-32 text-right" inputMode="numeric" value={discount ? discount.toLocaleString("es-CO") : ""} onChange={(e) => setDiscount(num(e.target.value))} placeholder="$0" /></dd>
          </div>
          <div className="flex justify-between text-2xl font-bold pt-1"><dt>Total</dt><dd className="tabular-nums">{fmt(total)}</dd></div>
        </dl>

        <div className="space-y-2">
          <p className="label">Pago</p>
          {payments.map((p, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex gap-2">
                <select className="input !min-h-11" value={p.method} onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>
                  {PAYMENT_METHODS.filter((m) => m !== "Wompi").map((m) => <option key={m}>{m}</option>)}
                </select>
                <input className="input !min-h-11 text-right" inputMode="numeric" value={p.amount ? p.amount.toLocaleString("es-CO") : ""} onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: num(e.target.value) } : x)))} placeholder={payments.length === 1 ? fmt(total) : "$0"} />
                <button type="button" className="btn-ghost !min-h-11 !px-2.5 text-sm" title="Completar con lo que falta" onClick={() => fillRemaining(i)}>Resto</button>
                {payments.length > 1 && <button type="button" className="text-muted text-xl px-1" onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))}>×</button>}
              </div>
              {p.method === "Efectivo" && total > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-muted mr-0.5">Billetes:</span>
                  <button
                    type="button"
                    className="px-2 py-0.5 text-xs font-semibold rounded bg-white/10 hover:bg-white/20 text-slate-200 transition"
                    onClick={() => {
                      const others = payments.reduce((s, x, j) => (j === i ? s : s + x.amount), 0);
                      setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: Math.max(0, total - others) } : x)));
                    }}
                  >
                    Exacto
                  </button>
                  {[10000, 20000, 50000, 100000].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      className="px-2 py-0.5 text-xs font-semibold rounded bg-white/10 hover:bg-white/20 text-slate-200 transition"
                      onClick={() => {
                        setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: bill } : x)));
                      }}
                    >
                      ${bill >= 1000 ? `${bill / 1000}k` : bill}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button type="button" className="text-sm font-semibold text-accent" onClick={() => setPayments((ps) => [...ps, { method: "Transferencia", amount: 0 }])}>+ Dividir pago</button>
          {total > 0 && paid > 0 && (payments.length > 1 || payments[0].amount > 0) && (
            <p className={`font-semibold ${change >= 0 ? "text-good" : "text-warn"}`}>{change >= 0 ? `Cambio: ${fmt(change)}` : `Falta: ${fmt(-change)}`}</p>
          )}
        </div>

        {msg && <p className="rounded-xl bg-bad-soft text-bad text-sm font-medium px-3 py-2">{msg}</p>}
        <button type="button" className="btn-good w-full !min-h-14 text-lg" disabled={pending || !lines.length || paid < total} onClick={checkout}>
          {pending ? "Cobrando…" : `Cobrar ${fmt(total)}`}
        </button>
      </aside>
    </div>
  );
}
