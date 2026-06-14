// Theme system for popup + options. Uses CSS custom properties so inline
// React styles can read `var(--token)` and switch automatically when the
// body's `data-theme` attribute flips.
//
// Why CSS variables instead of a React context? The popup mixes hundreds of
// inline-styled elements with hand-written CSS in popup.html. Variables are
// the only mechanism that flows through BOTH cleanly without a giant
// refactor: each component just uses `var(--surface)` etc. and gets the
// right colour for free.

export const THEME_STYLE_ID = "alparslan-theme-vars";

/**
 * Inject the global `:root` / `[data-theme="dark"]` variable definitions
 * once. Subsequent calls are no-ops thanks to the id check.
 */
export function injectThemeStyles(): void {
  if (document.getElementById(THEME_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = THEME_STYLE_ID;
  style.textContent = `
:root {
  --surface: #ffffff;
  --surface-elevated: #f9fafb;
  --surface-card: #ffffff;
  --surface-card-hover: #f1f5f9;
  --text: #1e293b;
  --text-strong: #0f172a;
  --text-muted: #6b7280;
  --text-faint: #9ca3af;
  --border: #e5e7eb;
  --border-strong: #d1d5db;
  --divider: #f3f4f6;
  --ring-track: #e5e7eb;
  --scrollbar-thumb: #cbd5e1;
  --scrollbar-thumb-hover: #94a3b8;

  /* Category buttons — colour tokens differ between light and dark */
  --btn-success-bg: #f0fdf4;
  --btn-success-bg-hover: #dcfce7;
  --btn-success-border: #86efac;
  --btn-success-text: #16a34a;

  --btn-danger-bg: #fef2f2;
  --btn-danger-bg-hover: #fee2e2;
  --btn-danger-border: #fca5a5;
  --btn-danger-text: #dc2626;

  --btn-info-bg: #eff6ff;
  --btn-info-bg-hover: #dbeafe;
  --btn-info-border: #93c5fd;
  --btn-info-text: #2563eb;

  --btn-warning-bg: #fef3c7;
  --btn-warning-bg-hover: #fde68a;
  --btn-warning-border: #fde68a;
  --btn-warning-text: #d97706;

  --btn-neutral-bg: #e5e7eb;
  --btn-neutral-bg-hover: #d1d5db;
  --btn-neutral-border: #9ca3af;
  --btn-neutral-text: #374151;

  /* Stat-card tints applied only when value > 0. Pastel surfaces with
     matching hairline borders — "antivirus dashboard" feel. */
  --stat-control-bg: #f1f5f9;
  --stat-control-border: #e2e8f0;
  --stat-threat-bg: #fef2f2;
  --stat-threat-border: #fecaca;
  --stat-tracker-bg: #fff7ed;
  --stat-tracker-border: #fed7aa;
  --stat-unknown-bg: #eef2ff;
  --stat-unknown-border: #c7d2fe;

  /* History / filtered-list surfaces — soft neutral grey so the dropdown
     reads as a distinct panel below the Durum hero, not a continuation of
     the page surface. */
  --list-surface: #f1f5f9;
  --list-surface-title: #e2e8f0;

  /* BRAND / SEMANTIC ACCENT TOKENS
     Inline kullanim icin tek kaynak: artik App.tsx / DashboardTab.tsx vb.
     yerlerde tekrar tekrar yazilan #dc2626, #16a34a, #2563eb gibi hex
     degerleri yerine var(--accent-...) tercih ediliyor. Hem light hem
     dark modda AYNI degerle tanimli, yani renk davranisi DEGISMEZ,
     sadece "rengi degistirmek istersen tek yerde degistirirsin" rahatligi
     gelir. */
  --accent-danger: #dc2626;
  --accent-danger-dark: #1d4ed8;
  --accent-success: #16a34a;
  --accent-success-bright: #22c55e;  /* aktif toggle / bright pulse */
  --accent-info: #2563eb;
  --accent-info-bright: #3b82f6;     /* brand blue / accent bar */
  --accent-info-deep: #1d4ed8;       /* hover/active blue */
  --accent-warning: #d97706;
  --accent-navy: #1e3a8a;            /* popup header gradient start */
  --accent-navy-deep: #0f172a;       /* popup header gradient end */
}

[data-theme="dark"] {
  --surface: #0a1428;
  --surface-elevated: #111e36;
  --surface-card: #1e293b;
  --surface-card-hover: #334155;
  --text: #f1f5f9;
  --text-strong: #ffffff;
  --text-muted: #cbd5e1;
  --text-faint: #94a3b8;
  --border: #334155;
  --border-strong: #475569;
  --divider: #1e293b;
  --ring-track: #334155;
  --scrollbar-thumb: #475569;
  --scrollbar-thumb-hover: #64748b;

  --btn-success-bg: rgba(22, 163, 74, 0.08);
  --btn-success-bg-hover: rgba(22, 163, 74, 0.18);
  --btn-success-border: #16a34a;
  --btn-success-text: #4ade80;

  --btn-danger-bg: rgba(220, 38, 38, 0.08);
  --btn-danger-bg-hover: rgba(220, 38, 38, 0.18);
  --btn-danger-border: #dc2626;
  --btn-danger-text: #f87171;

  --btn-info-bg: rgba(37, 99, 235, 0.08);
  --btn-info-bg-hover: rgba(37, 99, 235, 0.18);
  --btn-info-border: #2563eb;
  --btn-info-text: #60a5fa;

  --btn-warning-bg: rgba(217, 119, 6, 0.10);
  --btn-warning-bg-hover: rgba(217, 119, 6, 0.20);
  --btn-warning-border: #d97706;
  --btn-warning-text: #fbbf24;

  --btn-neutral-bg: rgba(148, 163, 184, 0.08);
  --btn-neutral-bg-hover: rgba(148, 163, 184, 0.18);
  --btn-neutral-border: #475569;
  --btn-neutral-text: #cbd5e1;

  /* Dark-mode stat tints — low-opacity hue washes over the dark surface so
     the brand colour reads without overpowering the panel. */
  --stat-control-bg: rgba(148, 163, 184, 0.10);
  --stat-control-border: rgba(148, 163, 184, 0.32);
  --stat-threat-bg: rgba(220, 38, 38, 0.12);
  --stat-threat-border: rgba(220, 38, 38, 0.42);
  --stat-tracker-bg: rgba(249, 115, 22, 0.12);
  --stat-tracker-border: rgba(249, 115, 22, 0.42);
  --stat-unknown-bg: rgba(99, 102, 241, 0.12);
  --stat-unknown-border: rgba(99, 102, 241, 0.42);

  --list-surface: #111e36;
  --list-surface-title: #1e293b;

  /* Karanlik modda accent'lar AYNI tutuluyor — boylece inline kullanima
     gecirdigimiz hicbir yerde davranis degisikligi olmuyor. Ileride
     "karanlik modda kirmizi daha parlak olsun" gibi ince ayarlar
     isterseniz, bu degerleri burada ozellestirmek yeterli. */
  --accent-danger: #dc2626;
  --accent-danger-dark: #1d4ed8;
  --accent-success: #16a34a;
  --accent-success-bright: #22c55e;
  --accent-info: #2563eb;
  --accent-info-bright: #3b82f6;
  --accent-info-deep: #1d4ed8;
  --accent-warning: #d97706;
  --accent-navy: #1e3a8a;
  --accent-navy-deep: #0f172a;
}

body { background: var(--surface); color: var(--text); transition: background 0.18s ease, color 0.18s ease; }

/* Slim, rounded, theme-aware scrollbars (popup body + inner scroll areas) */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); background-clip: padding-box; }
::-webkit-scrollbar-corner { background: transparent; }

/* One-time metallic "light sweep" that plays when the popup opens on the
   Durum tab. A diagonal silver beam travels from top-left to bottom-right,
   widening mid-travel and narrowing at the ends (scaleX), fading in/out.
   pointer-events:none so it never blocks clicks; clipped to the overlay. */
.status-sweep-overlay {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 6;
}
.status-sweep-beam {
  position: absolute;
  width: 46%;
  height: 280%;
  /* left/top are animated (corner -> corner). Both axes use % of the popup so
     the diagonal stays true. translate(-50%,-50%) keeps the stripe centred on
     its travelling point; rotate(45deg) makes it a "/" diagonal ribbon; scaleX
     modulates its thickness (small at the corners, wide in the middle). */
  /* Bright, clean grey "shine" — no dark edges, no blur (no shadow). A thin
     glossy light-grey core fades quickly to transparent so it reads as a
     single shiny ray rather than a wide dull band. */
  background: linear-gradient(90deg,
    rgba(214, 218, 224, 0) 44%,
    rgba(220, 224, 229, 0.40) 48%,
    rgba(228, 231, 236, 0.90) 50%,
    rgba(220, 224, 229, 0.40) 52%,
    rgba(214, 218, 224, 0) 56%);
  left: 0%;
  top: 0%;
  /* Constant scaleX so the ray keeps the SAME thickness from start to finish —
     no mid-travel widening (which read as the shadow getting heavier). Only
     position + a short fade in/out are animated; linear = constant speed. */
  transform: translate(-50%, -50%) rotate(45deg) scaleX(0.42);
  animation: statusSweep 1.3s linear 1 forwards;
}
@keyframes statusSweep {
  0%   { left: 0%;   top: 0%;   opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { left: 100%; top: 100%; opacity: 0; }
}

/* Detay listeleri ("panjur gecisi") — list panel slides+fades in, then each
   row staggers in 25 ms apart up to the 12th, after which rows appear instantly
   (so a 50-item history doesn't take 1.25 s to finish entering). Total entry
   animation tops out around 0.6 s. */
@keyframes historyPanelDrop {
  0%   { opacity: 0; transform: translateY(-4px); }
  100% { opacity: 1; transform: translateY(0); }
}
.history-panel-drop {
  animation: historyPanelDrop 0.32s ease-out;
  transform-origin: top;
}
@keyframes historyRowFade {
  0%   { opacity: 0; transform: translateY(-4px); }
  100% { opacity: 1; transform: translateY(0); }
}
.history-row-stagger {
  animation: historyRowFade 0.28s ease-out backwards;
}

/* "Ayar kaydedildi" mikro etkilesim — SettingCard'taki toggle her degistiginde
   bir kerelik soft yesil parlama (border + glow) ile sessiz onay verir. */
@keyframes settingSavedPulse {
  0%   { box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05); border-color: var(--border); }
  35%  { box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.30), 0 0 18px rgba(34, 197, 94, 0.45); border-color: #22c55e; }
  100% { box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05); border-color: var(--border); }
}
.setting-card-saved { animation: settingSavedPulse 0.6s ease-out; }

/* HOVER UTILITY: Ayar karti (ve benzer tiklanabilir kartlar) icin
   state-independent hover efekti. Boylece bilesenler onMouseEnter/Leave
   JS handler'lariyla 20+ yerde tekrar etmek zorunda kalmaz. */
.alparslan-setting-card {
  background: var(--surface-card);
  border: 1px solid var(--border);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  transition: all 0.18s ease;
}
.alparslan-setting-card:hover {
  background: var(--surface-card-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.10);
}

/* Speech-bubble Alparslan logo — one-shot "grow → shake → shrink" reaction
   on hover. NOT infinite: the animation plays once each time the cursor
   enters, then settles back to rest scale. */
.alparslan-bubble-logo {
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.alparslan-bubble-logo:hover {
  animation: alparslanWobble 0.65s ease-in-out 1;
}
@keyframes alparslanWobble {
  0%   { transform: scale(1)    rotate(0deg); }
  18%  { transform: scale(1.12) rotate(-8deg); }
  36%  { transform: scale(1.12) rotate(7deg); }
  54%  { transform: scale(1.12) rotate(-5deg); }
  72%  { transform: scale(1.12) rotate(4deg); }
  85%  { transform: scale(1.08) rotate(0deg); }
  100% { transform: scale(1)    rotate(0deg); }
}

/* Mood expressions — looped status-driven animations on the bubble logo. The
   :hover wobble above overrides these while the cursor is on the logo, then
   the mood animation resumes when the cursor leaves. */

/* Safe — gentle nodding "I approve" motion. */
@keyframes alparslanNod {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-2px); }
}
.alparslan-mood-safe {
  animation: alparslanNod 2.6s ease-in-out infinite;
}

/* Suspicious — slow inquisitive side-to-side tilt. */
@keyframes alparslanTilt {
  0%, 100% { transform: rotate(0deg); }
  30%      { transform: rotate(-4deg); }
  60%      { transform: rotate(4deg); }
}
.alparslan-mood-suspicious {
  animation: alparslanTilt 3s ease-in-out infinite;
}

/* Dangerous — calm most of the loop, then a sharp shield-impact shake every
   ~3 seconds so it reads as a real-time alarm rather than a constant jitter. */
@keyframes alparslanAlarm {
  0%, 49%, 65%, 100% { transform: translateX(0) rotate(0deg); }
  52% { transform: translateX(-3px) rotate(-4deg); }
  55% { transform: translateX(3px)  rotate(4deg); }
  58% { transform: translateX(-2px) rotate(-3deg); }
  61% { transform: translateX(2px)  rotate(2deg); }
}
.alparslan-mood-dangerous {
  animation: alparslanAlarm 3.2s ease-in-out infinite;
}

/* Unknown — slow scanning pulse, like a quiet radar sweep. */
@keyframes alparslanScan {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.045); }
}
.alparslan-mood-unknown {
  animation: alparslanScan 2.2s ease-in-out infinite;
}
`;
  document.head.appendChild(style);
}

/**
 * Flip the active theme by toggling the `data-theme` attribute on body.
 * Components that use `var(--*)` in inline styles update automatically.
 */
export function applyTheme(darkMode: boolean): void {
  document.body.dataset.theme = darkMode ? "dark" : "light";
}
