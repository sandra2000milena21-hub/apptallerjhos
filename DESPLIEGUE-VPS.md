# Subir Taller Jhos a un servidor VPS

Guía paso a paso para dejar la app en internet con HTTPS, usando Docker y Caddy.
Sirve cualquier VPS con Ubuntu 22.04 o 24.04 (1 vCPU y 2 GB de RAM son suficientes; 40 GB de disco o más si se guardan muchos videos).

## Antes de empezar

- Un dominio o subdominio (ej. `taller.midominio.co`) con un registro **A** apuntando a la IP del VPS.
- Acceso SSH al servidor.

## 1. Preparar el servidor (una sola vez)

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Cortafuegos: solo SSH, HTTP y HTTPS
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443
ufw --force enable
```

El puerto 3000 de la app **no** se abre: solo Caddy lo alcanza dentro de Docker.

## 2. Traer el código

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/USUARIO/REPOSITORIO.git taller-app
cd taller-app
```

## 3. Crear el archivo `.env`

```bash
cp .env.example .env
nano .env
```

Valores que hay que cambiar:

| Variable | Qué poner |
| --- | --- |
| `SESSION_SECRET` | Una clave aleatoria. Genérala con `openssl rand -hex 32`. La app no arranca si se deja el texto de ejemplo. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Usuario administrador inicial. La clave debe tener 12 caracteres o más. Solo se usa si la base está vacía. |
| `PUBLIC_URL` | `https://taller.midominio.co` (con `https://`). |
| `DOMAIN` | `taller.midominio.co` (sin `https://`). Quita el `#` del inicio de la línea. |

Borra o deja comentadas las líneas de Turso y Vercel Blob: en el VPS se usa el disco del servidor.

```bash
chmod 600 .env
```

## 4. (Opcional) Traer los datos del computador del local

Si ya hay órdenes y clientes en el computador del taller, copia la carpeta `data` completa **con la app del local detenida** (`detener.bat`):

```bash
# Desde el computador del local (PowerShell o Git Bash)
scp -r data root@IP-DEL-VPS:/opt/taller-app/
```

Los usuarios y contraseñas actuales se conservan. Si no copias nada, la app arranca vacía y crea el administrador del `.env`.

## 5. Arrancar

```bash
docker compose up -d --build
docker compose ps        # "app" debe quedar en estado healthy
docker compose logs -f   # ver registros (Ctrl+C para salir)
```

En uno o dos minutos Caddy obtiene el certificado y la app queda en `https://taller.midominio.co`.

## 6. Después del primer ingreso

1. Entra con el administrador y revisa **Ajustes → Usuarios**: cambia cualquier contraseña corta (las nuevas exigen 8 caracteres o más).
2. Si usas Wompi, actualiza la URL de eventos en su panel: `https://taller.midominio.co/api/webhooks/wompi`.
3. Programa el respaldo automático (siguiente sección).

## Respaldos

```bash
bash scripts/respaldo.sh
```

Guarda en `data/backups/` una copia de la base de datos y de las fotos, y borra las de más de 14 días.
Para que corra todas las noches a las 2:30 a. m.:

```bash
crontab -e
# agrega esta línea:
30 2 * * * cd /opt/taller-app && bash scripts/respaldo.sh >> data/backups/respaldo.log 2>&1
```

Un respaldo que vive en el mismo servidor no protege si el servidor se pierde: baja la carpeta `data/backups` a otro lugar cada cierto tiempo (o activa los snapshots del proveedor del VPS).

**Restaurar:** detén la app (`docker compose down`), reemplaza `data/taller.db` por el archivo `taller-FECHA.db`, borra `data/taller.db-wal` y `data/taller.db-shm` si existen, descomprime `uploads-FECHA.tar.gz` dentro de `data/` y vuelve a arrancar.

## Actualizar a una versión nueva

```bash
cd /opt/taller-app
bash scripts/respaldo.sh
git pull
docker compose up -d --build
```

Los datos no se tocan: viven en la carpeta `data`, fuera de la imagen.

## Qué protege esta configuración

- HTTPS automático y renovado por Caddy; cabecera HSTS.
- Sesiones firmadas; al cambiar una contraseña, las sesiones abiertas con la anterior se cierran.
- Bloqueo de 15 minutos tras 8 intentos fallidos de ingreso por usuario (30 por IP).
- Cada acción del panel comprueba en el servidor el permiso del usuario (Ajustes → Usuarios).
- Las fotos del cliente solo se ven con sesión o con el enlace privado de su orden.
- La base de datos y las fotos nunca quedan dentro de la imagen de Docker ni en GitHub.

## Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| `app` se reinicia y el log dice `SESSION_SECRET no está configurada o es insegura` | Falta la clave o tiene menos de 32 caracteres en `.env`. |
| El log dice `ADMIN_PASSWORD no está configurada o es una clave de ejemplo` | Base vacía y clave del administrador débil. Pon una de 12+ caracteres. |
| `Define DOMAIN en el archivo .env` | Falta la línea `DOMAIN=` (o sigue comentada con `#`). |
| El navegador avisa que el certificado no es válido | El dominio aún no apunta a la IP del VPS, o los puertos 80/443 están cerrados. Revisa con `docker compose logs caddy`. |
| No deja iniciar sesión tras varios intentos | Es el bloqueo por intentos. Se levanta solo a los 15 minutos (o con `docker compose restart app`). |
