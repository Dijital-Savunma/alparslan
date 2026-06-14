// Plain DOM controller for the popup's intro/onboarding overlay
// (#introScreen in popup.html). Sits outside the React tree so the user can
// activate the extension before the React app needs to render anything
// meaningful. Handles:
//   - showing the intro overlay when the extension is disabled
//   - hiding it and revealing #root when enabled
//   - the "activate" button which flips storage + sends background messages
//   - reacting to live storage changes (e.g. user toggled enabled elsewhere)

export function initIntroScreen(): void {
  const introScreen = document.getElementById("introScreen");
  const root = document.getElementById("root");
  const introActivateBtn = document.getElementById("introActivateBtn") as HTMLButtonElement | null;
  const introSwitch = document.getElementById("introSwitch");
  const introSwitchCircle = document.getElementById("introSwitchCircle");
  const introLogo = document.getElementById("introLogo");
  const introSwitchStatus = document.getElementById("introSwitchStatus");

  if (!introScreen || !root || !introActivateBtn) return;

  // Suppresses re-checks while the activation handshake is in flight, so the
  // intro doesn't flicker between states before the storage write commits.
  let ignoreStateCheckUntil = 0;
  let introActivationInProgress = false;

  function showIntroScreen(): void {
    introScreen!.classList.remove("hidden");
    root!.classList.add("hidden");
    introActivateBtn!.disabled = false;
    introSwitch?.classList.remove("active");
    if (introSwitchCircle) introSwitchCircle.textContent = "";
    introLogo?.classList.remove("awake");
    introSwitchStatus?.classList.remove("active");
  }

  function showMainPopup(): void {
    introScreen!.classList.add("hidden");
    root!.classList.remove("hidden");
    introActivateBtn!.disabled = false;
  }

  function updateIntroVisibility(): void {
    if (Date.now() < ignoreStateCheckUntil) return;
    chrome.storage.sync.get(["enabled", "settings"], (result) => {
      if (Date.now() < ignoreStateCheckUntil) return;
      const settings = result.settings || {};
      const isEnabled =
        typeof result.enabled === "boolean" ? result.enabled :
        typeof settings.enabled === "boolean" ? settings.enabled :
        typeof settings.isEnabled === "boolean" ? settings.isEnabled :
        false;
      if (isEnabled) showMainPopup();
      else showIntroScreen();
    });
  }

  updateIntroVisibility();

  introActivateBtn.addEventListener("click", () => {
    introActivateBtn.disabled = true;
    ignoreStateCheckUntil = Date.now() + 2500;
    introActivationInProgress = true;

    introSwitch?.classList.add("active");
    if (introSwitchCircle) introSwitchCircle.textContent = "";
    introLogo?.classList.add("awake");
    introSwitchStatus?.classList.add("active");

    chrome.storage.sync.get(["settings"], (result) => {
      const settings = result.settings || {};
      const updatedSettings = {
        ...settings,
        enabled: true,
        isEnabled: true,
        active: true,
        isActive: true,
        protectionActive: true,
        protectionEnabled: true,
        protectionStartedAt: settings.protectionStartedAt || Date.now(),
        // Alparslan ilk kez aktive edildigi an asistan modu (konusma balonu)
        // her zaman acik gelmeli. Kullanici daha onceden kapatmissa
        // (false), o tercihine saygi gosteririz; aksi takdirde true.
        speechBubbleEnabled: settings.speechBubbleEnabled !== false,
      };
      chrome.storage.sync.set({ enabled: true, settings: updatedSettings }, () => {
        chrome.runtime.sendMessage({ type: "SET_ENABLED", enabled: true });
        chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: updatedSettings });
        setTimeout(() => {
          introActivationInProgress = false;
          showMainPopup();
        }, 1500);
      });
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;

    let newEnabledValue: boolean | null = null;
    if (changes.enabled && typeof changes.enabled.newValue === "boolean") {
      newEnabledValue = changes.enabled.newValue;
    }
    if (changes.settings && changes.settings.newValue) {
      const settings = changes.settings.newValue;
      if (typeof settings.enabled === "boolean") newEnabledValue = settings.enabled;
      else if (typeof settings.isEnabled === "boolean") newEnabledValue = settings.isEnabled;
      else if (typeof settings.protectionEnabled === "boolean") newEnabledValue = settings.protectionEnabled;
    }

    if (newEnabledValue === false) {
      ignoreStateCheckUntil = 0;
      introActivationInProgress = false;
      showIntroScreen();
      return;
    }
    if (newEnabledValue === true) {
      if (introActivationInProgress) return;
      showMainPopup();
      return;
    }
    if (changes.enabled || changes.settings) {
      updateIntroVisibility();
    }
  });
}
