import { useEffect, useState, type ReactNode } from "react";
import { type ScanHistoryEntry } from "@/utils/types";
import t from "@/i18n/tr";
import { SkorCountButton, SkorFilteredList } from "../DashboardTab";

/**
 * Sayac karti altina acilan listelerin acilis/kapanis animasyonunu
 * hayata gecirir.
 *
 * Eskiden `{condition && <List />}` ile anlik unmount oluyor → liste "sak"
 * diye kayboluyordu. Burada `open=false`'a gecince once kapanis animasyonu
 * tetiklenir (history-panel-lift), 240ms sonra gercek unmount. Acilirken
 * icteki SkorFilteredList kendi history-panel-drop class'i ile zaten
 * yumusakca giriyor; wrapper saydam kalir.
 */
const CLOSE_ANIM_MS = 380;
function CollapsibleListSection({ open, children }: { open: boolean; children: ReactNode }) {
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
      return;
    }
    if (!render) return;
    setClosing(true);
    const id = window.setTimeout(() => {
      setRender(false);
      setClosing(false);
    }, CLOSE_ANIM_MS);
    return () => window.clearTimeout(id);
  }, [open, render]);

  if (!render) return null;

  return <div className={closing ? "history-panel-lift" : ""}>{children}</div>;
}

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
      <CollapsibleListSection open={durumSkorFilter === "control"}>
        <SkorFilteredList filter="control" history={history} />
      </CollapsibleListSection>

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
      <CollapsibleListSection open={durumSkorFilter === "threat"}>
        <SkorFilteredList filter="threat" history={history} />
      </CollapsibleListSection>

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
      <CollapsibleListSection open={durumSkorFilter === "unknown"}>
        <SkorFilteredList filter="unknown" history={history} />
      </CollapsibleListSection>
    </div>
  );
}
