#!/usr/bin/env bash
# Respaldo de la app en el VPS: copia consistente de la base de datos + fotos/videos/firmas.
# Uso (desde la carpeta del proyecto):   bash scripts/respaldo.sh
# Automático cada noche a las 2:30 a. m. (crontab -e):
#   30 2 * * * cd /opt/taller-app && bash scripts/respaldo.sh >> data/backups/respaldo.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
DEST="data/backups"
mkdir -p "$DEST"

# 1) Copia en caliente de SQLite (VACUUM INTO): segura aunque la app esté en uso.
docker compose exec -T app node -e '
const { createClient } = require("@libsql/client");
const out = "/data/backups/taller-" + process.argv[1] + ".db";
const c = createClient({ url: "file:/data/taller.db" });
c.execute({ sql: "VACUUM INTO ?", args: [out] }).then(() => { console.log("Base de datos:", out); }).catch((e) => { console.error(e); process.exit(1); });
' "$STAMP"

# 2) Fotos, videos y firmas (sin las miniaturas, que se regeneran solas).
tar -czf "$DEST/uploads-$STAMP.tar.gz" --exclude='.thumbs' -C data uploads
echo "Archivos: $DEST/uploads-$STAMP.tar.gz"

# 3) Borra respaldos de más de KEEP_DAYS días.
find "$DEST" -maxdepth 1 -type f \( -name 'taller-*.db' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

echo "Respaldo terminado: $STAMP"
echo "IMPORTANTE: copia la carpeta $DEST fuera del servidor (otro disco, nube) de vez en cuando."
