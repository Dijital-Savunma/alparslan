// Advanced page content analysis for phishing detection

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
      reasons.push("Kredi karti bilgisi isteniyor");
      break;
    }
  }

  // Check form actions
  for (const form of forms) {
    const action = form.getAttribute("action") || "";
    if (action && action.startsWith("http")) {
      try {
        const actionUrl = new URL(action);
        if (actionUrl.hostname !== currentDomain) {
          suspiciousFormAction = true;
          externalFormAction = actionUrl.hostname;
          score += 30;
          reasons.push(`Form verisi farkli sunucuya gonderiliyor: ${actionUrl.hostname}`);
        }
      } catch {
        // Invalid URL in action, slightly suspicious
        score += 5;
      }
    }
  }

  // Check for TC Kimlik / TCKN patterns
  const bodyText = document.body?.textContent || "";
  if (bodyText.match(/T\.?C\.?\s*[Kk]imlik|TCKN|TC\s*No/)) {
    if (hasPasswordField || hasCreditCardField) {
      score += 20;
      reasons.push("TC Kimlik numarasi ve hassas bilgi birlikte isteniyor");
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
      reasons.push("Aciliyet yaratan dil kullaniliyor");
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
