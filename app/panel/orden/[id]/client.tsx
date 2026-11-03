"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MediaUploader from "@/components/MediaUploader";
import Checklist from "@/components/Checklist";
import SignaturePad from "@/components/SignaturePad";
import { MEDIA_CATEGORIES, type CheckValue } from "@/lib/constants";
import { addProductItem, createWompiLink, deliver, saveChecklistOut } from "./actions";
import { searchProductsAction } from "@/app/panel/inventario/actions";

export function OrderUploader({ orderId, defaultCategory }: { orderId: number; defaultCategory: string }) {
  const [category, setCategory] = useState(defaultCategory);
  const [isPublic, setIsPublic] = useState(true);
  return (
    <div className="space-y-3 rounded-xl bg-paper p-3.5">
      <div className="flex flex-wrap gap-3 items-center">
        <select className="input !w-auto !min-h-10" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoría">
          {MEDIA_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-5" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Visible para el cliente
        </label>
      </div>
      <MediaUploader orderId={orderId} category={category} isPublic={isPublic} compact />
    </div>
  );
}

export function ChecklistOutForm({ orderId, initial, items }: { orderId: number; initial: Record<string, CheckValue>; items: { key: string; label: string }[] }) {
  const [value, setValue] = useState<Record<string, CheckValue>>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <form
      action={(fd) =>
        start(async () => {
          await saveChecklistOut(fd);
          setSaved(true);
        })
      }
      className="space-y-3"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="checklist" value={JSON.stringify(value)} />
      <Checklist items={items} value={value} onChange={(v) => { setValue(v); setSaved(false); }} />
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Guardar control de calidad"}</button>
        {saved && <span className="text-sm text-good font-semibold">Guardado</span>}
      </div>
    </form>
  );
}

export function DeliverForm({ orderId, customerName, balance }: { orderId: number; customerName: string; balance: number }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [to, setTo] = useState(customerName);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {balance > 0 && (
        <p className="rounded-xl bg-warn-soft text-warn font-semibold px-3 py-2 text-sm">
          Hay un saldo pendiente de ${balance.toLocaleString("es-CO")}. Regístralo en Pagos antes de entregar.
        </p>
      )}
      <div>
        <label className="label">Recibe</label>
        <input className="input" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <p className="text-sm text-muted">El cliente probó el equipo y lo recibe a satisfacción. Se le explicó la garantía.</p>
      <SignaturePad onChange={setSignature} height={150} />
      {error && <p className="text-bad font-medium text-sm">{error}</p>}
      <button
        type="button"
        className="btn-good w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("orderId", String(orderId));
            fd.set("signature", signature ?? "");
            fd.set("delivered_to", to);
            const res = await deliver(fd);
            if (!res.ok) setError(res.error ?? "Error");
            else router.refresh();
          })
        }
      >
        {pending ? "Guardando…" : "Confirmar entrega"}
      </button>
    </div>
  );
}

export function CopyButton({ text, label = "Copiar enlace" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt("Copia el enlace:", text);
        }
      }}
    >
      {done ? "¡Copiado!" : label}
    </button>
  );
}

export function ConfirmButton({ children, className, message }: { children: React.ReactNode; className: string; message: string }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

type FoundProduct = { id: number; name: string; price: number; stock: number; track_stock: number };

export function PartPicker({ orderId }: { orderId: number }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoundProduct[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  async function search(v: string) {
    setQ(v);
    if (v.trim().length < 2) return setResults([]);
    setResults(await searchProductsAction(v));
  }
  return (
    <div className="space-y-2">
      <input className="input !min-h-10" value={q} onChange={(e) => search(e.target.value)} placeholder="Buscar repuesto en inventario…" />
      {results.length > 0 && (
        <ul className="rounded-2xl border border-white/[0.12] divide-y divide-white/[0.06] bg-[#0f1b2c] max-h-56 overflow-y-auto shadow-2xl">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={pending}
                className="w-full text-left px-3.5 py-2.5 hover:bg-white/[0.06] flex justify-between gap-2 text-white transition"
                onClick={() =>
                  start(async () => {
                    const fd = new FormData();
                    fd.set("orderId", String(orderId));
                    fd.set("productId", String(p.id));
                    await addProductItem(fd);
                    setQ("");
                    setResults([]);
                    router.refresh();
                  })
                }
              >
                <span>{p.name}</span>
                <span className="text-sm text-muted whitespace-nowrap">
                  ${p.price.toLocaleString("es-CO")} · {p.track_stock ? `${p.stock} en stock` : "servicio"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WompiButton({ orderId, phone, orderNumber }: { orderId: number; phone: string; orderNumber: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ url?: string; error?: string } | null>(null);
  const wa = (url: string) => {
    let d = phone.replace(/\D/g, "");
    if (d.length === 10 && d.startsWith("3")) d = "57" + d;
    return `https://wa.me/${d}?text=${encodeURIComponent(`Puedes pagar el saldo de tu orden ${orderNumber} en línea aquí: ${url}`)}`;
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-ghost w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("orderId", String(orderId));
            setResult(await createWompiLink(fd));
          })
        }
      >
        {pending ? "Creando link…" : "Crear link de pago (Wompi)"}
      </button>
      {result?.error && <p className="text-sm text-bad">{result.error}</p>}
      {result?.url && (
        <div className="flex flex-wrap gap-2">
          <CopyButton text={result.url} label="Copiar link" />
          <a className="btn-good" target="_blank" href={wa(result.url)}>Enviar por WhatsApp</a>
        </div>
      )}
    </div>
  );
}
