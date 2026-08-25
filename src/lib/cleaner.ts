export interface CleanSettings {
  /** 0-100 — soluk izleri de yakalama eşiği */
  sensitivity: number;
  /** 40-100 — silme gücü */
  strength: number;
  hues: {
    yellow: boolean;
    orange: boolean;
    pink: boolean;
    green: boolean;
    blue: boolean;
  };
  /** Açık gri zemin bantlarını beyaza çek */
  whiten: boolean;
  /** Koyu ve renkli metinleri koru */
  protectDark: boolean;
}

export const DEFAULT_SETTINGS: CleanSettings = {
  sensitivity: 62,
  strength: 90,
  hues: { yellow: true, orange: true, pink: true, green: true, blue: false },
  whiten: true,
  protectDark: true,
};

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

function hueEnabled(h: number, hues: CleanSettings["hues"]): boolean {
  if (hues.pink && (h >= 285 || h < 12)) return true;
  if (hues.orange && h >= 12 && h < 42) return true;
  if (hues.yellow && h >= 42 && h < 72) return true;
  if (hues.green && h >= 72 && h < 165) return true;
  if (hues.blue && h >= 185 && h < 285) return true;
  return false;
}

/**
 * Görüntü verisini yerinde (in-place) temizler.
 * Fosforlu kalem izlerinin asıl imzası DOYGUNLUKTUR: metin mürekkebi düşük
 * doygunluklu ve koyudur; vurgu boyası ise ne kadar soluk görünürse görünsün
 * HSL düzleminde yüksek doygunluğa sahiptir. Maske doygunluk üzerinden
 * sürülür — ışıklılık yalnızca koyu mürekkebi korumak için bariyerdir.
 */
export function cleanImageData(
  data: Uint8ClampedArray,
  settings: CleanSettings
): void {
  const sens = settings.sensitivity / 100;
  const k = settings.strength / 100;
  const satFloor = 0.2 - sens * 0.16;
  const protectLum = settings.protectDark ? 0.44 : 0.26;
  const whiten = settings.whiten;
  const hues = settings.hues;
  const hardSkip = protectLum * 0.8;
  const satStart = satFloor * 0.55;

  const n = data.length;
  for (let i = 0; i < n; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = r >= g ? (r >= b ? r : b) : g >= b ? g : b;
    const min = r <= g ? (r <= b ? r : b) : g <= b ? g : b;
    const l = (max + min) / 2;

    if (l < hardSkip) continue;

    const d = max - min;
    let sat = 0;
    let hue = 0;
    if (d > 0) {
      sat = d / (1 - Math.abs(2 * l - 1));
      if (max === r) hue = (((g - b) / d) % 6) * 60;
      else if (max === g) hue = ((b - r) / d + 2) * 60;
      else hue = ((r - g) / d + 4) * 60;
      hue = (hue + 360) % 360;
    }

    let newL = l;
    let newSat = sat;
    let touched = false;

    if (d > 0 && sat > satStart && hueEnabled(hue, hues)) {
      const satF = smooth((sat - satStart) / (0.85 - satStart));
      const guard = smooth((l - protectLum) / 0.15);
      const mask = Math.min(1, satF * guard * k * 1.4);
      if (mask > 0.02) {
        newSat = sat * Math.max(0, 1 - mask * 1.3);
        newL = l + (0.998 - l) * mask;
        touched = true;
      }
    }

    if (whiten && sat < 0.12 && l > 0.6 && l < 0.996) {
      const pull = smooth((l - 0.6) / 0.38) * 0.88 * k;
      const cand = l + (0.998 - l) * pull;
      if (cand > newL) {
        newL = cand;
        newSat = sat * (1 - pull * 0.6);
        touched = true;
      }
    }

    if (!touched) continue;

    const [nr, ng, nb] = hslToRgb(hue, newSat, newL);
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

/** Bir tuvali ayarlara göre temizleyip yeni bir tuval döndürür. */
export function cleanCanvas(
  src: HTMLCanvasElement,
  settings: CleanSettings
): HTMLCanvasElement {
  const ctx = src.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, src.width, src.height);
  cleanImageData(img.data, settings);
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  out.getContext("2d")!.putImageData(img, 0, 0);
  return out;
}
