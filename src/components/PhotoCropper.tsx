"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MinusIcon, PlusIcon } from "./Art";

/** Lado da foto final, em px. O maior avatar do app tem 48 px; 256 fica nítido mesmo em telas 3x. */
const OUT = 256;
/** Fotos de câmera (4000 px ou mais) são reduzidas a isso antes do ajuste: leve na memória e ainda nítido no zoom máximo. */
const WORK_MAX = 1280;
const MAX_ZOOM = 4;

interface Source {
  url: string;
  w: number;
  h: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("imagem ilegível"));
    img.src = url;
  });
}

/** Reduz pela metade em etapas até caber em `max`: um único passo grande serrilha a imagem em alguns navegadores. */
async function prepare(file: File): Promise<Source> {
  const original = URL.createObjectURL(file);
  try {
    const img = await loadImage(original);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) throw new Error("imagem vazia");
    let source: CanvasImageSource = img;
    while (Math.max(w, h) > WORK_MAX) {
      const f = Math.max(0.5, WORK_MAX / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.round(w * f);
      c.height = Math.round(h * f);
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, c.width, c.height);
      source = c;
      w = c.width;
      h = c.height;
    }
    if (source === img) return { url: original, w, h };
    const blob = await new Promise<Blob | null>((r) => (source as HTMLCanvasElement).toBlob(r, "image/jpeg", 0.92));
    URL.revokeObjectURL(original);
    if (!blob) throw new Error("falha ao reduzir");
    return { url: URL.createObjectURL(blob), w, h };
  } catch (err) {
    URL.revokeObjectURL(original);
    throw err;
  }
}

/** WebP quando o navegador sabe gerar; senão JPEG (Safari antigo devolve PNG ao pedir WebP). */
async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const as = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  const webp = await as("image/webp", 0.82);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await as("image/jpeg", 0.85);
  if (!jpeg) throw new Error("falha ao gerar a foto");
  return jpeg;
}

interface View {
  zoom: number;
  x: number;
  y: number;
}

/**
 * Tela para enquadrar a foto da criança antes de enviar: arrastar para posicionar, zoom pelo controle,
 * pela pinça (dois dedos) ou pela roda do mouse, e prévia de como o avatar vai ficar no app.
 */
export function PhotoCropper({
  file,
  name,
  fill,
  onCancel,
  onConfirm,
}: {
  file: File;
  name: string;
  fill: string;
  onCancel: () => void;
  onConfirm: (photo: Blob) => Promise<void>;
}) {
  const [src, setSrc] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState(288);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    prepare(file)
      .then((s) => {
        url = s.url;
        if (alive) setSrc(s);
        else URL.revokeObjectURL(s.url);
      })
      .catch(() => alive && setError("Não consegui abrir essa imagem. Tente outra foto."));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  // Palco quadrado que cabe na tela do celular, e trava a rolagem da página por trás.
  useEffect(() => {
    const fit = () => setStage(Math.min(320, window.innerWidth - 48));
    fit();
    window.addEventListener("resize", fit);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onCancel();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onCancel, saving]);

  /** Escala da imagem no palco: com zoom 1 ela cobre o quadrado inteiro (lado menor = palco). */
  const scaleFor = useCallback((zoom: number) => (src ? (stage / Math.min(src.w, src.h)) * zoom : 1), [src, stage]);

  /** Não deixa sobrar espaço vazio dentro do recorte. */
  const clamp = useCallback(
    (v: View): View => {
      if (!src) return v;
      const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
      const s = scaleFor(zoom);
      const mx = Math.max(0, (src.w * s - stage) / 2);
      const my = Math.max(0, (src.h * s - stage) / 2);
      return { zoom, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
    },
    [src, stage, scaleFor],
  );

  /** Zoom em torno do centro: o ponto do meio continua no meio. */
  const zoomTo = useCallback(
    (zoom: number) =>
      setView((v) => {
        const next = Math.min(MAX_ZOOM, Math.max(1, zoom));
        const r = next / v.zoom;
        return clamp({ zoom: next, x: v.x * r, y: v.y * r });
      }),
    [clamp],
  );

  // O palco pode mudar de tamanho (girar o celular): o que aparece e o que é salvo sempre respeita os limites.
  const shown = clamp(view);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const pts = [...map.entries()];
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.length === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (pts.length === 2) {
      const other = pts.find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 0) setView((v) => {
        const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom * (after / before)));
        const r = zoom / v.zoom;
        return clamp({ zoom, x: v.x * r, y: v.y * r });
      });
    }
  }

  function onPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
  }

  async function confirm() {
    const img = imgRef.current;
    if (!src || !img) return;
    setSaving(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUT, OUT);
      const k = OUT / stage;
      const s = scaleFor(shown.zoom) * k;
      const w = src.w * s;
      const h = src.h * s;
      ctx.drawImage(img, OUT / 2 + shown.x * k - w / 2, OUT / 2 + shown.y * k - h / 2, w, h);
      await onConfirm(await encode(canvas));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Não foi possível salvar a foto.");
      setSaving(false);
    }
  }

  /** A mesma imagem, no mesmo enquadramento, desenhada num quadrado de `size` px. */
  const framed = (size: number) => {
    if (!src) return null;
    const k = size / stage;
    const s = scaleFor(shown.zoom) * k;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src.url}
        alt=""
        draggable={false}
        className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
        style={{
          width: src.w * s,
          height: src.h * s,
          transform: `translate(calc(-50% + ${shown.x * k}px), calc(-50% + ${shown.y * k}px))`,
        }}
      />
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ajustar-foto"
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-paper px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-[calc(env(safe-area-inset-top,0px)+1.25rem)]"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <div className="text-center">
          <h2 id="ajustar-foto" className="font-display text-2xl font-semibold">Foto de {name}</h2>
          <p className="text-[15px] text-ink-soft">Arraste para posicionar e use o zoom para deixar o rosto dentro do círculo.</p>
        </div>

        <div
          className="relative touch-none select-none overflow-hidden rounded-3xl bg-[#1c2b2d]"
          style={{ width: stage, height: stage, cursor: src ? "grab" : "default" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onWheel={(e) => zoomTo(shown.zoom * Math.exp(-e.deltaY * 0.002))}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src.url}
              alt={`Foto de ${name} sendo ajustada`}
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: src.w * scaleFor(shown.zoom),
                height: src.h * scaleFor(shown.zoom),
                transform: `translate(calc(-50% + ${shown.x}px), calc(-50% + ${shown.y}px))`,
              }}
            />
          )}
          {/* Escurece o que fica de fora do avatar redondo. */}
          <div
            className="pointer-events-none absolute inset-[6px] rounded-full border-[3px] border-[#ffffff]"
            style={{ boxShadow: "0 0 0 999px rgb(10 20 22 / 0.55)" }}
            aria-hidden="true"
          />
          {!src && !error && (
            <p className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#ffffff]">Abrindo foto...</p>
          )}
        </div>

        <div className="flex w-full items-center gap-3">
          <button
            type="button"
            onClick={() => zoomTo(shown.zoom - 0.25)}
            disabled={!src || shown.zoom <= 1}
            aria-label="Diminuir zoom"
            className="btn size-11 shrink-0 rounded-full bg-white"
          >
            <MinusIcon size={20} />
          </button>
          <label htmlFor="zoom" className="sr-only">Zoom</label>
          <input
            id="zoom"
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={shown.zoom}
            disabled={!src}
            onChange={(e) => zoomTo(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer accent-[var(--c-brand)]"
          />
          <button
            type="button"
            onClick={() => zoomTo(shown.zoom + 0.25)}
            disabled={!src || shown.zoom >= MAX_ZOOM}
            aria-label="Aumentar zoom"
            className="btn size-11 shrink-0 rounded-full bg-white"
          >
            <PlusIcon size={20} />
          </button>
        </div>

        {src && (
          <div className="card flex w-full items-center gap-4 px-4 py-3">
            <p className="flex-1 text-sm font-bold">Assim vai aparecer no app:</p>
            {[56, 36].map((size) => (
              <span
                key={size}
                className="relative shrink-0 overflow-hidden rounded-full"
                style={{ width: size, height: size, boxShadow: `0 0 0 ${Math.max(2, Math.round(size / 16))}px ${fill}` }}
              >
                {framed(size)}
              </span>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="w-full rounded-2xl border border-line bg-coral p-3 text-base font-bold">
            {error}
          </p>
        )}

        <div className="grid w-full grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} disabled={saving} className="btn btn-outline h-14 text-lg">
            Cancelar
          </button>
          <button type="button" onClick={confirm} disabled={!src || saving} className="btn btn-primary h-14 text-lg">
            {saving ? "Salvando..." : "Usar foto"}
          </button>
        </div>
      </div>
    </div>
  );
}
