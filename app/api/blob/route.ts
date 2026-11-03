import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";

// Firma los permisos para que el iPad suba fotos y videos directo a Vercel Blob (sin pasar por el límite de 4,5 MB de Vercel).
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await currentUser();
        if (!user) throw new Error("No autorizado");
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
