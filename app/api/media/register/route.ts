import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { dbx } from "@/lib/db";
import { addEvent, newMediaId } from "@/lib/orders";
import { MEDIA_CATEGORIES } from "@/lib/constants";

export const runtime = "nodejs";

// Registra en la base un archivo ya subido a Vercel Blob.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as {
    url?: string;
    contentType?: string;
    size?: number;
    category?: string;
    orderId?: number | null;
    isPublic?: boolean;
  } | null;
  if (!b?.url) return NextResponse.json({ error: "Falta la URL" }, { status: 400 });
  let host = "";
  try {
    host = new URL(b.url).hostname;
  } catch {}
  if (!host.endsWith(".blob.vercel-storage.com")) return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  const mime = b.contentType || "application/octet-stream";
  if (!mime.startsWith("image/") && !mime.startsWith("video/")) return NextResponse.json({ error: "Tipo no permitido" }, { status: 400 });
  const category = MEDIA_CATEGORIES.some((c) => c.key === b.category) ? b.category! : "ingreso";
  const orderId = b.orderId || null;
  if (orderId && !(await dbx.get("SELECT id FROM orders WHERE id = ?", orderId))) return NextResponse.json({ error: "Orden no existe" }, { status: 404 });

  const id = newMediaId();
  const kind = mime.startsWith("video/") ? "video" : "photo";
  await dbx.run(
    "INSERT INTO media (id, order_id, kind, category, filename, mime, size, public, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, orderId, kind, category, `blob:${b.url}`, mime, Math.round(b.size || 0), b.isPublic === false ? 0 : 1, user.id,
  );
  if (orderId) {
    const label = MEDIA_CATEGORIES.find((c) => c.key === category)?.label ?? category;
    await addEvent({ orderId, type: "media", body: `${kind === "video" ? "Video agregado" : "Foto agregada"}: ${label}`, isPublic: b.isPublic !== false, userId: user.id });
  }
  return NextResponse.json({ id, kind, mime, category });
}
