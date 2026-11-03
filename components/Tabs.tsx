import Link from "next/link";

export default function Tabs({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <nav className="flex gap-1 border-b border-line overflow-x-auto">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`px-4 py-2.5 text-[14px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
            active === t.key ? "border-blue-400 text-blue-400" : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export const INVENTORY_TABS = [
  { key: "productos", href: "/panel/inventario", label: "Productos y repuestos" },
  { key: "compra", href: "/panel/inventario/compra", label: "Entrada de compra" },
  { key: "catalogo", href: "/panel/inventario/catalogo", label: "Catálogo de reparaciones" },
];
