// Alparslan - Merkezi Turkce dil dosyasi
// Tum kullaniciya gorunen metinler burada tanimlanir.

const tr = {
  // --- Genel ---
  appName: "Alparslan",
  version: "v0.1.0",
  footer: "Alparslan v0.1.0",
  close: "Kapat",
  add: "Ekle",
  send: "Gönder",
  cancel: "İptal",
  save: "Kaydet",
  active: "Aktif",
  passive: "Pasif",
  loading: "Yükleniyor...",

  // --- Durum ---
  status: {
    safe: "Güvenli",
    dangerous: "Tehlikeli!",
    suspicious: "Şüpheli",
    unknown: "Bilinmiyor",
    disabled: "Koruma Kapalı",
    checking: "Kontrol ediliyor...",
  },

  // --- Tehdit nedenleri (url-checker) ---
  reasons: {
    knownDangerous: "Bilinen tehlikeli site",
    usomListed: "USOM tehdit listesinde",
    invalidUrl: "Geçersiz URL",
    whitelisted: "Güvenilir bağlantı listemde",
    homoglyph: "sahte Unicode karakterler kullanıyor (tehlikeli)",
    editDistance: "benzer domain (olası sahte site)",
    tldMismatch: "aynı isim farklı uzantı (olası sahte site)",
    containsTrusted: "güvenilir ismi içeriyor (olası sahte site)",
    subdomainImpersonation: "alt alan adında güvenilir isim (olası sahte site)",
    subdomainTyposquat: "alt alan adında benzer isim (olası sahte site)",
    similarDomain: "benzer domain",
    suspiciousKeyword: "Şüpheli anahtar kelime içeriyor",
    ipAccess: "IP adresi ile erişim",
    excessiveSubdomains: "Çok fazla alt alan adı",
    riskyTld: (tld: string) => `Riskli uzantı (${tld})`,
  },

  // --- Alparslan sesiyle anlatim ---
  // Tek bir teknik "reason" satirini ("e-devlet.gov.tr ile ayni isim farkli
  // uzanti (olasi sahte site)") balonun icinde Alparslan'in agzindan dogal
  // bir cumleye cevirir. "Cunku..." ile baslar, balonda "dikkatli olun!"
  // metninden sonra alt alta listelenir.
  reasonNarrations: {
    // Typosquatting (url-checker'ın 6 lookalike türü)
    homoglyph: (similar: string) =>
      `Bu adreste Latin alfabesi gibi görünen ama farklı karakterler var. Gerçek "${similar}" sitesi değil, taklit girişimi olabilir.`,
    editDistance: (similar: string) =>
      `Bu adres "${similar}" sitesinin yanlış yazılmış hali gibi görünüyor.`,
    tldMismatch: (similar: string) =>
      `Bu site "${similar}" ile aynı ismi kullanıyor ama farklı bir uzantıda, sahte olabilir.`,
    containsTrusted: (similar: string) =>
      `Adres içinde "${similar}" ismi geçiyor ama gerçek site burada değil.`,
    subdomainImpersonation: (similar: string) =>
      `Alt alan adında "${similar}" gizlenmiş, asıl site farklı bir yerde.`,
    subdomainTyposquat: (similar: string) =>
      `Alt alan adında "${similar}" benzeri bir isim var, dikkat edin.`,
    similarDomain: (similar: string) =>
      `Bu adres "${similar}" sitesine çok benziyor.`,
    // Generic sinyaller
    suspiciousKeyword:
      `Adreste "login", "secure" ya da "verify" gibi şüphe verici kelimeler var.`,
    ipAccess:
      `Bu adres normal bir isim yerine ham IP numarasıyla açılıyor. Dolandırıcılar bunu sıkça kullanır.`,
    excessiveSubdomains:
      `Bu adreste alışılmadık kadar çok alt alan var, sade bir site bunu yapmaz.`,
    riskyTld: (tld: string) =>
      `Adres "${tld}" gibi nadir bir uzantı kullanıyor. Dolandırıcılarda yaygındır.`,
    // Sayfa (DOM) sinyalleri
    creditCardRequested:
      `Bu sayfa kredi kartı bilgilerinizi istiyor. Doğru sitede olduğunuzdan emin olun.`,
    externalFormAction: (hostname: string) =>
      `Bu sayfadaki formlar bilgileri "${hostname}" gibi farklı bir sunucuya gönderiyor.`,
    tcKimlikSensitive:
      `Bu sayfada TC Kimlik numarası ile birlikte hassas bilgiler isteniyor.`,
    urgencyLanguage:
      `Bu sayfa "acele edin, hemen yapın" gibi sizi telaşlandıran bir dil kullanıyor.`,
    // Fallback — tanımadığım formatta bir reason gelirse aynen göster.
    generic: (raw: string) => raw,
  },

  // --- Sayfa analizi (page-analyzer) ---
  analysis: {
    creditCardRequested: "Kredi kartı bilgisi isteniyor",
    externalFormAction: (hostname: string, count = 1) =>
      count > 1
        ? `Form verisi farklı sunucuya gönderiliyor: ${hostname} (${count} form)`
        : `Form verisi farklı sunucuya gönderiliyor: ${hostname}`,
    tcKimlikSensitive: "TC Kimlik numarası ve hassas bilgi birlikte isteniyor",
    urgencyLanguage: "Aciliyet yaratan dil kullanılıyor",
  },

  // --- Dashboard ipuclari (score-calculator tarafindan uretilir; popup
  // bu ipuclarini su an gostermiyor ama testler ve gelecekte UI kullanmasi
  // ihtimaline karsi tutuldu) ---
  tips: {
    dangerousSites: (count: number) => `Bu hafta ${count} tehlikeli siteye girdiniz. Uyarılara dikkat edin.`,
    suspiciousSites: (count: number) => `Bu hafta ${count} şüpheli site tespit edildi. Dikkatli olun.`,
    notActive: "Alparslan aktif değil veya bu hafta hiç gezinmediniz. Koruma için eklentiyi aktif tutun.",
  },

  // --- Popup sekmeler ---
  tabs: {
    status: "Durum",
    score: "Skor",
    settings: "Ayarlar",
  },

  // --- Popup ayarlar ---
  settings: {
    networkMonitoring: "🔍 Detaylı Güvenlik Taraması",
    networkMonitoringDesc: "Sitelerin arkasına gizlenmiş tüm tehlikeleri yakalar.",
    domWarnings: "Sayfa Uyarıları",
    domWarningsDesc: "Tehlikeli sitelerde uyarı göster",
    dangerWarnings: "🚨 Tehlike Uyarıları",
    dangerWarningsDesc: "Tehlikeli sitelerde uyarı göster",
    darkMode: "🌙 Karanlık Mod",
    darkModeDesc: "Koyu renk teması",
    speechBubble: "🤖 Alparslan Asistan",
    speechBubbleDesc: "Güvenlik durumlarını teknik terimlerle değil; Alparslan'ın bir asistan gibi sizinle konuşarak, kolay ve sade cümlelerle anlatmasını sağlar.",
    blacklistCount: (n: number) => `Engellediğim Bağlantılar: ${n} domain`,
    whitelistCount: (n: number) => `Güvendiğim Bağlantılar: ${n} domain`,
    allSettings: "Tüm Ayarlar",
  },

  // --- Tehlike uyarilarini kapatma onayi (popup) ---
  confirmDisableNotif: {
    message: "Bildirimleri kapatmak istediğinizden emin misiniz?",
    detail: "Kapatırsanız, Alparslan sizi arka plandaki gizli tehlikelere karşı uyarmayı durdurur.",
    keep: "Hayır, Korumaya Devam Et",
    disable: "Evet, Bildirimleri Kapat",
  },

  // --- Tum verileri temizleme onayi (options) ---
  confirmClearData: {
    message: "Tüm geçmişi ve verileri temizlemek istiyor musunuz?",
    detail: "Bu işlem geri alınamaz. Alparslan'ın bugüne kadar sizi koruduğu tüm tarama kayıtları ve istatistikler tamamen silinecektir.",
    cancel: "Vazgeç, Kayıtları Tut",
    confirm: "Evet, Hepsini Temizle",
  },

  // --- Popup ag izleme ---
  networkStats: {
    title: "Bu Sayfa - Ağ İzleme",
    request: "İstek",
    domain: "Domain",
    threat: "Tehdit",
    blocked: "Engellenen",
  },

  // --- Popup gecmis ---
  history: {
    hide: "Geçmişi gizle",
    hideList: "Tarama geçmişini gizle",
    show: "Tarama geçmişi",
    empty: "Henüz tarama yok",
    clear: "Geçmişi temizle",
    showAlt: "Tarama geçmişini görüntüle",
    hideAlt: "Geçmiş listesini gizle",
  },

  // --- Popup filtre listeleri ---
  filterLists: {
    // Skor sekmesindeki acilabilir listelerin baslik metinleri.
    controlList: "Kontrol Listesi",
    threatList: "Tehdit Listesi",
    unknownList: "Risk Listesi",
    threatEmpty: "Tehdit bulunamadı",
    unknownEmpty: "Şüpheli kayıt bulunamadı",
  },

  // --- Popup "guvendigim baglantilar" hizli ekleme ---
  popupWhitelist: {
    addButton: "Güvenilir olarak işaretle",
    alreadyAdded: "Güvenilir bağlantı listemde",
    viewAll: "👁️ Güvendiğim siteleri görüntüle",
    tooltipAdd: "Bu siteyi güvendiğim bağlantılara ekle",
    tooltipAlready: "Bu site zaten güvenilir bağlantı listemde",
    // Kullanici yazim hatasi yapmasin diye aktif sekmenin domain'ini tek
    // tikla input'a yazdiran kisayol.
    autoFillCurrent: (domain: string) => `✨ Mevcut siteyi otomatik yazdır (${domain})`,
  },

  // --- Popup durum cumleleri (status indicator tooltip) ---
  statusMessages: {
    safe: "Bu site güvenli görünüyor",
    dangerous: "Bu site riskli olabilir",
    suspicious: "Bu site şüpheli davranış gösteriyor",
    unknown: "Bu sitenin durumu belirlenemedi",
    disabled: "Koruma kapalı",
  },

  // --- Popup detay paneli ---
  detailPanel: {
    show: "Detaylı görüntüle",
    hide: "Detayı gizle",
    loading: "Detaylar yükleniyor...",
    close: "Detay panelini kapat",
  },

  // --- Popup konusma balonu ("Alparslan'in dilinden" anlatim modu) ---
  // The site domain is injected at the very front of each sentence and the
  // verdict-appropriate lock glyph (🔒 safe / 🔓 anything else) is pinned to
  // the end, so the bubble can stand alone without a separate URL strip.
  speechBubble: {
    // Body of the verdict line — the leading status emoji is rendered as a
    // separate element in the popup so subsequent wrapped lines align with
    // the first character of text instead of the bubble's edge.
    safe: (domain: string) => `${domain} sayfasını sizin için baştan aşağı taradım. Her şey sapasağlam, Alparslan ile güvendesiniz!`,
    suspicious: (domain: string) => `${domain} sayfasında şüpheli hareketler seziyorum. Bilgilerinizi veya şifrelerinizi girerken dikkatli olun!`,
    dangerous: (domain: string) => `Durun! ${domain} sayfasında dijital tuzaklar ve zararlı yazılımlar var. Güvenliğiniz için bu sayfadan hemen uzaklaşın!`,
    unknown: (domain: string) => `${domain} sayfasını ilk defa görüyorum. Kalkanlarım şu an arka planda sayfayı incelemeye devam ediyor, merak etmeyin.`,
    // Shown when the SAFE verdict comes from the user's own whitelist — we
    // didn't scan it, they vouched for it, so we acknowledge that instead of
    // claiming we scanned it. Keep the "iyi gezintiler" keyword: StatusPanel
    // bolds it as the highlight word.
    whitelisted: (domain: string) => `${domain} sayfasını güvenilir bağlantılarınıza eklemişsiniz. Burada gönlünüz rahat olsun — iyi gezintiler!`,
    // Aksiyon paneli — risk taşıyan durumlarda balonun altında çıkar.
    actionPrompt: "Dilerseniz güvenliğiniz için aşağıdaki adımlardan birini seçebilirsiniz:",
    actionClose: "Sayfadan Ayrıl",
    actionTrust: "Bu Adrese Güven",

    // İki aksiyon için onay pencereleri.
    // "Bu Adrese Güven" onayı — kullanıcı koruma kalkanlarını indiriyor.
    confirmTrustTitle: "⚠️ Bu adresi güvenli listeye eklemek üzeresiniz.",
    confirmTrustBody:
      "Onaylarsanız Alparslan bu sayfa için koruma kalkanlarını indirecek ve sitenin tüm hareketlerine izin verecektir. Riski kabul ediyor musunuz?",
    confirmTrustCancel: "❌ Vazgeç",
    confirmTrustConfirm: "👍 Evet, Güven",
    // "Sayfadan Ayrıl" onayı — kullanıcı tehlikeli sekmeyi kapatıyor.
    confirmCloseTitle: "🚪 Bu sayfayı kapatmak istediğinizden emin misiniz?",
    confirmCloseBody:
      "Onayladığınız an Alparslan bu tehlikeli sekmeyi tamamen sonlandıracaktır. Güvenliğiniz için bu sayfadaki tüm işlemleriniz durdurulur.",
    confirmCloseConfirm: "🚪 Sekmeyi Kapat",
    confirmCloseCancel: "❌ Vazgeç",
  },

  // --- Popup koruma toggle tooltip ---
  protectionToggle: {
    disable: "Korumayı kapatmak için tıklayınız",
    enable: "Korumayı etkinleştirmek için tıklayınız",
  },

  // --- Popup bilgilendirme merkezi ---
  notificationCenter: {
    open: "Bildirimleri görüntüle",
    close: "Bildirimleri kapat",
    infoButton: "Bilgilendirme Merkezi",
    infoButtonHide: "Bilgilendirmeyi gizle",
    infoTitle: "Kısa Bilgilendirme",
    welcome: "Ben Alparslan sizi korumak için buradayım! ",
    welcomeLink: "Buraya",
    welcomeLinkTitle: "Dijital Savunma sitesine git",
    welcomeSuffix: " tıklayarak benimle ilgili bilgilere ulaşabilirsiniz.",
    todayPrefix: "Bugün sizin için ",
    todayChecked: " kontrol yaptım.",
    todayThreats: " tehdit buldum.",
    todayTrackers: " takipçi buldum.",
    todayUnknowns: " şüpheli kayıt tespit ettim.",
    protectedDays: (n: number) => `${n} gündür korunuyorsunuz`,
    glossary: {
      controlLabel: "Kontrol",
      controlDesc: "Eklentinin ziyaret ettiğiniz sayfadaki bağlantıları, istekleri ve alan adlarını güvenlik açısından incelemesini ifade eder.",
      scoreLabel: "Skor",
      scoreDesc1: "Haftalık güvenlik skorunu gösterir. ",
      scoreDesc2: " güvenli, ",
      scoreDesc3: " orta seviye, ",
      scoreDesc4: " riskli seviye olarak değerlendirilir.",
      scoreRangeGood: "80 – 100",
      scoreRangeMedium: "50 – 79",
      scoreRangeBad: "0 – 49",
      whitelistLabel: "Güvendiğim Bağlantılar",
      whitelistDesc: "Güvenilir olduğunu bildiğiniz siteleri eklediğiniz alandır. Bu siteler güvenli kabul edilir. Güvendiğiniz bağlantılara ayarlar kısmından ulaşabilirsiniz.",
      blacklistLabel: "Engellediğim Bağlantılar",
      blacklistDesc: "Riskli veya engellenmesini istediğiniz sitelerin tutulduğu listedir.",
      threatLabel: "Tehdit",
      threatDesc: "Zararlı, şüpheli veya kullanıcı güvenliğini riske atabilecek bağlantıları ifade eder.",
      trackerLabel: "Takipçi",
      trackerDesc: "Sitelerdeki takip mekanizmalarıdır. Kullanıcı davranışlarını izleyebilir.",
      unknownLabel: "Şüpheli",
      unknownDesc: "Sistemin kesin olarak güvenli veya riskli sınıflandıramadığı bağlantıları gösterir. İsterseniz bu siteleri ayarlar kısmından güvendiğiniz bağlantılara ekleyebilirsiniz.",
    },
  },

  // --- Popup raporlama ---
  report: {
    button: "Bu siteyi raporla",
    success: "Rapor gönderildi!",
    duplicate: "Bu site zaten raporlanmış.",
    dangerous: "Tehlikeli",
    safe: "Güvenli",
    placeholder: "Açıklama (opsiyonel)",
  },

  // --- Popup skor ozeti ---
  scoreMessages: {
    great: "Harika! Güvenli geziniyorsunuz.",
    good: "İyi, ama iyileştirme alanı var.",
    warning: "Dikkat! Güvenliğinizi artırın.",
  },

  // --- Skor sekmesi sayac kartlari ---
  // Eski "Kontrol / Tehdit / Şüpheli" baslklari kullanici dostu hale getirildi.
  // Sayilar 0 oldugunda sayi yerine soft bir "sey bulunmadi" cumlesi cikar;
  // boylece sifir bir "ariza" gibi degil, asistanin gorevini sessizce yaptigi
  // gibi okunur.
  skorCards: {
    control: "Tarama Geçmişi",
    controlZero: "Taranan öğe yok",
    controlClose: "Tarama Geçmişini Kapat",
    controlTooltip: "Tarama geçmişi listesini görmek için tıklayın",
    controlTooltipClose: "Tarama geçmişi listesini kapatmak için tıklayın",
    threat: "Engellenen Tehdit",
    threatZero: "Tehdit bulunmadı",
    threatClose: "Tehdit Listesini Kapat",
    threatTooltip: "Engellenen tehdit listesini görmek için tıklayın",
    threatTooltipClose: "Engellenen tehdit listesini kapatmak için tıklayın",
    unknown: "Potansiyel Risk",
    unknownZero: "Risk tespit edilmedi",
    unknownClose: "Potansiyel Risk Listesini Kapat",
    unknownTooltip: "Potansiyel risk listesini görmek için tıklayın",
    unknownTooltipClose: "Potansiyel risk listesini kapatmak için tıklayın",
  },

  // --- Skor halkasi altinda gosterilen dinamik analiz ozetleri ---
  // "Neden bu skor?" sorusuna cevap veren satirlar. Her satir teknolojik
  // dille yazilmistir; tehdit/risk varsa kac puan goturdugu, ayar acik/
  // kapali durumu acikca ifade edilir. Tehdit/risk sayilari BENZERSIZ
  // domain bazlidir (ayni siteye birkac kere girilse de 1 sayilir).
  skorBreakdown: {
    title: "Skor Analizi",
    safeActive: (count: number) =>
      `${count} farklı güvenli sitede gezindiniz.`,
    safeClean: "Henüz güvenli ziyaret kaydı yok.",
    threatActive: (count: number) => `${count} adet tehlike engellendi.`,
    threatClean: "Tehdit bulunmadı",
    riskActive: (count: number) =>
      `${count} adet potansiyel risk tespit edildi.`,
    riskClean: "Potansiyel risk bulunmadı",
    scanOn: "Detaylı Güvenlik Taraması aktif ve koruyor.",
    scanOff: "'Detaylı Güvenlik Taraması' modülü pasif.",
    pointSuffix: "Puan",
  },

  // --- Dashboard skor sifirlama ---
  resetScore: {
    button: "Skoru sıfırla",
    confirmTitle: "Günlük skoru sıfırlamak istediğinizden emin misiniz?",
    confirmBody:
      "Skor 100'e dönecek, oturum içi sayaçlarınız (Kontrol / Tehdit / Takipçi / Şüpheli) ve tarama geçmişi temizlenecektir. Ayarlarınız ve güvendiğiniz bağlantılar etkilenmez.",
    confirmYes: "Evet, sıfırla",
    confirmCancel: "Vazgeç",
  },

  // --- Dashboard skor halkasi (circular ring) ---
  scoreRing: {
    safeTitle: "Alparslan koruyor, durumunuz iyi.",
    safeSubtitle: "Bağlantılarınız güvende.",
    mediumTitle: "Alparslan koruyor, dikkat seviyesi orta.",
    mediumSubtitle: "Bazı bağlantılar dikkat gerektiriyor.",
    riskyTitle: "Alparslan koruyor, dikkat seviyesi yüksek.",
    riskySubtitle: "Bağlantılarınız riskli olabilir.",
  },

  // --- Dashboard skoru yükselten baglantilar paneli ---
  raisingSites: {
    buttonOpen: "Günlük skorumu yükselten bağlantılar",
    buttonClose: "Listeyi kapat",
    closeTitle: "Listeyi kapat",
    title: "🟢 Güvenli Bağlantılar",
    subtitle: (n: number) => `Ziyaret ettiğiniz son ${n} bağlantı`,
    empty: "Henüz güvenli bağlantı yok",
  },

  // --- Dashboard skoru dusuren baglantilar paneli ---
  loweringSites: {
    buttonOpen: "Günlük skorumu düşüren bağlantılar",
    buttonClose: "Listeyi kapat",
    closeTitle: "Listeyi kapat",
    title: "🔴 Güvenli Olmayan Bağlantılar",
    subtitle: (n: number) => `Ziyaret ettiğiniz son ${n} bağlantı`,
    empty: "Güvenli olmayan bağlantı yok",
  },

  // --- Dashboard skor bilgilendirme paneli ---
  scoreHelp: {
    closeTitle: "Bilgilendirmeyi kapat",
    whatTitle: "🤔 Bu Puan Nedir?",
    whatBody:
      "İnternette girdiğiniz sitelerin ne kadar güvenli olduğunu gösteren zırh puanınızdır. Alparslan siteleri inceler ve puanı otomatik hesaplar.",
    howTitle: "📈 Puanı Yükseltmek İçin Ne Yapmalıyım?",
    howLockLabel: "🔒 Kilitli Siteleri Seçin:",
    howLockBody:
      "İnternet adresinin başında \"kilit\" simgesi olan siteleri tercih edin.",
    howListenLabel: "🛡️ Alparslan'ı Dinleyin:",
    howListenBody:
      "Çok fazla reklam ve gizli takipçi barındıran sitelerden uzak durarak puanınızı yüksek tutun.",
    colorsTitle: "🎨 Renkler Ne Anlama Geliyor?",
    greenLabel: "🟢 Yeşil Puan (80 - 100):",
    greenBody:
      "Güvendesiniz. Kapılarınız kilitli, kalkanınız sapasağlam.",
    yellowLabel: "🟡 Sarı Puan (50 - 79):",
    yellowBody:
      "Dikkat edin. Büyük bir tehlike yok ama siteler çok temiz değil.",
    redLabel: "🔴 Kırmızı Puan (0 - 49):",
    redBody:
      "Tehlike! Alparslan sizin için tuzaklar engelledi, o siteden hemen uzaklaşın.",
  },

  // --- Content script banner ---
  // Mesajlar "Alparslan asistan" diliyle yumusatildi — kullaniciya teknik
  // detay yerine ne yapmasi gerektigini net soyleyen, samimi bir uyari verir.
  banner: {
    dangerous: "BU SİTE GÜVENLİ DEĞİL!",
    suspicious: "BU SİTE ŞÜPHELİ GÖRÜNÜYOR",
    prefix: "Alparslan:",
    dangerousBody:
      "Resmi siber güvenlik kayıtlarına göre bu adres sahte veya zararlıdır. Bilgilerinizin çalınmaması için sayfayı hemen terk etmenizi öneririm.",
    suspiciousBody:
      "Bu adresin arka planında bazı şüpheli işaretler tespit ettim. Bilgilerinizin güvenliği için bu sayfada hassas işlem yapmamanızı, dikkatli ilerlemenizi öneririm.",
  },

  // --- Breach ---
  breach: {
    detected: (name: string, date: string, types: string) =>
      `Bu site geçmişte veri sızıntısına uğramış: ${name} (${date}). Sızabilecek veriler: ${types}`,
    badgeDetected: (name: string, date: string, types: string) =>
      `Bu sitede veri sızıntısı tespit edildi: ${name} (${date}). Sızabilecek veriler: ${types}`,
    closeOnce: "Kapat",
    dontShowAgain: "Kapat ve bir daha gösterme",
    // "Bir daha gosterme" onayi — kullanici bu uyariyi kalici olarak susturma
    // adimini bilerek atmali, kaza ile basinca veri sizintisinin korumasini
    // kaybetmesin.
    dismissConfirmTitle: "Bu uyarıyı bir daha göstermeyelim mi?",
    dismissConfirmBody: (domain: string) =>
      `${domain} sitesi için sızıntı uyarısı bir daha çıkmayacak. Bu karar tamamen sizin elinizde, dilerseniz vazgeçebilirsiniz.`,
    dismissConfirmYes: "Evet, bir daha gösterme",
    dismissConfirmCancel: "Vazgeç",
  },

  // --- Options sayfa ---
  options: {
    title: "Alparslan Ayarlar",
    subtitle: "Güvenlik ve gizlilik tercihlerinizi yönetin",
    weeklySummary: "Haftalık Güvenlik Özeti",
    settingsSaved: "Ayarlar kaydedildi",
    protectionLevel: "Koruma Seviyesi",
    notifications: "Bildirimler",
    threatNotifications: "Tehdit Bildirimleri",
    threatNotificationsDesc: "Tehlikeli site tespit edildiğinde bildirim göster",
    networkMonitoring: "Ağ İzleme",
    networkListenLabel: "Network İsteklerini Dinle",
    networkListenDesc: "Tüm ağ isteklerini izleyerek tehditleri tespit eder",
    whitelist: "Güvendiğim Bağlantılar",
    whitelistDesc: "Bu listedeki siteler için koruma devre dışı bırakılır",
    whitelistPlaceholder: "İstisna tutulacak web adresini girin...",
    whitelistEmpty: "Güvendiğiniz bağlantı listesi boş",
    dataManagement: "Veri Yönetimi",
    clearAll: "Tüm Verileri Temizle",
    cleared: "Veriler temizlendi",
    clearDesc: "Tüm ayarlar ve güvendiğiniz bağlantılar sıfırlanır",
  },

  // --- Koruma seviyeleri ---
  protection: {
    low: "Düşük",
    lowDesc: "Sadece bilinen tehlikeli siteleri engeller",
    medium: "Orta",
    mediumDesc: "Tehlikeli siteler + şüpheli URL tespiti",
    high: "Yüksek",
    highDesc: "Tüm kontroller aktif, agresif koruma",
  },

  // --- Init progress ---
  init: {
    starting: "Başlatılıyor...",
    settings: "Ayarlar",
    blacklist: "Engellediğim bağlantılar",
    usom: "USOM listesi",
    whitelist: "Güvendiğim bağlantılar",
    breachDb: "İhlal veritabanı",
    loadingSuffix: "yükleniyor...",
    ready: "Hazır",
  },

  // --- Skor mesajlari ---
  weeklyStats: (count: number) => `Bu hafta ${count} sayfa kontrol edildi`,
} as const;

export default tr;
export type TrKeys = typeof tr;
