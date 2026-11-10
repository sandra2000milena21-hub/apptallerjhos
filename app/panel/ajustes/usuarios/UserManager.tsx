"use client";

import { useState, useTransition } from "react";
import {
  DEFAULT_PERMISSIONS_BY_ROLE,
  type UserPermissions,
} from "@/lib/permissions";
import {
  createUserAction,
  updateUserAction,
  toggleUserStatusAction,
  deleteUserAction,
  resetPasswordAction,
} from "./actions";

export type ManagedUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  active: number;
  created_at: string;
  permissions: UserPermissions;
};

type Props = {
  users: ManagedUser[];
  currentUserId: number;
};

const PERMISSION_SECTIONS: {
  title: string;
  subtitle: string;
  icon: string;
  items: { key: keyof UserPermissions; label: string; desc: string }[];
}[] = [
  {
    title: "Acceso a Módulos (Ingresar)",
    subtitle: "Determina a cuáles áreas y pantallas del sistema puede entrar el perfil",
    icon: "👁️",
    items: [
      { key: "orders_view", label: "Tablero y Reparaciones", desc: "Ver el tablero Kanban y consultar órdenes de trabajo" },
      { key: "caja_view", label: "Módulo de Caja", desc: "Ingresar a caja para consultar movimientos y cobros" },
      { key: "inventory_view", label: "Inventario y Catálogo", desc: "Consultar repuestos, accesorios y stock disponible" },
      { key: "customers_view", label: "Base de Clientes", desc: "Consultar lista de clientes, historiales y puntos" },
      { key: "buybacks_view", label: "Módulo de Retomas", desc: "Consultar equipos recibidos por compra o permuta" },
      { key: "appointments_view", label: "Citas Agendadas", desc: "Consultar citas programadas en línea o en local" },
      { key: "reports_view", label: "Reportes y Métricas", desc: "Ver estadísticas de ingresos, ganancias y balances" },
      { key: "settings_view", label: "Ajustes del Sistema", desc: "Ver y modificar configuración general del taller" },
    ],
  },
  {
    title: "Base de Datos Principal (Modificar Datos)",
    subtitle: "Controla qué cambios y registros puede guardar o eliminar en la base de datos",
    icon: "💾",
    items: [
      { key: "orders_create", label: "Crear Órdenes (Recepción)", desc: "Recibir equipos de clientes y abrir nuevas órdenes" },
      { key: "orders_edit", label: "Modificar Órdenes", desc: "Cambiar estado, agregar diagnósticos, presupuestos y repuestos" },
      { key: "orders_delete", label: "Eliminar Órdenes", desc: "Borrar órdenes definitivamente de la base de datos" },
      { key: "caja_register", label: "Cobrar y Registrar Dinero", desc: "Cobrar reparaciones, registrar ventas y movimientos de caja" },
      { key: "inventory_edit", label: "Modificar Inventario", desc: "Crear productos, cambiar precios y registrar compras de stock" },
      { key: "customers_edit", label: "Crear y Editar Clientes", desc: "Registrar nuevos clientes o actualizar sus datos personales" },
      { key: "view_costs", label: "Ver Costos y Márgenes", desc: "Visualizar precios de compra y margen neto de ganancia" },
    ],
  },
];

const ROLE_INFO: Record<string, { label: string; badge: string; color: string; desc: string }> = {
  admin: {
    label: "Administrador",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    color: "from-blue-600 to-indigo-600",
    desc: "Acceso y control total de la base de datos",
  },
  tecnico: {
    label: "Técnico",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    color: "from-emerald-600 to-teal-600",
    desc: "Órdenes, diagnósticos, repuestos utilizados",
  },
  asesor: {
    label: "Asesor Mostrador",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    color: "from-amber-600 to-orange-600",
    desc: "Recepción, caja, clientes y ventas mostrador",
  },
  custom: {
    label: "Personalizado",
    badge: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    color: "from-purple-600 to-violet-600",
    desc: "Permisos asignados a la medida por el administrador",
  },
};

export default function UserManager({ users, currentUserId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form State for Create/Edit
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "asesor",
  });
  const [selectedPermissions, setSelectedPermissions] = useState<UserPermissions>(
    DEFAULT_PERMISSIONS_BY_ROLE.asesor,
  );

  function openCreateModal() {
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "asesor",
    });
    setSelectedPermissions({ ...DEFAULT_PERMISSIONS_BY_ROLE.asesor });
    setErrorMsg(null);
    setModalOpen(true);
  }

  function openEditModal(u: ManagedUser) {
    setEditingUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      phone: u.phone || "",
      password: "",
      role: u.role,
    });
    setSelectedPermissions({ ...u.permissions });
    setErrorMsg(null);
    setModalOpen(true);
  }

  function handleRolePresetChange(roleKey: string) {
    setFormData((prev) => ({ ...prev, role: roleKey }));
    const preset = DEFAULT_PERMISSIONS_BY_ROLE[roleKey] || DEFAULT_PERMISSIONS_BY_ROLE.asesor;
    setSelectedPermissions({ ...preset });
  }

  function togglePermission(key: keyof UserPermissions) {
    setSelectedPermissions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Si difiere del rol actual, marcarlo como personalizado
      if (formData.role !== "custom") {
        setFormData((f) => ({ ...f, role: "custom" }));
      }
      return next;
    });
  }

  function selectAllPermissions(val: boolean) {
    const next: Record<string, boolean> = {};
    for (const sec of PERMISSION_SECTIONS) {
      for (const it of sec.items) {
        next[it.key] = val;
      }
    }
    setSelectedPermissions(next as UserPermissions);
    if (!val) {
      setFormData((f) => ({ ...f, role: "custom" }));
    } else {
      setFormData((f) => ({ ...f, role: "admin" }));
    }
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const fd = new FormData();
    if (editingUser) {
      fd.append("id", String(editingUser.id));
    }
    fd.append("name", formData.name);
    fd.append("email", formData.email);
    fd.append("phone", formData.phone);
    fd.append("password", formData.password);
    fd.append("role", formData.role);

    // Adjuntar permisos
    for (const [key, val] of Object.entries(selectedPermissions)) {
      if (val) fd.append(`perm_${key}`, "1");
    }

    startTransition(async () => {
      const res = editingUser ? await updateUserAction(fd) : await createUserAction(fd);
      if (res.ok) {
        setSuccessMsg(
          editingUser
            ? `Perfil de "${formData.name}" actualizado correctamente.`
            : `Usuario "${formData.name}" creado exitosamente.`,
        );
        setModalOpen(false);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.error || "Ocurrió un error.");
      }
    });
  }

  async function handleToggleStatus(u: ManagedUser) {
    if (u.id === currentUserId) return;
    startTransition(async () => {
      const res = await toggleUserStatusAction(u.id);
      if (res.ok) {
        setSuccessMsg(`Estado de "${u.name}" actualizado.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || "Error al cambiar estado.");
      }
    });
  }

  async function handleDelete(u: ManagedUser) {
    if (u.id === currentUserId) return;
    const confirm = window.confirm(
      `¿Estás seguro de eliminar el perfil de "${u.name}"? Esta acción removerá sus credenciales de acceso.`,
    );
    if (!confirm) return;

    startTransition(async () => {
      const res = await deleteUserAction(u.id);
      if (res.ok) {
        setSuccessMsg(res.notice || `Usuario "${u.name}" eliminado correctamente.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || "Error al eliminar usuario.");
      }
    });
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (newPassword.length < 4) {
      setErrorMsg("La contraseña debe tener mínimo 4 caracteres.");
      return;
    }
    startTransition(async () => {
      const res = await resetPasswordAction(passwordModalUser.id, newPassword);
      if (res.ok) {
        setSuccessMsg(`Contraseña de "${passwordModalUser.name}" actualizada con éxito.`);
        setPasswordModalUser(null);
        setNewPassword("");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || "Error al cambiar contraseña.");
      }
    });
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q)) ||
      (ROLE_INFO[u.role]?.label || u.role).toLowerCase().includes(q)
    );
  });

  const activeCount = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const techCount = users.filter((u) => u.role === "tecnico").length;

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {successMsg && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-emerald-300 font-semibold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-rose-300 font-semibold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Cabecera y botón nuevo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>👥</span> Usuarios y Permisos de Base de Datos
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Crea cuentas independientes para cada empleado. Administra contraseñas y define con precisión a qué pantallas pueden entrar y qué datos pueden crear, editar o eliminar.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-accent rounded-2xl px-5 py-3 font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/30 hover:scale-105 transition shrink-0"
        >
          <span className="text-lg leading-none">+</span> Crear Nuevo Usuario
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 rounded-2xl bg-[#142136] border border-white/[0.08]">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Usuarios</p>
          <p className="text-2xl font-black text-white mt-1">{users.length}</p>
        </div>
        <div className="card p-4 rounded-2xl bg-[#142136] border border-white/[0.08]">
          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-400">Activos</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</p>
        </div>
        <div className="card p-4 rounded-2xl bg-[#142136] border border-white/[0.08]">
          <p className="text-xs uppercase tracking-wider font-semibold text-blue-400">Administradores</p>
          <p className="text-2xl font-black text-blue-400 mt-1">{adminCount}</p>
        </div>
        <div className="card p-4 rounded-2xl bg-[#142136] border border-white/[0.08]">
          <p className="text-xs uppercase tracking-wider font-semibold text-amber-400">Técnicos / Asesores</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{users.length - adminCount}</p>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo o rol..."
            className="input w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0d1726] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-400"
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
        </div>
      </div>

      {/* Listado de perfiles */}
      <div className="grid gap-3">
        {filtered.map((u) => {
          const roleData = ROLE_INFO[u.role] || ROLE_INFO.custom;
          const initial = (u.name.charAt(0) || "U").toUpperCase();
          const isMe = u.id === currentUserId;
          const allowedCount = Object.values(u.permissions || {}).filter(Boolean).length;

          return (
            <div
              key={u.id}
              className={`card p-4 sm:p-5 rounded-2xl bg-[#142136] border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                u.active ? "border-white/[0.08] hover:border-blue-500/30" : "opacity-60 border-white/[0.04] bg-[#0f1929]"
              }`}
            >
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div
                  className={`size-12 rounded-2xl bg-gradient-to-tr ${roleData.color} flex items-center justify-center font-black text-white text-lg shadow-md shrink-0`}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-base text-white truncate">{u.name}</h3>
                    {isMe && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        Tu Cuenta (Principal)
                      </span>
                    )}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${roleData.badge}`}
                    >
                      {roleData.label}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        u.active
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {u.active ? "● Activo" : "○ Inactivo"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>✉️ {u.email}</span>
                    {u.phone && <span>📱 {u.phone}</span>}
                    <span className="text-slate-400 font-semibold">
                      🛡️ {u.role === "admin" ? "Control Total" : `${allowedCount}/15 permisos activos`}
                    </span>
                  </div>

                  {/* Chips de permisos clave */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {u.permissions?.orders_view && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-300 border border-white/[0.06]">
                        Tablero
                      </span>
                    )}
                    {u.permissions?.caja_view && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-300 border border-white/[0.06]">
                        Caja
                      </span>
                    )}
                    {u.permissions?.inventory_view && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-300 border border-white/[0.06]">
                        Inventario
                      </span>
                    )}
                    {u.permissions?.customers_view && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-300 border border-white/[0.06]">
                        Clientes
                      </span>
                    )}
                    {u.permissions?.reports_view && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-300 border border-white/[0.06]">
                        Reportes
                      </span>
                    )}
                    {u.permissions?.orders_edit && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        Edita Órdenes
                      </span>
                    )}
                    {u.permissions?.orders_delete && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        Elimina Órdenes
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.06] shrink-0">
                <button
                  type="button"
                  onClick={() => openEditModal(u)}
                  className="btn-ghost text-xs !min-h-9 px-3 rounded-xl border border-white/10 hover:border-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  ✏️ Editar y Permisos
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(u)}
                  className="btn-ghost text-xs !min-h-9 px-3 rounded-xl border border-white/10 hover:border-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  🔑 Clave
                </button>
                {!isMe && (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleStatus(u)}
                      className={`btn-ghost text-xs !min-h-9 px-3 rounded-xl border ${
                        u.active
                          ? "border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                          : "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                      }`}
                    >
                      {u.active ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(u)}
                      className="btn-ghost text-xs !min-h-9 px-3 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="card p-10 text-center text-slate-400 bg-[#142136] rounded-2xl border border-white/[0.08]">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-semibold text-white">No se encontraron usuarios</p>
            <p className="text-xs text-slate-500 mt-1">Prueba cambiando el término de búsqueda.</p>
          </div>
        )}
      </div>

      {/* MODAL CREAR / EDITAR USUARIO Y PERMISOS */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="card w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#0f1929] border border-white/15 rounded-3xl shadow-2xl overflow-hidden my-auto">
            {/* Header Modal */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-[#142136]">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <span>{editingUser ? "✏️ Editar Perfil y Permisos" : "👤 Crear Nuevo Usuario"}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingUser
                    ? `Modificando datos y permisos de "${editingUser.name}"`
                    : "Asigna nombre, usuario, contraseña y permisos específicos para la base de datos"}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-lg transition"
              >
                ✕
              </button>
            </div>

            {/* Formulario con Scroll */}
            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Sección 1: Datos de Acceso */}
              <div className="space-y-4">
                <p className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <span>👤</span> Datos de Ingreso al Sistema
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label text-xs uppercase tracking-wider text-slate-300">
                      Nombre Completo *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej. Juan Pérez"
                      className="input rounded-xl bg-[#0d1726] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="label text-xs uppercase tracking-wider text-slate-300">
                      Correo o Usuario de Ingreso *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Ej. juan@mitaller.co o juan"
                      className="input rounded-xl bg-[#0d1726] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-400"
                      autoCapitalize="none"
                    />
                  </div>
                  <div>
                    <label className="label text-xs uppercase tracking-wider text-slate-300">
                      {editingUser ? "Nueva Contraseña (Opcional)" : "Contraseña de Ingreso *"}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? "Dejar en blanco para no cambiarla" : "Mínimo 4 caracteres"}
                      autoComplete="new-password"
                      className="input rounded-xl bg-[#0d1726] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="label text-xs uppercase tracking-wider text-slate-300">
                      Teléfono de Contacto (Opcional)
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Ej. 3001234567"
                      className="input rounded-xl bg-[#0d1726] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Selector de Rol Base */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <span>🎭</span> Perfil / Rol Base
                  </p>
                  <span className="text-[11px] text-slate-400">
                    Al elegir un rol se autoseleccionan los permisos recomendados
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {Object.entries(ROLE_INFO).map(([key, info]) => {
                    const isSelected = formData.role === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleRolePresetChange(key)}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? "bg-blue-600/20 border-blue-400 ring-2 ring-blue-500/30 text-white shadow-lg"
                            : "bg-[#142136] border-white/10 text-slate-300 hover:border-white/25 hover:bg-[#182842]"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-black text-sm">{info.label}</span>
                          {isSelected && <span className="text-blue-400 text-xs">✓</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2">{info.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sección 3: Matriz de Permisos Detallada */}
              <div className="space-y-5 pt-2 border-t border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <span>🛡️</span> Permisos Granulares de la Base de Datos
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Puedes personalizar cualquier permiso individual marcando o desmarcando las casillas:
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectAllPermissions(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 underline font-semibold"
                    >
                      Marcar todos
                    </button>
                    <span className="text-slate-600">·</span>
                    <button
                      type="button"
                      onClick={() => selectAllPermissions(false)}
                      className="text-xs text-slate-400 hover:text-white underline font-semibold"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                </div>

                {PERMISSION_SECTIONS.map((sec, sIdx) => (
                  <div key={sIdx} className="space-y-2.5 bg-[#142136]/60 p-4 rounded-2xl border border-white/[0.06]">
                    <div className="flex items-center gap-2 pb-1 border-b border-white/[0.06]">
                      <span className="text-base">{sec.icon}</span>
                      <div>
                        <h4 className="font-bold text-white text-sm">{sec.title}</h4>
                        <p className="text-[11px] text-slate-400">{sec.subtitle}</p>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 pt-1">
                      {sec.items.map((item) => {
                        const checked = Boolean(selectedPermissions[item.key]);
                        return (
                          <label
                            key={item.key}
                            className={`flex items-start gap-3 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                              checked
                                ? "bg-blue-600/10 border-blue-500/30 text-white"
                                : "bg-[#0d1726]/60 border-white/[0.04] text-slate-400 hover:bg-[#0d1726]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(item.key)}
                              className="size-4 rounded accent-blue-500 mt-0.5 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className={`font-semibold text-xs ${checked ? "text-white" : "text-slate-300"}`}>
                                {item.label}
                              </p>
                              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{item.desc}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Botones de acción */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3 sticky bottom-0 bg-[#0f1929]/95 backdrop-blur-md py-3 -mx-6 px-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-ghost rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-accent rounded-xl px-6 py-2.5 font-bold text-sm shadow-lg shadow-blue-600/30 hover:scale-105 transition"
                >
                  {isPending ? "Guardando..." : editingUser ? "Guardar Cambios" : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CAMBIAR CONTRASEÑA */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 bg-[#0f1929] border border-white/15 rounded-3xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🔑</span> Cambiar Contraseña
              </h3>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Asignar nueva contraseña de acceso para <strong className="text-white">{passwordModalUser.name}</strong> ({passwordModalUser.email}).
            </p>
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="label text-xs uppercase tracking-wider text-slate-300">Nueva Contraseña</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  autoComplete="new-password"
                  className="input rounded-xl bg-[#0d1726] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-400"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="btn-ghost rounded-xl px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-accent rounded-xl px-5 py-2 font-bold text-sm shadow-md shadow-blue-600/25"
                >
                  {isPending ? "Guardando..." : "Actualizar Clave"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
