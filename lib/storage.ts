import path from "node:path";
import { dbx, UPLOAD_DIR, type Exec } from "./db";
import { newMediaId } from "./orders";

/**
 * Archivos (fotos, videos, firmas):
 * - En Vercel: Vercel Blob privado (BLOB_READ_WRITE_TOKEN). En la base se guarda "blob:<url>".
 * - En tu computador: la carpeta DATA_DIR/uploads.
 */
export function storageMode(): "blob" | "disk" {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || process.env.VERCEL ? "blob" : "disk";
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export function extFor(mime: string, filename?: string): string {
  if (EXT[mime]) return EXT[mime];
  const fromName = filename?.split(".").pop()?.toLowerCase();
  return fromName && /^[a-z0-9]{2,5}$/.test(fromName) ? fromName : "bin";
}

export function mediaPath(filename: string): string {
  // filename es generado por el servidor (id + extensión); se valida igual para evitar rutas raras.
  if (!/^[a-z0-9]+\.[a-z0-9]+$/.test(filename)) throw new Error("Nombre de archivo inválido");
  return path.join(UPLOAD_DIR, filename);
}

export function isBlob(filename: string) {
  return filename.startsWith("blob:");
}

async function writeFile(name: string, buf: Buffer, mime: string): Promise<string> {
  if (storageMode() === "blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(`firmas/${name}`, buf, { access: "private", contentType: mime, addRandomSuffix: true });
    return `blob:${blob.url}`;
  }
  const fs = await import("node:fs");
  fs.writeFileSync(mediaPath(name), buf);
  return name;
}

export async function saveSignature(dataUrl: string, orderId: number | null, userId: number | null, ex: Exec = dbx): Promise<string | null> {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl || "");
  if (!m) return null;
  const id = newMediaId();
  const buf = Buffer.from(m[1], "base64");
  const filename = await writeFile(`${id}.png`, buf, "image/png");
  await ex.run(
    "INSERT INTO media (id, order_id, kind, category, filename, mime, size, public, user_id) VALUES (?, ?, 'signature', 'firma', ?, 'image/png', ?, 0, ?)",
    id, orderId, filename, buf.length, userId,
  );
  return id;
}

export async function deleteMediaFile(filename: string) {
  try {
    if (isBlob(filename)) {
      const { del } = await import("@vercel/blob");
      await del(filename.slice(5));
    } else {
      const fs = await import("node:fs");
      fs.unlinkSync(mediaPath(filename));
    }
  } catch {
    /* ya no existe */
  }
}
