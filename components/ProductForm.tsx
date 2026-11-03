import { DEVICE_TYPES, PRODUCT_KINDS, GRADES } from "@/lib/constants";

export default function ProductForm({ action, p }: { action: (fd: FormData) => Promise<void>; p?: Record<string, unknown> }) {
  const v = (k: string) => (p?.[k] ?? "") as string | number;
  return (
    <form action={action} className="grid sm:grid-cols-4 gap-4 mt-4">
      {p && <input type="hidden" name="id" value={String(p.id)} />}
      <div className="sm:col-span-2">
        <label className="label">Nombre</label>
        <input name="name" className="input" defaultValue={v("name")} placeholder="Pantalla OLED iPhone 13" required />
      </div>
      <div>
        <label className="label">Tipo</label>
        <select name="kind" className="input" defaultValue={String(v("kind") || "repuesto")}>
          {PRODUCT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Para equipo</label>
        <select name="device_type" className="input" defaultValue={String(v("device_type"))}>
          <option value="">Cualquiera</option>
          {DEVICE_TYPES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Costo</label>
        <input name="cost" className="input" inputMode="numeric" defaultValue={v("cost")} placeholder="$" />
      </div>
      <div>
        <label className="label">Precio de venta</label>
        <input name="price" className="input" inputMode="numeric" defaultValue={v("price")} placeholder="$" />
      </div>
      {!p && (
        <div>
          <label className="label">Stock inicial</label>
          <input name="stock" type="number" min={0} className="input" defaultValue={0} />
        </div>
      )}
      <div>
        <label className="label">Stock mínimo (alerta)</label>
        <input name="min_stock" type="number" min={0} className="input" defaultValue={v("min_stock") || 1} />
      </div>
      <div>
        <label className="label">SKU / referencia</label>
        <input name="sku" className="input" defaultValue={v("sku")} />
      </div>
      <div>
        <label className="label">Código de barras</label>
        <input name="barcode" className="input font-mono" defaultValue={v("barcode")} placeholder="Se genera si lo dejas vacío" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Compatible con</label>
        <input name="compatible" className="input" defaultValue={v("compatible")} placeholder="iPhone 13, iPhone 13 Pro" />
      </div>
      <div>
        <label className="label">Proveedor</label>
        <input name="supplier" className="input" defaultValue={v("supplier")} />
      </div>
      <div>
        <label className="label">IMEI / serial (equipos)</label>
        <input name="imei" className="input font-mono" defaultValue={v("imei")} />
      </div>
      <div>
        <label className="label">Grado (usados)</label>
        <select name="grade" className="input" defaultValue={String(v("grade"))}>
          <option value="">—</option>
          {GRADES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
      </div>
      <div className="sm:col-span-4">
        <button className="btn-primary">{p ? "Guardar cambios" : "Crear producto"}</button>
      </div>
    </form>
  );
}
