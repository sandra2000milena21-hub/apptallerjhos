import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { addEvent, newMediaId } from "@/lib/orders";
import { extFor, mediaPath, storageMode } from "@/lib/storage";
import { MEDIA_CATEGORIES } from "@/lib/constants";

export const runtime = "nodejs";

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB por archivo

// Le dice al navegador cómo subir: directo a Vercel Blob ("blob") o a este servidor ("disk").
export async function GET() {
  return NextResponse.json({ mode: storageMode() });
}

// Modo disco (tu computador o un servidor propio). Recibe el archivo como cuerpo crudo (no multipart) para poder transmitir videos grandes sin cargarlos en memoria.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (storageMode() === "blob") return NextResponse.json({ error: "Usa la subida directa a Vercel Blob" }, { status: 400 });

  const mime = (req.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
  if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
    return NextResponse.json({ error: "Solo se aceptan fotos y videos" }, { status: 400 });
  }
  const declared = parseInt(req.headers.get("content-length") || "0", 10);
  if (declared > MAX_BYTES) return NextResponse.json({ error: "Archivo demasiado grande" }, { status: 413 });

  const name = decodeURIComponent(req.headers.get("x-filename") || "archivo");
  const categoryRaw = req.headers.get("x-category") || "ingreso";
  const category = MEDIA_CATEGORIES.some((c) => c.key === categoryRaw) ? categoryRaw : "ingreso";
  const orderIdRaw = req.headers.get("x-order-id");
  const orderId = orderIdRaw ? parseInt(orderIdRaw, 10) : null;
  const isPublic = req.headers.get("x-public") === "0" ? 0 : 1;

  if (orderId) {
    const exists = (await dbx.get("SELECT id FROM orders WHERE id = ?", orderId));
    if (!exists) return NextResponse.json({ error: "Orden no existe" }, { status: 404 });
  }
  if (!req.body) return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });

  const id = newMediaId();
  const filename = `${id}.${extFor(mime, name)}`;
  const dest = mediaPath(filename);
  let size = 0;
  try {
    const source = Readable.fromWeb(req.body as unknown as import("node:stream/web").ReadableStream);
    source.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) source.destroy(new Error("Archivo demasiado grande"));
    });
    await pipeline(source, fs.createWriteStream(dest));
  } catch (e) {
    try {
      fs.unlinkSync(dest);
    } catch {}
    return NextResponse.json({ error: (e as Error).message || "Error al subir" }, { status: 500 });
  }

  const kind = mime.startsWith("video/") ? "video" : "photo";
  (await dbx.run("INSERT INTO media (id, order_id, kind, category, filename, mime, size, public, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", id, orderId, kind, category, filename, mime, size, isPublic, user.id));

  if (orderId) {
    const label = MEDIA_CATEGORIES.find((c) => c.key === category)?.label ?? category;
    await addEvent({
      orderId,
      type: "media",
      body: `${kind === "video" ? "Video agregado" : "Foto agregada"}: ${label}`,
      isPublic: isPublic === 1,
      userId: user.id,
    });
  }

  return NextResponse.json({ id, kind, mime, size, category });
}
