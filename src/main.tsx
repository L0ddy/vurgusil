import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

// pdf.js v6 Promise.withResolvers gerektiriyor — eski tarayıcılar için tamamla
const P = Promise as typeof Promise & {
  withResolvers?: <T>() => {
    promise: Promise<T>;
    resolve: (v: T) => void;
    reject: (r?: unknown) => void;
  };
};
if (typeof P.withResolvers !== "function") {
  P.withResolvers = function <T>() {
    let resolve!: (v: T) => void;
    let reject!: (r?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

/* PWA: service worker — kalıcı önbellek ve tam çevrimdışı çalışma. */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker
      .register(base + "sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const sendShell = () => {
          try {
            const urls = performance
              .getEntriesByType("resource")
              .map((r) => r.name)
              .filter(
                (u) =>
                  u.startsWith(location.origin) ||
                  /fonts\.(googleapis|gstatic)\.com/.test(u)
              );
            reg.active?.postMessage({ type: "PRECACHE_SHELL", urls });
          } catch {
            /* yoksay */
          }
        };
        setTimeout(sendShell, 1500);

        // Tembel PDF/ZIP modüllerini ısıt → çevrimdışı için önbelleklenir
        const warm = () => {
          void import("pdfjs-dist");
          void import("jszip");
        };
        const w = window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
        };
        if (typeof w.requestIdleCallback === "function") {
          w.requestIdleCallback(warm, { timeout: 6000 });
        } else {
          setTimeout(warm, 3500);
        }
      })
      .catch(() => {
        /* SW kaydı başarısız olsa da uygulama normal çalışır */
      });
  });
}

// Başlangıç bekçisini sustur — uygulama başarıyla kuruluyor
window.__VURGUSIL_MOUNTED__ = true;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
