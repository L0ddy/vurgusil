import { IconCheck, IconInstall, IconX } from "./icons";

interface Props {
  open: boolean;
  onClose: () => void;
  onNativePrompt: (() => void) | null;
  isIOS: boolean;
  isAndroid: boolean;
}

type Platform = "ios" | "android" | "desktop";

const STEPS: Record<Platform, { title: string; steps: string[] }> = {
  ios: {
    title: "iPhone / iPad (Safari)",
    steps: [
      "Alt çubuktaki Paylaş simgesine dokun",
      "Listeden “Ana Ekrana Ekle”yi seç",
      "Sağ üstteki “Ekle”ye dokun — VurguSil ana ekranında",
    ],
  },
  android: {
    title: "Android (Chrome)",
    steps: [
      "Sağ üstteki ⋮ menüsüne dokun",
      "“Uygulamayı yükle” ya da “Ana ekrana ekle”yi seç",
      "Onayla — VurguSil uygulama çekmecesinde",
    ],
  },
  desktop: {
    title: "Bilgisayar (Chrome / Edge)",
    steps: [
      "Adres çubuğunun sağındaki Yükle simgesine tıkla",
      "Ya da menü → “VurguSil'i yükle…”",
      "Onayla — masaüstüne kısayol gelir, kendi penceresinde açılır",
    ],
  },
};

export default function InstallGuide({
  open,
  onClose,
  onNativePrompt,
  isIOS,
  isAndroid,
}: Props) {
  if (!open) return null;
  const platform: Platform = isIOS ? "ios" : isAndroid ? "android" : "desktop";
  const guide = STEPS[platform];
  const others = (Object.keys(STEPS) as Platform[]).filter((p) => p !== platform);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Uygulamayı yükleme rehberi"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pop-in w-full max-w-md overflow-hidden rounded-2xl border-2 border-ink bg-sheet shadow-[8px_9px_0_rgba(22,25,32,0.85)]"
      >
        <div className="inklines flex items-center justify-between bg-ink px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-volt text-ink">
              <IconInstall className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-[16px] font-extrabold leading-tight">
                VurguSil'i yükle
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
                sekme kapansa bile sende kalır
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="focus-volt rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Kapat"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {onNativePrompt && (
            <button
              onClick={() => {
                onNativePrompt();
                onClose();
              }}
              className="btn-press focus-volt mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-volt px-4 py-3 font-display text-[15px] font-bold uppercase tracking-wide text-ink shadow-[4px_4px_0_rgba(22,25,32,0.9)] hover:bg-voltdeep"
            >
              <IconInstall className="h-5 w-5" />
              Şimdi Yükle
            </button>
          )}

          <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
            {guide.title}
          </p>
          <ol className="space-y-2.5">
            {guide.steps.map((st, i) => (
              <li key={st} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-paper font-mono text-[11px] font-bold">
                  {i + 1}
                </span>
                <span className="text-[13.5px] leading-snug text-ink/80">{st}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded-xl border-2 border-ink/10 bg-paper/70 p-3.5">
            <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink/50">
              <IconCheck className="h-3.5 w-3.5 text-mint" />
              yüklenince
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-snug text-ink/70">
              <li>• Tarayıcı sekmesi kapansa bile ana ekrandan açılır</li>
              <li>• İnternet olmadan da çalışır (çevrimdışı)</li>
              <li>• Son belgen hatırlanır — telefonundan devam edersin</li>
            </ul>
          </div>

          <details className="group mt-4">
            <summary className="focus-volt cursor-pointer list-none font-mono text-[11px] font-semibold uppercase tracking-wide text-ink/55 transition-colors hover:text-ink">
              Diğer cihazlar için adımlar{" "}
              <span className="text-ink/35 group-open:hidden">▾</span>
              <span className="hidden text-ink/35 group-open:inline">▴</span>
            </summary>
            <div className="mt-3 space-y-3">
              {others.map((p) => (
                <div key={p}>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink/45">
                    {STEPS[p].title}
                  </p>
                  <ol className="mt-1.5 space-y-1">
                    {STEPS[p].steps.map((st) => (
                      <li key={st} className="text-[12px] leading-snug text-ink/65">
                        — {st}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
