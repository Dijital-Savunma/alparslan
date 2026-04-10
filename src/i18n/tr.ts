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
    whitelisted: "Beyaz listede",
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

  // --- Sayfa analizi (page-analyzer) ---
  analysis: {
    creditCardRequested: "Kredi kartı bilgisi isteniyor",
    externalFormAction: (hostname: string) => `Form verisi farklı sunucuya gönderiliyor: ${hostname}`,
    tcKimlikSensitive: "TC Kimlik numarası ve hassas bilgi birlikte isteniyor",
    urgencyLanguage: "Aciliyet yaratan dil kullanılıyor",
  },

  // --- Dashboard / Skor ---
  dashboard: {
    weeklyScore: "Haftalık Güvenlik Skoru",
    suggestions: "Öneriler",
    control: "Kontrol",
    threat: "Tehdit",
    tracker: "Tracker",
    blockedThreat: "Engellenen Tehdit",
    blockedTracker: "Engellenen Tracker",
    https: "HTTPS",
    activity: "Aktivite",
  },

  // --- Dashboard ipuclari ---
  tips: {
    insecureHttp: "Güvenli olmayan (HTTP) sitelere dikkat edin. HTTPS olan alternatifleri tercih edin.",
    dangerousSites: (count: number) => `Bu hafta ${count} tehlikeli siteye girdiniz. Uyarılara dikkat edin.`,
    suspiciousSites: (count: number) => `Bu hafta ${count} şüpheli site tespit edildi. Dikkatli olun.`,
    enableTracker: "Tracker engelleyiciyi aktif edin. Gizliliğinizi korur.",
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
    networkMonitoring: "Ağ İzleme",
    networkMonitoringDesc: "Network isteklerini dinle",
    domWarnings: "Sayfa Uyarıları",
    domWarningsDesc: "Tehlikeli sitelerde uyarı göster",
    blacklistCount: (n: number) => `Kara liste: ${n} domain`,
    whitelistCount: (n: number) => `Beyaz liste: ${n} domain`,
    allSettings: "Tüm Ayarlar",
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
    show: "Tarama geçmişi",
    empty: "Henüz tarama yok",
    clear: "Geçmişi temizle",
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

  // --- Content script banner ---
  banner: {
    dangerous: "TEHLİKELİ SİTE",
    suspicious: "ŞÜPHELİ SİTE",
    prefix: "Alparslan:",
  },

  // --- Breach ---
  breach: {
    detected: (name: string, date: string, types: string) =>
      `Bu site geçmişte veri sızıntısına uğramış: ${name} (${date}). Sızabilecek veriler: ${types}`,
    badgeDetected: (name: string, date: string, types: string) =>
      `Bu sitede veri sızıntısı tespit edildi: ${name} (${date}). Sızabilecek veriler: ${types}`,
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
    whitelist: "Beyaz Liste",
    whitelistDesc: "Bu listedeki siteler için koruma devre dışı bırakılır",
    whitelistPlaceholder: "örnek: example.com",
    whitelistEmpty: "Beyaz liste boş",
    dataManagement: "Veri Yönetimi",
    clearAll: "Tüm Verileri Temizle",
    cleared: "Veriler temizlendi",
    clearDesc: "Tüm ayarlar ve beyaz liste sıfırlanır",
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
    blacklist: "Kara liste",
    usom: "USOM listesi",
    whitelist: "Beyaz liste",
    breachDb: "İhlal veritabanı",
    loadingSuffix: "yükleniyor...",
    ready: "Hazır",
  },

  // --- Skor mesajlari ---
  weeklyStats: (count: number) => `Bu hafta ${count} sayfa kontrol edildi`,
} as const;

export default tr;
export type TrKeys = typeof tr;
