export type UserPermissions = {
  // --- Módulos / Ingreso (Acceso) ---
  orders_view: boolean;       // Ver tablero Kanban y órdenes de reparación
  caja_view: boolean;         // Ver flujo de caja y ventas
  inventory_view: boolean;    // Ver catálogo e inventario
  customers_view: boolean;    // Ver base de clientes
  buybacks_view: boolean;     // Ver módulo de retomas
  appointments_view: boolean; // Ver citas
  reports_view: boolean;      // Ver reportes financieros y estadísticas
  settings_view: boolean;     // Ver y administrar ajustes del sistema
  
  // --- Operaciones / Modificar datos en BD ---
  orders_create: boolean;     // Crear órdenes de reparación (Recepción)
  orders_edit: boolean;       // Modificar diagnósticos, estados, presupuestos y repuestos
  orders_delete: boolean;     // Eliminar órdenes de la base de datos
  caja_register: boolean;     // Registrar cobros, abonos, ventas y movimientos de caja
  inventory_edit: boolean;    // Crear productos, cambiar precios y compras de stock
  customers_edit: boolean;    // Crear y actualizar datos de clientes
  view_costs: boolean;        // Ver costos de compra y margen de ganancia real
};

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, UserPermissions> = {
  admin: {
    orders_view: true,
    caja_view: true,
    inventory_view: true,
    customers_view: true,
    buybacks_view: true,
    appointments_view: true,
    reports_view: true,
    settings_view: true,
    orders_create: true,
    orders_edit: true,
    orders_delete: true,
    caja_register: true,
    inventory_edit: true,
    customers_edit: true,
    view_costs: true,
  },
  tecnico: {
    orders_view: true,
    caja_view: false,
    inventory_view: true,
    customers_view: true,
    buybacks_view: false,
    appointments_view: true,
    reports_view: false,
    settings_view: false,
    orders_create: false,
    orders_edit: true,
    orders_delete: false,
    caja_register: false,
    inventory_edit: false,
    customers_edit: false,
    view_costs: false,
  },
  asesor: {
    orders_view: true,
    caja_view: true,
    inventory_view: true,
    customers_view: true,
    buybacks_view: true,
    appointments_view: true,
    reports_view: false,
    settings_view: false,
    orders_create: true,
    orders_edit: true,
    orders_delete: false,
    caja_register: true,
    inventory_edit: false,
    customers_edit: true,
    view_costs: false,
  },
  custom: {
    orders_view: true,
    caja_view: false,
    inventory_view: true,
    customers_view: true,
    buybacks_view: false,
    appointments_view: true,
    reports_view: false,
    settings_view: false,
    orders_create: true,
    orders_edit: true,
    orders_delete: false,
    caja_register: false,
    inventory_edit: false,
    customers_edit: false,
    view_costs: false,
  },
};

export function parsePermissions(raw: string | null | undefined, role: string): UserPermissions {
  if (role === "admin") {
    return { ...DEFAULT_PERMISSIONS_BY_ROLE.admin };
  }
  const base = DEFAULT_PERMISSIONS_BY_ROLE[role] || DEFAULT_PERMISSIONS_BY_ROLE.asesor;
  if (!raw) return { ...base };
  try {
    const parsed = JSON.parse(raw);
    return { ...base, ...parsed };
  } catch {
    return { ...base };
  }
}
