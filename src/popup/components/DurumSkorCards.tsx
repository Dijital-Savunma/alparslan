import { type ScanHistoryEntry } from "@/utils/types";
import t from "@/i18n/tr";
import { SkorCountButton, SkorFilteredList } from "../DashboardTab";

/**
 * Durum sekmesinin altinda gosterilen 3 sayac kartı (Tarama Geçmişi /
 * Engellenen Tehdit / Potansiyel Risk) + her birinin tiklaninca acilan
 * filtreli liste.
 *
 * Sayilar TEK kaynaktan (history) gelir; kart sayilari ile listede
 * gosterilen eleman sayisi birebir ayni olur — eskiden stats.* session
 * sayaclarini kullanip uyusmazlik dogabiliyordu.
 *
 * State App.tsx'te (durumSkorFilter / setDurumSkorFilter); component
 * sadece props ile render eder.
 */
export function DurumSkorCards({
  history,
  durumSkorFilter,
  onSkorClick,
}: {
  history: ScanHistoryEntry[];
  durumSkorFilter: "control" | "threat" | "unknown" | null;
  onSkorClick: (filter: "control" | "threat" | "unknown") => void;
}) {
  const controlCount = history.length;
  const threatCount = history.filter(
    (h) => h.level === "DANGEROUS" || h.level === "SUSPICIOUS",
  ).length;
  const unknownCount = history.filter((h) => h.level === "UNKNOWN").length;

  return (
    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <SkorCountButton
        icon="🔍"
        label={t.skorCards.control}
        activeLabel={t.skorCards.controlClose}
        zeroText={t.skorCards.controlZero}
        value={controlCount}
        variant="neutral"
        active={durumSkorFilter === "control"}
        onClick={() => onSkorClick("control")}
        title={t.skorCards.controlTooltip}
        activeTitle={t.skorCards.controlTooltipClose}
      />
      {durumSkorFilter === "control" && (
        <SkorFilteredList filter="control" history={history} />
      )}

      <SkorCountButton
        icon="🚨"
        label={t.skorCards.threat}
        activeLabel={t.skorCards.threatClose}
        zeroText={t.skorCards.threatZero}
        value={threatCount}
        variant="danger"
        active={durumSkorFilter === "threat"}
        onClick={() => onSkorClick("threat")}
        title={t.skorCards.threatTooltip}
        activeTitle={t.skorCards.threatTooltipClose}
      />
      {durumSkorFilter === "threat" && (
        <SkorFilteredList filter="threat" history={history} />
      )}

      <SkorCountButton
        icon="❔"
        label={t.skorCards.unknown}
        activeLabel={t.skorCards.unknownClose}
        zeroText={t.skorCards.unknownZero}
        value={unknownCount}
        variant="info"
        active={durumSkorFilter === "unknown"}
        onClick={() => onSkorClick("unknown")}
        title={t.skorCards.unknownTooltip}
        activeTitle={t.skorCards.unknownTooltipClose}
      />
      {durumSkorFilter === "unknown" && (
        <SkorFilteredList filter="unknown" history={history} />
      )}
    </div>
  );
}
