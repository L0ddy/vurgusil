import { useEffect, useRef } from "react";
import { IconCheck, IconEye } from "./icons";

interface Props {
  num: number;
  index: number;
  selected: boolean;
  cleaned: boolean;
  included: boolean;
  version: number;
  getDisplayCanvas: (num: number) => HTMLCanvasElement | undefined;
  onSelect: () => void;
  onToggleIncluded: () => void;
}

export default function PageCard({
  num,
  index,
  selected,
  cleaned,
  included,
  version,
  getDisplayCanvas,
  onSelect,
  onToggleIncluded,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = canvasRef.current;
    if (!host) return;
    const src = getDisplayCanvas(num);
    if (!src) return;
    const maxW = 320;
    const scale = Math.min(1, maxW / src.width);
    host.width = Math.round(src.width * scale);
    host.height = Math.round(src.height * scale);
    const ctx = host.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, host.width, host.height);
    ctx.drawImage(src, 0, 0, host.width, host.height);
  }, [num, version, getDisplayCanvas]);

  return (
    <button
      onClick={onSelect}
      className={`btn-press focus-volt group relative flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left shadow-[0_1px_0_rgba(22,25,32,0.06),0_10px_28px_-14px_rgba(22,25,32,0.25)] transition-all ${
        selected ? "border-ink ring-2 ring-volt" : "border-ink/15 hover:border-ink/50"
      } ${included ? "" : "opacity-55 saturate-50"}`}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      aria-label={`Sayfa ${num} — karşılaştırmada aç`}
    >
      <div className="relative w-full overflow-hidden bg-paper/60">
        <canvas ref={canvasRef} className="block h-auto w-full" />
        {selected && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-volt">
            <IconEye className="h-3 w-3" />
            açık
          </span>
        )}
        {!included && (
          <span className="absolute right-2 top-2 rounded-md bg-flare px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
            hariç
          </span>
        )}
      </div>
      <div className="flex items-center justify-between border-t-2 border-ink/8 px-3 py-2">
        <span className="font-mono text-[11px] font-semibold text-ink/70">Sayfa {num}</span>
        <div className="flex items-center gap-1.5">
          {cleaned && included && (
            <span className="inline-flex items-center gap-1 rounded-md bg-mint/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-mint">
              <IconCheck className="h-3 w-3" />
              temiz
            </span>
          )}
          <span
            role="switch"
            aria-checked={included}
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onToggleIncluded();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onToggleIncluded();
              }
            }}
            className={`focus-volt inline-flex h-5 w-9 items-center rounded-full border-2 border-ink/30 p-0.5 transition-colors ${
              included ? "bg-volt" : "bg-ink/15"
            }`}
            title={included ? "Temizlemeye dahil (kapatmak için tıkla)" : "Hariç tutuldu (dahil etmek için tıkla)"}
          >
            <span
              className={`h-3.5 w-3.5 rounded-full border-2 border-ink/60 bg-white transition-transform ${
                included ? "translate-x-3.5" : "translate-x-0"
              }`}
            />
          </span>
        </div>
      </div>
    </button>
  );
}
