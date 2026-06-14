export type TabId = "status" | "dashboard" | "settings";

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; title: string }[] = [
  { id: "status", label: "Durum", title: "Sayfanın güvenlik durumunu göster" },
  { id: "dashboard", label: "Skor", title: "Haftalık güvenlik skorunu göster" },
  { id: "settings", label: "Ayarlar", title: "Eklenti ayarlarını göster" },
];

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.title}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "var(--surface-card-hover)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
            style={{
              flex: 1,
              padding: "8px 0",
              background: isActive ? "var(--surface-elevated)" : "transparent",
              boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              border: "none",
              borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
              color: isActive ? "#3b82f6" : "var(--text-muted)",
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              borderRadius: 8,
              margin: 4,
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
