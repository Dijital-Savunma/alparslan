export type TabId = "status" | "dashboard";

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "status", label: "Durum" },
  { id: "dashboard", label: "Skor" },
];

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", background: "white" }}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            flex: 1,
            padding: "8px 0",
            background: "transparent",
            border: "none",
            borderBottom: activeTab === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
            color: activeTab === tab.id ? "#3b82f6" : "#6b7280",
            fontWeight: activeTab === tab.id ? 600 : 400,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
