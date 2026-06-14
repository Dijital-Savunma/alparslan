import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initIntroScreen } from "./intro-screen";
import { injectThemeStyles, applyTheme } from "./theme";

// Theme has to come up BEFORE React renders so the first paint already uses
// the user's preferred colours — no white flash for dark-mode users.
injectThemeStyles();
chrome.storage.sync.get(["settings"], (result) => {
  applyTheme(Boolean(result.settings?.darkMode));
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (changes.settings?.newValue) {
    applyTheme(Boolean((changes.settings.newValue as { darkMode?: boolean }).darkMode));
  }
});

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Intro overlay runs synchronously — #root paints immediately while this
// fires in parallel and only takes over if the user hasn't activated yet.
// (Previously a 100 ms setTimeout left the popup blank during the gap.)
initIntroScreen();
