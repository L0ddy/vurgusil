import type { CleanSettings } from "../lib/cleaner";
import { deviceCaps, formatBytes } from "../lib/pdfTools";
import {
  IconDownload,
  IconFile,
  IconImage,
  IconRefresh,
  IconShield,
  IconSpark,
  IconTrash,
  IconWand,
} from "./icons";

export interface FileInfo {
  name: string;
  size: number;
  pages: number;
}

type Job = { done: number; total: number; label: string } | null;

interface Props {
  fileInfo: FileInfo | null;
  settings: CleanSettings;
  onSettings: (s: CleanSettings) => void;
  onClean: () => void;
  onExport: () => void;
  onExportPngZip: () => void;
  exporting: boolean;
  job: Job;
  cleanedCount: number;
  stale: boolean;
  onReset: () => void;
  onPickFile: () => void;
  onLoadSample: () => void;
}

const HUES: {
  key: keyof CleanSettings["hues"];
  label: string;
  swatch: string;
}[] = [
  { key: "yellow", label: "Sarı", swatch: "#ffe14d" },
  { key: "orange", label: "Turuncu", swatch: "#ffb14d" },
  { key: "pink", label: "Pembe", swatch: "#ff5ca8" },
  { key: "green", label: "Yeşil", swatch: "#6fe39b" },
  { key: "blue", label: "Mavi", swatch: "#6fb7ff" },
];

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12.5px] font-semibold text-white/85">{label}</span>
        <span className="font-mono text-[11px] font-bold text-volt">%{value}</span>
      </div>
      <input
        type="range"
        className="rng focus-volt"
        min={min}
        max={max}
        value={value}
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <p className="mt-0.5 text-[10.5px] leading-snug text-white/35">{hint}</p>
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="focus-volt group flex w-full items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-left transition-colors hover:border-white/25"
      role="switch"
      aria-checked={checked}
    >
      <span>
        <span className="block text-[12.5px] font-semibold text-white/85">{label}</span>
        <span className="mt-0.5 block text-[10.5px] leading-snug text-white/35">{desc}</span>
      </span>
      <span
        className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 p-0.5 transition-colors ${
          checked ? "border-volt/60 bg-volt" : "border-white/25 bg-white/10"
        }`}
      >
        <span
          className={`h-3.5 w-3.5 rounded-full border-2 transition-transform ${
            checked ? "translate-x-3.5 border-ink bg-ink" : "translate-x-0 border-white/50 bg-white/70"
          }`}
        />
      </span>
    </button>
  );
}

export default function SettingsPanel({
  fileInfo,
  settings,
  onSettings,
  onClean,
  onExport,
  onExportPngZip,
  exporting,
  job,
  cleanedCount,
  stale,
  onReset,
  onPickFile,
  onLoadSample,
}: Props) {
  const busy = job !== null || exporting;
  const set = (patch: Partial<CleanSettings>) => onSettings({ ...settings, ...patch });
  const setHue = (key: keyof CleanSettings["hues"], v: boolean) =>
    onSettings({ ...settings, hues: { ...settings.hues, [key]: v } });

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* dosya kartı */}
      {fileInfo ? (
        <div className="rise-in rounded-xl border border-white/12 bg-white/[0.05] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-volt/15 text-volt">
              <IconFile className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-white" title={fileInfo.name}>
                {fileInfo.name}
              </p>
              <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-wider text-white/40">
                {fileInfo.pages} sayfa · {formatBytes(fileInfo.size)}
              </p>
            </div>
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <button
              onClick={onPickFile}
              disabled={busy}
              className="btn-press focus-volt flex items-center justify-center gap-1.5 rounded-lg border border-white/20 px-2 py-2 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-white/75 hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <IconRefresh className="h-3.5 w-3.5" />
              Yeni dosya
            </button>
            <button
              onClick={onReset}
              disabled={busy}
              className="btn-press focus-volt flex items-center justify-center gap-1.5 rounded-lg border border-flare/40 px-2 py-2 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-flare/85 hover:bg-flare/15 hover:text-flare disabled:opacity-40"
            >
              <IconTrash className="h-3.5 w-3.5" />
              Belgeyi kapat
            </button>
          </div>
        </div>
      ) : (
        <div className="rise-in rounded-xl border border-dashed border-white/20 p-4 text-center">
          <p className="text-[12px] text-white/45">Belge yüklendiğinde bilgileri burada görünür.</p>
        </div>
      )}

      {/* temizleme kontrolleri */}
      <section>
        <p className="mb-3 flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.22em] text-white/45">
          <IconSpark className="h-3.5 w-3.5 text-volt" />
          Temizleme ayarları
        </p>
        <div className="space-y-4">
          <Slider
            label="Hassasiyet"
            value={settings.sensitivity}
            min={0}
            max={100}
            onChange={(v) => set({ sensitivity: v })}
            hint="Yüksekte soluk izler de yakalanır; metin rengi soluklaşabilir."
          />
          <Slider
            label="Silme gücü"
            value={settings.strength}
            min={40}
            max={100}
            onChange={(v) => set({ strength: v })}
            hint="İzlerin ne kadar beyaza çekileceği."
          />

          <div>
            <p className="mb-2 text-[12.5px] font-semibold text-white/85">Hedef renkler</p>
            <div className="flex flex-wrap gap-2">
              {HUES.map((h) => {
                const on = settings.hues[h.key];
                return (
                  <button
                    key={h.key}
                    onClick={() => setHue(h.key, !on)}
                    className={`btn-press focus-volt inline-flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                      on
                        ? "border-volt/70 bg-volt/15 text-white"
                        : "border-white/15 text-white/40 hover:border-white/35"
                    }`}
                    aria-pressed={on}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/30"
                      style={{ background: h.swatch, opacity: on ? 1 : 0.35 }}
                    />
                    {h.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10.5px] leading-snug text-white/35">
              Mavi genelde bağlantı rengidir; emin değilsen kapalı tut.
            </p>
          </div>

          <div className="space-y-2">
            <Toggle
              label="Gri bantları beyazlat"
              desc="Tarama belgelerindeki açık gri zemin lekelerini temizler."
              checked={settings.whiten}
              onChange={(v) => set({ whiten: v })}
            />
            <Toggle
              label="Koyu metni koru"
              desc="Renkli ama koyu mürekkebe dokunmaz; başlık renklerini korur."
              checked={settings.protectDark}
              onChange={(v) => set({ protectDark: v })}
            />
          </div>
        </div>
      </section>

      {/* işlem */}
      <section>
        <p className="mb-3 flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.22em] text-white/45">
          <IconWand className="h-3.5 w-3.5 text-volt" />
          İşlem
        </p>

        {busy && job ? (
          <div className="rounded-xl border border-white/12 bg-white/[0.05] p-4">
            <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-white/60">
              <span className="uppercase tracking-wider">{job.label}</span>
              <span className="font-bold text-volt">
                {job.done}/{job.total}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="progress-stripes h-full rounded-full bg-volt transition-all duration-200"
                style={{ width: `${Math.max(4, (job.done / Math.max(1, job.total)) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={onClean}
            disabled={!fileInfo || busy}
            className="btn-press focus-volt flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-volt px-3 py-3 font-display text-[15px] font-extrabold uppercase tracking-wide text-ink shadow-[4px_4px_0_rgba(216,246,81,0.2)] hover:bg-voltdeep disabled:opacity-40"
          >
            <IconWand className="h-5 w-5" />
            {stale ? "Yeniden Temizle" : cleanedCount > 0 ? "Tekrar Temizle" : "Temizle"}
          </button>
        )}

        {stale && !busy && (
          <p className="mt-2 rounded-lg border border-tang/40 bg-tang/10 px-3 py-2 font-mono text-[10.5px] uppercase tracking-wide text-tang">
            Ayarlar değişti — yalnız seçili sayfa güncel
          </p>
        )}

        {cleanedCount > 0 && !busy && (
          <>
            <button
              onClick={onExport}
              disabled={exporting}
              className="btn-press focus-volt mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/85 bg-transparent px-3 py-2.5 text-[13px] font-bold text-white hover:bg-white hover:text-ink disabled:opacity-50"
            >
              <IconDownload className="h-4 w-4" />
              {exporting ? "Hazırlanıyor…" : "Temiz PDF'i İndir"}
            </button>
            <button
              onClick={onExportPngZip}
              disabled={exporting}
              className="btn-press focus-volt mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/30 bg-transparent px-3 py-2.5 text-[13px] font-bold text-white/80 hover:border-volt hover:text-volt disabled:opacity-50"
              title="Tüm temizlenmiş sayfaları 1500 DPI PNG olarak ZIP içinde indir"
            >
              <IconImage className="h-4 w-4" />
              Tüm Sayfaları PNG İndir
            </button>
          </>
        )}

        <p className="mt-2.5 flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
          <span className="blink-dot h-1.5 w-1.5 shrink-0 rounded-full bg-volt" />
          dışa aktarım · hedef {deviceCaps().exportDpi} dpi · pdf + png arşivi
        </p>
        {deviceCaps().mobile && (
          <p className="mt-1.5 px-1 font-mono text-[10px] leading-relaxed text-white/35">
            Telefon tarayıcısı {deviceCaps().exportDpi} dpi tuvalini desteklemiyorsa cihazın
            izin verdiği en yüksek çözünürlük otomatik kullanılır — indirme sırasında gerçek
            değer bildirilir.
          </p>
        )}
      </section>

      {/* örnek dosya */}
      {!fileInfo && (
        <button
          onClick={onLoadSample}
          disabled={busy}
          className="btn-press focus-volt flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/25 px-3 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-white/60 hover:border-volt/60 hover:text-volt disabled:opacity-40"
        >
          <IconSpark className="h-4 w-4" />
          Örnek dosyayı dene
        </button>
      )}

      <p className="flex items-start gap-2 border-t border-white/10 pt-4 text-[10.5px] leading-relaxed text-white/35">
        <IconShield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-volt/70" />
        Tüm işlem bu cihazda gerçekleşir. Dosyan hiçbir sunucuya gönderilmez, orijinal belge
        asla değişmez.
      </p>
    </div>
  );
}
