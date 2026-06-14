import t from "@/i18n/tr";

/**
 * Tek bir teknik "reason" satırını (orn. "e-devlet.gov.tr ile aynı isim
 * farklı uzantı (olası sahte site)") Alparslan'ın ağzından doğal bir
 * cümleye çevirir. Balonun içinde "...dikkatli olun!" cümlesinin altında
 * gösterilir.
 *
 * Typosquatting reason'ları backend'de "${similar} ile ${reasonText}" formatında
 * birleştirilir; biz önce " ile " üzerinde bölerek "${similar}" kısmını ve
 * "${reasonText}" kısmını ayırıp uygun narration fonksiyonuna göndeririz.
 * Diğer reason'lar (suspiciousKeyword, ipAccess vb.) sabit string'ler olduğu
 * için direkt eşleştiririz. Risky TLD ve harici form gibi parametreli
 * olanlar için regex ile parantez/iki noktadan sonraki değeri çıkarıyoruz.
 */
export function narrateReason(raw: string): string {
  // 1) "${similar} ile ${reasonText}" formatlı typosquatting reasonları
  const ilePartIdx = raw.lastIndexOf(" ile ");
  if (ilePartIdx > 0) {
    const similar = raw.slice(0, ilePartIdx);
    const reasonText = raw.slice(ilePartIdx + 5);
    const typosquatMap: Record<string, (s: string) => string> = {
      [t.reasons.homoglyph]: t.reasonNarrations.homoglyph,
      [t.reasons.editDistance]: t.reasonNarrations.editDistance,
      [t.reasons.tldMismatch]: t.reasonNarrations.tldMismatch,
      [t.reasons.containsTrusted]: t.reasonNarrations.containsTrusted,
      [t.reasons.subdomainImpersonation]: t.reasonNarrations.subdomainImpersonation,
      [t.reasons.subdomainTyposquat]: t.reasonNarrations.subdomainTyposquat,
      [t.reasons.similarDomain]: t.reasonNarrations.similarDomain,
    };
    if (typosquatMap[reasonText]) {
      return typosquatMap[reasonText](similar);
    }
  }

  // 2) Sabit (parametresiz) reasonlar
  if (raw === t.reasons.suspiciousKeyword) return t.reasonNarrations.suspiciousKeyword;
  if (raw === t.reasons.ipAccess) return t.reasonNarrations.ipAccess;
  if (raw === t.reasons.excessiveSubdomains) return t.reasonNarrations.excessiveSubdomains;
  if (raw === t.analysis.creditCardRequested) return t.reasonNarrations.creditCardRequested;
  if (raw === t.analysis.tcKimlikSensitive) return t.reasonNarrations.tcKimlikSensitive;
  if (raw === t.analysis.urgencyLanguage) return t.reasonNarrations.urgencyLanguage;

  // 3) Parametreli — "Riskli uzantı (.xyz)"
  const tldMatch = raw.match(/^Riskli uzantı \((.+)\)$/);
  if (tldMatch) return t.reasonNarrations.riskyTld(tldMatch[1]);

  // 4) Parametreli — "Form verisi farklı sunucuya gönderiliyor: <host>"
  const formMatch = raw.match(/^Form verisi farklı sunucuya gönderiliyor: ([^ )]+)/);
  if (formMatch) return t.reasonNarrations.externalFormAction(formMatch[1]);

  // 5) Fallback — tanımadığım reason olursa olduğu gibi göster
  return t.reasonNarrations.generic(raw);
}
