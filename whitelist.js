const whitelistInput = document.getElementById("whitelistInput");
const addBtn = document.getElementById("addBtn");
const whitelistList = document.getElementById("whitelistList");
const backBtn = document.getElementById("backBtn");
const searchInput = document.getElementById("searchInput");
const pagination = document.getElementById("pagination");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");

// Sayfa basina max 10 item — DOM'u sinirli tut, uzun listelerde
// scroll/render cokmesi olmasin. Pagination state burada tutuluyor;
// arama veya add/remove sonrasi 1. sayfaya geri donulur.
const PAGE_SIZE = 10;
let currentPage = 1;

// Keep this in sync with normalizeQuickWhitelistDomain in
// src/popup/whitelist-helpers.ts (the unit-tested source of truth).
// Lowercase FIRST so the protocol / www stripping below also catches
// mixed-case input like "HTTPS://WWW.EXAMPLE.COM/"; lowercasing last
// silently leaked "www." into whitelist entries for uppercase pastes.
function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function getSettings(callback) {
  chrome.storage.sync.get(["settings"], (result) => {
    callback(result.settings || {});
  });
}

function saveSettings(settings, callback) {
  chrome.storage.sync.set({ settings }, () => {
    chrome.runtime.sendMessage({
      type: "SETTINGS_UPDATED",
      settings,
    });

    if (callback) callback();
  });
}

function getWhitelist(callback) {
  getSettings((settings) => {
    callback(settings.whitelist || []);
  });
}

function saveWhitelist(whitelist, callback) {
  getSettings((settings) => {
    const updatedSettings = {
      ...settings,
      whitelist,
    };

    saveSettings(updatedSettings, callback);
  });
}

function renderWhitelist() {
  getWhitelist((whitelist) => {
    const searchTerm = normalizeDomain(searchInput.value);

    const filteredWhitelist = whitelist.filter((domain) => {
      return normalizeDomain(domain).includes(searchTerm);
    });

    whitelistList.innerHTML = "";

    if (!whitelist.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Beyaz liste boş";
      whitelistList.appendChild(empty);
      pagination.style.display = "none";
      return;
    }

    if (!filteredWhitelist.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Aramanızla eşleşen site bulunamadı";
      whitelistList.appendChild(empty);
      pagination.style.display = "none";
      return;
    }

    // Sayfa sayisi degisince currentPage hala valid mi kontrol et —
    // ornegin son sayfada tek item varken kullanici onu silerse,
    // currentPage > totalPages olur, otomatik geri al.
    const totalPages = Math.max(1, Math.ceil(filteredWhitelist.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredWhitelist.slice(startIdx, startIdx + PAGE_SIZE);

    pageItems.forEach((domain) => {
      const item = document.createElement("div");
      item.className = "item";

      const text = document.createElement("div");
      text.className = "domain";
      text.textContent = domain;
      text.title = domain;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "Sil";

      removeBtn.addEventListener("click", () => {
        const updatedWhitelist = whitelist.filter((site) => site !== domain);

        saveWhitelist(updatedWhitelist, () => {
          chrome.runtime.sendMessage({
            type: "REMOVE_FROM_WHITELIST",
            domain,
          });

          renderWhitelist();
        });
      });

      item.appendChild(text);
      item.appendChild(removeBtn);
      whitelistList.appendChild(item);
    });

    // Pagination kontrolu — tek sayfaysa hic gosterme. Coksa
    // prev/next disable state'leri + sayfa rozeti guncelle.
    if (totalPages > 1) {
      pagination.style.display = "flex";
      pageInfo.textContent = `${currentPage} / ${totalPages}`;
      prevBtn.disabled = currentPage === 1;
      nextBtn.disabled = currentPage === totalPages;
    } else {
      pagination.style.display = "none";
    }
  });
}

function addDomain() {
  const domain = normalizeDomain(whitelistInput.value);

  if (!domain) return;

  getWhitelist((whitelist) => {
    const updatedWhitelist = whitelist.includes(domain)
      ? whitelist
      : [...whitelist, domain];

    saveWhitelist(updatedWhitelist, () => {
      chrome.runtime.sendMessage({
        type: "ADD_TO_WHITELIST",
        domain,
      });

      whitelistInput.value = "";
      // Yeni eklenen son sayfaya gider — kullanici eklediginin nereye
      // gittigini gormesi icin son sayfaya atla.
      getWhitelist((updated) => {
        const searchTerm = normalizeDomain(searchInput.value);
        const filtered = updated.filter((d) =>
          normalizeDomain(d).includes(searchTerm),
        );
        currentPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        renderWhitelist();
      });
    });
  });
}

addBtn.addEventListener("click", addDomain);

// Arama yapilinca 1. sayfaya don — eski sayfada filtre edilmis sonuc
// olmayabilir, kullanici "neden bos?" demesin.
searchInput.addEventListener("input", () => {
  currentPage = 1;
  renderWhitelist();
});

prevBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderWhitelist();
  }
});

nextBtn.addEventListener("click", () => {
  currentPage += 1;
  renderWhitelist();
});

whitelistInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addDomain();
  }
});

backBtn.addEventListener("click", () => {
  window.close();
});

renderWhitelist();
