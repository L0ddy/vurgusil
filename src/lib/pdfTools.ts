import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PDFDocument as PdfLibDocument, RGB } from "pdf-lib";

/* ---------- tembel PDF motoru ----------
 * pdf.js yalnızca bir belge açıldığında yüklenir; worker adresi her zaman
 * string döndüren new URL(...) deseniyle üretilir. Motor yüklenemezse
 * uygulama beyaz ekran vermez — yalnızca PDF işlemleri hata mesajı döner. */

const PDFJS_VERSION = "6.2.108";
const CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

type PdfJsModule = typeof import("pdfjs-dist");
let pdfJsPromise: Promise<PdfJsModule> | null = null;

async function ensurePdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((mod) => {
      const workerUrl = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).href;
      mod.GlobalWorkerOptions.workerSrc = workerUrl;
      return mod;
    });
    pdfJsPromise.catch(() => {
      pdfJsPromise = null; // sonraki denemede yeniden yükle
    });
  }
  return pdfJsPromise;
}

let pdfLibPromise: Promise<typeof import("pdf-lib")> | null = null;
async function ensurePdfLib() {
  if (!pdfLibPromise) {
    pdfLibPromise = import("pdf-lib");
    pdfLibPromise.catch(() => {
      pdfLibPromise = null;
    });
  }
  return pdfLibPromise;
}

/* ---------- giriş doğrulama (güvenlik + DoS koruması) ---------- */

export const MAX_FILE_BYTES = 300 * 1024 * 1024; // 300 MB
export const MAX_PAGES = 300;

export class PdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfValidationError";
  }
}

/** Dosya pdf.js'e verilmeden ÖNCE imza + boyut denetimi */
export function assertSafePdf(bytes: Uint8Array): void {
  if (bytes.length === 0) throw new PdfValidationError("Dosya boş.");
  if (bytes.length > MAX_FILE_BYTES) {
    throw new PdfValidationError("Dosya çok büyük (en fazla 300 MB).");
  }
  // %PDF- imzası (ilk 1024 bayt içinde olabilir)
  const head = bytes.subarray(0, Math.min(1024, bytes.length));
  let ok = false;
  for (let i = 0; i < head.length - 4; i++) {
    if (
      head[i] === 0x25 &&
      head[i + 1] === 0x50 &&
      head[i + 2] === 0x44 &&
      head[i + 3] === 0x46 &&
      head[i + 4] === 0x2d
    ) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new PdfValidationError("Bu dosya geçerli bir PDF değil.");
}

/* ---------- belge açma ---------- */

export async function openPdf(
  data: ArrayBuffer | Uint8Array
): Promise<PDFDocumentProxy> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const pdfjs = await ensurePdfJs();
  const task = pdfjs.getDocument({
    data: bytes,
    wasmUrl: `${CDN}/wasm/`,
    cMapUrl: `${CDN}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${CDN}/standard_fonts/`,
  });
  return await task.promise;
}

/* ---------- cihaz algılama ve tuval sınırları ---------- */

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  widthPt: number;
  heightPt: number;
  /** Sayfanın gerçekten çizildiği çözünürlük (cihaz sınırına takılmış olabilir) */
  effectiveDpi?: number;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touch = (navigator.maxTouchPoints || 0) > 1;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (touch && /Macintosh/i.test(ua)) // iPad, masaüstü UA bildirir
  );
}

export interface DeviceCaps {
  mobile: boolean;
  maxDim: number;
  maxArea: number;
  exportDpi: number;
  previewWidth: number;
}

/*
 * Tuval sınırları tarayıcıya göre değişir (iOS Safari ~16,7 MP,
 * Android/masaüstü çoğunlukla 100–440 MP). Hedef her cihazda 1500 DPI;
 * sınır ÇALIŞMA ANINDA ölçülür, desteklenmiyorsa zarifçe inilir.
 */

/** Kenar uzunluğu sınırını ikili aramayla ölçer (px). */
function probeMaxDim(): number {
  let lo = 8192;
  let hi = 32767;
  const test = (n: number): boolean => {
    try {
      const c = document.createElement("canvas");
      c.width = n;
      c.height = 1;
      const ok = c.width === n && c.getContext("2d") !== null;
      c.width = 0;
      c.height = 0;
      return ok;
    } catch {
      return false;
    }
  };
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (test(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Toplam piksel alanı sınırını ikili aramayla ölçer. */
function probeMaxArea(maxDim: number): number {
  const dimCap = Math.min(maxDim, 17320); // √300M ≈ 17320 — A4 1500 DPI sığar
  let lo = 12_000_000;
  let hi = Math.min(dimCap * dimCap, 300_000_000);
  const test = (area: number): boolean => {
    const w = Math.min(maxDim, Math.round(Math.sqrt(area)));
    const h = Math.min(maxDim, Math.floor(area / w));
    try {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ok = c.width === w && c.height === h && c.getContext("2d") !== null;
      c.width = 0;
      c.height = 0;
      return ok;
    } catch {
      return false;
    }
  };
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (test(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

let capsCache: DeviceCaps | null = null;

export function deviceCaps(): DeviceCaps {
  if (capsCache) return capsCache;
  const mobile = isMobileDevice();
  let maxDim: number;
  let maxArea: number;
  try {
    maxDim = Math.min(probeMaxDim() - 64, 20000); // A4 1500 DPI: 17536 px kenar
    maxArea = Math.floor(probeMaxArea(maxDim) * 0.92); // güvenlik payı
  } catch {
    // Ölçüm başarısızsa aşırı muhafazakâr değerler
    maxDim = mobile ? 4000 : 16000;
    maxArea = mobile ? 14_000_000 : 200_000_000;
  }
  capsCache = {
    mobile,
    maxDim,
    maxArea,
    exportDpi: 1500, // hedef her cihazda aynı; fit() sınıra oturtur
    previewWidth: mobile ? 820 : 1200,
  };
  return capsCache;
}

/* ---------- çizim ---------- */

export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  targetWidth?: number
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const width = targetWidth ?? deviceCaps().previewWidth;

  const attempt = async (scale: number): Promise<RenderedPage> => {
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D desteklenmiyor");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvas,
      canvasContext: ctx,
      viewport: vp,
      background: "#ffffff",
    } as never).promise;
    return { canvas, widthPt: base.width, heightPt: base.height };
  };

  // Ağır sayfa çizilemezse (mobil bellek sınırı) yarı ölçekle yeniden dene
  let scale = Math.min(width / base.width, 3.2);
  let lastErr: unknown = null;
  for (let tries = 0; tries < 3; tries++) {
    try {
      const out = await attempt(scale);
      page.cleanup();
      return out;
    } catch (e) {
      lastErr = e;
      scale = Math.max(0.55, scale / 2);
    }
  }
  page.cleanup();
  throw lastErr instanceof Error ? lastErr : new Error("Sayfa çizilemedi");
}

/* ---------- yüksek çözünürlüklü dışa aktarım ----------
 * Hedef her cihazda 1500 DPI (A4 ≈ 12.401 × 17.536 px ≈ 217 MP).
 * Tarayıcı tuvali bu boyutu desteklemiyorsa ölçülen sınıra otomatik
 * inilir — "out of bounds" çökmesi yaşanmaz, gerçek DPI bildirilir. */

export async function renderPageAtDpi(
  doc: PDFDocumentProxy,
  pageNumber: number,
  dpi?: number
): Promise<RenderedPage> {
  const caps = deviceCaps();
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });

  // Tuval sınırlarına sığdıran ölçek hesabı (1 inç = 72 pt)
  const fit = (s: number): number => {
    if (base.width * base.height * s * s > caps.maxArea) {
      s = Math.sqrt(caps.maxArea / (base.width * base.height));
    }
    if (base.width * s > caps.maxDim) s = caps.maxDim / base.width;
    if (base.height * s > caps.maxDim) s = caps.maxDim / base.height;
    return s;
  };

  const attempt = async (s: number): Promise<RenderedPage> => {
    const vp = page.getViewport({ scale: s });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D desteklenmiyor");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvas,
      canvasContext: ctx,
      viewport: vp,
      background: "#ffffff",
    } as never).promise;
    return {
      canvas,
      widthPt: base.width,
      heightPt: base.height,
      effectiveDpi: Math.round(s * 72),
    };
  };

  // Kademeli küçültme: hedef → yarısı → 300 → 150 DPI.
  const target = fit((dpi ?? caps.exportDpi) / 72);
  const ladder = [target, fit(target / 2), fit(300 / 72), fit(150 / 72)]
    .sort((a, b) => b - a)
    .filter((s, i, arr) => i === 0 || arr[i - 1] - s > 0.05);
  let lastErr: unknown = null;
  for (const s of ladder) {
    try {
      const out = await attempt(s);
      page.cleanup();
      return out;
    } catch (e) {
      lastErr = e;
    }
  }
  page.cleanup();
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Sayfa yüksek çözünürlükte çizilemedi");
}

/* ---------- yardımcılar ---------- */

export function disposeCanvas(c: HTMLCanvasElement): void {
  c.width = 0;
  c.height = 0;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ---------- dışa aktarma ----------
 * Mobil uyumluluk: base64 (toDataURL) yerine doğrudan bayt üretiyoruz —
 * base64 belleği %33 şişirir ve iOS'ta büyük tuvallerde toDataURL hata
 * fırlatır. toBlob → ArrayBuffer zinciri her tarayıcıda güvenilirdir. */

export interface ExportPage {
  widthPt: number;
  heightPt: number;
  /** Ham JPEG baytları */
  bytes: Uint8Array;
}

export async function buildCleanedPdf(pages: ExportPage[]): Promise<Blob> {
  const pdfLib = await ensurePdfLib();
  const doc: PdfLibDocument = await pdfLib.PDFDocument.create();
  for (const p of pages) {
    const img = await doc.embedJpg(p.bytes);
    const page = doc.addPage([p.widthPt, p.heightPt]);
    page.drawImage(img, { x: 0, y: 0, width: p.widthPt, height: p.heightPt });
  }
  const bytes = await doc.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG oluşturulamadı"));
    }, "image/png");
  });
}

export function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality = 0.9
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("JPEG oluşturulamadı"));
      },
      "image/jpeg",
      quality
    );
  });
}

export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * İndirilecek dosya adını temizler: yol ayracı, denetim karakteri ve
 * tehlikeli uzantılar kaldırılır; uzunluk sınırlandırılır.
 */
export function safeFileName(raw: string, fallback = "belge"): string {
  let name = raw
    .normalize("NFC")
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\.(exe|bat|cmd|js|mjs|html|svg|scr|pif)$/i, "_$1")
    .replace(/_{2,}/g, "_")
    .trim()
    .slice(0, 120);
  if (!name || name === "." || name === "..") name = fallback;
  return name;
}

/**
 * Dosyayı mobil-uyumlu indirir:
 *  1) iOS / PWA: sistem paylaşım sayfası (kullanıcı "Dosyalara Kaydet" der)
 *     — iOS'ta büyük Blob'ların doğrudan indirmesi güvenilmez olduğu için.
 *  2) Diğer tarayıcılar: klasik `download` nitelikli bağlantı.
 *  3) Son çare: yeni sekmede aç.
 * Kullanıcı paylaşımı iptal ederse hata sayılmaz. Sonuç: true/false.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<boolean> {
  const name = safeFileName(filename);
  try {
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
      standalone?: boolean;
    };
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone =
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      nav.standalone === true;

    // 1) iOS ve PWA kurulumlarında paylaşım sayfası en güvenilir yoldur
    if ((isIOSDevice || standalone) && nav.canShare && nav.share) {
      const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
      if (nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: name });
          return true;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return true; // iptal
          // paylaşım çalışmadı → klasik indirmeye düş
        }
      }
    }

    // 2) Klasik indirme
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000); // belleği geri ver
      return true;
    } catch {
      // 3) Son çare: yeni sekmede aç (kullanıcı oradan kaydedebilir)
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    }
  } catch {
    return false;
  }
}

/* ---------- örnek PDF üretici ---------- */

export async function makeSamplePdf(): Promise<Uint8Array> {
  const pdfLib = await ensurePdfLib();
  const doc = await pdfLib.PDFDocument.create();
  const font = await doc.embedFont(pdfLib.StandardFonts.Helvetica);
  const bold = await doc.embedFont(pdfLib.StandardFonts.HelveticaBold);

  const page = doc.addPage([595, 842]);
  const ink = pdfLib.rgb(0.1, 0.11, 0.13);
  const gray = pdfLib.rgb(0.5, 0.52, 0.55);

  const hl = (text: string, color: RGB, opacity: number, size = 11) => {
    const w = font.widthOfTextAtSize(text, size);
    return { text, w, color, opacity, size };
  };

  page.drawText("Q3 Satis Raporu — Taslak", {
    x: 50,
    y: 780,
    size: 22,
    font: bold,
    color: ink,
  });
  page.drawText("Bu belge, fosforlu kalem izi tasiyan ornek bir sayfadir.", {
    x: 50,
    y: 752,
    size: 11,
    font,
    color: gray,
  });

  const lines = [
    hl("Toplam gelir gecen ceyrege gore %18 artti.", pdfLib.rgb(1, 0.92, 0.35), 0.85),
    hl("Yeni musteri sayisi 1.240 olarak gerceklesti.", pdfLib.rgb(1, 0.62, 0.78), 0.8),
    hl("Iade orani %2,1 seviyesinde kaldi.", pdfLib.rgb(0.55, 0.93, 0.6), 0.8),
    hl("Pazarlama harcamalari butcenin altinda.", pdfLib.rgb(1, 0.92, 0.35), 0.85),
  ];

  let y = 700;
  lines.forEach((l) => {
    page.drawRectangle({
      x: 48,
      y: y - 4,
      width: l.w + 8,
      height: l.size + 8,
      color: l.color,
      opacity: l.opacity,
    });
    page.drawText(l.text, { x: 52, y, size: l.size, font, color: ink });
    y -= 34;
  });

  // Gri tarama bandi
  page.drawRectangle({
    x: 48,
    y: 560,
    width: 499,
    height: 44,
    color: pdfLib.rgb(0.86, 0.86, 0.87),
    opacity: 1,
  });
  page.drawText("Not: Bu bant, tarama belgelerinde sik gorulen gri zemin lekesidir.", {
    x: 56,
    y: 578,
    size: 10,
    font,
    color: ink,
  });

  y = 520;
  const plain = [
    "Bolge bazinda satislarin tamami hedefin uzerinde kapandi.",
    "Ege bolgesi yillik bazda en yuksek buyumeyi kaydetti.",
    "Stok devir hizi 4,2 ay olarak olculdu.",
    "Tahsilat suresi ortalamasi 31 gune geriledi.",
    "Doviz kuru etkisi marjlari 1,4 puan asagi cekti.",
  ];
  plain.forEach((t) => {
    page.drawText(t, { x: 50, y, size: 11, font, color: ink });
    y -= 26;
  });

  page.drawText("VurguSil ile temizlendiginde renkli izler kaybolur, metin ayni kalir.", {
    x: 50,
    y: 80,
    size: 10,
    font,
    color: gray,
  });

  const bytes = await doc.save();
  return bytes;
}
