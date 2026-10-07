"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { Window, WindowButton, WindowCancel } from "./window";

/** The square the image is framed in on screen (px). */
const FRAME = 288;
const MAX_ZOOM = 4;

type Loaded = { url: string; img: HTMLImageElement };

/**
 * Crop a photo to a square (4.2b): drag to move, zoom with the slider, the mouse wheel or
 * +/-; arrows nudge. The circle shows how it looks as an avatar. Done draws `output` x
 * `output` pixels and returns a JPG. Everything happens in the browser.
 */
export function ImageCropWindow({
  file,
  title = "Crop photo",
  output = 512,
  onCancel,
  onDone,
}: {
  /** The image to crop; the window is open while it is set. */
  file: File | null;
  title?: string;
  output?: number;
  onCancel: () => void;
  onDone: (blob: Blob) => void | Promise<void>;
}) {
  return file ? <CropBody key={`${file.name}:${file.size}:${file.lastModified}`} file={file} title={title} output={output} onCancel={onCancel} onDone={onDone} /> : null;
}

function CropBody({ file, title, output, onCancel, onDone }: { file: File; title: string; output: number; onCancel: () => void; onDone: (blob: Blob) => void | Promise<void> }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    // A run that was cleaned up (dev mode runs effects twice) must not report its revoked URL as a failure.
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      const base = Math.max(FRAME / img.naturalWidth, FRAME / img.naturalHeight);
      setOffset({ x: (FRAME - img.naturalWidth * base) / 2, y: (FRAME - img.naturalHeight * base) / 2 });
      setLoaded({ url, img });
    };
    img.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    img.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const base = loaded ? Math.max(FRAME / loaded.img.naturalWidth, FRAME / loaded.img.naturalHeight) : 1;
  const scale = base * zoom;
  const w = (loaded?.img.naturalWidth ?? 0) * scale;
  const h = (loaded?.img.naturalHeight ?? 0) * scale;
  /** Keep the frame covered: the image never leaves a gap inside the square. */
  const clamp = (x: number, y: number, iw = w, ih = h) => ({ x: Math.min(0, Math.max(FRAME - iw, x)), y: Math.min(0, Math.max(FRAME - ih, y)) });

  const zoomTo = (next: number) => {
    if (!loaded) return;
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    const s2 = base * z;
    // Zoom around the centre of the frame.
    const cx = (FRAME / 2 - offset.x) / scale;
    const cy = (FRAME / 2 - offset.y) / scale;
    setZoom(z);
    setOffset(clamp(FRAME / 2 - cx * s2, FRAME / 2 - cy * s2, loaded.img.naturalWidth * s2, loaded.img.naturalHeight * s2));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setOffset(clamp(d.ox + e.clientX - d.x, d.oy + e.clientY - d.y));
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => zoomTo(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 10;
    const move: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (move[e.key]) {
      e.preventDefault();
      setOffset(clamp(offset.x + move[e.key][0], offset.y + move[e.key][1]));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomTo(zoom * 1.1);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomTo(zoom / 1.1);
    }
  };

  const done = async () => {
    if (!loaded || busy) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = output;
    canvas.height = output;
    const ctx = canvas.getContext("2d");
    if (!ctx) return setBusy(false);
    ctx.fillStyle = "white"; // a transparent PNG gets a white background in the JPG
    ctx.fillRect(0, 0, output, output);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(loaded.img, -offset.x / scale, -offset.y / scale, FRAME / scale, FRAME / scale, 0, 0, output, output);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (blob) await onDone(blob);
    setBusy(false);
  };

  return (
    <Window
      open
      onClose={busy ? () => {} : onCancel}
      title={title}
      description="Drag to move, zoom with the slider or the mouse wheel. Arrows and + / − work too."
      size="sm"
      footer={
        <>
          <WindowCancel disabled={busy} />
          <WindowButton variant="primary" onClick={done} disabled={!loaded || busy}>
            {busy ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Check aria-hidden className="h-3.5 w-3.5" />} Use photo
          </WindowButton>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        {failed ? (
          <p role="alert" className="py-10 text-xs text-danger">
            This image can&apos;t be opened. Choose a JPG, PNG or WebP photo.
          </p>
        ) : (
          <div
            role="img"
            aria-label="Photo crop area"
            tabIndex={0}
            data-autofocus
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
            style={{ width: FRAME, height: FRAME }}
            className="relative cursor-grab touch-none select-none overflow-hidden rounded-md bg-surface-sunken outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing"
          >
            {loaded ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview
              <img src={loaded.url} alt="" draggable={false} style={{ width: w, height: h, transform: `translate(${offset.x}px, ${offset.y}px)` }} className="pointer-events-none absolute left-0 top-0 max-w-none" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-ink-muted">
                <Loader2 aria-hidden className="h-5 w-5 animate-spin" />
              </span>
            )}
            {/* The avatar circle: outside it is dimmed. */}
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(0,0,0,0.45)] ring-2 ring-white/80" />
          </div>
        )}
        <div className="flex w-full max-w-72 items-center gap-2">
          <button type="button" aria-label="Zoom out" onClick={() => zoomTo(zoom / 1.2)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <Minus aria-hidden className="h-3.5 w-3.5" />
          </button>
          <input type="range" aria-label="Zoom" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => zoomTo(Number(e.target.value))} className="flex-1 accent-brand" disabled={!loaded} />
          <button type="button" aria-label="Zoom in" onClick={() => zoomTo(zoom * 1.2)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <Plus aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Window>
  );
}
