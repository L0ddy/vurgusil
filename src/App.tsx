import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cleanCanvas, type CleanSettings } from "./lib/cleaner";
import {
  assertSafePdf,
  buildCleanedPdf,
  canvasToPngBlob,
  deviceCaps,
  disposeCanvas,
  downloadBlob,
  formatBytes,
  makeSamplePdf,
  MAX_PAGES,
  openPdf,
  PdfValidationError,
  renderPageAtDpi,
  renderPageToCanvas,
  safeFileName,
  type ExportPage,
} from "./lib/pdfTools";
import {
  clearSession,
  loadSession,
  loadSettings,
  saveSession,
  saveSettings,
  type StoredSession,
} from "./lib/session";
import SettingsPanel, { type FileInfo } from "./components/SettingsPanel";
import CompareViewer, { type CompareMode } from "./components/CompareViewer";
import PageCard from "./components/PageCard";
import InstallGuide from "./components/InstallGuide";
import {
  IconArrow,
  IconCheck,
  IconCompare,
  IconDownload,
  IconFile,
  IconImage,
  IconInstall,
  IconLock,
  IconMarker,
  IconOffline,
  IconRefresh,
  IconShield,
  IconSpark,
  IconTrash,
  IconWand,
  IconX,
} from "./components/icons";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PageMeta {
  num: number;
  wPt: number;
  hPt: number;
}

type Job = { done: number; total: number; label: string } | null;
type Toast = { kind: "ok" | "err"; msg: string } | null;

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

export default function App() {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [cleaned, setCleaned] = useState<Set<number>>(new Set());
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>("slider");
  const [settings, setSettingsState] = useState<CleanSettings>(() => loadSettings());
  const [job, setJob] = useState<Job>(null);
  const [exporting, setExporting] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [stale, setStale] = useState(false);
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState<Toast>(null);
  const [dragOver, setDragOver] = useState(false);
  const [restoredSession, setRestoredSession] = useState<StoredSession | null>(null);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);

  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const origRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const cleanRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const jobRef = useRef<Job>(null);
  jobRef.current = job;

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid =
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");
  const [installGuideOpen, setInstallGuideOpen] = useState(false);

  /* ---------- yardımcılar ---------- */
  const showToast = useCallback((kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Ayarlar kalıcı
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // İşlem sürerken sekme kapatmaya karşı uyarı
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (jobRef.current || busyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // PWA kurulum istemi
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const fullReset = useCallback(() => {
    pdfDocRef.current?.loadingTask.destroy().catch(() => {});
    pdfDocRef.current = null;
    origRef.current.clear();
    cleanRef.current.clear();
    setFileInfo(null);
    setPages([]);
    setCleaned(new Set());
    setExcluded(new Set());
    setSelected(null);
    setJob(null);
    setStale(false);
    setRestoredSession(null);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    return () => {
      pdfDocRef.current?.loadingTask.destroy().catch(() => {});
    };
  }, []);

  /* ---------- temizleme ---------- */
  const runCleanAll = useCallback(
    async (pageList: PageMeta[]) => {
      const s = settingsRef.current;
      setJob({ done: 0, total: pageList.length, label: "Temizleniyor" });
      const done = new Set<number>();
      for (let i = 0; i < pageList.length; i++) {
        const p = pageList[i];
        const orig = origRef.current.get(p.num);
        if (orig) {
          cleanRef.current.set(p.num, cleanCanvas(orig, s));
          done.add(p.num);
        }
        setCleaned(new Set(done));
        setJob({ done: i + 1, total: pageList.length, label: "Temizleniyor" });
        setTick((t) => t + 1);
        await yieldToUi();
      }
      setJob(null);
      setStale(false);
      showToast("ok", `${done.size} sayfa temizlendi. Karşılaştır ve indir.`);
    },
    [showToast]
  );

  /* ---------- belge yükleme ---------- */
  const loadFromBuffer = useCallback(
    async (name: string, size: number, data: ArrayBuffer | Uint8Array) => {
      if (busyRef.current) return;
      busyRef.current = true;
      fullReset();
      setLoadingDoc(true);
      setFileInfo({ name, size, pages: 0 });
      try {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        assertSafePdf(bytes); // imza + boyut denetimi (güvenlik)
        void saveSession(name, size, bytes); // sonraki açılışta hatırla
        const doc = await openPdf(bytes);
        pdfDocRef.current = doc;
        const n = doc.numPages;
        if (n > MAX_PAGES) {
          doc.loadingTask.destroy().catch(() => {});
          pdfDocRef.current = null;
          throw new PdfValidationError(`Belge çok uzun (en fazla ${MAX_PAGES} sayfa).`);
        }
        setFileInfo({ name, size, pages: n });
        const target = deviceCaps().mobile
          ? deviceCaps().previewWidth
          : n > 60
            ? 900
            : n > 25
              ? 1050
              : 1200;
        const list: PageMeta[] = [];
        setJob({ done: 0, total: n, label: "Sayfalar okunuyor" });
        for (let i = 1; i <= n; i++) {
          const { canvas, widthPt, heightPt } = await renderPageToCanvas(doc, i, target);
          origRef.current.set(i, canvas);
          list.push({ num: i, wPt: widthPt, hPt: heightPt });
          setPages([...list]);
          if (i === 1) setSelected(1);
          setJob({ done: i, total: n, label: "Sayfalar okunuyor" });
          await yieldToUi();
        }
        setRestoredSession(null);
        await runCleanAll(list);
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string };
        fullReset();
        showToast(
          "err",
          err instanceof PdfValidationError
            ? err.message
            : err?.name === "PasswordException"
              ? "Bu PDF şifre korumalı. Şifresiz bir kopya ile dene."
              : `PDF açılamadı: ${err?.message ?? "dosya bozuk olabilir."}`
        );
      } finally {
        setLoadingDoc(false);
        busyRef.current = false;
      }
    },
    [fullReset, runCleanAll, showToast]
  );

  const onFile = useCallback(
    (file: File) => {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!isPdf) {
        showToast("err", "Yalnızca PDF dosyaları destekleniyor.");
        return;
      }
      file
        .arrayBuffer()
        .then((buf) => loadFromBuffer(file.name, file.size, buf))
        .catch(() => showToast("err", "Dosya okunamadı."));
    },
    [loadFromBuffer, showToast]
  );

  const onLoadSample = useCallback(async () => {
    if (busyRef.current) return;
    try {
      const bytes = await makeSamplePdf();
      await loadFromBuffer("vurgusil-ornek-rapor.pdf", bytes.length, bytes);
    } catch {
      showToast("err", "Örnek dosya oluşturulamadı.");
    }
  }, [loadFromBuffer, showToast]);

  // Açılışta önceki oturumu hatırla ("kaldığın yerden devam et")
  useEffect(() => {
    let cancelled = false;
    loadSession().then((s) => {
      if (!cancelled && s) setRestoredSession(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onResumeSession = useCallback(() => {
    if (!restoredSession) return;
    void loadFromBuffer(restoredSession.name, restoredSession.size, restoredSession.bytes);
  }, [restoredSession, loadFromBuffer]);

  const onCloseDocument = useCallback(() => {
    void clearSession();
    fullReset();
    showToast("ok", "Belge kapatıldı, kayıtlı oturum temizlendi.");
  }, [fullReset, showToast]);

  /* ---------- canlı önizleme (ayar değişince seçili sayfa) ---------- */
  const firstSettings = useRef(true);
  useEffect(() => {
    if (firstSettings.current) {
      firstSettings.current = false;
      return;
    }
    if (selected === null || !cleaned.has(selected)) return;
    const t = setTimeout(() => {
      const orig = origRef.current.get(selected);
      if (!orig) return;
      cleanRef.current.set(selected, cleanCanvas(orig, settings));
      setTick((x) => x + 1);
      if (pages.length > 1) setStale(true);
    }, 240);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  /* ---------- görüntüleme ---------- */
  const getDisplayCanvas = useCallback(
    (num: number): HTMLCanvasElement | undefined => {
      if (!excluded.has(num) && cleanRef.current.has(num)) return cleanRef.current.get(num);
      return origRef.current.get(num);
    },
    [excluded, tick] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const viewer = useMemo(() => {
    if (selected === null) return null;
    const orig = origRef.current.get(selected);
    if (!orig) return null;
    const clean =
      !excluded.has(selected) && cleanRef.current.has(selected)
        ? cleanRef.current.get(selected)!
        : orig;
    return {
      before: orig.toDataURL("image/jpeg", 0.86),
      after: clean.toDataURL("image/jpeg", 0.86),
      w: clean.width,
      h: clean.height,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, tick, excluded]);

  /* ---------- dışa aktarma (hedef 1500 DPI) ---------- */
  const onExport = useCallback(async () => {
    const doc = pdfDocRef.current;
    if (!fileInfo || !doc || exporting || job) return;
    setExporting(true);
    const caps = deviceCaps();
    const dpiLabel = `${caps.exportDpi} DPI işleniyor`;
    setJob({ done: 0, total: pages.length, label: dpiLabel });
    try {
      const list: ExportPage[] = [];
      const s = settingsRef.current;
      let realDpi = 0;
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const rendered = await renderPageAtDpi(doc, p.num);
        realDpi ||= rendered.effectiveDpi ?? caps.exportDpi;
        const finalCanvas = excluded.has(p.num)
          ? rendered.canvas
          : cleanCanvas(rendered.canvas, s);
        if (finalCanvas !== rendered.canvas) disposeCanvas(rendered.canvas);
        list.push({ widthPt: p.wPt, heightPt: p.hPt, dataUrl: finalCanvas.toDataURL("image/jpeg", 0.9) });
        disposeCanvas(finalCanvas);
        setJob({ done: i + 1, total: pages.length, label: dpiLabel });
        await yieldToUi();
      }
      const blob = await buildCleanedPdf(list);
      downloadBlob(blob, fileInfo.name.replace(/\.pdf$/i, "") + "-temiz.pdf");
      showToast(
        "ok",
        `Temiz PDF indirildi — ${realDpi || caps.exportDpi} DPI · ${formatBytes(blob.size)}`
      );
    } catch {
      showToast("err", "PDF oluşturulurken bir sorun oluştu.");
    } finally {
      setJob(null);
      setExporting(false);
    }
  }, [fileInfo, pages, excluded, exporting, job, showToast]);

  const onDownloadPng = useCallback(async () => {
    const doc = pdfDocRef.current;
    if (selected === null || !doc || exporting) return;
    setExporting(true);
    try {
      const rendered = await renderPageAtDpi(doc, selected);
      const finalCanvas = excluded.has(selected)
        ? rendered.canvas
        : cleanCanvas(rendered.canvas, settingsRef.current);
      if (finalCanvas !== rendered.canvas) disposeCanvas(rendered.canvas);
      const blob = await canvasToPngBlob(finalCanvas);
      disposeCanvas(finalCanvas);
      const base = safeFileName(fileInfo?.name.replace(/\.pdf$/i, "") ?? "sayfa");
      downloadBlob(blob, `${base}-s${String(selected).padStart(2, "0")}-temiz.png`);
      showToast(
        "ok",
        `Sayfa ${selected} PNG indirildi — ${rendered.effectiveDpi ?? deviceCaps().exportDpi} DPI.`
      );
    } catch {
      showToast("err", "PNG oluşturulamadı.");
    } finally {
      setExporting(false);
    }
  }, [selected, excluded, exporting, fileInfo, showToast]);

  /* ---------- tüm sayfalar → PNG arşivi (ZIP, hedef 1500 DPI) ---------- */
  const onExportAllPng = useCallback(async () => {
    const doc = pdfDocRef.current;
    if (!fileInfo || !doc || exporting || job || pages.length === 0) return;
    setExporting(true);
    const caps = deviceCaps();
    setJob({ done: 0, total: pages.length, label: "PNG sayfaları" });
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const s = settingsRef.current;
      let realDpi = 0;
      let count = 0;
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const rendered = await renderPageAtDpi(doc, p.num);
        realDpi ||= rendered.effectiveDpi ?? caps.exportDpi;
        const finalCanvas = excluded.has(p.num)
          ? rendered.canvas
          : cleanCanvas(rendered.canvas, s);
        if (finalCanvas !== rendered.canvas) disposeCanvas(rendered.canvas);
        const blob = await canvasToPngBlob(finalCanvas);
        disposeCanvas(finalCanvas);
        if (blob) {
          zip.file(`sayfa-${String(p.num).padStart(3, "0")}.png`, blob);
          count++;
        }
        setJob({ done: i + 1, total: pages.length, label: "PNG sayfaları" });
        await yieldToUi();
      }
      if (count === 0) throw new Error("hiç sayfa yok");
      setJob({ done: pages.length, total: pages.length, label: "ZIP oluşturuluyor" });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const base = safeFileName(fileInfo.name.replace(/\.pdf$/i, ""), "belge");
      downloadBlob(zipBlob, `${base}-png-${realDpi || caps.exportDpi}dpi.zip`);
      showToast(
        "ok",
        `${count} sayfa PNG indirildi — ${realDpi || caps.exportDpi} DPI (ZIP · ${formatBytes(zipBlob.size)})`
      );
    } catch {
      showToast("err", "PNG arşivi hazırlanırken bir sorun oluştu.");
    } finally {
      setJob(null);
      setExporting(false);
    }
  }, [fileInfo, pages, excluded, exporting, job, showToast]);

  /* ---------- PWA kurulum ---------- */
  const onInstall = useCallback(() => {
    if (installEvt) {
      void (async () => {
        installEvt.prompt();
        const choice = await installEvt.userChoice;
        if (choice.outcome === "accepted") setInstallEvt(null);
      })();
    } else if (!isStandalone) {
      setInstallGuideOpen(true);
    }
  }, [installEvt, isStandalone]);

  const onNativeInstall = useCallback(() => {
    if (!installEvt) return;
    void (async () => {
      installEvt.prompt();
      const choice = await installEvt.userChoice;
      if (choice.outcome === "accepted") setInstallEvt(null);
    })();
  }, [installEvt]);

  /* ---------- drag & drop ---------- */
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  const cleanedCount = cleaned.size;
  const hasDoc = fileInfo !== null;

  return (
    <div
      className="flex min-h-screen flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget === null) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <div className="noise-layer" aria-hidden="true" />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      {/* ================= ÜST ÇUBUK ================= */}
      <header className="inklines sticky top-0 z-40 border-b-4 border-volt bg-ink text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-volt text-ink shadow-[3px_3px_0_rgba(255,255,255,0.18)]">
              <IconMarker className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-xl font-extrabold leading-none tracking-tight">
                VurguSil
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">
                PDF vurgu temizleyici
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isStandalone && (
              <button
                onClick={onInstall}
                className="btn-press focus-volt pop-in inline-flex items-center gap-2 rounded-lg border-2 border-volt bg-volt px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-ink shadow-[3px_3px_0_rgba(216,246,81,0.25)] hover:bg-voltdeep"
                title="Uygulama olarak yükle — tarayıcı kapansa bile kalır"
              >
                <IconInstall className="h-4 w-4" />
                <span className="hidden sm:inline">Uygulamayı Yükle</span>
                <span className="sm:hidden">Yükle</span>
              </button>
            )}
            {isStandalone && (
              <span className="hidden items-center gap-2 rounded-full border border-volt/50 bg-volt/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-volt md:inline-flex">
                <IconCheck className="h-3.5 w-3.5" />
                yüklü
              </span>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 font-mono text-[11px] text-white/70">
              <IconShield className="h-4 w-4 text-volt" />
              <span className="hidden sm:inline">dosyaların cihazında kalır</span>
              <span className="sm:hidden">%100 yerel</span>
            </span>
          </div>
        </div>
      </header>

      {/* ================= GÖVDE ================= */}
      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col lg:flex-row">
        <aside className="inklines order-2 w-full shrink-0 border-t-2 border-black/50 bg-ink2 text-white lg:order-1 lg:sticky lg:top-[70px] lg:h-[calc(100vh-70px)] lg:w-[340px] lg:overflow-y-auto lg:border-r-2 lg:border-t-0">
          <SettingsPanel
            fileInfo={fileInfo}
            settings={settings}
            onSettings={setSettingsState}
            onClean={() => pages.length && runCleanAll(pages)}
            onExport={onExport}
            onExportPngZip={onExportAllPng}
            exporting={exporting}
            job={job}
            cleanedCount={cleanedCount}
            stale={stale}
            onReset={onCloseDocument}
            onPickFile={() => fileInputRef.current?.click()}
            onLoadSample={onLoadSample}
          />
        </aside>

        <main className="dotgrid relative order-1 min-w-0 flex-1 lg:order-2">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="drift-a absolute -right-16 top-10 h-10 w-[380px] rounded-full bg-volt/30"
              style={{ transform: "rotate(-8deg)" }}
            />
            <div
              className="drift-b absolute -left-20 bottom-16 h-8 w-[300px] rounded-full bg-flare/20"
              style={{ transform: "rotate(6deg)" }}
            />
            <div
              className="drift-a absolute right-24 bottom-40 h-6 w-[220px] rounded-full bg-skyy/20"
              style={{ transform: "rotate(-4deg)", animationDelay: "-4s" }}
            />
          </div>

          {!hasDoc ? (
            <EmptyState
              onPick={() => fileInputRef.current?.click()}
              onSample={onLoadSample}
              onInstall={onInstall}
              isStandalone={isStandalone}
              isIOS={isIOS}
            />
          ) : (
            <div className="relative z-10 flex flex-col gap-5 p-4 lg:p-6">
              {/* kaldığın yerden devam */}
              {restoredSession && !loadingDoc && pages.length === 0 && (
                <div className="rise-in flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-volt/70 bg-volt/15 px-4 py-3">
                  <p className="text-[13px] font-semibold text-ink/80">
                    Son belgen bulundu: <strong>{restoredSession.name}</strong> — devam etmek ister misin?
                  </p>
                  <button
                    onClick={onResumeSession}
                    className="btn-press focus-volt inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-ink px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-volt"
                  >
                    <IconRefresh className="h-4 w-4" />
                    Devam et
                  </button>
                </div>
              )}

              {/* araç şeridi */}
              <div className="rise-in flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/60">
                  <span className="rounded-md border-2 border-ink/15 bg-sheet px-2.5 py-1">
                    {fileInfo!.pages} sayfa
                  </span>
                  <span className="rounded-md border-2 border-ink bg-ink px-2.5 py-1 text-volt">
                    {cleanedCount} temiz
                  </span>
                  {excluded.size > 0 && (
                    <span className="rounded-md border-2 border-flare/60 bg-flare/10 px-2.5 py-1 text-flare">
                      {excluded.size} hariç
                    </span>
                  )}
                  {loadingDoc && (
                    <span className="inline-flex items-center gap-1.5 text-ink/50">
                      <span className="blink-dot h-1.5 w-1.5 rounded-full bg-ink/60" />
                      işleniyor
                    </span>
                  )}
                </div>
                {cleanedCount > 0 && !job && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={onExportAllPng}
                      disabled={exporting}
                      className="btn-press focus-volt inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-sheet px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-wide text-ink shadow-[3px_3px_0_rgba(22,25,32,0.25)] hover:bg-white disabled:opacity-50"
                      title="Tüm temizlenmiş sayfaları 1500 DPI PNG olarak ZIP içinde indir"
                    >
                      <IconImage className="h-4 w-4" />
                      Tüm PNG'ler
                      <span className="rounded border border-ink/35 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest">
                        ZIP
                      </span>
                    </button>
                    <button
                      onClick={onExport}
                      disabled={exporting}
                      className="btn-press focus-volt inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-volt px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-wide text-ink shadow-[3px_3px_0_rgba(22,25,32,0.9)] hover:bg-voltdeep disabled:opacity-50"
                    >
                      <IconDownload className="h-4 w-4" />
                      {exporting ? "Hazırlanıyor…" : "Temiz PDF indir"}
                      <span className="rounded border border-ink/45 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest">
                        {deviceCaps().exportDpi} DPI
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* karşılaştırma görüntüleyici */}
              {selected !== null && viewer && (
                <div className="rise-in overflow-hidden rounded-xl border-2 border-ink bg-sheet shadow-[6px_7px_0_rgba(22,25,32,0.12)]">
                  <div className="h-[52vh] min-h-[420px]">
                    <CompareViewer
                      beforeSrc={viewer.before}
                      afterSrc={viewer.after}
                      imgWidth={viewer.w}
                      imgHeight={viewer.h}
                      mode={compareMode}
                      onMode={setCompareMode}
                      pageLabel={`Sayfa ${selected} — önce / sonra`}
                      onDownloadPng={onDownloadPng}
                    />
                  </div>
                </div>
              )}

              {/* sayfa ızgarası */}
              <section>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="h-[3px] w-6 rounded-full bg-flare" />
                  <h2 className="font-display text-lg font-bold tracking-tight">Tüm sayfalar</h2>
                  <span className="font-mono text-[11px] text-ink/45">
                    — karta tıkla, yukarıda karşılaştır
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5">
                  {pages.map((p, i) => (
                    <PageCard
                      key={p.num}
                      num={p.num}
                      index={i}
                      selected={selected === p.num}
                      cleaned={cleaned.has(p.num)}
                      included={!excluded.has(p.num)}
                      version={tick}
                      getDisplayCanvas={getDisplayCanvas}
                      onSelect={() => {
                        setSelected(p.num);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      onToggleIncluded={() => {
                        setExcluded((prev) => {
                          const nx = new Set(prev);
                          if (nx.has(p.num)) nx.delete(p.num);
                          else nx.add(p.num);
                          return nx;
                        });
                        setTick((t) => t + 1);
                      }}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* ================= GÜVENLİK BANDI ================= */}
      <footer className="inklines relative z-10 border-t-4 border-volt bg-ink text-white">
        <div className="mx-auto max-w-[1500px] px-4 py-8 lg:px-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight">
              <IconShield className="h-5 w-5 text-volt" />
              Güvenlik
            </p>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/35">
              paylaşılabilir · sunucusuz · açık davranış
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SecurityItem
              icon={<IconLock className="h-4 w-4" />}
              title="Dosyalar cihazından çıkmaz"
              desc="Uygulamanın sunucusu yok; PDF'ler yalnızca senin tarayıcında işlenir."
            />
            <SecurityItem
              icon={<IconShield className="h-4 w-4" />}
              title="Kum havuzunda işleme"
              desc="PDF'ler yalıtılmış worker'da açılır; girişler yüklenmeden doğrulanır."
            />
            <SecurityItem
              icon={<IconOffline className="h-4 w-4" />}
              title="Çevrimdışı çalışır"
              desc="Bir kez açıldıktan sonra internet olmasa da PDF temizlemeye devam eder."
            />
            <SecurityItem
              icon={<IconCheck className="h-4 w-4" />}
              title="Temiz indirme"
              desc="Çıktı adları arındırılır, orijinal belge asla değişmez."
            />
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2 px-4 py-3.5 lg:px-6">
            <p className="font-mono text-[11px] text-white/40">
              pdf.js + pdf-lib ile · VurguSil — tüm işlem tarayıcında gerçekleşir.
            </p>
          </div>
        </div>
      </footer>

      {/* ================= SÜRÜKLEME PERDESİ ================= */}
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6">
          <div className="flex flex-col items-center gap-4 rounded-2xl border-4 border-dashed border-volt bg-ink2 px-12 py-10 text-center">
            <IconMarker className="h-12 w-12 text-volt" />
            <p className="font-display text-3xl font-extrabold text-white">Bırak, temizlensin</p>
            <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-white/50">
              pdf dosyasını buraya bırak
            </p>
          </div>
        </div>
      )}

      {/* ================= YÜKLEME REHBERİ ================= */}
      <InstallGuide
        open={installGuideOpen && !isStandalone}
        onClose={() => setInstallGuideOpen(false)}
        onNativePrompt={installEvt ? onNativeInstall : null}
        isIOS={isIOS}
        isAndroid={isAndroid}
      />

      {/* ================= BİLDİRİM ================= */}
      {toast && (
        <div
          className={`toast-in fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border-2 px-4 py-3 shadow-[4px_5px_0_rgba(22,25,32,0.85)] ${
            toast.kind === "ok" ? "border-ink bg-ink text-white" : "border-flare bg-flare text-white"
          }`}
          role="status"
        >
          {toast.kind === "ok" ? (
            <IconCheck className="h-5 w-5 text-volt" />
          ) : (
            <IconX className="h-5 w-5" />
          )}
          <span className="max-w-[70vw] text-[13px] font-semibold">{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-white/60 transition-colors hover:text-white"
            aria-label="Bildirimi kapat"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ================= BOŞ DURUM ================= */

function EmptyState({
  onPick,
  onSample,
  onInstall,
  isStandalone,
  isIOS,
}: {
  onPick: () => void;
  onSample: () => void;
  onInstall: () => void;
  isStandalone: boolean;
  isIOS: boolean;
}) {
  return (
    <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-16">
      <div className="card-in">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-ink/15 bg-sheet px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-ink/60">
          <IconSpark className="h-3.5 w-3.5 text-ink" />
          fosforlu kalem izi · gri bant · renk lekesi
        </p>
        <h1 className="font-display text-[42px] font-extrabold leading-[1.02] tracking-tight text-ink sm:text-6xl">
          Vurgular silinsin,
          <br />
          sayfa{" "}
          <span className="relative inline-block px-1">
            <span
              className="swipe-draw absolute inset-x-0 bottom-1 -z-0 h-[0.55em] rounded-sm bg-volt"
              aria-hidden="true"
            />
            <span className="relative z-10">tertemiz</span>
          </span>{" "}
          kalsın.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink/70 sm:text-base">
          Bazı PDF'lerde vurgular gerçek birer not değil, sayfaya yapışmış renk katmanlarıdır —
          tıklayınca seçilmez, silinmez. <strong>VurguSil</strong> bu izleri piksel düzeyinde
          tanır, mürekkebe dokunmadan kağıt beyazına geri çeker. Sonucu kaydırmalı
          karşılaştırmayla gör, tek tıkla temiz PDF olarak indir.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            onClick={onPick}
            className="btn-press focus-volt inline-flex items-center gap-2.5 rounded-xl border-2 border-ink bg-volt px-6 py-3.5 font-display text-[15px] font-bold uppercase tracking-wide text-ink shadow-[5px_6px_0_rgba(22,25,32,0.9)] hover:bg-voltdeep"
          >
            <IconFile className="h-5 w-5" />
            PDF Seç
          </button>
          <button
            onClick={onSample}
            className="btn-press focus-volt inline-flex items-center gap-2.5 rounded-xl border-2 border-ink bg-sheet px-5 py-3.5 text-[14px] font-bold text-ink shadow-[5px_6px_0_rgba(22,25,32,0.18)] hover:bg-white"
          >
            <IconWand className="h-5 w-5 text-flare" />
            Örnek dosyayı dene
          </button>
        </div>

        <ul className="mt-8 flex flex-wrap gap-x-7 gap-y-2.5">
          {(
            [
              [IconShield, "dosya cihazından çıkmaz"],
              [IconRefresh, "orijinal asla bozulmaz"],
              [IconCompare, "önce / sonra karşılaştır"],
            ] as const
          ).map(([I, t]) => (
            <li key={t} className="flex items-center gap-2 font-mono text-[12px] text-ink/60">
              <I className="h-4 w-4 text-ink/45" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* sağ: yaşayan kağıt */}
      <div
        className="card-in relative mx-auto w-full max-w-[430px]"
        style={{ "--d": "120ms" } as React.CSSProperties}
      >
        <div
          className="absolute inset-0 translate-x-4 translate-y-5 rotate-3 rounded-lg border-2 border-ink/25 bg-white/60"
          aria-hidden="true"
        />
        <div
          onClick={onPick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onPick()}
          className="focus-volt group relative cursor-pointer rounded-lg border-2 border-ink bg-white p-6 shadow-[8px_10px_0_rgba(22,25,32,0.14)] transition-transform duration-300 hover:-rotate-1 hover:shadow-[10px_13px_0_rgba(22,25,32,0.18)] sm:p-8"
        >
          <div className="mb-5 flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-ink/40">
              rapor-q3.pdf
            </span>
            <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-volt">
              örnek sayfa
            </span>
          </div>

          <div className="space-y-[13px]">
            <div className="h-3.5 w-3/4 rounded-sm bg-ink/85" />
            <FakeLine w="100%" hl="bg-volt/80" delay="0s" />
            <FakeLine w="88%" />
            <FakeLine w="94%" hl="bg-flare/70" delay="0.7s" />
            <div className="!my-4 h-9 rounded-sm bg-ink/8 px-2.5 py-2">
              <div className="h-2 w-2/3 rounded-sm bg-ink/25" />
            </div>
            <FakeLine w="91%" />
            <FakeLine w="97%" hl="bg-[#8be39a]/80" delay="1.4s" />
            <FakeLine w="70%" />
            <FakeLine w="84%" hl="bg-volt/80" delay="2.1s" />
          </div>

          <div
            className="pointer-events-none absolute left-6 top-[92px] text-ink"
            style={{ "--glide": "230px" } as React.CSSProperties}
          >
            <div className="marker-glide">
              <svg
                viewBox="0 0 48 48"
                className="h-9 w-9 -rotate-12 drop-shadow-[2px_3px_0_rgba(22,25,32,0.25)]"
              >
                <path
                  d="M8 40 26 22l6 6L14 46H8v-6Z"
                  fill="#d8f651"
                  stroke="#161920"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
                <path
                  d="m29 19 4-4a3 3 0 0 1 4.2 4.2l-4 4"
                  fill="#ff5ca8"
                  stroke="#161920"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between rounded-lg border-2 border-dashed border-ink/25 bg-paper/70 px-4 py-3 transition-colors group-hover:border-ink/50">
            <span className="text-[13px] font-semibold text-ink/70">Dosyayı buraya sürükle</span>
            <IconArrow className="h-5 w-5 text-ink/40 transition-transform group-hover:translate-x-1 group-hover:text-ink" />
          </div>
        </div>

        <span className="absolute -left-4 -top-4 rotate-[-6deg] rounded-lg border-2 border-ink bg-flare px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-white shadow-[3px_3px_0_rgba(22,25,32,0.9)]">
          önce
        </span>
        <span className="absolute -bottom-4 -right-3 rotate-[4deg] rounded-lg border-2 border-ink bg-volt px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-ink shadow-[3px_3px_0_rgba(22,25,32,0.9)]">
          sonra
        </span>
      </div>

      {/* kurulum kartı + adım şeridi */}
      <div className="card-in lg:col-span-2" style={{ "--d": "240ms" } as React.CSSProperties}>
        {!isStandalone && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink bg-ink px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-volt text-ink">
                <IconInstall className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-[15px] font-extrabold leading-tight">
                  Uygulama olarak yükle — tarayıcı kapansa bile kalır
                </p>
                <p className="text-[11.5px] text-white/55">
                  {isIOS
                    ? "Paylaş simgesi → “Ana Ekrana Ekle” ile kurabilirsin."
                    : "Kendi penceresinde açılır, çevrimdışı çalışır, telefonundan devam edersin."}
                </p>
              </div>
            </div>
            <button
              onClick={onInstall}
              className="btn-press focus-volt inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wide text-volt shadow-[3px_3px_0_rgba(22,25,32,0.35)] hover:bg-ink3 ring-2 ring-volt"
              title="Uygulama olarak yükle — tarayıcı kapansa bile kalır"
            >
              <IconInstall className="h-4 w-4" />
              Yükle
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 border-ink/12 bg-sheet/80 px-5 py-4">
          <span className="mr-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink/45">
            Nasıl çalışır
          </span>
          {[
            ["01", "PDF'i yükle"],
            ["02", "rengi ve gücü ayarla"],
            ["03", "tek tıkla temizle"],
            ["04", "temiz PDF'i indir"],
          ].map(([n, t], i) => (
            <span key={n} className="flex items-center gap-3">
              <span className="flex items-baseline gap-2 text-[13px] font-semibold text-ink/80">
                <span className="relative font-mono text-[12px] font-bold text-ink">
                  <span
                    className="absolute -bottom-0.5 left-0 h-[5px] w-full rounded-sm bg-volt/90"
                    aria-hidden="true"
                  />
                  <span className="relative">{n}</span>
                </span>
                {t}
              </span>
              {i < 3 && <IconArrow className="h-4 w-4 text-ink/30" />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FakeLine({ w, hl, delay }: { w: string; hl?: string; delay?: string }) {
  return (
    <div className="relative flex items-center">
      {hl && (
        <span
          className={`swipe-draw absolute -inset-y-[2.5px] left-1 w-[62%] rounded-sm ${hl}`}
          style={{ animationDelay: delay }}
          aria-hidden="true"
        />
      )}
      <div className="relative h-[9px] rounded-sm bg-ink/30" style={{ width: w }} />
    </div>
  );
}

function SecurityItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 transition-colors hover:border-volt/40">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-volt/15 text-volt">
        {icon}
      </span>
      <div>
        <p className="text-[12.5px] font-bold text-white">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-white/45">{desc}</p>
      </div>
    </div>
  );
}
