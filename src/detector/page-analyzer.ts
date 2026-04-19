// Advanced page content analysis for phishing detection
import t from "@/i18n/tr";

export interface PageAnalysisResult {
  hasLoginForm: boolean;
  hasPasswordField: boolean;
  hasCreditCardField: boolean;
  suspiciousFormAction: boolean;
  externalFormAction: string | null;
  score: number;
  reasons: string[];
}

export function analyzePage(document: Document, currentDomain: string): PageAnalysisResult {
  const reasons: string[] = [];
  let score = 0;

  const forms = document.querySelectorAll("form");
  let hasLoginForm = false;
  let hasPasswordField = false;
  let hasCreditCardField = false;
  let suspiciousFormAction = false;
  let externalFormAction: string | null = null;

  // Check for password fields
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  if (passwordInputs.length > 0) {
    hasPasswordField = true;
    hasLoginForm = true;
    score += 10; // Having a password field is normal, slight signal
  }

  // Check for credit card patterns
  const allInputs = document.querySelectorAll("input");
  for (const input of allInputs) {
    const name = (input.getAttribute("name") || "").toLowerCase();
    const placeholder = (input.getAttribute("placeholder") || "").toLowerCase();
    const autocomplete = (input.getAttribute("autocomplete") || "").toLowerCase();

    if (
      name.match(/card|kredi|kart|cc[-_]?num/) ||
      placeholder.match(/kart|card|kredi/) ||
      autocomplete.includes("cc-number")
    ) {
      hasCreditCardField = true;
      score += 15;
      reasons.push(t.analysis.creditCardRequested);
      break;
    }
  }

  // Check form actions — dedupe by hostname so 10 forms posting to the
  // same admin endpoint produce one reason, not ten.
  const externalHostCounts = new Map<string, number>();
  for (const form of forms) {
    const action = form.getAttribute("action") || "";
    if (action && action.startsWith("http")) {
      try {
        const actionUrl = new URL(action);
        if (actionUrl.hostname !== currentDomain) {
          suspiciousFormAction = true;
          externalFormAction = actionUrl.hostname;
          externalHostCounts.set(
            actionUrl.hostname,
            (externalHostCounts.get(actionUrl.hostname) ?? 0) + 1,
          );
        }
      } catch {
        // Invalid URL in action, slightly suspicious
        score += 5;
      }
    }
  }
  for (const [hostname, count] of externalHostCounts) {
    score += 30;
    reasons.push(t.analysis.externalFormAction(hostname, count));
  }

  // Check for TC Kimlik / TCKN patterns
  const bodyText = document.body?.textContent || "";
  if (bodyText.match(/T\.?C\.?\s*[Kk]imlik|TCKN|TC\s*No/)) {
    if (hasPasswordField || hasCreditCardField) {
      score += 20;
      reasons.push(t.analysis.tcKimlikSensitive);
    }
  }

  // Check for urgency language (Turkish)
  const urgencyPatterns = [
    /hesabiniz\s*(askiya\s*alindi|bloke|kapatilacak)/i,
    /acil\s*(islem|guncelleme|dogrulama)/i,
    /son\s*(saat|dakika|gun).*icinde/i,
    /hemen\s*(tiklayin|giris\s*yapin)/i,
    /guvenlik\s*nedeniyle.*dogrulayin/i,
  ];

  for (const pattern of urgencyPatterns) {
    if (bodyText.match(pattern)) {
      score += 15;
      reasons.push(t.analysis.urgencyLanguage);
      break;
    }
  }

  return {
    hasLoginForm,
    hasPasswordField,
    hasCreditCardField,
    suspiciousFormAction,
    externalFormAction,
    score,
    reasons,
  };
}
