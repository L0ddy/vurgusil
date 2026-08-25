import { useCallback, useEffect, useRef, useState } from "react";
import { IconCompare, IconDownload, IconEye } from "./icons";

export type CompareMode = "slider" | "before" | "after";

interface Props {
  beforeSrc: string;
  afterSrc: string;
  imgWidth: number;
  imgHeight: number;
  mode: CompareMode;
  onMode: (m: CompareMode) => void;
  pageLabel: string;
  onDownloadPng: () => void;
}

export default function CompareViewer({
  beforeSrc,
  afterSrc,
  imgWidth,
  imgHeight,
  mode,
  onMode,
  pageLabel,
  onDownloadPng,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState(52);
  const dragging = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const ratio = imgWidth / imgHeight;
      let w = r.width;
      let h = w / ratio;
      if (h > r.height) {
        h = r.height;
        w = h * ratio;
      }
      setBox({ w: Math.floor(w), h: Math.floor(h) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [imgWidth, imgHeight]);

  const posFromClient = useCallback(
    (clientX: number) => {
      const el = wrapRef.current;
      if (!el || box.w === 0) return;
      const r = el.getBoundingClientRect();
      const center = r.left + (r.width - box.w) / 2;
      const p = ((clientX - center) / box.w) * 100;
      setPos(Math.min(98, Math.max(2, p)));
    },
    [box.w]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== "slider") return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    posFromClient(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) posFromClient(e.clientX);
  };
  const onPointerUp = () => (dragging.current = false);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPos((p) => Math.max(2, p - 3));
    if (e.key === "ArrowRight") setPos((p) => Math.min(98, p + 3));
  };

  const showBefore = mode === "before" || mode === "slider";
  const showAfter = mode === "after" || mode === "slider";

  return (
    <div className="rise-in flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/70">
            <IconCompare className="h-4 w-4" />
            {pageLabel}
          </span>
          <div className="flex overflow-hidden rounded-lg border-2 border-ink bg-sheet">
            {(
              [
                ["slider", "Kaydır", IconCompare],
                ["before", "Önce", IconEye],
                ["after", "Sonra", IconEye],
              ] as const
            ).map(([m, label, I]) => (
              <button
                key={m}
                onClick={() => onMode(m)}
                className={`btn-press focus-volt inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                  mode === m
                    ? "bg-ink text-volt"
                    : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <I className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onDownloadPng}
          className="btn-press focus-volt inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-sheet px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink shadow-[3px_3px_0_rgba(22,25,32,0.9)] hover:bg-volt"
        >
          <IconDownload className="h-4 w-4" />
          PNG indir
        </button>
      </div>

      <div
        ref={wrapRef}
        className={`relative min-h-0 flex-1 overflow-hidden ${
          mode === "slider" ? "cursor-ew-resize" : ""
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border-2 border-ink/15 bg-white shadow-[0_18px_50px_-20px_rgba(22,25,32,0.45)]"
          style={{ width: box.w, height: box.h }}
        >
          {showAfter && (
            <img
              src={afterSrc}
              alt="Temizlenmiş sayfa"
              className="absolute inset-0 h-full w-full select-none"
              draggable={false}
            />
          )}
          {showBefore && mode === "slider" && (
            <img
              src={beforeSrc}
              alt="Orijinal sayfa"
              className="absolute inset-0 h-full w-full select-none"
              style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
              draggable={false}
            />
          )}
          {mode === "before" && (
            <img
              src={beforeSrc}
              alt="Orijinal sayfa"
              className="absolute inset-0 h-full w-full select-none"
              draggable={false}
            />
          )}

          {mode === "slider" && (
            <>
              <div
                className="absolute bottom-0 top-0 z-10 w-[3px] -translate-x-1/2 bg-ink"
                style={{ left: `${pos}%` }}
              >
                <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-volt">
                  önce
                </div>
                <div className="absolute right-0 top-3 translate-x-full rounded-md bg-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white/90">
                  sonra
                </div>
              </div>
              <div
                role="slider"
                aria-label="Karşılaştırma kaydırıcısı"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pos)}
                tabIndex={0}
                onKeyDown={onKeyDown}
                className="focus-volt absolute top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-[3px] border-ink bg-volt shadow-[3px_3px_0_rgba(22,25,32,0.85)] transition-transform hover:scale-110"
                style={{ left: `${pos}%` }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink" aria-hidden="true">
                  <path
                    d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
