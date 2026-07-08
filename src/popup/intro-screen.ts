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

  // Intro overlay React app boot'undan ONCE gorunur — main.tsx'te
  // uygulanacak data-theme henuz set edilmemis olur. Karanlik mod
  // ayari kullaniciysa, intro dogrudan karanlik acilsin diye burada
  // storage'dan okuyup body.dataset.theme'e yazariz (idempotent).
  chrome.storage.sync.get(["settings"], (result) => {
    const settings = result.settings || {};
    if (settings.darkMode === true) document.body.dataset.theme = "dark";
    else if (settings.darkMode === false) document.body.dataset.theme = "light";
  });

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

  // Intro logosuna sürükle-döndür 3D animasyonu ekler.
  // StatusPanel'deki DraggableLogo ile ayni: yatay hareket rotateY,
  // dikey hareket rotateX; birakinca momentum'la döner, sürtünmeyle söner.
  // Logo artik button'un DISINDA — tiklama korumayi aktive etmez.
  if (introLogo) {
    let rotationX = 0;
    let rotationY = 0;
    let isDragging = false;
    let dragState: {
      startX: number;
      startY: number;
      startRotationX: number;
      startRotationY: number;
      lastX: number;
      lastY: number;
      lastTime: number;
      velocityX: number;
      velocityY: number;
    } | null = null;
    let animRaf: number | null = null;
    let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
    let mouseUpHandler: (() => void) | null = null;

    const applyTransform = (scale = 1) => {
      const t = `rotateX(${rotationX}deg) rotateY(${rotationY}deg) scale(${scale})`;
      (introLogo as HTMLElement).style.transform = t;
    };

    const stopAnim = () => {
      if (animRaf !== null) {
        cancelAnimationFrame(animRaf);
        animRaf = null;
      }
    };

    // [-180, 180] araligina indir. rotate(350deg) ile rotate(-10deg) ekranda
    // ozdes; boylece spring-back kisa yolu izleyip tam donusler yapmaz.
    const wrapAngle = (a: number) => (((a + 180) % 360) + 360) % 360 - 180;

    // Momentum bittiginde otomatik olarak spring-back'e devrolur:
    // birakildigi acida takilmaz, yavas yavas 0'a doner.
    const runSpringBack = () => {
      rotationX = wrapAngle(rotationX);
      rotationY = wrapAngle(rotationY);
      const step = () => {
        rotationX *= 0.88;
        rotationY *= 0.88;
        applyTransform(1);
        if (Math.abs(rotationX) > 0.3 || Math.abs(rotationY) > 0.3) {
          animRaf = requestAnimationFrame(step);
        } else {
          rotationX = 0;
          rotationY = 0;
          applyTransform(1);
          animRaf = null;
        }
      };
      animRaf = requestAnimationFrame(step);
    };

    const runMomentum = (vx: number, vy: number) => {
      const step = () => {
        vx *= 0.94;
        vy *= 0.94;
        rotationY += vx;
        rotationX -= vy;
        applyTransform(1);
        if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
          animRaf = requestAnimationFrame(step);
        } else {
          animRaf = null;
          runSpringBack();
        }
      };
      animRaf = requestAnimationFrame(step);
    };

    introLogo.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      stopAnim();
      isDragging = true;
      introLogo.classList.add("dragging");
      const now = performance.now();
      dragState = {
        startX: e.clientX,
        startY: e.clientY,
        startRotationX: rotationX,
        startRotationY: rotationY,
        lastX: e.clientX,
        lastY: e.clientY,
        lastTime: now,
        velocityX: 0,
        velocityY: 0,
      };
      applyTransform(1.06);

      mouseMoveHandler = (ev: MouseEvent) => {
        if (!isDragging || !dragState) return;
        const dx = ev.clientX - dragState.startX;
        const dy = ev.clientY - dragState.startY;
        rotationY = dragState.startRotationY + dx;
        rotationX = dragState.startRotationX - dy;
        const t = performance.now();
        const dt = t - dragState.lastTime;
        if (dt > 0) {
          const instVx = ev.clientX - dragState.lastX;
          const instVy = ev.clientY - dragState.lastY;
          dragState.velocityX = dragState.velocityX * 0.3 + instVx * 0.7;
          dragState.velocityY = dragState.velocityY * 0.3 + instVy * 0.7;
        }
        dragState.lastX = ev.clientX;
        dragState.lastY = ev.clientY;
        dragState.lastTime = t;
        applyTransform(1.06);
      };

      mouseUpHandler = () => {
        if (!isDragging || !dragState) return;
        isDragging = false;
        introLogo.classList.remove("dragging");
        const vx = dragState.velocityX;
        const vy = dragState.velocityY;
        dragState = null;
        applyTransform(1);
        if (mouseMoveHandler) window.removeEventListener("mousemove", mouseMoveHandler);
        if (mouseUpHandler) window.removeEventListener("mouseup", mouseUpHandler);
        mouseMoveHandler = null;
        mouseUpHandler = null;
        if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
          runMomentum(vx, vy);
        } else {
          runSpringBack();
        }
      };

      window.addEventListener("mousemove", mouseMoveHandler);
      window.addEventListener("mouseup", mouseUpHandler);
    });

    // Tarayici resim surukleme davranisini engelle (gorsel bozulmasin).
    introLogo.addEventListener("dragstart", (e) => e.preventDefault());
  }

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
