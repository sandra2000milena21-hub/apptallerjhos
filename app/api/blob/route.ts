import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser, hasPermission } from "@/lib/auth";

export const runtime = "nodejs";

// Firma los permisos para que el iPad suba fotos y videos directo a Vercel Blob (sin pasar por el límite de 4,5 MB de Vercel).
export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await currentUser();
        if (!user) throw new Error("No autorizado");
        if (!hasPermission(user, "orders_edit") && !hasPermission(user, "orders_create")) throw new Error("No tienes permiso para subir archivos");
        return {
          allowedContentTypes: ["image/*", "video/*"],
          maximumSizeInBytes: 1024 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      // El registro en la base lo hace /api/media/register al terminar la subida.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
