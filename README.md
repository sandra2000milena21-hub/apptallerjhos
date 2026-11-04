# Taller · Versión 5.0 (IA Pro, Entrega Inteligente & Ultra Rendimiento)

Sistema web para un local de reparación y venta de tecnología: celulares, tablets, computadores, consolas y relojes. Está pensado para usarse en un **iPad en el mostrador**, y el cliente sigue su reparación desde su celular.

Toma como base **SpotsPOS** (Repair Spots), con lo mejor de **RepairDesk** y otras plataformas, adaptado a Colombia (Ley 1480 de 2011, Ley 1581 de 2012, WhatsApp, Wompi, pesos).

## Novedades de la Versión 5.0

- 🤖 **Asistente Personal IA de Máxima Fidelidad (Radar del Taller Pro)**:
  - **Motor de voz neural**: Detección automática y selección prioritaria de voces naturales colombianas y latinoamericanas de alta fidelidad (Microsoft Salome, Microsoft Jorge, Google Español, Apple Mónica/Paulina/Siri).
  - **3 Personalidades de voz**: *Jhos (Técnico Pro)* con tono masculino pausado y seguro, *Sofia (Coordinadora)* con voz ejecutiva clara, y *Jarvis IA* con alta velocidad y dinamismo.
  - **Limpieza fonética humana**: Normaliza códigos de orden (*"orden número dos"*), monedas en pesos colombianos (*"ciento cincuenta mil pesos"*) y siglas técnicas (*"V I P"*).
  - **Chaining secuencial sin cortes**: Elimina el corte de 15 segundos nativo de Safari/iPadOS al encadenar frases de forma fluida con respiración natural (120ms).
  - **Ecualizador dinámico de 9 barras**: Espectro animado con halo neón cian/índigo que late al compás de la voz y subtítulos dinámicos en tiempo real.
  - **Audio Engine por Web Audio API**: Acorde de inicio en Do Mayor 7 (C5-E5-G5-B5), chime de alerta doble tono y retroalimentación háptica sonora (100% nativo, cero latencia).
  - **3 Modos de Briefing**: *30s Express* (directo a lo urgente), *Cobros y Entregas* (foco 100% comercial y dinero por recaudar), y *Completo* (saludo horario, ingresos, balance general y motivación).
  - **Panel "Consultar a la IA"**: Botones de un toque para preguntarle al radar por dinero en espera, riesgo de corrosión en mojados, órdenes VIP y salud general del taller.
- 📦 **Ventana de Proceso de Entrega y Cobro Unificado (`DeliveryModal`)**:
  - Saldo restante en tiempo real y selector de método de pago: **💵 Efectivo**, **📲 Transferencia (Nequi / Bancolombia / Daviplata)** o **💳 Tarjeta**.
  - Permite cobrar el saldo exacto o abono parcial, acreditando de inmediato los puntos al cliente.
  - Campo para **nota final de reparación y garantía** con selector de visibilidad para el cliente.
  - Nombre de quien retira y **firma digital en pantalla** (dedo o Apple Pencil).
  - Emisión instantánea de recibo de caja y botón directo para **imprimir ticket térmico de 80 mm**.
  - Integrado en el tablero (botón directo en tarjeta y botón expandido) y dentro del propio radar del asistente.
- ⚡ **Optimización Integral de Base de Datos y Caché**:
  - **PRAGMAs SQLite Enterprise**: `journal_mode = WAL`, `synchronous = NORMAL`, `cache_size = -64000` (64 MB de caché en RAM), `temp_store = MEMORY` y `mmap_size = 256 MB` de I/O mapeado en memoria.
  - **Índices de alto rendimiento**: Índices dedicados para `customers(points)`, `orders(status)`, `orders(priority)`, `orders(due_date)`, `sales(points_earned, points_redeemed)` y `sales(user_id)`.
  - **Turbo-Cache HTTP**: Compresión Brotli/Gzip activada, cabeceras `immutable` de 1 año para assets estáticos y caché optimizada para imágenes/archivos adjuntos.
- ⭐ **Club de Puntos y Fidelización (v4.0 integrado)**:
  - 1 punto por cada \$1.000 COP pagados en reparaciones y ventas.
  - Redención directa en caja con 1 toque (\$20 COP por punto).
  - Desglose en ticket térmico de 80 mm y portal del cliente.

- ⭐ **Sistema de Fidelización y Club de Puntos**: 
  - Acumulación automática: **1 punto por cada \$1.000 COP** pagados en reparaciones y productos.
  - Redención en Caja (POS): Con un solo toque el cajero puede redimir los puntos del cliente (**1 punto = \$20 COP**, 2% de cashback directo).
  - Bloque de fidelización en el **ticket térmico de 80 mm** (`/panel/ventas/[id]`): muestra puntos ganados hoy, puntos redimidos, saldo total disponible y ahorro equivalente.
  - Saldo de puntos visible en la ficha de clientes (`/panel/clientes/[id]`) y en el portal de seguimiento del cliente (`/s/[token]`).
- 🟢 **Botón llamativo "Entregado" en mostrador**:
  - Cuadrícula 4x2 perfecta en la lámina expandida del tablero con el botón **`✅ Entregado`** en verde esmeralda brillante junto a "Listo".
  - Confirmación táctil rápida para evitar toques accidentales en el iPad y registro automático de fecha y hora de entrega.
- 🚀 **Hiper-fluidez y Aceleración por GPU para iPad**:
  - Desacoplamiento de fondos con `transform: translate3d(0, 0, 0)` para scrolling nativo a 60/120 FPS sin repintados de Safari.
  - Eliminación del retraso táctil de 300 ms en iPadOS con `touch-action: manipulation`.
  - Arranque optimizado en producción con respuestas en red local < 30 ms.

## Novedades de la Versión 3.0

- 🛡️ **Seguridad y Control de Roles (RBAC)**: Validación estricta a nivel de Server Actions en todas las mutaciones críticas (anulación de ventas y retomas, archivo de inventario y registro de gastos). Bloqueo de cargas SVG para evitar XSS almacenado.
- ⚡ **Máxima Fluidez en Mostrador**: 12 índices de alto rendimiento en SQLite para consultas instantáneas en el tablero diario, reportes y búsquedas. Atajo rápido `F2` para enfocar el buscador de caja y auto-enfoque tras cada escaneo.
- 💵 **Caja de Alta Velocidad**: Billetes de denominación colombiana con un toque (`Exacto`, `+$10k`, `+$20k`, `+$50k`, `+$100k`), compatibilidad ampliada con lectores de códigos de barras físicos e integración directa de cobro de órdenes `R-XXXX`.
- 📦 **Control de Stock Inteligente**: Cuando una cotización es rechazada (por el cliente en línea o en el taller), los repuestos reservados se reintegran automáticamente al inventario sin desajustes manuales.
- 🖨️ **Impresión Térmica y Etiquetas Optimizadas**: Contraste perfecto para tickets de 80mm, hojas de servicio, comprobantes de retoma y etiquetas de código de barras.
- 👥 **Deduplicación de Clientes**: Búsqueda y vinculación automática por celular para evitar registros duplicados en caja y recepción.

## Módulos

| Módulo | Qué hace |
| --- | --- |
| **Recepción** | 5 pasos en el iPad: cliente → equipo y falla → pruebas de ingreso → fotos y video con la cámara → valores y firma. La **recepción rápida** llena la orden desde una frase ("PS5 no da video, el HDMI está suelto"), con IA o con reglas. Tipos de equipo: celular, tablet, computador, consola, reloj y otro, cada uno con sus servicios, advertencias y checklist. |
| **Historial clínico** | Cada equipo queda registrado por IMEI o serial. Al recibirlo de nuevo, la app muestra sus reparaciones anteriores. |
| **Tablero** | Tarjetas por estado que se **arrastran** de columna. Prioridad (normal, alta, urgente), alertas de equipos mojados, cotizaciones respondidas, equipos sin recoger y vencidos. Indicadores del día. |
| **Orden** | Fotos y videos por etapa (ingreso, destapado, reparación, entrega), visibles u ocultos para el cliente. Notas, historial, técnico asignado, cotización desde catálogo o inventario (el repuesto **sale del stock** al agregarlo), pagos, control de calidad comparado con el ingreso, entrega con firma, etiqueta con código de barras y orden imprimible con QR. |
| **Página del cliente** | Enlace único por orden o búsqueda con número de orden + últimos 4 dígitos del celular. Muestra el progreso, las fotos y videos, las novedades y la cotización con botón **Aprobar**. |
| **Caja (POS)** | Venta de accesorios y equipos por búsqueda o código de barras, cobro del saldo de órdenes, ítems libres, descuento, **pago dividido**, saldo a favor y cambio. Recibo de 80 mm y anulación. |
| **Inventario** | Productos y repuestos con costo promedio, precio, stock mínimo, proveedor, IMEI y grado. Movimientos, ajustes por conteo, **entradas de compra** con escáner, etiquetas de producto y **catálogo de reparaciones** ligado a repuestos. |
| **Retomas** | Compra de equipos usados con checklist, grado sugerido (A, B, C, DOA), pago en efectivo, transferencia o **saldo a favor**, firma y declaración de procedencia lícita. El equipo entra al inventario con su costo. |
| **Clientes** | Historial de órdenes, equipos, compras y retomas. Saldo a favor y notas. |
| **Citas** | El cliente agenda en `/agendar`. El local confirma por WhatsApp y, cuando llega el cliente, crea la orden con los datos ya llenos. |
| **Reportes** | Cierre de caja por medio de pago, rentabilidad (ventas, costo, reparaciones, repuestos, gastos), resultados por empleado y registro de gastos. |
| **Integraciones** | Avisos automáticos por **WhatsApp Business (API de Meta)**, **SMS (Twilio)** y **correo**; **links de pago Wompi** con registro automático del pago; IA (Claude); enlace de reseñas de Google. |
| **Usuarios** | Administrador, asesor y técnico. |

## Cómo está construida

- Next.js 15 + React 19 + Tailwind CSS 4.
- Base de datos SQLite con **libSQL**. En Vercel usa **Turso**; en tu computador, un archivo local.
- Fotos, videos y firmas en **Vercel Blob privado**. Se suben directo desde el iPad, así que no les aplica el límite de 4,5 MB de Vercel. En tu computador se guardan en una carpeta.

## Subirla a Vercel (primera versión)

> Vercel solo permite el plan gratis (Hobby) para uso personal no comercial. Para un negocio corresponde el plan **Pro** (US$20 al mes).

1. **Sube el código a GitHub.** En la carpeta del proyecto:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```
2. **Importa el proyecto en Vercel.** Ve a vercel.com → *Add New → Project*, elige el repositorio y no cambies la configuración (Vercel detecta Next.js). Todavía no despliegues.
3. **Crea la base de datos.** En el proyecto, abre *Storage → Marketplace → Turso Cloud*, crea una base y conéctala al proyecto. Elige la región más cercana a la de las funciones de Vercel (por defecto, Washington D.C., `iad1`). Vercel agrega solas las variables `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
4. **Crea el almacenamiento de fotos.** En *Storage → Create → Blob*, elige acceso **Private** (no se puede cambiar después) y conéctalo al proyecto. Revisa en *Settings → Environment Variables* que exista `BLOB_READ_WRITE_TOKEN`; si no está, cópiala de la configuración del Blob store.
5. **Agrega las variables** en *Settings → Environment Variables*:
   - `SESSION_SECRET`: una clave aleatoria de 32 caracteres o más.
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME`: el primer usuario.
   - `PUBLIC_URL`: la dirección final, por ejemplo `https://taller-xxxx.vercel.app` o tu dominio.
6. **Despliega** (*Deploy*). Al abrir la app por primera vez se crean las tablas y el usuario administrador.
7. **Configura el local.** Entra con el administrador y, en *Ajustes*, pon el nombre, el WhatsApp, el valor del diagnóstico, la garantía y las condiciones. Crea los usuarios de tu equipo.
8. **Dominio propio (opcional).** En *Settings → Domains* agrega, por ejemplo, `taller.tudominio.co` y actualiza `PUBLIC_URL`.

### Integraciones (cuando las necesites)

Todas se configuran en **Ajustes → Integraciones**, y cada una tiene un botón de prueba.

- **WhatsApp Business:** cuenta de WhatsApp Business Platform en Meta, *phone number ID*, token permanente y una plantilla aprobada con 5 variables (nombre, equipo, orden, estado y enlace).
- **Wompi:** la llave privada y el secreto de eventos. En el panel de Wompi, la URL de eventos es `https://TU-DOMINIO/api/webhooks/wompi`.
- **SMS:** Twilio (SID, token y número).
- **Correo:** SMTP. En Gmail se usa una contraseña de aplicación.
- **IA:** clave de Anthropic. Sin ella, la recepción rápida funciona con reglas.

## Probarla en tu computador

Necesitas Node.js 20 o superior.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abre http://localhost:3000. Sin Turso ni Blob, los datos quedan en la carpeta `data/`.

## Lista para la primera prueba en el local

1. Crear 3 o 4 repuestos y accesorios en **Inventario**, y 2 reparaciones en el **Catálogo**.
2. Imprimir la etiqueta de un producto y venderlo en **Caja** escaneándolo.
3. Recibir un iPhone completo desde el iPad: fotos, video y firma. Imprimir la orden y la etiqueta.
4. Enviar el enlace al cliente por WhatsApp y abrirlo desde un celular.
5. Pasar la orden a diagnóstico, subir una foto del equipo destapado y cotizar desde el catálogo.
6. Aprobar desde el celular del cliente, arrastrar la tarjeta en el tablero hasta "Listo", cobrar en caja y entregar con firma.
7. Registrar una retoma con saldo a favor y usarlo en una venta.
8. Agendar una cita desde `/agendar` y recibirla.
9. Revisar el cierre de caja en **Reportes**.

## Consejos para el iPad

- Agrégala a la pantalla de inicio desde Safari (Compartir → Agregar a inicio).
- Configura la cámara en **1080p a 30 cps** (Ajustes → Cámara → Grabar video) y graba videos de 15 a 30 segundos.
- El botón de escanear usa la cámara para leer códigos de barras: IMEI de la caja, etiquetas de orden y de producto. Un lector USB o Bluetooth también funciona en los campos de búsqueda.
- Para escribir la falla, dicta con el micrófono del teclado.

## Otras formas de alojarla

Sin Turso ni Blob, la app también funciona en un servidor propio con disco persistente. El `Dockerfile` y `docker-compose.yml` (con HTTPS por Caddy) sirven para un VPS o para Railway.

## Pendiente para una segunda fase

- Varias sucursales con inventario separado.
- Factura electrónica DIAN (con Alegra, Siigo u otro proveedor autorizado).
- Órdenes de compra a proveedores con recepción parcial.
- Comisiones y control de horario de empleados.
