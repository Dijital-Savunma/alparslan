import type { WeeklyMetrics, ScoreBreakdown, DashboardData } from "./types";
import t from "@/i18n/tr";

/**
 * Simple penalty-based score.
 *
 * The user starts the week with a perfect 100 and loses points every time
 * they visit a site that wasn't confidently safe:
 *
 *   - DANGEROUS site visited  → -{DANGEROUS_PENALTY} per visit
 *   - SUSPICIOUS site visited → -{SUSPICIOUS_PENALTY} per visit
 *   - UNKNOWN site visited    → -{UNKNOWN_PENALTY} per visit
 *
 * Score floors at 0. Earlier iterations multiplied a bunch of category
 * scores (HTTPS, activity, tracker blocking) but the team decided that's
 * unintuitive — "your score should drop only when you do something risky".
 *
 * The breakdown fields are still populated because the legacy popup UI
 * read them; they now just split the penalty totals for display rather
 * than representing independent category scores.
 */
const STARTING_SCORE = 100;
// Skor asla 0'a inmez: cok tehdit toplansa bile alt sinir 20'dir.
const MIN_SCORE = 20;
// Unique-domain bazli penalty modeli:
//   - DANGEROUS (USOM blocklist veya kesin tehdit)  -> -15 puan
//   - SUSPICIOUS (sezgi/heuristik, kesin degil)     -> -10 puan
//   - UNKNOWN (henuz dogrulanmamis itibar)          -> -5  puan
//   - "Detayli Guvenlik Taramasi" pasif             -> -10 puan
// @mertinkos review yorumu: DANGEROUS ile SUSPICIOUS esitti (ikisi de 10),
// halbuki DANGEROUS kesin tehdit, SUSPICIOUS sadece sezgisel ipuclarina
// dayaniyor. Net hiyerarsi: dangerous > suspicious > unknown (15/10/5).
// Background, state.history'den BENZERSIZ domain sayilarini cikartip
// synthetic metrics olarak buraya gonderir. Boylece kullanici ayni siteye
// 30 kere girse bile bir kere puan kesilir, sonraki ziyaretler skoru
// dusurmez.
const DANGEROUS_PENALTY = 15;
const SUSPICIOUS_PENALTY = 10;
const UNKNOWN_PENALTY = 5;
const SETTING_OFF_PENALTY = 10;

export interface ScoreSettingsContext {
  networkMonitoringEnabled?: boolean;
  /**
   * Kullanicinin gezdigi BENZERSIZ guvenli domain sayisi. Her biri +1 puan
   * bonus getirir; bu bonus, riskli ziyaretlerden gelen cezalari kismen
   * dengeler ve "iyi davranisi" gorunur sekilde odullendirir. Skor 100
   * tavanini asmaz.
   */
  uniqueSafeDomainCount?: number;
}

const SAFE_DOMAIN_BONUS = 1;

export function calculateScore(metrics: WeeklyMetrics, settingsContext?: ScoreSettingsContext): DashboardData {
  const tips: string[] = [];

  // Guard against undefined counters in legacy stored metrics so the math
  // never produces NaN (which renders as a blank in the popup).
  const dangerous = metrics.dangerousSitesVisited ?? 0;
  const suspicious = metrics.suspiciousSitesVisited ?? 0;
  const unknown = metrics.unknownSitesVisited ?? 0;

  const dangerousPenalty = dangerous * DANGEROUS_PENALTY;
  const suspiciousPenalty = suspicious * SUSPICIOUS_PENALTY;
  const unknownPenalty = unknown * UNKNOWN_PENALTY;

  // Detayli Guvenlik Taramasi (networkMonitoring) modulu kapaliysa skor
  // -10 puan ceza alir. Acikken ek puan EKLENMEZ (skor 100 tavanini asmaz),
  // sadece -10 cezadan kacindirir; UI "ayar aktif" yesil bilgi gostererek
  // bunu kullaniciya hatirlatir.
  const settingsPenalty = settingsContext?.networkMonitoringEnabled === false ? SETTING_OFF_PENALTY : 0;

  // Guvenli sitelerde gezme bonusu — benzersiz SAFE domain sayisi * 1 puan.
  // Cezalari kismen dengeler; toplam skor 100 tavaninda kapali.
  const safeBonus = (settingsContext?.uniqueSafeDomainCount ?? 0) * SAFE_DOMAIN_BONUS;

  // "Tehdit yoksa +10, risk yoksa +5" odullendirmesi — cezalarin tam tersi
  // konumda pozitif pekistirme. Kullanici "0 tehdit" goruyorsa skor da
  // bunu odullendirmeli, sadece "ceza almadim" demek yetmiyor.
  const cleanThreatReward = dangerous + suspicious === 0 ? 10 : 0;
  const cleanRiskReward = unknown === 0 ? 5 : 0;

  const totalPenalty = dangerousPenalty + suspiciousPenalty + unknownPenalty + settingsPenalty;
  const rawScore = STARTING_SCORE - totalPenalty + safeBonus + cleanThreatReward + cleanRiskReward;
  const score = Math.max(MIN_SCORE, Math.min(STARTING_SCORE, rawScore));

  if (dangerous > 0) {
    tips.push(t.tips.dangerousSites(dangerous));
  } else if (suspicious > 0) {
    tips.push(t.tips.suspiciousSites(suspicious));
  }

  if ((metrics.urlsChecked ?? 0) === 0) {
    tips.push(t.tips.notActive);
  }

  // Breakdown is split so legacy consumers still see deterministic numbers.
  // - threatAvoidanceScore: how much of the 100 is left = the score itself.
  // - dangerous/suspicious/unknown counters live in metrics; we surface
  //   the per-bucket penalty in the breakdown for any UI that wants it.
  const breakdown: ScoreBreakdown = {
    httpsScore: 0,
    threatAvoidanceScore: score,
    activityScore: 0,
    trackerScore: 0,
  };

  return {
    score,
    breakdown,
    currentWeek: metrics,
    previousWeek: null,
    tips,
  };
}
