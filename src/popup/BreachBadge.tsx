import { useState, useEffect } from "react";
import type { BreachCheckResult } from "@/breach/types";
import t from "@/i18n/tr";

interface BreachBadgeProps {
  domain: string;
}

export default function BreachBadge({ domain }: BreachBadgeProps) {
  const [breach, setBreach] = useState<BreachCheckResult | null>(null);

  useEffect(() => {
    if (!domain) return;
    chrome.runtime.sendMessage(
      { type: "CHECK_BREACH", domain },
      (response: BreachCheckResult | null) => {
        if (response) setBreach(response);
      },
    );
  }, [domain]);

  if (!domain || !breach?.isBreached || breach.breaches.length === 0) {
    return null;
  }

  const latest = breach.breaches[0];

  return (
    <div
      style={{
        margin: "0 16px",
        padding: "8px 10px",
        background: "var(--quick-whitelist-bg)",
        border: "1px solid var(--quick-whitelist-border)",
        borderRadius: 6,
        fontSize: 11,
        color: "var(--quick-whitelist-text)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 14 }}>{"\uD83D\uDD13"}</span>
      <span>
        {t.breach.badgeDetected(latest.name, latest.date, latest.dataTypes.join(", "))}
      </span>
    </div>
  );
}
