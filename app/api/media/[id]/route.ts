import fs from "node:fs";
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
  try {
    path = mediaPath(media.filename);
    stat = fs.statSync(path);
  } catch {
    return new Response("Archivo no encontrado", { status: 404 });
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": media.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
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
  };
  const len = h.get("content-length");
  if (len) headers["Content-Length"] = len;
  const cr = h.get("content-range");
  if (cr) headers["Content-Range"] = cr;
  if (req.nextUrl.searchParams.get("download")) headers["Content-Disposition"] = `attachment; filename="${media.id}"`;
  return new Response(result.stream, { status: cr ? 206 : 200, headers });
}
