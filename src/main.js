// Main Application Controller - Asalynn Management Project
// Zona Waktu: Asia/Makassar (WITA, UTC+8)

import { store, getWitaDate, getWitaTimeString, formatRupiah } from "./services/store.js";

// Helper Toast Notification
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Format nomor HP untuk link WhatsApp (08xx -> 628xx)
function formatWaLink(phone, message = "") {
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }
  const textParam = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${cleaned}${textParam}`;
}

// App State
let activeTab = "orders";
let orderSearchQuery = "";
let orderFilterStatus = "ALL";
let orderFilterCourier = "ALL";
let orderFilterDate = getWitaDate();

let customerSearchQuery = "";
let reconciliationDate = getWitaDate();

// Inisialisasi Aplikasi
function initApp() {
  initClock();
  initTabNavigation();
  initModalListeners();
  initFormHandlers();
  initAuthUI();
  initSettingsUI();

  // Subscribe ke perubahan store
  store.subscribe(() => {
    updateHeaderAccountWidget();
    renderApp();
  });

  // Render awal
  updateHeaderAccountWidget();
  renderApp();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// ==========================================
// 0. AUTHENTICATION & LOGIN MENU CONTROLLER
// ==========================================
let authSelectedUserId = "usr-admin-1";
let authEnteredPin = "";

function updateHeaderAccountWidget() {
  const accountWidget = document.getElementById("user-account-widget");
  const btnHeaderLogin = document.getElementById("btn-header-login");
  const avatarEl = document.getElementById("header-user-avatar");
  const nameEl = document.getElementById("header-user-name");
  const roleEl = document.getElementById("header-user-role");

  const ddAvatar = document.getElementById("dropdown-user-avatar");
  const ddName = document.getElementById("dropdown-user-name");
  const ddPhone = document.getElementById("dropdown-user-phone");
  const ddTag = document.getElementById("dropdown-user-tag");

  const user = store.getCurrentUser();
  const btnQuickSettings = document.getElementById("btn-quick-settings");

  if (store.isLoggedIn() && user) {
    if (accountWidget) accountWidget.style.display = "block";
    if (btnQuickSettings) btnQuickSettings.style.display = "inline-flex";
    if (btnHeaderLogin) btnHeaderLogin.style.display = "none";

    const avatar = "👑";

    if (avatarEl) avatarEl.textContent = avatar;
    if (nameEl) nameEl.textContent = user.name.split(" ")[0];
    if (roleEl) roleEl.textContent = "Owner";

    if (ddAvatar) ddAvatar.textContent = avatar;
    if (ddName) ddName.textContent = user.name;
    if (ddPhone) ddPhone.textContent = user.phone;
    if (ddTag) ddTag.textContent = "Pemilik & Admin Depot";
  } else {
    // Sembunyikan elemen dashboard saat di Landing Page Login
    if (accountWidget) accountWidget.style.display = "none";
    if (btnQuickSettings) btnQuickSettings.style.display = "none";
    if (btnHeaderLogin) btnHeaderLogin.style.display = "none";
  }
}

function initAuthUI() {
  const accountWidget = document.getElementById("user-account-widget");
  const btnAccountMenu = document.getElementById("btn-account-menu");
  const btnSwitchAccount = document.getElementById("btn-open-login-modal");
  const btnLogout = document.getElementById("btn-logout");
  const btnHeaderLogin = document.getElementById("btn-header-login");

  // Toggle dropdown menu akun
  if (btnAccountMenu && accountWidget) {
    btnAccountMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      accountWidget.classList.toggle("open");
    });
  }

  // Tutup dropdown jika klik di luar
  document.addEventListener("click", (e) => {
    if (accountWidget && !accountWidget.contains(e.target)) {
      accountWidget.classList.remove("open");
    }
  });

  // Tombol Ganti Akun / Pindah Peran
  if (btnSwitchAccount) {
    btnSwitchAccount.addEventListener("click", () => {
      if (accountWidget) accountWidget.classList.remove("open");
      openLoginModal();
    });
  }

  // Tombol Keluar (Logout)
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      if (accountWidget) accountWidget.classList.remove("open");
      store.logout();
      showToast("Anda telah keluar dari sesi operasional.", "info");
      updateHeaderAccountWidget();
      renderApp();
      openLoginModal();
    });
  }

  // Tombol Login di Header (saat logout)
  if (btnHeaderLogin) {
    btnHeaderLogin.addEventListener("click", () => {
      openLoginModal();
    });
  }

  // Tombol Keypad Virtual Numpad
  const numpadKeys = document.querySelectorAll(".keypad-key[data-digit]");
  numpadKeys.forEach(btn => {
    btn.addEventListener("click", () => {
      const digit = btn.getAttribute("data-digit");
      if (digit !== null) {
        handlePinInput(digit);
      }
    });
  });

  document.getElementById("btn-keypad-clear")?.addEventListener("click", () => {
    authEnteredPin = "";
    updatePinDots();
    hidePinError();
  });

  document.getElementById("btn-keypad-backspace")?.addEventListener("click", () => {
    if (authEnteredPin.length > 0) {
      authEnteredPin = authEnteredPin.slice(0, -1);
      updatePinDots();
      hidePinError();
    }
  });

  document.getElementById("btn-do-login")?.addEventListener("click", () => {
    submitLogin();
  });

  // Demo Pin Chips
  document.querySelectorAll(".demo-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const userId = chip.getAttribute("data-user");
      const pin = chip.getAttribute("data-pin");
      if (userId && pin) {
        authSelectedUserId = userId;
        authEnteredPin = pin;
        renderLoginProfiles();
        updatePinDots();
        submitLogin();
      }
    });
  });

  // Dukungan Keyboard Fisik untuk PIN saat modal aktif
  window.addEventListener("keydown", (e) => {
    const modal = document.getElementById("modal-login-account");
    if (!modal || !modal.classList.contains("active")) return;

    if (e.key >= "0" && e.key <= "9") {
      handlePinInput(e.key);
    } else if (e.key === "Backspace") {
      if (authEnteredPin.length > 0) {
        authEnteredPin = authEnteredPin.slice(0, -1);
        updatePinDots();
        hidePinError();
      }
    } else if (e.key === "Enter") {
      submitLogin();
    } else if (e.key === "Escape") {
      if (store.isLoggedIn()) {
        closeModal("modal-login-account");
      }
    }
  });
}

function openSettingsModal() {
  const currentUser = store.getCurrentUser();
  const userEl = document.getElementById("settings-current-user");
  const ordersEl = document.getElementById("settings-count-orders");
  const custsEl = document.getElementById("settings-count-customers");

  if (userEl) userEl.textContent = currentUser ? currentUser.name : "Belum Login";
  if (ordersEl) ordersEl.textContent = `${store.data.orders.length} pesanan`;
  if (custsEl) custsEl.textContent = `${store.data.customers.length} orang`;

  // Pre-fill profil pengguna aktif
  const usernameInput = document.getElementById("settings-new-username");
  const phoneInput = document.getElementById("settings-new-phone");
  const currentPinInput = document.getElementById("settings-current-pin");
  const newPinInput = document.getElementById("settings-new-pin");
  const feedbackEl = document.getElementById("settings-profile-feedback");

  if (currentUser) {
    if (usernameInput) usernameInput.value = currentUser.name;
    if (phoneInput) phoneInput.value = currentUser.phone;
  }
  if (currentPinInput) currentPinInput.value = "";
  if (newPinInput) newPinInput.value = "";
  if (feedbackEl) feedbackEl.style.display = "none";

  openModal("modal-global-settings");
}

function initSettingsUI() {
  const btnQuickSettings = document.getElementById("btn-quick-settings");
  const btnDropdownSettings = document.getElementById("btn-open-settings-modal");

  btnQuickSettings?.addEventListener("click", () => {
    openSettingsModal();
  });

  btnDropdownSettings?.addEventListener("click", () => {
    const dd = document.getElementById("account-dropdown-menu");
    if (dd) dd.classList.remove("show");
    openSettingsModal();
  });

  // Export JSON from settings modal
  document.getElementById("btn-settings-export")?.addEventListener("click", () => {
    const jsonStr = store.exportJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asalynn-backup-${getWitaDate()}.json`;
    a.click();
    showToast("File cadangan JSON berhasil diunduh!", "success");
  });

  // Import JSON from settings modal
  document.getElementById("settings-import-file")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const res = store.importJSON(evt.target.result);
      if (res.success) {
        showToast("Data cadangan berhasil dipulihkan!", "success");
        closeModal("modal-global-settings");
        renderApp();
      } else {
        showToast(`Gagal memulihkan: ${res.message}`, "error");
      }
    };
    reader.readAsText(file);
  });

  // Trigger Reset Global (Open confirmation modal)
  document.getElementById("btn-trigger-global-reset")?.addEventListener("click", () => {
    openModal("modal-confirm-global-reset");
  });

  // Execute Reset Global (Reset to 0)
  document.getElementById("btn-execute-global-reset")?.addEventListener("click", async () => {
    // 1. Reset local store ke 0 (Kosongkan transaksi & pelanggan)
    store.resetToZero();

    // 2. Jika backend API aktif, sinkronkan reset 0 ke backend
    try {
      await fetch("/api/system/clear-zero", { method: "POST" });
    } catch (err) {
      // Local storage tetap berhasil direset
    }

    closeModal("modal-confirm-global-reset");
    closeModal("modal-global-settings");
    showToast("✅ Database berhasil direset ke 0! Seluruh pelanggan & transaksi telah dikosongkan. Web siap digunakan dari awal.", "success");
    renderApp();
  });

  // === PROFILE MANAGEMENT HANDLERS ===

  // Helper: tampilkan feedback di dalam modal settings
  function showProfileFeedback(message, isSuccess) {
    const fb = document.getElementById("settings-profile-feedback");
    if (!fb) return;
    fb.textContent = (isSuccess ? "✅ " : "⚠️ ") + message;
    fb.style.display = "block";
    fb.style.background = isSuccess ? "#f0fdf4" : "#fff1f2";
    fb.style.color = isSuccess ? "#166534" : "#9f1239";
    fb.style.border = `1px solid ${isSuccess ? "#bbf7d0" : "#fecdd3"}`;

    // Auto-hide setelah 4 detik
    setTimeout(() => {
      fb.style.display = "none";
    }, 4000);
  }

  // Ubah Nama Pengguna
  document.getElementById("btn-save-username")?.addEventListener("click", () => {
    const input = document.getElementById("settings-new-username");
    const newName = input ? input.value : "";
    const result = store.updateCurrentUserName(newName);
    if (result.success) {
      showProfileFeedback(`Nama berhasil diubah dari "${result.oldName}" menjadi "${result.newName}".`, true);
      showToast(`Nama pengguna berhasil diubah menjadi "${result.newName}".`, "success");
      updateHeaderAccountWidget();
      renderApp();
    } else {
      showProfileFeedback(result.message, false);
    }
  });

  // Ubah Nomor Telepon
  document.getElementById("btn-save-phone")?.addEventListener("click", () => {
    const input = document.getElementById("settings-new-phone");
    const newPhone = input ? input.value : "";
    const result = store.updateCurrentUserPhone(newPhone);
    if (result.success) {
      showProfileFeedback(`Nomor telepon berhasil diubah menjadi ${result.newPhone}.`, true);
      showToast("Nomor telepon berhasil diperbarui.", "success");
      updateHeaderAccountWidget();
    } else {
      showProfileFeedback(result.message, false);
    }
  });

  // Ubah PIN Login
  document.getElementById("btn-save-pin")?.addEventListener("click", () => {
    const currentPinInput = document.getElementById("settings-current-pin");
    const newPinInput = document.getElementById("settings-new-pin");
    const currentPin = currentPinInput ? currentPinInput.value : "";
    const newPin = newPinInput ? newPinInput.value : "";
    const result = store.updateCurrentUserPin(currentPin, newPin);
    if (result.success) {
      showProfileFeedback("PIN login berhasil diperbarui.", true);
      showToast("PIN login berhasil diubah.", "success");
      if (currentPinInput) currentPinInput.value = "";
      if (newPinInput) newPinInput.value = "";
    } else {
      showProfileFeedback(result.message, false);
    }
  });
}

function openLoginModal(defaultUserId) {
  const currentUser = store.getCurrentUser();
  authSelectedUserId = defaultUserId || (currentUser ? currentUser.id : "usr-admin-1");
  authEnteredPin = "";
  hidePinError();
  renderLoginProfiles();
  updatePinDots();
  openModal("modal-login-account");
}

function renderLoginProfiles() {
  const container = document.getElementById("login-profile-selector");
  if (!container) return;

  const adminUsers = (store.data.users || []).filter(u => u.role === "admin");
  const usersToDisplay = adminUsers.length > 0 ? adminUsers : store.data.users;

  if (!usersToDisplay.some(u => u.id === authSelectedUserId)) {
    authSelectedUserId = usersToDisplay[0]?.id || "usr-admin-1";
  }

  container.innerHTML = usersToDisplay.map(u => {
    const isSelected = u.id === authSelectedUserId;
    return `
      <div class="profile-card-option ${isSelected ? 'active' : ''}" data-user-id="${u.id}">
        <div class="profile-card-left">
          <div class="profile-card-avatar">👑</div>
          <div>
            <div class="profile-card-name">${u.name}</div>
            <div class="profile-card-sub">Pemilik & Admin Depot • ${u.phone}</div>
          </div>
        </div>
        <span class="profile-card-badge">Admin</span>
      </div>
    `;
  }).join("");

  const selectedUser = users.find(u => u.id === authSelectedUserId);
  const targetNameEl = document.getElementById("pin-target-name");
  if (targetNameEl && selectedUser) {
    targetNameEl.textContent = selectedUser.name;
  }

  container.querySelectorAll(".profile-card-option").forEach(card => {
    card.addEventListener("click", () => {
      authSelectedUserId = card.getAttribute("data-user-id");
      authEnteredPin = "";
      hidePinError();
      renderLoginProfiles();
      updatePinDots();
    });
  });
}

function handlePinInput(digit) {
  if (authEnteredPin.length < 4) {
    authEnteredPin += digit;
    updatePinDots();
    hidePinError();

    if (authEnteredPin.length === 4) {
      setTimeout(() => {
        submitLogin();
      }, 150);
    }
  }
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`pindot-${i}`);
    if (dot) {
      if (i < authEnteredPin.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled");
      }
    }
  }
}

function hidePinError() {
  const errBox = document.getElementById("login-error-box");
  if (errBox) errBox.style.display = "none";
}

function showPinError(msg) {
  const errBox = document.getElementById("login-error-box");
  const errMsg = document.getElementById("login-error-msg");
  const pinDisplay = document.getElementById("pin-dots-display");

  if (errMsg) errMsg.textContent = msg;
  if (errBox) errBox.style.display = "flex";

  if (pinDisplay) {
    pinDisplay.classList.add("shake-anim");
    setTimeout(() => pinDisplay.classList.remove("shake-anim"), 400);
  }
}

function showLandingPinError(msg) {
  const errBox = document.getElementById("landing-error-box");
  const errMsg = document.getElementById("landing-error-msg");
  const pinDots = document.getElementById("landing-pin-dots");

  if (errMsg) errMsg.textContent = msg;
  if (errBox) errBox.style.display = "flex";

  if (pinDots) {
    pinDots.classList.add("shake-anim");
    setTimeout(() => pinDots.classList.remove("shake-anim"), 400);
  }
}

function hideLandingPinError() {
  const errBox = document.getElementById("landing-error-box");
  if (errBox) errBox.style.display = "none";
}

function updateLandingPinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`lp-dot-${i}`);
    if (dot) {
      if (i < authEnteredPin.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled");
      }
    }
  }
}

function submitLogin() {
  if (authEnteredPin.length === 0) {
    showPinError("Silakan masukkan 4 digit PIN Anda.");
    showLandingPinError("Silakan masukkan 4 digit PIN Anda.");
    return;
  }

  const result = store.login(authSelectedUserId, authEnteredPin);
  if (result.success) {
    closeModal("modal-login-account");
    showToast(`Selamat datang kembali, ${result.user.name}!`, "success");
    authEnteredPin = "";
    updatePinDots();
    updateLandingPinDots();
    updateHeaderAccountWidget();
    renderApp();
  } else {
    showPinError(result.message || "PIN yang Anda masukkan salah.");
    showLandingPinError(result.message || "PIN yang Anda masukkan salah.");
    authEnteredPin = "";
    updatePinDots();
    updateLandingPinDots();
  }
}

function attachLandingLoginEvents() {
  // Profile selector
  document.querySelectorAll("#landing-profiles-grid .landing-profile-item").forEach(card => {
    card.addEventListener("click", () => {
      authSelectedUserId = card.getAttribute("data-uid");
      authEnteredPin = "";
      hideLandingPinError();
      // Re-render landing page to update active state
      renderApp();
    });
  });

  // Numpad keys
  document.querySelectorAll("#landing-keypad .keypad-key[data-digit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const digit = btn.getAttribute("data-digit");
      if (authEnteredPin.length < 4) {
        authEnteredPin += digit;
        updateLandingPinDots();
        hideLandingPinError();
        if (authEnteredPin.length === 4) {
          setTimeout(() => submitLogin(), 150);
        }
      }
    });
  });

  // Clear
  document.getElementById("lp-btn-clear")?.addEventListener("click", () => {
    authEnteredPin = "";
    updateLandingPinDots();
    hideLandingPinError();
  });

  // Backspace
  document.getElementById("lp-btn-backspace")?.addEventListener("click", () => {
    if (authEnteredPin.length > 0) {
      authEnteredPin = authEnteredPin.slice(0, -1);
      updateLandingPinDots();
      hideLandingPinError();
    }
  });

  // Login button
  document.getElementById("lp-btn-login")?.addEventListener("click", () => {
    submitLogin();
  });

  // Demo chips
  content.querySelectorAll(".demo-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const userId = chip.getAttribute("data-user");
      const pin = chip.getAttribute("data-pin");
      if (userId && pin) {
        authSelectedUserId = userId;
        authEnteredPin = pin;
        updateLandingPinDots();
        // Re-render profile selection then submit
        renderApp();
        // Small delay to let re-render finish, then login
        setTimeout(() => submitLogin(), 100);
      }
    });
  });

  // Keyboard support on landing page (when no modal is open)
  // This is already handled by the global keydown listener in initAuthUI
  // but we need the landing page dots to update too
  updateLandingPinDots();
}

// 1. Clock WITA
function initClock() {
  const clockEl = document.getElementById("clock-display");
  function tick() {
    if (clockEl) {
      clockEl.textContent = getWitaTimeString();
    }
  }
  tick();
  setInterval(tick, 1000);
}

// 2. Tab Navigation
function initTabNavigation() {
  const tabBtns = document.querySelectorAll(".nav-tab");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.getAttribute("data-tab");
      renderApp();
    });
  });
}

// 3. Modal Handlers
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add("active");
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove("active");
}

function initModalListeners() {
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-close");
      closeModal(targetId);
    });
  });

  // Tutup bila klik di luar modal card
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });

  // Stepper Galon Kosong Modal Pengantaran
  document.getElementById("btn-empty-minus")?.addEventListener("click", () => {
    if (currentEmptyReturned > 0) {
      currentEmptyReturned--;
      const el = document.getElementById("val-empty-returned");
      if (el) el.textContent = currentEmptyReturned;
    }
  });
  document.getElementById("btn-empty-plus")?.addEventListener("click", () => {
    currentEmptyReturned++;
    const el = document.getElementById("val-empty-returned");
    if (el) el.textContent = currentEmptyReturned;
  });

  // Presets Bayar
  document.getElementById("preset-pas")?.addEventListener("click", () => {
    document.getElementById("preset-pas")?.classList.add("active");
    document.getElementById("preset-bon")?.classList.remove("active");
    updateDeliveryCalculations();
  });

  document.getElementById("preset-bon")?.addEventListener("click", () => {
    document.getElementById("preset-bon")?.classList.add("active");
    document.getElementById("preset-pas")?.classList.remove("active");
    const amountInput = document.getElementById("delivery-amount-paid");
    if (amountInput) amountInput.value = 0;
  });

  document.getElementById("delivery-amount-paid")?.addEventListener("input", () => {
    document.getElementById("preset-pas")?.classList.remove("active");
    document.getElementById("preset-bon")?.classList.remove("active");
  });
}

// RENDER UTAMA
function renderApp() {
  const content = document.getElementById("app-content");
  if (!content) return;

  const adminTabs = document.getElementById("admin-tabs");

  // Jika belum login, tampilkan Landing Page Menu Login langsung
  if (!store.isLoggedIn()) {
    if (adminTabs) adminTabs.style.display = "none";

    const adminUsers = (store.data.users || []).filter(u => u.role === "admin");
    const users = adminUsers.length > 0 ? adminUsers : store.data.users;
    const selectedUser = users.find(u => u.id === authSelectedUserId) || users[0];

    content.innerHTML = `
      <div class="landing-login-wrapper">
        <!-- Hero Branding -->
        <div class="landing-hero-card">
          <div class="landing-hero-badge">💧</div>
          <h2 class="landing-hero-title">ASALYNN DEPOT</h2>
          <p class="landing-hero-desc">Sistem Manajemen Galon & Pengantaran — Masuk untuk memulai operasional harian depot air minum.</p>
        </div>

        <!-- Portal Login Card -->
        <div class="landing-portal-card">
          <div class="landing-portal-header">
            <h2>🔐 Masuk ke Sistem</h2>
            <p>Pilih akun Anda dan masukkan 4 digit PIN operasional</p>
          </div>

          <div class="landing-portal-body">
            <!-- Pilihan Profil Akun -->
            <div>
              <label class="form-label" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.5rem; display:block;">Pilih Pengguna:</label>
              <div class="landing-profiles-grid" id="landing-profiles-grid">
                ${users.map(u => {
                  const avatar = "👑";
                  const sub = "Pemilik & Kasir Depot • " + u.phone;
                  const tagText = "Admin";
                  const tagClass = "tag-admin";
                  const isActive = u.id === authSelectedUserId;
                  return `
                    <div class="landing-profile-item ${isActive ? 'active' : ''}" data-uid="${u.id}">
                      <div class="landing-item-avatar">${avatar}</div>
                      <div class="landing-item-meta">
                        <span class="landing-item-name">${u.name}</span>
                        <span class="landing-item-sub">${sub}</span>
                      </div>
                      <span class="landing-item-tag ${tagClass}">${tagText}</span>
                    </div>`;
                }).join("")}
              </div>
            </div>

            <!-- PIN Section -->
            <div class="landing-pin-section">
              <div class="landing-pin-header">
                Masukkan PIN untuk: <strong id="landing-pin-target">${selectedUser ? selectedUser.name : ""}</strong>
              </div>

              <div class="pin-dots-display" id="landing-pin-dots">
                <span class="pin-dot" id="lp-dot-0"></span>
                <span class="pin-dot" id="lp-dot-1"></span>
                <span class="pin-dot" id="lp-dot-2"></span>
                <span class="pin-dot" id="lp-dot-3"></span>
              </div>

              <!-- Error -->
              <div class="login-error-box" id="landing-error-box" style="display:none;">
                <span>⚠️</span> <span id="landing-error-msg">PIN salah.</span>
              </div>

              <!-- Virtual Numpad -->
              <div class="virtual-keypad" id="landing-keypad">
                <button type="button" class="keypad-key" data-digit="1">1</button>
                <button type="button" class="keypad-key" data-digit="2">2</button>
                <button type="button" class="keypad-key" data-digit="3">3</button>
                <button type="button" class="keypad-key" data-digit="4">4</button>
                <button type="button" class="keypad-key" data-digit="5">5</button>
                <button type="button" class="keypad-key" data-digit="6">6</button>
                <button type="button" class="keypad-key" data-digit="7">7</button>
                <button type="button" class="keypad-key" data-digit="8">8</button>
                <button type="button" class="keypad-key" data-digit="9">9</button>
                <button type="button" class="keypad-key keypad-action-key" id="lp-btn-clear" title="Bersihkan">C</button>
                <button type="button" class="keypad-key" data-digit="0">0</button>
                <button type="button" class="keypad-key keypad-action-key" id="lp-btn-backspace" title="Hapus">⌫</button>
              </div>
            </div>

            <!-- Tombol Masuk -->
            <button type="button" class="btn btn-primary" id="lp-btn-login" style="width:100%; padding:0.85rem; font-size:1rem; justify-content:center; font-weight:700;">
              <span>🚀</span> Masuk Sekarang
            </button>

            <!-- Demo PIN Hints -->
            <div class="demo-pin-hint-box">
              <div class="demo-hint-title">💡 PIN Default Demo:</div>
              <div class="demo-hint-chips">
                <button type="button" class="demo-chip" data-user="usr-admin-1" data-pin="1234">👑 Hj. Asmawati (Owner): <strong>1234</strong></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners for the landing page login
    attachLandingLoginEvents();
    return;
  }

  // Dashboard Admin Selalu Aktif
  if (adminTabs) adminTabs.style.display = "flex";
  switch (activeTab) {
    case "orders":
      renderOrdersTab(content);
      break;
    case "customers":
      renderCustomersTab(content);
      break;
    case "products":
      renderProductsTab(content);
      break;
    case "reconciliation":
      renderReconciliationTab(content);
      break;
    default:
      renderOrdersTab(content);
  }
}

// Persiapan Modal Selesaikan Pengantaran
let currentDeliveryOrder = null;
let currentDeliveryItemQty = {};
let currentEmptyReturned = 0;

function prepareDeliveryModal(orderId) {
  const order = store.getOrderById(orderId);
  if (!order) return;

  const isReEdit = order.deliveryStatus === "DELIVERED";

  currentDeliveryOrder = order;
  currentDeliveryItemQty = {};
  order.items.forEach(it => {
    currentDeliveryItemQty[it.productId] = it.qtyDelivered || it.qtyOrdered;
  });
  // Jika order sudah selesai (edit mode), prefill galon kosong yg sudah tercatat
  currentEmptyReturned = isReEdit
    ? (order.emptyGallonsReturned || 0)
    : (order.emptyGallonsExpected || 0);

  document.getElementById("delivery-order-id-input").value = order.id;
  document.getElementById("modal-delivery-order-id").textContent = order.id + (isReEdit ? " (Edit Realisasi)" : "");
  document.getElementById("delivery-cust-name").textContent = order.customerName;
  document.getElementById("delivery-cust-address").textContent = order.customerAddress;

  renderDeliveryModalItems();
  updateDeliveryCalculations();

  // Jika edit mode, prefill jumlah pembayaran yg sudah tercatat
  if (isReEdit) {
    document.getElementById("delivery-amount-paid").value = order.totalPaid || 0;
    document.getElementById("preset-pas").classList.remove("active");
    document.getElementById("preset-bon").classList.remove("active");
  } else {
    document.getElementById("preset-pas").classList.add("active");
    document.getElementById("preset-bon").classList.remove("active");
  }
  document.getElementById("delivery-payment-method").value = order.paymentMethod || "CASH";
  document.getElementById("delivery-driver-notes").value = order.driverNotes || "";

  openModal("modal-complete-delivery");
}

function renderDeliveryModalItems() {
  const container = document.getElementById("delivery-stepper-items");
  container.innerHTML = currentDeliveryOrder.items.map(it => `
    <div style="background: #f8fafc; padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: 700; font-size: 0.9rem;">${it.productName}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${formatRupiah(it.unitPrice)} / ${it.unit || 'unit'} (Pesan: ${it.qtyOrdered})</div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <button type="button" class="stepper-btn btn-item-minus" data-prod-id="${it.productId}">-</button>
        <span class="stepper-val" id="val-item-${it.productId}">${currentDeliveryItemQty[it.productId]}</span>
        <button type="button" class="stepper-btn btn-item-plus" data-prod-id="${it.productId}">+</button>
      </div>
    </div>
  `).join("");

  document.getElementById("val-empty-returned").textContent = currentEmptyReturned;

  // Attach stepper listeners
  container.querySelectorAll(".btn-item-minus").forEach(b => {
    b.addEventListener("click", () => {
      const pid = b.getAttribute("data-prod-id");
      if (currentDeliveryItemQty[pid] > 0) {
        currentDeliveryItemQty[pid]--;
        document.getElementById(`val-item-${pid}`).textContent = currentDeliveryItemQty[pid];
        updateDeliveryCalculations();
      }
    });
  });

  container.querySelectorAll(".btn-item-plus").forEach(b => {
    b.addEventListener("click", () => {
      const pid = b.getAttribute("data-prod-id");
      currentDeliveryItemQty[pid]++;
      document.getElementById(`val-item-${pid}`).textContent = currentDeliveryItemQty[pid];
      updateDeliveryCalculations();
    });
  });
}

function updateDeliveryCalculations() {
  let subtotal = 0;
  currentDeliveryOrder.items.forEach(it => {
    const qty = currentDeliveryItemQty[it.productId] || 0;
    subtotal += (it.unitPrice * qty);
  });

  document.getElementById("delivery-actual-subtotal").textContent = formatRupiah(subtotal);

  // Jika preset 'Uang Pas' aktif, sinkronkan input uang diterima
  if (document.getElementById("preset-pas")?.classList.contains("active")) {
    const amountInput = document.getElementById("delivery-amount-paid");
    if (amountInput) amountInput.value = subtotal;
  }
}


// ==========================================
// B. TAMPILAN ADMIN: TAB PESANAN (ORDERS)
// ==========================================
function renderOrdersTab(container) {
  const today = getWitaDate();
  const allOrders = store.getOrders();

  // Filter orders
  let filtered = allOrders.filter(o => {
    // Filter Date
    if (orderFilterDate && o.deliveryDate !== orderFilterDate) return false;

    // Filter Status
    if (orderFilterStatus !== "ALL" && o.deliveryStatus !== orderFilterStatus) return false;

    // Sembunyikan pesanan dibatalkan dari tampilan "Semua Status" (ALL) agar UI tidak berantakan
    if (orderFilterStatus === "ALL" && o.deliveryStatus === "CANCELLED") return false;

    // Filter Courier
    if (orderFilterCourier !== "ALL" && o.courierId !== orderFilterCourier) return false;

    // Search Query
    if (orderSearchQuery) {
      const q = orderSearchQuery.toLowerCase();
      const matchName = o.customerName.toLowerCase().includes(q);
      const matchId = o.id.toLowerCase().includes(q);
      const matchAddr = o.customerAddress.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchAddr) return false;
    }
    return true;
  });

  // Metriks Ringkas Hari Terpilih
  const ordersOnDate = allOrders.filter(o => o.deliveryDate === orderFilterDate);
  const countDelivered = ordersOnDate.filter(o => o.deliveryStatus === "DELIVERED").length;
  const countActive = ordersOnDate.filter(o => o.deliveryStatus === "ON_DELIVERY" || o.deliveryStatus === "ASSIGNED").length;
  const countPending = ordersOnDate.filter(o => o.deliveryStatus === "PENDING").length;

  container.innerHTML = `
    <!-- Metriks Cepat -->
    <div class="metrics-grid">
      <div class="metric-card indigo">
        <div class="metric-header">
          <span class="metric-title">Total Pesanan (${orderFilterDate === today ? 'Hari Ini' : orderFilterDate})</span>
          <span class="metric-icon">📦</span>
        </div>
        <div class="metric-value">${ordersOnDate.length}</div>
        <div class="metric-sub">Zona Waktu: Asia/Makassar</div>
      </div>

      <div class="metric-card emerald">
        <div class="metric-header">
          <span class="metric-title">Selesai Terkirim</span>
          <span class="metric-icon">✅</span>
        </div>
        <div class="metric-value">${countDelivered}</div>
        <div class="metric-sub">Galon telah sampai ke pelanggan</div>
      </div>

      <div class="metric-card amber">
        <div class="metric-header">
          <span class="metric-title">Proses Pengantaran</span>
          <span class="metric-icon">🛵</span>
        </div>
        <div class="metric-value">${countActive}</div>
        <div class="metric-sub">Ditugaskan & sedang di jalan</div>
      </div>

      <div class="metric-card rose">
        <div class="metric-header">
          <span class="metric-title">Antrean Pending</span>
          <span class="metric-icon">⏳</span>
        </div>
        <div class="metric-value">${countPending}</div>
        <div class="metric-sub">Belum dialokasikan ke kurir</div>
      </div>
    </div>

    <!-- Action Bar & Filter -->
    <div class="action-bar">
      <div class="search-filter-group">
        <div class="input-search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="input-order-search" placeholder="Cari nama pelanggan / alamat / ID..." value="${orderSearchQuery}">
        </div>

        <select class="filter-select" id="select-filter-status">
          <option value="ALL" ${orderFilterStatus === 'ALL' ? 'selected' : ''}>Semua Status</option>
          <option value="PENDING" ${orderFilterStatus === 'PENDING' ? 'selected' : ''}>Menunggu (Pending)</option>
          <option value="ASSIGNED" ${orderFilterStatus === 'ASSIGNED' ? 'selected' : ''}>Ditugaskan</option>
          <option value="ON_DELIVERY" ${orderFilterStatus === 'ON_DELIVERY' ? 'selected' : ''}>Dalam Pengantaran</option>
          <option value="DELIVERED" ${orderFilterStatus === 'DELIVERED' ? 'selected' : ''}>Selesai Terkirim</option>
          <option value="CANCELLED" ${orderFilterStatus === 'CANCELLED' ? 'selected' : ''}>Dibatalkan</option>
        </select>

        <select class="filter-select" id="select-filter-courier">
          <option value="ALL" ${orderFilterCourier === 'ALL' ? 'selected' : ''}>Semua Kurir</option>
          ${store.data.users.filter(u => u.role === 'courier').map(c => `
            <option value="${c.id}" ${orderFilterCourier === c.id ? 'selected' : ''}>🛵 ${c.name}</option>
          `).join('')}
        </select>

        <input type="date" class="filter-select" id="input-filter-date" value="${orderFilterDate}" title="Filter Tanggal Pengantaran (WITA)">
      </div>

      <button type="button" class="btn btn-primary" id="btn-open-create-order">
        <span>+</span> Input Pesanan Baru
      </button>
    </div>

    <!-- Daftar Kartu Pesanan -->
    ${filtered.length === 0 ? `
      <div style="background: white; border-radius: var(--radius-lg); padding: 3rem 1rem; text-align: center; border: 1px dashed var(--border-light);">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📭</div>
        <div style="font-weight: 700; font-size: 1.1rem;">Tidak ada pesanan ditemukan</div>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">
          Coba sesuaikan kata kunci pencarian atau tanggal filter.
        </p>
      </div>
    ` : `
      <div class="orders-list">
        ${filtered.map(order => renderAdminOrderCard(order)).join("")}
      </div>
    `}
  `;

  attachAdminOrdersListeners();
}

function renderAdminOrderCard(order) {
  const isPending = order.deliveryStatus === "PENDING";
  const isAssigned = order.deliveryStatus === "ASSIGNED";
  const isCancelled = order.deliveryStatus === "CANCELLED";
  const isDelivered = order.deliveryStatus === "DELIVERED";

  return `
    <div class="order-card">
      <div class="order-card-header">
        <div class="order-id-group">
          <span class="order-code">${order.id}</span>
          <span class="order-time-slot">📅 ${order.deliveryDate} | ⏰ ${order.deliveryTimeSlot}</span>
        </div>
        <div style="display: flex; gap: 0.4rem; align-items: center;">
          <span class="badge badge-${order.deliveryStatus}">
            <span class="badge-dot"></span>
            ${order.deliveryStatus === 'DELIVERED' ? 'SELESAI' : order.deliveryStatus === 'ON_DELIVERY' ? 'DI JALAN' : order.deliveryStatus === 'ASSIGNED' ? 'DITUGASKAN' : order.deliveryStatus === 'PENDING' ? 'MENUNGGU' : 'BATAL'}
          </span>
          <span class="badge badge-pay-${order.paymentStatus}">
            ${order.paymentStatus === 'PAID' ? 'LUNAS' : order.paymentStatus === 'PARTIAL' ? 'SEBAGIAN' : 'BELUM BAYAR'}
          </span>
        </div>
      </div>

      <div class="order-customer-info">
        <div class="cust-main-details">
          <h3>
            <span>${order.customerName}</span>
            <a href="${formatWaLink(order.customerPhone)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.8rem; color: #10b981; text-decoration: none;" title="Chat WhatsApp">
              💬 ${order.customerPhone}
            </a>
          </h3>
          <div class="cust-address">
            <span>📍 ${order.customerAddress}</span>
          </div>
          ${order.addressNotes ? `
            <div class="cust-address-note">📌 ${order.addressNotes}</div>
          ` : ''}
          ${order.driverNotes ? `
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.35rem; font-style: italic;">
              Catatan: "${order.driverNotes}"
            </div>
          ` : ''}
        </div>

        <div style="text-align: right; min-width: 140px;">
          <div class="order-total-label">Total Tagihan</div>
          <div class="order-total-amount">${formatRupiah(order.subtotalActual || order.subtotalOrdered)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            Terbayar: ${formatRupiah(order.totalPaid)} (${order.paymentMethod || 'CASH'})
          </div>
        </div>
      </div>

      <!-- Item Pesanan -->
      <div class="order-items-box">
        ${order.items.map(it => `
          <div class="item-row">
            <span class="item-name">${it.productName}</span>
            <div>
              <span class="item-qty-tag">${it.qtyDelivered || it.qtyOrdered}x</span>
              <span class="item-price">@ ${formatRupiah(it.unitPrice)}</span>
              <span style="font-weight: 700; margin-left: 0.5rem;">${formatRupiah(it.unitPrice * (it.qtyDelivered || it.qtyOrdered))}</span>
            </div>
          </div>
        `).join("")}
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); border-top: 1px dashed var(--border-light); padding-top: 0.3rem;">
          <span>Galon Kosong Ditarik: <strong>${order.emptyGallonsReturned || 0} / ${order.emptyGallonsExpected || 0} galon</strong></span>
          ${isCancelled ? `<span style="color: #e11d48; font-weight: 700; background: #fff1f2; padding: 2px 8px; border-radius: 4px; border: 1px solid #fecdd3;">❌ Status: Dibatalkan (Oke)</span>` : ''}
        </div>
      </div>

      <div class="order-card-footer">
        <div class="courier-badge-box">
          <span>🛵 Pengantar:</span>
          ${isPending ? `
            <select class="filter-select select-quick-assign" data-order-id="${order.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
              <option value="">-- Pilih & Tugaskan Kurir --</option>
              ${store.data.users.filter(u => u.role === 'courier').map(c => `
                <option value="${c.id}">${c.name}</option>
              `).join('')}
            </select>
          ` : `
            <strong>${order.courierName}</strong>
          `}
        </div>

        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${isAssigned ? `
            <button type="button" class="btn btn-sm btn-secondary btn-set-ondelivery" data-order-id="${order.id}" title="Tandai kurir sudah berangkat">
              🛵 Berangkatkan
            </button>
          ` : ''}
          ${(isAssigned || order.deliveryStatus === "ON_DELIVERY") ? `
            <button type="button" class="btn btn-sm btn-emerald btn-open-delivery-modal" data-order-id="${order.id}" title="Selesaikan pengantaran & catat realisasi">
              ✅ Selesaikan
            </button>
          ` : ''}
          ${isDelivered ? `
            <button type="button" class="btn btn-sm btn-secondary btn-open-delivery-modal" data-order-id="${order.id}" title="Edit atau koreksi realisasi pengantaran">
              ✏️ Edit Realisasi
            </button>
          ` : ''}
          ${!isDelivered && !isCancelled ? `
            <button type="button" class="btn btn-sm btn-rose btn-open-cancel-order" data-order-id="${order.id}">
              Batalkan
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function attachAdminOrdersListeners() {
  const searchInput = document.getElementById("input-order-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      orderSearchQuery = e.target.value;
      renderApp();
    });
  }

  const statusSelect = document.getElementById("select-filter-status");
  if (statusSelect) {
    statusSelect.addEventListener("change", (e) => {
      orderFilterStatus = e.target.value;
      renderApp();
    });
  }

  const courierSelect = document.getElementById("select-filter-courier");
  if (courierSelect) {
    courierSelect.addEventListener("change", (e) => {
      orderFilterCourier = e.target.value;
      renderApp();
    });
  }

  const dateInput = document.getElementById("input-filter-date");
  if (dateInput) {
    dateInput.addEventListener("change", (e) => {
      orderFilterDate = e.target.value;
      renderApp();
    });
  }

  const btnOpenCreate = document.getElementById("btn-open-create-order");
  if (btnOpenCreate) {
    btnOpenCreate.addEventListener("click", () => {
      prepareCreateOrderModal();
    });
  }

  // Quick Assign Kurir
  document.querySelectorAll(".select-quick-assign").forEach(sel => {
    sel.addEventListener("change", (e) => {
      const orderId = sel.getAttribute("data-order-id");
      const courierId = e.target.value;
      if (courierId) {
        store.assignCourier(orderId, courierId);
        showToast("Kurir berhasil ditugaskan!", "success");
      }
    });
  });

  // Set On Delivery
  document.querySelectorAll(".btn-set-ondelivery").forEach(btn => {
    btn.addEventListener("click", () => {
      const orderId = btn.getAttribute("data-order-id");
      store.updateDeliveryStatus(orderId, "ON_DELIVERY");
      showToast("Pesanan ditandai sedang dalam pengantaran!", "info");
    });
  });

  // Buka Modal Selesaikan Pengantaran (dari Dashboard Admin)
  document.querySelectorAll(".btn-open-delivery-modal").forEach(btn => {
    btn.addEventListener("click", () => {
      const orderId = btn.getAttribute("data-order-id");
      prepareDeliveryModal(orderId);
    });
  });

  // Buka Modal Batal (Konfirmasi Ya / Oke)
  document.querySelectorAll(".btn-open-cancel-order").forEach(btn => {
    btn.addEventListener("click", () => {
      const orderId = btn.getAttribute("data-order-id");
      const order = store.getOrderById(orderId);
      document.getElementById("cancel-order-id").value = orderId;
      const idLabel = document.getElementById("cancel-order-id-label");
      const custLabel = document.getElementById("cancel-order-customer-label");
      if (idLabel) idLabel.textContent = `Nomor Pesanan: ${orderId}`;
      if (custLabel && order) custLabel.textContent = `Pelanggan: ${order.customerName} (${order.customerPhone})`;
      openModal("modal-cancel-order");
    });
  });
}


// ==========================================
// C. TAMPILAN ADMIN: TAB PELANGGAN (CUSTOMERS)
// ==========================================
function renderCustomersTab(container) {
  const customers = store.getCustomers();
  const filtered = customers.filter(c => {
    if (!customerSearchQuery) return true;
    const q = customerSearchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || 
           c.phone.toLowerCase().includes(q) || 
           c.address.toLowerCase().includes(q);
  });

  const totalGallonsLoaned = customers.reduce((sum, c) => sum + (c.currentGallonBalance || 0), 0);
  const totalDebtBalance = customers.reduce((sum, c) => sum + (c.currentDebtBalance || 0), 0);

  container.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card indigo">
        <div class="metric-header">
          <span class="metric-title">Total Pelanggan Terdaftar</span>
          <span class="metric-icon">👥</span>
        </div>
        <div class="metric-value">${customers.length}</div>
        <div class="metric-sub">Rumah tangga, warung & perkantoran</div>
      </div>

      <div class="metric-card emerald">
        <div class="metric-header">
          <span class="metric-title">Galon Depot di Pelanggan</span>
          <span class="metric-icon">🔄</span>
        </div>
        <div class="metric-value">${totalGallonsLoaned} <span style="font-size: 1rem;">Buah</span></div>
        <div class="metric-sub">Total galon fisik yang sedang dipinjam</div>
      </div>

      <div class="metric-card rose">
        <div class="metric-header">
          <span class="metric-title">Total Piutang Belum Bayar</span>
          <span class="metric-icon">💳</span>
        </div>
        <div class="metric-value">${formatRupiah(totalDebtBalance)}</div>
        <div class="metric-sub">Akumulasi bon tempo pelanggan</div>
      </div>
    </div>

    <div class="action-bar">
      <div class="search-filter-group">
        <div class="input-search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="input-customer-search" placeholder="Cari nama pelanggan, nomor HP, atau alamat..." value="${customerSearchQuery}">
        </div>
      </div>

      <button type="button" class="btn btn-primary" id="btn-open-create-customer">
        <span>+</span> Tambah Pelanggan Baru
      </button>
    </div>

    <!-- Daftar Pelanggan Table/Cards -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Pelanggan</th>
            <th>Kontak & WhatsApp</th>
            <th>Alamat & Patokan</th>
            <th>Pinjaman Galon</th>
            <th>Sisa Piutang (Bon)</th>
            <th style="text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(cust => `
            <tr>
              <td>
                <div style="font-weight: 700; font-size: 0.95rem;">${cust.name}</div>
                ${cust.customPrices && Object.keys(cust.customPrices).length > 0 ? `
                  <span class="badge" style="background: #e0f2fe; color: #0284c7; font-size: 0.7rem; margin-top: 2px;">
                    ⭐ Ada Harga Khusus
                  </span>
                ` : ''}
              </td>
              <td>
                <a href="${formatWaLink(cust.phone)}" target="_blank" rel="noopener noreferrer" style="color: #059669; font-weight: 600; text-decoration: none;">
                  💬 ${cust.phone}
                </a>
              </td>
              <td>
                <div style="max-width: 280px; font-size: 0.85rem;">
                  <div>${cust.address}</div>
                  ${cust.addressNotes ? `<div class="cust-address-note" style="margin-top: 2px;">📌 ${cust.addressNotes}</div>` : ''}
                </div>
              </td>
              <td>
                <span class="badge" style="background: #f1f5f9; color: #334155; font-size: 0.8rem; font-weight: 800;">
                  🔄 ${cust.currentGallonBalance || 0} Galon
                </span>
              </td>
              <td>
                ${(cust.currentDebtBalance || 0) > 0 ? `
                  <div style="font-weight: 800; color: #be123c; font-family: var(--font-heading); font-size: 0.95rem;">
                    ${formatRupiah(cust.currentDebtBalance)}
                  </div>
                  <button type="button" class="btn btn-sm btn-rose btn-open-pay-debt" data-cust-id="${cust.id}" style="margin-top: 4px; padding: 2px 6px; font-size: 0.75rem;">
                    Catat Bayar
                  </button>
                ` : `
                  <span style="color: #059669; font-size: 0.8rem; font-weight: 600;">Lunas (Rp 0)</span>
                `}
              </td>
              <td style="text-align: right;">
                <div style="display: inline-flex; gap: 0.4rem;">
                  <button type="button" class="btn btn-sm btn-secondary btn-order-for-cust" data-cust-id="${cust.id}" title="Buat Pesanan Baru">
                    📦 Pesan
                  </button>
                  <button type="button" class="btn btn-sm btn-secondary btn-custom-price" data-cust-id="${cust.id}" title="Set Harga Khusus">
                    🏷️ Harga
                  </button>
                  <button type="button" class="btn btn-sm btn-secondary btn-edit-cust" data-cust-id="${cust.id}" title="Edit Data">
                    ✏️ Edit
                  </button>
                  <button type="button" class="btn btn-sm btn-rose btn-delete-cust" data-cust-id="${cust.id}" title="Hapus Data Pelanggan">
                    🗑️ Hapus
                  </button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  attachCustomerActionListeners();
}

function attachCustomerActionListeners() {
  const searchInput = document.getElementById("input-customer-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      customerSearchQuery = e.target.value;
      renderApp();
    });
  }

  const btnOpenCreate = document.getElementById("btn-open-create-customer");
  if (btnOpenCreate) {
    btnOpenCreate.addEventListener("click", () => {
      document.getElementById("modal-customer-title").textContent = "👤 Tambah Pelanggan Baru";
      document.getElementById("cust-id-input").value = "";
      document.getElementById("cust-name-input").value = "";
      document.getElementById("cust-phone-input").value = "";
      document.getElementById("cust-address-input").value = "";
      document.getElementById("cust-notes-input").value = "";
      openModal("modal-customer");
    });
  }

  // Edit Customer
  document.querySelectorAll(".btn-edit-cust").forEach(btn => {
    btn.addEventListener("click", () => {
      const custId = btn.getAttribute("data-cust-id");
      const cust = store.getCustomerById(custId);
      if (!cust) return;
      document.getElementById("modal-customer-title").textContent = "✏️ Edit Data Pelanggan";
      document.getElementById("cust-id-input").value = cust.id;
      document.getElementById("cust-name-input").value = cust.name;
      document.getElementById("cust-phone-input").value = cust.phone;
      document.getElementById("cust-address-input").value = cust.address;
      document.getElementById("cust-notes-input").value = cust.addressNotes || "";
      openModal("modal-customer");
    });
  });

  // Atur Harga Khusus
  document.querySelectorAll(".btn-custom-price").forEach(btn => {
    btn.addEventListener("click", () => {
      const custId = btn.getAttribute("data-cust-id");
      prepareCustomPriceModal(custId);
    });
  });

  // Bayar Piutang
  document.querySelectorAll(".btn-open-pay-debt").forEach(btn => {
    btn.addEventListener("click", () => {
      const custId = btn.getAttribute("data-cust-id");
      const cust = store.getCustomerById(custId);
      if (!cust) return;

      document.getElementById("pay-debt-cust-id").value = cust.id;
      document.getElementById("pay-debt-cust-name-label").textContent = cust.name;
      document.getElementById("pay-debt-current-val").textContent = formatRupiah(cust.currentDebtBalance);
      document.getElementById("pay-debt-amount").value = cust.currentDebtBalance;
      openModal("modal-pay-debt");
    });
  });

  // Buat Pesanan Instan untuk Pelanggan Ini
  document.querySelectorAll(".btn-order-for-cust").forEach(btn => {
    btn.addEventListener("click", () => {
      const custId = btn.getAttribute("data-cust-id");
      prepareCreateOrderModal(custId);
    });
  });

  // Hapus Data Pelanggan (Syarat: Tidak sedang menyimpan galon)
  document.querySelectorAll(".btn-delete-cust").forEach(btn => {
    btn.addEventListener("click", () => {
      const custId = btn.getAttribute("data-cust-id");
      const cust = store.getCustomerById(custId);
      if (!cust) return;

      const gallonBal = Number(cust.currentGallonBalance) || 0;
      if (gallonBal > 0) {
        showToast(`Gagal: '${cust.name}' tidak dapat dihapus karena masih menyimpan ${gallonBal} galon depot!`, "error");
        alert(`❌ Tidak dapat menghapus pelanggan '${cust.name}'!\n\nPelanggan ini masih terdata menyimpan/meminjam ${gallonBal} galon depot. Pastikan galon fisik sudah dikembalikan ke depot terlebih dahulu.`);
        return;
      }

      if (confirm(`Apakah Anda yakin ingin menghapus data pelanggan '${cust.name}'?`)) {
        const res = store.deleteCustomer(custId);
        if (res.success) {
          showToast(res.message, "success");
        } else {
          showToast(res.message, "error");
        }
      }
    });
  });
}

function prepareCustomPriceModal(customerId) {
  const cust = store.getCustomerById(customerId);
  if (!cust) return;

  document.getElementById("custom-price-cust-name").textContent = cust.name;
  const container = document.getElementById("custom-price-list");

  container.innerHTML = store.getProducts().map(p => {
    const currentCustom = (cust.customPrices && cust.customPrices[p.id]) ? cust.customPrices[p.id] : "";
    return `
      <div style="background: #f8fafc; padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <div style="font-weight: 700; font-size: 0.9rem;">${p.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Harga Standar: ${formatRupiah(p.standardPrice)} / ${p.unit}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="font-size: 0.8rem; font-weight: 600;">Rp</span>
          <input type="number" class="form-control input-save-custom-price" data-cust-id="${cust.id}" data-prod-id="${p.id}" value="${currentCustom}" placeholder="${p.standardPrice}" style="width: 110px; font-weight: 700;">
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".input-save-custom-price").forEach(input => {
    input.addEventListener("change", (e) => {
      const cId = input.getAttribute("data-cust-id");
      const pId = input.getAttribute("data-prod-id");
      const val = e.target.value;
      store.setCustomerCustomPrice(cId, pId, val);
      showToast("Harga khusus berhasil diperbarui!", "success");
    });
  });

  openModal("modal-custom-price");
}


// ==========================================
// D. TAMPILAN ADMIN: TAB PRODUK & HARGA
// ==========================================
function renderProductsTab(container) {
  const products = store.getProducts();

  container.innerHTML = `
    <div class="action-bar">
      <div>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">Katalog Produk & Harga Standar</h3>
        <p style="font-size: 0.8rem; color: var(--text-muted);">
          Harga standar ini menjadi patokan bawaan. Setiap perubahan harga tidak akan mengubah transaksi yang telah tercatat sebelumnya.
        </p>
      </div>

      <button type="button" class="btn btn-primary" id="btn-open-create-product">
        <span>+</span> Tambah Produk Baru
      </button>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama Produk</th>
            <th>Harga Standar</th>
            <th>Satuan</th>
            <th>Deskripsi</th>
            <th>Status</th>
            <th style="text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td><span class="order-code">${p.code || 'PRD'}</span></td>
              <td><strong style="font-size: 0.95rem;">${p.name}</strong></td>
              <td style="font-weight: 800; color: var(--primary-900); font-family: var(--font-heading); font-size: 1.05rem;">
                ${formatRupiah(p.standardPrice)}
              </td>
              <td>${p.unit}</td>
              <td style="color: var(--text-muted); font-size: 0.85rem;">${p.description || '-'}</td>
              <td>
                <span class="badge ${p.isActive ? 'badge-DELIVERED' : 'badge-CANCELLED'}">
                  ${p.isActive ? 'Aktif Dijual' : 'Non-Aktif'}
                </span>
              </td>
              <td style="text-align: right;">
                <button type="button" class="btn btn-sm btn-secondary btn-edit-product" data-prod-id="${p.id}">
                  ✏️ Edit
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("btn-open-create-product").addEventListener("click", () => {
    document.getElementById("modal-product-title").textContent = "🏷️ Tambah Produk Baru";
    document.getElementById("prod-id-input").value = "";
    document.getElementById("prod-name-input").value = "";
    document.getElementById("prod-price-input").value = "";
    document.getElementById("prod-unit-input").value = "Galon";
    document.getElementById("prod-desc-input").value = "";
    openModal("modal-product");
  });

  document.querySelectorAll(".btn-edit-product").forEach(btn => {
    btn.addEventListener("click", () => {
      const pid = btn.getAttribute("data-prod-id");
      const prod = store.getProductById(pid);
      if (!prod) return;
      document.getElementById("modal-product-title").textContent = "✏️ Edit Produk & Harga";
      document.getElementById("prod-id-input").value = prod.id;
      document.getElementById("prod-name-input").value = prod.name;
      document.getElementById("prod-price-input").value = prod.standardPrice;
      document.getElementById("prod-unit-input").value = prod.unit;
      document.getElementById("prod-desc-input").value = prod.description || "";
      openModal("modal-product");
    });
  });
}


// ==========================================
// E. TAMPILAN ADMIN: REKONSILIASI & KAS HARIAN
// ==========================================
function renderReconciliationTab(container) {
  const summary = store.getDailySummary(reconciliationDate);
  const today = getWitaDate();

  container.innerHTML = `
    <!-- Pilihan Tanggal Laporan -->
    <div class="action-bar">
      <div>
        <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">
          📊 Laporan & Rekonsiliasi Kas Operasional
        </h3>
        <p style="font-size: 0.8rem; color: var(--text-muted);">
          Rekapitulasi cut-off per hari zona waktu <strong>Asia/Makassar (WITA)</strong>.
        </p>
      </div>

      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <label for="recon-date-picker" style="font-size: 0.85rem; font-weight: 600;">Tanggal:</label>
        <input type="date" class="filter-select" id="recon-date-picker" value="${reconciliationDate}">
        <button type="button" class="btn btn-sm btn-secondary" id="btn-recon-today">Hari Ini</button>
      </div>
    </div>

    <!-- Grid Ringkasan Keuangan & Fisik Galon -->
    <div class="metrics-grid">
      <div class="metric-card emerald">
        <div class="metric-header">
          <span class="metric-title">Omzet Terkirim Aktual</span>
          <span class="metric-icon">💰</span>
        </div>
        <div class="metric-value">${formatRupiah(summary.totalOmzetActual)}</div>
        <div class="metric-sub">${summary.countDelivered} pesanan berhasil diantar</div>
      </div>

      <div class="metric-card indigo">
        <div class="metric-header">
          <span class="metric-title">Kas Tunai di Pengantar</span>
          <span class="metric-icon">💵</span>
        </div>
        <div class="metric-value">${formatRupiah(summary.totalCashReceived)}</div>
        <div class="metric-sub">Uang fisik yang wajib disetor ke kasir</div>
      </div>

      <div class="metric-card amber">
        <div class="metric-header">
          <span class="metric-title">Penerimaan Transfer Bank</span>
          <span class="metric-icon">📱</span>
        </div>
        <div class="metric-value">${formatRupiah(summary.totalTransferReceived)}</div>
        <div class="metric-sub">Masuk rekening pemilik langsung</div>
      </div>

      <div class="metric-card rose">
        <div class="metric-header">
          <span class="metric-title">Piutang Baru Hari Ini</span>
          <span class="metric-icon">⏳</span>
        </div>
        <div class="metric-value">${formatRupiah(summary.totalNewDebt)}</div>
        <div class="metric-sub">Tagihan bon pelanggan belum bayar</div>
      </div>
    </div>

    <!-- Mutasi Galon Fisik & Rekonsiliasi Kas Kurir -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
      <!-- Kas di Kurir (Setoran) -->
      <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 1.25rem;">
        <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>🛵</span> Rekonsiliasi Setoran Uang Tunai Kurir
        </h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Nama Pengantar</th>
                <th>Selesai</th>
                <th style="text-align: right;">Kas Wajib Disetor</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(summary.courierCashTally).map(cid => {
                const c = summary.courierCashTally[cid];
                return `
                  <tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.ordersCompleted} kiriman</td>
                    <td style="text-align: right; font-weight: 800; color: #047857; font-family: var(--font-heading);">
                      ${formatRupiah(c.cashInHand)}
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mutasi Galon Fisik -->
      <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 1.25rem;">
        <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>🔄</span> Rekap Mutasi Galon Fisik Depot
        </h4>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="background: #f0f9ff; padding: 1rem; border-radius: var(--radius-md); border-left: 4px solid var(--primary-600); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 0.8rem; color: var(--primary-800); font-weight: 600;">Galon Isi Keluar (Terjual):</div>
              <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary-950);">${summary.totalGallonsDelivered} Galon</div>
            </div>
            <div style="font-size: 2rem;">📤</div>
          </div>

          <div style="background: #ecfdf5; padding: 1rem; border-radius: var(--radius-md); border-left: 4px solid #10b981; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 0.8rem; color: #065f46; font-weight: 600;">Galon Kosong Ditarik Masuk:</div>
              <div style="font-size: 1.5rem; font-weight: 800; color: #064e3b;">${summary.totalEmptyGallonsReturned} Galon</div>
            </div>
            <div style="font-size: 2rem;">📥</div>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-muted); padding: 0.5rem; background: #f8fafc; border-radius: var(--radius-sm);">
            💡 Selisih bersih galon di pelanggan hari ini: 
            <strong>${summary.totalGallonsDelivered - summary.totalEmptyGallonsReturned > 0 ? '+' : ''}${summary.totalGallonsDelivered - summary.totalEmptyGallonsReturned} galon</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- Riwayat Pembayaran Masuk Hari Ini -->
    <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 1.25rem; margin-bottom: 2rem;">
      <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem;">
        🧾 Buku Kas & Transaksi Pembayaran Diterima (${reconciliationDate})
      </h4>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Waktu (WITA)</th>
              <th>No. Pesanan</th>
              <th>Pelanggan</th>
              <th>Diterima Oleh</th>
              <th>Metode</th>
              <th style="text-align: right;">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${store.data.payments.filter(p => getWitaDate(new Date(p.paymentDate)) === reconciliationDate).map(p => `
              <tr>
                <td style="font-family: monospace; font-size: 0.8rem;">
                  ${new Date(p.paymentDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td><span class="order-code">${p.orderId || 'Bayar Piutang'}</span></td>
                <td><strong>${p.customerName}</strong></td>
                <td>${p.collectedByName || '-'}</td>
                <td>
                  <span class="badge ${p.paymentMethod === 'CASH' ? 'badge-ASSIGNED' : 'badge-PENDING'}">
                    ${p.paymentMethod === 'CASH' ? '💵 Tunai' : '📱 Transfer'}
                  </span>
                </td>
                <td style="text-align: right; font-weight: 800; color: #047857; font-family: var(--font-heading);">
                  ${formatRupiah(p.amount)}
                </td>
              </tr>
            `).join("") || `
              <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                  Belum ada transaksi pembayaran pada tanggal ini.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tombol Pemeliharaan & Data Management -->
    <div style="background: #f8fafc; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
      <div>
        <div style="font-weight: 700; font-size: 0.9rem;">💾 Manajemen Data & Cadangan</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Data tersimpan secara otomatis di memori peramban (localStorage).</div>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn btn-sm btn-secondary" id="btn-export-json">📥 Unduh Cadangan JSON</button>
        <button type="button" class="btn btn-sm btn-rose" id="btn-reset-data">🔄 Reset Data Sampel Default</button>
      </div>
    </div>
  `;

  // Listener filter tanggal laporan
  const datePicker = document.getElementById("recon-date-picker");
  if (datePicker) {
    datePicker.addEventListener("change", (e) => {
      reconciliationDate = e.target.value;
      renderApp();
    });
  }

  const btnToday = document.getElementById("btn-recon-today");
  if (btnToday) {
    btnToday.addEventListener("click", () => {
      reconciliationDate = today;
      renderApp();
    });
  }

  // Backup & Reset
  document.getElementById("btn-export-json").addEventListener("click", () => {
    const jsonStr = store.exportJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asalynn-backup-${getWitaDate()}.json`;
    a.click();
    showToast("File cadangan berhasil diunduh!", "success");
  });

  document.getElementById("btn-reset-data").addEventListener("click", () => {
    openModal("modal-confirm-global-reset");
  });
}


// ==========================================
// F. MODAL BUAT PESANAN BARU (CREATE ORDER)
// ==========================================
let currentOrderItems = [];

function prepareCreateOrderModal(preselectedCustomerId = null) {
  const custSelect = document.getElementById("order-customer-select");
  const courierSelect = document.getElementById("order-courier-select");
  const dateInput = document.getElementById("order-delivery-date");

  // Isi dropdown pelanggan
  custSelect.innerHTML = `<option value="">-- Pilih Pelanggan --</option>` + 
    store.getCustomers().map(c => `
      <option value="${c.id}" ${c.id === preselectedCustomerId ? 'selected' : ''}>${c.name} (${c.phone})</option>
    `).join("");

  // Isi dropdown kurir
  courierSelect.innerHTML = `<option value="">-- Simpan dulu sebagai Antrean (Pending) --</option>` +
    store.data.users.filter(u => u.role === 'courier').map(c => `
      <option value="${c.id}">🛵 ${c.name} (${c.vehicle || 'Kurir'})</option>
    `).join("");

  // Tanggal default hari ini WITA
  dateInput.value = getWitaDate();
  document.getElementById("order-empty-expected").value = 1;
  document.getElementById("order-driver-notes").value = "";

  // Reset items: produk pertama Refill 19L
  const refillProd = store.getProducts().find(p => p.id === "prod-refill-19l") || store.getProducts()[0];
  currentOrderItems = [
    {
      productId: refillProd.id,
      qtyOrdered: 2
    }
  ];

  updateCustomerPreview();
  renderOrderModalItems();
  openModal("modal-create-order");
}

function updateCustomerPreview() {
  const custSelect = document.getElementById("order-customer-select");
  const previewBox = document.getElementById("customer-preview-box");
  const custId = custSelect.value;

  if (!custId) {
    previewBox.style.display = "none";
    return;
  }

  const cust = store.getCustomerById(custId);
  if (!cust) return;

  previewBox.style.display = "block";
  document.getElementById("prev-cust-address").textContent = cust.address;
  document.getElementById("prev-cust-notes").textContent = cust.addressNotes || "Tidak ada patokan khusus";
  document.getElementById("prev-cust-gallons").textContent = `${cust.currentGallonBalance || 0} buah`;
  document.getElementById("prev-cust-debt").textContent = formatRupiah(cust.currentDebtBalance || 0);

  // Update estimasi galon kosong ditarik jika galon keluar
  renderOrderModalItems();
}

document.getElementById("order-customer-select").addEventListener("change", () => {
  updateCustomerPreview();
});

document.getElementById("btn-quick-new-customer").addEventListener("click", () => {
  document.getElementById("modal-customer-title").textContent = "👤 Tambah Pelanggan Baru";
  document.getElementById("cust-id-input").value = "";
  document.getElementById("cust-name-input").value = "";
  document.getElementById("cust-phone-input").value = "";
  document.getElementById("cust-address-input").value = "";
  document.getElementById("cust-notes-input").value = "";
  openModal("modal-customer");
});

function renderOrderModalItems() {
  const container = document.getElementById("order-items-container");
  const custId = document.getElementById("order-customer-select").value;
  const products = store.getProducts();

  container.innerHTML = currentOrderItems.map((item, idx) => {
    const effectivePrice = store.getEffectivePrice(custId, item.productId);
    const lineTotal = effectivePrice * item.qtyOrdered;

    return `
      <div style="display: flex; gap: 0.5rem; align-items: center; background: #f8fafc; padding: 0.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
        <select class="form-control select-order-item-prod" data-idx="${idx}" style="flex: 2;">
          ${products.map(p => `
            <option value="${p.id}" ${p.id === item.productId ? 'selected' : ''}>
              ${p.name} (@ ${formatRupiah(store.getEffectivePrice(custId, p.id))})
            </option>
          `).join("")}
        </select>

        <input type="number" class="form-control input-order-item-qty" data-idx="${idx}" value="${item.qtyOrdered}" min="1" style="width: 70px; text-align: center;">

        <div style="min-width: 90px; text-align: right; font-weight: 700; font-size: 0.85rem; color: var(--primary-900);">
          ${formatRupiah(lineTotal)}
        </div>

        ${currentOrderItems.length > 1 ? `
          <button type="button" class="btn btn-sm btn-rose btn-remove-order-item" data-idx="${idx}" style="padding: 4px 8px;">✕</button>
        ` : ''}
      </div>
    `;
  }).join("");

  // Hitung total akumulasi
  let total = 0;
  let totalGallons = 0;
  currentOrderItems.forEach(item => {
    const price = store.getEffectivePrice(custId, item.productId);
    total += (price * item.qtyOrdered);
    if (item.productId === "prod-refill-19l") {
      totalGallons += Number(item.qtyOrdered);
    }
  });

  document.getElementById("order-calculated-total").textContent = formatRupiah(total);
  if (totalGallons > 0) {
    document.getElementById("order-empty-expected").value = totalGallons;
  }

  // Attach item change listeners
  container.querySelectorAll(".select-order-item-prod").forEach(sel => {
    sel.addEventListener("change", (e) => {
      const idx = sel.getAttribute("data-idx");
      currentOrderItems[idx].productId = e.target.value;
      renderOrderModalItems();
    });
  });

  container.querySelectorAll(".input-order-item-qty").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const idx = inp.getAttribute("data-idx");
      currentOrderItems[idx].qtyOrdered = Math.max(1, Number(e.target.value) || 1);
      renderOrderModalItems();
    });
  });

  container.querySelectorAll(".btn-remove-order-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = btn.getAttribute("data-idx");
      currentOrderItems.splice(idx, 1);
      renderOrderModalItems();
    });
  });
}

document.getElementById("btn-add-item-row").addEventListener("click", () => {
  const prod = store.getProducts()[0];
  currentOrderItems.push({
    productId: prod.id,
    qtyOrdered: 1
  });
  renderOrderModalItems();
});


// ==========================================
// G. SUBMIT FORMS HANDLERS
// ==========================================
function initFormHandlers() {
  // 1. Submit Form Pesanan Baru
  const formCreateOrder = document.getElementById("form-create-order");
  formCreateOrder?.addEventListener("submit", (e) => {
    e.preventDefault();
    const customerId = document.getElementById("order-customer-select")?.value;
    if (!customerId) {
      alert("Harap pilih pelanggan terlebih dahulu.");
      return;
    }

    const courierId = document.getElementById("order-courier-select")?.value || null;
    const deliveryDate = document.getElementById("order-delivery-date")?.value;
    const deliveryTimeSlot = document.getElementById("order-time-slot")?.value;
    const emptyGallonsExpected = document.getElementById("order-empty-expected")?.value;
    const driverNotes = document.getElementById("order-driver-notes")?.value;

    const newOrder = store.createOrder({
      customerId,
      courierId,
      deliveryDate,
      deliveryTimeSlot,
      items: currentOrderItems,
      emptyGallonsExpected,
      driverNotes
    });

    closeModal("modal-create-order");
    showToast(`Pesanan ${newOrder.id} berhasil disimpan!`, "success");
    renderApp();
  });

  // 2. Submit Form Selesaikan Pengantaran (Admin Dashboard)
  const formCompleteDelivery = document.getElementById("form-complete-delivery");
  formCompleteDelivery?.addEventListener("submit", (e) => {
    e.preventDefault();
    const orderId = document.getElementById("delivery-order-id-input")?.value;
    const amountPaid = document.getElementById("delivery-amount-paid")?.value;
    const paymentMethod = document.getElementById("delivery-payment-method")?.value;
    const driverNotes = document.getElementById("delivery-driver-notes")?.value;

    store.completeDelivery({
      orderId,
      qtyDeliveredMap: currentDeliveryItemQty,
      emptyGallonsReturned: currentEmptyReturned,
      amountPaid,
      paymentMethod,
      driverNotes
    });

    closeModal("modal-complete-delivery");
    showToast(`✅ Pengantaran pesanan ${orderId} berhasil diselesaikan & dicatat!`, "success");
    renderApp();
  });

  // 3. Submit Form Pelanggan
  const formCustomer = document.getElementById("form-customer");
  formCustomer?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("cust-id-input")?.value;
    const name = document.getElementById("cust-name-input")?.value;
    const phone = document.getElementById("cust-phone-input")?.value;
    const address = document.getElementById("cust-address-input")?.value;
    const addressNotes = document.getElementById("cust-notes-input")?.value;

    if (id) {
      store.updateCustomer(id, { name, phone, address, addressNotes });
      showToast("Data pelanggan berhasil diperbarui!", "success");
    } else {
      const newCust = store.addCustomer({ name, phone, address, addressNotes });
      showToast(`Pelanggan "${newCust.name}" berhasil ditambahkan!`, "success");
      const custSelect = document.getElementById("order-customer-select");
      if (custSelect) {
        custSelect.value = newCust.id;
        updateCustomerPreview();
      }
    }

    closeModal("modal-customer");
    renderApp();
  });

  // 4. Submit Form Produk
  const formProduct = document.getElementById("form-product");
  formProduct?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("prod-id-input")?.value;
    const name = document.getElementById("prod-name-input")?.value;
    const standardPrice = document.getElementById("prod-price-input")?.value;
    const unit = document.getElementById("prod-unit-input")?.value;
    const description = document.getElementById("prod-desc-input")?.value;

    if (id) {
      store.updateProduct(id, { name, standardPrice: Number(standardPrice), unit, description });
      showToast("Produk berhasil diperbarui!", "success");
    } else {
      store.addProduct({ name, standardPrice: Number(standardPrice), unit, description });
      showToast(`Produk "${name}" berhasil ditambahkan!`, "success");
    }

    closeModal("modal-product");
    renderApp();
  });

  // 5. Submit Form Bayar Piutang
  const formPayDebt = document.getElementById("form-pay-debt");
  formPayDebt?.addEventListener("submit", (e) => {
    e.preventDefault();
    const custId = document.getElementById("pay-debt-cust-id")?.value;
    const amount = document.getElementById("pay-debt-amount")?.value;
    const method = document.getElementById("pay-debt-method")?.value;
    const notes = document.getElementById("pay-debt-notes")?.value;

    store.payCustomerDebt(custId, amount, method, notes);
    closeModal("modal-pay-debt");
    showToast(`Pembayaran piutang ${formatRupiah(amount)} berhasil dicatat!`, "success");
    renderApp();
  });

  // 6. Submit Form Batalkan Pesanan (Konfirmasi Ya / Oke)
  const formCancelOrder = document.getElementById("form-cancel-order");
  formCancelOrder?.addEventListener("submit", (e) => {
    e.preventDefault();
    const orderId = document.getElementById("cancel-order-id")?.value;

    store.cancelOrder(orderId, "Dibatalkan oleh pengguna (Ya/Oke)");
    closeModal("modal-cancel-order");
    showToast(`Pesanan ${orderId} telah dibatalkan (Oke).`, "info");
    renderApp();
  });
}
