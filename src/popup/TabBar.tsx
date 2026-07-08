export type TabId = "status" | "dashboard";

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; title: string }[] = [
  { id: "status", label: "Durum", title: "Sayfanın güvenlik durumunu göster" },
  { id: "dashboard", label: "Skor", title: "Haftalık güvenlik skorunu göster" },
];

/**
 * Tab bar — kayan pill animasyonu. Basit ve garantili: piksel-bazli
 * `left` degeriyle transition. Popup genisligi 340 sabit oldugu icin
 * matematik acik: her buton 170px genislikte, pill her yerinde 4px
 * inset.
 */
export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.id === activeTab));
  // Pill artik sol/sag kenarda flush — 4px inset yok. Underline
  // konteynerin en ucuna kadar uzanir, "bosluk" gorunmez.
  const pillLeft = activeIndex === 0 ? 0 : 170;
  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        position: "relative",
        height: 40,
      }}
    >
      {/* Kayan aktif pill — kenardan kenara oturur (left 0 <-> 170,
          width 170). Blue underline (2px) pill'in alt kenari; edge-to-
          edge cizilir. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 4,
          bottom: 0,
          left: pillLeft,
          width: 170,
          background: "var(--surface-elevated)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          borderRadius: "8px 8px 0 0",
          borderBottom: "2px solid var(--accent-info-bright)",
          transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.title}
            style={{
              flex: 1,
              padding: 0,
              background: "transparent",
              border: "none",
              color: isActive ? "var(--accent-info-bright)" : "var(--text-muted)",
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "color 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              position: "relative",
              zIndex: 1,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
