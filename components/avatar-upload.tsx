"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Shrinks a photo to a centred square in the browser, then uploads it.
 *
 * Doing the resize here rather than on the server matters: a modern phone
 * photo is 3-8MB, and six of those loading on the grid over cellular would
 * be miserable. What actually gets stored is a 256px JPEG, around 30KB.
 */
async function toSquareJpeg(file: File, size: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser wouldn't let us resize that image.");

  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Couldn't process that image. Try a JPEG or PNG.")),
      "image/jpeg",
      0.85
    );
  });
}

export default function AvatarUpload({
  memberId,
  label = "Change photo",
}: {
  memberId: string;
  label?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);

    try {
      const blob = await toSquareJpeg(file, 256);

      const body = new FormData();
      body.append("file", blob, "avatar.jpg");
      body.append("memberId", memberId);

      const res = await fetch("/api/avatar", { method: "POST", body });

      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(detail?.error ?? "Upload failed.");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong with that image."
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="rounded border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 hover:text-neutral-100 disabled:opacity-50"
      >
        {busy ? "Uploading…" : label}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
