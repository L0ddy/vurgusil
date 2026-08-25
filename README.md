# VurguSil — PDF Vurgu Temizleyici

PDF'lerde **highlight annotasyonu olmayan ama vurgu gibi görünen** renk katmanlarını
(fosforlu kalem izleri, gri tarama bantları, renk lekeleri) piksel düzeyinde tanıyıp
temizleyen, tamamen **tarayıcı içinde** çalışan bir web uygulaması.

- Dosyalar **hiçbir sunucuya gönderilmez** — tüm işlem cihazda gerçekleşir.
- Hedef dışa aktarım çözünürlüğü **1500 DPI** (PC + mobil); cihaz tuvali desteklemiyorsa
  ölçülen en yüksek çözünürlüğe otomatik inilir, gerçek değer bildirilir.
- Çıktı: **Temiz PDF** veya tüm sayfaların **kayıpsız PNG arşivi (ZIP)**.
- **PWA**: telefona/PC'ye uygulama olarak yüklenebilir, çevrimdışı çalışır,
  son belgeyi hatırlar ("kaldığın yerden devam et").


## Teknoloji

React + Vite + Tailwind v4 · pdf.js (çizim) · pdf-lib (PDF yazma) · JSZip (PNG arşivi)
