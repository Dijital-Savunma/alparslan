# Alparslan

[![Lisans: MIT](https://img.shields.io/badge/Lisans-MIT-blue?style=flat-square)](LICENSE)
[![Dijital Savunma](https://img.shields.io/badge/Dijital_Savunma-Açık_Kaynak-red?style=flat-square)](https://github.com/Dijital-Savunma)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web_Store-yellow?style=flat-square)](#)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox-Add--ons-orange?style=flat-square)](#)

> Güvenli tarayıcı eklentisi. Phishing ve dolandırıcılığa karşı en pratik kalkan.

---

## Nedir?

**Alparslan**, kullanıcıları phishing siteleri, dolandırıcılık girişimleri ve zararlı web sayfalarına karşı koruyan bir tarayıcı eklentisidir. Özellikle Türkiye'deki kullanıcıları hedefleyen tehditlere karşı geliştirilmiştir.

Adını Anadolu'nun kapılarını açan Sultan Alparslan'dan alır — dijital dünyanın kapılarını güvenle açar.

## Özellikler

- **Phishing Koruması** — Sahte banka, e-devlet, kargo siteleri tespiti
- **Dolandırıcılık Engelleme** — Bilinen dolandırıcılık sitelerini anında engelleme
- **Türkçe Tehdit Veritabanı** — Türkiye'ye özgü phishing ve scam sitelerinin listesi
- **Gizlilik Koruması** — İzleyici (tracker) engelleme
- **Güvenli Bağlantı Kontrolü** — Tıklamadan önce linkin güvenilirliğini gösterme
- **Gerçek Zamanlı Uyarı** — Tehlikeli siteye girerken anlık bildirim
- **Hafif** — Tarayıcıyı yavaşlatmaz

## Desteklenen Tarayıcılar

| Tarayıcı | Manifest | Durum |
|-----------|----------|-------|
| Google Chrome / Chromium | v3 | Destekleniyor |
| Mozilla Firefox | v2 | Destekleniyor |
| Microsoft Edge | v3 | Destekleniyor |
| Brave | v3 | Destekleniyor |
| Opera | v3 | Destekleniyor |

## Kurulum

### Chrome Web Store'dan (yakında)
Chrome Web Store'da "Alparslan" arayın ve "Ekle" butonuna tıklayın.

### Geliştirici Modu (Manuel)
```bash
# Repoyu klonla
git clone https://github.com/Dijital-Savunma/alparslan.git
cd alparslan

# Bağımlılıkları yükle
npm install

# Chrome için build
npm run build

# Firefox için build
npm run build:firefox

# Chrome'da:
# 1. chrome://extensions adresine gidin
# 2. "Geliştirici modu"nu açın
# 3. "Paketlenmemiş öğe yükle" ile dist/ klasörünü seçin

# Firefox'ta:
# 1. about:debugging#/runtime/this-firefox adresine gidin
# 2. "Geçici Eklenti Yükle" ile dist-firefox/manifest.json dosyasını seçin
```

### Paketleme
```bash
# Chrome .zip paketi
npm run package

# Firefox .zip paketi
npm run package:firefox
```

## Teknik Altyapı

- **Dil:** TypeScript
- **UI:** React 18
- **Build:** Vite 5
- **Test:** Vitest
- **Lint:** ESLint + Prettier

## Mimari

```
alparslan/
├── src/
│   ├── background/       ← Service worker (Chrome MV3) / Background script (Firefox MV2)
│   ├── content/          ← Sayfa içi scriptler
│   ├── popup/            ← Eklenti popup arayüzü (React)
│   ├── options/          ← Ayarlar sayfası (React)
│   ├── detector/         ← Phishing ve tehdit algılama motoru
│   │   ├── url-checker   ← URL analizi
│   │   └── page-analyzer ← Sayfa içerik analizi
│   ├── blocklist/        ← Engelleme listeleri ve uzak güncelleme
│   ├── privacy/          ← İzleyici engelleme modülü
│   └── utils/            ← Yardımcı fonksiyonlar ve tarayıcı uyumluluk katmanı
├── lists/                ← Türkiye odaklı tehdit listeleri (tr-phishing.json)
├── icons/                ← Eklenti ikonları (16, 48, 128px)
├── tests/                ← Test dosyaları (birim testler)
├── manifest.json         ← Chrome Manifest V3
├── manifest.firefox.json ← Firefox Manifest V2
├── vite.config.ts        ← Build yapılandırması (Chrome + Firefox)
└── vitest.config.ts      ← Test yapılandırması
```

## Tehdit Tespiti Nasıl Çalışır?

1. **URL Analizi** — Ziyaret edilen URL'ler, bilinen tehdit veritabanıyla karşılaştırılır
2. **Sayfa İçerik Analizi** — Sayfa içeriği phishing kalıplarına karşı taranır
3. **Engelleme Listesi Güncelleme** — Tehdit listeleri uzak sunucudan periyodik olarak güncellenir
4. **Topluluk Bildirimi** — Kullanıcılar şüpheli siteleri bildirebilir

Tüm kontroller **istemci taraflıdır** — gezinme veriniz sunuculara gönderilmez.

## Geliştirme

```bash
# Geliştirme (watch modu)
npm run dev

# Testleri çalıştır
npm test

# Testleri izle
npm run test:watch

# Lint
npm run lint

# Format
npm run format
```

## Katkıda Bulunma

Katkılarınızı bekliyoruz! [Katkı rehberimizi](https://github.com/Dijital-Savunma/.github/blob/main/CONTRIBUTING.md) inceleyin.

Özellikle şu alanlarda katkıya ihtiyacımız var:
- Türkiye'ye özgü phishing sitelerinin raporlanması
- Algılama motorunun iyileştirilmesi
- Farklı tarayıcılar için uyumluluk testleri
- UI/UX tasarımı
- Çeviri ve yerelleştirme

## Lisans

MIT Lisansı — [Dijital Savunma](https://dijitalsavunma.org)
