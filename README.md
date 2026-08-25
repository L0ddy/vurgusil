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

## Yerel çalıştırma

```bash
npm install
npm run dev        # geliştirme
npm run build      # üretim derlemesi → dist/
```

## GitHub Pages'e yayınlama

1. GitHub'da yeni bir **public** depo oluştur (örn. `vurgusil`), içine hiçbir şey ekleme.
2. Projeyi gönder (bu klasörde terminal):

   ```bash
   git init
   git add .
   git commit -m "VurguSil"
   git branch -M main
   git remote add origin https://github.com/KULLANICIADI/vurgusil.git
   git push -u origin main
   ```

3. Depo → **Settings → Pages** → Source: **GitHub Actions**.
4. Adresin hazır: `https://KULLANICIADI.github.io/vurgusil/`

Workflow (`.github/workflows/deploy.yml`) her push'ta `--base=./` ile derleyip
yayınladığı için depo adı fark etmeksizin tüm yollar (manifest, ikonlar, service
worker) doğru çalışır. Pages kapalıysa iş akışı kendiliğinden açar
(`enablement: true`); dosyalar bir alt klasöre yuvalanmışsa köke otomatik taşır.

## Teknoloji

React + Vite + Tailwind v4 · pdf.js (çizim) · pdf-lib (PDF yazma) · JSZip (PNG arşivi)
