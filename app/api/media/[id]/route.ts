import fs from "node:fs";
import nodePath from "node:path";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { isBlob, mediaPath } from "@/lib/storage";
import type { Media } from "@/lib/orders";

export const runtime = "nodejs";

// Sirve fotos y videos. El personal ve todo; el cliente solo lo marcado como visible y con el token de su orden.
// Soporta peticiones por rangos, que Safari en iPhone/iPad exige para reproducir video.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = (await dbx.get("SELECT * FROM media WHERE id = ?", id)) as Media | undefined;
  if (!media) return new Response("No encontrado", { status: 404 });

  const user = await currentUser();
  if (!user) {
    const token = req.nextUrl.searchParams.get("t");
    const order = media.order_id
      ? ((await dbx.get("SELECT token FROM orders WHERE id = ?", media.order_id)) as { token: string } | undefined)
      : undefined;
    if (!token || !order || order.token !== token || media.public !== 1) {
      return new Response("No autorizado", { status: 403 });
    }
  }

  if (isBlob(media.filename)) return serveBlob(req, media);

  let path: string;
  let stat: fs.Stats;
  let mime = media.mime;
  try {
    path = mediaPath(media.filename);
    // ?w=480 → miniatura liviana para las cuadrículas (la foto original solo se descarga al abrirla).
    const thumb = await thumbnailFor(media, path, req.nextUrl.searchParams.get("w"));
    if (thumb) {
      path = thumb;
      mime = "image/jpeg";
    }
    stat = fs.statSync(path);
  } catch {
    return new Response("Archivo no encontrado", { status: 404 });
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  if (req.nextUrl.searchParams.get("download")) {
    baseHeaders["Content-Disposition"] = `attachment; filename="${media.filename}"`;
  }

  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (m && !m[1] && m[2]) {
      start = Math.max(stat.size - parseInt(m[2], 10), 0);
      end = stat.size - 1;
    }
    if (start >= stat.size || end >= stat.size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    }
    const stream = fs.createReadStream(path, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = fs.createReadStream(path);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: { ...baseHeaders, "Content-Length": String(stat.size) },
  });
}

const THUMB_WIDTHS = [240, 480, 960];

/**
 * Genera (una sola vez) y guarda en data/uploads/.thumbs una versión reducida de la foto.
 * Si algo falla (formato no soportado, sharp no disponible) devuelve null y se sirve el original.
 */
async function thumbnailFor(media: Media, original: string, w: string | null): Promise<string | null> {
  if (!w || media.kind !== "photo" || !media.mime.startsWith("image/")) return null;
  const width = THUMB_WIDTHS.find((x) => x >= (parseInt(w, 10) || 0)) ?? THUMB_WIDTHS[THUMB_WIDTHS.length - 1];
  const dir = nodePath.join(nodePath.dirname(original), ".thumbs");
  const out = nodePath.join(dir, `${media.id}_${width}.jpg`);
  try {
    await fs.promises.access(out);
    return out;
  } catch {
    /* aún no existe: se crea abajo */
  }
  try {
    const sharp = (await import("sharp")).default;
    await fs.promises.mkdir(dir, { recursive: true });
    const tmp = `${out}.${process.pid}.${Date.now()}.tmp`;
    await sharp(original).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toFile(tmp);
    await fs.promises.rename(tmp, out);
    return out;
  } catch {
    return null;
  }
}

// Archivos en Vercel Blob privado: se leen con la clave del servidor y se reenvían, respetando los rangos para el video.
async function serveBlob(req: NextRequest, media: Media) {
  const { get } = await import("@vercel/blob");
  const range = req.headers.get("range");
  const result = await get(media.filename.slice(5), { access: "private", ...(range ? { headers: { range } } : {}) });
  if (!result || !result.stream) return new Response("Archivo no encontrado", { status: 404 });
  const h = result.headers;
  const headers: Record<string, string> = {
    "Content-Type": media.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  const len = h.get("content-length");
  if (len) headers["Content-Length"] = len;
  const cr = h.get("content-range");
  if (cr) headers["Content-Range"] = cr;
  if (req.nextUrl.searchParams.get("download")) headers["Content-Disposition"] = `attachment; filename="${media.id}"`;
  return new Response(result.stream, { status: cr ? 206 : 200, headers });
}
