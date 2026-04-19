# Katkıda Bulunma Rehberi

Alparslan'a katkıda bulunmak istediğiniz için teşekkürler! Bu rehber, katkı sürecini kolaylaştırmak için hazırlanmıştır.

## Nasıl Katkıda Bulunabilirim?

### Hata Bildirimi

1. [Issues](https://github.com/Dijital-Savunma/alparslan/issues) sayfasında benzer bir kayıt olup olmadığını kontrol edin
2. Yoksa yeni bir issue açın ve şunları belirtin:
   - Tarayıcı adı ve sürümü
   - Eklenti sürümü
   - Hatayı tekrarlama adımları
   - Beklenen ve gerçekleşen davranış

### Phishing / Dolandırıcılık Sitesi Bildirimi

Türkiye'ye özgü phishing veya dolandırıcılık sitesi tespit ettiyseniz:

1. Issue açın ve **"tehdit-bildirimi"** etiketini ekleyin
2. Sitenin URL'sini, hedeflediği markayı ve tespit tarihini paylaşın
3. Mümkünse ekran görüntüsü ekleyin

> **Not:** Kişisel bilgilerinizi (şifre, TC kimlik no vb.) paylaşmayın.

### Kod Katkısı

1. Repoyu fork edin
2. Yeni bir branch oluşturun:
   ```bash
   git checkout -b feat/ozellik-adi
   ```
3. Değişikliklerinizi yapın
4. Testlerin geçtiğinden emin olun:
   ```bash
   npm test
   npm run lint
   ```
5. Commit atın (bkz. [Commit Mesajları](#commit-mesajları))
6. Fork'unuza push edin ve Pull Request açın

## Branch İsimlendirme

| Önek | Kullanım | Örnek |
|------|----------|-------|
| `feat/` | Yeni özellik | `feat/tracker-blocking` |
| `fix/` | Hata düzeltme | `fix/popup-crash` |
| `docs/` | Dokümantasyon | `docs/contributing-guide` |
| `refactor/` | Yeniden düzenleme | `refactor/detector-engine` |
| `test/` | Test ekleme/düzeltme | `test/url-checker` |

## Commit Mesajları

[Conventional Commits](https://www.conventionalcommits.org/) standardını kullanıyoruz:

```
feat: phishing URL algılama motoru eklendi
fix: popup'ta bildirim gösterilmeme hatası düzeltildi
docs: kurulum adımları güncellendi
test: URL checker için birim testler eklendi
```

## Geliştirme Ortamı

```bash
# Repoyu klonlayın
git clone https://github.com/Dijital-Savunma/alparslan.git
cd alparslan

# Bağımlılıkları yükleyin
npm install

# Geliştirme modunu başlatın
npm run dev

# Testleri çalıştırın
npm test
```

## Pull Request Süreci

1. PR açmadan önce `main` branch ile güncel olduğunuzdan emin olun
2. PR açıklamasında ne yaptığınızı ve neden yaptığınızı belirtin
3. İlgili issue varsa referans verin (`Closes #123`)
4. CI kontrollerinin geçmesini bekleyin
5. En az bir onay (review) aldıktan sonra merge edilir

## Kodlama Standartları

- **Dil:** TypeScript
- **Lint:** ESLint + Prettier yapılandırması projeye dahildir
- **Test:** Yeni özellikler ve hata düzeltmeleri için test yazılmalıdır
- Mevcut kod stiline uyun; `npm run lint` ile kontrol edin

## Güvenlik Açığı Bildirimi

Eklentide bir güvenlik açığı keşfettiyseniz, **lütfen public issue açmayın**. Bunun yerine doğrudan e-posta gönderin:

**guvenlik@dijitalsavunma.org**

Sorumlu açıklama (responsible disclosure) ilkesine bağlıyız.

## Davranış Kuralları

- Saygılı ve yapıcı olun
- Farklı deneyim seviyelerindeki katkıcılara açık olun
- Geri bildirimleri kişisel almayın; amaç projeyi iyileştirmektir

---

Sorularınız mı var? [Discussions](https://github.com/Dijital-Savunma/alparslan/discussions) sayfasında konuşalım.
