# Alparslan

[![Lisans: MIT](https://img.shields.io/badge/Lisans-MIT-blue?style=flat-square)](LICENSE)
[![Turna Vakfı](https://img.shields.io/badge/Turna_Vakfı-Açık_Kaynak-red?style=flat-square)](https://github.com/DijitalSavunma)
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

- Google Chrome / Chromium
- Mozilla Firefox
- Microsoft Edge
- Brave
- Opera

## Kurulum

### Chrome Web Store'dan (yakında)
Chrome Web Store'da "Alparslan" arayın ve "Ekle" butonuna tıklayın.

### Geliştirici Modu (Manuel)
```bash
# Repoyu klonla
git clone https://github.com/DijitalSavunma/alparslan.git
cd alparslan

# Bağımlılıkları yükle
npm install

# Build
npm run build

# Chrome'da:
# 1. chrome://extensions adresine gidin
# 2. "Geliştirici modu"nu açın
# 3. "Paketlenmemiş öğe yükle" ile dist/ klasörünü seçin
```

## Mimari

```
alparslan/
├── src/
│   ├── background/       ← Arka plan servisi
│   ├── content/          ← Sayfa içi scriptler
│   ├── popup/            ← Eklenti popup arayüzü
│   ├── detector/         ← Phishing ve tehdit algılama motoru
│   ├── blocklist/        ← Engelleme listeleri
│   ├── privacy/          ← İzleyici engelleme modülü
│   └── utils/            ← Yardımcı fonksiyonlar
├── lists/                ← Türkiye odaklı tehdit listeleri
├── tests/                ← Test dosyaları
├── manifest.json         ← WebExtension manifest (v3)
└── docs/                 ← Dokümantasyon
```

## Tehdit Tespiti Nasıl Çalışır?

1. **URL Analizi** — Ziyaret edilen URL'ler, bilinen tehdit veritabanıyla karşılaştırılır
2. **Sayfa İçerik Analizi** — Sayfa içeriği phishing kalıplarına karşı taranır
3. **Görsel Benzerlik** — Sahte sitelerin orijinal sitelere benzerliği tespit edilir
4. **Topluluk Bildirimi** — Kullanıcılar şüpheli siteleri bildirebilir

Tüm kontroller **istemci taraflıdır** — gezinme veriniz sunuculara gönderilmez.

## Katkıda Bulunma

Katkılarınızı bekliyoruz! [Katkı rehberimizi](https://github.com/DijitalSavunma/.github/blob/main/CONTRIBUTING.md) inceleyin.

Özellikle şu alanlarda katkıya ihtiyacımız var:
- Türkiye'ye özgü phishing sitelerinin raporlanması
- Algılama motorunun iyileştirilmesi
- Farklı tarayıcılar için uyumluluk testleri
- UI/UX tasarımı
- Çeviri ve yerelleştirme

## Lisans

MIT Lisansı — [Turna Vakfı](https://turnavakfi.org)
