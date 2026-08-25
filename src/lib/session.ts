import type { CleanSettings } from "./cleaner";
import { DEFAULT_SETTINGS } from "./cleaner";

/*
 * KALICILIK KATMANI — tarayıcı kapansa bile çalışma kaybolmasın:
 *  - Son yüklenen PDF → IndexedDB
 *  - Temizleme ayarları → localStorage
 */

export interface StoredSession {
  name: string;
  size: number;
  bytes: Uint8Array;
  ts: number;
}

const DB_NAME = "vurgusil";
const STORE = "kv";
const SESSION_KEY = "last-session";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB yok"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB açılamadı"));
  });
}

export async function saveSession(
  name: string,
  size: number,
  bytes: Uint8Array
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(
        { name, size, bytes, ts: Date.now() } satisfies StoredSession,
        SESSION_KEY
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("yazılamadı"));
    });
    db.close();
  } catch {
    /* kota dolu / gizli mod — sessizce geç */
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const db = await openDb();
    const value = await new Promise<StoredSession | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(SESSION_KEY);
      req.onsuccess = () => resolve((req.result as StoredSession) ?? null);
      req.onerror = () => reject(req.error ?? new Error("okunamadı"));
    });
    db.close();
    return value && value.bytes ? value : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("silinemedi"));
    });
    db.close();
  } catch {
    /* yoksay */
  }
}

const SETTINGS_KEY = "vurgusil:settings";

export function saveSettings(s: CleanSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* yoksay */
  }
}

export function loadSettings(): CleanSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CleanSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      hues: { ...DEFAULT_SETTINGS.hues, ...(parsed.hues ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
