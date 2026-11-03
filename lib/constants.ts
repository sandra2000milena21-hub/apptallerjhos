export const STATUSES = [
  { key: "recibido", label: "Recibido", short: "Recibido", client: "Recibimos tu equipo" },
  { key: "diagnostico", label: "En diagnóstico", short: "Diagnóstico", client: "Estamos revisando tu equipo" },
  { key: "cotizado", label: "Cotizado · esperando aprobación", short: "Cotizado", client: "Te enviamos la cotización" },
  { key: "esperando_repuesto", label: "Esperando repuesto", short: "Repuesto", client: "Estamos consiguiendo el repuesto" },
  { key: "en_reparacion", label: "En reparación", short: "Reparación", client: "Tu equipo está en reparación" },
  { key: "control_calidad", label: "Control de calidad", short: "Calidad", client: "Estamos probando la reparación" },
  { key: "listo", label: "Listo para entrega", short: "Listo", client: "¡Tu equipo está listo para recoger!" },
  { key: "entregado", label: "Entregado", short: "Entregado", client: "Equipo entregado" },
] as const;

export type StatusKey = (typeof STATUSES)[number]["key"];
export const STATUS_KEYS = STATUSES.map((s) => s.key) as StatusKey[];
export function statusInfo(key: string) {
  return STATUSES.find((s) => s.key === key) ?? STATUSES[0];
}

// Pasos que ve el cliente en la barra de progreso.
export const CLIENT_STEPS: StatusKey[] = ["recibido", "diagnostico", "cotizado", "en_reparacion", "control_calidad", "listo", "entregado"];

export const PRIORITIES = [
  { key: "normal", label: "Normal" },
  { key: "alta", label: "Alta" },
  { key: "urgente", label: "Urgente" },
] as const;

export const DIAGNOSTIC_PLANS = [
  {
    key: "normal",
    label: "Normal",
    title: "Diagnóstico Normal",
    time: "3 a 5 días",
    badge: "⏱️ Normal (3-5 días)",
    description: "Revisión estándar según orden de llegada en laboratorio.",
    days: 4,
  },
  {
    key: "alta",
    label: "Express",
    title: "Diagnóstico Express",
    time: "De un día para otro",
    badge: "⚡ Express (24h)",
    description: "Prioridad alta con entrega de dictamen de un día para otro.",
    days: 1,
  },
  {
    key: "urgente",
    label: "Premium VIP",
    title: "Diagnóstico Premium VIP",
    time: "Frente al cliente / Inmediato",
    badge: "👑 Premium VIP",
    description: "Servicio VIP con herramientas especializadas a la vista del cliente en la brevedad de lo posible.",
    days: 0,
  },
] as const;

export type DiagnosticPlanKey = (typeof DIAGNOSTIC_PLANS)[number]["key"];

export function diagnosticPlanInfo(key: string) {
  return DIAGNOSTIC_PLANS.find((p) => p.key === key) ?? DIAGNOSTIC_PLANS[0];
}

type Service = { key: string; label: string; warning?: string };
type Check = { key: string; label: string };
export type DeviceType = {
  key: string;
  label: string;
  icon: string;
  brands: string[];
  models: string[];
  services: Service[];
  checklist: Check[];
  accessoriesHint: string;
  passcodeLabel: string;
};

const W = {
  mojado: "Pronóstico reservado: pueden aparecer fallas después. Garantía limitada a la pieza cambiada. Prioridad: no encender ni cargar.",
  no_enciende: "No se pudieron probar las funciones. El diagnóstico toma más tiempo y puede ser falla de placa.",
  software: "El cliente es responsable de su copia de seguridad; restaurar o formatear borra la información.",
  pantallaCel: "Hay calidades y precios distintos (original, OLED, incell). En modelos recientes puede aparecer el aviso de pieza desconocida. Un marco doblado puede impedir el ajuste.",
  bateriaCel: "Una batería inflada no se carga ni se presiona. Puede aparecer el aviso de batería no genuina.",
  carga: "Puede ser solo suciedad (limpieza) o el puerto. Si la falla es de placa, se recotiza.",
};

export const DEVICE_TYPES: DeviceType[] = [
  {
    key: "celular",
    label: "Celular",
    icon: "📱",
    brands: ["Apple", "Samsung", "Xiaomi", "Motorola", "Huawei", "Oppo", "Honor", "Google"],
    models: [
      "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone Air", "iPhone 17", "iPhone 16e",
      "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
      "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
      "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
      "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 mini",
      "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 12 mini",
      "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11", "iPhone SE (3.ª gen.)", "iPhone SE (2.ª gen.)",
      "iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone X",
      "Samsung Galaxy S25 Ultra", "Samsung Galaxy S25", "Samsung Galaxy S24 Ultra", "Samsung Galaxy S24", "Samsung Galaxy A56", "Samsung Galaxy A55", "Samsung Galaxy A35",
      "Xiaomi Redmi Note 14", "Xiaomi Redmi Note 13", "Motorola Moto G85",
    ],
    services: [
      { key: "pantalla", label: "Pantalla", warning: W.pantallaCel },
      { key: "bateria", label: "Batería", warning: W.bateriaCel },
      { key: "carga", label: "Problema de carga", warning: W.carga },
      { key: "no_enciende", label: "No enciende", warning: W.no_enciende },
      { key: "mojado", label: "Equipo mojado", warning: W.mojado },
      { key: "carcasa", label: "Carcasa / tapa trasera", warning: "El tono de color puede variar levemente frente al original." },
      { key: "camara", label: "Cámara" },
      { key: "faceid", label: "Face ID / Touch ID", warning: "Face ID solo se recupera en algunos casos; puede quedar sin funcionar." },
      { key: "software", label: "Software / restauración", warning: W.software },
      { key: "otro", label: "Otro" },
    ],
    checklist: [
      { key: "pantalla", label: "Táctil y pantalla" },
      { key: "faceid", label: "Face ID / Touch ID" },
      { key: "truetone", label: "True Tone y brillo" },
      { key: "camaras", label: "Cámaras y flash" },
      { key: "audio", label: "Auricular, altavoz y micrófonos" },
      { key: "carga", label: "Carga con cable e inalámbrica" },
      { key: "bateria", label: "Batería (salud %)" },
      { key: "senal", label: "SIM, señal, Wi‑Fi y Bluetooth" },
      { key: "botones", label: "Botones y vibración" },
      { key: "proximidad", label: "Sensor de proximidad" },
    ],
    accessoriesHint: "Ninguno, estuche, cargador, caja…",
    passcodeLabel: "Código o patrón de desbloqueo (opcional)",
  },
  {
    key: "tablet",
    label: "Tablet",
    icon: "📲",
    brands: ["Apple", "Samsung", "Lenovo", "Xiaomi", "Huawei"],
    models: ["iPad Pro 13\"", "iPad Pro 11\"", "iPad Air 13\"", "iPad Air 11\"", "iPad (11.ª gen.)", "iPad (10.ª gen.)", "iPad (9.ª gen.)", "iPad mini (A17 Pro)", "iPad mini 6", "Samsung Galaxy Tab S10", "Samsung Galaxy Tab S9", "Samsung Galaxy Tab A9", "Lenovo Tab M11", "Xiaomi Pad 7"],
    services: [
      { key: "pantalla", label: "Pantalla / táctil", warning: "En muchos iPad el vidrio y la pantalla son una sola pieza. Riesgo de rotura al desarmar por el adhesivo." },
      { key: "bateria", label: "Batería", warning: "Una batería inflada no se carga ni se presiona." },
      { key: "carga", label: "Problema de carga", warning: W.carga },
      { key: "no_enciende", label: "No enciende", warning: W.no_enciende },
      { key: "mojado", label: "Equipo mojado", warning: W.mojado },
      { key: "software", label: "Software / restauración", warning: W.software },
      { key: "otro", label: "Otro" },
    ],
    checklist: [
      { key: "pantalla", label: "Táctil y pantalla" },
      { key: "faceid", label: "Face ID / Touch ID" },
      { key: "camaras", label: "Cámaras" },
      { key: "audio", label: "Altavoces y micrófonos" },
      { key: "carga", label: "Carga" },
      { key: "bateria", label: "Batería" },
      { key: "wifi", label: "Wi‑Fi y Bluetooth" },
      { key: "botones", label: "Botones" },
      { key: "lapiz", label: "Lápiz / teclado (si aplica)" },
    ],
    accessoriesHint: "Ninguno, estuche, cargador, lápiz…",
    passcodeLabel: "Código de desbloqueo (opcional)",
  },
  {
    key: "computador",
    label: "Computador",
    icon: "💻",
    brands: ["Apple", "HP", "Lenovo", "Dell", "Asus", "Acer", "MSI", "Samsung", "Huawei"],
    models: ["MacBook Air 13\" (M4)", "MacBook Air 15\" (M4)", "MacBook Air (M3)", "MacBook Air (M2)", "MacBook Air (M1)", "MacBook Pro 14\"", "MacBook Pro 16\"", "MacBook Pro 13\"", "iMac 24\"", "Mac mini", "HP Pavilion", "HP Victus", "Lenovo IdeaPad", "Lenovo ThinkPad", "Lenovo Legion", "Dell Inspiron", "Dell Latitude", "Asus Vivobook", "Asus TUF Gaming", "Acer Aspire", "Acer Nitro", "Computador de escritorio"],
    services: [
      { key: "pantalla", label: "Pantalla" },
      { key: "teclado", label: "Teclado / trackpad" },
      { key: "bateria", label: "Batería", warning: "Una batería inflada puede deformar la carcasa; no cargar." },
      { key: "carga", label: "No carga / pin de carga" },
      { key: "no_enciende", label: "No enciende", warning: W.no_enciende },
      { key: "mojado", label: "Derrame de líquido", warning: W.mojado },
      { key: "mantenimiento", label: "Lento / mantenimiento", warning: "Incluye limpieza interna y cambio de pasta térmica. No garantiza mejorar la velocidad si el disco o la RAM son insuficientes." },
      { key: "almacenamiento", label: "Disco / SSD / RAM" },
      { key: "software", label: "Formateo / sistema operativo", warning: W.software + " Las licencias de programas son responsabilidad del cliente." },
      { key: "bisagras", label: "Bisagras / carcasa" },
      { key: "otro", label: "Otro" },
    ],
    checklist: [
      { key: "arranque", label: "Enciende y arranca el sistema" },
      { key: "pantalla", label: "Pantalla (líneas, manchas, brillo)" },
      { key: "teclado", label: "Teclado" },
      { key: "trackpad", label: "Trackpad / mouse" },
      { key: "puertos", label: "Puertos USB / HDMI" },
      { key: "audio", label: "Audio y micrófono" },
      { key: "wifi", label: "Wi‑Fi y Bluetooth" },
      { key: "camara", label: "Cámara web" },
      { key: "bateria", label: "Batería y carga" },
      { key: "bisagras", label: "Bisagras y carcasa" },
    ],
    accessoriesHint: "Cargador, maletín, mouse…",
    passcodeLabel: "Contraseña de inicio de sesión (opcional)",
  },
  {
    key: "consola",
    label: "Consola",
    icon: "🎮",
    brands: ["Sony", "Microsoft", "Nintendo", "Valve"],
    models: ["PlayStation 5 Pro", "PlayStation 5 Slim", "PlayStation 5", "PlayStation 4 Pro", "PlayStation 4 Slim", "PlayStation 4", "Xbox Series X", "Xbox Series S", "Xbox One X", "Xbox One S", "Nintendo Switch 2", "Nintendo Switch OLED", "Nintendo Switch", "Nintendo Switch Lite", "Steam Deck", "Control DualSense", "Control DualShock 4", "Control Xbox", "Joy-Con"],
    services: [
      { key: "hdmi", label: "Puerto HDMI", warning: "Si el daño llegó al chip de video, la reparación cambia de valor; se recotiza." },
      { key: "no_video", label: "No da video" },
      { key: "temperatura", label: "Se calienta / ruido / mantenimiento", warning: "Incluye limpieza y pasta o metal líquido según el modelo." },
      { key: "lector", label: "Lector de discos" },
      { key: "drift", label: "Control / drift de palancas" },
      { key: "no_enciende", label: "No enciende", warning: W.no_enciende },
      { key: "carga", label: "No carga (portátiles y controles)" },
      { key: "pantalla", label: "Pantalla (Switch / Steam Deck)" },
      { key: "software", label: "Software / almacenamiento", warning: W.software },
      { key: "otro", label: "Otro" },
    ],
    checklist: [
      { key: "enciende", label: "Enciende" },
      { key: "video", label: "Video por HDMI / pantalla" },
      { key: "controles", label: "Controles y sincronización" },
      { key: "lector", label: "Lector de discos" },
      { key: "ventilacion", label: "Ventilación y ruido" },
      { key: "red", label: "Wi‑Fi / red" },
      { key: "puertos", label: "Puertos USB" },
      { key: "almacenamiento", label: "Almacenamiento" },
    ],
    accessoriesHint: "Controles, cable HDMI, cable de poder, base…",
    passcodeLabel: "Usuario / PIN de la consola (opcional)",
  },
  {
    key: "reloj",
    label: "Reloj",
    icon: "⌚",
    brands: ["Apple", "Samsung", "Garmin", "Huawei"],
    models: ["Apple Watch Ultra 3", "Apple Watch Ultra 2", "Apple Watch Series 11", "Apple Watch Series 10", "Apple Watch Series 9", "Apple Watch SE", "Samsung Galaxy Watch 8", "Samsung Galaxy Watch 7"],
    services: [
      { key: "pantalla", label: "Pantalla" },
      { key: "bateria", label: "Batería" },
      { key: "no_enciende", label: "No enciende", warning: W.no_enciende },
      { key: "otro", label: "Otro" },
    ],
    checklist: [
      { key: "pantalla", label: "Pantalla táctil" },
      { key: "carga", label: "Carga" },
      { key: "sensores", label: "Sensores (pulso)" },
      { key: "botones", label: "Botones y corona" },
      { key: "conexion", label: "Conexión con el celular" },
    ],
    accessoriesHint: "Cargador, correa…",
    passcodeLabel: "Código (opcional)",
  },
  {
    key: "otro",
    label: "Otro",
    icon: "🔧",
    brands: ["Apple", "Samsung", "Sony", "JBL", "Bose", "DJI"],
    models: ["AirPods Pro", "AirPods", "Parlante", "Audífonos", "Drone", "Cámara"],
    services: [
      { key: "no_enciende", label: "No enciende", warning: W.no_enciende },
      { key: "bateria", label: "Batería" },
      { key: "carga", label: "Carga" },
      { key: "mojado", label: "Mojado", warning: W.mojado },
      { key: "otro", label: "Otro" },
    ],
    checklist: [
      { key: "enciende", label: "Enciende" },
      { key: "funciona", label: "Funciona según lo esperado" },
      { key: "carga", label: "Carga" },
    ],
    accessoriesHint: "Estuche, cargador…",
    passcodeLabel: "Código (opcional)",
  },
];

export function deviceType(key: string | null | undefined): DeviceType {
  return DEVICE_TYPES.find((d) => d.key === key) ?? DEVICE_TYPES[0];
}

export function serviceLabel(typeKey: string, serviceKey: string): string {
  return deviceType(typeKey).services.find((s) => s.key === serviceKey)?.label ?? serviceKey;
}

export type CheckValue = "ok" | "falla" | "np";
export const CHECK_LABELS: Record<CheckValue, string> = { ok: "OK", falla: "Falla", np: "No se pudo probar" };

export const MEDIA_CATEGORIES = [
  { key: "ingreso", label: "Así llegó (ingreso)" },
  { key: "diagnostico", label: "Diagnóstico / equipo destapado" },
  { key: "reparacion", label: "Reparación" },
  { key: "entrega", label: "Entrega" },
] as const;

export const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta", "Nequi", "Daviplata", "Wompi", "Saldo a favor", "Otro"];

export const PRODUCT_KINDS = [
  { key: "repuesto", label: "Repuesto" },
  { key: "accesorio", label: "Accesorio" },
  { key: "equipo", label: "Equipo (nuevo o usado)" },
  { key: "servicio", label: "Servicio" },
] as const;

export const GRADES = [
  { key: "A", label: "A · Como nuevo" },
  { key: "B", label: "B · Detalles leves" },
  { key: "C", label: "C · Uso evidente" },
  { key: "DOA", label: "DOA · No funciona (para piezas)" },
] as const;

export const BUYBACK_CHECKS = [
  { key: "imei", label: "IMEI no reportado (consultado)" },
  { key: "cuenta", label: "Sin cuenta iCloud / Google vinculada" },
  { key: "enciende", label: "Enciende y funciona" },
  { key: "pantalla", label: "Pantalla sin daños" },
  { key: "carcasa", label: "Carcasa sin golpes" },
  { key: "bateria", label: "Batería en buen estado" },
  { key: "camaras", label: "Cámaras funcionan" },
  { key: "piezas", label: "Sin piezas cambiadas" },
];

export const EXPENSE_CATEGORIES = ["Arriendo", "Servicios públicos", "Nómina", "Repuestos (sin inventario)", "Publicidad", "Transporte", "Impuestos", "Otro"];

export const DEFAULT_TERMS = `1. El diagnóstico tiene un costo que se descuenta del valor de la reparación si el cliente la aprueba.
2. Ninguna reparación se hace sin aprobación del cliente, por escrito, por WhatsApp o desde la página de seguimiento.
3. En equipos mojados, golpeados o que ingresan apagados pueden aparecer fallas que no se podían ver al recibirlos. Su recuperación no está garantizada.
4. El cliente es responsable de la copia de seguridad de su información.
5. Los repuestos no originales o cambiados pueden mostrar en el equipo un aviso de "pieza desconocida".
6. La reparación tiene garantía sobre la pieza cambiada y la mano de obra (mínimo 3 meses, Ley 1480 de 2011). No cubre golpes, humedad ni equipos abiertos por terceros.
7. El equipo se entrega solo a quien presente la orden y su cédula, o a un tercero con autorización escrita y copia de la cédula del titular.
8. Si el equipo no se retira, se aplica el artículo 18 de la Ley 1480: aviso escrito al mes de la fecha de entrega, dos meses para retirarlo y cobro de almacenamiento.
9. Autorizo el tratamiento de mis datos personales para la gestión de este servicio (Ley 1581 de 2012).`;
