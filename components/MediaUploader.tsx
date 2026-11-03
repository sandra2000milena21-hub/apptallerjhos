"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type Uploaded = { id: string; kind: "photo" | "video"; preview: string };

type Pending = { key: string; name: string; progress: number; error?: string };

async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 2048;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

let modePromise: Promise<"blob" | "disk"> | null = null;
function storageMode() {
  if (!modePromise) modePromise = fetch("/api/upload").then((r) => r.json()).then((d) => d.mode).catch(() => "disk");
  return modePromise;
}

/** En Vercel: el archivo va directo del iPad a Vercel Blob (privado) y luego se registra en la orden. */
async function uploadToBlob(
  blob: Blob,
  name: string,
  opts: { orderId?: number; category: string; isPublic: boolean },
  onProgress: (p: number) => void,
): Promise<{ id: string; kind: "photo" | "video" }> {
  const { upload } = await import("@vercel/blob/client");
  const ext = (blob.type.split("/")[1] || "bin").replace("quicktime", "mov").replace("jpeg", "jpg");
  const folder = opts.orderId ? `ordenes/${opts.orderId}` : "ingresos";
  const safe = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30) || "archivo";
  const res = await upload(`${folder}/${safe}.${ext}`, blob, {
    access: "private",
    handleUploadUrl: "/api/blob",
    contentType: blob.type,
    multipart: blob.size > 50 * 1024 * 1024,
    onUploadProgress: (e) => onProgress(Math.round(e.percentage)),
  });
  const r = await fetch("/api/media/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: res.url, contentType: blob.type, size: blob.size, category: opts.category, orderId: opts.orderId ?? null, isPublic: opts.isPublic }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "No se pudo registrar el archivo");
  return data;
}

function upload(
  blob: Blob,
  name: string,
  opts: { orderId?: number; category: string; isPublic: boolean },
  onProgress: (p: number) => void,
): Promise<{ id: string; kind: "photo" | "video" }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    xhr.setRequestHeader("X-Filename", encodeURIComponent(name));
    xhr.setRequestHeader("X-Category", opts.category);
    xhr.setRequestHeader("X-Public", opts.isPublic ? "1" : "0");
    if (opts.orderId) xhr.setRequestHeader("X-Order-Id", String(opts.orderId));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || "Error al subir"));
      } catch {
        reject(new Error("Error al subir"));
      }
    };
    xhr.onerror = () => reject(new Error("Sin conexión"));
    xhr.send(blob);
  });
}

export default function MediaUploader({
  orderId,
  category,
  isPublic = true,
  onUploaded,
  compact = false,
}: {
  orderId?: number;
  category: string;
  isPublic?: boolean;
  onUploaded?: (m: Uploaded) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    for (const file of list) {
      const key = Math.random().toString(36).slice(2);
      setPending((p) => [...p, { key, name: file.name, progress: 0 }]);
      try {
        const isVideo = file.type.startsWith("video/");
        const blob = isVideo ? file : await compressImage(file);
        const onProgress = (progress: number) => setPending((p) => p.map((x) => (x.key === key ? { ...x, progress } : x)));
        const mode = await storageMode();
        const res =
          mode === "blob"
            ? await uploadToBlob(blob, file.name, { orderId, category, isPublic }, onProgress)
            : await upload(blob, file.name, { orderId, category, isPublic }, onProgress);
        setPending((p) => p.filter((x) => x.key !== key));
        onUploaded?.({ id: res.id, kind: res.kind, preview: URL.createObjectURL(blob) });
        if (orderId) router.refresh();
      } catch (e) {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: (e as Error).message } : x)));
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className={`flex flex-wrap gap-2 ${compact ? "" : ""}`}>
        <button type="button" className="btn-primary" onClick={() => photoRef.current?.click()}>
          Tomar foto
        </button>
        <button type="button" className="btn-ghost" onClick={() => videoRef.current?.click()}>
          Grabar video
        </button>
        <button type="button" className="btn-ghost" onClick={() => galleryRef.current?.click()}>
          Desde la galería
        </button>
      </div>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      {pending.map((p) => (
        <div key={p.key} className="text-sm">
          {p.error ? (
            <p className="text-bad font-medium">No se pudo subir {p.name}: {p.error}</p>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-line overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${p.progress}%` }} />
              </div>
              <span className="text-muted tabular-nums w-24 text-right">Subiendo {p.progress}%</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
