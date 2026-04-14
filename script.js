/* =========================================================
   MiniDiscordVoice - app.js (FULL INTEGRATED) [REWRITE v4 FINAL]
   - ✅ Matches latest CSS: Drawer side + overlay + theme vars + no horizontal drag
   - ✅ Adds Theme controller (system/dark/light) via data-theme
   - ✅ Restores Mic "Heart Monitor" waveform (ECG-style) using Audio Analyser
   - ✅ Keeps ALL previous features:
      - Google profile sync + prevent anonymous wipe
      - Avatar fallback
      - LED binding
      - WebView safe (NO replaceAll)
      - Better Agora errors
      - Force Majeure fixed at 2 minutes (LOCKED)
      - Fix buttons not working (hard re-bind)
      - AndroidBridge + window.MDV_APP API
   ========================================================= */

(() => {
  "use strict";

  /* =========================
     Part 1 — BOOTSTRAP + CONFIG
     ========================= */
  if (window.__MDV_APP_LOADED__) {
    try { console.warn("MDV app.js already loaded"); } catch (_) {}
    return;
  }
  window.__MDV_APP_LOADED__ = true;


// =========================================================
// Early native bridge hooks (prevents lost callbacks)
// =========================================================
try { if (!window.__MDV_LAST_ANDROID_USER__) window.__MDV_LAST_ANDROID_USER__ = null; } catch (_) {}
if (typeof window.onAndroidUser !== "function") {
  window.onAndroidUser = function(name, email, photo) {
    try { window.__MDV_LAST_ANDROID_USER__ = { name: name, email: email, photo: photo }; } catch (_) {}
  };
}
if (typeof window.onAndroidLogin !== "function") {
  window.onAndroidLogin = function(name, email, photo) {
    try { window.__MDV_LAST_ANDROID_USER__ = { name: name, email: email, photo: photo }; } catch (_) {}
  };
}

  const APP_VERSION = "MDV_APP_JS_v4_final_2026-01-15_agora_fix";

  const AGORA_APP_ID = "eb80a41c4a3c400f865a5c88bdf293be";

  const FIREBASE_CONFIGS = [
    {
      apiKey: "AIzaSyApUvLTt0OLAc_3Rk2e1BnmvX64T5RTmA8",
      authDomain: "minidiscordvoice-b7310.firebaseapp.com",
      databaseURL: "https://minidiscordvoice-b7310-default-rtdb.firebaseio.com",
      projectId: "minidiscordvoice-b7310",
      storageBucket: "minidiscordvoice-b7310.firebasestorage.app",
      messagingSenderId: "1073341648468",
      appId: "1:1073341648468:web:9af59b1fcc577d4468e7c1",
      measurementId: "G-7R4MRJHWY6",
    },
    {
      apiKey: "AIzaSyDdqU4OTdQv1vGXRtJwPVkuA4AdwIzCAuE",
      authDomain: "minidiscordvoice-b7310.firebaseapp.com",
      databaseURL: "https://minidiscordvoice-b7310-default-rtdb.firebaseio.com",
      projectId: "minidiscordvoice-b7310",
      storageBucket: "minidiscordvoice-b7310.firebasestorage.app",
      messagingSenderId: "1073341648468",
      appId: "1:1073341648468:web:9af59b1fcc577d4468e7c1",
      measurementId: "G-7R4MRJHWY6",
    },
  ];

  // Limits
  const CALL_LIMIT_MS = 3 * 60 * 60 * 1000; // 3 hours
  const BLOCK_MS = 20 * 60 * 60 * 1000;     // 20 hours
  const USAGE_TICK_MS = 15 * 1000;          // 15s

  // Force Majeure (LOCKED)
  const FM_INTERVAL_MS = 2 * 60 * 1000;     // 2 minutes (LOCKED)
  const FM_REBOOT_SECONDS = 6;              // 6 seconds (LOCKED)

  const DEFAULT_PING_HOST = "minidiscordvoice.web.app";

  window.AGORA_APP_ID = AGORA_APP_ID;
  window.__MDV_FIREBASE_CONFIGS__ = FIREBASE_CONFIGS;
  window.__MDV_VERSION__ = APP_VERSION;

  /* =========================
     Part 2 — SMALL UTILS
     ========================= */
  const now = () => Date.now();

  const $ = (sel, root = document) => { try { return root.querySelector(sel); } catch (_) { return null; } };
  const $$ = (sel, root = document) => { try { return Array.from(root.querySelectorAll(sel)); } catch (_) { return []; } };
  const byId = (id) => { try { return document.getElementById(id); } catch (_) { return null; } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function pad2(n) {
    n = Math.floor(Math.max(0, n));
    return n < 10 ? "0" + n : "" + n;
  }
  function fmtTime(seconds) {
    seconds = Math.floor(Math.max(0, seconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    return `${pad2(m)}:${pad2(s)}`;
  }
  function escapeHTML(s) {
    const str = String(s == null ? "" : s);
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function safeText(el, txt) {
    if (!el) return;
    el.textContent = (txt == null) ? "" : String(txt);
  }
  function safeHTML(el, html) {
    if (!el) return;
    el.innerHTML = html || "";
  }
  function safeJsonParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  function errToText(e) {
    try {
      if (!e) return "Unknown error";
      const name = e.name ? String(e.name) : "";
      const msg = e.message ? String(e.message) : String(e);
      return (name ? `${name}: ` : "") + msg;
    } catch (_) { return "Unknown error"; }
  }
  function debounce(fn, ms = 250) {
    let t = null;
    return (...args) => {
      try { clearTimeout(t); } catch (_) {}
      t = setTimeout(() => { try { fn(...args); } catch (_) {} }, ms);
    };
  }
  function uidShort() {
    return Math.random().toString(16).slice(2, 10) + "-" + Math.random().toString(16).slice(2, 6);
  }
  function safeNameFromEmail(email) {
    if (!email) return "User";
    const s = String(email).split("@")[0] || "User";
    return s.length > 18 ? s.slice(0, 18) : s;
  }
  function normalizePhotoUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.includes("googleusercontent.com") && !u.includes("sz=")) {
      return u + (u.includes("?") ? "&" : "?") + "sz=128";
    }
    return u;
  }
  async function sleepWithAbort(ms, shouldAbort) {
    const step = 250;
    let left = ms;
    while (left > 0) {
      if (shouldAbort && shouldAbort()) return;
      const s = Math.min(step, left);
      await sleep(s);
      left -= s;
    }
  }

  /* =========================
     Part 3 — STORAGE (namespaced)
     ========================= */
  const Store = (() => {
    const PREFIX = "mdv_v4_";
    function k(key) { return PREFIX + String(key || ""); }
    function getRaw(key) { try { return localStorage.getItem(k(key)); } catch (_) { return null; } }
    function setRaw(key, val) { try { localStorage.setItem(k(key), String(val == null ? "" : val)); } catch (_) {} }
    function del(key) { try { localStorage.removeItem(k(key)); } catch (_) {} }
    function getJson(key, fallback) {
      const raw = getRaw(key);
      if (!raw) return fallback;
      const obj = safeJsonParse(raw);
      return obj == null ? fallback : obj;
    }
    function setJson(key, obj) { try { setRaw(key, JSON.stringify(obj)); } catch (_) {} }
    return { getRaw, setRaw, del, getJson, setJson };
  })();

  /* =========================
     Part 4 — LOGGER
     ========================= */
  const Log = (() => {
    const MAX_LINES = 260;

    function stamp() {
      const t = new Date();
      return `${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}`;
    }
    function toConsole(type, msg) {
      try {
        if (type === "bad") console.error("[MDV]", msg);
        else if (type === "warn") console.warn("[MDV]", msg);
        else console.log("[MDV]", msg);
      } catch (_) {}
    }
    function toUI(type, msg) {
      let box = null;
      try { box = (UI && UI.els) ? UI.els.log : null; } catch (_) { box = null; }
      if (!box) return;

      const div = document.createElement("div");
      div.className = "logLine";

      if (type === "warn") div.style.color = "var(--warn)";
      if (type === "bad") div.style.color = "var(--danger)";
      if (type === "good") div.style.color = "var(--success)";

      div.innerHTML = `<span class="mono">[${stamp()}]</span> ${escapeHTML(msg)}`;
      box.prepend(div);

      try {
        const lines = box.querySelectorAll(".logLine");
        if (lines.length > MAX_LINES) {
          for (let i = MAX_LINES; i < lines.length; i++) lines[i].remove();
        }
      } catch (_) {}
    }
    function write(type, msg) {
      const m = String(msg == null ? "" : msg);
      toConsole(type, m);
      toUI(type, m);
    }
    return { write };
  })();

  /* =========================
     Part 5 — ANDROID BRIDGE (SAFE)
     ========================= */
  const AndroidBridge = {
    exists() { return !!(window.Android || window.AndroidInterface); },
    _obj() { return window.AndroidInterface || window.Android || null; },
    call(fn, ...args) {
      try {
        const o = this._obj();
        if (!o) return undefined;
        const f = o[fn];
        if (typeof f !== "function") return undefined;
        return f.apply(o, args);
      } catch (_) { return undefined; }
    },

    startGoogleSignIn() { return this.call("startGoogleSignIn"); },
    signOut() { return this.call("signOut"); },

    setCallMode(active) { return this.call("setCallMode", !!active); },
    setSpeaker(on) { return this.call("setSpeaker", !!on); },

    vibrate(ms = 30) { return this.call("vibrate", parseInt(ms, 10) || 30); },

    showAd() { return this.call("showAd"); },
    showVideoAd() { return this.call("showVideoAd"); },

    showNotification(t, b) {
      return this.call("showNotification", String(t || ""), String(b || ""));
    },

    copyToClipboard(t) { return this.call("copyToClipboard", String(t || "")); },

    getNetworkInfoJson() {
      try { return String(this.call("getNetworkInfoJson") || ""); } catch (_) { return ""; }
    },

    tcpPingMs(host, port, timeoutMs) {
      try {
        const v = this.call(
          "tcpPingMs",
          String(host || ""),
          parseInt(port, 10) || 443,
          parseInt(timeoutMs, 10) || 1500
        );
        const n = Number(v);
        return Number.isFinite(n) ? n : -1;
      } catch (_) { return -1; }
    },

    endCall() { return this.call("endCall"); },
    acceptIncoming() { return this.call("acceptIncoming"); },
    rejectIncoming() { return this.call("rejectIncoming"); },

    volumeUp() { return this.call("volumeUp"); },
    volumeDown() { return this.call("volumeDown"); },
    volumeMuteToggle() { return this.call("volumeMuteToggle"); },

    routeSpeaker() { return this.call("routeSpeaker"); },
    routeEarpiece() { return this.call("routeEarpiece"); },
    routeBluetooth() { return this.call("routeBluetooth"); },

    detectAudio() { return this.call("detectAudio"); },
    detectBluetooth() { return this.call("detectBluetooth"); },
    refreshDevices() { return this.call("refreshDevices"); },

    getDiagnostics() { return this.call("getDiagnostics"); },
    resetDiagnostics() { return this.call("resetDiagnostics"); },
    shareDiagnostics() { return this.call("shareDiagnostics"); },
  };

  /* =========================
     Part 6 — UI BINDING
     ========================= */
  const UI = {
    els: {},
    bound: false,
    bindAttempts: 0,

    FALLBACK_AVATAR:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect width='100%25' height='100%25' fill='%23333'/%3E%3Ctext x='50%25' y='52%25' text-anchor='middle' fill='%23aaa' font-size='18' font-family='Arial'%3EUSER%3C/text%3E%3C/svg%3E",

    bind() {
      const E = this.els;

      // Profile
      E.profileName = byId("userName");
      E.profileEmail = byId("userEmail");
      E.profilePhoto = byId("userPhoto");
      E.inName = byId("displayName");

      // Inputs
      E.inPresence = byId("presenceRoom");
      E.inChannel = byId("channel");
      E.inToken = byId("token");

      // Buttons (Call)
      E.btnJoin = byId("joinBtn");
      E.btnLeave = byId("leaveBtn");
      E.btnCopy = byId("copyBtn");

      E.btnSpeaker = byId("speakerBtn");
      E.btnMuteMic = byId("muteMicBtn");
      E.btnMuteSpk = byId("muteSoundBtn");

      E.btnEndCall = byId("endCallBtn");

      E.swFM = byId("fmSwitch");
      E.fmIntervalSel = byId("fmInterval");
      E.fmRebootSel = byId("fmReboot");

      E.btnBroadcastCall = byId("callBtn");
      E.btnReward = byId("rewardBtn");

      // Optional login buttons
      E.btnGoogle1 = byId("googleLoginBtn");
      E.btnGoogle2 = byId("loginBtn");
      E.btnGoogle3 = byId("signInBtn");
      E.btnGoogle4 = byId("googleBtn");
      E.btnLogout = byId("logoutBtn");

      // Status
      E.callTimerVal = byId("callTimer");
      E.netTower = byId("netTower");
      E.srvTower = byId("srvTower");
      E.netTypeTxt = byId("netTypeTxt");
      E.pingVal = byId("pingMs");

      // LEDs (DOT itself)
      E.ledWeb = byId("ledWeb");
      E.ledFirebase = byId("ledFirebase");
      E.ledListener = byId("ledListener");
      E.ledMicPerm = byId("ledMicPerm");
      E.ledAgora = byId("ledAgora");
      E.ledInCall = byId("ledInCall");
      E.ledNet = byId("ledNet");
      E.ledSrv = byId("ledSrv");
      E.ledCallQ = byId("ledCallQ");

      // Quality fields
      E.qNetText = byId("qNetText");
      E.qPingText = byId("qPingText");
      E.qJitterText = byId("qJitterText");
      E.qLossText = byId("qLossText");
      E.qUpText = byId("qUpText");
      E.qDownText = byId("qDownText");
      E.qAudioText = byId("qAudioText");
      E.qGradeText = byId("qGradeText");

      E.qNetFill = byId("qNetFill");
      E.qPingFill = byId("qPingFill");
      E.qJitterFill = byId("qJitterFill");
      E.qLossFill = byId("qLossFill");
      E.qUpFill = byId("qUpFill");
      E.qDownFill = byId("qDownFill");
      E.qAudioFill = byId("qAudioFill");
      E.qGradeFill = byId("qGradeFill");

      // Friends
      E.friendName = byId("friendSearchName");
      E.friendEmail = byId("friendSearchEmail");
      E.friendSearchBtn = byId("friendSearchBtn");
      E.friendAddBtn = byId("friendAddBtn");
      E.friendImportBtn = byId("friendImportBtn");
      E.friendExportBtn = byId("friendExportBtn");

      E.friendList = byId("friendsList");
      E.callSelectedBtn = byId("callSelectedBtn");
      E.clearSelectedBtn = byId("clearSelectedBtn");

      // Incoming modal
      E.modalOverlay = byId("incomingOverlay");
      E.modalFromName = byId("incomingFrom");
      E.modalAccept = byId("acceptCallBtn");
      E.modalDecline = byId("rejectCallBtn");

      // Reboot overlay
      E.rebootOverlay = byId("rebootOverlay");
      E.rebootCount = byId("rebootCounter");

      // Diagnostics
      E.diagNetType = byId("diagNetType");
      E.diagRssi = byId("diagRssi");
      E.diagLink = byId("diagLink");
      E.diagInternet = byId("diagInternet");
      E.diagPing = byId("diagPing");
      E.diagPingGrade = byId("diagPingGrade");
      E.diagSrvBarsTxt = byId("diagSrvBarsTxt");
      E.diagSrvLedTxt = byId("diagSrvLedTxt");
      E.diagJitter = byId("diagJitter");
      E.diagLoss = byId("diagLoss");
      E.diagUp = byId("diagUp");
      E.diagDown = byId("diagDown");
      E.diagCodec = byId("diagCodec");
      E.diagCallLedTxt = byId("diagCallLedTxt");
      E.diagNoteTxt = byId("diagNoteTxt");

      // Settings
      E.setSpeakerDefaultTxt = byId("setSpeakerDefaultTxt");
      E.setMicDefaultTxt = byId("setMicDefaultTxt");
      E.setSoundDefaultTxt = byId("setSoundDefaultTxt");
      E.setEchoTxt = byId("setEchoTxt");

      E.setPingHost = byId("setPingHost");
      E.setUpdateRateTxt = byId("setUpdateRateTxt");

      E.setLockTxt = byId("setLockTxt");
      E.setLogsTxt = byId("setLogsTxt");

      E.btnSetSpeakerOn = byId("setSpeakerDefaultOn");
      E.btnSetSpeakerOff = byId("setSpeakerDefaultOff");
      E.btnSetMicOn = byId("setMicDefaultOn");
      E.btnSetMicOff = byId("setMicDefaultOff");
      E.btnSetSoundOn = byId("setSoundDefaultOn");
      E.btnSetSoundOff = byId("setSoundDefaultOff");

      E.btnEchoAuto = byId("setEchoAuto");
      E.btnEchoOn = byId("setEchoOn");
      E.btnEchoOff = byId("setEchoOff");

      E.btnPingDefault = byId("setPingHostDefault");
      E.btnPingCustom = byId("setPingHostCustom");

      E.btnRateLow = byId("setRateLow");
      E.btnRateNorm = byId("setRateNorm");
      E.btnRateHigh = byId("setRateHigh");

      E.btnLockOn = byId("setLockOn");
      E.btnLockOff = byId("setLockOff");

      E.btnLogsOn = byId("setLogsOn");
      E.btnLogsOff = byId("setLogsOff");

      // Log
      E.log = byId("log");

      // Drawer + Theme (NEW)
      E.drawerBtn = byId("drawerBtn") || byId("menuBtn");
      E.drawerOverlay = byId("drawerOverlay");
      E.drawer = byId("drawer") || byId("tabs");

      E.themeBtn = byId("themeBtn") || byId("themeToggleBtn");
      E.themeModeTxt = byId("themeModeTxt");

      // Mic waveform (NEW / RESTORED)
      E.micWave =
        byId("micWave") ||
        byId("micWaveCanvas") ||
        byId("micHeart") ||
        byId("micHeartCanvas") ||
        byId("heartWave");

      // Defaults
      if (E.inPresence && !E.inPresence.value) E.inPresence.value = "call_room1";
      if (E.profilePhoto && !E.profilePhoto.src) E.profilePhoto.src = this.FALLBACK_AVATAR;

      this.wireEvents();
      this.bound = true;
      this.bindAttempts++;
    },

    /* =========================
       Part 7 — UI EVENTS (hard re-bind)
       ========================= */
    wireEvents() {
      const E = this.els;

      const rewireBtn = (btn, fn) => {
        if (!btn) return;
        try {
          const parent = btn.parentNode;
          if (!parent) return;
          const clone = btn.cloneNode(true);
          parent.replaceChild(clone, btn);
          fn(clone);
        } catch (_) {
          try { fn(btn); } catch (_) {}
        }
      };

      rewireBtn(E.btnJoin, (b) => b.addEventListener("click", () => App.joinFlow()));
      rewireBtn(E.btnLeave, (b) => b.addEventListener("click", () => App.leaveFlow()));
      rewireBtn(E.btnEndCall, (b) => b.addEventListener("click", () => App.endCall()));

      rewireBtn(E.btnCopy, (b) => b.addEventListener("click", () => {
        const ch = App.getChannel();
        if (!ch) return Log.write("warn", "اكتب Channel أولاً");
        try { navigator.clipboard && navigator.clipboard.writeText(ch); } catch (_) {}
        AndroidBridge.copyToClipboard(ch);
        Log.write("good", "تم نسخ اسم القناة");
      }));

      rewireBtn(E.btnSpeaker, (b) => b.addEventListener("click", () => App.toggleSpeaker()));
      rewireBtn(E.btnMuteMic, (b) => b.addEventListener("click", () => App.toggleMuteMic()));
      rewireBtn(E.btnMuteSpk, (b) => b.addEventListener("click", () => App.toggleMuteSpeaker()));

      if (E.swFM) {
        try { E.swFM.onchange = null; } catch (_) {}
        E.swFM.addEventListener("change", () => App.toggleForceMajeure());
      }

      rewireBtn(E.btnBroadcastCall, (b) => b.addEventListener("click", () => App.sendBroadcastInvite()));
      rewireBtn(E.btnReward, (b) => b.addEventListener("click", () => {
        const r = AndroidBridge.showVideoAd();
        if (r === undefined) Log.write("info", "Video Ad (Android only)");
      }));

      rewireBtn(E.friendSearchBtn, (b) => b.addEventListener("click", () => App.searchFriends()));
      rewireBtn(E.friendAddBtn, (b) => b.addEventListener("click", () => App.addFriendLocalFromInputs()));
      rewireBtn(E.friendImportBtn, (b) => b.addEventListener("click", () => App.importFriends()));
      rewireBtn(E.friendExportBtn, (b) => b.addEventListener("click", () => App.exportFriends()));

      rewireBtn(E.callSelectedBtn, (b) => b.addEventListener("click", () => App.sendCallInviteToSelected()));
      rewireBtn(E.clearSelectedBtn, (b) => b.addEventListener("click", () => App.clearFriendSelection()));

      rewireBtn(E.modalAccept, (b) => b.addEventListener("click", () => App.acceptIncomingCall()));
      rewireBtn(E.modalDecline, (b) => b.addEventListener("click", () => App.declineIncomingCall()));

      // Google login buttons
      const googleBtns = [E.btnGoogle1, E.btnGoogle2, E.btnGoogle3, E.btnGoogle4].filter(Boolean);
      googleBtns.forEach((btn) => {
        rewireBtn(btn, (b) => b.addEventListener("click", () => {
          AndroidBridge.startGoogleSignIn();
          Log.write("info", "فتح تسجيل الدخول...");
        }));
      });

      rewireBtn(E.btnLogout, (b) => b.addEventListener("click", () => {
        AndroidBridge.signOut();
        Log.write("info", "تسجيل خروج...");
      }));

      if (E.inName) {
        try { E.inName.oninput = null; } catch (_) {}
        E.inName.addEventListener("input", debounce(() => {
          App.state.profile.displayNameLocal = (E.inName.value || "").trim();
          App.persistLocal();
        }, 250));
      }

      // Settings binds
      rewireBtn(E.btnSetSpeakerOn, (b) => b.addEventListener("click", () => App.setDefaults({ speaker: true })));
      rewireBtn(E.btnSetSpeakerOff, (b) => b.addEventListener("click", () => App.setDefaults({ speaker: false })));

      rewireBtn(E.btnSetMicOn, (b) => b.addEventListener("click", () => App.setDefaults({ mic: true })));
      rewireBtn(E.btnSetMicOff, (b) => b.addEventListener("click", () => App.setDefaults({ mic: false })));

      rewireBtn(E.btnSetSoundOn, (b) => b.addEventListener("click", () => App.setDefaults({ sound: true })));
      rewireBtn(E.btnSetSoundOff, (b) => b.addEventListener("click", () => App.setDefaults({ sound: false })));

      rewireBtn(E.btnEchoAuto, (b) => b.addEventListener("click", () => App.setEchoMode("AUTO")));
      rewireBtn(E.btnEchoOn, (b) => b.addEventListener("click", () => App.setEchoMode("ON")));
      rewireBtn(E.btnEchoOff, (b) => b.addEventListener("click", () => App.setEchoMode("OFF")));

      rewireBtn(E.btnPingDefault, (b) => b.addEventListener("click", () => App.setPingHost(DEFAULT_PING_HOST)));
      rewireBtn(E.btnPingCustom, (b) => b.addEventListener("click", () => {
        const x = prompt("اكتب Ping Host:", App.state.settings.pingHost || DEFAULT_PING_HOST);
        if (x != null) App.setPingHost(String(x || "").trim());
      }));

      rewireBtn(E.btnRateLow, (b) => b.addEventListener("click", () => App.setUpdateRate("Low")));
      rewireBtn(E.btnRateNorm, (b) => b.addEventListener("click", () => App.setUpdateRate("Normal")));
      rewireBtn(E.btnRateHigh, (b) => b.addEventListener("click", () => App.setUpdateRate("High")));

      rewireBtn(E.btnLockOn, (b) => b.addEventListener("click", () => App.setLockCall(true)));
      rewireBtn(E.btnLockOff, (b) => b.addEventListener("click", () => App.setLockCall(false)));

      rewireBtn(E.btnLogsOn, (b) => b.addEventListener("click", () => App.setAutoClearLogs(true)));
      rewireBtn(E.btnLogsOff, (b) => b.addEventListener("click", () => App.setAutoClearLogs(false)));

      // Theme button (NEW)
      rewireBtn(E.themeBtn, (b) => b.addEventListener("click", () => Theme.cycle()));

      // Drawer button (NEW)
      rewireBtn(E.drawerBtn, (b) => b.addEventListener("click", () => Drawer.toggle()));
      if (E.drawerOverlay) {
        try { E.drawerOverlay.onclick = null; } catch (_) {}
        E.drawerOverlay.addEventListener("click", () => Drawer.close());
      }

      // Unlock audio on first gesture (for beeps + analyser)
      document.addEventListener("pointerdown", () => Sound.unlock(), { once: true });
      document.addEventListener("touchstart", () => Sound.unlock(), { once: true });
      document.addEventListener("click", () => Sound.unlock(), { once: true });

      // Close drawer on back/escape
      window.addEventListener("keydown", (ev) => {
        if (ev && ev.key === "Escape") Drawer.close();
      });
    },

    /* =========================
       Part 8 — UI HELPERS
       ========================= */
    setProfile({ name, email, photoUrl, locked }) {
      const E = this.els;

      safeText(E.profileName, name || "Guest");
      safeText(E.profileEmail, email || "لم يتم تسجيل الدخول");

      const p = normalizePhotoUrl(photoUrl);
      if (E.profilePhoto) {
        E.profilePhoto.onerror = () => { E.profilePhoto.src = UI.FALLBACK_AVATAR; };
        E.profilePhoto.src = p || UI.FALLBACK_AVATAR;
      }

      if (E.inName) {
        E.inName.value = name || "";
        E.inName.readOnly = !!locked;
      }
    },

    setLed(dotEl, status) {
      if (!dotEl) return;
      let el = null;
      try {
        el = (dotEl.classList && dotEl.classList.contains("dot"))
          ? dotEl
          : (dotEl.querySelector ? dotEl.querySelector(".dot") : null);
      } catch (_) { el = dotEl; }

      if (!el || !el.classList) return;
      el.classList.remove("on", "off", "warn", "bad");
      el.classList.add(status || "off");
    },

    setCallState(mode) {
      const connected = mode === "connected";
      const E = this.els;

      if (E.btnJoin) E.btnJoin.disabled = connected;
      if (E.btnLeave) E.btnLeave.disabled = !connected;
      if (E.inChannel) E.inChannel.disabled = connected || !!App.state.settings.lockCall;

      this.setLed(E.ledInCall, connected ? "on" : "off");
    },

    setCallTimer(seconds) {
      if (this.els.callTimerVal) safeText(this.els.callTimerVal, fmtTime(seconds));
    },

    showModal(show) {
      const m = this.els.modalOverlay;
      if (!m) return;
      if (show) {
        m.classList.remove("hidden");
        m.setAttribute("aria-hidden", "false");
      } else {
        m.classList.add("hidden");
        m.setAttribute("aria-hidden", "true");
      }
    },

    showReboot(show, count) {
      const o = this.els.rebootOverlay;
      if (!o) return;
      if (show) {
        o.classList.remove("hidden");
        o.setAttribute("aria-hidden", "false");
      } else {
        o.classList.add("hidden");
        o.setAttribute("aria-hidden", "true");
      }
      if (show && this.els.rebootCount) safeText(this.els.rebootCount, String(count ?? ""));
    },

    updateTower(towerEl, activeCount, statusClass) {
      if (!towerEl) return;
      const bars = towerEl.querySelectorAll(".bar");
      bars.forEach((b, i) => {
        b.classList.remove("on", "warn", "bad");
        if (i < activeCount) b.classList.add(statusClass);
      });
    },

    setSignalUI({ type, rssi, hasInternet }) {
      if (this.els.netTypeTxt) safeText(this.els.netTypeTxt, type ? String(type).toUpperCase() : "...");

      let bars = 0;
      let status = "off";

      if (!hasInternet) {
        bars = 0;
        status = "bad";
      } else if (type === "wifi" && typeof rssi === "number") {
        if (rssi >= -55) { bars = 4; status = "on"; }
        else if (rssi >= -67) { bars = 3; status = "on"; }
        else if (rssi >= -78) { bars = 2; status = "warn"; }
        else { bars = 1; status = "bad"; }
      } else {
        bars = 3;
        status = "on";
      }

      this.updateTower(this.els.netTower, bars, status);
      this.setLed(this.els.ledNet, status === "on" ? "on" : status === "warn" ? "warn" : "bad");
    },

    setPing(ms) {
      if (this.els.pingVal) safeText(this.els.pingVal, ms >= 0 ? String(ms) : "...");

      let bars = 0;
      let status = "off";

      if (ms < 0) { bars = 0; status = "bad"; }
      else if (ms < 100) { bars = 4; status = "on"; }
      else if (ms < 200) { bars = 3; status = "on"; }
      else if (ms < 400) { bars = 2; status = "warn"; }
      else { bars = 1; status = "bad"; }

      this.updateTower(this.els.srvTower, bars, status);
      this.setLed(this.els.ledSrv, status === "on" ? "on" : status === "warn" ? "warn" : "bad");
    },

    setQualityUI(pack) {
      if (!pack) return;
      const E = this.els;

      if (E.qNetText) safeText(E.qNetText, pack.netText || "...");
      if (E.qPingText) safeText(E.qPingText, String(pack.pingMs ?? "..."));
      if (E.qJitterText) safeText(E.qJitterText, String(pack.jitterMs ?? "..."));
      if (E.qLossText) safeText(E.qLossText, String(pack.lossPct ?? "..."));
      if (E.qUpText) safeText(E.qUpText, String(pack.upKbps ?? "..."));
      if (E.qDownText) safeText(E.qDownText, String(pack.downKbps ?? "..."));
      if (E.qAudioText) safeText(E.qAudioText, String(pack.audioLevel ?? "..."));
      if (E.qGradeText) safeText(E.qGradeText, pack.grade || "...");

      const clamp = (x) => Math.max(0, Math.min(100, Number(x) || 0));
      const setFill = (el, v) => { if (el) el.style.width = clamp(v) + "%"; };

      setFill(E.qNetFill, pack.netScore);
      setFill(E.qPingFill, pack.pingScore);
      setFill(E.qJitterFill, pack.jitterScore);
      setFill(E.qLossFill, pack.lossScore);
      setFill(E.qUpFill, pack.upScore);
      setFill(E.qDownFill, pack.downScore);
      setFill(E.qAudioFill, pack.audioScore);
      setFill(E.qGradeFill, pack.gradeScore);
    },

    renderFriends(list, selectedSet, onToggle, onQuickCall) {
      const box = this.els.friendList;
      if (!box) return;

      safeHTML(box, "");

      if (!list || !list.length) {
        const empty = document.createElement("div");
        empty.className = "logLine";
        empty.textContent = "لا يوجد أصدقاء بعد. ابحث بالاسم/الإيميل ثم أضف.";
        box.appendChild(empty);
        return;
      }

      list.forEach((f) => {
        const key = f.uid || f.email || f.id || uidShort();
        const selected = selectedSet.has(key);

        const row = document.createElement("div");
        row.className = "logLine";
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.gap = "8px";

        row.innerHTML = `
          <div style="min-width:0">
            <div style="font-weight:900;color:var(--txt);font-size:11px">${escapeHTML(f.displayName || "Friend")}</div>
            <div style="color:var(--muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px">${escapeHTML(f.email || f.uid || "")}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn tiny toggleBtn" type="button">${selected ? "✓" : "+"}</button>
            <button class="btn tiny warn callBtn" type="button">Call</button>
          </div>
        `;

        const toggleBtn = row.querySelector(".toggleBtn");
        const callBtn = row.querySelector(".callBtn");

        if (toggleBtn) toggleBtn.addEventListener("click", () => onToggle(key));
        if (callBtn) callBtn.addEventListener("click", () => onQuickCall(key));

        box.appendChild(row);
      });
    },

    syncSettingsUI(s) {
      const E = this.els;
      if (!s) return;

      if (E.setSpeakerDefaultTxt) safeText(E.setSpeakerDefaultTxt, s.speakerDefault ? "ON" : "OFF");
      if (E.setMicDefaultTxt) safeText(E.setMicDefaultTxt, s.micDefault ? "ON" : "OFF");
      if (E.setSoundDefaultTxt) safeText(E.setSoundDefaultTxt, s.soundDefault ? "ON" : "OFF");
      if (E.setEchoTxt) safeText(E.setEchoTxt, s.echoMode || "AUTO");

      if (E.setPingHost) safeText(E.setPingHost, s.pingHost || DEFAULT_PING_HOST);
      if (E.setUpdateRateTxt) safeText(E.setUpdateRateTxt, s.updateRate || "Normal");

      if (E.setLockTxt) safeText(E.setLockTxt, s.lockCall ? "ON" : "OFF");
      if (E.setLogsTxt) safeText(E.setLogsTxt, s.autoClearLogs ? "ON" : "OFF");
    },

    syncThemeUI(mode) {
      const E = this.els;
      if (E.themeModeTxt) safeText(E.themeModeTxt, mode || "system");
    }
  };

  /* =========================
     Part 9 — SOUND (WebAudio)
     ========================= */
  const Sound = (() => {
    let ctx = null;

    function getCtx() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx;
    }
    function unlock() {
      try {
        const ac = getCtx();
        if (ac.state === "suspended") ac.resume();
      } catch (_) {}
    }
    function tone(freq, durationMs, type = "sine", gain = 0.06) {
      try {
        const ac = getCtx();
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = gain;
        o.connect(g);
        g.connect(ac.destination);
        o.start();
        o.stop(ac.currentTime + (durationMs / 1000));
      } catch (_) {}
    }
    function beepPattern() {
      tone(880, 100, "square", 0.05);
      setTimeout(() => tone(880, 100, "square", 0.05), 140);
      setTimeout(() => tone(880, 100, "square", 0.05), 280);
      setTimeout(() => tone(660, 450, "sawtooth", 0.04), 440);
    }
    function tactical() {
      tone(1200, 70, "square", 0.04);
      setTimeout(() => tone(1400, 70, "square", 0.04), 110);
      setTimeout(() => tone(1000, 90, "square", 0.04), 220);
    }
    function teesh() {
      try {
        const ac = getCtx();
        const bufferSize = Math.floor(ac.sampleRate * 0.25);
        const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.25;

        const src = ac.createBufferSource();
        const g = ac.createGain();
        g.gain.value = 0.12;
        src.buffer = buffer;
        src.connect(g);
        g.connect(ac.destination);
        src.start();
      } catch (_) {}
    }
    function tentilik() {
      tone(1200, 90, "sine", 0.05);
      setTimeout(() => tone(1600, 140, "sine", 0.05), 120);
    }
    return { unlock, beepPattern, tactical, teesh, tentilik, tone, _getCtx: () => getCtx() };
  })();

  /* =========================
     Part 10 — THEME (system/dark/light)
     ========================= */
  const Theme = (() => {
    const KEY = "theme_mode"; // system|dark|light

    function get() {
      const v = String(Store.getRaw(KEY) || "system").toLowerCase();
      if (v === "dark" || v === "light") return v;
      return "system";
    }

    function apply(mode) {
      const m = String(mode || "system").toLowerCase();
      if (m === "dark" || m === "light") {
        document.documentElement.setAttribute("data-theme", m);
        Store.setRaw(KEY, m);
        UI.syncThemeUI(m);
        return m;
      }
      // system
      document.documentElement.removeAttribute("data-theme");
      Store.setRaw(KEY, "system");
      UI.syncThemeUI("system");
      return "system";
    }

    function cycle() {
      const cur = get();
      const next = (cur === "system") ? "dark" : (cur === "dark") ? "light" : "system";
      const applied = apply(next);
      Log.write("info", "Theme: " + applied);
      AndroidBridge.vibrate(18);
    }

    function init() {
      apply(get());
    }

    return { init, get, apply, cycle };
  })();

  /* =========================
     Part 11 — DRAWER (side panel)
     ========================= */
  const Drawer = (() => {
    function isOpen() { return document.body.classList.contains("drawerOpen") || document.body.classList.contains("drawer-open"); }

    function open() {
      document.body.classList.add("drawerOpen");
      document.body.classList.add("drawer-open");
      if (UI.els.drawerOverlay){ UI.els.drawerOverlay.classList.add("show"); UI.els.drawerOverlay.classList.remove("hidden"); }
      if (UI.els.drawer){ UI.els.drawer.classList.remove("hidden"); UI.els.drawer.setAttribute("aria-hidden","false"); }
    }

    function close() {
      document.body.classList.remove("drawerOpen");
      document.body.classList.remove("drawer-open");
      // keep overlay present if your CSS uses opacity; still safe to hide
      if (UI.els.drawerOverlay){ UI.els.drawerOverlay.classList.remove("show"); UI.els.drawerOverlay.classList.add("hidden"); }
      if (UI.els.drawer){ UI.els.drawer.classList.add("hidden"); UI.els.drawer.setAttribute("aria-hidden","true"); }
    }

    function toggle() {
      if (isOpen()) close();
      else open();
    }

    function init() {
      // If your HTML already keeps drawer visible, remove hidden safely
      // We start CLOSED by default
      close();

      // Close when clicking any button with data-drawer-close
      const hook = () => {
        const root = UI.els.drawer;
        if (!root) return;
        $$(".drawerClose,[data-drawer-close]", root).forEach((el) => {
          el.addEventListener("click", () => close());
        });
      };
      hook();
    }

    return { init, open, close, toggle, isOpen };
  })();

  /* =========================
     Part 12 — MIC HEART MONITOR (RESTORED)
     - Works best with <canvas id="micWave"></canvas>
     ========================= */
  const MicViz = (() => {
    let canvas = null;
    let ctx = null;
    let ac = null;
    let analyser = null;
    let src = null;
    let data = null;
    let raf = 0;

    let lastY = 0;
    let lastLevel = 0; // 0..1
    let beatCooldown = 0;

    function _cssVar(name, fallback) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name);
        const s = String(v || "").trim();
        return s || fallback;
      } catch (_) { return fallback; }
    }

    function _ensureCanvasSize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const w = Math.max(60, Math.floor(rect.width * dpr));
      const h = Math.max(30, Math.floor(rect.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      if (!ctx) ctx = canvas.getContext("2d");
    }

    function _clear() {
      if (!ctx || !canvas) return;
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function _drawBeat(x, mid, amp, color) {
      // ECG spike pattern
      const h = canvas.height;
      const top = Math.max(4, mid - amp * (h * 0.46) - 8);
      const bot = Math.min(h - 4, mid + amp * (h * 0.18) + 10);

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.floor(canvas.width / 420));
      ctx.beginPath();
      ctx.moveTo(x - 10, mid);
      ctx.lineTo(x - 6, mid);
      ctx.lineTo(x - 4, top);
      ctx.lineTo(x - 2, mid + 6);
      ctx.lineTo(x + 2, bot);
      ctx.lineTo(x + 6, mid);
      ctx.lineTo(x + 10, mid);
      ctx.stroke();
    }

    function _loop() {
      if (!canvas || !ctx || !analyser || !data) return;
      raf = requestAnimationFrame(_loop);

      _ensureCanvasSize();
      const w = canvas.width;
      const h = canvas.height;
      const mid = Math.floor(h / 2);

      // scroll left
      const dx = Math.max(1, Math.floor(w / 160)); // speed based on width
      ctx.drawImage(canvas, -dx, 0);

      // fade right band
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.16)";
      ctx.fillRect(w - dx, 0, dx, h);

      analyser.getByteTimeDomainData(data);

      // RMS level
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      lastLevel = Math.max(0, Math.min(1, rms));

      // map to y
      const amp = Math.min(1, rms * 3.0); // boost
      const y = mid - amp * (h * 0.40);

      // stroke color from CSS var
      const color = _cssVar("--purple", "#a855f7");

      // draw line segment on right
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.floor(w / 380));
      ctx.beginPath();
      ctx.moveTo(w - dx - 1, lastY || mid);
      ctx.lineTo(w - 1, y);
      ctx.stroke();

      // beat detection (voice peaks)
      beatCooldown = Math.max(0, beatCooldown - 1);
      if (amp > 0.20 && beatCooldown === 0) {
        _drawBeat(w - Math.floor(dx / 2), mid, amp, color);
        beatCooldown = 18; // cooldown frames
      }

      // subtle baseline
      ctx.strokeStyle = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w - dx, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      lastY = y;
    }

    function stop() {
      try { if (raf) cancelAnimationFrame(raf); } catch (_) {}
      raf = 0;
      try { if (src) src.disconnect(); } catch (_) {}
      try { if (analyser) analyser.disconnect(); } catch (_) {}
      src = null;
      analyser = null;
      data = null;
      lastLevel = 0;
      lastY = 0;
      beatCooldown = 0;
      if (canvas && canvas.getContext) {
        ctx = canvas.getContext("2d");
        if (ctx) _clear();
      }
    }

    function start(targetCanvasEl, mediaStreamTrack) {
      canvas = targetCanvasEl && targetCanvasEl.tagName === "CANVAS" ? targetCanvasEl : null;
      if (!canvas) {
        // إذا ما عندك Canvas بنفس الـ ID، ما نكسر التطبيق
        return false;
      }

      try { ac = Sound._getCtx(); } catch (_) { ac = null; }
      if (!ac) return false;

      try {
        const t = mediaStreamTrack || null;
        if (!t) return false;

        const stream = new MediaStream([t]);
        src = ac.createMediaStreamSource(stream);
        analyser = ac.createAnalyser();
        analyser.fftSize = 2048;

        data = new Uint8Array(analyser.fftSize);

        src.connect(analyser);

        _ensureCanvasSize();
        _clear();

        lastY = Math.floor(canvas.height / 2);
        lastLevel = 0;

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(_loop);
        return true;
      } catch (_) {
        stop();
        return false;
      }
    }

    function level() { return lastLevel || 0; }

    return { start, stop, level };
  })();

  /* =========================
     Part 13 — FIREBASE COMPAT WRAPPER
     ========================= */
  const DB = (() => {
    let inited = false;
    let fs = null;
    let auth = null;

    function hasSDK() {
      return !!(window.firebase && typeof window.firebase.initializeApp === "function");
    }

    function initFirebaseCompat() {
      if (inited) return !!fs;
      inited = true;

      if (!hasSDK()) return false;

      try {
        if (!(window.firebase.apps && window.firebase.apps.length > 0)) {
          for (let i = 0; i < FIREBASE_CONFIGS.length; i++) {
            const cfg = FIREBASE_CONFIGS[i];
            try {
              window.firebase.initializeApp(cfg);
              break;
            } catch (_) {}
          }
        }

        auth = window.firebase.auth ? window.firebase.auth() : null;
        fs = window.firebase.firestore ? window.firebase.firestore() : null;

        try {
          if (auth && auth.setPersistence && window.firebase.auth && window.firebase.auth.Auth && window.firebase.auth.Auth.Persistence) {
            auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
          }
        } catch (_) {}

        return !!fs;
      } catch (_) {
        auth = null;
        fs = null;
        return false;
      }
    }

    function ready() { return fs ? true : initFirebaseCompat(); }
    function authReady() { return ready() && !!auth; }

    function serverTimestamp() {
      try { return window.firebase.firestore.FieldValue.serverTimestamp(); } catch (_) { return null; }
    }

    function doc(path) { return ready() ? fs.doc(path) : null; }
    function col(path) { return ready() ? fs.collection(path) : null; }

    async function set(pathOrRef, data, merge = true) {
      if (!ready()) return false;
      const ref = (typeof pathOrRef === "string") ? doc(pathOrRef) : pathOrRef;
      if (!ref) return false;
      await ref.set(data, { merge });
      return true;
    }

    async function add(path, data) {
      const c = col(path);
      if (!c) return null;
      return await c.add(data);
    }

    function onSnapshot(queryOrRef, cb, errCb) {
      if (!queryOrRef) return () => {};
      return queryOrRef.onSnapshot(cb, errCb);
    }

    function onAuthStateChanged(cb) {
      if (!authReady()) return () => {};
      try { return auth.onAuthStateChanged(cb); } catch (_) { return () => {}; }
    }

    async function signInAnonymously() {
      if (!authReady()) return null;
      try { return await auth.signInAnonymously(); } catch (_) { return null; }
    }

    function currentUser() {
      try { return authReady() ? auth.currentUser : null; } catch (_) { return null; }
    }

    async function queryUsersByEmail(email) {
      if (!ready()) return [];
      const e = String(email || "").trim().toLowerCase();
      if (!e) return [];
      try {
        const snap = await fs.collection("usersPublic").where("emailLower", "==", e).limit(10).get();
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        return out;
      } catch (_) { return []; }
    }

    async function queryUsersByNamePrefix(name) {
      if (!ready()) return [];
      const n = String(name || "").trim().toLowerCase();
      if (!n) return [];
      try {
        const end = n + "\uf8ff";
        const q = fs.collection("usersPublic")
          .orderBy("displayNameLower")
          .startAt(n)
          .endAt(end)
          .limit(10);
        const snap = await q.get();
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        return out;
      } catch (_) { return []; }
    }

    return {
      ready,
      authReady,
      serverTimestamp,
      doc,
      col,
      set,
      add,
      onSnapshot,
      onAuthStateChanged,
      signInAnonymously,
      currentUser,
      queryUsersByEmail,
      queryUsersByNamePrefix
    };
  })();

  /* =========================
     Part 14 — AUTH SYNC
     ========================= */
  const AuthSync = (() => {
    let lastSource = "none"; // android | firebase | none

    function isAnonymousUser(u) {
      try { return !!(u && u.isAnonymous); } catch (_) { return false; }
    }

    function applyProfile(p, source) {
      const name = String(p.name || "").trim() || (p.email ? safeNameFromEmail(p.email) : "User");
      const email = String(p.email || "").trim();
      const photoUrl = normalizePhotoUrl(p.photoUrl);

      App.state.profile.loggedIn = !!(email || name);
      App.state.profile.displayName = name;
      App.state.profile.email = email;
      App.state.profile.photoUrl = photoUrl;

      const locked = !!(source === "android" || source === "firebase");
      UI.setProfile({ name, email: email || "لم يتم تسجيل الدخول", photoUrl, locked });
      App.persistLocal();

      lastSource = source || "none";
      Log.write("good", `Profile updated (${lastSource}) ✅`);
    }

    function clearProfile(reason) {
      App.state.profile.loggedIn = false;
      App.state.profile.uid = null;

      const keepName = App.state.profile.displayNameLocal || "Guest";
      App.state.profile.displayName = keepName;
      App.state.profile.email = "";
      App.state.profile.photoUrl = "";

      UI.setProfile({
        name: keepName,
        email: "لم يتم تسجيل الدخول",
        photoUrl: "",
        locked: false
      });

      lastSource = "none";
      Log.write("warn", reason || "Profile cleared");
    }

    function onAndroidLogin(name, email, photoUrl) {
      const e = String(email || "").trim();
      const n = String(name || "").trim() || safeNameFromEmail(e);
      applyProfile({ name: n, email: e, photoUrl }, "android");
    }

    function onAndroidLogout() { clearProfile("Android logout"); }

    function onFirebaseUserChanged(user) {
      if (!user) {
        if (lastSource === "android") {
          Log.write("info", "Firebase user null (kept Android profile)");
          return;
        }
        clearProfile("Firebase signed out");
        return;
      }

      if (isAnonymousUser(user)) {
        if (lastSource === "android") {
          Log.write("info", "Firebase anonymous (kept Android profile)");
          return;
        }
        const localName = App.state.profile.displayNameLocal || "Guest";
        UI.setProfile({ name: localName, email: "لم يتم تسجيل الدخول", photoUrl: "", locked: false });
        Log.write("info", "Firebase anonymous session");
        return;
      }

      const email = user.email || "";
      const name = user.displayName || safeNameFromEmail(email);
      const photoUrl = user.photoURL || "";
      applyProfile({ name, email, photoUrl }, "firebase");
    }

    function init() {
      const localName = App.state.profile.displayNameLocal || App.state.profile.displayName || "Guest";
      const localEmail = App.state.profile.email || "";
      const localPhoto = App.state.profile.photoUrl || "";
      UI.setProfile({ name: localName, email: localEmail || "لم يتم تسجيل الدخول", photoUrl: localPhoto, locked: false });

      const prevOnAndroidUser = window.onAndroidUser;
      window.onAndroidUser = function(name, email, photo) {
        try { if (typeof prevOnAndroidUser === "function") prevOnAndroidUser(name, email, photo); } catch (_) {}
        try { onAndroidLogin(name, email, photo); } catch (_) {}
      };

      window.onAndroidLogin = function(name, email, photoUrl) { try { onAndroidLogin(name, email, photoUrl); } catch (_) {} };
      window.onAndroidLogout = function() { try { onAndroidLogout(); } catch (_) {} };
      window.onAndroidLoginFail = function(msg) { try { Log.write("bad", "Login failed: " + String(msg || "")); } catch (_) {} };
      // Apply any cached native user info (if native fired before app.js ready)
      try {
        const last = window.__MDV_LAST_ANDROID_USER__;
        if (last && (last.email || last.name)) onAndroidLogin(last.name || "", last.email || "", last.photo || "");
      } catch (_) {}
    }

    return { init, onFirebaseUserChanged, onAndroidLogin, onAndroidLogout, clearProfile };
  })();

  /* =========================
   Part 15 — AGORA WRAPPER
   ========================= */
const Voice = (() => {
  let client = null;
  let localTrack = null;
  let joined = false;
  const remote = new Map(); // uid -> audioTrack

  // SDK loader state
  let _sdkPromise = null;
  let _sdkLastErr = "";

  function hasSDK() { return !!window.AgoraRTC; }
  function isJoined() { return joined; }
  function getLocalTrack() { return localTrack; }
  function getSDKLastError() { return _sdkLastErr || ""; }

  function getLocalMediaStreamTrack() {
    try {
      if (!localTrack) return null;
      if (typeof localTrack.getMediaStreamTrack === "function") return localTrack.getMediaStreamTrack();
      return null;
    } catch (_) { return null; }
  }

  function _uniq(list) {
    const out = [];
    const seen = new Set();
    for (let i = 0; i < list.length; i++) {
      const s = String(list[i] || "").trim();
      if (!s) continue;
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
    return out;
  }

  function _loadScriptOnce(src, timeoutMs) {
    return new Promise((resolve) => {
      try {
        const scripts = document.querySelectorAll('script[data-mdv-agora-src]');
          let exists = null;
          for (let i = 0; i < scripts.length; i++) {
            try { if (scripts[i].getAttribute("data-mdv-agora-src") === src) { exists = scripts[i]; break; } } catch (_) {}
          }
        if (exists) {
          // already requested, wait a little
          setTimeout(() => resolve(true), 60);
          return;
        }

        const s = document.createElement("script");
        s.async = true;
        s.defer = true;
        s.src = src;
        s.setAttribute("data-mdv-agora", "1");
        s.setAttribute("data-mdv-agora-src", src);

        let done = false;
        const finish = (ok, msg) => {
          if (done) return;
          done = true;
          try { clearTimeout(t); } catch (_) {}
          if (!ok && msg) _sdkLastErr = String(msg || "");
          resolve(!!ok);
        };

        s.onload = () => finish(true, "");
        s.onerror = () => finish(false, "Failed to load: " + src);

        document.head.appendChild(s);

        const t = setTimeout(() => {
          try { s.remove(); } catch (_) {}
          finish(false, "Timeout loading: " + src);
        }, Math.max(1500, Number(timeoutMs) || 12000));
      } catch (e) {
        _sdkLastErr = errToText(e);
        resolve(false);
      }
    });
  }

  async function ensureSDK(opts = {}) {
    const timeoutMs = Math.max(2500, Math.min(20000, Number(opts.timeoutMs || 12000)));
    const force = !!opts.force;

    if (hasSDK()) return true;

    if (_sdkPromise && !force) {
      try { return await _sdkPromise; } catch (_) { return hasSDK(); }
    }

    _sdkPromise = (async () => {
      _sdkLastErr = "";

      // 1) user override (localStorage) OR injected by HTML
      const override =
        String(Store.getRaw("agora_sdk_url") || "").trim() ||
        String(window.__MDV_AGORA_SDK_URL__ || "").trim();

      // 2) fallbacks (prefer local file near index.html for APK)
      const urls = _uniq([
        override,

        // Local file (place AgoraRTC_N.js next to index.html in android_asset)
        "AgoraRTC_N.js",
        "./AgoraRTC_N.js",

        // Official CDNs
        "https://download.agora.io/sdk/release/AgoraRTC_N.js",
        "https://cdn.agora.io/sdk/release/AgoraRTC_N.js",

        // Unpkg fallback (versioned + latest)
        "https://unpkg.com/agora-rtc-sdk-ng@4.20.2/AgoraRTC_N.js",
        "https://unpkg.com/agora-rtc-sdk-ng/AgoraRTC_N.js",
      ]);

      for (let i = 0; i < urls.length; i++) {
        if (hasSDK()) return true;

        const src = urls[i];
        if (!src) continue;

        Log.write("warn", "تحميل Agora SDK… (" + (i + 1) + "/" + urls.length + ")");
        const ok = await _loadScriptOnce(src, timeoutMs);

        // allow script to register global
        await sleep(80);

        if (ok && hasSDK()) return true;
      }

      return hasSDK();
    })();

    let ok = false;
    try { ok = await _sdkPromise; }
    catch (e) {
      _sdkLastErr = errToText(e);
      ok = hasSDK();
    }

    if (!ok) _sdkPromise = null; // allow retries
    return ok;
  }

  async function join({ appId, channel, token, uid }) {
    if (!appId) throw new Error("Agora APP_ID missing");
    if (!channel) throw new Error("Channel missing");

    // auto-load SDK if missing
    if (!hasSDK()) {
      const ok = await ensureSDK({ timeoutMs: 12000 });
      if (!ok) throw new Error("AgoraRTC not loaded");
    }

    if (!client) {
      client = window.AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      wireEvents();
    }

    await client.join(appId, channel, token || null, uid || null);

    // Apply echo settings (safe fallback if SDK ignores unknown keys)
    let track = null;
    try {
      const echoMode = String((App && App.state && App.state.settings && App.state.settings.echoMode) || "AUTO").toUpperCase();
      const cfg = (echoMode === "ON") ? { AEC: true, AGC: true, ANS: true }
        : (echoMode === "OFF") ? { AEC: false, AGC: false, ANS: false }
        : { AEC: true, AGC: true, ANS: true };

      track = await window.AgoraRTC.createMicrophoneAudioTrack(cfg);
    } catch (_) {
      track = await window.AgoraRTC.createMicrophoneAudioTrack();
    }

    localTrack = track;
    await client.publish([localTrack]);

    joined = true;
    return true;
  }

  async function leave() {
    if (!client) return;

    try {
      if (localTrack) {
        localTrack.stop();
        localTrack.close();
      }
    } catch (_) {}
    localTrack = null;

    try {
      for (const [, tr] of remote.entries()) {
        try { tr.stop && tr.stop(); } catch (_) {}
      }
      remote.clear();
    } catch (_) {}

    try { await client.leave(); } catch (_) {}
    joined = false;
  }

  function setMicMuted(muted) {
    if (!localTrack) return;
    try {
      if (typeof localTrack.setEnabled === "function") localTrack.setEnabled(!muted);
      else if (typeof localTrack.setMuted === "function") localTrack.setMuted(!!muted);
    } catch (_) {}
  }

  function setSpeakerMuted(muted) {
    for (const [, tr] of remote.entries()) {
      try { if (tr && typeof tr.setVolume === "function") tr.setVolume(muted ? 0 : 100); } catch (_) {}
    }
  }

  function wireEvents() {
    if (!client) return;

    client.on("user-published", async (user, mediaType) => {
      try {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
          remote.set(String(user.uid), user.audioTrack);
          App.onRemoteUsersChanged();
        }
      } catch (e) {
        Log.write("bad", "Agora subscribe failed: " + errToText(e));
      }
    });

    client.on("user-unpublished", (user, mediaType) => {
      try {
        if (mediaType === "audio") {
          const tr = remote.get(String(user.uid));
          try { tr && tr.stop && tr.stop(); } catch (_) {}
          remote.delete(String(user.uid));
          App.onRemoteUsersChanged();
        }
      } catch (_) {}
    });

    client.on("user-left", (user) => {
      try {
        const tr = remote.get(String(user.uid));
        try { tr && tr.stop && tr.stop(); } catch (_) {}
        remote.delete(String(user.uid));
        App.onRemoteUsersChanged();
      } catch (_) {}
    });

    client.on("network-quality", (stats) => {
      App.onAgoraNetworkQuality(stats);
    });

    client.on("exception", (e) => {
      Log.write("bad", "Agora exception: " + errToText(e));
    });
  }

  return {
    hasSDK,
    ensureSDK,
    getSDKLastError,
    join,
    leave,
    isJoined,
    setMicMuted,
    setSpeakerMuted,
    getLocalTrack,
    getLocalMediaStreamTrack
  };
})();

  /* =========================
     Part 16 — NORMALIZERS + HISTORY
     ========================= */
  function normalizeFriend(f) {
    const o = { ...(f || {}) };
    o.uid = String(o.uid || o.id || "").trim();
    o.displayName = String(o.displayName || "Friend").trim();
    o.email = String(o.email || "").trim();
    o.photoUrl = String(o.photoUrl || "").trim();
    o.id = String(o.id || o.uid || o.email || uidShort()).trim();
    return o;
  }

  const CallHistory = (() => {
    const KEY = "call_history";
    const MAX = 50;

    function list() {
      const a = Store.getJson(KEY, []);
      return Array.isArray(a) ? a : [];
    }

    function push(item) {
      const a = list();
      a.unshift(item);
      while (a.length > MAX) a.pop();
      Store.setJson(KEY, a);
    }

    function mark(type, payload) {
      push({ t: now(), type: String(type || "event"), payload: payload || {} });
    }

    return { list, mark };
  })();

  /* =========================
     Part 17 — APP STATE + INIT
     ========================= */
  const App = {
    state: {
      profile: {
        loggedIn: false,
        uid: null,
        displayName: "Guest",
        email: "",
        photoUrl: "",
        displayNameLocal: ""
      },

      call: {
        inCall: false,
        joining: false,
        leaving: false,
        channel: "",
        token: "",
        startAt: 0,
        timerT: null,
        usageT: null
      },

      speakerOn: false,
      micMuted: false,
      speakerMuted: false,

      fm: {
        enabled: false,
        intervalMs: FM_INTERVAL_MS, // LOCKED
        running: false,
        loopT: null,
        abort: false
      },

      net: {
        type: "none",
        rssi: null,
        linkMbps: null,
        hasInternet: false,
        pingMs: -1,
        jitterMs: 0,
        lossPct: 0,
        upKbps: 0,
        downKbps: 0,
        audioLevel: 0
      },

      friends: { list: [], selected: new Set() },

      incoming: {
        active: false,
        docPath: null,
        fromName: "",
        fromEmail: "",
        channel: "",
        createdAt: 0
      },

      settings: {
        speakerDefault: false,
        micDefault: true,
        soundDefault: true,
        echoMode: "AUTO",
        pingHost: DEFAULT_PING_HOST,
        updateRate: "Normal", // Low/Normal/High
        lockCall: false,
        autoClearLogs: false
      },

      unsub: {
        incomingCalls: null,
        auth: null
      },

      __presenceT: null,
      __netT: null,
      __pingT: null,
      __audioT: null,

      __domObserver: null
    },

    init() {
      this.ensureUIBound();
      this.loadLocal();

      Theme.init();        // NEW
      Drawer.init();       // NEW
      AuthSync.init();

      // LEDs initial
      UI.setLed(UI.els.ledWeb, "on");
      UI.setLed(UI.els.ledFirebase, DB.ready() ? "warn" : "bad");
      UI.setLed(UI.els.ledListener, "off");
      UI.setLed(UI.els.ledMicPerm, "off");
      UI.setLed(UI.els.ledAgora, Voice.hasSDK() ? "warn" : "bad");
      UI.setLed(UI.els.ledInCall, "off");
      UI.setLed(UI.els.ledNet, "off");
      UI.setLed(UI.els.ledSrv, "off");
      UI.setLed(UI.els.ledCallQ, "off");

      this.syncForceMajeureUI();
      this.renderFriends();
      this.initFirebaseAuth();

      this.startNetworkMonitor();
      this.startPingMonitor();
      this.startAudioMeter(); // NEW (updates audioLevel from MicViz)

      UI.setCallTimer(0);
      UI.setCallState("disconnected");

      UI.syncSettingsUI(this.state.settings);
      this.syncButtonsText();

      Log.write("good", "App ready ✅");
      Log.write("info", Voice.hasSDK() ? "Agora SDK: OK" : "Agora SDK: NOT LOADED (check script)");
      Log.write("info", "Version: " + APP_VERSION);

      try { console.log("✅ App.js loaded, AGORA_APP_ID =", AGORA_APP_ID); } catch (_) {}
      this.attachLifecycle();
    },

    /* =========================
       Part 18 — UI REBIND + LIFECYCLE
       ========================= */
    ensureUIBound() {
      const mustExist = () => {
        const a = byId("joinBtn");
        const b = byId("leaveBtn");
        const c = byId("channel");
        const d = byId("log");
        return !!(a && b && c && d);
      };

      const doBind = () => {
        try {
          UI.bind();
          Log.write("good", "UI bound ✅");
          UI.syncSettingsUI(this.state.settings);
          UI.syncThemeUI(Theme.get());
          this.syncButtonsText();
        } catch (e) {
          try { console.warn(e); } catch (_) {}
        }
      };

      if (mustExist()) {
        doBind();
        return;
      }

      try {
        if (this.state.__domObserver) {
          this.state.__domObserver.disconnect();
          this.state.__domObserver = null;
        }
      } catch (_) {}

      const obs = new MutationObserver(() => {
        if (mustExist()) {
          doBind();
          try { obs.disconnect(); } catch (_) {}
        }
      });

      try {
        obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
        this.state.__domObserver = obs;
      } catch (_) {}

      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (mustExist()) {
          clearInterval(t);
          doBind();
          return;
        }
        if (tries >= 12) {
          clearInterval(t);
          try { console.warn("UI bind timed out, check IDs in index.html"); } catch (_) {}
        }
      }, 250);
    },

    attachLifecycle() {
      const onHide = () => { try { this.setPresenceState("offline"); } catch (_) {} };
      const onShow = () => {
        try { this.setPresenceState(this.state.call.inCall ? "in_call" : "online"); } catch (_) {}
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") onHide();
        else onShow();
      });

      window.addEventListener("pagehide", () => onHide());
      window.addEventListener("beforeunload", () => onHide());
    },

    syncForceMajeureUI() {
      if (UI.els.swFM) UI.els.swFM.checked = !!this.state.fm.enabled;

      if (UI.els.fmIntervalSel) {
        UI.els.fmIntervalSel.value = String(FM_INTERVAL_MS);
        UI.els.fmIntervalSel.disabled = true;
      }
      if (UI.els.fmRebootSel) {
        UI.els.fmRebootSel.value = String(FM_REBOOT_SECONDS);
        UI.els.fmRebootSel.disabled = true;
      }

      this.state.fm.intervalMs = FM_INTERVAL_MS;
    },

    syncButtonsText() {
      if (UI.els.btnSpeaker) safeText(UI.els.btnSpeaker, this.state.speakerOn ? "🔊 Speaker: ON" : "🔊 Speaker: OFF");
      if (UI.els.btnMuteMic) safeText(UI.els.btnMuteMic, this.state.micMuted ? "🎙️ Mic: OFF" : "🎙️ Mic: ON");
      if (UI.els.btnMuteSpk) safeText(UI.els.btnMuteSpk, this.state.speakerMuted ? "🔇 Sound: OFF" : "🔇 Sound: ON");
    },

    /* =========================
       Part 19 — LOCAL LOAD/SAVE + AUTH
       ========================= */
    loadLocal() {
      const s = Store.getJson("state", null);
      if (!s) return;

      try {
        if (s.profile) {
          this.state.profile.displayNameLocal = s.profile.displayNameLocal || "";
          this.state.profile.email = s.profile.email || "";
          this.state.profile.photoUrl = s.profile.photoUrl || "";
          this.state.profile.displayName = s.profile.displayName || this.state.profile.displayName;
        }

        if (s.friends && Array.isArray(s.friends.list)) {
          this.state.friends.list = s.friends.list.map(normalizeFriend);
        }

        if (s.fm) {
          this.state.fm.enabled = !!s.fm.enabled;
          this.state.fm.intervalMs = FM_INTERVAL_MS;
        }

        if (s.settings) {
          const x = s.settings;
          this.state.settings.speakerDefault = !!x.speakerDefault;
          this.state.settings.micDefault = (x.micDefault !== undefined) ? !!x.micDefault : true;
          this.state.settings.soundDefault = (x.soundDefault !== undefined) ? !!x.soundDefault : true;
          this.state.settings.echoMode = String(x.echoMode || "AUTO").toUpperCase();
          this.state.settings.pingHost = String(x.pingHost || DEFAULT_PING_HOST);
          this.state.settings.updateRate = String(x.updateRate || "Normal");
          this.state.settings.lockCall = !!x.lockCall;
          this.state.settings.autoClearLogs = !!x.autoClearLogs;
        }
      } catch (_) {}
    },

    persistLocal() {
      const s = {
        profile: {
          displayNameLocal: this.state.profile.displayNameLocal || "",
          displayName: this.state.profile.displayName || "Guest",
          email: this.state.profile.email || "",
          photoUrl: this.state.profile.photoUrl || ""
        },
        friends: { list: this.state.friends.list || [] },
        fm: { enabled: !!this.state.fm.enabled, intervalMs: FM_INTERVAL_MS },
        settings: { ...this.state.settings }
      };
      Store.setJson("state", s);
    },

    getPresenceRoom() {
      const v = UI.els.inPresence ? (UI.els.inPresence.value || "").trim() : "";
      return v || "call_room1";
    },

    getChannel() {
      const v = UI.els.inChannel ? (UI.els.inChannel.value || "").trim() : "";
      return v;
    },

    getToken() {
      const v = UI.els.inToken ? (UI.els.inToken.value || "").trim() : "";
      return v;
    },

    getName() {
      const v = UI.els.inName ? (UI.els.inName.value || "").trim() : "";
      return v || this.state.profile.displayNameLocal || this.state.profile.displayName || "User";
    },

    getMyUid() {
      const u = DB.currentUser && DB.currentUser();
      if (u && u.uid) return u.uid;

      let id = Store.getRaw("pseudo_uid");
      if (!id) {
        id = "device_" + uidShort();
        Store.setRaw("pseudo_uid", id);
      }
      return id;
    },

    getBlockUntil() {
      const v = Number(Store.getRaw("block_until") || "0");
      return Number.isFinite(v) ? v : 0;
    },

    setBlockUntil(ts) {
      Store.setRaw("block_until", String(ts || 0));
    },

    async upsertMyPublicProfile() {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      const dn = this.getName();

      const payload = {
        uid,
        displayName: dn,
        displayNameLower: dn.toLowerCase(),
        email: this.state.profile.email || "",
        emailLower: (this.state.profile.email || "").toLowerCase(),
        photoUrl: this.state.profile.photoUrl || "",
        updatedAt: DB.serverTimestamp() || now()
      };

      await DB.set(`usersPublic/${uid}`, payload, true);
    },

    initFirebaseAuth() {
      if (!DB.authReady()) {
        UI.setLed(UI.els.ledFirebase, "bad");
        Log.write("warn", "Firebase SDK غير محمّل");
        return;
      }

      try { if (this.state.unsub.auth) this.state.unsub.auth(); } catch (_) {}

      this.state.unsub.auth = DB.onAuthStateChanged(async (user) => {
        AuthSync.onFirebaseUserChanged(user);

        if (user) {
          this.state.profile.uid = user.uid;
          UI.setLed(UI.els.ledFirebase, "on");

          this.watchIncomingCalls(true);
          this.startPresenceHeartbeat(true);

          this.upsertMyPublicProfile().catch(() => {});
        } else {
          UI.setLed(UI.els.ledFirebase, "warn");
          const res = await DB.signInAnonymously();
          if (!res) Log.write("warn", "Anonymous sign-in failed (check Firebase config)");
        }
      });
    },

    /* =========================
       Part 20 — CALL FLOW
       ========================= */
    async joinFlow() {
      if (this.state.call.joining) {
        Log.write("warn", "Join already running...");
        return;
      }
      this.state.call.joining = true;

      try {
        const blockUntil = this.getBlockUntil();
        if (blockUntil && now() < blockUntil) {
          const leftSec = Math.ceil((blockUntil - now()) / 1000);
          Log.write("bad", `تم حظر المكالمات مؤقتاً ⛔ (${fmtTime(leftSec)})`);
          return;
        }

        const channel = this.getChannel();
        if (!channel) {
          Log.write("warn", "اكتب Channel يدويًا أولاً");
          return;
        }

        if (!AGORA_APP_ID || !String(AGORA_APP_ID).trim()) {
          Log.write("bad", "AGORA_APP_ID غير موجود");
          UI.setLed(UI.els.ledAgora, "bad");
          return;
        }

        if (!Voice.hasSDK()) {
  UI.setLed(UI.els.ledAgora, "warn");
  Log.write("warn", "Agora SDK غير محمّل — جاري التحميل…");
  const okSdk = await Voice.ensureSDK({ timeoutMs: 12000 });
  if (!okSdk) {
    const hint = (Voice.getSDKLastError && Voice.getSDKLastError()) ? Voice.getSDKLastError() : "";
    Log.write("bad", "AgoraRTC غير محمّل (تحقق من رابط SDK / أو ضع AgoraRTC_N.js داخل assets)");
    if (hint) Log.write("warn", "SDK details: " + hint);
    UI.setLed(UI.els.ledAgora, "bad");
    return;
  }
  Log.write("good", "Agora SDK loaded ✅");
}

        if (!window.isSecureContext && !AndroidBridge.exists()) {
          Log.write("warn", "تنبيه: البيئة ليست SecureContext — قد تمنع صلاحية المايك");
        }

        const token = this.getToken();
        Log.write("warn", `Joining: ${channel}`);

        try {
          AndroidBridge.setCallMode(true);
          UI.setLed(UI.els.ledAgora, "warn");

          await Voice.join({ appId: AGORA_APP_ID, channel, token, uid: null });

          UI.setLed(UI.els.ledMicPerm, "on");
          UI.setLed(UI.els.ledAgora, "on");

          // Apply defaults
          this.state.speakerOn = !!this.state.settings.speakerDefault;
          this.state.micMuted = !this.state.settings.micDefault;
          this.state.speakerMuted = !this.state.settings.soundDefault;

          AndroidBridge.setSpeaker(this.state.speakerOn);
          Voice.setMicMuted(this.state.micMuted);
          Voice.setSpeakerMuted(this.state.speakerMuted);
          this.syncButtonsText();

          // Start mic heart monitor (RESTORED)
          const mst = Voice.getLocalMediaStreamTrack();
          if (mst && UI.els.micWave) {
            const ok = MicViz.start(UI.els.micWave, mst);
            if (ok) Log.write("good", "Mic Heart Monitor: ON ❤️");
            else Log.write("warn", "Mic Heart Monitor: element/track missing");
          } else {
            Log.write("warn", "Mic Heart Monitor: add <canvas id='micWave'> in HTML");
          }

          this.state.call.inCall = true;
          this.state.call.channel = channel;
          this.state.call.token = token;
          this.state.call.startAt = now();

          this.startCallTimer();
          this.startUsageTick();

          UI.setCallState("connected");
          Log.write("good", "✅ CONNECTED");

          CallHistory.mark("join", { channel });

          this.setPresenceState("in_call");

          if (this.state.fm.enabled) this.startForceMajeureLoop();
        } catch (e) {
          const why = errToText(e);
          Log.write("bad", "Join failed (Agora): " + why);
          Log.write("warn", "أسباب شائعة: صلاحية المايك، SDK لم يحمل، Token مطلوب.");

          const low = String(why).toLowerCase();
          UI.setLed(UI.els.ledMicPerm, (low.includes("notallowed") || low.includes("permission")) ? "bad" : "warn");
          UI.setLed(UI.els.ledAgora, "bad");
          UI.setCallState("disconnected");
          AndroidBridge.setCallMode(false);

          this.state.call.inCall = false;
          this.stopCallTimer();
          this.stopUsageTick();

          MicViz.stop();

          CallHistory.mark("join_fail", { channel, error: why });
        }
      } finally {
        this.state.call.joining = false;
      }
    },

    async leaveFlow() {
      if (this.state.call.leaving) {
        Log.write("warn", "Leave already running...");
        return;
      }
      this.state.call.leaving = true;

      try {
        this.stopForceMajeureLoop();
        Log.write("warn", "Leaving...");

        try { await Voice.leave(); } catch (_) {}
        AndroidBridge.setCallMode(false);

        this.state.call.inCall = false;
        this.state.call.channel = "";
        this.state.call.token = "";

        this.stopCallTimer();
        this.stopUsageTick();

        MicViz.stop();
        this.state.net.audioLevel = 0;

        UI.setLed(UI.els.ledAgora, "off");
        UI.setCallState("disconnected");
        Log.write("good", "تم الخروج");

        CallHistory.mark("leave", {});
        this.setPresenceState("online");
      } finally {
        this.state.call.leaving = false;
      }
    },

    endCall() {
      try { AndroidBridge.endCall(); } catch (_) {}
      return this.leaveFlow();
    },

    startCallTimer() {
      this.stopCallTimer();
      this.state.call.timerT = setInterval(() => {
        if (!this.state.call.inCall || !this.state.call.startAt) return UI.setCallTimer(0);
        const sec = Math.floor((now() - this.state.call.startAt) / 1000);
        UI.setCallTimer(sec);
      }, 1000);
    },

    stopCallTimer() {
      if (this.state.call.timerT) clearInterval(this.state.call.timerT);
      this.state.call.timerT = null;
      UI.setCallTimer(0);
    },

    startUsageTick() {
      this.stopUsageTick();
      this.state.call.usageT = setInterval(async () => {
        try {
          if (!this.state.call.inCall) return;
          const dur = now() - (this.state.call.startAt || now());
          if (dur >= CALL_LIMIT_MS) {
            Log.write("bad", "⛔ تم الوصول للحد (3 ساعات) — سيتم إغلاق المكالمة وبدء حظر 20 ساعة");
            Sound.beepPattern();
            AndroidBridge.vibrate(120);

            await this.leaveFlow();

            const until = now() + BLOCK_MS;
            this.setBlockUntil(until);
            Log.write("warn", `حظر: ${fmtTime(Math.ceil(BLOCK_MS / 1000))}`);

            CallHistory.mark("blocked", { until });
          }
        } catch (_) {}
      }, USAGE_TICK_MS);
    },

    stopUsageTick() {
      if (this.state.call.usageT) clearInterval(this.state.call.usageT);
      this.state.call.usageT = null;
    },

    onRemoteUsersChanged() {},

    toggleSpeaker() {
      this.state.speakerOn = !this.state.speakerOn;
      AndroidBridge.setSpeaker(this.state.speakerOn);
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.speakerOn ? "🔊 Speaker ON" : "🔈 Speaker OFF");
    },

    toggleMuteMic() {
      this.state.micMuted = !this.state.micMuted;
      try { Voice.setMicMuted(this.state.micMuted); } catch (_) {}
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.micMuted ? "🎙️ Mic MUTED" : "🎙️ Mic ON");
    },

    toggleMuteSpeaker() {
      this.state.speakerMuted = !this.state.speakerMuted;
      try { Voice.setSpeakerMuted(this.state.speakerMuted); } catch (_) {}
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.speakerMuted ? "🔇 Output MUTED" : "🔊 Output ON");
    },

    /* =========================
       Part 21 — FORCE MAJEURE (LOCKED)
       ========================= */
    toggleForceMajeure() {
      this.state.fm.enabled = !!(UI.els.swFM && UI.els.swFM.checked);
      this.state.fm.intervalMs = FM_INTERVAL_MS;
      this.persistLocal();

      if (this.state.fm.enabled) {
        Log.write("warn", "FM: ON (كل دقيقتين)");
        Sound.tactical();
        if (this.state.call.inCall) this.startForceMajeureLoop();
      } else {
        Log.write("good", "FM: OFF");
        this.stopForceMajeureLoop();
      }
    },

    startForceMajeureLoop() {
      const fm = this.state.fm;
      fm.intervalMs = FM_INTERVAL_MS;
      if (!fm.enabled) return;
      if (fm.running) return;
      if (!this.state.call.inCall) return;

      fm.running = true;
      fm.abort = false;

      const loop = async () => {
        if (!fm.enabled || fm.abort) return;

        await sleepWithAbort(fm.intervalMs, () => (!fm.enabled || fm.abort || !this.state.call.inCall));
        if (!fm.enabled || fm.abort) return;
        if (!this.state.call.inCall) { fm.running = false; return; }

        Sound.beepPattern();
        AndroidBridge.vibrate(60);
        Log.write("warn", "FM: Alarm!");

        const ch = this.getChannel() || this.state.call.channel;
        const token = this.getToken() || this.state.call.token;

        try { await Voice.leave(); } catch (_) {}
        AndroidBridge.setCallMode(false);

        this.state.call.inCall = false;
        this.stopCallTimer();
        this.stopUsageTick();

        UI.setCallState("disconnected");
        UI.setLed(UI.els.ledAgora, "warn");

        let count = FM_REBOOT_SECONDS;
        UI.showReboot(true, count);
        Sound.teesh();

        while (count > 0 && fm.enabled && !fm.abort) {
          UI.showReboot(true, count);
          await sleep(1000);
          count--;
        }

        UI.showReboot(false, 0);
        if (!fm.enabled || fm.abort) { fm.running = false; return; }

        Sound.tentilik();
        Log.write("warn", "FM: Reconnect...");

        try {
          AndroidBridge.setCallMode(true);
          await Voice.join({ appId: AGORA_APP_ID, channel: ch, token, uid: null });

          Voice.setMicMuted(this.state.micMuted);
          Voice.setSpeakerMuted(this.state.speakerMuted);

          // restart visualizer after reconnect
          const mst = Voice.getLocalMediaStreamTrack();
          if (mst && UI.els.micWave) MicViz.start(UI.els.micWave, mst);

          this.state.call.inCall = true;
          this.state.call.startAt = now();

          this.startCallTimer();
          this.startUsageTick();

          UI.setCallState("connected");
          UI.setLed(UI.els.ledAgora, "on");
          UI.setLed(UI.els.ledMicPerm, "on");

          Log.write("good", "FM: ✅ Reconnected");
          CallHistory.mark("fm_reconnect", { channel: ch });
        } catch (e) {
          Log.write("bad", "FM: Rejoin failed: " + errToText(e));
          UI.setLed(UI.els.ledAgora, "bad");
          AndroidBridge.setCallMode(false);
          fm.running = false;
          CallHistory.mark("fm_fail", { error: errToText(e) });
          return;
        }

        if (fm.enabled && !fm.abort) fm.loopT = setTimeout(loop, 50);
        else fm.running = false;
      };

      fm.loopT = setTimeout(loop, 50);
    },

    stopForceMajeureLoop() {
      const fm = this.state.fm;
      fm.abort = true;
      fm.running = false;
      if (fm.loopT) clearTimeout(fm.loopT);
      fm.loopT = null;
      UI.showReboot(false, 0);
    },

    onAgoraNetworkQuality(stats) {
      if (!stats) return;

      const up = Number(stats.uplinkNetworkQuality || 0);
      const down = Number(stats.downlinkNetworkQuality || 0);
      const q = Math.max(up, down);

      let level = "warn";
      if (q === 0) level = "warn";
      else if (q <= 2) level = "on";
      else if (q === 3) level = "warn";
      else level = "bad";

      UI.setLed(UI.els.ledCallQ, level);

      this.state.net.jitterMs = (level === "on") ? 10 : (level === "warn") ? 25 : 70;
      this.state.net.lossPct = (level === "on") ? 0.8 : (level === "warn") ? 3.5 : 12;
      this.updateQualityPanels();
    },

    /* =========================
       Part 22 — PRESENCE + INCOMING CALLS
       ========================= */
    async startPresenceHeartbeat(force = false) {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      if (!uid) return;

      if (this.state.__presenceT && !force) return;
      if (this.state.__presenceT) clearInterval(this.state.__presenceT);

      const roomId = this.getPresenceRoom();
      const path = `presenceRooms/${roomId}/users/${uid}`;

      const writePresence = async () => {
        const payload = {
          uid,
          displayName: this.getName(),
          email: this.state.profile.email || "",
          photoUrl: this.state.profile.photoUrl || "",
          state: this.state.call.inCall ? "in_call" : "online",
          lastSeen: DB.serverTimestamp() || now()
        };
        try { await DB.set(path, payload, true); } catch (_) {}
      };

      await writePresence();
      this.state.__presenceT = setInterval(writePresence, 15000);
    },

    setPresenceState(state) {
      if (!DB.ready()) return;
      const uid = this.getMyUid();
      const roomId = this.getPresenceRoom();
      const path = `presenceRooms/${roomId}/users/${uid}`;
      DB.set(path, { state: state || "online", lastSeen: DB.serverTimestamp() || now() }, true).catch(() => {});
    },

    watchIncomingCalls(force = false) {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      const roomId = this.getPresenceRoom();
      const callsCol = DB.col(`presenceRooms/${roomId}/calls`);
      if (!callsCol) return;

      if (this.state.unsub.incomingCalls && !force) return;
      if (this.state.unsub.incomingCalls) {
        try { this.state.unsub.incomingCalls(); } catch (_) {}
        this.state.unsub.incomingCalls = null;
      }

      let q;
      try {
        q = callsCol
          .where("status", "==", "ringing")
          .where("toUids", "array-contains", uid)
          .limit(1);
      } catch (_) {
        UI.setLed(UI.els.ledListener, "bad");
        return;
      }

      UI.setLed(UI.els.ledListener, "on");

      this.state.unsub.incomingCalls = DB.onSnapshot(q, (snap) => {
        if (!snap || snap.empty) return;

        const doc = snap.docs[0];
        const data = doc.data() || {};
        const path = doc.ref && doc.ref.path ? doc.ref.path : null;

        if (this.state.incoming.active && this.state.incoming.docPath === path) return;

        this.state.incoming.active = true;
        this.state.incoming.docPath = path;
        this.state.incoming.fromName = data.fromName || "Unknown";
        this.state.incoming.fromEmail = data.fromEmail || "";
        this.state.incoming.channel = data.channel || "";
        this.state.incoming.createdAt = (data.createdAt && data.createdAt.toMillis) ? data.createdAt.toMillis() : now();

        safeText(UI.els.modalFromName, `${this.state.incoming.fromName}`);
        UI.showModal(true);

        Sound.beepPattern();
        AndroidBridge.vibrate(120);
        AndroidBridge.showNotification("📞 Incoming Call", `${this.state.incoming.fromName} is calling you`);

        Log.write("warn", `Incoming: ${this.state.incoming.fromName}`);
        CallHistory.mark("incoming", { from: this.state.incoming.fromName, channel: this.state.incoming.channel });

        this.autoExpireIncomingIfNeeded();
      }, () => {
        UI.setLed(UI.els.ledListener, "bad");
      });
    },

    async autoExpireIncomingIfNeeded() {
      const ttl = 45 * 1000;
      const started = this.state.incoming.createdAt || now();

      await sleepWithAbort(2500, () => !this.state.incoming.active);
      if (!this.state.incoming.active) return;

      const age = now() - started;
      if (age < ttl) return;

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "missed",
            missedAt: DB.serverTimestamp() || now(),
            missedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      UI.showModal(false);
      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      Log.write("warn", "Missed call (expired)");
      CallHistory.mark("missed", {});
    },

    async acceptIncomingCall() {
      if (!this.state.incoming.active) return;

      if (UI.els.inChannel) UI.els.inChannel.value = this.state.incoming.channel || "";
      UI.showModal(false);

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "accepted",
            acceptedAt: DB.serverTimestamp() || now(),
            acceptedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      await this.joinFlow();
    },

    async declineIncomingCall() {
      if (!this.state.incoming.active) return;
      UI.showModal(false);

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "declined",
            declinedAt: DB.serverTimestamp() || now(),
            declinedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      Log.write("info", "تم الرفض");
      CallHistory.mark("decline", {});
    },

    /* =========================
       Part 23 — FRIENDS + INVITES + BROADCAST
       ========================= */
    renderFriends() {
      UI.renderFriends(
        this.state.friends.list,
        this.state.friends.selected,
        (key) => {
          if (this.state.friends.selected.has(key)) this.state.friends.selected.delete(key);
          else this.state.friends.selected.add(key);
          this.renderFriends();
        },
        (key) => {
          this.state.friends.selected.clear();
          this.state.friends.selected.add(key);
          this.sendCallInviteToSelected();
        }
      );
    },

    clearFriendSelection() {
      this.state.friends.selected.clear();
      this.renderFriends();
      Log.write("info", "تم إلغاء التحديد");
    },

    upsertFriend(friend) {
      const f = normalizeFriend(friend);
      const list = this.state.friends.list || [];

      const idx = list.findIndex((x) =>
        (x.uid && f.uid && x.uid === f.uid) ||
        (!f.uid && x.email && f.email && x.email.toLowerCase() === f.email.toLowerCase())
      );

      if (idx >= 0) list[idx] = { ...list[idx], ...f };
      else list.push(f);

      this.state.friends.list = list;
      this.persistLocal();
      this.renderFriends();
    },

    addFriendLocalFromInputs() {
      const name = UI.els.friendName ? (UI.els.friendName.value || "").trim() : "";
      const email = UI.els.friendEmail ? (UI.els.friendEmail.value || "").trim() : "";
      if (!name && !email) return Log.write("warn", "اكتب اسم/إيميل ثم إضافة");

      this.upsertFriend({
        uid: "",
        displayName: name || (email ? email.split("@")[0] : "Friend"),
        email: email || "",
        photoUrl: ""
      });

      Log.write("good", "تمت الإضافة محلياً");
    },

    exportFriends() {
      const pack = { v: 1, t: now(), friends: this.state.friends.list || [] };
      const text = JSON.stringify(pack);
      try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (_) {}
      AndroidBridge.copyToClipboard(text);
      Log.write("good", "تم نسخ الأصدقاء (JSON) للحافظة");
    },

    importFriends() {
      const raw = prompt("ألصق JSON الأصدقاء هنا:");
      if (!raw) return;
      const o = safeJsonParse(raw);
      if (!o || !Array.isArray(o.friends)) return Log.write("bad", "JSON غير صالح");
      this.state.friends.list = o.friends.map(normalizeFriend);
      this.persistLocal();
      this.renderFriends();
      Log.write("good", "تم الاستيراد ✅");
    },

    async searchFriends() {
      const name = UI.els.friendName ? (UI.els.friendName.value || "").trim() : "";
      const email = UI.els.friendEmail ? (UI.els.friendEmail.value || "").trim() : "";

      if (!name && !email) {
        Log.write("warn", "اكتب اسم أو إيميل للبحث");
        return;
      }

      if (!DB.ready()) {
        Log.write("bad", "Firebase غير جاهز / غير محمّل");
        return;
      }

      Log.write("info", "Searching...");

      let results = [];
      if (email) results = await DB.queryUsersByEmail(email);
      if (!results.length && name) results = await DB.queryUsersByNamePrefix(name);

      if (!results.length) {
        const fallback = {
          uid: "",
          displayName: name || (email ? email.split("@")[0] : "Friend"),
          email: email || "",
          photoUrl: ""
        };
        this.upsertFriend(fallback);
        Log.write("warn", "لم يتم العثور — تم إضافة كصديق محلي (بدون UID)");
        return;
      }

      results.forEach((u) => {
        this.upsertFriend({
          uid: u.uid || u.id || "",
          displayName: u.displayName || u.name || "Friend",
          email: u.email || "",
          photoUrl: u.photoUrl || u.photoURL || ""
        });
      });

      Log.write("good", `Found: ${results.length}`);
    },

    async sendCallInviteToSelected() {
      const channel = this.getChannel();
      if (!channel) {
        Log.write("warn", "اكتب Channel يدويًا أولاً");
        return;
      }

      const selKeys = Array.from(this.state.friends.selected);
      if (!selKeys.length) {
        Log.write("warn", "حدد أصدقاء أولاً");
        return;
      }

      if (!DB.ready()) {
        Log.write("bad", "Firebase غير جاهز / غير محمّل");
        return;
      }

      const targets = [];
      (this.state.friends.list || []).forEach((f) => {
        const key = f.uid || f.email || f.id;
        if (selKeys.includes(key) && f.uid) targets.push(f.uid);
      });

      if (!targets.length) {
        Log.write("warn", "لا يوجد UID للأصدقاء المحددين (لا يمكن إرسال نداء)");
        return;
      }

      const roomId = this.getPresenceRoom();
      const payload = {
        status: "ringing",
        channel,
        roomId,
        fromUid: this.getMyUid(),
        fromName: this.getName(),
        fromEmail: this.state.profile.email || "",
        toUids: targets.slice(0, 50),
        createdAt: DB.serverTimestamp() || now()
      };

      try {
        await DB.add(`presenceRooms/${roomId}/calls`, payload);
        Log.write("good", `📞 Call invite sent (${payload.toUids.length})`);
        CallHistory.mark("invite_sent", { targets: payload.toUids.length, channel });
      } catch (e) {
        Log.write("bad", "فشل إرسال النداء: " + errToText(e));
      }
    },

    async sendBroadcastInvite() {
      const channel = this.getChannel();
      if (!channel) return Log.write("warn", "اكتب Channel أولاً");

      if (!DB.ready()) return Log.write("bad", "Firebase غير جاهز / غير محمّل");

      const roomId = this.getPresenceRoom();
      const myUid = this.getMyUid();

      const usersCol = DB.col(`presenceRooms/${roomId}/users`);
      if (!usersCol) return Log.write("bad", "Presence room users غير متاح");

      Log.write("info", "Broadcasting call...");

      let uids = [];
      try {
        let snap = null;
        try {
          snap = await usersCol.where("state", "in", ["online", "in_call"]).limit(50).get();
        } catch (_) {
          snap = await usersCol.limit(50).get();
        }
        snap.forEach((d) => {
          const data = d.data() || {};
          const uid = String(data.uid || d.id || "").trim();
          if (uid && uid !== myUid) uids.push(uid);
        });
      } catch (e) {
        return Log.write("bad", "Broadcast users read fail: " + errToText(e));
      }

      const seen = {};
      uids = uids.filter((x) => (seen[x] ? false : (seen[x] = true)));

      if (!uids.length) return Log.write("warn", "لا يوجد مستخدمين Online لإرسال النداء");

      const payload = {
        status: "ringing",
        channel,
        roomId,
        fromUid: myUid,
        fromName: this.getName(),
        fromEmail: this.state.profile.email || "",
        toUids: uids.slice(0, 50),
        createdAt: DB.serverTimestamp() || now()
      };

      try {
        await DB.add(`presenceRooms/${roomId}/calls`, payload);
        Log.write("good", `📣 Broadcast sent (${payload.toUids.length})`);
        CallHistory.mark("broadcast", { to: payload.toUids.length, channel });
        Sound.tactical();
        AndroidBridge.vibrate(60);
      } catch (e) {
        Log.write("bad", "Broadcast failed: " + errToText(e));
      }
    },

    /* =========================
       Part 24 — NETWORK + PING + AUDIO + SETTINGS + DIAGNOSTICS
       ========================= */
    setDefaults({ speaker, mic, sound }) {
      if (speaker !== undefined) this.state.settings.speakerDefault = !!speaker;
      if (mic !== undefined) this.state.settings.micDefault = !!mic;
      if (sound !== undefined) this.state.settings.soundDefault = !!sound;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("good", "تم حفظ الإعدادات ✅");
    },

    setEchoMode(mode) {
      this.state.settings.echoMode = String(mode || "AUTO").toUpperCase();
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Echo: " + this.state.settings.echoMode);
    },

    setPingHost(host) {
      const h = String(host || "").trim() || DEFAULT_PING_HOST;
      this.state.settings.pingHost = h;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Ping Host: " + h);
    },

    setUpdateRate(rate) {
      const r = String(rate || "Normal");
      this.state.settings.updateRate = (r === "Low" || r === "High") ? r : "Normal";
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Update Rate: " + this.state.settings.updateRate);
      this.startNetworkMonitor(true);
      this.startPingMonitor(true);
    },

    setLockCall(on) {
      this.state.settings.lockCall = !!on;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      UI.setCallState(this.state.call.inCall ? "connected" : "disconnected");
      Log.write("info", "Lock Call: " + (this.state.settings.lockCall ? "ON" : "OFF"));
    },

    setAutoClearLogs(on) {
      this.state.settings.autoClearLogs = !!on;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Auto Clear Logs: " + (this.state.settings.autoClearLogs ? "ON" : "OFF"));
    },

    updateQualityPanels() {
      const n = this.state.net;

      const netScore = n.hasInternet ? (n.type === "wifi" && typeof n.rssi === "number"
        ? (n.rssi >= -55 ? 95 : n.rssi >= -67 ? 85 : n.rssi >= -78 ? 65 : 35)
        : 80) : 0;

      const ping = n.pingMs;
      const pingScore = (ping < 0) ? 0 : (ping <= 80 ? 95 : ping <= 150 ? 80 : ping <= 250 ? 60 : ping <= 400 ? 40 : 15);

      const jit = Number(n.jitterMs || 0);
      const jitterScore = (jit <= 15 ? 90 : jit <= 30 ? 75 : jit <= 60 ? 50 : 20);

      const loss = Number(n.lossPct || 0);
      const lossScore = (loss <= 1 ? 90 : loss <= 3 ? 75 : loss <= 8 ? 50 : 20);

      const up = Number(n.upKbps || 0);
      const down = Number(n.downKbps || 0);
      const upScore = Math.max(10, Math.min(100, (up / 120) * 100));
      const downScore = Math.max(10, Math.min(100, (down / 200) * 100));

      const audio = Number(n.audioLevel || 0);          // 0..1
      const audioScore = Math.max(10, Math.min(100, audio * 100));

      let grade = "OK";
      if (pingScore >= 85 && jitterScore >= 75 && lossScore >= 75) grade = "Excellent";
      else if (pingScore >= 70 && jitterScore >= 60 && lossScore >= 60) grade = "Good";
      else if (pingScore >= 45 && jitterScore >= 45 && lossScore >= 45) grade = "OK";
      else grade = "Poor";

      const gradeScore = (grade === "Excellent") ? 92 : (grade === "Good") ? 76 : (grade === "OK") ? 55 : 28;

      UI.setQualityUI({
        netText: `${n.type || "none"} ${n.rssi != null ? (String(n.rssi) + " dBm") : ""}`.trim(),
        pingMs: (ping >= 0 ? ping : "..."),
        jitterMs: jit,
        lossPct: loss,
        upKbps: up,
        downKbps: down,
        audioLevel: (audio ? audio.toFixed(2) : "0.00"),
        grade,
        netScore,
        pingScore,
        jitterScore,
        lossScore,
        upScore,
        downScore,
        audioScore,
        gradeScore
      });

      // Diagnostics page
      safeText(UI.els.diagNetType, String(n.type || "none"));
      safeText(UI.els.diagRssi, n.rssi == null ? "..." : String(n.rssi));
      safeText(UI.els.diagLink, n.linkMbps == null ? "..." : String(n.linkMbps));
      safeText(UI.els.diagInternet, String(!!n.hasInternet));
      safeText(UI.els.diagPing, ping < 0 ? "..." : String(ping));
      safeText(UI.els.diagPingGrade, grade);
      safeText(UI.els.diagJitter, String(jit));
      safeText(UI.els.diagLoss, String(loss));
      safeText(UI.els.diagUp, String(up));
      safeText(UI.els.diagDown, String(down));
      safeText(UI.els.diagCodec, "Opus");
      safeText(UI.els.diagCallLedTxt, (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("on")) ? "ON" :
        (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("warn")) ? "WARN" :
        (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("bad")) ? "BAD" : "OFF");

      safeText(UI.els.diagSrvLedTxt,
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("on")) ? "ON" :
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("warn")) ? "WARN" :
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("bad")) ? "BAD" : "OFF"
      );

      safeText(UI.els.diagSrvBarsTxt, (n.pingMs < 0) ? "0-4" : (n.pingMs < 100 ? "4" : n.pingMs < 200 ? "3" : n.pingMs < 400 ? "2" : "1"));
    },

    startNetworkMonitor(force = false) {
      const rate = this.state.settings.updateRate;
      const interval = (rate === "Low") ? 5000 : (rate === "High") ? 1000 : 2000;

      if (this.state.__netT && !force) return;
      if (this.state.__netT) clearInterval(this.state.__netT);

      const tick = () => {
        let info = null;
        const raw = AndroidBridge.getNetworkInfoJson();
        if (raw) info = safeJsonParse(raw);

        if (info) {
          this.state.net.type = String(info.type || info.netType || "other").toLowerCase();
          this.state.net.rssi = (info.rssi != null) ? Number(info.rssi) : null;
          this.state.net.linkMbps = (info.linkMbps != null) ? Number(info.linkMbps) : null;
          this.state.net.hasInternet = !!(info.hasInternet != null ? info.hasInternet : info.internet);

          UI.setSignalUI({ type: this.state.net.type, rssi: this.state.net.rssi, hasInternet: this.state.net.hasInternet });
          UI.setLed(UI.els.ledNet, this.state.net.hasInternet ? "on" : "bad");
          this.updateQualityPanels();
          return;
        }

        const online = (navigator.onLine !== undefined) ? !!navigator.onLine : true;
        this.state.net.hasInternet = online;

        const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        let type = "other";
        let down = null;

        if (c) {
          type = c.type || c.effectiveType || "other";
          down = (c.downlink != null) ? Math.round(Number(c.downlink) * 1000) : null; // Mbps -> kbps
        }
        this.state.net.type = String(type).toLowerCase();
        this.state.net.downKbps = down != null ? down : this.state.net.downKbps;

        UI.setSignalUI({ type: this.state.net.type, rssi: this.state.net.rssi, hasInternet: this.state.net.hasInternet });
        this.updateQualityPanels();
      };

      tick();
      this.state.__netT = setInterval(tick, interval);
    },

    async doFetchPing(host) {
      const h = String(host || DEFAULT_PING_HOST).trim();
      if (!h) return -1;

      const n = AndroidBridge.tcpPingMs(h, 443, 1500);
      if (typeof n === "number" && n >= 0) return n;

      try {
        const url = "https://" + h + "/favicon.ico?x=" + now();
        const t0 = now();

        const controller = ("AbortController" in window) ? new AbortController() : null;
        const timer = setTimeout(() => { try { controller && controller.abort(); } catch (_) {} }, 1800);

        await fetch(url, { method: "HEAD", cache: "no-store", mode: "no-cors", signal: controller ? controller.signal : undefined });
        clearTimeout(timer);

        const dt = now() - t0;
        return dt > 0 ? dt : 1;
      } catch (_) {
        return -1;
      }
    },

    startPingMonitor(force = false) {
      const rate = this.state.settings.updateRate;
      const interval = (rate === "Low") ? 7000 : (rate === "High") ? 2000 : 3500;

      if (this.state.__pingT && !force) return;
      if (this.state.__pingT) clearInterval(this.state.__pingT);

      const tick = async () => {
        const ms = await this.doFetchPing(this.state.settings.pingHost || DEFAULT_PING_HOST);
        this.state.net.pingMs = ms;

        UI.setPing(ms);
        this.updateQualityPanels();

        if (UI.els.diagNoteTxt) safeText(UI.els.diagNoteTxt, ms < 0 ? "Ping: FAIL" : ("Ping: " + ms + "ms"));

        if (this.state.settings.autoClearLogs && UI.els.log) {
          try {
            const lines = UI.els.log.querySelectorAll(".logLine");
            if (lines.length > 200) {
              for (let i = 200; i < lines.length; i++) lines[i].remove();
            }
          } catch (_) {}
        }
      };

      tick();
      this.state.__pingT = setInterval(tick, interval);
    },

    // NEW: updates audioLevel from MicViz (for quality panel)
    startAudioMeter(force = false) {
      if (this.state.__audioT && !force) return;
      if (this.state.__audioT) clearInterval(this.state.__audioT);

      this.state.__audioT = setInterval(() => {
        const lvl = MicViz.level(); // 0..1
        // if mic muted, show lower (still allow heart animation if audio track gives low)
        this.state.net.audioLevel = this.state.micMuted ? 0 : lvl;
      }, 120);
    },

    refreshDiagnostics() {
      this.updateQualityPanels();
      return this.getDiagnosticsPack();
    },

    getDiagnosticsPack() {
      const n = this.state.net;
      return {
        netType: n.type,
        rssi: n.rssi,
        linkMbps: n.linkMbps,
        internet: n.hasInternet,
        ping: n.pingMs,
        jitter: n.jitterMs,
        loss: n.lossPct,
        up: n.upKbps,
        down: n.downKbps,
        audio: n.audioLevel,
        codec: "Opus",
        callLed: (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("on")) ? "ON" :
          (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("warn")) ? "WARN" :
          (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("bad")) ? "BAD" : "OFF"
      };
    },

    resetDiagnosticsLocal() {
      this.state.net.jitterMs = 0;
      this.state.net.lossPct = 0;
      this.state.net.upKbps = 0;
      this.state.net.downKbps = 0;
      this.state.net.audioLevel = 0;
      this.updateQualityPanels();
    },
  };

  /* =========================
     Part 25 — EXPORT API for inline HTML hooks
     ========================= */
  window.MDV_APP = {
    join: () => App.joinFlow(),
    leave: () => App.leaveFlow(),
    endCall: () => App.endCall(),

    acceptIncoming: () => App.acceptIncomingCall(),
    rejectIncoming: () => App.declineIncomingCall(),

    refreshDiagnostics: () => App.refreshDiagnostics(),
    resetDiagnostics: () => App.resetDiagnosticsLocal(),
    shareDiagnostics: () => {
      const text = JSON.stringify(App.getDiagnosticsPack());
      try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (_) {}
      AndroidBridge.copyToClipboard(text);
      Log.write("good", "DIAG COPIED");
      return text;
    },

    // Android-side functions
    volumeUp: () => AndroidBridge.volumeUp(),
    volumeDown: () => AndroidBridge.volumeDown(),
    volumeMuteToggle: () => AndroidBridge.volumeMuteToggle(),
    routeSpeaker: () => AndroidBridge.routeSpeaker(),
    routeEarpiece: () => AndroidBridge.routeEarpiece(),
    routeBluetooth: () => AndroidBridge.routeBluetooth(),

    detectAudio: () => AndroidBridge.detectAudio(),
    detectBluetooth: () => AndroidBridge.detectBluetooth(),
    refreshDevices: () => AndroidBridge.refreshDevices(),

    // UI helpers
    toggleDrawer: () => Drawer.toggle(),
    themeCycle: () => Theme.cycle(),
  };

  /* =========================
     Part 26 — BOOT
     ========================= */
  const boot = () => {
    try { App.init(); } catch (e) { try { console.error(e); } catch (_) {} }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();

/* =========================================================
   ملاحظة مهمة لإرجاع "مخطط القلب" (Mic Heart Monitor):
   - لازم يكون عندك في index.html عنصر:
       <canvas id="micWave" style="width:100%;height:56px;"></canvas>
   - JS فوق يدعم IDs بديلة، لكن الأفضل micWave.
   ========================================================= */
/* =========================================================
   MiniDiscordVoice - app.js (FULL INTEGRATED) [REWRITE v4 FINAL]
   - ✅ Matches latest CSS: Drawer side + overlay + theme vars + no horizontal drag
   - ✅ Adds Theme controller (system/dark/light) via data-theme
   - ✅ Restores Mic "Heart Monitor" waveform (ECG-style) using Audio Analyser
   - ✅ Keeps ALL previous features:
      - Google profile sync + prevent anonymous wipe
      - Avatar fallback
      - LED binding
      - WebView safe (NO replaceAll)
      - Better Agora errors
      - Force Majeure fixed at 2 minutes (LOCKED)
      - Fix buttons not working (hard re-bind)
      - AndroidBridge + window.MDV_APP API
   ========================================================= */

(() => {
  "use strict";

  /* =========================
     Part 1 — BOOTSTRAP + CONFIG
     ========================= */
  if (window.__MDV_APP_LOADED__) {
    try { console.warn("MDV app.js already loaded"); } catch (_) {}
    return;
  }
  window.__MDV_APP_LOADED__ = true;

  const APP_VERSION = "MDV_APP_JS_v4_final_2026-01-14";

  const AGORA_APP_ID = "eb80a41c4a3c400f865a5c88bdf293be";

  const FIREBASE_CONFIGS = [
    {
      apiKey: "AIzaSyApUvLTt0OLAc_3Rk2e1BnmvX64T5RTmA8",
      authDomain: "minidiscordvoice-b7310.firebaseapp.com",
      databaseURL: "https://minidiscordvoice-b7310-default-rtdb.firebaseio.com",
      projectId: "minidiscordvoice-b7310",
      storageBucket: "minidiscordvoice-b7310.firebasestorage.app",
      messagingSenderId: "1073341648468",
      appId: "1:1073341648468:web:9af59b1fcc577d4468e7c1",
      measurementId: "G-7R4MRJHWY6",
    },
    {
      apiKey: "AIzaSyDdqU4OTdQv1vGXRtJwPVkuA4AdwIzCAuE",
      authDomain: "minidiscordvoice-b7310.firebaseapp.com",
      databaseURL: "https://minidiscordvoice-b7310-default-rtdb.firebaseio.com",
      projectId: "minidiscordvoice-b7310",
      storageBucket: "minidiscordvoice-b7310.firebasestorage.app",
      messagingSenderId: "1073341648468",
      appId: "1:1073341648468:web:9af59b1fcc577d4468e7c1",
      measurementId: "G-7R4MRJHWY6",
    },
  ];

  // Limits
  const CALL_LIMIT_MS = 3 * 60 * 60 * 1000; // 3 hours
  const BLOCK_MS = 20 * 60 * 60 * 1000;     // 20 hours
  const USAGE_TICK_MS = 15 * 1000;          // 15s

  // Force Majeure (LOCKED)
  const FM_INTERVAL_MS = 2 * 60 * 1000;     // 2 minutes (LOCKED)
  const FM_REBOOT_SECONDS = 6;              // 6 seconds (LOCKED)

  const DEFAULT_PING_HOST = "minidiscordvoice.web.app";

  window.AGORA_APP_ID = AGORA_APP_ID;
  window.__MDV_FIREBASE_CONFIGS__ = FIREBASE_CONFIGS;
  window.__MDV_VERSION__ = APP_VERSION;

  /* =========================
     Part 2 — SMALL UTILS
     ========================= */
  const now = () => Date.now();

  const $ = (sel, root = document) => { try { return root.querySelector(sel); } catch (_) { return null; } };
  const $$ = (sel, root = document) => { try { return Array.from(root.querySelectorAll(sel)); } catch (_) { return []; } };
  const byId = (id) => { try { return document.getElementById(id); } catch (_) { return null; } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function pad2(n) {
    n = Math.floor(Math.max(0, n));
    return n < 10 ? "0" + n : "" + n;
  }
  function fmtTime(seconds) {
    seconds = Math.floor(Math.max(0, seconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    return `${pad2(m)}:${pad2(s)}`;
  }
  function escapeHTML(s) {
    const str = String(s == null ? "" : s);
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function safeText(el, txt) {
    if (!el) return;
    el.textContent = (txt == null) ? "" : String(txt);
  }
  function safeHTML(el, html) {
    if (!el) return;
    el.innerHTML = html || "";
  }
  function safeJsonParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  function errToText(e) {
    try {
      if (!e) return "Unknown error";
      const name = e.name ? String(e.name) : "";
      const msg = e.message ? String(e.message) : String(e);
      return (name ? `${name}: ` : "") + msg;
    } catch (_) { return "Unknown error"; }
  }
  function debounce(fn, ms = 250) {
    let t = null;
    return (...args) => {
      try { clearTimeout(t); } catch (_) {}
      t = setTimeout(() => { try { fn(...args); } catch (_) {} }, ms);
    };
  }
  function uidShort() {
    return Math.random().toString(16).slice(2, 10) + "-" + Math.random().toString(16).slice(2, 6);
  }
  function safeNameFromEmail(email) {
    if (!email) return "User";
    const s = String(email).split("@")[0] || "User";
    return s.length > 18 ? s.slice(0, 18) : s;
  }
  function normalizePhotoUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.includes("googleusercontent.com") && !u.includes("sz=")) {
      return u + (u.includes("?") ? "&" : "?") + "sz=128";
    }
    return u;
  }
  async function sleepWithAbort(ms, shouldAbort) {
    const step = 250;
    let left = ms;
    while (left > 0) {
      if (shouldAbort && shouldAbort()) return;
      const s = Math.min(step, left);
      await sleep(s);
      left -= s;
    }
  }

  /* =========================
     Part 3 — STORAGE (namespaced)
     ========================= */
  const Store = (() => {
    const PREFIX = "mdv_v4_";
    function k(key) { return PREFIX + String(key || ""); }
    function getRaw(key) { try { return localStorage.getItem(k(key)); } catch (_) { return null; } }
    function setRaw(key, val) { try { localStorage.setItem(k(key), String(val == null ? "" : val)); } catch (_) {} }
    function del(key) { try { localStorage.removeItem(k(key)); } catch (_) {} }
    function getJson(key, fallback) {
      const raw = getRaw(key);
      if (!raw) return fallback;
      const obj = safeJsonParse(raw);
      return obj == null ? fallback : obj;
    }
    function setJson(key, obj) { try { setRaw(key, JSON.stringify(obj)); } catch (_) {} }
    return { getRaw, setRaw, del, getJson, setJson };
  })();

  /* =========================
     Part 4 — LOGGER
     ========================= */
  const Log = (() => {
    const MAX_LINES = 260;

    function stamp() {
      const t = new Date();
      return `${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}`;
    }
    function toConsole(type, msg) {
      try {
        if (type === "bad") console.error("[MDV]", msg);
        else if (type === "warn") console.warn("[MDV]", msg);
        else console.log("[MDV]", msg);
      } catch (_) {}
    }
    function toUI(type, msg) {
      let box = null;
      try { box = (UI && UI.els) ? UI.els.log : null; } catch (_) { box = null; }
      if (!box) return;

      const div = document.createElement("div");
      div.className = "logLine";

      if (type === "warn") div.style.color = "var(--warn)";
      if (type === "bad") div.style.color = "var(--danger)";
      if (type === "good") div.style.color = "var(--success)";

      div.innerHTML = `<span class="mono">[${stamp()}]</span> ${escapeHTML(msg)}`;
      box.prepend(div);

      try {
        const lines = box.querySelectorAll(".logLine");
        if (lines.length > MAX_LINES) {
          for (let i = MAX_LINES; i < lines.length; i++) lines[i].remove();
        }
      } catch (_) {}
    }
    function write(type, msg) {
      const m = String(msg == null ? "" : msg);
      toConsole(type, m);
      toUI(type, m);
    }
    return { write };
  })();

  /* =========================
     Part 5 — ANDROID BRIDGE (SAFE)
     ========================= */
  const AndroidBridge = {
    exists() { return !!(window.Android || window.AndroidInterface); },
    _obj() { return window.AndroidInterface || window.Android || null; },
    call(fn, ...args) {
      try {
        const o = this._obj();
        if (!o) return undefined;
        const f = o[fn];
        if (typeof f !== "function") return undefined;
        return f.apply(o, args);
      } catch (_) { return undefined; }
    },

    startGoogleSignIn() { return this.call("startGoogleSignIn"); },
    signOut() { return this.call("signOut"); },

    setCallMode(active) { return this.call("setCallMode", !!active); },
    setSpeaker(on) { return this.call("setSpeaker", !!on); },

    vibrate(ms = 30) { return this.call("vibrate", parseInt(ms, 10) || 30); },

    showAd() { return this.call("showAd"); },
    showVideoAd() { return this.call("showVideoAd"); },

    showNotification(t, b) {
      return this.call("showNotification", String(t || ""), String(b || ""));
    },

    copyToClipboard(t) { return this.call("copyToClipboard", String(t || "")); },

    getNetworkInfoJson() {
      try { return String(this.call("getNetworkInfoJson") || ""); } catch (_) { return ""; }
    },

    tcpPingMs(host, port, timeoutMs) {
      try {
        const v = this.call(
          "tcpPingMs",
          String(host || ""),
          parseInt(port, 10) || 443,
          parseInt(timeoutMs, 10) || 1500
        );
        const n = Number(v);
        return Number.isFinite(n) ? n : -1;
      } catch (_) { return -1; }
    },

    endCall() { return this.call("endCall"); },
    acceptIncoming() { return this.call("acceptIncoming"); },
    rejectIncoming() { return this.call("rejectIncoming"); },

    volumeUp() { return this.call("volumeUp"); },
    volumeDown() { return this.call("volumeDown"); },
    volumeMuteToggle() { return this.call("volumeMuteToggle"); },

    routeSpeaker() { return this.call("routeSpeaker"); },
    routeEarpiece() { return this.call("routeEarpiece"); },
    routeBluetooth() { return this.call("routeBluetooth"); },

    detectAudio() { return this.call("detectAudio"); },
    detectBluetooth() { return this.call("detectBluetooth"); },
    refreshDevices() { return this.call("refreshDevices"); },

    getDiagnostics() { return this.call("getDiagnostics"); },
    resetDiagnostics() { return this.call("resetDiagnostics"); },
    shareDiagnostics() { return this.call("shareDiagnostics"); },
  };

  /* =========================
     Part 6 — UI BINDING
     ========================= */
  const UI = {
    els: {},
    bound: false,
    bindAttempts: 0,

    FALLBACK_AVATAR:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect width='100%25' height='100%25' fill='%23333'/%3E%3Ctext x='50%25' y='52%25' text-anchor='middle' fill='%23aaa' font-size='18' font-family='Arial'%3EUSER%3C/text%3E%3C/svg%3E",

    bind() {
      const E = this.els;

      // Profile
      E.profileName = byId("userName");
      E.profileEmail = byId("userEmail");
      E.profilePhoto = byId("userPhoto");
      E.inName = byId("displayName");

      // Inputs
      E.inPresence = byId("presenceRoom");
      E.inChannel = byId("channel");
      E.inToken = byId("token");

      // Buttons (Call)
      E.btnJoin = byId("joinBtn");
      E.btnLeave = byId("leaveBtn");
      E.btnCopy = byId("copyBtn");

      E.btnSpeaker = byId("speakerBtn");
      E.btnMuteMic = byId("muteMicBtn");
      E.btnMuteSpk = byId("muteSoundBtn");

      E.btnEndCall = byId("endCallBtn");

      E.swFM = byId("fmSwitch");
      E.fmIntervalSel = byId("fmInterval");
      E.fmRebootSel = byId("fmReboot");

      E.btnBroadcastCall = byId("callBtn");
      E.btnReward = byId("rewardBtn");

      // Optional login buttons
      E.btnGoogle1 = byId("googleLoginBtn");
      E.btnGoogle2 = byId("loginBtn");
      E.btnGoogle3 = byId("signInBtn");
      E.btnGoogle4 = byId("googleBtn");
      E.btnLogout = byId("logoutBtn");

      // Status
      E.callTimerVal = byId("callTimer");
      E.netTower = byId("netTower");
      E.srvTower = byId("srvTower");
      E.netTypeTxt = byId("netTypeTxt");
      E.pingVal = byId("pingMs");

      // LEDs (DOT itself)
      E.ledWeb = byId("ledWeb");
      E.ledFirebase = byId("ledFirebase");
      E.ledListener = byId("ledListener");
      E.ledMicPerm = byId("ledMicPerm");
      E.ledAgora = byId("ledAgora");
      E.ledInCall = byId("ledInCall");
      E.ledNet = byId("ledNet");
      E.ledSrv = byId("ledSrv");
      E.ledCallQ = byId("ledCallQ");

      // Quality fields
      E.qNetText = byId("qNetText");
      E.qPingText = byId("qPingText");
      E.qJitterText = byId("qJitterText");
      E.qLossText = byId("qLossText");
      E.qUpText = byId("qUpText");
      E.qDownText = byId("qDownText");
      E.qAudioText = byId("qAudioText");
      E.qGradeText = byId("qGradeText");

      E.qNetFill = byId("qNetFill");
      E.qPingFill = byId("qPingFill");
      E.qJitterFill = byId("qJitterFill");
      E.qLossFill = byId("qLossFill");
      E.qUpFill = byId("qUpFill");
      E.qDownFill = byId("qDownFill");
      E.qAudioFill = byId("qAudioFill");
      E.qGradeFill = byId("qGradeFill");

      // Friends
      E.friendName = byId("friendSearchName");
      E.friendEmail = byId("friendSearchEmail");
      E.friendSearchBtn = byId("friendSearchBtn");
      E.friendAddBtn = byId("friendAddBtn");
      E.friendImportBtn = byId("friendImportBtn");
      E.friendExportBtn = byId("friendExportBtn");

      E.friendList = byId("friendsList");
      E.callSelectedBtn = byId("callSelectedBtn");
      E.clearSelectedBtn = byId("clearSelectedBtn");

      // Incoming modal
      E.modalOverlay = byId("incomingOverlay");
      E.modalFromName = byId("incomingFrom");
      E.modalAccept = byId("acceptCallBtn");
      E.modalDecline = byId("rejectCallBtn");

      // Reboot overlay
      E.rebootOverlay = byId("rebootOverlay");
      E.rebootCount = byId("rebootCounter");

      // Diagnostics
      E.diagNetType = byId("diagNetType");
      E.diagRssi = byId("diagRssi");
      E.diagLink = byId("diagLink");
      E.diagInternet = byId("diagInternet");
      E.diagPing = byId("diagPing");
      E.diagPingGrade = byId("diagPingGrade");
      E.diagSrvBarsTxt = byId("diagSrvBarsTxt");
      E.diagSrvLedTxt = byId("diagSrvLedTxt");
      E.diagJitter = byId("diagJitter");
      E.diagLoss = byId("diagLoss");
      E.diagUp = byId("diagUp");
      E.diagDown = byId("diagDown");
      E.diagCodec = byId("diagCodec");
      E.diagCallLedTxt = byId("diagCallLedTxt");
      E.diagNoteTxt = byId("diagNoteTxt");

      // Settings
      E.setSpeakerDefaultTxt = byId("setSpeakerDefaultTxt");
      E.setMicDefaultTxt = byId("setMicDefaultTxt");
      E.setSoundDefaultTxt = byId("setSoundDefaultTxt");
      E.setEchoTxt = byId("setEchoTxt");

      E.setPingHost = byId("setPingHost");
      E.setUpdateRateTxt = byId("setUpdateRateTxt");

      E.setLockTxt = byId("setLockTxt");
      E.setLogsTxt = byId("setLogsTxt");

      E.btnSetSpeakerOn = byId("setSpeakerDefaultOn");
      E.btnSetSpeakerOff = byId("setSpeakerDefaultOff");
      E.btnSetMicOn = byId("setMicDefaultOn");
      E.btnSetMicOff = byId("setMicDefaultOff");
      E.btnSetSoundOn = byId("setSoundDefaultOn");
      E.btnSetSoundOff = byId("setSoundDefaultOff");

      E.btnEchoAuto = byId("setEchoAuto");
      E.btnEchoOn = byId("setEchoOn");
      E.btnEchoOff = byId("setEchoOff");

      E.btnPingDefault = byId("setPingHostDefault");
      E.btnPingCustom = byId("setPingHostCustom");

      E.btnRateLow = byId("setRateLow");
      E.btnRateNorm = byId("setRateNorm");
      E.btnRateHigh = byId("setRateHigh");

      E.btnLockOn = byId("setLockOn");
      E.btnLockOff = byId("setLockOff");

      E.btnLogsOn = byId("setLogsOn");
      E.btnLogsOff = byId("setLogsOff");

      // Log
      E.log = byId("log");

      // Drawer + Theme (NEW)
      E.drawerBtn = byId("drawerBtn") || byId("menuBtn");
      E.drawerOverlay = byId("drawerOverlay");
      E.drawer = byId("drawer") || byId("tabs");

      E.themeBtn = byId("themeBtn") || byId("themeToggleBtn");
      E.themeModeTxt = byId("themeModeTxt");

      // Mic waveform (NEW / RESTORED)
      E.micWave =
        byId("micWave") ||
        byId("micWaveCanvas") ||
        byId("micHeart") ||
        byId("micHeartCanvas") ||
        byId("heartWave");

      // Defaults
      if (E.inPresence && !E.inPresence.value) E.inPresence.value = "call_room1";
      if (E.profilePhoto && !E.profilePhoto.src) E.profilePhoto.src = this.FALLBACK_AVATAR;

      this.wireEvents();
      this.bound = true;
      this.bindAttempts++;
    },

    /* =========================
       Part 7 — UI EVENTS (hard re-bind)
       ========================= */
    wireEvents() {
      const E = this.els;

      const rewireBtn = (btn, fn) => {
        if (!btn) return;
        try {
          const parent = btn.parentNode;
          if (!parent) return;
          const clone = btn.cloneNode(true);
          parent.replaceChild(clone, btn);
          fn(clone);
        } catch (_) {
          try { fn(btn); } catch (_) {}
        }
      };

      rewireBtn(E.btnJoin, (b) => b.addEventListener("click", () => App.joinFlow()));
      rewireBtn(E.btnLeave, (b) => b.addEventListener("click", () => App.leaveFlow()));
      rewireBtn(E.btnEndCall, (b) => b.addEventListener("click", () => App.endCall()));

      rewireBtn(E.btnCopy, (b) => b.addEventListener("click", () => {
        const ch = App.getChannel();
        if (!ch) return Log.write("warn", "اكتب Channel أولاً");
        try { navigator.clipboard && navigator.clipboard.writeText(ch); } catch (_) {}
        AndroidBridge.copyToClipboard(ch);
        Log.write("good", "تم نسخ اسم القناة");
      }));

      rewireBtn(E.btnSpeaker, (b) => b.addEventListener("click", () => App.toggleSpeaker()));
      rewireBtn(E.btnMuteMic, (b) => b.addEventListener("click", () => App.toggleMuteMic()));
      rewireBtn(E.btnMuteSpk, (b) => b.addEventListener("click", () => App.toggleMuteSpeaker()));

      if (E.swFM) {
        try { E.swFM.onchange = null; } catch (_) {}
        E.swFM.addEventListener("change", () => App.toggleForceMajeure());
      }

      rewireBtn(E.btnBroadcastCall, (b) => b.addEventListener("click", () => App.sendBroadcastInvite()));
      rewireBtn(E.btnReward, (b) => b.addEventListener("click", () => {
        const r = AndroidBridge.showVideoAd();
        if (r === undefined) Log.write("info", "Video Ad (Android only)");
      }));

      rewireBtn(E.friendSearchBtn, (b) => b.addEventListener("click", () => App.searchFriends()));
      rewireBtn(E.friendAddBtn, (b) => b.addEventListener("click", () => App.addFriendLocalFromInputs()));
      rewireBtn(E.friendImportBtn, (b) => b.addEventListener("click", () => App.importFriends()));
      rewireBtn(E.friendExportBtn, (b) => b.addEventListener("click", () => App.exportFriends()));

      rewireBtn(E.callSelectedBtn, (b) => b.addEventListener("click", () => App.sendCallInviteToSelected()));
      rewireBtn(E.clearSelectedBtn, (b) => b.addEventListener("click", () => App.clearFriendSelection()));

      rewireBtn(E.modalAccept, (b) => b.addEventListener("click", () => App.acceptIncomingCall()));
      rewireBtn(E.modalDecline, (b) => b.addEventListener("click", () => App.declineIncomingCall()));

      // Google login buttons
      const googleBtns = [E.btnGoogle1, E.btnGoogle2, E.btnGoogle3, E.btnGoogle4].filter(Boolean);
      googleBtns.forEach((btn) => {
        rewireBtn(btn, (b) => b.addEventListener("click", () => {
          AndroidBridge.startGoogleSignIn();
          Log.write("info", "فتح تسجيل الدخول...");
        }));
      });

      rewireBtn(E.btnLogout, (b) => b.addEventListener("click", () => {
        AndroidBridge.signOut();
        Log.write("info", "تسجيل خروج...");
      }));

      if (E.inName) {
        try { E.inName.oninput = null; } catch (_) {}
        E.inName.addEventListener("input", debounce(() => {
          App.state.profile.displayNameLocal = (E.inName.value || "").trim();
          App.persistLocal();
        }, 250));
      }

      // Settings binds
      rewireBtn(E.btnSetSpeakerOn, (b) => b.addEventListener("click", () => App.setDefaults({ speaker: true })));
      rewireBtn(E.btnSetSpeakerOff, (b) => b.addEventListener("click", () => App.setDefaults({ speaker: false })));

      rewireBtn(E.btnSetMicOn, (b) => b.addEventListener("click", () => App.setDefaults({ mic: true })));
      rewireBtn(E.btnSetMicOff, (b) => b.addEventListener("click", () => App.setDefaults({ mic: false })));

      rewireBtn(E.btnSetSoundOn, (b) => b.addEventListener("click", () => App.setDefaults({ sound: true })));
      rewireBtn(E.btnSetSoundOff, (b) => b.addEventListener("click", () => App.setDefaults({ sound: false })));

      rewireBtn(E.btnEchoAuto, (b) => b.addEventListener("click", () => App.setEchoMode("AUTO")));
      rewireBtn(E.btnEchoOn, (b) => b.addEventListener("click", () => App.setEchoMode("ON")));
      rewireBtn(E.btnEchoOff, (b) => b.addEventListener("click", () => App.setEchoMode("OFF")));

      rewireBtn(E.btnPingDefault, (b) => b.addEventListener("click", () => App.setPingHost(DEFAULT_PING_HOST)));
      rewireBtn(E.btnPingCustom, (b) => b.addEventListener("click", () => {
        const x = prompt("اكتب Ping Host:", App.state.settings.pingHost || DEFAULT_PING_HOST);
        if (x != null) App.setPingHost(String(x || "").trim());
      }));

      rewireBtn(E.btnRateLow, (b) => b.addEventListener("click", () => App.setUpdateRate("Low")));
      rewireBtn(E.btnRateNorm, (b) => b.addEventListener("click", () => App.setUpdateRate("Normal")));
      rewireBtn(E.btnRateHigh, (b) => b.addEventListener("click", () => App.setUpdateRate("High")));

      rewireBtn(E.btnLockOn, (b) => b.addEventListener("click", () => App.setLockCall(true)));
      rewireBtn(E.btnLockOff, (b) => b.addEventListener("click", () => App.setLockCall(false)));

      rewireBtn(E.btnLogsOn, (b) => b.addEventListener("click", () => App.setAutoClearLogs(true)));
      rewireBtn(E.btnLogsOff, (b) => b.addEventListener("click", () => App.setAutoClearLogs(false)));

      // Theme button (NEW)
      rewireBtn(E.themeBtn, (b) => b.addEventListener("click", () => Theme.cycle()));

      // Drawer button (NEW)
      rewireBtn(E.drawerBtn, (b) => b.addEventListener("click", () => Drawer.toggle()));
      if (E.drawerOverlay) {
        try { E.drawerOverlay.onclick = null; } catch (_) {}
        E.drawerOverlay.addEventListener("click", () => Drawer.close());
      }

      // Unlock audio on first gesture (for beeps + analyser)
      document.addEventListener("pointerdown", () => Sound.unlock(), { once: true });
      document.addEventListener("touchstart", () => Sound.unlock(), { once: true });
      document.addEventListener("click", () => Sound.unlock(), { once: true });

      // Close drawer on back/escape
      window.addEventListener("keydown", (ev) => {
        if (ev && ev.key === "Escape") Drawer.close();
      });
    },

    /* =========================
       Part 8 — UI HELPERS
       ========================= */
    setProfile({ name, email, photoUrl, locked }) {
      const E = this.els;

      safeText(E.profileName, name || "Guest");
      safeText(E.profileEmail, email || "لم يتم تسجيل الدخول");

      const p = normalizePhotoUrl(photoUrl);
      if (E.profilePhoto) {
        E.profilePhoto.onerror = () => { E.profilePhoto.src = UI.FALLBACK_AVATAR; };
        E.profilePhoto.src = p || UI.FALLBACK_AVATAR;
      }

      if (E.inName) {
        E.inName.value = name || "";
        E.inName.readOnly = !!locked;
      }
    },

    setLed(dotEl, status) {
      if (!dotEl) return;
      let el = null;
      try {
        el = (dotEl.classList && dotEl.classList.contains("dot"))
          ? dotEl
          : (dotEl.querySelector ? dotEl.querySelector(".dot") : null);
      } catch (_) { el = dotEl; }

      if (!el || !el.classList) return;
      el.classList.remove("on", "off", "warn", "bad");
      el.classList.add(status || "off");
    },

    setCallState(mode) {
      const connected = mode === "connected";
      const E = this.els;

      if (E.btnJoin) E.btnJoin.disabled = connected;
      if (E.btnLeave) E.btnLeave.disabled = !connected;
      if (E.inChannel) E.inChannel.disabled = connected || !!App.state.settings.lockCall;

      this.setLed(E.ledInCall, connected ? "on" : "off");
    },

    setCallTimer(seconds) {
      if (this.els.callTimerVal) safeText(this.els.callTimerVal, fmtTime(seconds));
    },

    showModal(show) {
      const m = this.els.modalOverlay;
      if (!m) return;
      if (show) {
        m.classList.remove("hidden");
        m.setAttribute("aria-hidden", "false");
      } else {
        m.classList.add("hidden");
        m.setAttribute("aria-hidden", "true");
      }
    },

    showReboot(show, count) {
      const o = this.els.rebootOverlay;
      if (!o) return;
      if (show) {
        o.classList.remove("hidden");
        o.setAttribute("aria-hidden", "false");
      } else {
        o.classList.add("hidden");
        o.setAttribute("aria-hidden", "true");
      }
      if (show && this.els.rebootCount) safeText(this.els.rebootCount, String(count ?? ""));
    },

    updateTower(towerEl, activeCount, statusClass) {
      if (!towerEl) return;
      const bars = towerEl.querySelectorAll(".bar");
      bars.forEach((b, i) => {
        b.classList.remove("on", "warn", "bad");
        if (i < activeCount) b.classList.add(statusClass);
      });
    },

    setSignalUI({ type, rssi, hasInternet }) {
      if (this.els.netTypeTxt) safeText(this.els.netTypeTxt, type ? String(type).toUpperCase() : "...");

      let bars = 0;
      let status = "off";

      if (!hasInternet) {
        bars = 0;
        status = "bad";
      } else if (type === "wifi" && typeof rssi === "number") {
        if (rssi >= -55) { bars = 4; status = "on"; }
        else if (rssi >= -67) { bars = 3; status = "on"; }
        else if (rssi >= -78) { bars = 2; status = "warn"; }
        else { bars = 1; status = "bad"; }
      } else {
        bars = 3;
        status = "on";
      }

      this.updateTower(this.els.netTower, bars, status);
      this.setLed(this.els.ledNet, status === "on" ? "on" : status === "warn" ? "warn" : "bad");
    },

    setPing(ms) {
      if (this.els.pingVal) safeText(this.els.pingVal, ms >= 0 ? String(ms) : "...");

      let bars = 0;
      let status = "off";

      if (ms < 0) { bars = 0; status = "bad"; }
      else if (ms < 100) { bars = 4; status = "on"; }
      else if (ms < 200) { bars = 3; status = "on"; }
      else if (ms < 400) { bars = 2; status = "warn"; }
      else { bars = 1; status = "bad"; }

      this.updateTower(this.els.srvTower, bars, status);
      this.setLed(this.els.ledSrv, status === "on" ? "on" : status === "warn" ? "warn" : "bad");
    },

    setQualityUI(pack) {
      if (!pack) return;
      const E = this.els;

      if (E.qNetText) safeText(E.qNetText, pack.netText || "...");
      if (E.qPingText) safeText(E.qPingText, String(pack.pingMs ?? "..."));
      if (E.qJitterText) safeText(E.qJitterText, String(pack.jitterMs ?? "..."));
      if (E.qLossText) safeText(E.qLossText, String(pack.lossPct ?? "..."));
      if (E.qUpText) safeText(E.qUpText, String(pack.upKbps ?? "..."));
      if (E.qDownText) safeText(E.qDownText, String(pack.downKbps ?? "..."));
      if (E.qAudioText) safeText(E.qAudioText, String(pack.audioLevel ?? "..."));
      if (E.qGradeText) safeText(E.qGradeText, pack.grade || "...");

      const clamp = (x) => Math.max(0, Math.min(100, Number(x) || 0));
      const setFill = (el, v) => { if (el) el.style.width = clamp(v) + "%"; };

      setFill(E.qNetFill, pack.netScore);
      setFill(E.qPingFill, pack.pingScore);
      setFill(E.qJitterFill, pack.jitterScore);
      setFill(E.qLossFill, pack.lossScore);
      setFill(E.qUpFill, pack.upScore);
      setFill(E.qDownFill, pack.downScore);
      setFill(E.qAudioFill, pack.audioScore);
      setFill(E.qGradeFill, pack.gradeScore);
    },

    renderFriends(list, selectedSet, onToggle, onQuickCall) {
      const box = this.els.friendList;
      if (!box) return;

      safeHTML(box, "");

      if (!list || !list.length) {
        const empty = document.createElement("div");
        empty.className = "logLine";
        empty.textContent = "لا يوجد أصدقاء بعد. ابحث بالاسم/الإيميل ثم أضف.";
        box.appendChild(empty);
        return;
      }

      list.forEach((f) => {
        const key = f.uid || f.email || f.id || uidShort();
        const selected = selectedSet.has(key);

        const row = document.createElement("div");
        row.className = "logLine";
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.gap = "8px";

        row.innerHTML = `
          <div style="min-width:0">
            <div style="font-weight:900;color:var(--txt);font-size:11px">${escapeHTML(f.displayName || "Friend")}</div>
            <div style="color:var(--muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px">${escapeHTML(f.email || f.uid || "")}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn tiny toggleBtn" type="button">${selected ? "✓" : "+"}</button>
            <button class="btn tiny warn callBtn" type="button">Call</button>
          </div>
        `;

        const toggleBtn = row.querySelector(".toggleBtn");
        const callBtn = row.querySelector(".callBtn");

        if (toggleBtn) toggleBtn.addEventListener("click", () => onToggle(key));
        if (callBtn) callBtn.addEventListener("click", () => onQuickCall(key));

        box.appendChild(row);
      });
    },

    syncSettingsUI(s) {
      const E = this.els;
      if (!s) return;

      if (E.setSpeakerDefaultTxt) safeText(E.setSpeakerDefaultTxt, s.speakerDefault ? "ON" : "OFF");
      if (E.setMicDefaultTxt) safeText(E.setMicDefaultTxt, s.micDefault ? "ON" : "OFF");
      if (E.setSoundDefaultTxt) safeText(E.setSoundDefaultTxt, s.soundDefault ? "ON" : "OFF");
      if (E.setEchoTxt) safeText(E.setEchoTxt, s.echoMode || "AUTO");

      if (E.setPingHost) safeText(E.setPingHost, s.pingHost || DEFAULT_PING_HOST);
      if (E.setUpdateRateTxt) safeText(E.setUpdateRateTxt, s.updateRate || "Normal");

      if (E.setLockTxt) safeText(E.setLockTxt, s.lockCall ? "ON" : "OFF");
      if (E.setLogsTxt) safeText(E.setLogsTxt, s.autoClearLogs ? "ON" : "OFF");
    },

    syncThemeUI(mode) {
      const E = this.els;
      if (E.themeModeTxt) safeText(E.themeModeTxt, mode || "system");
    }
  };

  /* =========================
     Part 9 — SOUND (WebAudio)
     ========================= */
  const Sound = (() => {
    let ctx = null;

    function getCtx() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx;
    }
    function unlock() {
      try {
        const ac = getCtx();
        if (ac.state === "suspended") ac.resume();
      } catch (_) {}
    }
    function tone(freq, durationMs, type = "sine", gain = 0.06) {
      try {
        const ac = getCtx();
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = gain;
        o.connect(g);
        g.connect(ac.destination);
        o.start();
        o.stop(ac.currentTime + (durationMs / 1000));
      } catch (_) {}
    }
    function beepPattern() {
      tone(880, 100, "square", 0.05);
      setTimeout(() => tone(880, 100, "square", 0.05), 140);
      setTimeout(() => tone(880, 100, "square", 0.05), 280);
      setTimeout(() => tone(660, 450, "sawtooth", 0.04), 440);
    }
    function tactical() {
      tone(1200, 70, "square", 0.04);
      setTimeout(() => tone(1400, 70, "square", 0.04), 110);
      setTimeout(() => tone(1000, 90, "square", 0.04), 220);
    }
    function teesh() {
      try {
        const ac = getCtx();
        const bufferSize = Math.floor(ac.sampleRate * 0.25);
        const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.25;

        const src = ac.createBufferSource();
        const g = ac.createGain();
        g.gain.value = 0.12;
        src.buffer = buffer;
        src.connect(g);
        g.connect(ac.destination);
        src.start();
      } catch (_) {}
    }
    function tentilik() {
      tone(1200, 90, "sine", 0.05);
      setTimeout(() => tone(1600, 140, "sine", 0.05), 120);
    }
    return { unlock, beepPattern, tactical, teesh, tentilik, tone, _getCtx: () => getCtx() };
  })();

  /* =========================
     Part 10 — THEME (system/dark/light)
     ========================= */
  const Theme = (() => {
    const KEY = "theme_mode"; // system|dark|light

    function get() {
      const v = String(Store.getRaw(KEY) || "system").toLowerCase();
      if (v === "dark" || v === "light") return v;
      return "system";
    }

    function apply(mode) {
      const m = String(mode || "system").toLowerCase();
      if (m === "dark" || m === "light") {
        document.documentElement.setAttribute("data-theme", m);
        Store.setRaw(KEY, m);
        UI.syncThemeUI(m);
        return m;
      }
      // system
      document.documentElement.removeAttribute("data-theme");
      Store.setRaw(KEY, "system");
      UI.syncThemeUI("system");
      return "system";
    }

    function cycle() {
      const cur = get();
      const next = (cur === "system") ? "dark" : (cur === "dark") ? "light" : "system";
      const applied = apply(next);
      Log.write("info", "Theme: " + applied);
      AndroidBridge.vibrate(18);
    }

    function init() {
      apply(get());
    }

    return { init, get, apply, cycle };
  })();

  /* =========================
     Part 11 — DRAWER (side panel)
     ========================= */
  const Drawer = (() => {
    function isOpen() { return document.body.classList.contains("drawerOpen") || document.body.classList.contains("drawer-open"); }

    function open() {
      document.body.classList.add("drawerOpen");
      document.body.classList.add("drawer-open");
      if (UI.els.drawerOverlay){ UI.els.drawerOverlay.classList.add("show"); UI.els.drawerOverlay.classList.remove("hidden"); }
      if (UI.els.drawer){ UI.els.drawer.classList.remove("hidden"); UI.els.drawer.setAttribute("aria-hidden","false"); }
    }

    function close() {
      document.body.classList.remove("drawerOpen");
      document.body.classList.remove("drawer-open");
      // keep overlay present if your CSS uses opacity; still safe to hide
      if (UI.els.drawerOverlay){ UI.els.drawerOverlay.classList.remove("show"); UI.els.drawerOverlay.classList.add("hidden"); }
      if (UI.els.drawer){ UI.els.drawer.classList.add("hidden"); UI.els.drawer.setAttribute("aria-hidden","true"); }
    }

    function toggle() {
      if (isOpen()) close();
      else open();
    }

    function init() {
      // If your HTML already keeps drawer visible, remove hidden safely
      // We start CLOSED by default
      close();

      // Close when clicking any button with data-drawer-close
      const hook = () => {
        const root = UI.els.drawer;
        if (!root) return;
        $$(".drawerClose,[data-drawer-close]", root).forEach((el) => {
          el.addEventListener("click", () => close());
        });
      };
      hook();
    }

    return { init, open, close, toggle, isOpen };

  /* =========================
     Part 11.5 — EDGE SWIPE (Drawer by Gesture Only)
     - فتح القائمة بالسحب من الحافة فقط (بدون زر)
     - يدعم Touch + Mouse drag
     ========================= */
  const EdgeSwipe = (() => {
    const EDGE_PX = 18;
    const OPEN_PX = 44;
    const CLOSE_PX = 44;
    const SLOPE = 1.25;

    let tracking = false;
    let startX = 0, startY = 0;
    let mode = null; // 'open' | 'close'

    function isRTL(){
      try {
        const d = (document.documentElement.getAttribute('dir') || 'rtl').toLowerCase();
        return d === 'rtl';
      } catch(_) { return true; }
    }

    function point(ev){
      try {
        if (ev && ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
        if (ev && ev.changedTouches && ev.changedTouches[0]) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
        return { x: (ev && ev.clientX) ? ev.clientX : 0, y: (ev && ev.clientY) ? ev.clientY : 0 };
      } catch(_) { return { x: 0, y: 0 }; }
    }

    function nearEdge(x){
      const w = window.innerWidth || 0;
      return isRTL() ? (x >= (w - EDGE_PX)) : (x <= EDGE_PX);
    }

    function inDrawer(x, y){
      const d = UI.els.drawer;
      if (!d) return false;
      try {
        const r = d.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      } catch(_) { return false; }
    }

    function onStart(ev){
      const p = point(ev);
      const open = Drawer.isOpen();

      if (!open){
        if (!nearEdge(p.x)) return;
        tracking = true;
        mode = 'open';
        startX = p.x; startY = p.y;
        return;
      }

      // drawer open: close by swiping from drawer area OR from same edge
      if (!inDrawer(p.x, p.y) && !nearEdge(p.x)) return;
      tracking = true;
      mode = 'close';
      startX = p.x; startY = p.y;
    }

    function onMove(ev){
      if (!tracking) return;
      const p = point(ev);
      const dx = p.x - startX;
      const dy = p.y - startY;

      // Vertical scroll wins
      if (Math.abs(dy) > 10 && (Math.abs(dy) > Math.abs(dx) * SLOPE)) {
        tracking = false; mode = null;
        return;
      }

      const rtl = isRTL();
      if (mode === 'open') {
        const d = rtl ? (startX - p.x) : (p.x - startX);
        if (d > OPEN_PX) {
          Drawer.open();
          tracking = false; mode = null;
          try { ev.preventDefault(); } catch(_) {}
        }
        return;
      }

      if (mode === 'close') {
        const d = rtl ? (p.x - startX) : (startX - p.x);
        if (d > CLOSE_PX) {
          Drawer.close();
          tracking = false; mode = null;
          try { ev.preventDefault(); } catch(_) {}
        }
      }
    }

    function onEnd(){ tracking = false; mode = null; }

    function init(){
      if (window.__MDV_EDGE_SWIPE__) return;
      window.__MDV_EDGE_SWIPE__ = true;

      // pointer events preferred
      try {
        document.addEventListener('pointerdown', onStart, { passive: true });
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onEnd, { passive: true });
        document.addEventListener('pointercancel', onEnd, { passive: true });
        return;
      } catch(_) {}

      // touch fallback
      document.addEventListener('touchstart', onStart, { passive: true });
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd, { passive: true });
      document.addEventListener('touchcancel', onEnd, { passive: true });
    }

    return { init };
  })();

  /* =========================
     Part 12 — MIC HEART MONITOR (RESTORED)
     - Works best with <canvas id="micWave"></canvas>
     ========================= */
  const MicViz = (() => {
    let canvas = null;
    let ctx = null;
    let ac = null;
    let analyser = null;
    let src = null;
    let data = null;
    let raf = 0;

    let lastY = 0;
    let lastLevel = 0; // 0..1
    let beatCooldown = 0;

    function _cssVar(name, fallback) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name);
        const s = String(v || "").trim();
        return s || fallback;
      } catch (_) { return fallback; }
    }

    function _ensureCanvasSize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const w = Math.max(60, Math.floor(rect.width * dpr));
      const h = Math.max(30, Math.floor(rect.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      if (!ctx) ctx = canvas.getContext("2d");
    }

    function _clear() {
      if (!ctx || !canvas) return;
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function _drawBeat(x, mid, amp, color) {
      // ECG spike pattern
      const h = canvas.height;
      const top = Math.max(4, mid - amp * (h * 0.46) - 8);
      const bot = Math.min(h - 4, mid + amp * (h * 0.18) + 10);

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.floor(canvas.width / 420));
      ctx.beginPath();
      ctx.moveTo(x - 10, mid);
      ctx.lineTo(x - 6, mid);
      ctx.lineTo(x - 4, top);
      ctx.lineTo(x - 2, mid + 6);
      ctx.lineTo(x + 2, bot);
      ctx.lineTo(x + 6, mid);
      ctx.lineTo(x + 10, mid);
      ctx.stroke();
    }

    function _loop() {
      if (!canvas || !ctx || !analyser || !data) return;
      raf = requestAnimationFrame(_loop);

      _ensureCanvasSize();
      const w = canvas.width;
      const h = canvas.height;
      const mid = Math.floor(h / 2);

      // scroll left
      const dx = Math.max(1, Math.floor(w / 160)); // speed based on width
      ctx.drawImage(canvas, -dx, 0);

      // fade right band
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.16)";
      ctx.fillRect(w - dx, 0, dx, h);

      analyser.getByteTimeDomainData(data);

      // RMS level
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      lastLevel = Math.max(0, Math.min(1, rms));

      // map to y
      const amp = Math.min(1, rms * 3.0); // boost
      const y = mid - amp * (h * 0.40);

      // stroke color from CSS var
      const color = _cssVar("--purple", "#a855f7");

      // draw line segment on right
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.floor(w / 380));
      ctx.beginPath();
      ctx.moveTo(w - dx - 1, lastY || mid);
      ctx.lineTo(w - 1, y);
      ctx.stroke();

      // beat detection (voice peaks)
      beatCooldown = Math.max(0, beatCooldown - 1);
      if (amp > 0.20 && beatCooldown === 0) {
        _drawBeat(w - Math.floor(dx / 2), mid, amp, color);
        beatCooldown = 18; // cooldown frames
      }

      // subtle baseline
      ctx.strokeStyle = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w - dx, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      lastY = y;
    }

    function stop() {
      try { if (raf) cancelAnimationFrame(raf); } catch (_) {}
      raf = 0;
      try { if (src) src.disconnect(); } catch (_) {}
      try { if (analyser) analyser.disconnect(); } catch (_) {}
      src = null;
      analyser = null;
      data = null;
      lastLevel = 0;
      lastY = 0;
      beatCooldown = 0;
      if (canvas && canvas.getContext) {
        ctx = canvas.getContext("2d");
        if (ctx) _clear();
      }
    }

    function start(targetCanvasEl, mediaStreamTrack) {
      canvas = targetCanvasEl && targetCanvasEl.tagName === "CANVAS" ? targetCanvasEl : null;
      if (!canvas) {
        // إذا ما عندك Canvas بنفس الـ ID، ما نكسر التطبيق
        return false;
      }

      try { ac = Sound._getCtx(); } catch (_) { ac = null; }
      if (!ac) return false;

      try {
        const t = mediaStreamTrack || null;
        if (!t) return false;

        const stream = new MediaStream([t]);
        src = ac.createMediaStreamSource(stream);
        analyser = ac.createAnalyser();
        analyser.fftSize = 2048;

        data = new Uint8Array(analyser.fftSize);

        src.connect(analyser);

        _ensureCanvasSize();
        _clear();

        lastY = Math.floor(canvas.height / 2);
        lastLevel = 0;

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(_loop);
        return true;
      } catch (_) {
        stop();
        return false;
      }
    }

    function level() { return lastLevel || 0; }

    return { start, stop, level };
  })();

  /* =========================
     Part 13 — FIREBASE COMPAT WRAPPER
     ========================= */
  const DB = (() => {
    let inited = false;
    let fs = null;
    let auth = null;

    function hasSDK() {
      return !!(window.firebase && typeof window.firebase.initializeApp === "function");
    }

    function initFirebaseCompat() {
      if (inited) return !!fs;
      inited = true;

      if (!hasSDK()) return false;

      try {
        if (!(window.firebase.apps && window.firebase.apps.length > 0)) {
          for (let i = 0; i < FIREBASE_CONFIGS.length; i++) {
            const cfg = FIREBASE_CONFIGS[i];
            try {
              window.firebase.initializeApp(cfg);
              break;
            } catch (_) {}
          }
        }

        auth = window.firebase.auth ? window.firebase.auth() : null;
        fs = window.firebase.firestore ? window.firebase.firestore() : null;

        try {
          if (auth && auth.setPersistence && window.firebase.auth && window.firebase.auth.Auth && window.firebase.auth.Auth.Persistence) {
            auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
          }
        } catch (_) {}

        return !!fs;
      } catch (_) {
        auth = null;
        fs = null;
        return false;
      }
    }

    function ready() { return fs ? true : initFirebaseCompat(); }
    function authReady() { return ready() && !!auth; }

    function serverTimestamp() {
      try { return window.firebase.firestore.FieldValue.serverTimestamp(); } catch (_) { return null; }
    }

    function doc(path) { return ready() ? fs.doc(path) : null; }
    function col(path) { return ready() ? fs.collection(path) : null; }

    async function set(pathOrRef, data, merge = true) {
      if (!ready()) return false;
      const ref = (typeof pathOrRef === "string") ? doc(pathOrRef) : pathOrRef;
      if (!ref) return false;
      await ref.set(data, { merge });
      return true;
    }

    async function add(path, data) {
      const c = col(path);
      if (!c) return null;
      return await c.add(data);
    }

    function onSnapshot(queryOrRef, cb, errCb) {
      if (!queryOrRef) return () => {};
      return queryOrRef.onSnapshot(cb, errCb);
    }

    function onAuthStateChanged(cb) {
      if (!authReady()) return () => {};
      try { return auth.onAuthStateChanged(cb); } catch (_) { return () => {}; }
    }

    async function signInAnonymously() {
      if (!authReady()) return null;
      try { return await auth.signInAnonymously(); } catch (_) { return null; }
    }

    function currentUser() {
      try { return authReady() ? auth.currentUser : null; } catch (_) { return null; }
    }

    async function queryUsersByEmail(email) {
      if (!ready()) return [];
      const e = String(email || "").trim().toLowerCase();
      if (!e) return [];
      try {
        const snap = await fs.collection("usersPublic").where("emailLower", "==", e).limit(10).get();
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        return out;
      } catch (_) { return []; }
    }

    async function queryUsersByNamePrefix(name) {
      if (!ready()) return [];
      const n = String(name || "").trim().toLowerCase();
      if (!n) return [];
      try {
        const end = n + "\uf8ff";
        const q = fs.collection("usersPublic")
          .orderBy("displayNameLower")
          .startAt(n)
          .endAt(end)
          .limit(10);
        const snap = await q.get();
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        return out;
      } catch (_) { return []; }
    }

    return {
      ready,
      authReady,
      serverTimestamp,
      doc,
      col,
      set,
      add,
      onSnapshot,
      onAuthStateChanged,
      signInAnonymously,
      currentUser,
      queryUsersByEmail,
      queryUsersByNamePrefix
    };
  })();

  /* =========================
     Part 14 — AUTH SYNC
     ========================= */
  const AuthSync = (() => {
    let lastSource = "none"; // android | firebase | none

    function isAnonymousUser(u) {
      try { return !!(u && u.isAnonymous); } catch (_) { return false; }
    }

    function applyProfile(p, source) {
      const name = String(p.name || "").trim() || (p.email ? safeNameFromEmail(p.email) : "User");
      const email = String(p.email || "").trim();
      const photoUrl = normalizePhotoUrl(p.photoUrl);

      App.state.profile.loggedIn = !!(email || name);
      App.state.profile.displayName = name;
      App.state.profile.email = email;
      App.state.profile.photoUrl = photoUrl;

      const locked = !!(source === "android" || source === "firebase");
      UI.setProfile({ name, email: email || "لم يتم تسجيل الدخول", photoUrl, locked });
      App.persistLocal();

      lastSource = source || "none";
      Log.write("good", `Profile updated (${lastSource}) ✅`);
    }

    function clearProfile(reason) {
      App.state.profile.loggedIn = false;
      App.state.profile.uid = null;

      const keepName = App.state.profile.displayNameLocal || "Guest";
      App.state.profile.displayName = keepName;
      App.state.profile.email = "";
      App.state.profile.photoUrl = "";

      UI.setProfile({
        name: keepName,
        email: "لم يتم تسجيل الدخول",
        photoUrl: "",
        locked: false
      });

      lastSource = "none";
      Log.write("warn", reason || "Profile cleared");
    }

    function onAndroidLogin(name, email, photoUrl) {
      const e = String(email || "").trim();
      const n = String(name || "").trim() || safeNameFromEmail(e);
      applyProfile({ name: n, email: e, photoUrl }, "android");
    }

    function onAndroidLogout() { clearProfile("Android logout"); }

    function onFirebaseUserChanged(user) {
      if (!user) {
        if (lastSource === "android") {
          Log.write("info", "Firebase user null (kept Android profile)");
          return;
        }
        clearProfile("Firebase signed out");
        return;
      }

      if (isAnonymousUser(user)) {
        if (lastSource === "android") {
          Log.write("info", "Firebase anonymous (kept Android profile)");
          return;
        }
        const localName = App.state.profile.displayNameLocal || "Guest";
        UI.setProfile({ name: localName, email: "لم يتم تسجيل الدخول", photoUrl: "", locked: false });
        Log.write("info", "Firebase anonymous session");
        return;
      }

      const email = user.email || "";
      const name = user.displayName || safeNameFromEmail(email);
      const photoUrl = user.photoURL || "";
      applyProfile({ name, email, photoUrl }, "firebase");
    }

    function init() {
      const localName = App.state.profile.displayNameLocal || App.state.profile.displayName || "Guest";
      const localEmail = App.state.profile.email || "";
      const localPhoto = App.state.profile.photoUrl || "";
      UI.setProfile({ name: localName, email: localEmail || "لم يتم تسجيل الدخول", photoUrl: localPhoto, locked: false });

      const prevOnAndroidUser = window.onAndroidUser;
      window.onAndroidUser = function(name, email, photo) {
        try { if (typeof prevOnAndroidUser === "function") prevOnAndroidUser(name, email, photo); } catch (_) {}
        try { onAndroidLogin(name, email, photo); } catch (_) {}
      };

      window.onAndroidLogin = function(name, email, photoUrl) { try { onAndroidLogin(name, email, photoUrl); } catch (_) {} };
      window.onAndroidLogout = function() { try { onAndroidLogout(); } catch (_) {} };
      window.onAndroidLoginFail = function(msg) { try { Log.write("bad", "Login failed: " + String(msg || "")); } catch (_) {} };
    }

    return { init, onFirebaseUserChanged, onAndroidLogin, onAndroidLogout, clearProfile };
  })();

  /* =========================
     Part 15 — AGORA WRAPPER
     ========================= */
  const Voice = (() => {
    let client = null;
    let localTrack = null;
    let joined = false;
    const remote = new Map(); // uid -> audioTrack

    function hasSDK() { return !!window.AgoraRTC; }
    function isJoined() { return joined; }
    function getLocalTrack() { return localTrack; }
    function getLocalMediaStreamTrack() {
      try {
        if (!localTrack) return null;
        if (typeof localTrack.getMediaStreamTrack === "function") return localTrack.getMediaStreamTrack();
        return null;
      } catch (_) { return null; }
    }

    async function join({ appId, channel, token, uid }) {
      if (!hasSDK()) throw new Error("AgoraRTC not loaded");
      if (!appId) throw new Error("Agora APP_ID missing");
      if (!channel) throw new Error("Channel missing");

      if (!client) {
        client = window.AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        wireEvents();
      }

      await client.join(appId, channel, token || null, uid || null);
      localTrack = await window.AgoraRTC.createMicrophoneAudioTrack();
      await client.publish([localTrack]);

      joined = true;
      return true;
    }

    async function leave() {
      if (!client) return;

      try {
        if (localTrack) {
          localTrack.stop();
          localTrack.close();
        }
      } catch (_) {}
      localTrack = null;

      try {
        for (const [, tr] of remote.entries()) {
          try { tr.stop && tr.stop(); } catch (_) {}
        }
        remote.clear();
      } catch (_) {}

      try { await client.leave(); } catch (_) {}
      joined = false;
    }

    function setMicMuted(muted) {
      if (!localTrack) return;
      try {
        if (typeof localTrack.setEnabled === "function") localTrack.setEnabled(!muted);
        else if (typeof localTrack.setMuted === "function") localTrack.setMuted(!!muted);
      } catch (_) {}
    }

    function setSpeakerMuted(muted) {
      for (const [, tr] of remote.entries()) {
        try { if (tr && typeof tr.setVolume === "function") tr.setVolume(muted ? 0 : 100); } catch (_) {}
      }
    }

    function wireEvents() {
      if (!client) return;

      client.on("user-published", async (user, mediaType) => {
        try {
          await client.subscribe(user, mediaType);
          if (mediaType === "audio" && user.audioTrack) {
            user.audioTrack.play();
            remote.set(String(user.uid), user.audioTrack);
            App.onRemoteUsersChanged();
          }
        } catch (e) {
          Log.write("bad", "Agora subscribe failed: " + errToText(e));
        }
      });

      client.on("user-unpublished", (user, mediaType) => {
        try {
          if (mediaType === "audio") {
            const tr = remote.get(String(user.uid));
            try { tr && tr.stop && tr.stop(); } catch (_) {}
            remote.delete(String(user.uid));
            App.onRemoteUsersChanged();
          }
        } catch (_) {}
      });

      client.on("user-left", (user) => {
        try {
          const tr = remote.get(String(user.uid));
          try { tr && tr.stop && tr.stop(); } catch (_) {}
          remote.delete(String(user.uid));
          App.onRemoteUsersChanged();
        } catch (_) {}
      });

      client.on("network-quality", (stats) => {
        App.onAgoraNetworkQuality(stats);
      });

      client.on("exception", (e) => {
        Log.write("bad", "Agora exception: " + errToText(e));
      });
    }

    return { hasSDK, join, leave, isJoined, setMicMuted, setSpeakerMuted, getLocalTrack, getLocalMediaStreamTrack };
  })();

  /* =========================
     Part 16 — NORMALIZERS + HISTORY
     ========================= */
  function normalizeFriend(f) {
    const o = { ...(f || {}) };
    o.uid = String(o.uid || o.id || "").trim();
    o.displayName = String(o.displayName || "Friend").trim();
    o.email = String(o.email || "").trim();
    o.photoUrl = String(o.photoUrl || "").trim();
    o.id = String(o.id || o.uid || o.email || uidShort()).trim();
    return o;
  }

  const CallHistory = (() => {
    const KEY = "call_history";
    const MAX = 50;

    function list() {
      const a = Store.getJson(KEY, []);
      return Array.isArray(a) ? a : [];
    }

    function push(item) {
      const a = list();
      a.unshift(item);
      while (a.length > MAX) a.pop();
      Store.setJson(KEY, a);
    }

    function mark(type, payload) {
      push({ t: now(), type: String(type || "event"), payload: payload || {} });
    }

    return { list, mark };
  })();

  /* =========================
     Part 17 — APP STATE + INIT
     ========================= */
  const App = {
    state: {
      profile: {
        loggedIn: false,
        uid: null,
        displayName: "Guest",
        email: "",
        photoUrl: "",
        displayNameLocal: ""
      },

      call: {
        inCall: false,
        joining: false,
        leaving: false,
        channel: "",
        token: "",
        startAt: 0,
        timerT: null,
        usageT: null
      },

      speakerOn: false,
      micMuted: false,
      speakerMuted: false,

      fm: {
        enabled: false,
        intervalMs: FM_INTERVAL_MS, // LOCKED
        running: false,
        loopT: null,
        abort: false
      },

      net: {
        type: "none",
        rssi: null,
        linkMbps: null,
        hasInternet: false,
        pingMs: -1,
        jitterMs: 0,
        lossPct: 0,
        upKbps: 0,
        downKbps: 0,
        audioLevel: 0
      },

      friends: { list: [], selected: new Set() },

      incoming: {
        active: false,
        docPath: null,
        fromName: "",
        fromEmail: "",
        channel: "",
        createdAt: 0
      },

      settings: {
        speakerDefault: false,
        micDefault: true,
        soundDefault: true,
        echoMode: "AUTO",
        pingHost: DEFAULT_PING_HOST,
        updateRate: "Normal", // Low/Normal/High
        lockCall: false,
        autoClearLogs: false
      },

      unsub: {
        incomingCalls: null,
        auth: null
      },

      __presenceT: null,
      __netT: null,
      __pingT: null,
      __audioT: null,

      __domObserver: null
    },

    init() {
      this.ensureUIBound();
      this.loadLocal();

      Theme.init();        // NEW
      Drawer.init();       // NEW
      EdgeSwipe.init();     // NEW (gesture open/close)
      AuthSync.init();

      // LEDs initial
      UI.setLed(UI.els.ledWeb, "on");
      UI.setLed(UI.els.ledFirebase, DB.ready() ? "warn" : "bad");
      UI.setLed(UI.els.ledListener, "off");
      UI.setLed(UI.els.ledMicPerm, "off");
      UI.setLed(UI.els.ledAgora, Voice.hasSDK() ? "warn" : "bad");
      UI.setLed(UI.els.ledInCall, "off");
      UI.setLed(UI.els.ledNet, "off");
      UI.setLed(UI.els.ledSrv, "off");
      UI.setLed(UI.els.ledCallQ, "off");

      this.syncForceMajeureUI();
      this.renderFriends();
      this.initFirebaseAuth();

      this.startNetworkMonitor();
      this.startPingMonitor();
      this.startAudioMeter(); // NEW (updates audioLevel from MicViz)

      UI.setCallTimer(0);
      UI.setCallState("disconnected");

      UI.syncSettingsUI(this.state.settings);
      this.syncButtonsText();

      Log.write("good", "App ready ✅");
      Log.write("info", Voice.hasSDK() ? "Agora SDK: OK" : "Agora SDK: NOT LOADED (check script)");
      Log.write("info", "Version: " + APP_VERSION);

      try { console.log("✅ App.js loaded, AGORA_APP_ID =", AGORA_APP_ID); } catch (_) {}
      this.attachLifecycle();
    },

    /* =========================
       Part 18 — UI REBIND + LIFECYCLE
       ========================= */
    ensureUIBound() {
      const mustExist = () => {
        const a = byId("joinBtn");
        const b = byId("leaveBtn");
        const c = byId("channel");
        const d = byId("log");
        return !!(a && b && c && d);
      };

      const doBind = () => {
        try {
          UI.bind();
          Log.write("good", "UI bound ✅");
          UI.syncSettingsUI(this.state.settings);
          UI.syncThemeUI(Theme.get());
          this.syncButtonsText();
        } catch (e) {
          try { console.warn(e); } catch (_) {}
        }
      };

      if (mustExist()) {
        doBind();
        return;
      }

      try {
        if (this.state.__domObserver) {
          this.state.__domObserver.disconnect();
          this.state.__domObserver = null;
        }
      } catch (_) {}

      const obs = new MutationObserver(() => {
        if (mustExist()) {
          doBind();
          try { obs.disconnect(); } catch (_) {}
        }
      });

      try {
        obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
        this.state.__domObserver = obs;
      } catch (_) {}

      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (mustExist()) {
          clearInterval(t);
          doBind();
          return;
        }
        if (tries >= 12) {
          clearInterval(t);
          try { console.warn("UI bind timed out, check IDs in index.html"); } catch (_) {}
        }
      }, 250);
    },

    attachLifecycle() {
      const onHide = () => { try { this.setPresenceState("offline"); } catch (_) {} };
      const onShow = () => {
        try { this.setPresenceState(this.state.call.inCall ? "in_call" : "online"); } catch (_) {}
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") onHide();
        else onShow();
      });

      window.addEventListener("pagehide", () => onHide());
      window.addEventListener("beforeunload", () => onHide());
    },

    syncForceMajeureUI() {
      if (UI.els.swFM) UI.els.swFM.checked = !!this.state.fm.enabled;

      if (UI.els.fmIntervalSel) {
        UI.els.fmIntervalSel.value = String(FM_INTERVAL_MS);
        UI.els.fmIntervalSel.disabled = true;
      }
      if (UI.els.fmRebootSel) {
        UI.els.fmRebootSel.value = String(FM_REBOOT_SECONDS);
        UI.els.fmRebootSel.disabled = true;
      }

      this.state.fm.intervalMs = FM_INTERVAL_MS;
    },

    syncButtonsText() {
      if (UI.els.btnSpeaker) safeText(UI.els.btnSpeaker, this.state.speakerOn ? "🔊 Speaker: ON" : "🔊 Speaker: OFF");
      if (UI.els.btnMuteMic) safeText(UI.els.btnMuteMic, this.state.micMuted ? "🎙️ Mic: OFF" : "🎙️ Mic: ON");
      if (UI.els.btnMuteSpk) safeText(UI.els.btnMuteSpk, this.state.speakerMuted ? "🔇 Sound: OFF" : "🔇 Sound: ON");
    },

    /* =========================
       Part 19 — LOCAL LOAD/SAVE + AUTH
       ========================= */
    loadLocal() {
      const s = Store.getJson("state", null);
      if (!s) return;

      try {
        if (s.profile) {
          this.state.profile.displayNameLocal = s.profile.displayNameLocal || "";
          this.state.profile.email = s.profile.email || "";
          this.state.profile.photoUrl = s.profile.photoUrl || "";
          this.state.profile.displayName = s.profile.displayName || this.state.profile.displayName;
        }

        if (s.friends && Array.isArray(s.friends.list)) {
          this.state.friends.list = s.friends.list.map(normalizeFriend);
        }

        if (s.fm) {
          this.state.fm.enabled = !!s.fm.enabled;
          this.state.fm.intervalMs = FM_INTERVAL_MS;
        }

        if (s.settings) {
          const x = s.settings;
          this.state.settings.speakerDefault = !!x.speakerDefault;
          this.state.settings.micDefault = (x.micDefault !== undefined) ? !!x.micDefault : true;
          this.state.settings.soundDefault = (x.soundDefault !== undefined) ? !!x.soundDefault : true;
          this.state.settings.echoMode = String(x.echoMode || "AUTO").toUpperCase();
          this.state.settings.pingHost = String(x.pingHost || DEFAULT_PING_HOST);
          this.state.settings.updateRate = String(x.updateRate || "Normal");
          this.state.settings.lockCall = !!x.lockCall;
          this.state.settings.autoClearLogs = !!x.autoClearLogs;
        }
      } catch (_) {}
    },

    persistLocal() {
      const s = {
        profile: {
          displayNameLocal: this.state.profile.displayNameLocal || "",
          displayName: this.state.profile.displayName || "Guest",
          email: this.state.profile.email || "",
          photoUrl: this.state.profile.photoUrl || ""
        },
        friends: { list: this.state.friends.list || [] },
        fm: { enabled: !!this.state.fm.enabled, intervalMs: FM_INTERVAL_MS },
        settings: { ...this.state.settings }
      };
      Store.setJson("state", s);
    },

    getPresenceRoom() {
      const v = UI.els.inPresence ? (UI.els.inPresence.value || "").trim() : "";
      return v || "call_room1";
    },

    getChannel() {
      const v = UI.els.inChannel ? (UI.els.inChannel.value || "").trim() : "";
      return v;
    },

    getToken() {
      const v = UI.els.inToken ? (UI.els.inToken.value || "").trim() : "";
      return v;
    },

    getName() {
      const v = UI.els.inName ? (UI.els.inName.value || "").trim() : "";
      return v || this.state.profile.displayNameLocal || this.state.profile.displayName || "User";
    },

    getMyUid() {
      const u = DB.currentUser && DB.currentUser();
      if (u && u.uid) return u.uid;

      let id = Store.getRaw("pseudo_uid");
      if (!id) {
        id = "device_" + uidShort();
        Store.setRaw("pseudo_uid", id);
      }
      return id;
    },

    getBlockUntil() {
      const v = Number(Store.getRaw("block_until") || "0");
      return Number.isFinite(v) ? v : 0;
    },

    setBlockUntil(ts) {
      Store.setRaw("block_until", String(ts || 0));
    },

    async upsertMyPublicProfile() {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      const dn = this.getName();

      const payload = {
        uid,
        displayName: dn,
        displayNameLower: dn.toLowerCase(),
        email: this.state.profile.email || "",
        emailLower: (this.state.profile.email || "").toLowerCase(),
        photoUrl: this.state.profile.photoUrl || "",
        updatedAt: DB.serverTimestamp() || now()
      };

      await DB.set(`usersPublic/${uid}`, payload, true);
    },

    initFirebaseAuth() {
      if (!DB.authReady()) {
        UI.setLed(UI.els.ledFirebase, "bad");
        Log.write("warn", "Firebase SDK غير محمّل");
        return;
      }

      try { if (this.state.unsub.auth) this.state.unsub.auth(); } catch (_) {}

      this.state.unsub.auth = DB.onAuthStateChanged(async (user) => {
        AuthSync.onFirebaseUserChanged(user);

        if (user) {
          this.state.profile.uid = user.uid;
          UI.setLed(UI.els.ledFirebase, "on");

          this.watchIncomingCalls(true);
          this.startPresenceHeartbeat(true);

          this.upsertMyPublicProfile().catch(() => {});
        } else {
          UI.setLed(UI.els.ledFirebase, "warn");
          const res = await DB.signInAnonymously();
          if (!res) Log.write("warn", "Anonymous sign-in failed (check Firebase config)");
        }
      });
    },

    /* =========================
       Part 20 — CALL FLOW
       ========================= */
    async joinFlow() {
      if (this.state.call.joining) {
        Log.write("warn", "Join already running...");
        return;
      }
      this.state.call.joining = true;

      try {
        const blockUntil = this.getBlockUntil();
        if (blockUntil && now() < blockUntil) {
          const leftSec = Math.ceil((blockUntil - now()) / 1000);
          Log.write("bad", `تم حظر المكالمات مؤقتاً ⛔ (${fmtTime(leftSec)})`);
          return;
        }

        const channel = this.getChannel();
        if (!channel) {
          Log.write("warn", "اكتب Channel يدويًا أولاً");
          return;
        }

        if (!AGORA_APP_ID || !String(AGORA_APP_ID).trim()) {
          Log.write("bad", "AGORA_APP_ID غير موجود");
          UI.setLed(UI.els.ledAgora, "bad");
          return;
        }

        if (!Voice.hasSDK()) {
          Log.write("bad", "AgoraRTC غير محمّل (تحقق من رابط SDK)");
          UI.setLed(UI.els.ledAgora, "bad");
          return;
        }

        if (!window.isSecureContext && !AndroidBridge.exists()) {
          Log.write("warn", "تنبيه: البيئة ليست SecureContext — قد تمنع صلاحية المايك");
        }

        const token = this.getToken();
        Log.write("warn", `Joining: ${channel}`);

        try {
          AndroidBridge.setCallMode(true);
          UI.setLed(UI.els.ledAgora, "warn");

          await Voice.join({ appId: AGORA_APP_ID, channel, token, uid: null });

          UI.setLed(UI.els.ledMicPerm, "on");
          UI.setLed(UI.els.ledAgora, "on");

          // Apply defaults
          this.state.speakerOn = !!this.state.settings.speakerDefault;
          this.state.micMuted = !this.state.settings.micDefault;
          this.state.speakerMuted = !this.state.settings.soundDefault;

          AndroidBridge.setSpeaker(this.state.speakerOn);
          Voice.setMicMuted(this.state.micMuted);
          Voice.setSpeakerMuted(this.state.speakerMuted);
          this.syncButtonsText();

          // Start mic heart monitor (RESTORED)
          const mst = Voice.getLocalMediaStreamTrack();
          if (mst && UI.els.micWave) {
            const ok = MicViz.start(UI.els.micWave, mst);
            if (ok) Log.write("good", "Mic Heart Monitor: ON ❤️");
            else Log.write("warn", "Mic Heart Monitor: element/track missing");
          } else {
            Log.write("warn", "Mic Heart Monitor: add <canvas id='micWave'> in HTML");
          }

          this.state.call.inCall = true;
          this.state.call.channel = channel;
          this.state.call.token = token;
          this.state.call.startAt = now();

          this.startCallTimer();
          this.startUsageTick();

          UI.setCallState("connected");
          Log.write("good", "✅ CONNECTED");

          CallHistory.mark("join", { channel });

          this.setPresenceState("in_call");

          if (this.state.fm.enabled) this.startForceMajeureLoop();
        } catch (e) {
          const why = errToText(e);
          Log.write("bad", "Join failed (Agora): " + why);
          Log.write("warn", "أسباب شائعة: صلاحية المايك، SDK لم يحمل، Token مطلوب.");

          const low = String(why).toLowerCase();
          UI.setLed(UI.els.ledMicPerm, (low.includes("notallowed") || low.includes("permission")) ? "bad" : "warn");
          UI.setLed(UI.els.ledAgora, "bad");
          UI.setCallState("disconnected");
          AndroidBridge.setCallMode(false);

          this.state.call.inCall = false;
          this.stopCallTimer();
          this.stopUsageTick();

          MicViz.stop();

          CallHistory.mark("join_fail", { channel, error: why });
        }
      } finally {
        this.state.call.joining = false;
      }
    },

    async leaveFlow() {
      if (this.state.call.leaving) {
        Log.write("warn", "Leave already running...");
        return;
      }
      this.state.call.leaving = true;

      try {
        this.stopForceMajeureLoop();
        Log.write("warn", "Leaving...");

        try { await Voice.leave(); } catch (_) {}
        AndroidBridge.setCallMode(false);

        this.state.call.inCall = false;
        this.state.call.channel = "";
        this.state.call.token = "";

        this.stopCallTimer();
        this.stopUsageTick();

        MicViz.stop();
        this.state.net.audioLevel = 0;

        UI.setLed(UI.els.ledAgora, "off");
        UI.setCallState("disconnected");
        Log.write("good", "تم الخروج");

        CallHistory.mark("leave", {});
        this.setPresenceState("online");
      } finally {
        this.state.call.leaving = false;
      }
    },

    endCall() {
      try { AndroidBridge.endCall(); } catch (_) {}
      return this.leaveFlow();
    },

    startCallTimer() {
      this.stopCallTimer();
      this.state.call.timerT = setInterval(() => {
        if (!this.state.call.inCall || !this.state.call.startAt) return UI.setCallTimer(0);
        const sec = Math.floor((now() - this.state.call.startAt) / 1000);
        UI.setCallTimer(sec);
      }, 1000);
    },

    stopCallTimer() {
      if (this.state.call.timerT) clearInterval(this.state.call.timerT);
      this.state.call.timerT = null;
      UI.setCallTimer(0);
    },

    startUsageTick() {
      this.stopUsageTick();
      this.state.call.usageT = setInterval(async () => {
        try {
          if (!this.state.call.inCall) return;
          const dur = now() - (this.state.call.startAt || now());
          if (dur >= CALL_LIMIT_MS) {
            Log.write("bad", "⛔ تم الوصول للحد (3 ساعات) — سيتم إغلاق المكالمة وبدء حظر 20 ساعة");
            Sound.beepPattern();
            AndroidBridge.vibrate(120);

            await this.leaveFlow();

            const until = now() + BLOCK_MS;
            this.setBlockUntil(until);
            Log.write("warn", `حظر: ${fmtTime(Math.ceil(BLOCK_MS / 1000))}`);

            CallHistory.mark("blocked", { until });
          }
        } catch (_) {}
      }, USAGE_TICK_MS);
    },

    stopUsageTick() {
      if (this.state.call.usageT) clearInterval(this.state.call.usageT);
      this.state.call.usageT = null;
    },

    onRemoteUsersChanged() {},

    toggleSpeaker() {
      this.state.speakerOn = !this.state.speakerOn;
      AndroidBridge.setSpeaker(this.state.speakerOn);
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.speakerOn ? "🔊 Speaker ON" : "🔈 Speaker OFF");
    },

    toggleMuteMic() {
      this.state.micMuted = !this.state.micMuted;
      try { Voice.setMicMuted(this.state.micMuted); } catch (_) {}
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.micMuted ? "🎙️ Mic MUTED" : "🎙️ Mic ON");
    },

    toggleMuteSpeaker() {
      this.state.speakerMuted = !this.state.speakerMuted;
      try { Voice.setSpeakerMuted(this.state.speakerMuted); } catch (_) {}
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.speakerMuted ? "🔇 Output MUTED" : "🔊 Output ON");
    },

    /* =========================
       Part 21 — FORCE MAJEURE (LOCKED)
       ========================= */
    toggleForceMajeure() {
      this.state.fm.enabled = !!(UI.els.swFM && UI.els.swFM.checked);
      this.state.fm.intervalMs = FM_INTERVAL_MS;
      this.persistLocal();

      if (this.state.fm.enabled) {
        Log.write("warn", "FM: ON (كل دقيقتين)");
        Sound.tactical();
        if (this.state.call.inCall) this.startForceMajeureLoop();
      } else {
        Log.write("good", "FM: OFF");
        this.stopForceMajeureLoop();
      }
    },

    startForceMajeureLoop() {
      const fm = this.state.fm;
      fm.intervalMs = FM_INTERVAL_MS;
      if (!fm.enabled) return;
      if (fm.running) return;
      if (!this.state.call.inCall) return;

      fm.running = true;
      fm.abort = false;

      const loop = async () => {
        if (!fm.enabled || fm.abort) return;

        await sleepWithAbort(fm.intervalMs, () => (!fm.enabled || fm.abort || !this.state.call.inCall));
        if (!fm.enabled || fm.abort) return;
        if (!this.state.call.inCall) { fm.running = false; return; }

        Sound.beepPattern();
        AndroidBridge.vibrate(60);
        Log.write("warn", "FM: Alarm!");

        const ch = this.getChannel() || this.state.call.channel;
        const token = this.getToken() || this.state.call.token;

        try { await Voice.leave(); } catch (_) {}
        AndroidBridge.setCallMode(false);

        this.state.call.inCall = false;
        this.stopCallTimer();
        this.stopUsageTick();

        UI.setCallState("disconnected");
        UI.setLed(UI.els.ledAgora, "warn");

        let count = FM_REBOOT_SECONDS;
        UI.showReboot(true, count);
        Sound.teesh();

        while (count > 0 && fm.enabled && !fm.abort) {
          UI.showReboot(true, count);
          await sleep(1000);
          count--;
        }

        UI.showReboot(false, 0);
        if (!fm.enabled || fm.abort) { fm.running = false; return; }

        Sound.tentilik();
        Log.write("warn", "FM: Reconnect...");

        try {
          AndroidBridge.setCallMode(true);
          await Voice.join({ appId: AGORA_APP_ID, channel: ch, token, uid: null });

          Voice.setMicMuted(this.state.micMuted);
          Voice.setSpeakerMuted(this.state.speakerMuted);

          // restart visualizer after reconnect
          const mst = Voice.getLocalMediaStreamTrack();
          if (mst && UI.els.micWave) MicViz.start(UI.els.micWave, mst);

          this.state.call.inCall = true;
          this.state.call.startAt = now();

          this.startCallTimer();
          this.startUsageTick();

          UI.setCallState("connected");
          UI.setLed(UI.els.ledAgora, "on");
          UI.setLed(UI.els.ledMicPerm, "on");

          Log.write("good", "FM: ✅ Reconnected");
          CallHistory.mark("fm_reconnect", { channel: ch });
        } catch (e) {
          Log.write("bad", "FM: Rejoin failed: " + errToText(e));
          UI.setLed(UI.els.ledAgora, "bad");
          AndroidBridge.setCallMode(false);
          fm.running = false;
          CallHistory.mark("fm_fail", { error: errToText(e) });
          return;
        }

        if (fm.enabled && !fm.abort) fm.loopT = setTimeout(loop, 50);
        else fm.running = false;
      };

      fm.loopT = setTimeout(loop, 50);
    },

    stopForceMajeureLoop() {
      const fm = this.state.fm;
      fm.abort = true;
      fm.running = false;
      if (fm.loopT) clearTimeout(fm.loopT);
      fm.loopT = null;
      UI.showReboot(false, 0);
    },

    onAgoraNetworkQuality(stats) {
      if (!stats) return;

      const up = Number(stats.uplinkNetworkQuality || 0);
      const down = Number(stats.downlinkNetworkQuality || 0);
      const q = Math.max(up, down);

      let level = "warn";
      if (q === 0) level = "warn";
      else if (q <= 2) level = "on";
      else if (q === 3) level = "warn";
      else level = "bad";

      UI.setLed(UI.els.ledCallQ, level);

      this.state.net.jitterMs = (level === "on") ? 10 : (level === "warn") ? 25 : 70;
      this.state.net.lossPct = (level === "on") ? 0.8 : (level === "warn") ? 3.5 : 12;
      this.updateQualityPanels();
    },

    /* =========================
       Part 22 — PRESENCE + INCOMING CALLS
       ========================= */
    async startPresenceHeartbeat(force = false) {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      if (!uid) return;

      if (this.state.__presenceT && !force) return;
      if (this.state.__presenceT) clearInterval(this.state.__presenceT);

      const roomId = this.getPresenceRoom();
      const path = `presenceRooms/${roomId}/users/${uid}`;

      const writePresence = async () => {
        const payload = {
          uid,
          displayName: this.getName(),
          email: this.state.profile.email || "",
          photoUrl: this.state.profile.photoUrl || "",
          state: this.state.call.inCall ? "in_call" : "online",
          lastSeen: DB.serverTimestamp() || now()
        };
        try { await DB.set(path, payload, true); } catch (_) {}
      };

      await writePresence();
      this.state.__presenceT = setInterval(writePresence, 15000);
    },

    setPresenceState(state) {
      if (!DB.ready()) return;
      const uid = this.getMyUid();
      const roomId = this.getPresenceRoom();
      const path = `presenceRooms/${roomId}/users/${uid}`;
      DB.set(path, { state: state || "online", lastSeen: DB.serverTimestamp() || now() }, true).catch(() => {});
    },

    watchIncomingCalls(force = false) {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      const roomId = this.getPresenceRoom();
      const callsCol = DB.col(`presenceRooms/${roomId}/calls`);
      if (!callsCol) return;

      if (this.state.unsub.incomingCalls && !force) return;
      if (this.state.unsub.incomingCalls) {
        try { this.state.unsub.incomingCalls(); } catch (_) {}
        this.state.unsub.incomingCalls = null;
      }

      let q;
      try {
        q = callsCol
          .where("status", "==", "ringing")
          .where("toUids", "array-contains", uid)
          .limit(1);
      } catch (_) {
        UI.setLed(UI.els.ledListener, "bad");
        return;
      }

      UI.setLed(UI.els.ledListener, "on");

      this.state.unsub.incomingCalls = DB.onSnapshot(q, (snap) => {
        if (!snap || snap.empty) return;

        const doc = snap.docs[0];
        const data = doc.data() || {};
        const path = doc.ref && doc.ref.path ? doc.ref.path : null;

        if (this.state.incoming.active && this.state.incoming.docPath === path) return;

        this.state.incoming.active = true;
        this.state.incoming.docPath = path;
        this.state.incoming.fromName = data.fromName || "Unknown";
        this.state.incoming.fromEmail = data.fromEmail || "";
        this.state.incoming.channel = data.channel || "";
        this.state.incoming.createdAt = (data.createdAt && data.createdAt.toMillis) ? data.createdAt.toMillis() : now();

        safeText(UI.els.modalFromName, `${this.state.incoming.fromName}`);
        UI.showModal(true);

        Sound.beepPattern();
        AndroidBridge.vibrate(120);
        AndroidBridge.showNotification("📞 Incoming Call", `${this.state.incoming.fromName} is calling you`);

        Log.write("warn", `Incoming: ${this.state.incoming.fromName}`);
        CallHistory.mark("incoming", { from: this.state.incoming.fromName, channel: this.state.incoming.channel });

        this.autoExpireIncomingIfNeeded();
      }, () => {
        UI.setLed(UI.els.ledListener, "bad");
      });
    },

    async autoExpireIncomingIfNeeded() {
      const ttl = 45 * 1000;
      const started = this.state.incoming.createdAt || now();

      await sleepWithAbort(2500, () => !this.state.incoming.active);
      if (!this.state.incoming.active) return;

      const age = now() - started;
      if (age < ttl) return;

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "missed",
            missedAt: DB.serverTimestamp() || now(),
            missedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      UI.showModal(false);
      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      Log.write("warn", "Missed call (expired)");
      CallHistory.mark("missed", {});
    },

    async acceptIncomingCall() {
      if (!this.state.incoming.active) return;

      if (UI.els.inChannel) UI.els.inChannel.value = this.state.incoming.channel || "";
      UI.showModal(false);

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "accepted",
            acceptedAt: DB.serverTimestamp() || now(),
            acceptedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      await this.joinFlow();
    },

    async declineIncomingCall() {
      if (!this.state.incoming.active) return;
      UI.showModal(false);

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "declined",
            declinedAt: DB.serverTimestamp() || now(),
            declinedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      Log.write("info", "تم الرفض");
      CallHistory.mark("decline", {});
    },

    /* =========================
       Part 23 — FRIENDS + INVITES + BROADCAST
       ========================= */
    renderFriends() {
      UI.renderFriends(
        this.state.friends.list,
        this.state.friends.selected,
        (key) => {
          if (this.state.friends.selected.has(key)) this.state.friends.selected.delete(key);
          else this.state.friends.selected.add(key);
          this.renderFriends();
        },
        (key) => {
          this.state.friends.selected.clear();
          this.state.friends.selected.add(key);
          this.sendCallInviteToSelected();
        }
      );
    },

    clearFriendSelection() {
      this.state.friends.selected.clear();
      this.renderFriends();
      Log.write("info", "تم إلغاء التحديد");
    },

    upsertFriend(friend) {
      const f = normalizeFriend(friend);
      const list = this.state.friends.list || [];

      const idx = list.findIndex((x) =>
        (x.uid && f.uid && x.uid === f.uid) ||
        (!f.uid && x.email && f.email && x.email.toLowerCase() === f.email.toLowerCase())
      );

      if (idx >= 0) list[idx] = { ...list[idx], ...f };
      else list.push(f);

      this.state.friends.list = list;
      this.persistLocal();
      this.renderFriends();
    },

    addFriendLocalFromInputs() {
      const name = UI.els.friendName ? (UI.els.friendName.value || "").trim() : "";
      const email = UI.els.friendEmail ? (UI.els.friendEmail.value || "").trim() : "";
      if (!name && !email) return Log.write("warn", "اكتب اسم/إيميل ثم إضافة");

      this.upsertFriend({
        uid: "",
        displayName: name || (email ? email.split("@")[0] : "Friend"),
        email: email || "",
        photoUrl: ""
      });

      Log.write("good", "تمت الإضافة محلياً");
    },

    exportFriends() {
      const pack = { v: 1, t: now(), friends: this.state.friends.list || [] };
      const text = JSON.stringify(pack);
      try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (_) {}
      AndroidBridge.copyToClipboard(text);
      Log.write("good", "تم نسخ الأصدقاء (JSON) للحافظة");
    },

    importFriends() {
      const raw = prompt("ألصق JSON الأصدقاء هنا:");
      if (!raw) return;
      const o = safeJsonParse(raw);
      if (!o || !Array.isArray(o.friends)) return Log.write("bad", "JSON غير صالح");
      this.state.friends.list = o.friends.map(normalizeFriend);
      this.persistLocal();
      this.renderFriends();
      Log.write("good", "تم الاستيراد ✅");
    },

    async searchFriends() {
      const name = UI.els.friendName ? (UI.els.friendName.value || "").trim() : "";
      const email = UI.els.friendEmail ? (UI.els.friendEmail.value || "").trim() : "";

      if (!name && !email) {
        Log.write("warn", "اكتب اسم أو إيميل للبحث");
        return;
      }

      if (!DB.ready()) {
        Log.write("bad", "Firebase غير جاهز / غير محمّل");
        return;
      }

      Log.write("info", "Searching...");

      let results = [];
      if (email) results = await DB.queryUsersByEmail(email);
      if (!results.length && name) results = await DB.queryUsersByNamePrefix(name);

      if (!results.length) {
        const fallback = {
          uid: "",
          displayName: name || (email ? email.split("@")[0] : "Friend"),
          email: email || "",
          photoUrl: ""
        };
        this.upsertFriend(fallback);
        Log.write("warn", "لم يتم العثور — تم إضافة كصديق محلي (بدون UID)");
        return;
      }

      results.forEach((u) => {
        this.upsertFriend({
          uid: u.uid || u.id || "",
          displayName: u.displayName || u.name || "Friend",
          email: u.email || "",
          photoUrl: u.photoUrl || u.photoURL || ""
        });
      });

      Log.write("good", `Found: ${results.length}`);
    },

    async sendCallInviteToSelected() {
      const channel = this.getChannel();
      if (!channel) {
        Log.write("warn", "اكتب Channel يدويًا أولاً");
        return;
      }

      const selKeys = Array.from(this.state.friends.selected);
      if (!selKeys.length) {
        Log.write("warn", "حدد أصدقاء أولاً");
        return;
      }

      if (!DB.ready()) {
        Log.write("bad", "Firebase غير جاهز / غير محمّل");
        return;
      }

      const targets = [];
      (this.state.friends.list || []).forEach((f) => {
        const key = f.uid || f.email || f.id;
        if (selKeys.includes(key) && f.uid) targets.push(f.uid);
      });

      if (!targets.length) {
        Log.write("warn", "لا يوجد UID للأصدقاء المحددين (لا يمكن إرسال نداء)");
        return;
      }

      const roomId = this.getPresenceRoom();
      const payload = {
        status: "ringing",
        channel,
        roomId,
        fromUid: this.getMyUid(),
        fromName: this.getName(),
        fromEmail: this.state.profile.email || "",
        toUids: targets.slice(0, 50),
        createdAt: DB.serverTimestamp() || now()
      };

      try {
        await DB.add(`presenceRooms/${roomId}/calls`, payload);
        Log.write("good", `📞 Call invite sent (${payload.toUids.length})`);
        CallHistory.mark("invite_sent", { targets: payload.toUids.length, channel });
      } catch (e) {
        Log.write("bad", "فشل إرسال النداء: " + errToText(e));
      }
    },

    async sendBroadcastInvite() {
      const channel = this.getChannel();
      if (!channel) return Log.write("warn", "اكتب Channel أولاً");

      if (!DB.ready()) return Log.write("bad", "Firebase غير جاهز / غير محمّل");

      const roomId = this.getPresenceRoom();
      const myUid = this.getMyUid();

      const usersCol = DB.col(`presenceRooms/${roomId}/users`);
      if (!usersCol) return Log.write("bad", "Presence room users غير متاح");

      Log.write("info", "Broadcasting call...");

      let uids = [];
      try {
        let snap = null;
        try {
          snap = await usersCol.where("state", "in", ["online", "in_call"]).limit(50).get();
        } catch (_) {
          snap = await usersCol.limit(50).get();
        }
        snap.forEach((d) => {
          const data = d.data() || {};
          const uid = String(data.uid || d.id || "").trim();
          if (uid && uid !== myUid) uids.push(uid);
        });
      } catch (e) {
        return Log.write("bad", "Broadcast users read fail: " + errToText(e));
      }

      const seen = {};
      uids = uids.filter((x) => (seen[x] ? false : (seen[x] = true)));

      if (!uids.length) return Log.write("warn", "لا يوجد مستخدمين Online لإرسال النداء");

      const payload = {
        status: "ringing",
        channel,
        roomId,
        fromUid: myUid,
        fromName: this.getName(),
        fromEmail: this.state.profile.email || "",
        toUids: uids.slice(0, 50),
        createdAt: DB.serverTimestamp() || now()
      };

      try {
        await DB.add(`presenceRooms/${roomId}/calls`, payload);
        Log.write("good", `📣 Broadcast sent (${payload.toUids.length})`);
        CallHistory.mark("broadcast", { to: payload.toUids.length, channel });
        Sound.tactical();
        AndroidBridge.vibrate(60);
      } catch (e) {
        Log.write("bad", "Broadcast failed: " + errToText(e));
      }
    },

    /* =========================
       Part 24 — NETWORK + PING + AUDIO + SETTINGS + DIAGNOSTICS
       ========================= */
    setDefaults({ speaker, mic, sound }) {
      if (speaker !== undefined) this.state.settings.speakerDefault = !!speaker;
      if (mic !== undefined) this.state.settings.micDefault = !!mic;
      if (sound !== undefined) this.state.settings.soundDefault = !!sound;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("good", "تم حفظ الإعدادات ✅");
    },

    setEchoMode(mode) {
      this.state.settings.echoMode = String(mode || "AUTO").toUpperCase();
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Echo: " + this.state.settings.echoMode);
    },

    setPingHost(host) {
      const h = String(host || "").trim() || DEFAULT_PING_HOST;
      this.state.settings.pingHost = h;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Ping Host: " + h);
    },

    setUpdateRate(rate) {
      const r = String(rate || "Normal");
      this.state.settings.updateRate = (r === "Low" || r === "High") ? r : "Normal";
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Update Rate: " + this.state.settings.updateRate);
      this.startNetworkMonitor(true);
      this.startPingMonitor(true);
    },

    setLockCall(on) {
      this.state.settings.lockCall = !!on;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      UI.setCallState(this.state.call.inCall ? "connected" : "disconnected");
      Log.write("info", "Lock Call: " + (this.state.settings.lockCall ? "ON" : "OFF"));
    },

    setAutoClearLogs(on) {
      this.state.settings.autoClearLogs = !!on;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Auto Clear Logs: " + (this.state.settings.autoClearLogs ? "ON" : "OFF"));
    },

    updateQualityPanels() {
      const n = this.state.net;

      const netScore = n.hasInternet ? (n.type === "wifi" && typeof n.rssi === "number"
        ? (n.rssi >= -55 ? 95 : n.rssi >= -67 ? 85 : n.rssi >= -78 ? 65 : 35)
        : 80) : 0;

      const ping = n.pingMs;
      const pingScore = (ping < 0) ? 0 : (ping <= 80 ? 95 : ping <= 150 ? 80 : ping <= 250 ? 60 : ping <= 400 ? 40 : 15);

      const jit = Number(n.jitterMs || 0);
      const jitterScore = (jit <= 15 ? 90 : jit <= 30 ? 75 : jit <= 60 ? 50 : 20);

      const loss = Number(n.lossPct || 0);
      const lossScore = (loss <= 1 ? 90 : loss <= 3 ? 75 : loss <= 8 ? 50 : 20);

      const up = Number(n.upKbps || 0);
      const down = Number(n.downKbps || 0);
      const upScore = Math.max(10, Math.min(100, (up / 120) * 100));
      const downScore = Math.max(10, Math.min(100, (down / 200) * 100));

      const audio = Number(n.audioLevel || 0);          // 0..1
      const audioScore = Math.max(10, Math.min(100, audio * 100));

      let grade = "OK";
      if (pingScore >= 85 && jitterScore >= 75 && lossScore >= 75) grade = "Excellent";
      else if (pingScore >= 70 && jitterScore >= 60 && lossScore >= 60) grade = "Good";
      else if (pingScore >= 45 && jitterScore >= 45 && lossScore >= 45) grade = "OK";
      else grade = "Poor";

      const gradeScore = (grade === "Excellent") ? 92 : (grade === "Good") ? 76 : (grade === "OK") ? 55 : 28;

      UI.setQualityUI({
        netText: `${n.type || "none"} ${n.rssi != null ? (String(n.rssi) + " dBm") : ""}`.trim(),
        pingMs: (ping >= 0 ? ping : "..."),
        jitterMs: jit,
        lossPct: loss,
        upKbps: up,
        downKbps: down,
        audioLevel: (audio ? audio.toFixed(2) : "0.00"),
        grade,
        netScore,
        pingScore,
        jitterScore,
        lossScore,
        upScore,
        downScore,
        audioScore,
        gradeScore
      });

      // Diagnostics page
      safeText(UI.els.diagNetType, String(n.type || "none"));
      safeText(UI.els.diagRssi, n.rssi == null ? "..." : String(n.rssi));
      safeText(UI.els.diagLink, n.linkMbps == null ? "..." : String(n.linkMbps));
      safeText(UI.els.diagInternet, String(!!n.hasInternet));
      safeText(UI.els.diagPing, ping < 0 ? "..." : String(ping));
      safeText(UI.els.diagPingGrade, grade);
      safeText(UI.els.diagJitter, String(jit));
      safeText(UI.els.diagLoss, String(loss));
      safeText(UI.els.diagUp, String(up));
      safeText(UI.els.diagDown, String(down));
      safeText(UI.els.diagCodec, "Opus");
      safeText(UI.els.diagCallLedTxt, (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("on")) ? "ON" :
        (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("warn")) ? "WARN" :
        (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("bad")) ? "BAD" : "OFF");

      safeText(UI.els.diagSrvLedTxt,
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("on")) ? "ON" :
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("warn")) ? "WARN" :
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("bad")) ? "BAD" : "OFF"
      );

      safeText(UI.els.diagSrvBarsTxt, (n.pingMs < 0) ? "0-4" : (n.pingMs < 100 ? "4" : n.pingMs < 200 ? "3" : n.pingMs < 400 ? "2" : "1"));
    },

    startNetworkMonitor(force = false) {
      const rate = this.state.settings.updateRate;
      const interval = (rate === "Low") ? 5000 : (rate === "High") ? 1000 : 2000;

      if (this.state.__netT && !force) return;
      if (this.state.__netT) clearInterval(this.state.__netT);

      const tick = () => {
        let info = null;
        const raw = AndroidBridge.getNetworkInfoJson();
        if (raw) info = safeJsonParse(raw);

        if (info) {
          this.state.net.type = String(info.type || info.netType || "other").toLowerCase();
          this.state.net.rssi = (info.rssi != null) ? Number(info.rssi) : null;
          this.state.net.linkMbps = (info.linkMbps != null) ? Number(info.linkMbps) : null;
          this.state.net.hasInternet = !!(info.hasInternet != null ? info.hasInternet : info.internet);

          UI.setSignalUI({ type: this.state.net.type, rssi: this.state.net.rssi, hasInternet: this.state.net.hasInternet });
          UI.setLed(UI.els.ledNet, this.state.net.hasInternet ? "on" : "bad");
          this.updateQualityPanels();
          return;
        }

        const online = (navigator.onLine !== undefined) ? !!navigator.onLine : true;
        this.state.net.hasInternet = online;

        const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        let type = "other";
        let down = null;

        if (c) {
          type = c.type || c.effectiveType || "other";
          down = (c.downlink != null) ? Math.round(Number(c.downlink) * 1000) : null; // Mbps -> kbps
        }
        this.state.net.type = String(type).toLowerCase();
        this.state.net.downKbps = down != null ? down : this.state.net.downKbps;

        UI.setSignalUI({ type: this.state.net.type, rssi: this.state.net.rssi, hasInternet: this.state.net.hasInternet });
        this.updateQualityPanels();
      };

      tick();
      this.state.__netT = setInterval(tick, interval);
    },

    async doFetchPing(host) {
      const h = String(host || DEFAULT_PING_HOST).trim();
      if (!h) return -1;

      const n = AndroidBridge.tcpPingMs(h, 443, 1500);
      if (typeof n === "number" && n >= 0) return n;

      try {
        const url = "https://" + h + "/favicon.ico?x=" + now();
        const t0 = now();

        const controller = ("AbortController" in window) ? new AbortController() : null;
        const timer = setTimeout(() => { try { controller && controller.abort(); } catch (_) {} }, 1800);

        await fetch(url, { method: "HEAD", cache: "no-store", mode: "no-cors", signal: controller ? controller.signal : undefined });
        clearTimeout(timer);

        const dt = now() - t0;
        return dt > 0 ? dt : 1;
      } catch (_) {
        return -1;
      }
    },

    startPingMonitor(force = false) {
      const rate = this.state.settings.updateRate;
      const interval = (rate === "Low") ? 7000 : (rate === "High") ? 2000 : 3500;

      if (this.state.__pingT && !force) return;
      if (this.state.__pingT) clearInterval(this.state.__pingT);

      const tick = async () => {
        const ms = await this.doFetchPing(this.state.settings.pingHost || DEFAULT_PING_HOST);
        this.state.net.pingMs = ms;

        UI.setPing(ms);
        this.updateQualityPanels();

        if (UI.els.diagNoteTxt) safeText(UI.els.diagNoteTxt, ms < 0 ? "Ping: FAIL" : ("Ping: " + ms + "ms"));

        if (this.state.settings.autoClearLogs && UI.els.log) {
          try {
            const lines = UI.els.log.querySelectorAll(".logLine");
            if (lines.length > 200) {
              for (let i = 200; i < lines.length; i++) lines[i].remove();
            }
          } catch (_) {}
        }
      };

      tick();
      this.state.__pingT = setInterval(tick, interval);
    },

    // NEW: updates audioLevel from MicViz (for quality panel)
    startAudioMeter(force = false) {
      if (this.state.__audioT && !force) return;
      if (this.state.__audioT) clearInterval(this.state.__audioT);

      this.state.__audioT = setInterval(() => {
        const lvl = MicViz.level(); // 0..1
        // if mic muted, show lower (still allow heart animation if audio track gives low)
        this.state.net.audioLevel = this.state.micMuted ? 0 : lvl;
      }, 120);
    },

    refreshDiagnostics() {
      this.updateQualityPanels();
      return this.getDiagnosticsPack();
    },

    getDiagnosticsPack() {
      const n = this.state.net;
      return {
        netType: n.type,
        rssi: n.rssi,
        linkMbps: n.linkMbps,
        internet: n.hasInternet,
        ping: n.pingMs,
        jitter: n.jitterMs,
        loss: n.lossPct,
        up: n.upKbps,
        down: n.downKbps,
        audio: n.audioLevel,
        codec: "Opus",
        callLed: (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("on")) ? "ON" :
          (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("warn")) ? "WARN" :
          (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("bad")) ? "BAD" : "OFF"
      };
    },

    resetDiagnosticsLocal() {
      this.state.net.jitterMs = 0;
      this.state.net.lossPct = 0;
      this.state.net.upKbps = 0;
      this.state.net.downKbps = 0;
      this.state.net.audioLevel = 0;
      this.updateQualityPanels();
    },
  };

  /* =========================
     Part 25 — EXPORT API for inline HTML hooks
     ========================= */
  window.MDV_APP = {
    join: () => App.joinFlow(),
    leave: () => App.leaveFlow(),
    endCall: () => App.endCall(),

    acceptIncoming: () => App.acceptIncomingCall(),
    rejectIncoming: () => App.declineIncomingCall(),

    refreshDiagnostics: () => App.refreshDiagnostics(),
    resetDiagnostics: () => App.resetDiagnosticsLocal(),
    shareDiagnostics: () => {
      const text = JSON.stringify(App.getDiagnosticsPack());
      try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (_) {}
      AndroidBridge.copyToClipboard(text);
      Log.write("good", "DIAG COPIED");
      return text;
    },

    // Android-side functions
    volumeUp: () => AndroidBridge.volumeUp(),
    volumeDown: () => AndroidBridge.volumeDown(),
    volumeMuteToggle: () => AndroidBridge.volumeMuteToggle(),
    routeSpeaker: () => AndroidBridge.routeSpeaker(),
    routeEarpiece: () => AndroidBridge.routeEarpiece(),
    routeBluetooth: () => AndroidBridge.routeBluetooth(),

    detectAudio: () => AndroidBridge.detectAudio(),
    detectBluetooth: () => AndroidBridge.detectBluetooth(),
    refreshDevices: () => AndroidBridge.refreshDevices(),

    // UI helpers
    toggleDrawer: () => Drawer.toggle(),
    themeCycle: () => Theme.cycle(),
  };

  /* =========================
     Part 26 — BOOT
     ========================= */
  const boot = () => {
    try { App.init(); } catch (e) { try { console.error(e); } catch (_) {} }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();

/* =========================================================
   ملاحظة مهمة لإرجاع "مخطط القلب" (Mic Heart Monitor):
   - لازم يكون عندك في index.html عنصر:
       <canvas id="micWave" style="width:100%;height:56px;"></canvas>
   - JS فوق يدعم IDs بديلة، لكن الأفضل micWave.
   ========================================================= */
package com.example.minidiscordvoice;

import android.annotation.SuppressLint;
import android.app.KeyguardManager;
import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class CallActivity extends AppCompatActivity {

    private WebView webView;
    private AudioManager audioManager;
    private PowerManager.WakeLock wakeLock;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        showOnLockScreen();
        super.onCreate(savedInstanceState);
        
        // No layout file for this specific activity in user request, utilizing the same layout or creating a dynamic one?
        // User said "D) Layout ... activity_main.xml". I'll re-use activity_main or assume we just load the same webview but different state.
        // For simplicity and since we want the Web Interface to drive it, I'll set content view to a programmatic WebView or reuse activity_main
        // Reuse activity_main for simplicity as it contains the WebView
        setContentView(R.layout.activity_main); 
        
        webView = findViewById(R.id.webView);
        findViewById(R.id.adView).setVisibility(View.GONE); // Hide ads in call usually

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);

        // Add bridges
        webView.addJavascriptInterface(new CallInterface(this), "Android");
        webView.addJavascriptInterface(new CallInterface(this), "AndroidInterface"); // User requested both

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                boolean isCall = getIntent().getBooleanExtra("isCall", false);
                String channel = getIntent().getStringExtra("channelName");
                if (isCall && channel != null) {
                    // Inject JS to handle incoming call UI
                    view.loadUrl("javascript:handleIncomingCall('" + channel + "')");
                }
            }
        });

        webView.loadUrl("file:///android_asset/index.html");

        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "MDV:CallWakeLock");
    }

    private void showOnLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
    }

    @Override
    protected void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        setSpeakerphoneOn(false);
        super.onDestroy();
    }

    private void setSpeakerphoneOn(boolean on) {
        audioManager.setMode(on ? AudioManager.MODE_NORMAL : AudioManager.MODE_IN_COMMUNICATION);
        audioManager.setSpeakerphoneOn(on);
    }

    public class CallInterface {
        Context mContext;

        CallInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void routeSpeaker() {
            setSpeakerphoneOn(true);
        }

        @JavascriptInterface
        public void routeEarpiece() {
            setSpeakerphoneOn(false);
        }

        @JavascriptInterface
        public void routeBluetooth() {
            // Simplified bluetooth routing
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            audioManager.startBluetoothSco();
            audioManager.setBluetoothScoOn(true);
        }

        @JavascriptInterface
        public void volumeUp() {
            audioManager.adjustVolume(AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI);
        }

        @JavascriptInterface
        public void volumeDown() {
            audioManager.adjustVolume(AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI);
        }

        @JavascriptInterface
        public void volumeMuteToggle() {
             boolean muted = audioManager.isMicrophoneMute();
             audioManager.setMicrophoneMute(!muted);
        }

        @JavascriptInterface
        public void acceptIncoming() {
            runOnUiThread(() -> {
                if (!wakeLock.isHeld()) wakeLock.acquire(10*60*1000L /*10 mins*/);
                // JS will handle Agora join
            });
        }

        @JavascriptInterface
        public void rejectIncoming() {
            finish();
        }
        
        // Re-implement basic ones from MainActivity if needed by shared code
        @JavascriptInterface
        public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                v.vibrate(ms);
            }
        }
    }
}
// ==================================================
// CallActivity.kt
// FullScreen Call WebView Host (Samsung-ready) [REWRITE v3 - IDEAL]
// ✅ Samsung lock-screen: showWhenLocked + turnScreenOn + requestDismissKeyguard
// ✅ Call keep-alive: PARTIAL_WAKELOCK + (اختياري) WIFI_LOCK + ForegroundService ongoing notif
// ✅ WebView mic permission: onPermissionRequest + runtime RECORD_AUDIO
// ✅ Bridge ثابت: window.Android + window.AndroidInterface (لتفادي mismatch مع index.html)
// ✅ يدعم أزرار index.html v1:
//    routeSpeaker / routeEarpiece / routeBluetooth
//    volumeUp / volumeDown / volumeMuteToggle
//    detectAudio / detectBluetooth / refreshDevices / detectDevices (alias)
//    getNetworkInfoJson / tcpPingMs / getDiagnostics / shareDiagnostics
// ✅ Inject: channel/fromName/autoJoin + hook: window.onAndroidCallInvite(from, channel)
// ✅ Clear incoming call notification: NotificationHelper.cancelIncomingCall(ctx)
// ⚠️ ملاحظة Manifest (ضروري):
//   - RECORD_AUDIO permission
//   - (Android 9+) android.permission.FOREGROUND_SERVICE
//   - (Android 14+) قد تحتاج FOREGROUND_SERVICE_MICROPHONE حسب targetSdk
//   - CallKeepAliveService declare exported=false
// ==================================================
package com.example.minidiscordvoice

import android.Manifest
import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.InetSocketAddress
import java.net.Socket
import kotlin.math.max
import kotlin.math.min

class CallActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_OPEN_CALL = "extra_open_call"
        const val EXTRA_CHANNEL = "extra_channel"
        const val EXTRA_FROM_NAME = "extra_from_name"
        const val EXTRA_AUTO_JOIN = "extra_auto_join"

        private const val BRIDGE_ANDROID = "Android"
        private const val BRIDGE_ANDROID_INTERFACE = "AndroidInterface"

        // اختر واحد:
        // private const val DEFAULT_URL = "file:///android_asset/index.html"
        private const val DEFAULT_URL = "https://minidiscordvoice.web.app/"

        private const val WAKELOCK_TIMEOUT_MS = 3L * 60L * 60L * 1000L

        private const val REQ_RECORD_AUDIO = 8121

        fun buildStartIntent(ctx: Context, channel: String, fromName: String, autoJoin: Boolean): Intent {
            return Intent(ctx, CallActivity::class.java).apply {
                putExtra(EXTRA_OPEN_CALL, true)
                putExtra(EXTRA_CHANNEL, channel)
                putExtra(EXTRA_FROM_NAME, fromName)
                putExtra(EXTRA_AUTO_JOIN, autoJoin)
                addFlags(
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_NEW_TASK
                )
            }
        }
    }

    private lateinit var webView: WebView
    private lateinit var audioManager: AudioManager

    private var focusRequest: AudioFocusRequest? = null

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    private var pendingWebPermissionRequest: PermissionRequest? = null

    private var pageLoaded = false
    private var injectedOnce = false
    private var callActive = false

    private var currentChannel: String = ""
    private var currentFrom: String = ""
    private var currentAutoJoin: Boolean = false

    // ==================================================
    // Lifecycle
    // ==================================================
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

        if (savedInstanceState != null) {
            currentChannel = savedInstanceState.getString("ch", "") ?: ""
            currentFrom = savedInstanceState.getString("from", "") ?: ""
            currentAutoJoin = savedInstanceState.getBoolean("aj", false)
        } else {
            pullArgsFromIntent(intent)
        }

        setupLockScreenForSamsung()
        setupWakeLocks()

        val root = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        webView = WebView(this)
        root.addView(
            webView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        setContentView(root)

        configureWebView()

        webView.loadUrl(DEFAULT_URL)

        if (intent?.getBooleanExtra(EXTRA_OPEN_CALL, false) == true) {
            enterCallModeAndKeepAlive()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent == null) return
        setIntent(intent)
        pullArgsFromIntent(intent)

        if (pageLoaded) {
            injectCallParams(currentChannel, currentFrom, currentAutoJoin)
        }
        if (intent.getBooleanExtra(EXTRA_OPEN_CALL, false)) {
            enterCallModeAndKeepAlive()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString("ch", currentChannel)
        outState.putString("from", currentFrom)
        outState.putBoolean("aj", currentAutoJoin)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        exitCallModeAndStopKeepAlive()

        try { releaseWakeLocksSafe() } catch (_: Exception) {}
        try { pendingWebPermissionRequest?.deny() } catch (_: Exception) {}
        pendingWebPermissionRequest = null

        try {
            webView.removeJavascriptInterface(BRIDGE_ANDROID)
            webView.removeJavascriptInterface(BRIDGE_ANDROID_INTERFACE)
        } catch (_: Exception) {}

        try {
            webView.loadUrl("about:blank")
            webView.stopLoading()
            webView.destroy()
        } catch (_: Exception) {}

        super.onDestroy()
    }

    // ==================================================
    // WebView
    // ==================================================
    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val s = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = false

        s.allowFileAccess = true
        s.allowContentAccess = true
        s.allowFileAccessFromFileURLs = true
        s.allowUniversalAccessFromFileURLs = true

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        s.cacheMode = WebSettings.LOAD_DEFAULT
        s.userAgentString = "${s.userAgentString} MiniDiscordVoiceWebView"

        val bridge = WebAppBridge(this)
        webView.addJavascriptInterface(bridge, BRIDGE_ANDROID)
        webView.addJavascriptInterface(bridge, BRIDGE_ANDROID_INTERFACE)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                // WebRTC/Audio capture from WebView
                val wantsAudio = request.resources?.any { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE } == true
                if (!wantsAudio) {
                    try { request.grant(request.resources) } catch (_: Exception) { request.deny() }
                    return
                }

                val granted = ContextCompat.checkSelfPermission(
                    this@CallActivity,
                    Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED

                if (granted) {
                    try { request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) } catch (_: Exception) { request.deny() }
                    return
                }

                // طلب runtime permission ثم نكمل
                pendingWebPermissionRequest = request
                ActivityCompat.requestPermissions(
                    this@CallActivity,
                    arrayOf(Manifest.permission.RECORD_AUDIO),
                    REQ_RECORD_AUDIO
                )
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return try {
                    val u = request.url ?: return false
                    val scheme = (u.scheme ?: "").lowercase()
                    if (scheme == "https" || scheme == "http" || scheme == "file") return false
                    startActivity(Intent(Intent.ACTION_VIEW, u))
                    true
                } catch (_: Exception) {
                    false
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                pageLoaded = true

                // Hook احتياطي: MDV.finishCall
                safeEvalJs(
                    """
                    (function(){
                      try{
                        window.MDV = window.MDV || {};
                        window.MDV.finishCall = function(){
                          try{ if(window.Android && Android.finishCall) Android.finishCall(); }catch(e){}
                          try{ if(window.AndroidInterface && AndroidInterface.finishCall) AndroidInterface.finishCall(); }catch(e){}
                        };
                      }catch(e){}
                    })();
                    """.trimIndent()
                )

                if (!injectedOnce) {
                    injectedOnce = true
                    injectCallParams(currentChannel, currentFrom, currentAutoJoin)
                }
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode != REQ_RECORD_AUDIO) return

        val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
        val req = pendingWebPermissionRequest
        pendingWebPermissionRequest = null

        try {
            if (granted && req != null) {
                req.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            } else {
                req?.deny()
                Toast.makeText(this, "Microphone permission denied", Toast.LENGTH_SHORT).show()
            }
        } catch (_: Exception) {
        }
    }

    // ==================================================
    // Args
    // ==================================================
    private fun pullArgsFromIntent(i: Intent?) {
        currentChannel = i?.getStringExtra(EXTRA_CHANNEL).orEmpty().trim()
        currentFrom = i?.getStringExtra(EXTRA_FROM_NAME).orEmpty().trim()
        currentAutoJoin = i?.getBooleanExtra(EXTRA_AUTO_JOIN, false) == true
    }

    // ==================================================
    // Samsung lock-screen behavior
    // ==================================================
    private fun setupLockScreenForSamsung() {
        try {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true)
                setTurnScreenOn(true)
            } else {
                @Suppress("DEPRECATION")
                window.addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                )
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
                km.requestDismissKeyguard(this, null)
            }
        } catch (_: Exception) {
        }
    }

    // ==================================================
    // Injection to Web
    // ==================================================
    private fun injectCallParams(channel: String, fromName: String, autoJoin: Boolean) {
        if (!pageLoaded) return

        val ch = JSONObject.quote(channel)
        val from = JSONObject.quote(fromName)
        val aj = if (autoJoin) "true" else "false"

        val js = """
          (function(){
            try{
              var ch=$ch, from=$from, aj=$aj;

              var inCh=document.getElementById('channel');
              if(inCh && ch){
                inCh.value=ch;
                try{ inCh.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
              }

              if(window.onAndroidCallInvite){
                try{ window.onAndroidCallInvite(from, ch); }catch(e){}
              }

              if(window.onAndroidIncomingCall){
                try{ window.onAndroidIncomingCall({channel:ch, fromName:from, autoJoin:aj}); }catch(e){}
              }

              if(aj){
                var j=document.getElementById('joinBtn');
                if(j) j.click();
              }
            }catch(e){ try{console.error(e);}catch(_e){} }
          })();
        """.trimIndent()

        safeEvalJs(js)
    }

    private fun safeEvalJs(js: String) {
        try {
            webView.post {
                try { webView.evaluateJavascript(js, null) } catch (_: Exception) {}
            }
        } catch (_: Exception) {
        }
    }

    // ==================================================
    // KeepAlive: WakeLocks + ForegroundService
    // ==================================================
    private fun setupWakeLocks() {
        try {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MiniDiscordVoice:CallCPU")
        } catch (_: Exception) {
            wakeLock = null
        }

        try {
            val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            @Suppress("DEPRECATION")
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MiniDiscordVoice:CallWiFi")
        } catch (_: Exception) {
            wifiLock = null
        }
    }

    private fun acquireWakeLocksSafe() {
        try {
            val wl = wakeLock
            if (wl != null && !wl.isHeld) wl.acquire(WAKELOCK_TIMEOUT_MS)
        } catch (_: Exception) {}

        try {
            if (isOnWifi()) {
                val w = wifiLock
                if (w != null && !w.isHeld) w.acquire()
            }
        } catch (_: Exception) {}
    }

    private fun releaseWakeLocksSafe() {
        try {
            val wl = wakeLock
            if (wl != null && wl.isHeld) wl.release()
        } catch (_: Exception) {}

        try {
            val w = wifiLock
            if (w != null && w.isHeld) w.release()
        } catch (_: Exception) {}
    }

    private fun enterCallModeAndKeepAlive() {
        if (callActive) return
        callActive = true

        requestAudioFocus()
        acquireWakeLocksSafe()

        // ✅ أول ما ندخل شاشة المكالمة: الغِ إشعار المكالمة الواردة
        try { NotificationHelper.cancelIncomingCall(this) } catch (_: Exception) {}

        // ✅ شغّل ForegroundService (مهم لسامسونج عند إطفاء الشاشة)
        try {
            val svc = Intent(this, CallKeepAliveService::class.java).apply {
                putExtra("ch", currentChannel)
                putExtra("from", currentFrom)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(svc) else startService(svc)
        } catch (_: Exception) {}
    }

    private fun exitCallModeAndStopKeepAlive() {
        if (!callActive) return
        callActive = false

        try { stopService(Intent(this, CallKeepAliveService::class.java)) } catch (_: Exception) {}
        abandonAudioFocus()
        try { releaseWakeLocksSafe() } catch (_: Exception) {}
    }

    // ==================================================
    // Audio focus + routing helpers
    // ==================================================
    private fun requestAudioFocus() {
        try {
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val afr = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                    .setOnAudioFocusChangeListener { /* ignore */ }
                    .build()
                focusRequest = afr
                audioManager.requestAudioFocus(afr)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            }
        } catch (_: Exception) {}
    }

    private fun abandonAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
                focusRequest = null
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (_: Exception) {}

        try { audioManager.mode = AudioManager.MODE_NORMAL } catch (_: Exception) {}

        // Android 12+: رجّع الـ routing للوضع الطبيعي
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try { audioManager.clearCommunicationDevice() } catch (_: Exception) {}
        }
    }

    private fun routeSpeaker() {
        try {
            stopBluetoothScoCompat()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try { audioManager.clearCommunicationDevice() } catch (_: Exception) {}
            }
            audioManager.isSpeakerphoneOn = true
        } catch (_: Exception) {}
    }

    private fun routeEarpiece() {
        try {
            stopBluetoothScoCompat()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try { audioManager.clearCommunicationDevice() } catch (_: Exception) {}
            }
            audioManager.isSpeakerphoneOn = false
        } catch (_: Exception) {}
    }

    private fun routeBluetooth() {
        val ok = trySetCommunicationDeviceBluetooth()
        if (!ok) {
            try {
                audioManager.isSpeakerphoneOn = false
                startBluetoothScoCompat()
            } catch (_: Exception) {}
        }
    }

    private fun trySetCommunicationDeviceBluetooth(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return false
        return try {
            val devices = audioManager.availableCommunicationDevices
            val bt = devices.firstOrNull {
                it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
            }
            if (bt != null) audioManager.setCommunicationDevice(bt) else false
        } catch (_: Exception) {
            false
        }
    }

    private fun startBluetoothScoCompat() {
        try {
            @Suppress("DEPRECATION")
            audioManager.startBluetoothSco()
            @Suppress("DEPRECATION")
            audioManager.isBluetoothScoOn = true
        } catch (_: Exception) {}
    }

    private fun stopBluetoothScoCompat() {
        try {
            @Suppress("DEPRECATION")
            audioManager.isBluetoothScoOn = false
            @Suppress("DEPRECATION")
            audioManager.stopBluetoothSco()
        } catch (_: Exception) {}
    }

    private fun volumeUp() {
        try {
            audioManager.adjustStreamVolume(
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.ADJUST_RAISE,
                AudioManager.FLAG_SHOW_UI
            )
        } catch (_: Exception) {
            try { audioManager.adjustVolume(AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI) } catch (_2: Exception) {}
        }
    }

    private fun volumeDown() {
        try {
            audioManager.adjustStreamVolume(
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.ADJUST_LOWER,
                AudioManager.FLAG_SHOW_UI
            )
        } catch (_: Exception) {
            try { audioManager.adjustVolume(AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI) } catch (_2: Exception) {}
        }
    }

    private fun volumeMuteToggle() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val muted = audioManager.isStreamMute(AudioManager.STREAM_VOICE_CALL)
                @Suppress("DEPRECATION")
                audioManager.adjustStreamVolume(
                    AudioManager.STREAM_VOICE_CALL,
                    if (muted) AudioManager.ADJUST_UNMUTE else AudioManager.ADJUST_MUTE,
                    0
                )
            } else {
                @Suppress("DEPRECATION")
                audioManager.setStreamMute(AudioManager.STREAM_VOICE_CALL, true)
            }
        } catch (_: Exception) {}
    }

    private fun isOnWifi(): Boolean {
        return try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val net = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(net) ?: return false
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
        } catch (_: Exception) {
            false
        }
    }

    // ==================================================
    // Bridge: window.Android / window.AndroidInterface
    // ==================================================
    class WebAppBridge(private val activity: CallActivity) {
        private val appCtx = activity.applicationContext

        // --- Call control ---
        @JavascriptInterface
        fun setCallMode(active: Boolean) {
            activity.runOnUiThread {
                try {
                    if (active) activity.enterCallModeAndKeepAlive()
                    else activity.exitCallModeAndStopKeepAlive()
                } catch (_: Exception) {}
            }
        }

        @JavascriptInterface fun endCall() = finishCall()

        @JavascriptInterface
        fun finishCall() {
            activity.runOnUiThread {
                try { activity.exitCallModeAndStopKeepAlive() } catch (_: Exception) {}
                try { activity.finish() } catch (_: Exception) {}
            }
        }

        // --- Incoming actions ---
        @JavascriptInterface
        fun acceptIncoming() {
            activity.runOnUiThread {
                try { NotificationHelper.cancelIncomingCall(activity) } catch (_: Exception) {}
                try {
                    activity.enterCallModeAndKeepAlive()
                    activity.safeEvalJs(
                        """
                        (function(){
                          try{ var j=document.getElementById('joinBtn'); if(j) j.click(); }catch(e){}
                        })();
                        """.trimIndent()
                    )
                } catch (_: Exception) {}
            }
        }

        @JavascriptInterface
        fun rejectIncoming() {
            activity.runOnUiThread {
                try { NotificationHelper.cancelIncomingCall(activity) } catch (_: Exception) {}
                try { activity.finish() } catch (_: Exception) {}
            }
        }

        @JavascriptInterface
        fun clearCallNotification() {
            activity.runOnUiThread {
                try { NotificationHelper.cancelIncomingCall(activity) } catch (_: Exception) {}
            }
        }

        // --- Routes ---
        @JavascriptInterface fun setSpeaker(on: Boolean) {
            activity.runOnUiThread { try { activity.audioManager.isSpeakerphoneOn = on } catch (_: Exception) {} }
        }

        @JavascriptInterface fun routeSpeaker() { activity.runOnUiThread { activity.routeSpeaker() } }
        @JavascriptInterface fun routeEarpiece() { activity.runOnUiThread { activity.routeEarpiece() } }
        @JavascriptInterface fun routeBluetooth() { activity.runOnUiThread { activity.routeBluetooth() } }

        // --- Volume ---
        @JavascriptInterface fun volumeUp() { activity.runOnUiThread { activity.volumeUp() } }
        @JavascriptInterface fun volumeDown() { activity.runOnUiThread { activity.volumeDown() } }
        @JavascriptInterface fun volumeMuteToggle() { activity.runOnUiThread { activity.volumeMuteToggle() } }

        // --- Vibrate ---
        @JavascriptInterface
        fun vibrate(ms: Int) {
            val dur = max(10, min(ms, 3000))
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vm = appCtx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                    vm.defaultVibrator.vibrate(
                        VibrationEffect.createOneShot(dur.toLong(), VibrationEffect.DEFAULT_AMPLITUDE)
                    )
                } else {
                    @Suppress("DEPRECATION")
                    val v = appCtx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(dur.toLong(), VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        @Suppress("DEPRECATION")
                        v.vibrate(dur.toLong())
                    }
                }
            } catch (_: Exception) {}
        }

        // --- Clipboard ---
        @JavascriptInterface
        fun copyToClipboard(text: String?) {
            activity.runOnUiThread {
                try {
                    val cm = appCtx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("text", text ?: ""))
                    Toast.makeText(activity, "✅ Copied", Toast.LENGTH_SHORT).show()
                } catch (_: Exception) {}
            }
        }

        // --- Battery ---
        @JavascriptInterface
        fun getBatteryLevel(): Int {
            return try {
                val bm = appCtx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
                bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            } catch (_: Exception) { 50 }
        }

        // --- Network / Ping ---
        @JavascriptInterface fun getNetworkInfoJson(): String = activity.getNetworkInfoJsonInternal()

        @JavascriptInterface
        fun tcpPingMs(host: String?, port: Int, timeoutMs: Int): Int {
            val t0 = System.currentTimeMillis()
            return try {
                val h = (host ?: "").trim().ifBlank { "google.com" }
                val p = if (port > 0) port else 443
                val t = if (timeoutMs > 0) timeoutMs else 1500
                Socket().use { s -> s.connect(InetSocketAddress(h, p), t) }
                (System.currentTimeMillis() - t0).toInt()
            } catch (_: Exception) { -1 }
        }

        // --- Devices detection ---
        @JavascriptInterface fun detectAudio(): String = activity.dumpAudioDevicesJson()
        @JavascriptInterface fun detectBluetooth(): String = activity.dumpBluetoothDevicesJson()

        @JavascriptInterface
        fun refreshDevices(): String {
            val a = try { JSONObject(detectAudio()) } catch (_: Exception) { JSONObject() }
            val b = try { JSONObject(detectBluetooth()) } catch (_: Exception) { JSONObject() }
            return JSONObject().apply {
                put("audio", a)
                put("bluetooth", b)
            }.toString()
        }

        // alias for some UIs
        @JavascriptInterface fun detectDevices(): String = refreshDevices()

        // --- Diagnostics ---
        @JavascriptInterface fun getDiagnostics(): String = activity.getDiagnosticsJsonInternal()

        @JavascriptInterface
        fun shareDiagnostics() {
            activity.runOnUiThread {
                try {
                    val text = activity.getDiagnosticsJsonInternal()
                    val it = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, text)
                    }
                    activity.startActivity(Intent.createChooser(it, "Share diagnostics"))
                } catch (_: Exception) {}
            }
        }
    }

    // ==================================================
    // Network/Diagnostics helpers
    // ==================================================
    private fun getNetworkInfoJsonInternal(): String {
        return try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val net = cm.activeNetwork
            val caps = cm.getNetworkCapabilities(net)

            val hasInternet = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
            val validated = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true

            val isWifi = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
            val isCell = caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true

            var rssi = 0
            var linkMbps = 0
            if (isWifi) {
                val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                val wi: WifiInfo? = wm.connectionInfo
                if (wi != null) {
                    rssi = wi.rssi
                    linkMbps = wi.linkSpeed
                }
            }

            JSONObject().apply {
                put("type", if (isWifi) "wifi" else if (isCell) "cell" else "none")
                put("hasInternet", hasInternet)
                put("validated", validated)
                put("rssi", rssi)
                put("linkMbps", linkMbps)
            }.toString()
        } catch (_: Exception) {
            "{\"type\":\"none\",\"hasInternet\":false}"
        }
    }

    private fun getDiagnosticsJsonInternal(): String {
        val net = try { JSONObject(getNetworkInfoJsonInternal()) } catch (_: Exception) { JSONObject() }
        return JSONObject().apply {
            put("netType", net.optString("type", "none"))
            put("rssi", net.optInt("rssi", 0))
            put("linkMbps", net.optInt("linkMbps", 0))
            put("internet", net.optBoolean("hasInternet", false))
        }.toString()
    }

    private fun dumpAudioDevicesJson(): String {
        return try {
            val outs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            val arr = JSONArray()
            for (d in outs) {
                arr.put(
                    JSONObject().apply {
                        put("type", d.type)
                        put("product", d.productName?.toString() ?: "")
                        put("isSink", d.isSink)
                    }
                )
            }
            JSONObject().apply { put("outputs", arr) }.toString()
        } catch (_: Exception) {
            "{\"outputs\":[]}"
        }
    }

    private fun dumpBluetoothDevicesJson(): String {
        return try {
            val outs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            val arr = JSONArray()
            for (d in outs) {
                val isBt = (d.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || d.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP)
                if (isBt) {
                    arr.put(
                        JSONObject().apply {
                            put("type", d.type)
                            put("product", d.productName?.toString() ?: "")
                        }
                    )
                }
            }
            JSONObject().apply { put("bluetooth", arr) }.toString()
        } catch (_: Exception) {
            "{\"bluetooth\":[]}"
        }
    }
}

// ==================================================
// CallKeepAliveService (Top-level) — Samsung helper
// ✅ يبقي المكالمة “حية” عندما الشاشة تطفي عبر ForegroundService
// ==================================================
class CallKeepAliveService : Service() {

    companion object {
        private const val KEEPALIVE_CHANNEL_ID = "mdv_active_call"
        private const val KEEPALIVE_NOTIF_ID = 99011
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
    }

    @SuppressLint("ForegroundServiceType")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val ch = intent?.getStringExtra("ch").orEmpty()
        val from = intent?.getStringExtra("from").orEmpty()

        val open = CallActivity.buildStartIntent(this, ch, from, autoJoin = false)
        val pi = PendingIntent.getActivity(
            this,
            9001,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notif = NotificationCompat.Builder(this, KEEPALIVE_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle("Call in progress")
            .setContentText(
                when {
                    ch.isNotBlank() && from.isNotBlank() -> "From: $from • Channel: $ch"
                    ch.isNotBlank() -> "Channel: $ch"
                    else -> "Active call"
                }
            )
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pi)
            .build()

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(KEEPALIVE_NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            } else {
                startForeground(KEEPALIVE_NOTIF_ID, notif)
            }
        } catch (_: SecurityException) {
            // لو POST_NOTIFICATIONS غير مسموح أو قيود جهاز: نوقف الخدمة بدل crash
            stopSelf()
        } catch (_: Exception) {
            stopSelf()
        }

        return START_STICKY
    }

    override fun onDestroy() {
        try { stopForeground(STOP_FOREGROUND_REMOVE) } catch (_: Exception) {}
        super.onDestroy()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(
                KEEPALIVE_CHANNEL_ID,
                "Active Call",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps the call alive while screen is off (Samsung helper)"
                setSound(null, null)
                enableVibration(false)
            }
            nm.createNotificationChannel(ch)
        } catch (_: Exception) {
        }
    }
}
// ==================================================
// SplashActivity.kt
// (Part 1/1) — Router Activity (Notification Call / Normal Launch)
// ✅ يمنع تكرار الفتح عند إعادة إنشاء الـ Activity
// ✅ يوجّه إلى CallActivity عند فتح من إشعار مكالمة
// ✅ يوجّه إلى MainActivity في الحالات الأخرى
// ==================================================
package com.example.minidiscordvoice

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // ==================================================
        // منع تكرار فتح الشاشات لو النظام أعاد إنشاء الـ Activity
        // (يحمي من double-launch خصوصاً مع الإشعارات)
        // ==================================================
        if (savedInstanceState != null) {
            finish()
            return
        }

        // ==================================================
        // قراءة بيانات الإشعار/الفتح
        // ==================================================
        val openCall = intent?.getBooleanExtra(CallActivity.EXTRA_OPEN_CALL, false) == true
        val channel = intent?.getStringExtra(CallActivity.EXTRA_CHANNEL)
        val fromName = intent?.getStringExtra(CallActivity.EXTRA_FROM_NAME)
        val autoJoin = intent?.getBooleanExtra(CallActivity.EXTRA_AUTO_JOIN, false) == true

        // ==================================================
        // التوجيه: CallActivity إذا إشعار مكالمة، غير كذا MainActivity
        // ==================================================
        val nextIntent = if (openCall) {
            Intent(this, CallActivity::class.java).apply {
                putExtra(CallActivity.EXTRA_OPEN_CALL, true)

                if (!channel.isNullOrBlank()) {
                    putExtra(CallActivity.EXTRA_CHANNEL, channel)
                }
                if (!fromName.isNullOrBlank()) {
                    putExtra(CallActivity.EXTRA_FROM_NAME, fromName)
                }

                putExtra(CallActivity.EXTRA_AUTO_JOIN, autoJoin)

                // يحافظ على سلوك “Top” لو التطبيق مفتوح
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
        } else {
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
        }

        // ==================================================
        // تنفيذ الانتقال
        // ==================================================
        startActivity(nextIntent)
        finish()
    }
}
// ==================================================
// NotificationHelper.kt
// Samsung-ready Notifications (Basic + Incoming Call) [REWRITE v2]
// ✅ قنوات (Android 8+): mdv_basic + mdv_calls
// ✅ Guard: POST_NOTIFICATIONS (Android 13+) + areNotificationsEnabled()
// ✅ Basic: BigText + HIGH
// ✅ Incoming Call (Samsung-friendly):
//    - Category CALL + PRIORITY_MAX (pre-O) + Channel IMPORTANCE_HIGH (O+)
//    - FullScreenIntent -> SplashActivity (يروح لـ CallActivity عبر Router)
//    - Public visibility on lockscreen
//    - Ringtone usage + vibration pattern (pre-O) + channel sound (O+)
//    - Auto-timeout (مثل رنة مكالمة) لتفادي إشعار عالق
// ✅ Cancel helpers (incoming call fixed ID)
// ==================================================
package com.example.minidiscordvoice

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import kotlin.random.Random

object NotificationHelper {

    // =========================
    // Channel IDs
    // =========================
    private const val CH_BASIC = "mdv_basic"
    private const val CH_CALLS = "mdv_calls"

    private const val CH_BASIC_NAME = "General Notifications"
    private const val CH_BASIC_DESC = "App updates and messages"

    private const val CH_CALLS_NAME = "Incoming Calls"
    private const val CH_CALLS_DESC = "Alerts when someone calls you"

    // =========================
    // Request codes + IDs
    // =========================
    private const val REQ_OPEN_APP = 7002
    private const val REQ_OPEN_CALL = 7001

    // إشعار مكالمة واردة ثابت (حتى ما تتراكم إشعارات)
    private const val INCOMING_CALL_NOTIFICATION_ID = 90901

    // Timeout للإشعار الوارد (مثل مكالمة: 45 ثانية)
    private const val INCOMING_TIMEOUT_MS = 45_000L

    // Vibrate pattern (pre-O) — بسيط
    private val CALL_VIBRATE_PATTERN = longArrayOf(0, 300, 250, 300, 250, 300)

    // =========================
    // Public API — Basic
    // =========================
    fun showBasic(ctx: Context, title: String, body: String) {
        ensureChannels(ctx)
        if (!canPostNotifications(ctx)) return
        if (!areNotificationsEnabled(ctx)) return

        val safeTitle = title.ifBlank { "Notification" }
        val safeBody = body.ifBlank { " " }

        val openPi = buildOpenAppPendingIntent(ctx)

        val n = NotificationCompat.Builder(ctx, CH_BASIC)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(safeTitle)
            .setContentText(safeBody)
            .setStyle(NotificationCompat.BigTextStyle().bigText(safeBody))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH) // pre-O
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis())
            .setContentIntent(openPi)
            .build()

        val id = generateId()
        try {
            NotificationManagerCompat.from(ctx).notify(id, n)
        } catch (_: SecurityException) {
        } catch (_: Exception) {
        }
    }

    // =========================
    // Public API — Incoming Call (FullScreen)
    // =========================
    fun showIncomingCall(
        ctx: Context,
        fromName: String,
        channel: String,
        autoJoin: Boolean = false
    ) {
        ensureChannels(ctx)
        if (!canPostNotifications(ctx)) return
        if (!areNotificationsEnabled(ctx)) return

        val safeFrom = fromName.ifBlank { "Unknown" }
        val safeChannel = channel.ifBlank { "—" }

        // يمر عبر SplashActivity لأنها Router عندك (Samsung + cold start friendly)
        val openIntent = Intent(ctx, SplashActivity::class.java).apply {
            putExtra(CallActivity.EXTRA_OPEN_CALL, true)
            putExtra(CallActivity.EXTRA_FROM_NAME, safeFrom)
            putExtra(CallActivity.EXTRA_CHANNEL, safeChannel)
            putExtra(CallActivity.EXTRA_AUTO_JOIN, autoJoin)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
            )
        }

        val fullScreenPi = PendingIntent.getActivity(
            ctx,
            REQ_OPEN_CALL,
            openIntent,
            pendingIntentFlags()
        )

        val builder = NotificationCompat.Builder(ctx, CH_CALLS)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle("📞 مكالمة واردة")
            .setContentText("من: $safeFrom • قناة: $safeChannel")
            .setStyle(
                NotificationCompat.BigTextStyle().bigText(
                    "مكالمة واردة\nمن: $safeFrom\nالقناة: $safeChannel"
                )
            )
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_MAX) // pre-O
            .setWhen(System.currentTimeMillis())
            .setShowWhen(true)
            .setAutoCancel(true)
            .setOngoing(false)
            .setOnlyAlertOnce(true)
            .setTimeoutAfter(INCOMING_TIMEOUT_MS)
            .setContentIntent(fullScreenPi)
            .setFullScreenIntent(fullScreenPi, true)

        // إعدادات الصوت/الاهتزاز لـ pre-O فقط (O+ يتحكم فيه الـ Channel)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            try {
                val soundUri = Settings.System.DEFAULT_RINGTONE_URI
                builder.setSound(soundUri)
                builder.setVibrate(CALL_VIBRATE_PATTERN)
            } catch (_: Exception) {
            }
        }

        val n = builder.build()

        try {
            NotificationManagerCompat.from(ctx).notify(INCOMING_CALL_NOTIFICATION_ID, n)
        } catch (_: SecurityException) {
        } catch (_: Exception) {
        }
    }

    // =========================
    // Public API — Cancel helpers
    // =========================
    fun cancel(ctx: Context, id: Int) {
        try {
            NotificationManagerCompat.from(ctx).cancel(id)
        } catch (_: Exception) {
        }
    }

    fun cancelIncomingCall(ctx: Context) {
        cancel(ctx, INCOMING_CALL_NOTIFICATION_ID)
    }

    fun cancelAll(ctx: Context) {
        try {
            NotificationManagerCompat.from(ctx).cancelAll()
        } catch (_: Exception) {
        }
    }

    // =========================
    // Guards
    // =========================
    private fun canPostNotifications(ctx: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            ctx,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun areNotificationsEnabled(ctx: Context): Boolean {
        return try {
            NotificationManagerCompat.from(ctx).areNotificationsEnabled()
        } catch (_: Exception) {
            false
        }
    }

    // =========================
    // Channels (Android 8+)
    // =========================
    private fun ensureChannels(ctx: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        // BASIC
        if (nm.getNotificationChannel(CH_BASIC) == null) {
            val basic = NotificationChannel(
                CH_BASIC,
                CH_BASIC_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CH_BASIC_DESC
                enableVibration(true)
            }
            nm.createNotificationChannel(basic)
        }

        // CALLS
        if (nm.getNotificationChannel(CH_CALLS) == null) {
            val calls = NotificationChannel(
                CH_CALLS,
                CH_CALLS_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CH_CALLS_DESC
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                enableVibration(true)
                vibrationPattern = CALL_VIBRATE_PATTERN

                // Samsung-friendly: رنة مكالمة (Channel sound)
                try {
                    val soundUri = Settings.System.DEFAULT_RINGTONE_URI
                    val attrs = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                    setSound(soundUri, attrs)
                } catch (_: Exception) {
                }

                // (اختياري) يسمح بتجاوز DND لو المستخدم فعّله من الإعدادات
                try {
                    setBypassDnd(true)
                } catch (_: Exception) {
                }
            }
            nm.createNotificationChannel(calls)
        }
    }

    // =========================
    // PendingIntent flags
    // =========================
    private fun pendingIntentFlags(): Int {
        val base = PendingIntent.FLAG_UPDATE_CURRENT
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            base or PendingIntent.FLAG_IMMUTABLE
        } else {
            base
        }
    }

    // =========================
    // PendingIntent: open app
    // =========================
    private fun buildOpenAppPendingIntent(ctx: Context): PendingIntent {
        val i = Intent(ctx, SplashActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
            )
        }
        return PendingIntent.getActivity(ctx, REQ_OPEN_APP, i, pendingIntentFlags())
    }

    // =========================
    // ID generator
    // =========================
    private fun generateId(): Int {
        return try {
            (System.currentTimeMillis() % 100000).toInt()
        } catch (_: Exception) {
            Random.nextInt(10000, 99999)
        }
    }
}
// ==================================================
// MyFirebaseMessagingService.kt
// Samsung-ready FCM Receiver (Incoming Call + Basic) [REWRITE v2]
// ✅ يدعم:
//   - data.type="call"  -> إشعار مكالمة (FullScreen) عبر NotificationHelper
//   - غير ذلك           -> إشعار عادي (Basic) عبر NotificationHelper
// ✅ يحترم guards داخل NotificationHelper (POST_NOTIFICATIONS + areNotificationsEnabled)
// ✅ Samsung/Doze:
//   - يعتمد على "data message" قدر الإمكان (message.data) عشان يصل حتى لو التطبيق بالخلفية
// ✅ يمرر Extras (channel/fromName/autoJoin) إلى SplashActivity (Router)
// ==================================================
package com.example.minidiscordvoice

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "MDV_FCM"

        // Keys متوقعة في الـ data payload
        private const val K_TYPE = "type"
        private const val K_CHANNEL = "channel"
        private const val K_FROM_NAME = "fromName"
        private const val K_FROM = "from"
        private const val K_AUTO_JOIN = "autoJoin"
        private const val K_TITLE = "title"
        private const val K_BODY = "body"
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val data: Map<String, String> = try { message.data } catch (_: Exception) { emptyMap() }

        // ✅ Prefer data["type"] first (أفضل للمكالمات)
        val typeRaw = (data[K_TYPE] ?: message.notification?.title ?: "").trim()
        val type = typeRaw.lowercase()

        if (type == "call") {
            handleIncomingCall(data)
            return
        }

        // أي شيء آخر -> Basic
        val title = message.notification?.title
            ?: data[K_TITLE]
            ?: "MiniDiscordVoice"

        val body = message.notification?.body
            ?: data[K_BODY]
            ?: "New message"

        NotificationHelper.showBasic(this, title, body)
    }

    private fun handleIncomingCall(data: Map<String, String>) {
        val channel = (data[K_CHANNEL] ?: "").trim()
        val fromName = (data[K_FROM_NAME] ?: data[K_FROM] ?: "Unknown").trim()

        // ✅ default: false (حسب ملاحظاتك بسامسونج: نعرض إشعار المكالمة أولاً ثم قبول)
        val autoJoin = parseBool(data[K_AUTO_JOIN], defaultValue = false)

        if (channel.isBlank()) {
            Log.w(TAG, "Call push received but channel is empty")
            NotificationHelper.showBasic(
                this,
                "Incoming call",
                "Missing channel in push payload"
            )
            return
        }

        NotificationHelper.showIncomingCall(
            ctx = this,
            fromName = fromName.ifBlank { "Unknown" },
            channel = channel,
            autoJoin = autoJoin
        )

        Log.d(TAG, "Incoming call notified: from=$fromName channel=$channel autoJoin=$autoJoin")
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)

        // ✅ مبدئياً نسجل فقط (لو عندك Firestore/Backend لاحقاً نربطه)
        Log.d(TAG, "FCM token updated: $token")
    }

    private fun parseBool(value: String?, defaultValue: Boolean): Boolean {
        if (value == null) return defaultValue
        val v = value.trim().lowercase()
        if (v.isBlank()) return defaultValue
        return (v == "1" || v == "true" || v == "yes" || v == "y" || v == "on")
    }
}
package com.example.minidiscordvoice;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.Toast;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.SignInButton;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;

import org.json.JSONObject;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MiniDiscordVoice";

    // ✅ Web Client ID (حسب مشروعك)
    private static final String WEB_CLIENT_ID =
            "1073341648468-i887cvrmk39s4kr56esm65md1s07stjv.apps.googleusercontent.com";

    // Notifications
    private static final String NOTIF_CHANNEL_ID = "calls_channel";
    private static final int NOTIF_ID_CALL = 2001;

    // WakeLock timeout (3 hours)
    private static final long WAKELOCK_TIMEOUT_MS = 3L * 60L * 60L * 1000L;

    // ✅ AdMob (لا تغيّر)
    private static final String AD_UNIT_REWARDED = "ca-app-pub-3940256099942544/5224354917";
    private static final String AD_UNIT_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712";

    // UI
    private WebView webView;
    private SignInButton signInButton; // زر احتياطي (Native)
    private Button reloadBtn;          // اختياري لو موجود في layout

    // Auth
    private FirebaseAuth mAuth;
    private GoogleSignInClient mGoogleSignInClient;

    // Ads
    private InterstitialAd mInterstitialAd;
    private RewardedAd mRewardedAd;

    // Audio/Power
    private AudioManager audioManager;
    private PowerManager.WakeLock wakeLock;
    private AudioFocusRequest audioFocusRequest;
    private boolean hasAudioFocus = false;

    // Status
    private boolean isStartupAdShown = false;
    private boolean pageLoaded = false;
    private boolean inCall = false;

    // Web permissions
    private PermissionRequest pendingWebPermissionRequest = null;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // Launchers
    private ActivityResultLauncher<String[]> permLauncher;
    private ActivityResultLauncher<Intent> signInLauncher;

    // =========================================================
    // Lifecycle
    // =========================================================
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initLaunchers();

        setupAudioAndPower();
        createNotificationChannel();

        setupAds();       // ✅ لا تغييرات بالإعلانات
        setupGoogleAuth();
        setupWebView();

        requestNeededPermissions();
    }

    @Override
    protected void onStart() {
        super.onStart();
        updateUI(mAuth != null ? mAuth.getCurrentUser() : null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        try {
            if (!inCall && wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();

        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {}

        try {
            if (hasAudioFocus) abandonAudioFocus();
        } catch (Exception ignored) {}

        try {
            if (webView != null) {
                webView.removeJavascriptInterface("Android");
                webView.destroy();
            }
        } catch (Exception ignored) {}
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    // =========================================================
    // ✅ Launchers init
    // =========================================================
    private void initLaunchers() {

        permLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestMultiplePermissions(),
                new ActivityResultCallback<Map<String, Boolean>>() {
                    @Override
                    public void onActivityResult(Map<String, Boolean> result) {

                        boolean micGranted =
                                ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                                        == PackageManager.PERMISSION_GRANTED;

                        // لو الويب كان طالب مايك ووافق المستخدم -> امنح الويب
                        if (micGranted && pendingWebPermissionRequest != null) {
                            try {
                                List<String> granted = new ArrayList<>();
                                String[] req = pendingWebPermissionRequest.getResources();
                                for (String r : req) {
                                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                                        granted.add(r);
                                    }
                                }
                                if (!granted.isEmpty()) {
                                    pendingWebPermissionRequest.grant(granted.toArray(new String[0]));
                                } else {
                                    pendingWebPermissionRequest.grant(req);
                                }
                            } catch (Exception e) {
                                Log.w(TAG, "Failed to grant pending web permission", e);
                            }
                        }

                        pendingWebPermissionRequest = null;
                    }
                }
        );

        signInLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                new ActivityResultCallback<ActivityResult>() {
                    @Override
                    public void onActivityResult(ActivityResult res) {
                        try {
                            Intent data = res.getData();
                            Task<GoogleSignInAccount> task =
                                    GoogleSignIn.getSignedInAccountFromIntent(data);

                            GoogleSignInAccount account = task.getResult(ApiException.class);
                            if (account != null) {
                                firebaseAuthWithGoogle(account.getIdToken());
                            } else {
                                throw new Exception("Google account is null");
                            }
                        } catch (Exception e) {
                            Log.w(TAG, "Google sign-in failed", e);
                            Toast.makeText(MainActivity.this, "فشل التسجيل: " + e.getMessage(), Toast.LENGTH_SHORT).show();

                            safeEvalJs("if(window.onAndroidLoginFail){window.onAndroidLoginFail("
                                    + JSONObject.quote(String.valueOf(e.getMessage())) + ");}");
                        }
                    }
                }
        );
    }

    // =========================================================
    // 🔧 Debuggable بدون BuildConfig
    // =========================================================
    private boolean isDebuggable() {
        try {
            return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        } catch (Exception e) {
            return false;
        }
    }

    // =========================================================
    // 🔊 Audio & Power
    // =========================================================
    private void setupAudioAndPower() {
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MiniDiscordVoice:ActiveCall");
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();

            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(attrs)
                    .setAcceptsDelayedFocusGain(false)
                    .setOnAudioFocusChangeListener(focusChange -> { })
                    .build();
        }
    }

    private void requestAudioFocus() {
        if (audioManager == null) return;

        int res;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            res = audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            res = audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
            );
        }
        hasAudioFocus = (res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
    }

    private void abandonAudioFocus() {
        if (audioManager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        } else {
            audioManager.abandonAudioFocus(null);
        }
        hasAudioFocus = false;
    }

    // =========================================================
    // 💰 Ads (لا تغييرات)
    // =========================================================
    private void setupAds() {
        MobileAds.initialize(this, status -> {});

        AdView adView = findViewById(R.id.adView);
        if (adView != null) {
            adView.loadAd(new AdRequest.Builder().build());
        }

        loadRewardedAd();
        loadInterstitialAd();
    }

    private void loadInterstitialAd() {
        InterstitialAd.load(
                this,
                AD_UNIT_INTERSTITIAL,
                new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override public void onAdLoaded(@NonNull InterstitialAd ad) {
                        mInterstitialAd = ad;
                    }
                    @Override public void onAdFailedToLoad(@NonNull LoadAdError error) {
                        mInterstitialAd = null;
                    }
                }
        );
    }

    private void loadRewardedAd() {
        RewardedAd.load(
                this,
                AD_UNIT_REWARDED,
                new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedAd ad) {
                        mRewardedAd = ad;
                        Log.d(TAG, "Rewarded Ready ✅");

                        if (!isStartupAdShown && pageLoaded) {
                            mainHandler.postDelayed(MainActivity.this::showStartupVideoIfAny, 900);
                        }
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError error) {
                        mRewardedAd = null;
                        mainHandler.postDelayed(MainActivity.this::loadRewardedAd, 4000);
                    }
                }
        );
    }

    private void showStartupVideoIfAny() {
        if (isStartupAdShown) return;
        if (mRewardedAd == null) return;

        try {
            mRewardedAd.show(MainActivity.this, rewardItem ->
                    Toast.makeText(MainActivity.this, "تم تفعيل التطبيق بنجاح ✅", Toast.LENGTH_SHORT).show()
            );
            isStartupAdShown = true;
        } catch (Exception e) {
            Log.w(TAG, "Failed to show rewarded ad", e);
        } finally {
            loadRewardedAd();
        }
    }

    // =========================================================
    // 🔑 Google Auth
    // =========================================================
    private void setupGoogleAuth() {
        mAuth = FirebaseAuth.getInstance();

        GoogleSignInOptions gso =
                new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestIdToken(WEB_CLIENT_ID)
                        .requestEmail()
                        .build();

        mGoogleSignInClient = GoogleSignIn.getClient(this, gso);

        // زر Native (اختياري)
        signInButton = findViewById(R.id.signInButton);
        if (signInButton != null) {
            signInButton.setOnClickListener(v -> {
                try {
                    if (mGoogleSignInClient != null && signInLauncher != null) {
                        signInLauncher.launch(mGoogleSignInClient.getSignInIntent());
                    }
                } catch (Exception e) {
                    Toast.makeText(this, "تعذر فتح تسجيل الدخول", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    private void updateUI(FirebaseUser user) {
        if (signInButton != null) {
            signInButton.setVisibility(user != null ? View.GONE : View.VISIBLE);
        }

        if (user != null && pageLoaded) {
            sendUserToJS(user);
        }
    }

    private void firebaseAuthWithGoogle(String idToken) {
        if (idToken == null || mAuth == null) return;

        AuthCredential credential = GoogleAuthProvider.getCredential(idToken, null);
        mAuth.signInWithCredential(credential).addOnCompleteListener(this, task -> {
            if (task.isSuccessful()) {
                Toast.makeText(MainActivity.this, "أهلاً بك! 👋", Toast.LENGTH_SHORT).show();
                updateUI(mAuth.getCurrentUser());
            } else {
                Exception e = task.getException();
                Log.w(TAG, "Firebase auth failed", e);
                Toast.makeText(MainActivity.this, "فشل المصادقة", Toast.LENGTH_SHORT).show();

                safeEvalJs("if(window.onAndroidLoginFail){window.onAndroidLoginFail("
                        + JSONObject.quote(e != null ? String.valueOf(e.getMessage()) : "Auth Failed")
                        + ");}");
            }
        });
    }

    private void sendUserToJS(FirebaseUser user) {
        if (user == null) return;

        String name  = (user.getDisplayName() != null) ? user.getDisplayName() : "User";
        String email = (user.getEmail() != null) ? user.getEmail() : "";
        String photo = (user.getPhotoUrl() != null) ? user.getPhotoUrl().toString() : "";

        String js = "(function(){try{if(window.onAndroidLogin){window.onAndroidLogin("
                + JSONObject.quote(name) + ","
                + JSONObject.quote(email) + ","
                + JSONObject.quote(photo)
                + ");}}catch(e){}})();";

        safeEvalJs(js);
    }

    // =========================================================
    // 🌐 WebView
    // =========================================================
    private void setupWebView() {
        webView = findViewById(R.id.webView);
        reloadBtn = findViewById(R.id.reloadBtn);

        if (webView == null) {
            Toast.makeText(this, "WebView غير موجود في activity_main.xml", Toast.LENGTH_SHORT).show();
            return;
        }

        if (isDebuggable()) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // Cookies (مهم جداً لتسجيل الدخول داخل WebView)
        try {
            CookieManager cm = CookieManager.getInstance();
            cm.setAcceptCookie(true);
            cm.setAcceptThirdPartyCookies(webView, true);
        } catch (Exception ignored) {}

        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);

        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // مهم جداً لملفات assets + سكربتات خارجية
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        settings.setLoadsImagesAutomatically(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // JS bridge: window.Android
        webView.addJavascriptInterface(new AndroidInterface(this), "Android");

        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                try {
                    Log.d(TAG, "JS: " + consoleMessage.message()
                            + " @ " + consoleMessage.sourceId()
                            + ":" + consoleMessage.lineNumber());
                } catch (Exception ignored) {}
                return super.onConsoleMessage(consoleMessage);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean micGranted =
                            ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                                    == PackageManager.PERMISSION_GRANTED;

                    if (micGranted) {
                        try {
                            List<String> granted = new ArrayList<>();
                            String[] req = request.getResources();
                            for (String r : req) {
                                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                                    granted.add(r);
                                }
                            }
                            if (!granted.isEmpty()) {
                                request.grant(granted.toArray(new String[0]));
                            } else {
                                request.grant(req);
                            }
                        } catch (Exception e) {
                            Log.w(TAG, "Web permission grant failed", e);
                        }
                    } else {
                        pendingWebPermissionRequest = request;
                        requestNeededPermissions();
                        Toast.makeText(MainActivity.this, "اسمح بالمايكروفون للمتابعة 🎙️", Toast.LENGTH_SHORT).show();
                    }
                });
            }

            // ✅ لو الويب حاول يفتح Popup (غالباً Google/Firebase)
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                try {
                    WebView.HitTestResult result = view.getHitTestResult();
                    String url = (result != null) ? result.getExtra() : null;

                    if (url != null && !url.trim().isEmpty()) {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        return false;
                    }

                    // fallback: نرفض النافذة الجديدة
                    return false;
                } catch (Exception e) {
                    return false;
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                try {
                    Uri u = request.getUrl();
                    String scheme = u != null ? u.getScheme() : null;

                    // نسمح بـ file/https/http داخل الويب
                    if ("file".equalsIgnoreCase(scheme) ||
                            "https".equalsIgnoreCase(scheme) ||
                            "http".equalsIgnoreCase(scheme)) {
                        return false;
                    }

                    // أي شيء ثاني افتحه خارجياً
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                    return true;

                } catch (Exception e) {
                    return false;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageLoaded = true;

                // ✅ hook مساعد (لو زر الويب ينادي MDV.nativeLogin)
                safeEvalJs("try{window.MDV=window.MDV||{};window.MDV.nativeLogin=function(){"
                        + "if(window.Android&&Android.startGoogleSignIn){Android.startGoogleSignIn();}};}catch(e){}");

                safeEvalJs("if(window.onAndroidWebReady){window.onAndroidWebReady();}");

                if (!isStartupAdShown && mRewardedAd != null) {
                    showStartupVideoIfAny();
                }

                if (mAuth != null && mAuth.getCurrentUser() != null) {
                    sendUserToJS(mAuth.getCurrentUser());
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                try {
                    Log.w(TAG, "WebView error: " + error);
                    if (reloadBtn != null) reloadBtn.setVisibility(View.VISIBLE);
                } catch (Exception ignored) {}
            }
        });

        if (reloadBtn != null) {
            reloadBtn.setOnClickListener(v -> {
                try {
                    reloadBtn.setVisibility(View.GONE);
                    webView.reload();
                } catch (Exception ignored) {}
            });
        }

        // ✅ لو انت تستخدم assets
        webView.loadUrl("file:///android_asset/index.html");

        // لو عندك نسخة ويب (أفضل لتسجيل الدخول داخل الويب)
        // webView.loadUrl("https://minidiscordvoice.web.app");
    }

    private void safeEvalJs(String js) {
        try {
            if (webView == null) return;
            webView.post(() -> {
                try { webView.evaluateJavascript(js, null); }
                catch (Exception ignored) {}
            });
        } catch (Exception ignored) {}
    }

    // =========================================================
    // 🛡️ Permissions
    // =========================================================
    private void requestNeededPermissions() {
        List<String> perms = new ArrayList<>();
        perms.add(Manifest.permission.RECORD_AUDIO);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            perms.add(Manifest.permission.BLUETOOTH_CONNECT);
        }

        if (permLauncher != null) {
            permLauncher.launch(perms.toArray(new String[0]));
        }
    }

    // =========================================================
    // 🔔 Notifications
    // =========================================================
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel ch = new NotificationChannel(
                NOTIF_CHANNEL_ID,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
        );
        ch.setDescription("Call Alerts");
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }

    // =========================================================
    // ✅ Android Bridge (window.Android)
    // =========================================================
    @Keep
    @SuppressWarnings("unused")
    public class AndroidInterface {
        final Context mContext;

        AndroidInterface(Context c) { mContext = c; }

        // 🔑 الويب يفتح تسجيل الدخول Native
        @JavascriptInterface
        public void startGoogleSignIn() {
            runOnUiThread(() -> {
                try {
                    if (mGoogleSignInClient != null && signInLauncher != null) {
                        signInLauncher.launch(mGoogleSignInClient.getSignInIntent());
                    } else {
                        Toast.makeText(mContext, "GoogleSignIn غير جاهز", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    Toast.makeText(mContext, "تعذر فتح تسجيل الدخول", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void signOut() {
            runOnUiThread(() -> {
                try {
                    if (mAuth != null) mAuth.signOut();
                    if (mGoogleSignInClient != null) mGoogleSignInClient.signOut();

                    updateUI(null);
                    safeEvalJs("if(window.onAndroidLogout){window.onAndroidLogout();}");
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void setCallMode(boolean active) {
            runOnUiThread(() -> {
                try {
                    if (audioManager == null) return;

                    inCall = active;

                    if (active) {
                        requestAudioFocus();
                        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);

                        if (wakeLock != null && !wakeLock.isHeld()) {
                            wakeLock.acquire(WAKELOCK_TIMEOUT_MS);
                        }

                        int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
                        audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, max, 0);

                    } else {
                        audioManager.setMode(AudioManager.MODE_NORMAL);

                        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                        if (hasAudioFocus) abandonAudioFocus();
                    }
                } catch (Exception e) {
                    Log.e(TAG, "setCallMode error", e);
                }
            });
        }

        @JavascriptInterface
        public void setSpeaker(boolean on) {
            runOnUiThread(() -> {
                try {
                    if (audioManager != null) audioManager.setSpeakerphoneOn(on);
                    vibrate(30);
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void showVideoAd() {
            runOnUiThread(() -> {
                if (mRewardedAd != null) {
                    try {
                        mRewardedAd.show(MainActivity.this, rewardItem ->
                                Toast.makeText(mContext, "💎 شكراً لدعمك!", Toast.LENGTH_SHORT).show()
                        );
                    } catch (Exception e) {
                        Log.w(TAG, "Rewarded show failed", e);
                    } finally {
                        loadRewardedAd();
                    }
                } else {
                    Toast.makeText(mContext, "جاري تحميل الفيديو... ⏳", Toast.LENGTH_SHORT).show();
                    loadRewardedAd();
                }
            });
        }

        @JavascriptInterface
        public void showAd() {
            runOnUiThread(() -> {
                if (mInterstitialAd != null) {
                    try { mInterstitialAd.show(MainActivity.this); }
                    catch (Exception e) { Log.w(TAG, "Interstitial show failed", e); }
                    finally { loadInterstitialAd(); }
                } else {
                    loadInterstitialAd();
                }
            });
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null) return;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(ms);
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void showNotification(String title, String body) {
            runOnUiThread(() -> {
                try {
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm == null) return;

                    Intent intent = new Intent(MainActivity.this, MainActivity.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

                    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
                    PendingIntent pi = PendingIntent.getActivity(MainActivity.this, 0, intent, flags);

                    NotificationCompat.Builder b = new NotificationCompat.Builder(MainActivity.this, NOTIF_CHANNEL_ID)
                            .setSmallIcon(R.mipmap.ic_launcher)
                            .setContentTitle(title != null ? title : "تنبيه")
                            .setContentText(body != null ? body : "")
                            .setAutoCancel(true)
                            .setPriority(NotificationCompat.PRIORITY_HIGH)
                            .setDefaults(NotificationCompat.DEFAULT_ALL)
                            .setFullScreenIntent(pi, true);

                    nm.notify(NOTIF_ID_CALL, b.build());
                } catch (Exception e) {
                    Log.e(TAG, "showNotification error", e);
                }
            });
        }

        @JavascriptInterface
        public void copyToClipboard(String text) {
            runOnUiThread(() -> {
                try {
                    ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cm == null) return;

                    cm.setPrimaryClip(ClipData.newPlainText("Copied Text", text != null ? text : ""));
                    Toast.makeText(MainActivity.this, "✅ تم النسخ", Toast.LENGTH_SHORT).show();
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public int getBatteryLevel() {
            try {
                BatteryManager bm = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
                if (bm != null) {
                    return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                }
            } catch (Exception ignored) {}
            return 50;
        }

        @JavascriptInterface
        public String getNetworkInfoJson() {
            try {
                JSONObject o = new JSONObject();

                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm == null) return "{\"type\":\"none\",\"hasInternet\":false}";

                Network net = cm.getActiveNetwork();
                NetworkCapabilities caps = cm.getNetworkCapabilities(net);

                boolean hasInternet = caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
                o.put("hasInternet", hasInternet);

                if (caps == null) {
                    o.put("type", "none");
                    return o.toString();
                }

                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    o.put("type", "wifi");

                    WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    if (wm != null) {
                        WifiInfo wi = wm.getConnectionInfo();
                        if (wi != null) {
                            o.put("rssi", wi.getRssi());
                            o.put("linkMbps", wi.getLinkSpeed());
                        }
                    }
                } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                    o.put("type", "cell");
                } else {
                    o.put("type", "other");
                }

                return o.toString();
            } catch (Exception e) {
                return "{\"type\":\"none\",\"hasInternet\":false}";
            }
        }

        @JavascriptInterface
        public int tcpPingMs(String host, int port, int timeoutMs) {
            long t0 = System.currentTimeMillis();
            try (Socket s = new Socket()) {
                String h = (host != null && !host.trim().isEmpty()) ? host.trim() : "google.com";
                int p = (port > 0) ? port : 443;
                int t = (timeoutMs > 0) ? timeoutMs : 1500;
                s.connect(new InetSocketAddress(h, p), t);
                return (int) (System.currentTimeMillis() - t0);
            } catch (Exception e) {
                return -1;
            }
        }
    }
}
// ==================================================
// CallActivity.kt
// FullScreen Call WebView Host (Samsung-ready) [REWRITE v3 - IDEAL]
// ✅ Samsung lock-screen: showWhenLocked + turnScreenOn + requestDismissKeyguard
// ✅ Call keep-alive: PARTIAL_WAKELOCK + (اختياري) WIFI_LOCK + ForegroundService ongoing notif
// ✅ WebView mic permission: onPermissionRequest + runtime RECORD_AUDIO
// ✅ Bridge ثابت: window.Android + window.AndroidInterface (لتفادي mismatch مع index.html)
// ✅ يدعم أزرار index.html v1:
//    routeSpeaker / routeEarpiece / routeBluetooth
//    volumeUp / volumeDown / volumeMuteToggle
//    detectAudio / detectBluetooth / refreshDevices / detectDevices (alias)
//    getNetworkInfoJson / tcpPingMs / getDiagnostics / shareDiagnostics
// ✅ Inject: channel/fromName/autoJoin + hook: window.onAndroidCallInvite(from, channel)
// ✅ Clear incoming call notification: NotificationHelper.cancelIncomingCall(ctx)
// ⚠️ ملاحظة Manifest (ضروري):
//   - RECORD_AUDIO permission
//   - (Android 9+) android.permission.FOREGROUND_SERVICE
//   - (Android 14+) قد تحتاج FOREGROUND_SERVICE_MICROPHONE حسب targetSdk
//   - CallKeepAliveService declare exported=false
// ==================================================
package com.example.minidiscordvoice

import android.Manifest
import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.InetSocketAddress
import java.net.Socket
import kotlin.math.max
import kotlin.math.min

class CallActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_OPEN_CALL = "extra_open_call"
        const val EXTRA_CHANNEL = "extra_channel"
        const val EXTRA_FROM_NAME = "extra_from_name"
        const val EXTRA_AUTO_JOIN = "extra_auto_join"

        private const val BRIDGE_ANDROID = "Android"
        private const val BRIDGE_ANDROID_INTERFACE = "AndroidInterface"

        // اختر واحد:
        // private const val DEFAULT_URL = "file:///android_asset/index.html"
        private const val DEFAULT_URL = "https://minidiscordvoice.web.app/"

        private const val WAKELOCK_TIMEOUT_MS = 3L * 60L * 60L * 1000L

        private const val REQ_RECORD_AUDIO = 8121

        fun buildStartIntent(ctx: Context, channel: String, fromName: String, autoJoin: Boolean): Intent {
            return Intent(ctx, CallActivity::class.java).apply {
                putExtra(EXTRA_OPEN_CALL, true)
                putExtra(EXTRA_CHANNEL, channel)
                putExtra(EXTRA_FROM_NAME, fromName)
                putExtra(EXTRA_AUTO_JOIN, autoJoin)
                addFlags(
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_NEW_TASK
                )
            }
        }
    }

    private lateinit var webView: WebView
    private lateinit var audioManager: AudioManager

    private var focusRequest: AudioFocusRequest? = null

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    private var pendingWebPermissionRequest: PermissionRequest? = null

    private var pageLoaded = false
    private var injectedOnce = false
    private var callActive = false

    private var currentChannel: String = ""
    private var currentFrom: String = ""
    private var currentAutoJoin: Boolean = false

    // ==================================================
    // Lifecycle
    // ==================================================
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

        if (savedInstanceState != null) {
            currentChannel = savedInstanceState.getString("ch", "") ?: ""
            currentFrom = savedInstanceState.getString("from", "") ?: ""
            currentAutoJoin = savedInstanceState.getBoolean("aj", false)
        } else {
            pullArgsFromIntent(intent)
        }

        setupLockScreenForSamsung()
        setupWakeLocks()

        val root = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        webView = WebView(this)
        root.addView(
            webView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        setContentView(root)

        configureWebView()

        webView.loadUrl(DEFAULT_URL)

        if (intent?.getBooleanExtra(EXTRA_OPEN_CALL, false) == true) {
            enterCallModeAndKeepAlive()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent == null) return
        setIntent(intent)
        pullArgsFromIntent(intent)

        if (pageLoaded) {
            injectCallParams(currentChannel, currentFrom, currentAutoJoin)
        }
        if (intent.getBooleanExtra(EXTRA_OPEN_CALL, false)) {
            enterCallModeAndKeepAlive()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString("ch", currentChannel)
        outState.putString("from", currentFrom)
        outState.putBoolean("aj", currentAutoJoin)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        exitCallModeAndStopKeepAlive()

        try { releaseWakeLocksSafe() } catch (_: Exception) {}
        try { pendingWebPermissionRequest?.deny() } catch (_: Exception) {}
        pendingWebPermissionRequest = null

        try {
            webView.removeJavascriptInterface(BRIDGE_ANDROID)
            webView.removeJavascriptInterface(BRIDGE_ANDROID_INTERFACE)
        } catch (_: Exception) {}

        try {
            webView.loadUrl("about:blank")
            webView.stopLoading()
            webView.destroy()
        } catch (_: Exception) {}

        super.onDestroy()
    }

    // ==================================================
    // WebView
    // ==================================================
    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val s = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = false

        s.allowFileAccess = true
        s.allowContentAccess = true
        s.allowFileAccessFromFileURLs = true
        s.allowUniversalAccessFromFileURLs = true

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        s.cacheMode = WebSettings.LOAD_DEFAULT
        s.userAgentString = "${s.userAgentString} MiniDiscordVoiceWebView"

        val bridge = WebAppBridge(this)
        webView.addJavascriptInterface(bridge, BRIDGE_ANDROID)
        webView.addJavascriptInterface(bridge, BRIDGE_ANDROID_INTERFACE)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                // WebRTC/Audio capture from WebView
                val wantsAudio = request.resources?.any { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE } == true
                if (!wantsAudio) {
                    try { request.grant(request.resources) } catch (_: Exception) { request.deny() }
                    return
                }

                val granted = ContextCompat.checkSelfPermission(
                    this@CallActivity,
                    Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED

                if (granted) {
                    try { request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) } catch (_: Exception) { request.deny() }
                    return
                }

                // طلب runtime permission ثم نكمل
                pendingWebPermissionRequest = request
                ActivityCompat.requestPermissions(
                    this@CallActivity,
                    arrayOf(Manifest.permission.RECORD_AUDIO),
                    REQ_RECORD_AUDIO
                )
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return try {
                    val u = request.url ?: return false
                    val scheme = (u.scheme ?: "").lowercase()
                    if (scheme == "https" || scheme == "http" || scheme == "file") return false
                    startActivity(Intent(Intent.ACTION_VIEW, u))
                    true
                } catch (_: Exception) {
                    false
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                pageLoaded = true

                // Hook احتياطي: MDV.finishCall
                safeEvalJs(
                    """
                    (function(){
                      try{
                        window.MDV = window.MDV || {};
                        window.MDV.finishCall = function(){
                          try{ if(window.Android && Android.finishCall) Android.finishCall(); }catch(e){}
                          try{ if(window.AndroidInterface && AndroidInterface.finishCall) AndroidInterface.finishCall(); }catch(e){}
                        };
                      }catch(e){}
                    })();
                    """.trimIndent()
                )

                if (!injectedOnce) {
                    injectedOnce = true
                    injectCallParams(currentChannel, currentFrom, currentAutoJoin)
                }
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode != REQ_RECORD_AUDIO) return

        val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
        val req = pendingWebPermissionRequest
        pendingWebPermissionRequest = null

        try {
            if (granted && req != null) {
                req.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            } else {
                req?.deny()
                Toast.makeText(this, "Microphone permission denied", Toast.LENGTH_SHORT).show()
            }
        } catch (_: Exception) {
        }
    }

    // ==================================================
    // Args
    // ==================================================
    private fun pullArgsFromIntent(i: Intent?) {
        currentChannel = i?.getStringExtra(EXTRA_CHANNEL).orEmpty().trim()
        currentFrom = i?.getStringExtra(EXTRA_FROM_NAME).orEmpty().trim()
        currentAutoJoin = i?.getBooleanExtra(EXTRA_AUTO_JOIN, false) == true
    }

    // ==================================================
    // Samsung lock-screen behavior
    // ==================================================
    private fun setupLockScreenForSamsung() {
        try {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true)
                setTurnScreenOn(true)
            } else {
                @Suppress("DEPRECATION")
                window.addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                )
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
                km.requestDismissKeyguard(this, null)
            }
        } catch (_: Exception) {
        }
    }

    // ==================================================
    // Injection to Web
    // ==================================================
    private fun injectCallParams(channel: String, fromName: String, autoJoin: Boolean) {
        if (!pageLoaded) return

        val ch = JSONObject.quote(channel)
        val from = JSONObject.quote(fromName)
        val aj = if (autoJoin) "true" else "false"

        val js = """
          (function(){
            try{
              var ch=$ch, from=$from, aj=$aj;

              var inCh=document.getElementById('channel');
              if(inCh && ch){
                inCh.value=ch;
                try{ inCh.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
              }

              if(window.onAndroidCallInvite){
                try{ window.onAndroidCallInvite(from, ch); }catch(e){}
              }

              if(window.onAndroidIncomingCall){
                try{ window.onAndroidIncomingCall({channel:ch, fromName:from, autoJoin:aj}); }catch(e){}
              }

              if(aj){
                var j=document.getElementById('joinBtn');
                if(j) j.click();
              }
            }catch(e){ try{console.error(e);}catch(_e){} }
          })();
        """.trimIndent()

        safeEvalJs(js)
    }

    private fun safeEvalJs(js: String) {
        try {
            webView.post {
                try { webView.evaluateJavascript(js, null) } catch (_: Exception) {}
            }
        } catch (_: Exception) {
        }
    }

    // ==================================================
    // KeepAlive: WakeLocks + ForegroundService
    // ==================================================
    private fun setupWakeLocks() {
        try {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MiniDiscordVoice:CallCPU")
        } catch (_: Exception) {
            wakeLock = null
        }

        try {
            val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            @Suppress("DEPRECATION")
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MiniDiscordVoice:CallWiFi")
        } catch (_: Exception) {
            wifiLock = null
        }
    }

    private fun acquireWakeLocksSafe() {
        try {
            val wl = wakeLock
            if (wl != null && !wl.isHeld) wl.acquire(WAKELOCK_TIMEOUT_MS)
        } catch (_: Exception) {}

        try {
            if (isOnWifi()) {
                val w = wifiLock
                if (w != null && !w.isHeld) w.acquire()
            }
        } catch (_: Exception) {}
    }

    private fun releaseWakeLocksSafe() {
        try {
            val wl = wakeLock
            if (wl != null && wl.isHeld) wl.release()
        } catch (_: Exception) {}

        try {
            val w = wifiLock
            if (w != null && w.isHeld) w.release()
        } catch (_: Exception) {}
    }

    private fun enterCallModeAndKeepAlive() {
        if (callActive) return
        callActive = true

        requestAudioFocus()
        acquireWakeLocksSafe()

        // ✅ أول ما ندخل شاشة المكالمة: الغِ إشعار المكالمة الواردة
        try { NotificationHelper.cancelIncomingCall(this) } catch (_: Exception) {}

        // ✅ شغّل ForegroundService (مهم لسامسونج عند إطفاء الشاشة)
        try {
            val svc = Intent(this, CallKeepAliveService::class.java).apply {
                putExtra("ch", currentChannel)
                putExtra("from", currentFrom)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(svc) else startService(svc)
        } catch (_: Exception) {}
    }

    private fun exitCallModeAndStopKeepAlive() {
        if (!callActive) return
        callActive = false

        try { stopService(Intent(this, CallKeepAliveService::class.java)) } catch (_: Exception) {}
        abandonAudioFocus()
        try { releaseWakeLocksSafe() } catch (_: Exception) {}
    }

    // ==================================================
    // Audio focus + routing helpers
    // ==================================================
    private fun requestAudioFocus() {
        try {
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val afr = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                    .setOnAudioFocusChangeListener { /* ignore */ }
                    .build()
                focusRequest = afr
                audioManager.requestAudioFocus(afr)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            }
        } catch (_: Exception) {}
    }

    private fun abandonAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
                focusRequest = null
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (_: Exception) {}

        try { audioManager.mode = AudioManager.MODE_NORMAL } catch (_: Exception) {}

        // Android 12+: رجّع الـ routing للوضع الطبيعي
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try { audioManager.clearCommunicationDevice() } catch (_: Exception) {}
        }
    }

    private fun routeSpeaker() {
        try {
            stopBluetoothScoCompat()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try { audioManager.clearCommunicationDevice() } catch (_: Exception) {}
            }
            audioManager.isSpeakerphoneOn = true
        } catch (_: Exception) {}
    }

    private fun routeEarpiece() {
        try {
            stopBluetoothScoCompat()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try { audioManager.clearCommunicationDevice() } catch (_: Exception) {}
            }
            audioManager.isSpeakerphoneOn = false
        } catch (_: Exception) {}
    }

    private fun routeBluetooth() {
        val ok = trySetCommunicationDeviceBluetooth()
        if (!ok) {
            try {
                audioManager.isSpeakerphoneOn = false
                startBluetoothScoCompat()
            } catch (_: Exception) {}
        }
    }

    private fun trySetCommunicationDeviceBluetooth(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return false
        return try {
            val devices = audioManager.availableCommunicationDevices
            val bt = devices.firstOrNull {
                it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
            }
            if (bt != null) audioManager.setCommunicationDevice(bt) else false
        } catch (_: Exception) {
            false
        }
    }

    private fun startBluetoothScoCompat() {
        try {
            @Suppress("DEPRECATION")
            audioManager.startBluetoothSco()
            @Suppress("DEPRECATION")
            audioManager.isBluetoothScoOn = true
        } catch (_: Exception) {}
    }

    private fun stopBluetoothScoCompat() {
        try {
            @Suppress("DEPRECATION")
            audioManager.isBluetoothScoOn = false
            @Suppress("DEPRECATION")
            audioManager.stopBluetoothSco()
        } catch (_: Exception) {}
    }

    private fun volumeUp() {
        try {
            audioManager.adjustStreamVolume(
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.ADJUST_RAISE,
                AudioManager.FLAG_SHOW_UI
            )
        } catch (_: Exception) {
            try { audioManager.adjustVolume(AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI) } catch (_2: Exception) {}
        }
    }

    private fun volumeDown() {
        try {
            audioManager.adjustStreamVolume(
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.ADJUST_LOWER,
                AudioManager.FLAG_SHOW_UI
            )
        } catch (_: Exception) {
            try { audioManager.adjustVolume(AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI) } catch (_2: Exception) {}
        }
    }

    private fun volumeMuteToggle() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val muted = audioManager.isStreamMute(AudioManager.STREAM_VOICE_CALL)
                @Suppress("DEPRECATION")
                audioManager.adjustStreamVolume(
                    AudioManager.STREAM_VOICE_CALL,
                    if (muted) AudioManager.ADJUST_UNMUTE else AudioManager.ADJUST_MUTE,
                    0
                )
            } else {
                @Suppress("DEPRECATION")
                audioManager.setStreamMute(AudioManager.STREAM_VOICE_CALL, true)
            }
        } catch (_: Exception) {}
    }

    private fun isOnWifi(): Boolean {
        return try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val net = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(net) ?: return false
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
        } catch (_: Exception) {
            false
        }
    }

    // ==================================================
    // Bridge: window.Android / window.AndroidInterface
    // ==================================================
    class WebAppBridge(private val activity: CallActivity) {
        private val appCtx = activity.applicationContext

        // --- Call control ---
        @JavascriptInterface
        fun setCallMode(active: Boolean) {
            activity.runOnUiThread {
                try {
                    if (active) activity.enterCallModeAndKeepAlive()
                    else activity.exitCallModeAndStopKeepAlive()
                } catch (_: Exception) {}
            }
        }

        @JavascriptInterface fun endCall() = finishCall()

        @JavascriptInterface
        fun finishCall() {
            activity.runOnUiThread {
                try { activity.exitCallModeAndStopKeepAlive() } catch (_: Exception) {}
                try { activity.finish() } catch (_: Exception) {}
            }
        }

        // --- Incoming actions ---
        @JavascriptInterface
        fun acceptIncoming() {
            activity.runOnUiThread {
                try { NotificationHelper.cancelIncomingCall(activity) } catch (_: Exception) {}
                try {
                    activity.enterCallModeAndKeepAlive()
                    activity.safeEvalJs(
                        """
                        (function(){
                          try{ var j=document.getElementById('joinBtn'); if(j) j.click(); }catch(e){}
                        })();
                        """.trimIndent()
                    )
                } catch (_: Exception) {}
            }
        }

        @JavascriptInterface
        fun rejectIncoming() {
            activity.runOnUiThread {
                try { NotificationHelper.cancelIncomingCall(activity) } catch (_: Exception) {}
                try { activity.finish() } catch (_: Exception) {}
            }
        }

        @JavascriptInterface
        fun clearCallNotification() {
            activity.runOnUiThread {
                try { NotificationHelper.cancelIncomingCall(activity) } catch (_: Exception) {}
            }
        }

        // --- Routes ---
        @JavascriptInterface fun setSpeaker(on: Boolean) {
            activity.runOnUiThread { try { activity.audioManager.isSpeakerphoneOn = on } catch (_: Exception) {} }
        }

        @JavascriptInterface fun routeSpeaker() { activity.runOnUiThread { activity.routeSpeaker() } }
        @JavascriptInterface fun routeEarpiece() { activity.runOnUiThread { activity.routeEarpiece() } }
        @JavascriptInterface fun routeBluetooth() { activity.runOnUiThread { activity.routeBluetooth() } }

        // --- Volume ---
        @JavascriptInterface fun volumeUp() { activity.runOnUiThread { activity.volumeUp() } }
        @JavascriptInterface fun volumeDown() { activity.runOnUiThread { activity.volumeDown() } }
        @JavascriptInterface fun volumeMuteToggle() { activity.runOnUiThread { activity.volumeMuteToggle() } }

        // --- Vibrate ---
        @JavascriptInterface
        fun vibrate(ms: Int) {
            val dur = max(10, min(ms, 3000))
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vm = appCtx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                    vm.defaultVibrator.vibrate(
                        VibrationEffect.createOneShot(dur.toLong(), VibrationEffect.DEFAULT_AMPLITUDE)
                    )
                } else {
                    @Suppress("DEPRECATION")
                    val v = appCtx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(dur.toLong(), VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        @Suppress("DEPRECATION")
                        v.vibrate(dur.toLong())
                    }
                }
            } catch (_: Exception) {}
        }

        // --- Clipboard ---
        @JavascriptInterface
        fun copyToClipboard(text: String?) {
            activity.runOnUiThread {
                try {
                    val cm = appCtx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("text", text ?: ""))
                    Toast.makeText(activity, "✅ Copied", Toast.LENGTH_SHORT).show()
                } catch (_: Exception) {}
            }
        }

        // --- Battery ---
        @JavascriptInterface
        fun getBatteryLevel(): Int {
            return try {
                val bm = appCtx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
                bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            } catch (_: Exception) { 50 }
        }

        // --- Network / Ping ---
        @JavascriptInterface fun getNetworkInfoJson(): String = activity.getNetworkInfoJsonInternal()

        @JavascriptInterface
        fun tcpPingMs(host: String?, port: Int, timeoutMs: Int): Int {
            val t0 = System.currentTimeMillis()
            return try {
                val h = (host ?: "").trim().ifBlank { "google.com" }
                val p = if (port > 0) port else 443
                val t = if (timeoutMs > 0) timeoutMs else 1500
                Socket().use { s -> s.connect(InetSocketAddress(h, p), t) }
                (System.currentTimeMillis() - t0).toInt()
            } catch (_: Exception) { -1 }
        }

        // --- Devices detection ---
        @JavascriptInterface fun detectAudio(): String = activity.dumpAudioDevicesJson()
        @JavascriptInterface fun detectBluetooth(): String = activity.dumpBluetoothDevicesJson()

        @JavascriptInterface
        fun refreshDevices(): String {
            val a = try { JSONObject(detectAudio()) } catch (_: Exception) { JSONObject() }
            val b = try { JSONObject(detectBluetooth()) } catch (_: Exception) { JSONObject() }
            return JSONObject().apply {
                put("audio", a)
                put("bluetooth", b)
            }.toString()
        }

        // alias for some UIs
        @JavascriptInterface fun detectDevices(): String = refreshDevices()

        // --- Diagnostics ---
        @JavascriptInterface fun getDiagnostics(): String = activity.getDiagnosticsJsonInternal()

        @JavascriptInterface
        fun shareDiagnostics() {
            activity.runOnUiThread {
                try {
                    val text = activity.getDiagnosticsJsonInternal()
                    val it = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, text)
                    }
                    activity.startActivity(Intent.createChooser(it, "Share diagnostics"))
                } catch (_: Exception) {}
            }
        }
    }

    // ==================================================
    // Network/Diagnostics helpers
    // ==================================================
    private fun getNetworkInfoJsonInternal(): String {
        return try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val net = cm.activeNetwork
            val caps = cm.getNetworkCapabilities(net)

            val hasInternet = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
            val validated = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true

            val isWifi = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
            val isCell = caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true

            var rssi = 0
            var linkMbps = 0
            if (isWifi) {
                val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                val wi: WifiInfo? = wm.connectionInfo
                if (wi != null) {
                    rssi = wi.rssi
                    linkMbps = wi.linkSpeed
                }
            }

            JSONObject().apply {
                put("type", if (isWifi) "wifi" else if (isCell) "cell" else "none")
                put("hasInternet", hasInternet)
                put("validated", validated)
                put("rssi", rssi)
                put("linkMbps", linkMbps)
            }.toString()
        } catch (_: Exception) {
            "{\"type\":\"none\",\"hasInternet\":false}"
        }
    }

    private fun getDiagnosticsJsonInternal(): String {
        val net = try { JSONObject(getNetworkInfoJsonInternal()) } catch (_: Exception) { JSONObject() }
        return JSONObject().apply {
            put("netType", net.optString("type", "none"))
            put("rssi", net.optInt("rssi", 0))
            put("linkMbps", net.optInt("linkMbps", 0))
            put("internet", net.optBoolean("hasInternet", false))
        }.toString()
    }

    private fun dumpAudioDevicesJson(): String {
        return try {
            val outs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            val arr = JSONArray()
            for (d in outs) {
                arr.put(
                    JSONObject().apply {
                        put("type", d.type)
                        put("product", d.productName?.toString() ?: "")
                        put("isSink", d.isSink)
                    }
                )
            }
            JSONObject().apply { put("outputs", arr) }.toString()
        } catch (_: Exception) {
            "{\"outputs\":[]}"
        }
    }

    private fun dumpBluetoothDevicesJson(): String {
        return try {
            val outs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            val arr = JSONArray()
            for (d in outs) {
                val isBt = (d.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || d.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP)
                if (isBt) {
                    arr.put(
                        JSONObject().apply {
                            put("type", d.type)
                            put("product", d.productName?.toString() ?: "")
                        }
                    )
                }
            }
            JSONObject().apply { put("bluetooth", arr) }.toString()
        } catch (_: Exception) {
            "{\"bluetooth\":[]}"
        }
    }
}

// ==================================================
// CallKeepAliveService (Top-level) — Samsung helper
// ✅ يبقي المكالمة “حية” عندما الشاشة تطفي عبر ForegroundService
// ==================================================
class CallKeepAliveService : Service() {

    companion object {
        private const val KEEPALIVE_CHANNEL_ID = "mdv_active_call"
        private const val KEEPALIVE_NOTIF_ID = 99011
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
    }

    @SuppressLint("ForegroundServiceType")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val ch = intent?.getStringExtra("ch").orEmpty()
        val from = intent?.getStringExtra("from").orEmpty()

        val open = CallActivity.buildStartIntent(this, ch, from, autoJoin = false)
        val pi = PendingIntent.getActivity(
            this,
            9001,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notif = NotificationCompat.Builder(this, KEEPALIVE_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle("Call in progress")
            .setContentText(
                when {
                    ch.isNotBlank() && from.isNotBlank() -> "From: $from • Channel: $ch"
                    ch.isNotBlank() -> "Channel: $ch"
                    else -> "Active call"
                }
            )
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pi)
            .build()

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(KEEPALIVE_NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            } else {
                startForeground(KEEPALIVE_NOTIF_ID, notif)
            }
        } catch (_: SecurityException) {
            // لو POST_NOTIFICATIONS غير مسموح أو قيود جهاز: نوقف الخدمة بدل crash
            stopSelf()
        } catch (_: Exception) {
            stopSelf()
        }

        return START_STICKY
    }

    override fun onDestroy() {
        try { stopForeground(STOP_FOREGROUND_REMOVE) } catch (_: Exception) {}
        super.onDestroy()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(
                KEEPALIVE_CHANNEL_ID,
                "Active Call",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps the call alive while screen is off (Samsung helper)"
                setSound(null, null)
                enableVibration(false)
            }
            nm.createNotificationChannel(ch)
        } catch (_: Exception) {
        }
    }
}
/* =========================================================
   MiniDiscordVoice - app.js (FULL INTEGRATED) [REWRITE v4 FINAL]
   - ✅ Matches latest CSS: Drawer side + overlay + theme vars + no horizontal drag
   - ✅ Adds Theme controller (system/dark/light) via data-theme
   - ✅ Restores Mic "Heart Monitor" waveform (ECG-style) using Audio Analyser
   - ✅ Keeps ALL previous features:
      - Google profile sync + prevent anonymous wipe
      - Avatar fallback
      - LED binding
      - WebView safe (NO replaceAll)
      - Better Agora errors
      - Force Majeure fixed at 2 minutes (LOCKED)
      - Fix buttons not working (hard re-bind)
      - AndroidBridge + window.MDV_APP API
   ========================================================= */

(() => {
  "use strict";

  /* =========================
     Part 1 — BOOTSTRAP + CONFIG
     ========================= */
  if (window.__MDV_APP_LOADED__) {
    try { console.warn("MDV app.js already loaded"); } catch (_) {}
    return;
  }
  window.__MDV_APP_LOADED__ = true;

  const APP_VERSION = "MDV_APP_JS_v4_final_2026-01-14";

  const AGORA_APP_ID = "eb80a41c4a3c400f865a5c88bdf293be";

  const FIREBASE_CONFIGS = [
    {
      apiKey: "AIzaSyApUvLTt0OLAc_3Rk2e1BnmvX64T5RTmA8",
      authDomain: "minidiscordvoice-b7310.firebaseapp.com",
      databaseURL: "https://minidiscordvoice-b7310-default-rtdb.firebaseio.com",
      projectId: "minidiscordvoice-b7310",
      storageBucket: "minidiscordvoice-b7310.firebasestorage.app",
      messagingSenderId: "1073341648468",
      appId: "1:1073341648468:web:9af59b1fcc577d4468e7c1",
      measurementId: "G-7R4MRJHWY6",
    },
    {
      apiKey: "AIzaSyDdqU4OTdQv1vGXRtJwPVkuA4AdwIzCAuE",
      authDomain: "minidiscordvoice-b7310.firebaseapp.com",
      databaseURL: "https://minidiscordvoice-b7310-default-rtdb.firebaseio.com",
      projectId: "minidiscordvoice-b7310",
      storageBucket: "minidiscordvoice-b7310.firebasestorage.app",
      messagingSenderId: "1073341648468",
      appId: "1:1073341648468:web:9af59b1fcc577d4468e7c1",
      measurementId: "G-7R4MRJHWY6",
    },
  ];

  // Limits
  const CALL_LIMIT_MS = 3 * 60 * 60 * 1000; // 3 hours
  const BLOCK_MS = 20 * 60 * 60 * 1000;     // 20 hours
  const USAGE_TICK_MS = 15 * 1000;          // 15s

  // Force Majeure (LOCKED)
  const FM_INTERVAL_MS = 2 * 60 * 1000;     // 2 minutes (LOCKED)
  const FM_REBOOT_SECONDS = 6;              // 6 seconds (LOCKED)

  const DEFAULT_PING_HOST = "minidiscordvoice.web.app";

  window.AGORA_APP_ID = AGORA_APP_ID;
  window.__MDV_FIREBASE_CONFIGS__ = FIREBASE_CONFIGS;
  window.__MDV_VERSION__ = APP_VERSION;

  /* =========================
     Part 2 — SMALL UTILS
     ========================= */
  const now = () => Date.now();

  const $ = (sel, root = document) => { try { return root.querySelector(sel); } catch (_) { return null; } };
  const $$ = (sel, root = document) => { try { return Array.from(root.querySelectorAll(sel)); } catch (_) { return []; } };
  const byId = (id) => { try { return document.getElementById(id); } catch (_) { return null; } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function pad2(n) {
    n = Math.floor(Math.max(0, n));
    return n < 10 ? "0" + n : "" + n;
  }
  function fmtTime(seconds) {
    seconds = Math.floor(Math.max(0, seconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    return `${pad2(m)}:${pad2(s)}`;
  }
  function escapeHTML(s) {
    const str = String(s == null ? "" : s);
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function safeText(el, txt) {
    if (!el) return;
    el.textContent = (txt == null) ? "" : String(txt);
  }
  function safeHTML(el, html) {
    if (!el) return;
    el.innerHTML = html || "";
  }
  function safeJsonParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  function errToText(e) {
    try {
      if (!e) return "Unknown error";
      const name = e.name ? String(e.name) : "";
      const msg = e.message ? String(e.message) : String(e);
      return (name ? `${name}: ` : "") + msg;
    } catch (_) { return "Unknown error"; }
  }
  function debounce(fn, ms = 250) {
    let t = null;
    return (...args) => {
      try { clearTimeout(t); } catch (_) {}
      t = setTimeout(() => { try { fn(...args); } catch (_) {} }, ms);
    };
  }
  function uidShort() {
    return Math.random().toString(16).slice(2, 10) + "-" + Math.random().toString(16).slice(2, 6);
  }
  function safeNameFromEmail(email) {
    if (!email) return "User";
    const s = String(email).split("@")[0] || "User";
    return s.length > 18 ? s.slice(0, 18) : s;
  }
  function normalizePhotoUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.includes("googleusercontent.com") && !u.includes("sz=")) {
      return u + (u.includes("?") ? "&" : "?") + "sz=128";
    }
    return u;
  }
  async function sleepWithAbort(ms, shouldAbort) {
    const step = 250;
    let left = ms;
    while (left > 0) {
      if (shouldAbort && shouldAbort()) return;
      const s = Math.min(step, left);
      await sleep(s);
      left -= s;
    }
  }

  /* =========================
     Part 3 — STORAGE (namespaced)
     ========================= */
  const Store = (() => {
    const PREFIX = "mdv_v4_";
    function k(key) { return PREFIX + String(key || ""); }
    function getRaw(key) { try { return localStorage.getItem(k(key)); } catch (_) { return null; } }
    function setRaw(key, val) { try { localStorage.setItem(k(key), String(val == null ? "" : val)); } catch (_) {} }
    function del(key) { try { localStorage.removeItem(k(key)); } catch (_) {} }
    function getJson(key, fallback) {
      const raw = getRaw(key);
      if (!raw) return fallback;
      const obj = safeJsonParse(raw);
      return obj == null ? fallback : obj;
    }
    function setJson(key, obj) { try { setRaw(key, JSON.stringify(obj)); } catch (_) {} }
    return { getRaw, setRaw, del, getJson, setJson };
  })();

  /* =========================
     Part 4 — LOGGER
     ========================= */
  const Log = (() => {
    const MAX_LINES = 260;

    function stamp() {
      const t = new Date();
      return `${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}`;
    }
    function toConsole(type, msg) {
      try {
        if (type === "bad") console.error("[MDV]", msg);
        else if (type === "warn") console.warn("[MDV]", msg);
        else console.log("[MDV]", msg);
      } catch (_) {}
    }
    function toUI(type, msg) {
      let box = null;
      try { box = (UI && UI.els) ? UI.els.log : null; } catch (_) { box = null; }
      if (!box) return;

      const div = document.createElement("div");
      div.className = "logLine";

      if (type === "warn") div.style.color = "var(--warn)";
      if (type === "bad") div.style.color = "var(--danger)";
      if (type === "good") div.style.color = "var(--success)";

      div.innerHTML = `<span class="mono">[${stamp()}]</span> ${escapeHTML(msg)}`;
      box.prepend(div);

      try {
        const lines = box.querySelectorAll(".logLine");
        if (lines.length > MAX_LINES) {
          for (let i = MAX_LINES; i < lines.length; i++) lines[i].remove();
        }
      } catch (_) {}
    }
    function write(type, msg) {
      const m = String(msg == null ? "" : msg);
      toConsole(type, m);
      toUI(type, m);
    }
    return { write };
  })();

  /* =========================
     Part 5 — ANDROID BRIDGE (SAFE)
     ========================= */
  const AndroidBridge = {
    exists() { return !!(window.Android || window.AndroidInterface); },
    _obj() { return window.AndroidInterface || window.Android || null; },
    call(fn, ...args) {
      try {
        const o = this._obj();
        if (!o) return undefined;
        const f = o[fn];
        if (typeof f !== "function") return undefined;
        return f.apply(o, args);
      } catch (_) { return undefined; }
    },

    startGoogleSignIn() { return this.call("startGoogleSignIn"); },
    signOut() { return this.call("signOut"); },

    setCallMode(active) { return this.call("setCallMode", !!active); },
    setSpeaker(on) { return this.call("setSpeaker", !!on); },

    vibrate(ms = 30) { return this.call("vibrate", parseInt(ms, 10) || 30); },

    showAd() { return this.call("showAd"); },
    showVideoAd() { return this.call("showVideoAd"); },

    showNotification(t, b) {
      return this.call("showNotification", String(t || ""), String(b || ""));
    },

    copyToClipboard(t) { return this.call("copyToClipboard", String(t || "")); },

    getNetworkInfoJson() {
      try { return String(this.call("getNetworkInfoJson") || ""); } catch (_) { return ""; }
    },

    tcpPingMs(host, port, timeoutMs) {
      try {
        const v = this.call(
          "tcpPingMs",
          String(host || ""),
          parseInt(port, 10) || 443,
          parseInt(timeoutMs, 10) || 1500
        );
        const n = Number(v);
        return Number.isFinite(n) ? n : -1;
      } catch (_) { return -1; }
    },

    endCall() { return this.call("endCall"); },
    acceptIncoming() { return this.call("acceptIncoming"); },
    rejectIncoming() { return this.call("rejectIncoming"); },

    volumeUp() { return this.call("volumeUp"); },
    volumeDown() { return this.call("volumeDown"); },
    volumeMuteToggle() { return this.call("volumeMuteToggle"); },

    routeSpeaker() { return this.call("routeSpeaker"); },
    routeEarpiece() { return this.call("routeEarpiece"); },
    routeBluetooth() { return this.call("routeBluetooth"); },

    detectAudio() { return this.call("detectAudio"); },
    detectBluetooth() { return this.call("detectBluetooth"); },
    refreshDevices() { return this.call("refreshDevices"); },

    getDiagnostics() { return this.call("getDiagnostics"); },
    resetDiagnostics() { return this.call("resetDiagnostics"); },
    shareDiagnostics() { return this.call("shareDiagnostics"); },
  };

  /* =========================
     Part 6 — UI BINDING
     ========================= */
  const UI = {
    els: {},
    bound: false,
    bindAttempts: 0,

    FALLBACK_AVATAR:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect width='100%25' height='100%25' fill='%23333'/%3E%3Ctext x='50%25' y='52%25' text-anchor='middle' fill='%23aaa' font-size='18' font-family='Arial'%3EUSER%3C/text%3E%3C/svg%3E",

    bind() {
      const E = this.els;

      // Profile
      E.profileName = byId("userName");
      E.profileEmail = byId("userEmail");
      E.profilePhoto = byId("userPhoto");
      E.inName = byId("displayName");

      // Inputs
      E.inPresence = byId("presenceRoom");
      E.inChannel = byId("channel");
      E.inToken = byId("token");

      // Buttons (Call)
      E.btnJoin = byId("joinBtn");
      E.btnLeave = byId("leaveBtn");
      E.btnCopy = byId("copyBtn");

      E.btnSpeaker = byId("speakerBtn");
      E.btnMuteMic = byId("muteMicBtn");
      E.btnMuteSpk = byId("muteSoundBtn");

      E.btnEndCall = byId("endCallBtn");

      E.swFM = byId("fmSwitch");
      E.fmIntervalSel = byId("fmInterval");
      E.fmRebootSel = byId("fmReboot");

      E.btnBroadcastCall = byId("callBtn");
      E.btnReward = byId("rewardBtn");

      // Optional login buttons
      E.btnGoogle1 = byId("googleLoginBtn");
      E.btnGoogle2 = byId("loginBtn");
      E.btnGoogle3 = byId("signInBtn");
      E.btnGoogle4 = byId("googleBtn");
      E.btnLogout = byId("logoutBtn");

      // Status
      E.callTimerVal = byId("callTimer");
      E.netTower = byId("netTower");
      E.srvTower = byId("srvTower");
      E.netTypeTxt = byId("netTypeTxt");
      E.pingVal = byId("pingMs");

      // LEDs (DOT itself)
      E.ledWeb = byId("ledWeb");
      E.ledFirebase = byId("ledFirebase");
      E.ledListener = byId("ledListener");
      E.ledMicPerm = byId("ledMicPerm");
      E.ledAgora = byId("ledAgora");
      E.ledInCall = byId("ledInCall");
      E.ledNet = byId("ledNet");
      E.ledSrv = byId("ledSrv");
      E.ledCallQ = byId("ledCallQ");

      // Quality fields
      E.qNetText = byId("qNetText");
      E.qPingText = byId("qPingText");
      E.qJitterText = byId("qJitterText");
      E.qLossText = byId("qLossText");
      E.qUpText = byId("qUpText");
      E.qDownText = byId("qDownText");
      E.qAudioText = byId("qAudioText");
      E.qGradeText = byId("qGradeText");

      E.qNetFill = byId("qNetFill");
      E.qPingFill = byId("qPingFill");
      E.qJitterFill = byId("qJitterFill");
      E.qLossFill = byId("qLossFill");
      E.qUpFill = byId("qUpFill");
      E.qDownFill = byId("qDownFill");
      E.qAudioFill = byId("qAudioFill");
      E.qGradeFill = byId("qGradeFill");

      // Friends
      E.friendName = byId("friendSearchName");
      E.friendEmail = byId("friendSearchEmail");
      E.friendSearchBtn = byId("friendSearchBtn");
      E.friendAddBtn = byId("friendAddBtn");
      E.friendImportBtn = byId("friendImportBtn");
      E.friendExportBtn = byId("friendExportBtn");

      E.friendList = byId("friendsList");
      E.callSelectedBtn = byId("callSelectedBtn");
      E.clearSelectedBtn = byId("clearSelectedBtn");

      // Incoming modal
      E.modalOverlay = byId("incomingOverlay");
      E.modalFromName = byId("incomingFrom");
      E.modalAccept = byId("acceptCallBtn");
      E.modalDecline = byId("rejectCallBtn");

      // Reboot overlay
      E.rebootOverlay = byId("rebootOverlay");
      E.rebootCount = byId("rebootCounter");

      // Diagnostics
      E.diagNetType = byId("diagNetType");
      E.diagRssi = byId("diagRssi");
      E.diagLink = byId("diagLink");
      E.diagInternet = byId("diagInternet");
      E.diagPing = byId("diagPing");
      E.diagPingGrade = byId("diagPingGrade");
      E.diagSrvBarsTxt = byId("diagSrvBarsTxt");
      E.diagSrvLedTxt = byId("diagSrvLedTxt");
      E.diagJitter = byId("diagJitter");
      E.diagLoss = byId("diagLoss");
      E.diagUp = byId("diagUp");
      E.diagDown = byId("diagDown");
      E.diagCodec = byId("diagCodec");
      E.diagCallLedTxt = byId("diagCallLedTxt");
      E.diagNoteTxt = byId("diagNoteTxt");

      // Settings
      E.setSpeakerDefaultTxt = byId("setSpeakerDefaultTxt");
      E.setMicDefaultTxt = byId("setMicDefaultTxt");
      E.setSoundDefaultTxt = byId("setSoundDefaultTxt");
      E.setEchoTxt = byId("setEchoTxt");

      E.setPingHost = byId("setPingHost");
      E.setUpdateRateTxt = byId("setUpdateRateTxt");

      E.setLockTxt = byId("setLockTxt");
      E.setLogsTxt = byId("setLogsTxt");

      E.btnSetSpeakerOn = byId("setSpeakerDefaultOn");
      E.btnSetSpeakerOff = byId("setSpeakerDefaultOff");
      E.btnSetMicOn = byId("setMicDefaultOn");
      E.btnSetMicOff = byId("setMicDefaultOff");
      E.btnSetSoundOn = byId("setSoundDefaultOn");
      E.btnSetSoundOff = byId("setSoundDefaultOff");

      E.btnEchoAuto = byId("setEchoAuto");
      E.btnEchoOn = byId("setEchoOn");
      E.btnEchoOff = byId("setEchoOff");

      E.btnPingDefault = byId("setPingHostDefault");
      E.btnPingCustom = byId("setPingHostCustom");

      E.btnRateLow = byId("setRateLow");
      E.btnRateNorm = byId("setRateNorm");
      E.btnRateHigh = byId("setRateHigh");

      E.btnLockOn = byId("setLockOn");
      E.btnLockOff = byId("setLockOff");

      E.btnLogsOn = byId("setLogsOn");
      E.btnLogsOff = byId("setLogsOff");

      // Log
      E.log = byId("log");

      // Drawer + Theme (NEW)
      E.drawerBtn = byId("drawerBtn") || byId("menuBtn");
      E.drawerOverlay = byId("drawerOverlay");
      E.drawer = byId("drawer") || byId("tabs");

      E.themeBtn = byId("themeBtn") || byId("themeToggleBtn");
      E.themeModeTxt = byId("themeModeTxt");

      // Mic waveform (NEW / RESTORED)
      E.micWave =
        byId("micWave") ||
        byId("micWaveCanvas") ||
        byId("micHeart") ||
        byId("micHeartCanvas") ||
        byId("heartWave");

      // Defaults
      if (E.inPresence && !E.inPresence.value) E.inPresence.value = "call_room1";
      if (E.profilePhoto && !E.profilePhoto.src) E.profilePhoto.src = this.FALLBACK_AVATAR;

      this.wireEvents();
      this.bound = true;
      this.bindAttempts++;
    },

    /* =========================
       Part 7 — UI EVENTS (hard re-bind)
       ========================= */
    wireEvents() {
      const E = this.els;

      const rewireBtn = (btn, fn) => {
        if (!btn) return;
        try {
          const parent = btn.parentNode;
          if (!parent) return;
          const clone = btn.cloneNode(true);
          parent.replaceChild(clone, btn);
          fn(clone);
        } catch (_) {
          try { fn(btn); } catch (_) {}
        }
      };

      rewireBtn(E.btnJoin, (b) => b.addEventListener("click", () => App.joinFlow()));
      rewireBtn(E.btnLeave, (b) => b.addEventListener("click", () => App.leaveFlow()));
      rewireBtn(E.btnEndCall, (b) => b.addEventListener("click", () => App.endCall()));

      rewireBtn(E.btnCopy, (b) => b.addEventListener("click", () => {
        const ch = App.getChannel();
        if (!ch) return Log.write("warn", "اكتب Channel أولاً");
        try { navigator.clipboard && navigator.clipboard.writeText(ch); } catch (_) {}
        AndroidBridge.copyToClipboard(ch);
        Log.write("good", "تم نسخ اسم القناة");
      }));

      rewireBtn(E.btnSpeaker, (b) => b.addEventListener("click", () => App.toggleSpeaker()));
      rewireBtn(E.btnMuteMic, (b) => b.addEventListener("click", () => App.toggleMuteMic()));
      rewireBtn(E.btnMuteSpk, (b) => b.addEventListener("click", () => App.toggleMuteSpeaker()));

      if (E.swFM) {
        try { E.swFM.onchange = null; } catch (_) {}
        E.swFM.addEventListener("change", () => App.toggleForceMajeure());
      }

      rewireBtn(E.btnBroadcastCall, (b) => b.addEventListener("click", () => App.sendBroadcastInvite()));
      rewireBtn(E.btnReward, (b) => b.addEventListener("click", () => {
        const r = AndroidBridge.showVideoAd();
        if (r === undefined) Log.write("info", "Video Ad (Android only)");
      }));

      rewireBtn(E.friendSearchBtn, (b) => b.addEventListener("click", () => App.searchFriends()));
      rewireBtn(E.friendAddBtn, (b) => b.addEventListener("click", () => App.addFriendLocalFromInputs()));
      rewireBtn(E.friendImportBtn, (b) => b.addEventListener("click", () => App.importFriends()));
      rewireBtn(E.friendExportBtn, (b) => b.addEventListener("click", () => App.exportFriends()));

      rewireBtn(E.callSelectedBtn, (b) => b.addEventListener("click", () => App.sendCallInviteToSelected()));
      rewireBtn(E.clearSelectedBtn, (b) => b.addEventListener("click", () => App.clearFriendSelection()));

      rewireBtn(E.modalAccept, (b) => b.addEventListener("click", () => App.acceptIncomingCall()));
      rewireBtn(E.modalDecline, (b) => b.addEventListener("click", () => App.declineIncomingCall()));

      // Google login buttons
      const googleBtns = [E.btnGoogle1, E.btnGoogle2, E.btnGoogle3, E.btnGoogle4].filter(Boolean);
      googleBtns.forEach((btn) => {
        rewireBtn(btn, (b) => b.addEventListener("click", () => {
          AndroidBridge.startGoogleSignIn();
          Log.write("info", "فتح تسجيل الدخول...");
        }));
      });

      rewireBtn(E.btnLogout, (b) => b.addEventListener("click", () => {
        AndroidBridge.signOut();
        Log.write("info", "تسجيل خروج...");
      }));

      if (E.inName) {
        try { E.inName.oninput = null; } catch (_) {}
        E.inName.addEventListener("input", debounce(() => {
          App.state.profile.displayNameLocal = (E.inName.value || "").trim();
          App.persistLocal();
        }, 250));
      }

      // Settings binds
      rewireBtn(E.btnSetSpeakerOn, (b) => b.addEventListener("click", () => App.setDefaults({ speaker: true })));
      rewireBtn(E.btnSetSpeakerOff, (b) => b.addEventListener("click", () => App.setDefaults({ speaker: false })));

      rewireBtn(E.btnSetMicOn, (b) => b.addEventListener("click", () => App.setDefaults({ mic: true })));
      rewireBtn(E.btnSetMicOff, (b) => b.addEventListener("click", () => App.setDefaults({ mic: false })));

      rewireBtn(E.btnSetSoundOn, (b) => b.addEventListener("click", () => App.setDefaults({ sound: true })));
      rewireBtn(E.btnSetSoundOff, (b) => b.addEventListener("click", () => App.setDefaults({ sound: false })));

      rewireBtn(E.btnEchoAuto, (b) => b.addEventListener("click", () => App.setEchoMode("AUTO")));
      rewireBtn(E.btnEchoOn, (b) => b.addEventListener("click", () => App.setEchoMode("ON")));
      rewireBtn(E.btnEchoOff, (b) => b.addEventListener("click", () => App.setEchoMode("OFF")));

      rewireBtn(E.btnPingDefault, (b) => b.addEventListener("click", () => App.setPingHost(DEFAULT_PING_HOST)));
      rewireBtn(E.btnPingCustom, (b) => b.addEventListener("click", () => {
        const x = prompt("اكتب Ping Host:", App.state.settings.pingHost || DEFAULT_PING_HOST);
        if (x != null) App.setPingHost(String(x || "").trim());
      }));

      rewireBtn(E.btnRateLow, (b) => b.addEventListener("click", () => App.setUpdateRate("Low")));
      rewireBtn(E.btnRateNorm, (b) => b.addEventListener("click", () => App.setUpdateRate("Normal")));
      rewireBtn(E.btnRateHigh, (b) => b.addEventListener("click", () => App.setUpdateRate("High")));

      rewireBtn(E.btnLockOn, (b) => b.addEventListener("click", () => App.setLockCall(true)));
      rewireBtn(E.btnLockOff, (b) => b.addEventListener("click", () => App.setLockCall(false)));

      rewireBtn(E.btnLogsOn, (b) => b.addEventListener("click", () => App.setAutoClearLogs(true)));
      rewireBtn(E.btnLogsOff, (b) => b.addEventListener("click", () => App.setAutoClearLogs(false)));

      // Theme button (NEW)
      rewireBtn(E.themeBtn, (b) => b.addEventListener("click", () => Theme.cycle()));

      // Drawer button (NEW)
      rewireBtn(E.drawerBtn, (b) => b.addEventListener("click", () => Drawer.toggle()));
      if (E.drawerOverlay) {
        try { E.drawerOverlay.onclick = null; } catch (_) {}
        E.drawerOverlay.addEventListener("click", () => Drawer.close());
      }

      // Unlock audio on first gesture (for beeps + analyser)
      document.addEventListener("pointerdown", () => Sound.unlock(), { once: true });
      document.addEventListener("touchstart", () => Sound.unlock(), { once: true });
      document.addEventListener("click", () => Sound.unlock(), { once: true });

      // Close drawer on back/escape
      window.addEventListener("keydown", (ev) => {
        if (ev && ev.key === "Escape") Drawer.close();
      });
    },

    /* =========================
       Part 8 — UI HELPERS
       ========================= */
    setProfile({ name, email, photoUrl, locked }) {
      const E = this.els;

      safeText(E.profileName, name || "Guest");
      safeText(E.profileEmail, email || "لم يتم تسجيل الدخول");

      const p = normalizePhotoUrl(photoUrl);
      if (E.profilePhoto) {
        E.profilePhoto.onerror = () => { E.profilePhoto.src = UI.FALLBACK_AVATAR; };
        E.profilePhoto.src = p || UI.FALLBACK_AVATAR;
      }

      if (E.inName) {
        E.inName.value = name || "";
        E.inName.readOnly = !!locked;
      }
    },

    setLed(dotEl, status) {
      if (!dotEl) return;
      let el = null;
      try {
        el = (dotEl.classList && dotEl.classList.contains("dot"))
          ? dotEl
          : (dotEl.querySelector ? dotEl.querySelector(".dot") : null);
      } catch (_) { el = dotEl; }

      if (!el || !el.classList) return;
      el.classList.remove("on", "off", "warn", "bad");
      el.classList.add(status || "off");
    },

    setCallState(mode) {
      const connected = mode === "connected";
      const E = this.els;

      if (E.btnJoin) E.btnJoin.disabled = connected;
      if (E.btnLeave) E.btnLeave.disabled = !connected;
      if (E.inChannel) E.inChannel.disabled = connected || !!App.state.settings.lockCall;

      this.setLed(E.ledInCall, connected ? "on" : "off");
    },

    setCallTimer(seconds) {
      if (this.els.callTimerVal) safeText(this.els.callTimerVal, fmtTime(seconds));
    },

    showModal(show) {
      const m = this.els.modalOverlay;
      if (!m) return;
      if (show) {
        m.classList.remove("hidden");
        m.setAttribute("aria-hidden", "false");
      } else {
        m.classList.add("hidden");
        m.setAttribute("aria-hidden", "true");
      }
    },

    showReboot(show, count) {
      const o = this.els.rebootOverlay;
      if (!o) return;
      if (show) {
        o.classList.remove("hidden");
        o.setAttribute("aria-hidden", "false");
      } else {
        o.classList.add("hidden");
        o.setAttribute("aria-hidden", "true");
      }
      if (show && this.els.rebootCount) safeText(this.els.rebootCount, String(count ?? ""));
    },

    updateTower(towerEl, activeCount, statusClass) {
      if (!towerEl) return;
      const bars = towerEl.querySelectorAll(".bar");
      bars.forEach((b, i) => {
        b.classList.remove("on", "warn", "bad");
        if (i < activeCount) b.classList.add(statusClass);
      });
    },

    setSignalUI({ type, rssi, hasInternet }) {
      if (this.els.netTypeTxt) safeText(this.els.netTypeTxt, type ? String(type).toUpperCase() : "...");

      let bars = 0;
      let status = "off";

      if (!hasInternet) {
        bars = 0;
        status = "bad";
      } else if (type === "wifi" && typeof rssi === "number") {
        if (rssi >= -55) { bars = 4; status = "on"; }
        else if (rssi >= -67) { bars = 3; status = "on"; }
        else if (rssi >= -78) { bars = 2; status = "warn"; }
        else { bars = 1; status = "bad"; }
      } else {
        bars = 3;
        status = "on";
      }

      this.updateTower(this.els.netTower, bars, status);
      this.setLed(this.els.ledNet, status === "on" ? "on" : status === "warn" ? "warn" : "bad");
    },

    setPing(ms) {
      if (this.els.pingVal) safeText(this.els.pingVal, ms >= 0 ? String(ms) : "...");

      let bars = 0;
      let status = "off";

      if (ms < 0) { bars = 0; status = "bad"; }
      else if (ms < 100) { bars = 4; status = "on"; }
      else if (ms < 200) { bars = 3; status = "on"; }
      else if (ms < 400) { bars = 2; status = "warn"; }
      else { bars = 1; status = "bad"; }

      this.updateTower(this.els.srvTower, bars, status);
      this.setLed(this.els.ledSrv, status === "on" ? "on" : status === "warn" ? "warn" : "bad");
    },

    setQualityUI(pack) {
      if (!pack) return;
      const E = this.els;

      if (E.qNetText) safeText(E.qNetText, pack.netText || "...");
      if (E.qPingText) safeText(E.qPingText, String(pack.pingMs ?? "..."));
      if (E.qJitterText) safeText(E.qJitterText, String(pack.jitterMs ?? "..."));
      if (E.qLossText) safeText(E.qLossText, String(pack.lossPct ?? "..."));
      if (E.qUpText) safeText(E.qUpText, String(pack.upKbps ?? "..."));
      if (E.qDownText) safeText(E.qDownText, String(pack.downKbps ?? "..."));
      if (E.qAudioText) safeText(E.qAudioText, String(pack.audioLevel ?? "..."));
      if (E.qGradeText) safeText(E.qGradeText, pack.grade || "...");

      const clamp = (x) => Math.max(0, Math.min(100, Number(x) || 0));
      const setFill = (el, v) => { if (el) el.style.width = clamp(v) + "%"; };

      setFill(E.qNetFill, pack.netScore);
      setFill(E.qPingFill, pack.pingScore);
      setFill(E.qJitterFill, pack.jitterScore);
      setFill(E.qLossFill, pack.lossScore);
      setFill(E.qUpFill, pack.upScore);
      setFill(E.qDownFill, pack.downScore);
      setFill(E.qAudioFill, pack.audioScore);
      setFill(E.qGradeFill, pack.gradeScore);
    },

    renderFriends(list, selectedSet, onToggle, onQuickCall) {
      const box = this.els.friendList;
      if (!box) return;

      safeHTML(box, "");

      if (!list || !list.length) {
        const empty = document.createElement("div");
        empty.className = "logLine";
        empty.textContent = "لا يوجد أصدقاء بعد. ابحث بالاسم/الإيميل ثم أضف.";
        box.appendChild(empty);
        return;
      }

      list.forEach((f) => {
        const key = f.uid || f.email || f.id || uidShort();
        const selected = selectedSet.has(key);

        const row = document.createElement("div");
        row.className = "logLine";
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.gap = "8px";

        row.innerHTML = `
          <div style="min-width:0">
            <div style="font-weight:900;color:var(--txt);font-size:11px">${escapeHTML(f.displayName || "Friend")}</div>
            <div style="color:var(--muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px">${escapeHTML(f.email || f.uid || "")}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn tiny toggleBtn" type="button">${selected ? "✓" : "+"}</button>
            <button class="btn tiny warn callBtn" type="button">Call</button>
          </div>
        `;

        const toggleBtn = row.querySelector(".toggleBtn");
        const callBtn = row.querySelector(".callBtn");

        if (toggleBtn) toggleBtn.addEventListener("click", () => onToggle(key));
        if (callBtn) callBtn.addEventListener("click", () => onQuickCall(key));

        box.appendChild(row);
      });
    },

    syncSettingsUI(s) {
      const E = this.els;
      if (!s) return;

      if (E.setSpeakerDefaultTxt) safeText(E.setSpeakerDefaultTxt, s.speakerDefault ? "ON" : "OFF");
      if (E.setMicDefaultTxt) safeText(E.setMicDefaultTxt, s.micDefault ? "ON" : "OFF");
      if (E.setSoundDefaultTxt) safeText(E.setSoundDefaultTxt, s.soundDefault ? "ON" : "OFF");
      if (E.setEchoTxt) safeText(E.setEchoTxt, s.echoMode || "AUTO");

      if (E.setPingHost) safeText(E.setPingHost, s.pingHost || DEFAULT_PING_HOST);
      if (E.setUpdateRateTxt) safeText(E.setUpdateRateTxt, s.updateRate || "Normal");

      if (E.setLockTxt) safeText(E.setLockTxt, s.lockCall ? "ON" : "OFF");
      if (E.setLogsTxt) safeText(E.setLogsTxt, s.autoClearLogs ? "ON" : "OFF");
    },

    syncThemeUI(mode) {
      const E = this.els;
      if (E.themeModeTxt) safeText(E.themeModeTxt, mode || "system");
    }
  };

  /* =========================
     Part 9 — SOUND (WebAudio)
     ========================= */
  const Sound = (() => {
    let ctx = null;

    function getCtx() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx;
    }
    function unlock() {
      try {
        const ac = getCtx();
        if (ac.state === "suspended") ac.resume();
      } catch (_) {}
    }
    function tone(freq, durationMs, type = "sine", gain = 0.06) {
      try {
        const ac = getCtx();
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = gain;
        o.connect(g);
        g.connect(ac.destination);
        o.start();
        o.stop(ac.currentTime + (durationMs / 1000));
      } catch (_) {}
    }
    function beepPattern() {
      tone(880, 100, "square", 0.05);
      setTimeout(() => tone(880, 100, "square", 0.05), 140);
      setTimeout(() => tone(880, 100, "square", 0.05), 280);
      setTimeout(() => tone(660, 450, "sawtooth", 0.04), 440);
    }
    function tactical() {
      tone(1200, 70, "square", 0.04);
      setTimeout(() => tone(1400, 70, "square", 0.04), 110);
      setTimeout(() => tone(1000, 90, "square", 0.04), 220);
    }
    function teesh() {
      try {
        const ac = getCtx();
        const bufferSize = Math.floor(ac.sampleRate * 0.25);
        const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.25;

        const src = ac.createBufferSource();
        const g = ac.createGain();
        g.gain.value = 0.12;
        src.buffer = buffer;
        src.connect(g);
        g.connect(ac.destination);
        src.start();
      } catch (_) {}
    }
    function tentilik() {
      tone(1200, 90, "sine", 0.05);
      setTimeout(() => tone(1600, 140, "sine", 0.05), 120);
    }
    return { unlock, beepPattern, tactical, teesh, tentilik, tone, _getCtx: () => getCtx() };
  })();

  /* =========================
     Part 10 — THEME (system/dark/light)
     ========================= */
  const Theme = (() => {
    const KEY = "theme_mode"; // system|dark|light

    function get() {
      const v = String(Store.getRaw(KEY) || "system").toLowerCase();
      if (v === "dark" || v === "light") return v;
      return "system";
    }

    function apply(mode) {
      const m = String(mode || "system").toLowerCase();
      if (m === "dark" || m === "light") {
        document.documentElement.setAttribute("data-theme", m);
        Store.setRaw(KEY, m);
        UI.syncThemeUI(m);
        return m;
      }
      // system
      document.documentElement.removeAttribute("data-theme");
      Store.setRaw(KEY, "system");
      UI.syncThemeUI("system");
      return "system";
    }

    function cycle() {
      const cur = get();
      const next = (cur === "system") ? "dark" : (cur === "dark") ? "light" : "system";
      const applied = apply(next);
      Log.write("info", "Theme: " + applied);
      AndroidBridge.vibrate(18);
    }

    function init() {
      apply(get());
    }

    return { init, get, apply, cycle };
  })();

  /* =========================
     Part 11 — DRAWER (side panel)
     ========================= */
  const Drawer = (() => {
    function isOpen() { return document.body.classList.contains("drawerOpen") || document.body.classList.contains("drawer-open"); }

    function open() {
      document.body.classList.add("drawerOpen");
      document.body.classList.add("drawer-open");
      if (UI.els.drawerOverlay){ UI.els.drawerOverlay.classList.add("show"); UI.els.drawerOverlay.classList.remove("hidden"); }
      if (UI.els.drawer){ UI.els.drawer.classList.remove("hidden"); UI.els.drawer.setAttribute("aria-hidden","false"); }
    }

    function close() {
      document.body.classList.remove("drawerOpen");
      document.body.classList.remove("drawer-open");
      // keep overlay present if your CSS uses opacity; still safe to hide
      if (UI.els.drawerOverlay){ UI.els.drawerOverlay.classList.remove("show"); UI.els.drawerOverlay.classList.add("hidden"); }
      if (UI.els.drawer){ UI.els.drawer.classList.add("hidden"); UI.els.drawer.setAttribute("aria-hidden","true"); }
    }

    function toggle() {
      if (isOpen()) close();
      else open();
    }

    function init() {
      // If your HTML already keeps drawer visible, remove hidden safely
      // We start CLOSED by default
      close();

      // Close when clicking any button with data-drawer-close
      const hook = () => {
        const root = UI.els.drawer;
        if (!root) return;
        $$(".drawerClose,[data-drawer-close]", root).forEach((el) => {
          el.addEventListener("click", () => close());
        });
      };
      hook();
    }

    return { init, open, close, toggle, isOpen };

  /* =========================
     Part 11.5 — EDGE SWIPE (Drawer by Gesture Only)
     - فتح القائمة بالسحب من الحافة فقط (بدون زر)
     - يدعم Touch + Mouse drag
     ========================= */
  const EdgeSwipe = (() => {
    const EDGE_PX = 18;
    const OPEN_PX = 44;
    const CLOSE_PX = 44;
    const SLOPE = 1.25;

    let tracking = false;
    let startX = 0, startY = 0;
    let mode = null; // 'open' | 'close'

    function isRTL(){
      try {
        const d = (document.documentElement.getAttribute('dir') || 'rtl').toLowerCase();
        return d === 'rtl';
      } catch(_) { return true; }
    }

    function point(ev){
      try {
        if (ev && ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
        if (ev && ev.changedTouches && ev.changedTouches[0]) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
        return { x: (ev && ev.clientX) ? ev.clientX : 0, y: (ev && ev.clientY) ? ev.clientY : 0 };
      } catch(_) { return { x: 0, y: 0 }; }
    }

    function nearEdge(x){
      const w = window.innerWidth || 0;
      return isRTL() ? (x >= (w - EDGE_PX)) : (x <= EDGE_PX);
    }

    function inDrawer(x, y){
      const d = UI.els.drawer;
      if (!d) return false;
      try {
        const r = d.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      } catch(_) { return false; }
    }

    function onStart(ev){
      const p = point(ev);
      const open = Drawer.isOpen();

      if (!open){
        if (!nearEdge(p.x)) return;
        tracking = true;
        mode = 'open';
        startX = p.x; startY = p.y;
        return;
      }

      // drawer open: close by swiping from drawer area OR from same edge
      if (!inDrawer(p.x, p.y) && !nearEdge(p.x)) return;
      tracking = true;
      mode = 'close';
      startX = p.x; startY = p.y;
    }

    function onMove(ev){
      if (!tracking) return;
      const p = point(ev);
      const dx = p.x - startX;
      const dy = p.y - startY;

      // Vertical scroll wins
      if (Math.abs(dy) > 10 && (Math.abs(dy) > Math.abs(dx) * SLOPE)) {
        tracking = false; mode = null;
        return;
      }

      const rtl = isRTL();
      if (mode === 'open') {
        const d = rtl ? (startX - p.x) : (p.x - startX);
        if (d > OPEN_PX) {
          Drawer.open();
          tracking = false; mode = null;
          try { ev.preventDefault(); } catch(_) {}
        }
        return;
      }

      if (mode === 'close') {
        const d = rtl ? (p.x - startX) : (startX - p.x);
        if (d > CLOSE_PX) {
          Drawer.close();
          tracking = false; mode = null;
          try { ev.preventDefault(); } catch(_) {}
        }
      }
    }

    function onEnd(){ tracking = false; mode = null; }

    function init(){
      if (window.__MDV_EDGE_SWIPE__) return;
      window.__MDV_EDGE_SWIPE__ = true;

      // pointer events preferred
      try {
        document.addEventListener('pointerdown', onStart, { passive: true });
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onEnd, { passive: true });
        document.addEventListener('pointercancel', onEnd, { passive: true });
        return;
      } catch(_) {}

      // touch fallback
      document.addEventListener('touchstart', onStart, { passive: true });
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd, { passive: true });
      document.addEventListener('touchcancel', onEnd, { passive: true });
    }

    return { init };
  })();

  /* =========================
     Part 12 — MIC HEART MONITOR (RESTORED)
     - Works best with <canvas id="micWave"></canvas>
     ========================= */
  const MicViz = (() => {
    let canvas = null;
    let ctx = null;
    let ac = null;
    let analyser = null;
    let src = null;
    let data = null;
    let raf = 0;

    let lastY = 0;
    let lastLevel = 0; // 0..1
    let beatCooldown = 0;

    function _cssVar(name, fallback) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name);
        const s = String(v || "").trim();
        return s || fallback;
      } catch (_) { return fallback; }
    }

    function _ensureCanvasSize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const w = Math.max(60, Math.floor(rect.width * dpr));
      const h = Math.max(30, Math.floor(rect.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      if (!ctx) ctx = canvas.getContext("2d");
    }

    function _clear() {
      if (!ctx || !canvas) return;
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function _drawBeat(x, mid, amp, color) {
      // ECG spike pattern
      const h = canvas.height;
      const top = Math.max(4, mid - amp * (h * 0.46) - 8);
      const bot = Math.min(h - 4, mid + amp * (h * 0.18) + 10);

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.floor(canvas.width / 420));
      ctx.beginPath();
      ctx.moveTo(x - 10, mid);
      ctx.lineTo(x - 6, mid);
      ctx.lineTo(x - 4, top);
      ctx.lineTo(x - 2, mid + 6);
      ctx.lineTo(x + 2, bot);
      ctx.lineTo(x + 6, mid);
      ctx.lineTo(x + 10, mid);
      ctx.stroke();
    }

    function _loop() {
      if (!canvas || !ctx || !analyser || !data) return;
      raf = requestAnimationFrame(_loop);

      _ensureCanvasSize();
      const w = canvas.width;
      const h = canvas.height;
      const mid = Math.floor(h / 2);

      // scroll left
      const dx = Math.max(1, Math.floor(w / 160)); // speed based on width
      ctx.drawImage(canvas, -dx, 0);

      // fade right band
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.16)";
      ctx.fillRect(w - dx, 0, dx, h);

      analyser.getByteTimeDomainData(data);

      // RMS level
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      lastLevel = Math.max(0, Math.min(1, rms));

      // map to y
      const amp = Math.min(1, rms * 3.0); // boost
      const y = mid - amp * (h * 0.40);

      // stroke color from CSS var
      const color = _cssVar("--purple", "#a855f7");

      // draw line segment on right
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.floor(w / 380));
      ctx.beginPath();
      ctx.moveTo(w - dx - 1, lastY || mid);
      ctx.lineTo(w - 1, y);
      ctx.stroke();

      // beat detection (voice peaks)
      beatCooldown = Math.max(0, beatCooldown - 1);
      if (amp > 0.20 && beatCooldown === 0) {
        _drawBeat(w - Math.floor(dx / 2), mid, amp, color);
        beatCooldown = 18; // cooldown frames
      }

      // subtle baseline
      ctx.strokeStyle = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w - dx, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      lastY = y;
    }

    function stop() {
      try { if (raf) cancelAnimationFrame(raf); } catch (_) {}
      raf = 0;
      try { if (src) src.disconnect(); } catch (_) {}
      try { if (analyser) analyser.disconnect(); } catch (_) {}
      src = null;
      analyser = null;
      data = null;
      lastLevel = 0;
      lastY = 0;
      beatCooldown = 0;
      if (canvas && canvas.getContext) {
        ctx = canvas.getContext("2d");
        if (ctx) _clear();
      }
    }

    function start(targetCanvasEl, mediaStreamTrack) {
      canvas = targetCanvasEl && targetCanvasEl.tagName === "CANVAS" ? targetCanvasEl : null;
      if (!canvas) {
        // إذا ما عندك Canvas بنفس الـ ID، ما نكسر التطبيق
        return false;
      }

      try { ac = Sound._getCtx(); } catch (_) { ac = null; }
      if (!ac) return false;

      try {
        const t = mediaStreamTrack || null;
        if (!t) return false;

        const stream = new MediaStream([t]);
        src = ac.createMediaStreamSource(stream);
        analyser = ac.createAnalyser();
        analyser.fftSize = 2048;

        data = new Uint8Array(analyser.fftSize);

        src.connect(analyser);

        _ensureCanvasSize();
        _clear();

        lastY = Math.floor(canvas.height / 2);
        lastLevel = 0;

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(_loop);
        return true;
      } catch (_) {
        stop();
        return false;
      }
    }

    function level() { return lastLevel || 0; }

    return { start, stop, level };
  })();

  /* =========================
     Part 13 — FIREBASE COMPAT WRAPPER
     ========================= */
  const DB = (() => {
    let inited = false;
    let fs = null;
    let auth = null;

    function hasSDK() {
      return !!(window.firebase && typeof window.firebase.initializeApp === "function");
    }

    function initFirebaseCompat() {
      if (inited) return !!fs;
      inited = true;

      if (!hasSDK()) return false;

      try {
        if (!(window.firebase.apps && window.firebase.apps.length > 0)) {
          for (let i = 0; i < FIREBASE_CONFIGS.length; i++) {
            const cfg = FIREBASE_CONFIGS[i];
            try {
              window.firebase.initializeApp(cfg);
              break;
            } catch (_) {}
          }
        }

        auth = window.firebase.auth ? window.firebase.auth() : null;
        fs = window.firebase.firestore ? window.firebase.firestore() : null;

        try {
          if (auth && auth.setPersistence && window.firebase.auth && window.firebase.auth.Auth && window.firebase.auth.Auth.Persistence) {
            auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
          }
        } catch (_) {}

        return !!fs;
      } catch (_) {
        auth = null;
        fs = null;
        return false;
      }
    }

    function ready() { return fs ? true : initFirebaseCompat(); }
    function authReady() { return ready() && !!auth; }

    function serverTimestamp() {
      try { return window.firebase.firestore.FieldValue.serverTimestamp(); } catch (_) { return null; }
    }

    function doc(path) { return ready() ? fs.doc(path) : null; }
    function col(path) { return ready() ? fs.collection(path) : null; }

    async function set(pathOrRef, data, merge = true) {
      if (!ready()) return false;
      const ref = (typeof pathOrRef === "string") ? doc(pathOrRef) : pathOrRef;
      if (!ref) return false;
      await ref.set(data, { merge });
      return true;
    }

    async function add(path, data) {
      const c = col(path);
      if (!c) return null;
      return await c.add(data);
    }

    function onSnapshot(queryOrRef, cb, errCb) {
      if (!queryOrRef) return () => {};
      return queryOrRef.onSnapshot(cb, errCb);
    }

    function onAuthStateChanged(cb) {
      if (!authReady()) return () => {};
      try { return auth.onAuthStateChanged(cb); } catch (_) { return () => {}; }
    }

    async function signInAnonymously() {
      if (!authReady()) return null;
      try { return await auth.signInAnonymously(); } catch (_) { return null; }
    }

    function currentUser() {
      try { return authReady() ? auth.currentUser : null; } catch (_) { return null; }
    }

    async function queryUsersByEmail(email) {
      if (!ready()) return [];
      const e = String(email || "").trim().toLowerCase();
      if (!e) return [];
      try {
        const snap = await fs.collection("usersPublic").where("emailLower", "==", e).limit(10).get();
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        return out;
      } catch (_) { return []; }
    }

    async function queryUsersByNamePrefix(name) {
      if (!ready()) return [];
      const n = String(name || "").trim().toLowerCase();
      if (!n) return [];
      try {
        const end = n + "\uf8ff";
        const q = fs.collection("usersPublic")
          .orderBy("displayNameLower")
          .startAt(n)
          .endAt(end)
          .limit(10);
        const snap = await q.get();
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        return out;
      } catch (_) { return []; }
    }

    return {
      ready,
      authReady,
      serverTimestamp,
      doc,
      col,
      set,
      add,
      onSnapshot,
      onAuthStateChanged,
      signInAnonymously,
      currentUser,
      queryUsersByEmail,
      queryUsersByNamePrefix
    };
  })();

  /* =========================
     Part 14 — AUTH SYNC
     ========================= */
  const AuthSync = (() => {
    let lastSource = "none"; // android | firebase | none

    function isAnonymousUser(u) {
      try { return !!(u && u.isAnonymous); } catch (_) { return false; }
    }

    function applyProfile(p, source) {
      const name = String(p.name || "").trim() || (p.email ? safeNameFromEmail(p.email) : "User");
      const email = String(p.email || "").trim();
      const photoUrl = normalizePhotoUrl(p.photoUrl);

      App.state.profile.loggedIn = !!(email || name);
      App.state.profile.displayName = name;
      App.state.profile.email = email;
      App.state.profile.photoUrl = photoUrl;

      const locked = !!(source === "android" || source === "firebase");
      UI.setProfile({ name, email: email || "لم يتم تسجيل الدخول", photoUrl, locked });
      App.persistLocal();

      lastSource = source || "none";
      Log.write("good", `Profile updated (${lastSource}) ✅`);
    }

    function clearProfile(reason) {
      App.state.profile.loggedIn = false;
      App.state.profile.uid = null;

      const keepName = App.state.profile.displayNameLocal || "Guest";
      App.state.profile.displayName = keepName;
      App.state.profile.email = "";
      App.state.profile.photoUrl = "";

      UI.setProfile({
        name: keepName,
        email: "لم يتم تسجيل الدخول",
        photoUrl: "",
        locked: false
      });

      lastSource = "none";
      Log.write("warn", reason || "Profile cleared");
    }

    function onAndroidLogin(name, email, photoUrl) {
      const e = String(email || "").trim();
      const n = String(name || "").trim() || safeNameFromEmail(e);
      applyProfile({ name: n, email: e, photoUrl }, "android");
    }

    function onAndroidLogout() { clearProfile("Android logout"); }

    function onFirebaseUserChanged(user) {
      if (!user) {
        if (lastSource === "android") {
          Log.write("info", "Firebase user null (kept Android profile)");
          return;
        }
        clearProfile("Firebase signed out");
        return;
      }

      if (isAnonymousUser(user)) {
        if (lastSource === "android") {
          Log.write("info", "Firebase anonymous (kept Android profile)");
          return;
        }
        const localName = App.state.profile.displayNameLocal || "Guest";
        UI.setProfile({ name: localName, email: "لم يتم تسجيل الدخول", photoUrl: "", locked: false });
        Log.write("info", "Firebase anonymous session");
        return;
      }

      const email = user.email || "";
      const name = user.displayName || safeNameFromEmail(email);
      const photoUrl = user.photoURL || "";
      applyProfile({ name, email, photoUrl }, "firebase");
    }

    function init() {
      const localName = App.state.profile.displayNameLocal || App.state.profile.displayName || "Guest";
      const localEmail = App.state.profile.email || "";
      const localPhoto = App.state.profile.photoUrl || "";
      UI.setProfile({ name: localName, email: localEmail || "لم يتم تسجيل الدخول", photoUrl: localPhoto, locked: false });

      const prevOnAndroidUser = window.onAndroidUser;
      window.onAndroidUser = function(name, email, photo) {
        try { if (typeof prevOnAndroidUser === "function") prevOnAndroidUser(name, email, photo); } catch (_) {}
        try { onAndroidLogin(name, email, photo); } catch (_) {}
      };

      window.onAndroidLogin = function(name, email, photoUrl) { try { onAndroidLogin(name, email, photoUrl); } catch (_) {} };
      window.onAndroidLogout = function() { try { onAndroidLogout(); } catch (_) {} };
      window.onAndroidLoginFail = function(msg) { try { Log.write("bad", "Login failed: " + String(msg || "")); } catch (_) {} };
    }

    return { init, onFirebaseUserChanged, onAndroidLogin, onAndroidLogout, clearProfile };
  })();

  /* =========================
     Part 15 — AGORA WRAPPER
     ========================= */
  const Voice = (() => {
    let client = null;
    let localTrack = null;
    let joined = false;
    const remote = new Map(); // uid -> audioTrack

    function hasSDK() { return !!window.AgoraRTC; }
    function isJoined() { return joined; }
    function getLocalTrack() { return localTrack; }
    function getLocalMediaStreamTrack() {
      try {
        if (!localTrack) return null;
        if (typeof localTrack.getMediaStreamTrack === "function") return localTrack.getMediaStreamTrack();
        return null;
      } catch (_) { return null; }
    }

    async function join({ appId, channel, token, uid }) {
      if (!hasSDK()) throw new Error("AgoraRTC not loaded");
      if (!appId) throw new Error("Agora APP_ID missing");
      if (!channel) throw new Error("Channel missing");

      if (!client) {
        client = window.AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        wireEvents();
      }

      await client.join(appId, channel, token || null, uid || null);
      localTrack = await window.AgoraRTC.createMicrophoneAudioTrack();
      await client.publish([localTrack]);

      joined = true;
      return true;
    }

    async function leave() {
      if (!client) return;

      try {
        if (localTrack) {
          localTrack.stop();
          localTrack.close();
        }
      } catch (_) {}
      localTrack = null;

      try {
        for (const [, tr] of remote.entries()) {
          try { tr.stop && tr.stop(); } catch (_) {}
        }
        remote.clear();
      } catch (_) {}

      try { await client.leave(); } catch (_) {}
      joined = false;
    }

    function setMicMuted(muted) {
      if (!localTrack) return;
      try {
        if (typeof localTrack.setEnabled === "function") localTrack.setEnabled(!muted);
        else if (typeof localTrack.setMuted === "function") localTrack.setMuted(!!muted);
      } catch (_) {}
    }

    function setSpeakerMuted(muted) {
      for (const [, tr] of remote.entries()) {
        try { if (tr && typeof tr.setVolume === "function") tr.setVolume(muted ? 0 : 100); } catch (_) {}
      }
    }

    function wireEvents() {
      if (!client) return;

      client.on("user-published", async (user, mediaType) => {
        try {
          await client.subscribe(user, mediaType);
          if (mediaType === "audio" && user.audioTrack) {
            user.audioTrack.play();
            remote.set(String(user.uid), user.audioTrack);
            App.onRemoteUsersChanged();
          }
        } catch (e) {
          Log.write("bad", "Agora subscribe failed: " + errToText(e));
        }
      });

      client.on("user-unpublished", (user, mediaType) => {
        try {
          if (mediaType === "audio") {
            const tr = remote.get(String(user.uid));
            try { tr && tr.stop && tr.stop(); } catch (_) {}
            remote.delete(String(user.uid));
            App.onRemoteUsersChanged();
          }
        } catch (_) {}
      });

      client.on("user-left", (user) => {
        try {
          const tr = remote.get(String(user.uid));
          try { tr && tr.stop && tr.stop(); } catch (_) {}
          remote.delete(String(user.uid));
          App.onRemoteUsersChanged();
        } catch (_) {}
      });

      client.on("network-quality", (stats) => {
        App.onAgoraNetworkQuality(stats);
      });

      client.on("exception", (e) => {
        Log.write("bad", "Agora exception: " + errToText(e));
      });
    }

    return { hasSDK, join, leave, isJoined, setMicMuted, setSpeakerMuted, getLocalTrack, getLocalMediaStreamTrack };
  })();

  /* =========================
     Part 16 — NORMALIZERS + HISTORY
     ========================= */
  function normalizeFriend(f) {
    const o = { ...(f || {}) };
    o.uid = String(o.uid || o.id || "").trim();
    o.displayName = String(o.displayName || "Friend").trim();
    o.email = String(o.email || "").trim();
    o.photoUrl = String(o.photoUrl || "").trim();
    o.id = String(o.id || o.uid || o.email || uidShort()).trim();
    return o;
  }

  const CallHistory = (() => {
    const KEY = "call_history";
    const MAX = 50;

    function list() {
      const a = Store.getJson(KEY, []);
      return Array.isArray(a) ? a : [];
    }

    function push(item) {
      const a = list();
      a.unshift(item);
      while (a.length > MAX) a.pop();
      Store.setJson(KEY, a);
    }

    function mark(type, payload) {
      push({ t: now(), type: String(type || "event"), payload: payload || {} });
    }

    return { list, mark };
  })();

  /* =========================
     Part 17 — APP STATE + INIT
     ========================= */
  const App = {
    state: {
      profile: {
        loggedIn: false,
        uid: null,
        displayName: "Guest",
        email: "",
        photoUrl: "",
        displayNameLocal: ""
      },

      call: {
        inCall: false,
        joining: false,
        leaving: false,
        channel: "",
        token: "",
        startAt: 0,
        timerT: null,
        usageT: null
      },

      speakerOn: false,
      micMuted: false,
      speakerMuted: false,

      fm: {
        enabled: false,
        intervalMs: FM_INTERVAL_MS, // LOCKED
        running: false,
        loopT: null,
        abort: false
      },

      net: {
        type: "none",
        rssi: null,
        linkMbps: null,
        hasInternet: false,
        pingMs: -1,
        jitterMs: 0,
        lossPct: 0,
        upKbps: 0,
        downKbps: 0,
        audioLevel: 0
      },

      friends: { list: [], selected: new Set() },

      incoming: {
        active: false,
        docPath: null,
        fromName: "",
        fromEmail: "",
        channel: "",
        createdAt: 0
      },

      settings: {
        speakerDefault: false,
        micDefault: true,
        soundDefault: true,
        echoMode: "AUTO",
        pingHost: DEFAULT_PING_HOST,
        updateRate: "Normal", // Low/Normal/High
        lockCall: false,
        autoClearLogs: false
      },

      unsub: {
        incomingCalls: null,
        auth: null
      },

      __presenceT: null,
      __netT: null,
      __pingT: null,
      __audioT: null,

      __domObserver: null
    },

    init() {
      this.ensureUIBound();
      this.loadLocal();

      Theme.init();        // NEW
      Drawer.init();       // NEW
      EdgeSwipe.init();     // NEW (gesture open/close)
      AuthSync.init();

      // LEDs initial
      UI.setLed(UI.els.ledWeb, "on");
      UI.setLed(UI.els.ledFirebase, DB.ready() ? "warn" : "bad");
      UI.setLed(UI.els.ledListener, "off");
      UI.setLed(UI.els.ledMicPerm, "off");
      UI.setLed(UI.els.ledAgora, Voice.hasSDK() ? "warn" : "bad");
      UI.setLed(UI.els.ledInCall, "off");
      UI.setLed(UI.els.ledNet, "off");
      UI.setLed(UI.els.ledSrv, "off");
      UI.setLed(UI.els.ledCallQ, "off");

      this.syncForceMajeureUI();
      this.renderFriends();
      this.initFirebaseAuth();

      this.startNetworkMonitor();
      this.startPingMonitor();
      this.startAudioMeter(); // NEW (updates audioLevel from MicViz)

      UI.setCallTimer(0);
      UI.setCallState("disconnected");

      UI.syncSettingsUI(this.state.settings);
      this.syncButtonsText();

      Log.write("good", "App ready ✅");
      Log.write("info", Voice.hasSDK() ? "Agora SDK: OK" : "Agora SDK: NOT LOADED (check script)");
      Log.write("info", "Version: " + APP_VERSION);

      try { console.log("✅ App.js loaded, AGORA_APP_ID =", AGORA_APP_ID); } catch (_) {}
      this.attachLifecycle();
    },

    /* =========================
       Part 18 — UI REBIND + LIFECYCLE
       ========================= */
    ensureUIBound() {
      const mustExist = () => {
        const a = byId("joinBtn");
        const b = byId("leaveBtn");
        const c = byId("channel");
        const d = byId("log");
        return !!(a && b && c && d);
      };

      const doBind = () => {
        try {
          UI.bind();
          Log.write("good", "UI bound ✅");
          UI.syncSettingsUI(this.state.settings);
          UI.syncThemeUI(Theme.get());
          this.syncButtonsText();
        } catch (e) {
          try { console.warn(e); } catch (_) {}
        }
      };

      if (mustExist()) {
        doBind();
        return;
      }

      try {
        if (this.state.__domObserver) {
          this.state.__domObserver.disconnect();
          this.state.__domObserver = null;
        }
      } catch (_) {}

      const obs = new MutationObserver(() => {
        if (mustExist()) {
          doBind();
          try { obs.disconnect(); } catch (_) {}
        }
      });

      try {
        obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
        this.state.__domObserver = obs;
      } catch (_) {}

      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (mustExist()) {
          clearInterval(t);
          doBind();
          return;
        }
        if (tries >= 12) {
          clearInterval(t);
          try { console.warn("UI bind timed out, check IDs in index.html"); } catch (_) {}
        }
      }, 250);
    },

    attachLifecycle() {
      const onHide = () => { try { this.setPresenceState("offline"); } catch (_) {} };
      const onShow = () => {
        try { this.setPresenceState(this.state.call.inCall ? "in_call" : "online"); } catch (_) {}
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") onHide();
        else onShow();
      });

      window.addEventListener("pagehide", () => onHide());
      window.addEventListener("beforeunload", () => onHide());
    },

    syncForceMajeureUI() {
      if (UI.els.swFM) UI.els.swFM.checked = !!this.state.fm.enabled;

      if (UI.els.fmIntervalSel) {
        UI.els.fmIntervalSel.value = String(FM_INTERVAL_MS);
        UI.els.fmIntervalSel.disabled = true;
      }
      if (UI.els.fmRebootSel) {
        UI.els.fmRebootSel.value = String(FM_REBOOT_SECONDS);
        UI.els.fmRebootSel.disabled = true;
      }

      this.state.fm.intervalMs = FM_INTERVAL_MS;
    },

    syncButtonsText() {
      if (UI.els.btnSpeaker) safeText(UI.els.btnSpeaker, this.state.speakerOn ? "🔊 Speaker: ON" : "🔊 Speaker: OFF");
      if (UI.els.btnMuteMic) safeText(UI.els.btnMuteMic, this.state.micMuted ? "🎙️ Mic: OFF" : "🎙️ Mic: ON");
      if (UI.els.btnMuteSpk) safeText(UI.els.btnMuteSpk, this.state.speakerMuted ? "🔇 Sound: OFF" : "🔇 Sound: ON");
    },

    /* =========================
       Part 19 — LOCAL LOAD/SAVE + AUTH
       ========================= */
    loadLocal() {
      const s = Store.getJson("state", null);
      if (!s) return;

      try {
        if (s.profile) {
          this.state.profile.displayNameLocal = s.profile.displayNameLocal || "";
          this.state.profile.email = s.profile.email || "";
          this.state.profile.photoUrl = s.profile.photoUrl || "";
          this.state.profile.displayName = s.profile.displayName || this.state.profile.displayName;
        }

        if (s.friends && Array.isArray(s.friends.list)) {
          this.state.friends.list = s.friends.list.map(normalizeFriend);
        }

        if (s.fm) {
          this.state.fm.enabled = !!s.fm.enabled;
          this.state.fm.intervalMs = FM_INTERVAL_MS;
        }

        if (s.settings) {
          const x = s.settings;
          this.state.settings.speakerDefault = !!x.speakerDefault;
          this.state.settings.micDefault = (x.micDefault !== undefined) ? !!x.micDefault : true;
          this.state.settings.soundDefault = (x.soundDefault !== undefined) ? !!x.soundDefault : true;
          this.state.settings.echoMode = String(x.echoMode || "AUTO").toUpperCase();
          this.state.settings.pingHost = String(x.pingHost || DEFAULT_PING_HOST);
          this.state.settings.updateRate = String(x.updateRate || "Normal");
          this.state.settings.lockCall = !!x.lockCall;
          this.state.settings.autoClearLogs = !!x.autoClearLogs;
        }
      } catch (_) {}
    },

    persistLocal() {
      const s = {
        profile: {
          displayNameLocal: this.state.profile.displayNameLocal || "",
          displayName: this.state.profile.displayName || "Guest",
          email: this.state.profile.email || "",
          photoUrl: this.state.profile.photoUrl || ""
        },
        friends: { list: this.state.friends.list || [] },
        fm: { enabled: !!this.state.fm.enabled, intervalMs: FM_INTERVAL_MS },
        settings: { ...this.state.settings }
      };
      Store.setJson("state", s);
    },

    getPresenceRoom() {
      const v = UI.els.inPresence ? (UI.els.inPresence.value || "").trim() : "";
      return v || "call_room1";
    },

    getChannel() {
      const v = UI.els.inChannel ? (UI.els.inChannel.value || "").trim() : "";
      return v;
    },

    getToken() {
      const v = UI.els.inToken ? (UI.els.inToken.value || "").trim() : "";
      return v;
    },

    getName() {
      const v = UI.els.inName ? (UI.els.inName.value || "").trim() : "";
      return v || this.state.profile.displayNameLocal || this.state.profile.displayName || "User";
    },

    getMyUid() {
      const u = DB.currentUser && DB.currentUser();
      if (u && u.uid) return u.uid;

      let id = Store.getRaw("pseudo_uid");
      if (!id) {
        id = "device_" + uidShort();
        Store.setRaw("pseudo_uid", id);
      }
      return id;
    },

    getBlockUntil() {
      const v = Number(Store.getRaw("block_until") || "0");
      return Number.isFinite(v) ? v : 0;
    },

    setBlockUntil(ts) {
      Store.setRaw("block_until", String(ts || 0));
    },

    async upsertMyPublicProfile() {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      const dn = this.getName();

      const payload = {
        uid,
        displayName: dn,
        displayNameLower: dn.toLowerCase(),
        email: this.state.profile.email || "",
        emailLower: (this.state.profile.email || "").toLowerCase(),
        photoUrl: this.state.profile.photoUrl || "",
        updatedAt: DB.serverTimestamp() || now()
      };

      await DB.set(`usersPublic/${uid}`, payload, true);
    },

    initFirebaseAuth() {
      if (!DB.authReady()) {
        UI.setLed(UI.els.ledFirebase, "bad");
        Log.write("warn", "Firebase SDK غير محمّل");
        return;
      }

      try { if (this.state.unsub.auth) this.state.unsub.auth(); } catch (_) {}

      this.state.unsub.auth = DB.onAuthStateChanged(async (user) => {
        AuthSync.onFirebaseUserChanged(user);

        if (user) {
          this.state.profile.uid = user.uid;
          UI.setLed(UI.els.ledFirebase, "on");

          this.watchIncomingCalls(true);
          this.startPresenceHeartbeat(true);

          this.upsertMyPublicProfile().catch(() => {});
        } else {
          UI.setLed(UI.els.ledFirebase, "warn");
          const res = await DB.signInAnonymously();
          if (!res) Log.write("warn", "Anonymous sign-in failed (check Firebase config)");
        }
      });
    },

    /* =========================
       Part 20 — CALL FLOW
       ========================= */
    async joinFlow() {
      if (this.state.call.joining) {
        Log.write("warn", "Join already running...");
        return;
      }
      this.state.call.joining = true;

      try {
        const blockUntil = this.getBlockUntil();
        if (blockUntil && now() < blockUntil) {
          const leftSec = Math.ceil((blockUntil - now()) / 1000);
          Log.write("bad", `تم حظر المكالمات مؤقتاً ⛔ (${fmtTime(leftSec)})`);
          return;
        }

        const channel = this.getChannel();
        if (!channel) {
          Log.write("warn", "اكتب Channel يدويًا أولاً");
          return;
        }

        if (!AGORA_APP_ID || !String(AGORA_APP_ID).trim()) {
          Log.write("bad", "AGORA_APP_ID غير موجود");
          UI.setLed(UI.els.ledAgora, "bad");
          return;
        }

        if (!Voice.hasSDK()) {
          Log.write("bad", "AgoraRTC غير محمّل (تحقق من رابط SDK)");
          UI.setLed(UI.els.ledAgora, "bad");
          return;
        }

        if (!window.isSecureContext && !AndroidBridge.exists()) {
          Log.write("warn", "تنبيه: البيئة ليست SecureContext — قد تمنع صلاحية المايك");
        }

        const token = this.getToken();
        Log.write("warn", `Joining: ${channel}`);

        try {
          AndroidBridge.setCallMode(true);
          UI.setLed(UI.els.ledAgora, "warn");

          await Voice.join({ appId: AGORA_APP_ID, channel, token, uid: null });

          UI.setLed(UI.els.ledMicPerm, "on");
          UI.setLed(UI.els.ledAgora, "on");

          // Apply defaults
          this.state.speakerOn = !!this.state.settings.speakerDefault;
          this.state.micMuted = !this.state.settings.micDefault;
          this.state.speakerMuted = !this.state.settings.soundDefault;

          AndroidBridge.setSpeaker(this.state.speakerOn);
          Voice.setMicMuted(this.state.micMuted);
          Voice.setSpeakerMuted(this.state.speakerMuted);
          this.syncButtonsText();

          // Start mic heart monitor (RESTORED)
          const mst = Voice.getLocalMediaStreamTrack();
          if (mst && UI.els.micWave) {
            const ok = MicViz.start(UI.els.micWave, mst);
            if (ok) Log.write("good", "Mic Heart Monitor: ON ❤️");
            else Log.write("warn", "Mic Heart Monitor: element/track missing");
          } else {
            Log.write("warn", "Mic Heart Monitor: add <canvas id='micWave'> in HTML");
          }

          this.state.call.inCall = true;
          this.state.call.channel = channel;
          this.state.call.token = token;
          this.state.call.startAt = now();

          this.startCallTimer();
          this.startUsageTick();

          UI.setCallState("connected");
          Log.write("good", "✅ CONNECTED");

          CallHistory.mark("join", { channel });

          this.setPresenceState("in_call");

          if (this.state.fm.enabled) this.startForceMajeureLoop();
        } catch (e) {
          const why = errToText(e);
          Log.write("bad", "Join failed (Agora): " + why);
          Log.write("warn", "أسباب شائعة: صلاحية المايك، SDK لم يحمل، Token مطلوب.");

          const low = String(why).toLowerCase();
          UI.setLed(UI.els.ledMicPerm, (low.includes("notallowed") || low.includes("permission")) ? "bad" : "warn");
          UI.setLed(UI.els.ledAgora, "bad");
          UI.setCallState("disconnected");
          AndroidBridge.setCallMode(false);

          this.state.call.inCall = false;
          this.stopCallTimer();
          this.stopUsageTick();

          MicViz.stop();

          CallHistory.mark("join_fail", { channel, error: why });
        }
      } finally {
        this.state.call.joining = false;
      }
    },

    async leaveFlow() {
      if (this.state.call.leaving) {
        Log.write("warn", "Leave already running...");
        return;
      }
      this.state.call.leaving = true;

      try {
        this.stopForceMajeureLoop();
        Log.write("warn", "Leaving...");

        try { await Voice.leave(); } catch (_) {}
        AndroidBridge.setCallMode(false);

        this.state.call.inCall = false;
        this.state.call.channel = "";
        this.state.call.token = "";

        this.stopCallTimer();
        this.stopUsageTick();

        MicViz.stop();
        this.state.net.audioLevel = 0;

        UI.setLed(UI.els.ledAgora, "off");
        UI.setCallState("disconnected");
        Log.write("good", "تم الخروج");

        CallHistory.mark("leave", {});
        this.setPresenceState("online");
      } finally {
        this.state.call.leaving = false;
      }
    },

    endCall() {
      try { AndroidBridge.endCall(); } catch (_) {}
      return this.leaveFlow();
    },

    startCallTimer() {
      this.stopCallTimer();
      this.state.call.timerT = setInterval(() => {
        if (!this.state.call.inCall || !this.state.call.startAt) return UI.setCallTimer(0);
        const sec = Math.floor((now() - this.state.call.startAt) / 1000);
        UI.setCallTimer(sec);
      }, 1000);
    },

    stopCallTimer() {
      if (this.state.call.timerT) clearInterval(this.state.call.timerT);
      this.state.call.timerT = null;
      UI.setCallTimer(0);
    },

    startUsageTick() {
      this.stopUsageTick();
      this.state.call.usageT = setInterval(async () => {
        try {
          if (!this.state.call.inCall) return;
          const dur = now() - (this.state.call.startAt || now());
          if (dur >= CALL_LIMIT_MS) {
            Log.write("bad", "⛔ تم الوصول للحد (3 ساعات) — سيتم إغلاق المكالمة وبدء حظر 20 ساعة");
            Sound.beepPattern();
            AndroidBridge.vibrate(120);

            await this.leaveFlow();

            const until = now() + BLOCK_MS;
            this.setBlockUntil(until);
            Log.write("warn", `حظر: ${fmtTime(Math.ceil(BLOCK_MS / 1000))}`);

            CallHistory.mark("blocked", { until });
          }
        } catch (_) {}
      }, USAGE_TICK_MS);
    },

    stopUsageTick() {
      if (this.state.call.usageT) clearInterval(this.state.call.usageT);
      this.state.call.usageT = null;
    },

    onRemoteUsersChanged() {},

    toggleSpeaker() {
      this.state.speakerOn = !this.state.speakerOn;
      AndroidBridge.setSpeaker(this.state.speakerOn);
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.speakerOn ? "🔊 Speaker ON" : "🔈 Speaker OFF");
    },

    toggleMuteMic() {
      this.state.micMuted = !this.state.micMuted;
      try { Voice.setMicMuted(this.state.micMuted); } catch (_) {}
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.micMuted ? "🎙️ Mic MUTED" : "🎙️ Mic ON");
    },

    toggleMuteSpeaker() {
      this.state.speakerMuted = !this.state.speakerMuted;
      try { Voice.setSpeakerMuted(this.state.speakerMuted); } catch (_) {}
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.speakerMuted ? "🔇 Output MUTED" : "🔊 Output ON");
    },

    /* =========================
       Part 21 — FORCE MAJEURE (LOCKED)
       ========================= */
    toggleForceMajeure() {
      this.state.fm.enabled = !!(UI.els.swFM && UI.els.swFM.checked);
      this.state.fm.intervalMs = FM_INTERVAL_MS;
      this.persistLocal();

      if (this.state.fm.enabled) {
        Log.write("warn", "FM: ON (كل دقيقتين)");
        Sound.tactical();
        if (this.state.call.inCall) this.startForceMajeureLoop();
      } else {
        Log.write("good", "FM: OFF");
        this.stopForceMajeureLoop();
      }
    },

    startForceMajeureLoop() {
      const fm = this.state.fm;
      fm.intervalMs = FM_INTERVAL_MS;
      if (!fm.enabled) return;
      if (fm.running) return;
      if (!this.state.call.inCall) return;

      fm.running = true;
      fm.abort = false;

      const loop = async () => {
        if (!fm.enabled || fm.abort) return;

        await sleepWithAbort(fm.intervalMs, () => (!fm.enabled || fm.abort || !this.state.call.inCall));
        if (!fm.enabled || fm.abort) return;
        if (!this.state.call.inCall) { fm.running = false; return; }

        Sound.beepPattern();
        AndroidBridge.vibrate(60);
        Log.write("warn", "FM: Alarm!");

        const ch = this.getChannel() || this.state.call.channel;
        const token = this.getToken() || this.state.call.token;

        try { await Voice.leave(); } catch (_) {}
        AndroidBridge.setCallMode(false);

        this.state.call.inCall = false;
        this.stopCallTimer();
        this.stopUsageTick();

        UI.setCallState("disconnected");
        UI.setLed(UI.els.ledAgora, "warn");

        let count = FM_REBOOT_SECONDS;
        UI.showReboot(true, count);
        Sound.teesh();

        while (count > 0 && fm.enabled && !fm.abort) {
          UI.showReboot(true, count);
          await sleep(1000);
          count--;
        }

        UI.showReboot(false, 0);
        if (!fm.enabled || fm.abort) { fm.running = false; return; }

        Sound.tentilik();
        Log.write("warn", "FM: Reconnect...");

        try {
          AndroidBridge.setCallMode(true);
          await Voice.join({ appId: AGORA_APP_ID, channel: ch, token, uid: null });

          Voice.setMicMuted(this.state.micMuted);
          Voice.setSpeakerMuted(this.state.speakerMuted);

          // restart visualizer after reconnect
          const mst = Voice.getLocalMediaStreamTrack();
          if (mst && UI.els.micWave) MicViz.start(UI.els.micWave, mst);

          this.state.call.inCall = true;
          this.state.call.startAt = now();

          this.startCallTimer();
          this.startUsageTick();

          UI.setCallState("connected");
          UI.setLed(UI.els.ledAgora, "on");
          UI.setLed(UI.els.ledMicPerm, "on");

          Log.write("good", "FM: ✅ Reconnected");
          CallHistory.mark("fm_reconnect", { channel: ch });
        } catch (e) {
          Log.write("bad", "FM: Rejoin failed: " + errToText(e));
          UI.setLed(UI.els.ledAgora, "bad");
          AndroidBridge.setCallMode(false);
          fm.running = false;
          CallHistory.mark("fm_fail", { error: errToText(e) });
          return;
        }

        if (fm.enabled && !fm.abort) fm.loopT = setTimeout(loop, 50);
        else fm.running = false;
      };

      fm.loopT = setTimeout(loop, 50);
    },

    stopForceMajeureLoop() {
      const fm = this.state.fm;
      fm.abort = true;
      fm.running = false;
      if (fm.loopT) clearTimeout(fm.loopT);
      fm.loopT = null;
      UI.showReboot(false, 0);
    },

    onAgoraNetworkQuality(stats) {
      if (!stats) return;

      const up = Number(stats.uplinkNetworkQuality || 0);
      const down = Number(stats.downlinkNetworkQuality || 0);
      const q = Math.max(up, down);

      let level = "warn";
      if (q === 0) level = "warn";
      else if (q <= 2) level = "on";
      else if (q === 3) level = "warn";
      else level = "bad";

      UI.setLed(UI.els.ledCallQ, level);

      this.state.net.jitterMs = (level === "on") ? 10 : (level === "warn") ? 25 : 70;
      this.state.net.lossPct = (level === "on") ? 0.8 : (level === "warn") ? 3.5 : 12;
      this.updateQualityPanels();
    },

    /* =========================
       Part 22 — PRESENCE + INCOMING CALLS
       ========================= */
    async startPresenceHeartbeat(force = false) {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      if (!uid) return;

      if (this.state.__presenceT && !force) return;
      if (this.state.__presenceT) clearInterval(this.state.__presenceT);

      const roomId = this.getPresenceRoom();
      const path = `presenceRooms/${roomId}/users/${uid}`;

      const writePresence = async () => {
        const payload = {
          uid,
          displayName: this.getName(),
          email: this.state.profile.email || "",
          photoUrl: this.state.profile.photoUrl || "",
          state: this.state.call.inCall ? "in_call" : "online",
          lastSeen: DB.serverTimestamp() || now()
        };
        try { await DB.set(path, payload, true); } catch (_) {}
      };

      await writePresence();
      this.state.__presenceT = setInterval(writePresence, 15000);
    },

    setPresenceState(state) {
      if (!DB.ready()) return;
      const uid = this.getMyUid();
      const roomId = this.getPresenceRoom();
      const path = `presenceRooms/${roomId}/users/${uid}`;
      DB.set(path, { state: state || "online", lastSeen: DB.serverTimestamp() || now() }, true).catch(() => {});
    },

    watchIncomingCalls(force = false) {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      const roomId = this.getPresenceRoom();
      const callsCol = DB.col(`presenceRooms/${roomId}/calls`);
      if (!callsCol) return;

      if (this.state.unsub.incomingCalls && !force) return;
      if (this.state.unsub.incomingCalls) {
        try { this.state.unsub.incomingCalls(); } catch (_) {}
        this.state.unsub.incomingCalls = null;
      }

      let q;
      try {
        q = callsCol
          .where("status", "==", "ringing")
          .where("toUids", "array-contains", uid)
          .limit(1);
      } catch (_) {
        UI.setLed(UI.els.ledListener, "bad");
        return;
      }

      UI.setLed(UI.els.ledListener, "on");

      this.state.unsub.incomingCalls = DB.onSnapshot(q, (snap) => {
        if (!snap || snap.empty) return;

        const doc = snap.docs[0];
        const data = doc.data() || {};
        const path = doc.ref && doc.ref.path ? doc.ref.path : null;

        if (this.state.incoming.active && this.state.incoming.docPath === path) return;

        this.state.incoming.active = true;
        this.state.incoming.docPath = path;
        this.state.incoming.fromName = data.fromName || "Unknown";
        this.state.incoming.fromEmail = data.fromEmail || "";
        this.state.incoming.channel = data.channel || "";
        this.state.incoming.createdAt = (data.createdAt && data.createdAt.toMillis) ? data.createdAt.toMillis() : now();

        safeText(UI.els.modalFromName, `${this.state.incoming.fromName}`);
        UI.showModal(true);

        Sound.beepPattern();
        AndroidBridge.vibrate(120);
        AndroidBridge.showNotification("📞 Incoming Call", `${this.state.incoming.fromName} is calling you`);

        Log.write("warn", `Incoming: ${this.state.incoming.fromName}`);
        CallHistory.mark("incoming", { from: this.state.incoming.fromName, channel: this.state.incoming.channel });

        this.autoExpireIncomingIfNeeded();
      }, () => {
        UI.setLed(UI.els.ledListener, "bad");
      });
    },

    async autoExpireIncomingIfNeeded() {
      const ttl = 45 * 1000;
      const started = this.state.incoming.createdAt || now();

      await sleepWithAbort(2500, () => !this.state.incoming.active);
      if (!this.state.incoming.active) return;

      const age = now() - started;
      if (age < ttl) return;

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "missed",
            missedAt: DB.serverTimestamp() || now(),
            missedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      UI.showModal(false);
      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      Log.write("warn", "Missed call (expired)");
      CallHistory.mark("missed", {});
    },

    async acceptIncomingCall() {
      if (!this.state.incoming.active) return;

      if (UI.els.inChannel) UI.els.inChannel.value = this.state.incoming.channel || "";
      UI.showModal(false);

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "accepted",
            acceptedAt: DB.serverTimestamp() || now(),
            acceptedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      await this.joinFlow();
    },

    async declineIncomingCall() {
      if (!this.state.incoming.active) return;
      UI.showModal(false);

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "declined",
            declinedAt: DB.serverTimestamp() || now(),
            declinedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      Log.write("info", "تم الرفض");
      CallHistory.mark("decline", {});
    },

    /* =========================
       Part 23 — FRIENDS + INVITES + BROADCAST
       ========================= */
    renderFriends() {
      UI.renderFriends(
        this.state.friends.list,
        this.state.friends.selected,
        (key) => {
          if (this.state.friends.selected.has(key)) this.state.friends.selected.delete(key);
          else this.state.friends.selected.add(key);
          this.renderFriends();
        },
        (key) => {
          this.state.friends.selected.clear();
          this.state.friends.selected.add(key);
          this.sendCallInviteToSelected();
        }
      );
    },

    clearFriendSelection() {
      this.state.friends.selected.clear();
      this.renderFriends();
      Log.write("info", "تم إلغاء التحديد");
    },

    upsertFriend(friend) {
      const f = normalizeFriend(friend);
      const list = this.state.friends.list || [];

      const idx = list.findIndex((x) =>
        (x.uid && f.uid && x.uid === f.uid) ||
        (!f.uid && x.email && f.email && x.email.toLowerCase() === f.email.toLowerCase())
      );

      if (idx >= 0) list[idx] = { ...list[idx], ...f };
      else list.push(f);

      this.state.friends.list = list;
      this.persistLocal();
      this.renderFriends();
    },

    addFriendLocalFromInputs() {
      const name = UI.els.friendName ? (UI.els.friendName.value || "").trim() : "";
      const email = UI.els.friendEmail ? (UI.els.friendEmail.value || "").trim() : "";
      if (!name && !email) return Log.write("warn", "اكتب اسم/إيميل ثم إضافة");

      this.upsertFriend({
        uid: "",
        displayName: name || (email ? email.split("@")[0] : "Friend"),
        email: email || "",
        photoUrl: ""
      });

      Log.write("good", "تمت الإضافة محلياً");
    },

    exportFriends() {
      const pack = { v: 1, t: now(), friends: this.state.friends.list || [] };
      const text = JSON.stringify(pack);
      try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (_) {}
      AndroidBridge.copyToClipboard(text);
      Log.write("good", "تم نسخ الأصدقاء (JSON) للحافظة");
    },

    importFriends() {
      const raw = prompt("ألصق JSON الأصدقاء هنا:");
      if (!raw) return;
      const o = safeJsonParse(raw);
      if (!o || !Array.isArray(o.friends)) return Log.write("bad", "JSON غير صالح");
      this.state.friends.list = o.friends.map(normalizeFriend);
      this.persistLocal();
      this.renderFriends();
      Log.write("good", "تم الاستيراد ✅");
    },

    async searchFriends() {
      const name = UI.els.friendName ? (UI.els.friendName.value || "").trim() : "";
      const email = UI.els.friendEmail ? (UI.els.friendEmail.value || "").trim() : "";

      if (!name && !email) {
        Log.write("warn", "اكتب اسم أو إيميل للبحث");
        return;
      }

      if (!DB.ready()) {
        Log.write("bad", "Firebase غير جاهز / غير محمّل");
        return;
      }

      Log.write("info", "Searching...");

      let results = [];
      if (email) results = await DB.queryUsersByEmail(email);
      if (!results.length && name) results = await DB.queryUsersByNamePrefix(name);

      if (!results.length) {
        const fallback = {
          uid: "",
          displayName: name || (email ? email.split("@")[0] : "Friend"),
          email: email || "",
          photoUrl: ""
        };
        this.upsertFriend(fallback);
        Log.write("warn", "لم يتم العثور — تم إضافة كصديق محلي (بدون UID)");
        return;
      }

      results.forEach((u) => {
        this.upsertFriend({
          uid: u.uid || u.id || "",
          displayName: u.displayName || u.name || "Friend",
          email: u.email || "",
          photoUrl: u.photoUrl || u.photoURL || ""
        });
      });

      Log.write("good", `Found: ${results.length}`);
    },

    async sendCallInviteToSelected() {
      const channel = this.getChannel();
      if (!channel) {
        Log.write("warn", "اكتب Channel يدويًا أولاً");
        return;
      }

      const selKeys = Array.from(this.state.friends.selected);
      if (!selKeys.length) {
        Log.write("warn", "حدد أصدقاء أولاً");
        return;
      }

      if (!DB.ready()) {
        Log.write("bad", "Firebase غير جاهز / غير محمّل");
        return;
      }

      const targets = [];
      (this.state.friends.list || []).forEach((f) => {
        const key = f.uid || f.email || f.id;
        if (selKeys.includes(key) && f.uid) targets.push(f.uid);
      });

      if (!targets.length) {
        Log.write("warn", "لا يوجد UID للأصدقاء المحددين (لا يمكن إرسال نداء)");
        return;
      }

      const roomId = this.getPresenceRoom();
      const payload = {
        status: "ringing",
        channel,
        roomId,
        fromUid: this.getMyUid(),
        fromName: this.getName(),
        fromEmail: this.state.profile.email || "",
        toUids: targets.slice(0, 50),
        createdAt: DB.serverTimestamp() || now()
      };

      try {
        await DB.add(`presenceRooms/${roomId}/calls`, payload);
        Log.write("good", `📞 Call invite sent (${payload.toUids.length})`);
        CallHistory.mark("invite_sent", { targets: payload.toUids.length, channel });
      } catch (e) {
        Log.write("bad", "فشل إرسال النداء: " + errToText(e));
      }
    },

    async sendBroadcastInvite() {
      const channel = this.getChannel();
      if (!channel) return Log.write("warn", "اكتب Channel أولاً");

      if (!DB.ready()) return Log.write("bad", "Firebase غير جاهز / غير محمّل");

      const roomId = this.getPresenceRoom();
      const myUid = this.getMyUid();

      const usersCol = DB.col(`presenceRooms/${roomId}/users`);
      if (!usersCol) return Log.write("bad", "Presence room users غير متاح");

      Log.write("info", "Broadcasting call...");

      let uids = [];
      try {
        let snap = null;
        try {
          snap = await usersCol.where("state", "in", ["online", "in_call"]).limit(50).get();
        } catch (_) {
          snap = await usersCol.limit(50).get();
        }
        snap.forEach((d) => {
          const data = d.data() || {};
          const uid = String(data.uid || d.id || "").trim();
          if (uid && uid !== myUid) uids.push(uid);
        });
      } catch (e) {
        return Log.write("bad", "Broadcast users read fail: " + errToText(e));
      }

      const seen = {};
      uids = uids.filter((x) => (seen[x] ? false : (seen[x] = true)));

      if (!uids.length) return Log.write("warn", "لا يوجد مستخدمين Online لإرسال النداء");

      const payload = {
        status: "ringing",
        channel,
        roomId,
        fromUid: myUid,
        fromName: this.getName(),
        fromEmail: this.state.profile.email || "",
        toUids: uids.slice(0, 50),
        createdAt: DB.serverTimestamp() || now()
      };

      try {
        await DB.add(`presenceRooms/${roomId}/calls`, payload);
        Log.write("good", `📣 Broadcast sent (${payload.toUids.length})`);
        CallHistory.mark("broadcast", { to: payload.toUids.length, channel });
        Sound.tactical();
        AndroidBridge.vibrate(60);
      } catch (e) {
        Log.write("bad", "Broadcast failed: " + errToText(e));
      }
    },

    /* =========================
       Part 24 — NETWORK + PING + AUDIO + SETTINGS + DIAGNOSTICS
       ========================= */
    setDefaults({ speaker, mic, sound }) {
      if (speaker !== undefined) this.state.settings.speakerDefault = !!speaker;
      if (mic !== undefined) this.state.settings.micDefault = !!mic;
      if (sound !== undefined) this.state.settings.soundDefault = !!sound;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("good", "تم حفظ الإعدادات ✅");
    },

    setEchoMode(mode) {
      this.state.settings.echoMode = String(mode || "AUTO").toUpperCase();
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Echo: " + this.state.settings.echoMode);
    },

    setPingHost(host) {
      const h = String(host || "").trim() || DEFAULT_PING_HOST;
      this.state.settings.pingHost = h;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Ping Host: " + h);
    },

    setUpdateRate(rate) {
      const r = String(rate || "Normal");
      this.state.settings.updateRate = (r === "Low" || r === "High") ? r : "Normal";
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Update Rate: " + this.state.settings.updateRate);
      this.startNetworkMonitor(true);
      this.startPingMonitor(true);
    },

    setLockCall(on) {
      this.state.settings.lockCall = !!on;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      UI.setCallState(this.state.call.inCall ? "connected" : "disconnected");
      Log.write("info", "Lock Call: " + (this.state.settings.lockCall ? "ON" : "OFF"));
    },

    setAutoClearLogs(on) {
      this.state.settings.autoClearLogs = !!on;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Auto Clear Logs: " + (this.state.settings.autoClearLogs ? "ON" : "OFF"));
    },

    updateQualityPanels() {
      const n = this.state.net;

      const netScore = n.hasInternet ? (n.type === "wifi" && typeof n.rssi === "number"
        ? (n.rssi >= -55 ? 95 : n.rssi >= -67 ? 85 : n.rssi >= -78 ? 65 : 35)
        : 80) : 0;

      const ping = n.pingMs;
      const pingScore = (ping < 0) ? 0 : (ping <= 80 ? 95 : ping <= 150 ? 80 : ping <= 250 ? 60 : ping <= 400 ? 40 : 15);

      const jit = Number(n.jitterMs || 0);
      const jitterScore = (jit <= 15 ? 90 : jit <= 30 ? 75 : jit <= 60 ? 50 : 20);

      const loss = Number(n.lossPct || 0);
      const lossScore = (loss <= 1 ? 90 : loss <= 3 ? 75 : loss <= 8 ? 50 : 20);

      const up = Number(n.upKbps || 0);
      const down = Number(n.downKbps || 0);
      const upScore = Math.max(10, Math.min(100, (up / 120) * 100));
      const downScore = Math.max(10, Math.min(100, (down / 200) * 100));

      const audio = Number(n.audioLevel || 0);          // 0..1
      const audioScore = Math.max(10, Math.min(100, audio * 100));

      let grade = "OK";
      if (pingScore >= 85 && jitterScore >= 75 && lossScore >= 75) grade = "Excellent";
      else if (pingScore >= 70 && jitterScore >= 60 && lossScore >= 60) grade = "Good";
      else if (pingScore >= 45 && jitterScore >= 45 && lossScore >= 45) grade = "OK";
      else grade = "Poor";

      const gradeScore = (grade === "Excellent") ? 92 : (grade === "Good") ? 76 : (grade === "OK") ? 55 : 28;

      UI.setQualityUI({
        netText: `${n.type || "none"} ${n.rssi != null ? (String(n.rssi) + " dBm") : ""}`.trim(),
        pingMs: (ping >= 0 ? ping : "..."),
        jitterMs: jit,
        lossPct: loss,
        upKbps: up,
        downKbps: down,
        audioLevel: (audio ? audio.toFixed(2) : "0.00"),
        grade,
        netScore,
        pingScore,
        jitterScore,
        lossScore,
        upScore,
        downScore,
        audioScore,
        gradeScore
      });

      // Diagnostics page
      safeText(UI.els.diagNetType, String(n.type || "none"));
      safeText(UI.els.diagRssi, n.rssi == null ? "..." : String(n.rssi));
      safeText(UI.els.diagLink, n.linkMbps == null ? "..." : String(n.linkMbps));
      safeText(UI.els.diagInternet, String(!!n.hasInternet));
      safeText(UI.els.diagPing, ping < 0 ? "..." : String(ping));
      safeText(UI.els.diagPingGrade, grade);
      safeText(UI.els.diagJitter, String(jit));
      safeText(UI.els.diagLoss, String(loss));
      safeText(UI.els.diagUp, String(up));
      safeText(UI.els.diagDown, String(down));
      safeText(UI.els.diagCodec, "Opus");
      safeText(UI.els.diagCallLedTxt, (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("on")) ? "ON" :
        (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("warn")) ? "WARN" :
        (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("bad")) ? "BAD" : "OFF");

      safeText(UI.els.diagSrvLedTxt,
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("on")) ? "ON" :
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("warn")) ? "WARN" :
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("bad")) ? "BAD" : "OFF"
      );

      safeText(UI.els.diagSrvBarsTxt, (n.pingMs < 0) ? "0-4" : (n.pingMs < 100 ? "4" : n.pingMs < 200 ? "3" : n.pingMs < 400 ? "2" : "1"));
    },

    startNetworkMonitor(force = false) {
      const rate = this.state.settings.updateRate;
      const interval = (rate === "Low") ? 5000 : (rate === "High") ? 1000 : 2000;

      if (this.state.__netT && !force) return;
      if (this.state.__netT) clearInterval(this.state.__netT);

      const tick = () => {
        let info = null;
        const raw = AndroidBridge.getNetworkInfoJson();
        if (raw) info = safeJsonParse(raw);

        if (info) {
          this.state.net.type = String(info.type || info.netType || "other").toLowerCase();
          this.state.net.rssi = (info.rssi != null) ? Number(info.rssi) : null;
          this.state.net.linkMbps = (info.linkMbps != null) ? Number(info.linkMbps) : null;
          this.state.net.hasInternet = !!(info.hasInternet != null ? info.hasInternet : info.internet);

          UI.setSignalUI({ type: this.state.net.type, rssi: this.state.net.rssi, hasInternet: this.state.net.hasInternet });
          UI.setLed(UI.els.ledNet, this.state.net.hasInternet ? "on" : "bad");
          this.updateQualityPanels();
          return;
        }

        const online = (navigator.onLine !== undefined) ? !!navigator.onLine : true;
        this.state.net.hasInternet = online;

        const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        let type = "other";
        let down = null;

        if (c) {
          type = c.type || c.effectiveType || "other";
          down = (c.downlink != null) ? Math.round(Number(c.downlink) * 1000) : null; // Mbps -> kbps
        }
        this.state.net.type = String(type).toLowerCase();
        this.state.net.downKbps = down != null ? down : this.state.net.downKbps;

        UI.setSignalUI({ type: this.state.net.type, rssi: this.state.net.rssi, hasInternet: this.state.net.hasInternet });
        this.updateQualityPanels();
      };

      tick();
      this.state.__netT = setInterval(tick, interval);
    },

    async doFetchPing(host) {
      const h = String(host || DEFAULT_PING_HOST).trim();
      if (!h) return -1;

      const n = AndroidBridge.tcpPingMs(h, 443, 1500);
      if (typeof n === "number" && n >= 0) return n;

      try {
        const url = "https://" + h + "/favicon.ico?x=" + now();
        const t0 = now();

        const controller = ("AbortController" in window) ? new AbortController() : null;
        const timer = setTimeout(() => { try { controller && controller.abort(); } catch (_) {} }, 1800);

        await fetch(url, { method: "HEAD", cache: "no-store", mode: "no-cors", signal: controller ? controller.signal : undefined });
        clearTimeout(timer);

        const dt = now() - t0;
        return dt > 0 ? dt : 1;
      } catch (_) {
        return -1;
      }
    },

    startPingMonitor(force = false) {
      const rate = this.state.settings.updateRate;
      const interval = (rate === "Low") ? 7000 : (rate === "High") ? 2000 : 3500;

      if (this.state.__pingT && !force) return;
      if (this.state.__pingT) clearInterval(this.state.__pingT);

      const tick = async () => {
        const ms = await this.doFetchPing(this.state.settings.pingHost || DEFAULT_PING_HOST);
        this.state.net.pingMs = ms;

        UI.setPing(ms);
        this.updateQualityPanels();

        if (UI.els.diagNoteTxt) safeText(UI.els.diagNoteTxt, ms < 0 ? "Ping: FAIL" : ("Ping: " + ms + "ms"));

        if (this.state.settings.autoClearLogs && UI.els.log) {
          try {
            const lines = UI.els.log.querySelectorAll(".logLine");
            if (lines.length > 200) {
              for (let i = 200; i < lines.length; i++) lines[i].remove();
            }
          } catch (_) {}
        }
      };

      tick();
      this.state.__pingT = setInterval(tick, interval);
    },

    // NEW: updates audioLevel from MicViz (for quality panel)
    startAudioMeter(force = false) {
      if (this.state.__audioT && !force) return;
      if (this.state.__audioT) clearInterval(this.state.__audioT);

      this.state.__audioT = setInterval(() => {
        const lvl = MicViz.level(); // 0..1
        // if mic muted, show lower (still allow heart animation if audio track gives low)
        this.state.net.audioLevel = this.state.micMuted ? 0 : lvl;
      }, 120);
    },

    refreshDiagnostics() {
      this.updateQualityPanels();
      return this.getDiagnosticsPack();
    },

    getDiagnosticsPack() {
      const n = this.state.net;
      return {
        netType: n.type,
        rssi: n.rssi,
        linkMbps: n.linkMbps,
        internet: n.hasInternet,
        ping: n.pingMs,
        jitter: n.jitterMs,
        loss: n.lossPct,
        up: n.upKbps,
        down: n.downKbps,
        audio: n.audioLevel,
        codec: "Opus",
        callLed: (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("on")) ? "ON" :
          (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("warn")) ? "WARN" :
          (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("bad")) ? "BAD" : "OFF"
      };
    },

    resetDiagnosticsLocal() {
      this.state.net.jitterMs = 0;
      this.state.net.lossPct = 0;
      this.state.net.upKbps = 0;
      this.state.net.downKbps = 0;
      this.state.net.audioLevel = 0;
      this.updateQualityPanels();
    },
  };

  /* =========================
     Part 25 — EXPORT API for inline HTML hooks
     ========================= */
  window.MDV_APP = {
    join: () => App.joinFlow(),
    leave: () => App.leaveFlow(),
    endCall: () => App.endCall(),

    acceptIncoming: () => App.acceptIncomingCall(),
    rejectIncoming: () => App.declineIncomingCall(),

    refreshDiagnostics: () => App.refreshDiagnostics(),
    resetDiagnostics: () => App.resetDiagnosticsLocal(),
    shareDiagnostics: () => {
      const text = JSON.stringify(App.getDiagnosticsPack());
      try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (_) {}
      AndroidBridge.copyToClipboard(text);
      Log.write("good", "DIAG COPIED");
      return text;
    },

    // Android-side functions
    volumeUp: () => AndroidBridge.volumeUp(),
    volumeDown: () => AndroidBridge.volumeDown(),
    volumeMuteToggle: () => AndroidBridge.volumeMuteToggle(),
    routeSpeaker: () => AndroidBridge.routeSpeaker(),
    routeEarpiece: () => AndroidBridge.routeEarpiece(),
    routeBluetooth: () => AndroidBridge.routeBluetooth(),

    detectAudio: () => AndroidBridge.detectAudio(),
    detectBluetooth: () => AndroidBridge.detectBluetooth(),
    refreshDevices: () => AndroidBridge.refreshDevices(),

    // UI helpers
    toggleDrawer: () => Drawer.toggle(),
    themeCycle: () => Theme.cycle(),
  };

  /* =========================
     Part 26 — BOOT
     ========================= */
  const boot = () => {
    try { App.init(); } catch (e) { try { console.error(e); } catch (_) {} }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();

/* =========================================================
   ملاحظة مهمة لإرجاع "مخطط القلب" (Mic Heart Monitor):
   - لازم يكون عندك في index.html عنصر:
       <canvas id="micWave" style="width:100%;height:56px;"></canvas>
   - JS فوق يدعم IDs بديلة، لكن الأفضل micWave.
   ========================================================= */
/* =========================================================
   MiniDiscordVoice - app.js (FULL INTEGRATED) [REWRITE v4 FINAL]
   - ✅ Matches latest CSS: Drawer side + overlay + theme vars + no horizontal drag
   - ✅ Adds Theme controller (system/dark/light) via data-theme
   - ✅ Restores Mic "Heart Monitor" waveform (ECG-style) using Audio Analyser
   - ✅ Keeps ALL previous features:
      - Google profile sync + prevent anonymous wipe
      - Avatar fallback
      - LED binding
      - WebView safe (NO replaceAll)
      - Better Agora errors
      - Force Majeure fixed at 2 minutes (LOCKED)
      - Fix buttons not working (hard re-bind)
      - AndroidBridge + window.MDV_APP API
   ========================================================= */

(() => {
  "use strict";

  /* =========================
     Part 1 — BOOTSTRAP + CONFIG
     ========================= */
  if (window.__MDV_APP_LOADED__) {
    try { console.warn("MDV app.js already loaded"); } catch (_) {}
    return;
  }
  window.__MDV_APP_LOADED__ = true;


// =========================================================
// Early native bridge hooks (prevents lost callbacks)
// =========================================================
try { if (!window.__MDV_LAST_ANDROID_USER__) window.__MDV_LAST_ANDROID_USER__ = null; } catch (_) {}
if (typeof window.onAndroidUser !== "function") {
  window.onAndroidUser = function(name, email, photo) {
    try { window.__MDV_LAST_ANDROID_USER__ = { name: name, email: email, photo: photo }; } catch (_) {}
  };
}
if (typeof window.onAndroidLogin !== "function") {
  window.onAndroidLogin = function(name, email, photo) {
    try { window.__MDV_LAST_ANDROID_USER__ = { name: name, email: email, photo: photo }; } catch (_) {}
  };
}

  const APP_VERSION = "MDV_APP_JS_v4_final_2026-01-15_agora_fix";

  const AGORA_APP_ID = "eb80a41c4a3c400f865a5c88bdf293be";

  const FIREBASE_CONFIGS = [
    {
      apiKey: "AIzaSyApUvLTt0OLAc_3Rk2e1BnmvX64T5RTmA8",
      authDomain: "minidiscordvoice-b7310.firebaseapp.com",
      databaseURL: "https://minidiscordvoice-b7310-default-rtdb.firebaseio.com",
      projectId: "minidiscordvoice-b7310",
      storageBucket: "minidiscordvoice-b7310.firebasestorage.app",
      messagingSenderId: "1073341648468",
      appId: "1:1073341648468:web:9af59b1fcc577d4468e7c1",
      measurementId: "G-7R4MRJHWY6",
    },
    {
      apiKey: "AIzaSyDdqU4OTdQv1vGXRtJwPVkuA4AdwIzCAuE",
      authDomain: "minidiscordvoice-b7310.firebaseapp.com",
      databaseURL: "https://minidiscordvoice-b7310-default-rtdb.firebaseio.com",
      projectId: "minidiscordvoice-b7310",
      storageBucket: "minidiscordvoice-b7310.firebasestorage.app",
      messagingSenderId: "1073341648468",
      appId: "1:1073341648468:web:9af59b1fcc577d4468e7c1",
      measurementId: "G-7R4MRJHWY6",
    },
  ];

  // Limits
  const CALL_LIMIT_MS = 3 * 60 * 60 * 1000; // 3 hours
  const BLOCK_MS = 20 * 60 * 60 * 1000;     // 20 hours
  const USAGE_TICK_MS = 15 * 1000;          // 15s

  // Force Majeure (LOCKED)
  const FM_INTERVAL_MS = 2 * 60 * 1000;     // 2 minutes (LOCKED)
  const FM_REBOOT_SECONDS = 6;              // 6 seconds (LOCKED)

  const DEFAULT_PING_HOST = "minidiscordvoice.web.app";

  window.AGORA_APP_ID = AGORA_APP_ID;
  window.__MDV_FIREBASE_CONFIGS__ = FIREBASE_CONFIGS;
  window.__MDV_VERSION__ = APP_VERSION;

  /* =========================
     Part 2 — SMALL UTILS
     ========================= */
  const now = () => Date.now();

  const $ = (sel, root = document) => { try { return root.querySelector(sel); } catch (_) { return null; } };
  const $$ = (sel, root = document) => { try { return Array.from(root.querySelectorAll(sel)); } catch (_) { return []; } };
  const byId = (id) => { try { return document.getElementById(id); } catch (_) { return null; } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function pad2(n) {
    n = Math.floor(Math.max(0, n));
    return n < 10 ? "0" + n : "" + n;
  }
  function fmtTime(seconds) {
    seconds = Math.floor(Math.max(0, seconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    return `${pad2(m)}:${pad2(s)}`;
  }
  function escapeHTML(s) {
    const str = String(s == null ? "" : s);
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function safeText(el, txt) {
    if (!el) return;
    el.textContent = (txt == null) ? "" : String(txt);
  }
  function safeHTML(el, html) {
    if (!el) return;
    el.innerHTML = html || "";
  }
  function safeJsonParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  function errToText(e) {
    try {
      if (!e) return "Unknown error";
      const name = e.name ? String(e.name) : "";
      const msg = e.message ? String(e.message) : String(e);
      return (name ? `${name}: ` : "") + msg;
    } catch (_) { return "Unknown error"; }
  }
  function debounce(fn, ms = 250) {
    let t = null;
    return (...args) => {
      try { clearTimeout(t); } catch (_) {}
      t = setTimeout(() => { try { fn(...args); } catch (_) {} }, ms);
    };
  }
  function uidShort() {
    return Math.random().toString(16).slice(2, 10) + "-" + Math.random().toString(16).slice(2, 6);
  }
  function safeNameFromEmail(email) {
    if (!email) return "User";
    const s = String(email).split("@")[0] || "User";
    return s.length > 18 ? s.slice(0, 18) : s;
  }
  function normalizePhotoUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.includes("googleusercontent.com") && !u.includes("sz=")) {
      return u + (u.includes("?") ? "&" : "?") + "sz=128";
    }
    return u;
  }
  async function sleepWithAbort(ms, shouldAbort) {
    const step = 250;
    let left = ms;
    while (left > 0) {
      if (shouldAbort && shouldAbort()) return;
      const s = Math.min(step, left);
      await sleep(s);
      left -= s;
    }
  }

  /* =========================
     Part 3 — STORAGE (namespaced)
     ========================= */
  const Store = (() => {
    const PREFIX = "mdv_v4_";
    function k(key) { return PREFIX + String(key || ""); }
    function getRaw(key) { try { return localStorage.getItem(k(key)); } catch (_) { return null; } }
    function setRaw(key, val) { try { localStorage.setItem(k(key), String(val == null ? "" : val)); } catch (_) {} }
    function del(key) { try { localStorage.removeItem(k(key)); } catch (_) {} }
    function getJson(key, fallback) {
      const raw = getRaw(key);
      if (!raw) return fallback;
      const obj = safeJsonParse(raw);
      return obj == null ? fallback : obj;
    }
    function setJson(key, obj) { try { setRaw(key, JSON.stringify(obj)); } catch (_) {} }
    return { getRaw, setRaw, del, getJson, setJson };
  })();

  /* =========================
     Part 4 — LOGGER
     ========================= */
  const Log = (() => {
    const MAX_LINES = 260;

    function stamp() {
      const t = new Date();
      return `${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}`;
    }
    function toConsole(type, msg) {
      try {
        if (type === "bad") console.error("[MDV]", msg);
        else if (type === "warn") console.warn("[MDV]", msg);
        else console.log("[MDV]", msg);
      } catch (_) {}
    }
    function toUI(type, msg) {
      let box = null;
      try { box = (UI && UI.els) ? UI.els.log : null; } catch (_) { box = null; }
      if (!box) return;

      const div = document.createElement("div");
      div.className = "logLine";

      if (type === "warn") div.style.color = "var(--warn)";
      if (type === "bad") div.style.color = "var(--danger)";
      if (type === "good") div.style.color = "var(--success)";

      div.innerHTML = `<span class="mono">[${stamp()}]</span> ${escapeHTML(msg)}`;
      box.prepend(div);

      try {
        const lines = box.querySelectorAll(".logLine");
        if (lines.length > MAX_LINES) {
          for (let i = MAX_LINES; i < lines.length; i++) lines[i].remove();
        }
      } catch (_) {}
    }
    function write(type, msg) {
      const m = String(msg == null ? "" : msg);
      toConsole(type, m);
      toUI(type, m);
    }
    return { write };
  })();

  /* =========================
     Part 5 — ANDROID BRIDGE (SAFE)
     ========================= */
  const AndroidBridge = {
    exists() { return !!(window.Android || window.AndroidInterface); },
    _obj() { return window.AndroidInterface || window.Android || null; },
    call(fn, ...args) {
      try {
        const o = this._obj();
        if (!o) return undefined;
        const f = o[fn];
        if (typeof f !== "function") return undefined;
        return f.apply(o, args);
      } catch (_) { return undefined; }
    },

    startGoogleSignIn() { return this.call("startGoogleSignIn"); },
    signOut() { return this.call("signOut"); },

    setCallMode(active) { return this.call("setCallMode", !!active); },
    setSpeaker(on) { return this.call("setSpeaker", !!on); },

    vibrate(ms = 30) { return this.call("vibrate", parseInt(ms, 10) || 30); },

    showAd() { return this.call("showAd"); },
    showVideoAd() { return this.call("showVideoAd"); },

    showNotification(t, b) {
      return this.call("showNotification", String(t || ""), String(b || ""));
    },

    copyToClipboard(t) { return this.call("copyToClipboard", String(t || "")); },

    getNetworkInfoJson() {
      try { return String(this.call("getNetworkInfoJson") || ""); } catch (_) { return ""; }
    },

    tcpPingMs(host, port, timeoutMs) {
      try {
        const v = this.call(
          "tcpPingMs",
          String(host || ""),
          parseInt(port, 10) || 443,
          parseInt(timeoutMs, 10) || 1500
        );
        const n = Number(v);
        return Number.isFinite(n) ? n : -1;
      } catch (_) { return -1; }
    },

    endCall() { return this.call("endCall"); },
    acceptIncoming() { return this.call("acceptIncoming"); },
    rejectIncoming() { return this.call("rejectIncoming"); },

    volumeUp() { return this.call("volumeUp"); },
    volumeDown() { return this.call("volumeDown"); },
    volumeMuteToggle() { return this.call("volumeMuteToggle"); },

    routeSpeaker() { return this.call("routeSpeaker"); },
    routeEarpiece() { return this.call("routeEarpiece"); },
    routeBluetooth() { return this.call("routeBluetooth"); },

    detectAudio() { return this.call("detectAudio"); },
    detectBluetooth() { return this.call("detectBluetooth"); },
    refreshDevices() { return this.call("refreshDevices"); },

    getDiagnostics() { return this.call("getDiagnostics"); },
    resetDiagnostics() { return this.call("resetDiagnostics"); },
    shareDiagnostics() { return this.call("shareDiagnostics"); },
  };

  /* =========================
     Part 6 — UI BINDING
     ========================= */
  const UI = {
    els: {},
    bound: false,
    bindAttempts: 0,

    FALLBACK_AVATAR:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect width='100%25' height='100%25' fill='%23333'/%3E%3Ctext x='50%25' y='52%25' text-anchor='middle' fill='%23aaa' font-size='18' font-family='Arial'%3EUSER%3C/text%3E%3C/svg%3E",

    bind() {
      const E = this.els;

      // Profile
      E.profileName = byId("userName");
      E.profileEmail = byId("userEmail");
      E.profilePhoto = byId("userPhoto");
      E.inName = byId("displayName");

      // Inputs
      E.inPresence = byId("presenceRoom");
      E.inChannel = byId("channel");
      E.inToken = byId("token");

      // Buttons (Call)
      E.btnJoin = byId("joinBtn");
      E.btnLeave = byId("leaveBtn");
      E.btnCopy = byId("copyBtn");

      E.btnSpeaker = byId("speakerBtn");
      E.btnMuteMic = byId("muteMicBtn");
      E.btnMuteSpk = byId("muteSoundBtn");

      E.btnEndCall = byId("endCallBtn");

      E.swFM = byId("fmSwitch");
      E.fmIntervalSel = byId("fmInterval");
      E.fmRebootSel = byId("fmReboot");

      E.btnBroadcastCall = byId("callBtn");
      E.btnReward = byId("rewardBtn");

      // Optional login buttons
      E.btnGoogle1 = byId("googleLoginBtn");
      E.btnGoogle2 = byId("loginBtn");
      E.btnGoogle3 = byId("signInBtn");
      E.btnGoogle4 = byId("googleBtn");
      E.btnLogout = byId("logoutBtn");

      // Status
      E.callTimerVal = byId("callTimer");
      E.netTower = byId("netTower");
      E.srvTower = byId("srvTower");
      E.netTypeTxt = byId("netTypeTxt");
      E.pingVal = byId("pingMs");

      // LEDs (DOT itself)
      E.ledWeb = byId("ledWeb");
      E.ledFirebase = byId("ledFirebase");
      E.ledListener = byId("ledListener");
      E.ledMicPerm = byId("ledMicPerm");
      E.ledAgora = byId("ledAgora");
      E.ledInCall = byId("ledInCall");
      E.ledNet = byId("ledNet");
      E.ledSrv = byId("ledSrv");
      E.ledCallQ = byId("ledCallQ");

      // Quality fields
      E.qNetText = byId("qNetText");
      E.qPingText = byId("qPingText");
      E.qJitterText = byId("qJitterText");
      E.qLossText = byId("qLossText");
      E.qUpText = byId("qUpText");
      E.qDownText = byId("qDownText");
      E.qAudioText = byId("qAudioText");
      E.qGradeText = byId("qGradeText");

      E.qNetFill = byId("qNetFill");
      E.qPingFill = byId("qPingFill");
      E.qJitterFill = byId("qJitterFill");
      E.qLossFill = byId("qLossFill");
      E.qUpFill = byId("qUpFill");
      E.qDownFill = byId("qDownFill");
      E.qAudioFill = byId("qAudioFill");
      E.qGradeFill = byId("qGradeFill");

      // Friends
      E.friendName = byId("friendSearchName");
      E.friendEmail = byId("friendSearchEmail");
      E.friendSearchBtn = byId("friendSearchBtn");
      E.friendAddBtn = byId("friendAddBtn");
      E.friendImportBtn = byId("friendImportBtn");
      E.friendExportBtn = byId("friendExportBtn");

      E.friendList = byId("friendsList");
      E.callSelectedBtn = byId("callSelectedBtn");
      E.clearSelectedBtn = byId("clearSelectedBtn");

      // Incoming modal
      E.modalOverlay = byId("incomingOverlay");
      E.modalFromName = byId("incomingFrom");
      E.modalAccept = byId("acceptCallBtn");
      E.modalDecline = byId("rejectCallBtn");

      // Reboot overlay
      E.rebootOverlay = byId("rebootOverlay");
      E.rebootCount = byId("rebootCounter");

      // Diagnostics
      E.diagNetType = byId("diagNetType");
      E.diagRssi = byId("diagRssi");
      E.diagLink = byId("diagLink");
      E.diagInternet = byId("diagInternet");
      E.diagPing = byId("diagPing");
      E.diagPingGrade = byId("diagPingGrade");
      E.diagSrvBarsTxt = byId("diagSrvBarsTxt");
      E.diagSrvLedTxt = byId("diagSrvLedTxt");
      E.diagJitter = byId("diagJitter");
      E.diagLoss = byId("diagLoss");
      E.diagUp = byId("diagUp");
      E.diagDown = byId("diagDown");
      E.diagCodec = byId("diagCodec");
      E.diagCallLedTxt = byId("diagCallLedTxt");
      E.diagNoteTxt = byId("diagNoteTxt");

      // Settings
      E.setSpeakerDefaultTxt = byId("setSpeakerDefaultTxt");
      E.setMicDefaultTxt = byId("setMicDefaultTxt");
      E.setSoundDefaultTxt = byId("setSoundDefaultTxt");
      E.setEchoTxt = byId("setEchoTxt");

      E.setPingHost = byId("setPingHost");
      E.setUpdateRateTxt = byId("setUpdateRateTxt");

      E.setLockTxt = byId("setLockTxt");
      E.setLogsTxt = byId("setLogsTxt");

      E.btnSetSpeakerOn = byId("setSpeakerDefaultOn");
      E.btnSetSpeakerOff = byId("setSpeakerDefaultOff");
      E.btnSetMicOn = byId("setMicDefaultOn");
      E.btnSetMicOff = byId("setMicDefaultOff");
      E.btnSetSoundOn = byId("setSoundDefaultOn");
      E.btnSetSoundOff = byId("setSoundDefaultOff");

      E.btnEchoAuto = byId("setEchoAuto");
      E.btnEchoOn = byId("setEchoOn");
      E.btnEchoOff = byId("setEchoOff");

      E.btnPingDefault = byId("setPingHostDefault");
      E.btnPingCustom = byId("setPingHostCustom");

      E.btnRateLow = byId("setRateLow");
      E.btnRateNorm = byId("setRateNorm");
      E.btnRateHigh = byId("setRateHigh");

      E.btnLockOn = byId("setLockOn");
      E.btnLockOff = byId("setLockOff");

      E.btnLogsOn = byId("setLogsOn");
      E.btnLogsOff = byId("setLogsOff");

      // Log
      E.log = byId("log");

      // Drawer + Theme (NEW)
      E.drawerBtn = byId("drawerBtn") || byId("menuBtn");
      E.drawerOverlay = byId("drawerOverlay");
      E.drawer = byId("drawer") || byId("tabs");

      E.themeBtn = byId("themeBtn") || byId("themeToggleBtn");
      E.themeModeTxt = byId("themeModeTxt");

      // Mic waveform (NEW / RESTORED)
      E.micWave =
        byId("micWave") ||
        byId("micWaveCanvas") ||
        byId("micHeart") ||
        byId("micHeartCanvas") ||
        byId("heartWave");

      // Defaults
      if (E.inPresence && !E.inPresence.value) E.inPresence.value = "call_room1";
      if (E.profilePhoto && !E.profilePhoto.src) E.profilePhoto.src = this.FALLBACK_AVATAR;

      this.wireEvents();
      this.bound = true;
      this.bindAttempts++;
    },

    /* =========================
       Part 7 — UI EVENTS (hard re-bind)
       ========================= */
    wireEvents() {
      const E = this.els;

      const rewireBtn = (btn, fn) => {
        if (!btn) return;
        try {
          const parent = btn.parentNode;
          if (!parent) return;
          const clone = btn.cloneNode(true);
          parent.replaceChild(clone, btn);
          fn(clone);
        } catch (_) {
          try { fn(btn); } catch (_) {}
        }
      };

      rewireBtn(E.btnJoin, (b) => b.addEventListener("click", () => App.joinFlow()));
      rewireBtn(E.btnLeave, (b) => b.addEventListener("click", () => App.leaveFlow()));
      rewireBtn(E.btnEndCall, (b) => b.addEventListener("click", () => App.endCall()));

      rewireBtn(E.btnCopy, (b) => b.addEventListener("click", () => {
        const ch = App.getChannel();
        if (!ch) return Log.write("warn", "اكتب Channel أولاً");
        try { navigator.clipboard && navigator.clipboard.writeText(ch); } catch (_) {}
        AndroidBridge.copyToClipboard(ch);
        Log.write("good", "تم نسخ اسم القناة");
      }));

      rewireBtn(E.btnSpeaker, (b) => b.addEventListener("click", () => App.toggleSpeaker()));
      rewireBtn(E.btnMuteMic, (b) => b.addEventListener("click", () => App.toggleMuteMic()));
      rewireBtn(E.btnMuteSpk, (b) => b.addEventListener("click", () => App.toggleMuteSpeaker()));

      if (E.swFM) {
        try { E.swFM.onchange = null; } catch (_) {}
        E.swFM.addEventListener("change", () => App.toggleForceMajeure());
      }

      rewireBtn(E.btnBroadcastCall, (b) => b.addEventListener("click", () => App.sendBroadcastInvite()));
      rewireBtn(E.btnReward, (b) => b.addEventListener("click", () => {
        const r = AndroidBridge.showVideoAd();
        if (r === undefined) Log.write("info", "Video Ad (Android only)");
      }));

      rewireBtn(E.friendSearchBtn, (b) => b.addEventListener("click", () => App.searchFriends()));
      rewireBtn(E.friendAddBtn, (b) => b.addEventListener("click", () => App.addFriendLocalFromInputs()));
      rewireBtn(E.friendImportBtn, (b) => b.addEventListener("click", () => App.importFriends()));
      rewireBtn(E.friendExportBtn, (b) => b.addEventListener("click", () => App.exportFriends()));

      rewireBtn(E.callSelectedBtn, (b) => b.addEventListener("click", () => App.sendCallInviteToSelected()));
      rewireBtn(E.clearSelectedBtn, (b) => b.addEventListener("click", () => App.clearFriendSelection()));

      rewireBtn(E.modalAccept, (b) => b.addEventListener("click", () => App.acceptIncomingCall()));
      rewireBtn(E.modalDecline, (b) => b.addEventListener("click", () => App.declineIncomingCall()));

      // Google login buttons
      const googleBtns = [E.btnGoogle1, E.btnGoogle2, E.btnGoogle3, E.btnGoogle4].filter(Boolean);
      googleBtns.forEach((btn) => {
        rewireBtn(btn, (b) => b.addEventListener("click", () => {
          AndroidBridge.startGoogleSignIn();
          Log.write("info", "فتح تسجيل الدخول...");
        }));
      });

      rewireBtn(E.btnLogout, (b) => b.addEventListener("click", () => {
        AndroidBridge.signOut();
        Log.write("info", "تسجيل خروج...");
      }));

      if (E.inName) {
        try { E.inName.oninput = null; } catch (_) {}
        E.inName.addEventListener("input", debounce(() => {
          App.state.profile.displayNameLocal = (E.inName.value || "").trim();
          App.persistLocal();
        }, 250));
      }

      // Settings binds
      rewireBtn(E.btnSetSpeakerOn, (b) => b.addEventListener("click", () => App.setDefaults({ speaker: true })));
      rewireBtn(E.btnSetSpeakerOff, (b) => b.addEventListener("click", () => App.setDefaults({ speaker: false })));

      rewireBtn(E.btnSetMicOn, (b) => b.addEventListener("click", () => App.setDefaults({ mic: true })));
      rewireBtn(E.btnSetMicOff, (b) => b.addEventListener("click", () => App.setDefaults({ mic: false })));

      rewireBtn(E.btnSetSoundOn, (b) => b.addEventListener("click", () => App.setDefaults({ sound: true })));
      rewireBtn(E.btnSetSoundOff, (b) => b.addEventListener("click", () => App.setDefaults({ sound: false })));

      rewireBtn(E.btnEchoAuto, (b) => b.addEventListener("click", () => App.setEchoMode("AUTO")));
      rewireBtn(E.btnEchoOn, (b) => b.addEventListener("click", () => App.setEchoMode("ON")));
      rewireBtn(E.btnEchoOff, (b) => b.addEventListener("click", () => App.setEchoMode("OFF")));

      rewireBtn(E.btnPingDefault, (b) => b.addEventListener("click", () => App.setPingHost(DEFAULT_PING_HOST)));
      rewireBtn(E.btnPingCustom, (b) => b.addEventListener("click", () => {
        const x = prompt("اكتب Ping Host:", App.state.settings.pingHost || DEFAULT_PING_HOST);
        if (x != null) App.setPingHost(String(x || "").trim());
      }));

      rewireBtn(E.btnRateLow, (b) => b.addEventListener("click", () => App.setUpdateRate("Low")));
      rewireBtn(E.btnRateNorm, (b) => b.addEventListener("click", () => App.setUpdateRate("Normal")));
      rewireBtn(E.btnRateHigh, (b) => b.addEventListener("click", () => App.setUpdateRate("High")));

      rewireBtn(E.btnLockOn, (b) => b.addEventListener("click", () => App.setLockCall(true)));
      rewireBtn(E.btnLockOff, (b) => b.addEventListener("click", () => App.setLockCall(false)));

      rewireBtn(E.btnLogsOn, (b) => b.addEventListener("click", () => App.setAutoClearLogs(true)));
      rewireBtn(E.btnLogsOff, (b) => b.addEventListener("click", () => App.setAutoClearLogs(false)));

      // Theme button (NEW)
      rewireBtn(E.themeBtn, (b) => b.addEventListener("click", () => Theme.cycle()));

      // Drawer button (NEW)
      rewireBtn(E.drawerBtn, (b) => b.addEventListener("click", () => Drawer.toggle()));
      if (E.drawerOverlay) {
        try { E.drawerOverlay.onclick = null; } catch (_) {}
        E.drawerOverlay.addEventListener("click", () => Drawer.close());
      }

      // Unlock audio on first gesture (for beeps + analyser)
      document.addEventListener("pointerdown", () => Sound.unlock(), { once: true });
      document.addEventListener("touchstart", () => Sound.unlock(), { once: true });
      document.addEventListener("click", () => Sound.unlock(), { once: true });

      // Close drawer on back/escape
      window.addEventListener("keydown", (ev) => {
        if (ev && ev.key === "Escape") Drawer.close();
      });
    },

    /* =========================
       Part 8 — UI HELPERS
       ========================= */
    setProfile({ name, email, photoUrl, locked }) {
      const E = this.els;

      safeText(E.profileName, name || "Guest");
      safeText(E.profileEmail, email || "لم يتم تسجيل الدخول");

      const p = normalizePhotoUrl(photoUrl);
      if (E.profilePhoto) {
        E.profilePhoto.onerror = () => { E.profilePhoto.src = UI.FALLBACK_AVATAR; };
        E.profilePhoto.src = p || UI.FALLBACK_AVATAR;
      }

      if (E.inName) {
        E.inName.value = name || "";
        E.inName.readOnly = !!locked;
      }
    },

    setLed(dotEl, status) {
      if (!dotEl) return;
      let el = null;
      try {
        el = (dotEl.classList && dotEl.classList.contains("dot"))
          ? dotEl
          : (dotEl.querySelector ? dotEl.querySelector(".dot") : null);
      } catch (_) { el = dotEl; }

      if (!el || !el.classList) return;
      el.classList.remove("on", "off", "warn", "bad");
      el.classList.add(status || "off");
    },

    setCallState(mode) {
      const connected = mode === "connected";
      const E = this.els;

      if (E.btnJoin) E.btnJoin.disabled = connected;
      if (E.btnLeave) E.btnLeave.disabled = !connected;
      if (E.inChannel) E.inChannel.disabled = connected || !!App.state.settings.lockCall;

      this.setLed(E.ledInCall, connected ? "on" : "off");
    },

    setCallTimer(seconds) {
      if (this.els.callTimerVal) safeText(this.els.callTimerVal, fmtTime(seconds));
    },

    showModal(show) {
      const m = this.els.modalOverlay;
      if (!m) return;
      if (show) {
        m.classList.remove("hidden");
        m.setAttribute("aria-hidden", "false");
      } else {
        m.classList.add("hidden");
        m.setAttribute("aria-hidden", "true");
      }
    },

    showReboot(show, count) {
      const o = this.els.rebootOverlay;
      if (!o) return;
      if (show) {
        o.classList.remove("hidden");
        o.setAttribute("aria-hidden", "false");
      } else {
        o.classList.add("hidden");
        o.setAttribute("aria-hidden", "true");
      }
      if (show && this.els.rebootCount) safeText(this.els.rebootCount, String(count ?? ""));
    },

    updateTower(towerEl, activeCount, statusClass) {
      if (!towerEl) return;
      const bars = towerEl.querySelectorAll(".bar");
      bars.forEach((b, i) => {
        b.classList.remove("on", "warn", "bad");
        if (i < activeCount) b.classList.add(statusClass);
      });
    },

    setSignalUI({ type, rssi, hasInternet }) {
      if (this.els.netTypeTxt) safeText(this.els.netTypeTxt, type ? String(type).toUpperCase() : "...");

      let bars = 0;
      let status = "off";

      if (!hasInternet) {
        bars = 0;
        status = "bad";
      } else if (type === "wifi" && typeof rssi === "number") {
        if (rssi >= -55) { bars = 4; status = "on"; }
        else if (rssi >= -67) { bars = 3; status = "on"; }
        else if (rssi >= -78) { bars = 2; status = "warn"; }
        else { bars = 1; status = "bad"; }
      } else {
        bars = 3;
        status = "on";
      }

      this.updateTower(this.els.netTower, bars, status);
      this.setLed(this.els.ledNet, status === "on" ? "on" : status === "warn" ? "warn" : "bad");
    },

    setPing(ms) {
      if (this.els.pingVal) safeText(this.els.pingVal, ms >= 0 ? String(ms) : "...");

      let bars = 0;
      let status = "off";

      if (ms < 0) { bars = 0; status = "bad"; }
      else if (ms < 100) { bars = 4; status = "on"; }
      else if (ms < 200) { bars = 3; status = "on"; }
      else if (ms < 400) { bars = 2; status = "warn"; }
      else { bars = 1; status = "bad"; }

      this.updateTower(this.els.srvTower, bars, status);
      this.setLed(this.els.ledSrv, status === "on" ? "on" : status === "warn" ? "warn" : "bad");
    },

    setQualityUI(pack) {
      if (!pack) return;
      const E = this.els;

      if (E.qNetText) safeText(E.qNetText, pack.netText || "...");
      if (E.qPingText) safeText(E.qPingText, String(pack.pingMs ?? "..."));
      if (E.qJitterText) safeText(E.qJitterText, String(pack.jitterMs ?? "..."));
      if (E.qLossText) safeText(E.qLossText, String(pack.lossPct ?? "..."));
      if (E.qUpText) safeText(E.qUpText, String(pack.upKbps ?? "..."));
      if (E.qDownText) safeText(E.qDownText, String(pack.downKbps ?? "..."));
      if (E.qAudioText) safeText(E.qAudioText, String(pack.audioLevel ?? "..."));
      if (E.qGradeText) safeText(E.qGradeText, pack.grade || "...");

      const clamp = (x) => Math.max(0, Math.min(100, Number(x) || 0));
      const setFill = (el, v) => { if (el) el.style.width = clamp(v) + "%"; };

      setFill(E.qNetFill, pack.netScore);
      setFill(E.qPingFill, pack.pingScore);
      setFill(E.qJitterFill, pack.jitterScore);
      setFill(E.qLossFill, pack.lossScore);
      setFill(E.qUpFill, pack.upScore);
      setFill(E.qDownFill, pack.downScore);
      setFill(E.qAudioFill, pack.audioScore);
      setFill(E.qGradeFill, pack.gradeScore);
    },

    renderFriends(list, selectedSet, onToggle, onQuickCall) {
      const box = this.els.friendList;
      if (!box) return;

      safeHTML(box, "");

      if (!list || !list.length) {
        const empty = document.createElement("div");
        empty.className = "logLine";
        empty.textContent = "لا يوجد أصدقاء بعد. ابحث بالاسم/الإيميل ثم أضف.";
        box.appendChild(empty);
        return;
      }

      list.forEach((f) => {
        const key = f.uid || f.email || f.id || uidShort();
        const selected = selectedSet.has(key);

        const row = document.createElement("div");
        row.className = "logLine";
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.gap = "8px";

        row.innerHTML = `
          <div style="min-width:0">
            <div style="font-weight:900;color:var(--txt);font-size:11px">${escapeHTML(f.displayName || "Friend")}</div>
            <div style="color:var(--muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px">${escapeHTML(f.email || f.uid || "")}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn tiny toggleBtn" type="button">${selected ? "✓" : "+"}</button>
            <button class="btn tiny warn callBtn" type="button">Call</button>
          </div>
        `;

        const toggleBtn = row.querySelector(".toggleBtn");
        const callBtn = row.querySelector(".callBtn");

        if (toggleBtn) toggleBtn.addEventListener("click", () => onToggle(key));
        if (callBtn) callBtn.addEventListener("click", () => onQuickCall(key));

        box.appendChild(row);
      });
    },

    syncSettingsUI(s) {
      const E = this.els;
      if (!s) return;

      if (E.setSpeakerDefaultTxt) safeText(E.setSpeakerDefaultTxt, s.speakerDefault ? "ON" : "OFF");
      if (E.setMicDefaultTxt) safeText(E.setMicDefaultTxt, s.micDefault ? "ON" : "OFF");
      if (E.setSoundDefaultTxt) safeText(E.setSoundDefaultTxt, s.soundDefault ? "ON" : "OFF");
      if (E.setEchoTxt) safeText(E.setEchoTxt, s.echoMode || "AUTO");

      if (E.setPingHost) safeText(E.setPingHost, s.pingHost || DEFAULT_PING_HOST);
      if (E.setUpdateRateTxt) safeText(E.setUpdateRateTxt, s.updateRate || "Normal");

      if (E.setLockTxt) safeText(E.setLockTxt, s.lockCall ? "ON" : "OFF");
      if (E.setLogsTxt) safeText(E.setLogsTxt, s.autoClearLogs ? "ON" : "OFF");
    },

    syncThemeUI(mode) {
      const E = this.els;
      if (E.themeModeTxt) safeText(E.themeModeTxt, mode || "system");
    }
  };

  /* =========================
     Part 9 — SOUND (WebAudio)
     ========================= */
  const Sound = (() => {
    let ctx = null;

    function getCtx() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx;
    }
    function unlock() {
      try {
        const ac = getCtx();
        if (ac.state === "suspended") ac.resume();
      } catch (_) {}
    }
    function tone(freq, durationMs, type = "sine", gain = 0.06) {
      try {
        const ac = getCtx();
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = gain;
        o.connect(g);
        g.connect(ac.destination);
        o.start();
        o.stop(ac.currentTime + (durationMs / 1000));
      } catch (_) {}
    }
    function beepPattern() {
      tone(880, 100, "square", 0.05);
      setTimeout(() => tone(880, 100, "square", 0.05), 140);
      setTimeout(() => tone(880, 100, "square", 0.05), 280);
      setTimeout(() => tone(660, 450, "sawtooth", 0.04), 440);
    }
    function tactical() {
      tone(1200, 70, "square", 0.04);
      setTimeout(() => tone(1400, 70, "square", 0.04), 110);
      setTimeout(() => tone(1000, 90, "square", 0.04), 220);
    }
    function teesh() {
      try {
        const ac = getCtx();
        const bufferSize = Math.floor(ac.sampleRate * 0.25);
        const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.25;

        const src = ac.createBufferSource();
        const g = ac.createGain();
        g.gain.value = 0.12;
        src.buffer = buffer;
        src.connect(g);
        g.connect(ac.destination);
        src.start();
      } catch (_) {}
    }
    function tentilik() {
      tone(1200, 90, "sine", 0.05);
      setTimeout(() => tone(1600, 140, "sine", 0.05), 120);
    }
    return { unlock, beepPattern, tactical, teesh, tentilik, tone, _getCtx: () => getCtx() };
  })();

  /* =========================
     Part 10 — THEME (system/dark/light)
     ========================= */
  const Theme = (() => {
    const KEY = "theme_mode"; // system|dark|light

    function get() {
      const v = String(Store.getRaw(KEY) || "system").toLowerCase();
      if (v === "dark" || v === "light") return v;
      return "system";
    }

    function apply(mode) {
      const m = String(mode || "system").toLowerCase();
      if (m === "dark" || m === "light") {
        document.documentElement.setAttribute("data-theme", m);
        Store.setRaw(KEY, m);
        UI.syncThemeUI(m);
        return m;
      }
      // system
      document.documentElement.removeAttribute("data-theme");
      Store.setRaw(KEY, "system");
      UI.syncThemeUI("system");
      return "system";
    }

    function cycle() {
      const cur = get();
      const next = (cur === "system") ? "dark" : (cur === "dark") ? "light" : "system";
      const applied = apply(next);
      Log.write("info", "Theme: " + applied);
      AndroidBridge.vibrate(18);
    }

    function init() {
      apply(get());
    }

    return { init, get, apply, cycle };
  })();

  /* =========================
     Part 11 — DRAWER (side panel)
     ========================= */
  const Drawer = (() => {
    function isOpen() { return document.body.classList.contains("drawerOpen") || document.body.classList.contains("drawer-open"); }

    function open() {
      document.body.classList.add("drawerOpen");
      document.body.classList.add("drawer-open");
      if (UI.els.drawerOverlay){ UI.els.drawerOverlay.classList.add("show"); UI.els.drawerOverlay.classList.remove("hidden"); }
      if (UI.els.drawer){ UI.els.drawer.classList.remove("hidden"); UI.els.drawer.setAttribute("aria-hidden","false"); }
    }

    function close() {
      document.body.classList.remove("drawerOpen");
      document.body.classList.remove("drawer-open");
      // keep overlay present if your CSS uses opacity; still safe to hide
      if (UI.els.drawerOverlay){ UI.els.drawerOverlay.classList.remove("show"); UI.els.drawerOverlay.classList.add("hidden"); }
      if (UI.els.drawer){ UI.els.drawer.classList.add("hidden"); UI.els.drawer.setAttribute("aria-hidden","true"); }
    }

    function toggle() {
      if (isOpen()) close();
      else open();
    }

    function init() {
      // If your HTML already keeps drawer visible, remove hidden safely
      // We start CLOSED by default
      close();

      // Close when clicking any button with data-drawer-close
      const hook = () => {
        const root = UI.els.drawer;
        if (!root) return;
        $$(".drawerClose,[data-drawer-close]", root).forEach((el) => {
          el.addEventListener("click", () => close());
        });
      };
      hook();
    }

    return { init, open, close, toggle, isOpen };
  })();

  /* =========================
     Part 12 — MIC HEART MONITOR (RESTORED)
     - Works best with <canvas id="micWave"></canvas>
     ========================= */
  const MicViz = (() => {
    let canvas = null;
    let ctx = null;
    let ac = null;
    let analyser = null;
    let src = null;
    let data = null;
    let raf = 0;

    let lastY = 0;
    let lastLevel = 0; // 0..1
    let beatCooldown = 0;

    function _cssVar(name, fallback) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name);
        const s = String(v || "").trim();
        return s || fallback;
      } catch (_) { return fallback; }
    }

    function _ensureCanvasSize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const w = Math.max(60, Math.floor(rect.width * dpr));
      const h = Math.max(30, Math.floor(rect.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      if (!ctx) ctx = canvas.getContext("2d");
    }

    function _clear() {
      if (!ctx || !canvas) return;
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function _drawBeat(x, mid, amp, color) {
      // ECG spike pattern
      const h = canvas.height;
      const top = Math.max(4, mid - amp * (h * 0.46) - 8);
      const bot = Math.min(h - 4, mid + amp * (h * 0.18) + 10);

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.floor(canvas.width / 420));
      ctx.beginPath();
      ctx.moveTo(x - 10, mid);
      ctx.lineTo(x - 6, mid);
      ctx.lineTo(x - 4, top);
      ctx.lineTo(x - 2, mid + 6);
      ctx.lineTo(x + 2, bot);
      ctx.lineTo(x + 6, mid);
      ctx.lineTo(x + 10, mid);
      ctx.stroke();
    }

    function _loop() {
      if (!canvas || !ctx || !analyser || !data) return;
      raf = requestAnimationFrame(_loop);

      _ensureCanvasSize();
      const w = canvas.width;
      const h = canvas.height;
      const mid = Math.floor(h / 2);

      // scroll left
      const dx = Math.max(1, Math.floor(w / 160)); // speed based on width
      ctx.drawImage(canvas, -dx, 0);

      // fade right band
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.16)";
      ctx.fillRect(w - dx, 0, dx, h);

      analyser.getByteTimeDomainData(data);

      // RMS level
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      lastLevel = Math.max(0, Math.min(1, rms));

      // map to y
      const amp = Math.min(1, rms * 3.0); // boost
      const y = mid - amp * (h * 0.40);

      // stroke color from CSS var
      const color = _cssVar("--purple", "#a855f7");

      // draw line segment on right
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.floor(w / 380));
      ctx.beginPath();
      ctx.moveTo(w - dx - 1, lastY || mid);
      ctx.lineTo(w - 1, y);
      ctx.stroke();

      // beat detection (voice peaks)
      beatCooldown = Math.max(0, beatCooldown - 1);
      if (amp > 0.20 && beatCooldown === 0) {
        _drawBeat(w - Math.floor(dx / 2), mid, amp, color);
        beatCooldown = 18; // cooldown frames
      }

      // subtle baseline
      ctx.strokeStyle = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w - dx, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      lastY = y;
    }

    function stop() {
      try { if (raf) cancelAnimationFrame(raf); } catch (_) {}
      raf = 0;
      try { if (src) src.disconnect(); } catch (_) {}
      try { if (analyser) analyser.disconnect(); } catch (_) {}
      src = null;
      analyser = null;
      data = null;
      lastLevel = 0;
      lastY = 0;
      beatCooldown = 0;
      if (canvas && canvas.getContext) {
        ctx = canvas.getContext("2d");
        if (ctx) _clear();
      }
    }

    function start(targetCanvasEl, mediaStreamTrack) {
      canvas = targetCanvasEl && targetCanvasEl.tagName === "CANVAS" ? targetCanvasEl : null;
      if (!canvas) {
        // إذا ما عندك Canvas بنفس الـ ID، ما نكسر التطبيق
        return false;
      }

      try { ac = Sound._getCtx(); } catch (_) { ac = null; }
      if (!ac) return false;

      try {
        const t = mediaStreamTrack || null;
        if (!t) return false;

        const stream = new MediaStream([t]);
        src = ac.createMediaStreamSource(stream);
        analyser = ac.createAnalyser();
        analyser.fftSize = 2048;

        data = new Uint8Array(analyser.fftSize);

        src.connect(analyser);

        _ensureCanvasSize();
        _clear();

        lastY = Math.floor(canvas.height / 2);
        lastLevel = 0;

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(_loop);
        return true;
      } catch (_) {
        stop();
        return false;
      }
    }

    function level() { return lastLevel || 0; }

    return { start, stop, level };
  })();

  /* =========================
     Part 13 — FIREBASE COMPAT WRAPPER
     ========================= */
  const DB = (() => {
    let inited = false;
    let fs = null;
    let auth = null;

    function hasSDK() {
      return !!(window.firebase && typeof window.firebase.initializeApp === "function");
    }

    function initFirebaseCompat() {
      if (inited) return !!fs;
      inited = true;

      if (!hasSDK()) return false;

      try {
        if (!(window.firebase.apps && window.firebase.apps.length > 0)) {
          for (let i = 0; i < FIREBASE_CONFIGS.length; i++) {
            const cfg = FIREBASE_CONFIGS[i];
            try {
              window.firebase.initializeApp(cfg);
              break;
            } catch (_) {}
          }
        }

        auth = window.firebase.auth ? window.firebase.auth() : null;
        fs = window.firebase.firestore ? window.firebase.firestore() : null;

        try {
          if (auth && auth.setPersistence && window.firebase.auth && window.firebase.auth.Auth && window.firebase.auth.Auth.Persistence) {
            auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
          }
        } catch (_) {}

        return !!fs;
      } catch (_) {
        auth = null;
        fs = null;
        return false;
      }
    }

    function ready() { return fs ? true : initFirebaseCompat(); }
    function authReady() { return ready() && !!auth; }

    function serverTimestamp() {
      try { return window.firebase.firestore.FieldValue.serverTimestamp(); } catch (_) { return null; }
    }

    function doc(path) { return ready() ? fs.doc(path) : null; }
    function col(path) { return ready() ? fs.collection(path) : null; }

    async function set(pathOrRef, data, merge = true) {
      if (!ready()) return false;
      const ref = (typeof pathOrRef === "string") ? doc(pathOrRef) : pathOrRef;
      if (!ref) return false;
      await ref.set(data, { merge });
      return true;
    }

    async function add(path, data) {
      const c = col(path);
      if (!c) return null;
      return await c.add(data);
    }

    function onSnapshot(queryOrRef, cb, errCb) {
      if (!queryOrRef) return () => {};
      return queryOrRef.onSnapshot(cb, errCb);
    }

    function onAuthStateChanged(cb) {
      if (!authReady()) return () => {};
      try { return auth.onAuthStateChanged(cb); } catch (_) { return () => {}; }
    }

    async function signInAnonymously() {
      if (!authReady()) return null;
      try { return await auth.signInAnonymously(); } catch (_) { return null; }
    }

    function currentUser() {
      try { return authReady() ? auth.currentUser : null; } catch (_) { return null; }
    }

    async function queryUsersByEmail(email) {
      if (!ready()) return [];
      const e = String(email || "").trim().toLowerCase();
      if (!e) return [];
      try {
        const snap = await fs.collection("usersPublic").where("emailLower", "==", e).limit(10).get();
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        return out;
      } catch (_) { return []; }
    }

    async function queryUsersByNamePrefix(name) {
      if (!ready()) return [];
      const n = String(name || "").trim().toLowerCase();
      if (!n) return [];
      try {
        const end = n + "\uf8ff";
        const q = fs.collection("usersPublic")
          .orderBy("displayNameLower")
          .startAt(n)
          .endAt(end)
          .limit(10);
        const snap = await q.get();
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        return out;
      } catch (_) { return []; }
    }

    return {
      ready,
      authReady,
      serverTimestamp,
      doc,
      col,
      set,
      add,
      onSnapshot,
      onAuthStateChanged,
      signInAnonymously,
      currentUser,
      queryUsersByEmail,
      queryUsersByNamePrefix
    };
  })();

  /* =========================
     Part 14 — AUTH SYNC
     ========================= */
  const AuthSync = (() => {
    let lastSource = "none"; // android | firebase | none

    function isAnonymousUser(u) {
      try { return !!(u && u.isAnonymous); } catch (_) { return false; }
    }

    function applyProfile(p, source) {
      const name = String(p.name || "").trim() || (p.email ? safeNameFromEmail(p.email) : "User");
      const email = String(p.email || "").trim();
      const photoUrl = normalizePhotoUrl(p.photoUrl);

      App.state.profile.loggedIn = !!(email || name);
      App.state.profile.displayName = name;
      App.state.profile.email = email;
      App.state.profile.photoUrl = photoUrl;

      const locked = !!(source === "android" || source === "firebase");
      UI.setProfile({ name, email: email || "لم يتم تسجيل الدخول", photoUrl, locked });
      App.persistLocal();

      lastSource = source || "none";
      Log.write("good", `Profile updated (${lastSource}) ✅`);
    }

    function clearProfile(reason) {
      App.state.profile.loggedIn = false;
      App.state.profile.uid = null;

      const keepName = App.state.profile.displayNameLocal || "Guest";
      App.state.profile.displayName = keepName;
      App.state.profile.email = "";
      App.state.profile.photoUrl = "";

      UI.setProfile({
        name: keepName,
        email: "لم يتم تسجيل الدخول",
        photoUrl: "",
        locked: false
      });

      lastSource = "none";
      Log.write("warn", reason || "Profile cleared");
    }

    function onAndroidLogin(name, email, photoUrl) {
      const e = String(email || "").trim();
      const n = String(name || "").trim() || safeNameFromEmail(e);
      applyProfile({ name: n, email: e, photoUrl }, "android");
    }

    function onAndroidLogout() { clearProfile("Android logout"); }

    function onFirebaseUserChanged(user) {
      if (!user) {
        if (lastSource === "android") {
          Log.write("info", "Firebase user null (kept Android profile)");
          return;
        }
        clearProfile("Firebase signed out");
        return;
      }

      if (isAnonymousUser(user)) {
        if (lastSource === "android") {
          Log.write("info", "Firebase anonymous (kept Android profile)");
          return;
        }
        const localName = App.state.profile.displayNameLocal || "Guest";
        UI.setProfile({ name: localName, email: "لم يتم تسجيل الدخول", photoUrl: "", locked: false });
        Log.write("info", "Firebase anonymous session");
        return;
      }

      const email = user.email || "";
      const name = user.displayName || safeNameFromEmail(email);
      const photoUrl = user.photoURL || "";
      applyProfile({ name, email, photoUrl }, "firebase");
    }

    function init() {
      const localName = App.state.profile.displayNameLocal || App.state.profile.displayName || "Guest";
      const localEmail = App.state.profile.email || "";
      const localPhoto = App.state.profile.photoUrl || "";
      UI.setProfile({ name: localName, email: localEmail || "لم يتم تسجيل الدخول", photoUrl: localPhoto, locked: false });

      const prevOnAndroidUser = window.onAndroidUser;
      window.onAndroidUser = function(name, email, photo) {
        try { if (typeof prevOnAndroidUser === "function") prevOnAndroidUser(name, email, photo); } catch (_) {}
        try { onAndroidLogin(name, email, photo); } catch (_) {}
      };

      window.onAndroidLogin = function(name, email, photoUrl) { try { onAndroidLogin(name, email, photoUrl); } catch (_) {} };
      window.onAndroidLogout = function() { try { onAndroidLogout(); } catch (_) {} };
      window.onAndroidLoginFail = function(msg) { try { Log.write("bad", "Login failed: " + String(msg || "")); } catch (_) {} };
      // Apply any cached native user info (if native fired before app.js ready)
      try {
        const last = window.__MDV_LAST_ANDROID_USER__;
        if (last && (last.email || last.name)) onAndroidLogin(last.name || "", last.email || "", last.photo || "");
      } catch (_) {}
    }

    return { init, onFirebaseUserChanged, onAndroidLogin, onAndroidLogout, clearProfile };
  })();

  /* =========================
   Part 15 — AGORA WRAPPER
   ========================= */
const Voice = (() => {
  let client = null;
  let localTrack = null;
  let joined = false;
  const remote = new Map(); // uid -> audioTrack

  // SDK loader state
  let _sdkPromise = null;
  let _sdkLastErr = "";

  function hasSDK() { return !!window.AgoraRTC; }
  function isJoined() { return joined; }
  function getLocalTrack() { return localTrack; }
  function getSDKLastError() { return _sdkLastErr || ""; }

  function getLocalMediaStreamTrack() {
    try {
      if (!localTrack) return null;
      if (typeof localTrack.getMediaStreamTrack === "function") return localTrack.getMediaStreamTrack();
      return null;
    } catch (_) { return null; }
  }

  function _uniq(list) {
    const out = [];
    const seen = new Set();
    for (let i = 0; i < list.length; i++) {
      const s = String(list[i] || "").trim();
      if (!s) continue;
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
    return out;
  }

  function _loadScriptOnce(src, timeoutMs) {
    return new Promise((resolve) => {
      try {
        const scripts = document.querySelectorAll('script[data-mdv-agora-src]');
          let exists = null;
          for (let i = 0; i < scripts.length; i++) {
            try { if (scripts[i].getAttribute("data-mdv-agora-src") === src) { exists = scripts[i]; break; } } catch (_) {}
          }
        if (exists) {
          // already requested, wait a little
          setTimeout(() => resolve(true), 60);
          return;
        }

        const s = document.createElement("script");
        s.async = true;
        s.defer = true;
        s.src = src;
        s.setAttribute("data-mdv-agora", "1");
        s.setAttribute("data-mdv-agora-src", src);

        let done = false;
        const finish = (ok, msg) => {
          if (done) return;
          done = true;
          try { clearTimeout(t); } catch (_) {}
          if (!ok && msg) _sdkLastErr = String(msg || "");
          resolve(!!ok);
        };

        s.onload = () => finish(true, "");
        s.onerror = () => finish(false, "Failed to load: " + src);

        document.head.appendChild(s);

        const t = setTimeout(() => {
          try { s.remove(); } catch (_) {}
          finish(false, "Timeout loading: " + src);
        }, Math.max(1500, Number(timeoutMs) || 12000));
      } catch (e) {
        _sdkLastErr = errToText(e);
        resolve(false);
      }
    });
  }

  async function ensureSDK(opts = {}) {
    const timeoutMs = Math.max(2500, Math.min(20000, Number(opts.timeoutMs || 12000)));
    const force = !!opts.force;

    if (hasSDK()) return true;

    if (_sdkPromise && !force) {
      try { return await _sdkPromise; } catch (_) { return hasSDK(); }
    }

    _sdkPromise = (async () => {
      _sdkLastErr = "";

      // 1) user override (localStorage) OR injected by HTML
      const override =
        String(Store.getRaw("agora_sdk_url") || "").trim() ||
        String(window.__MDV_AGORA_SDK_URL__ || "").trim();

      // 2) fallbacks (prefer local file near index.html for APK)
      const urls = _uniq([
        override,

        // Local file (place AgoraRTC_N.js next to index.html in android_asset)
        "AgoraRTC_N.js",
        "./AgoraRTC_N.js",

        // Official CDNs
        "https://download.agora.io/sdk/release/AgoraRTC_N.js",
        "https://cdn.agora.io/sdk/release/AgoraRTC_N.js",

        // Unpkg fallback (versioned + latest)
        "https://unpkg.com/agora-rtc-sdk-ng@4.20.2/AgoraRTC_N.js",
        "https://unpkg.com/agora-rtc-sdk-ng/AgoraRTC_N.js",
      ]);

      for (let i = 0; i < urls.length; i++) {
        if (hasSDK()) return true;

        const src = urls[i];
        if (!src) continue;

        Log.write("warn", "تحميل Agora SDK… (" + (i + 1) + "/" + urls.length + ")");
        const ok = await _loadScriptOnce(src, timeoutMs);

        // allow script to register global
        await sleep(80);

        if (ok && hasSDK()) return true;
      }

      return hasSDK();
    })();

    let ok = false;
    try { ok = await _sdkPromise; }
    catch (e) {
      _sdkLastErr = errToText(e);
      ok = hasSDK();
    }

    if (!ok) _sdkPromise = null; // allow retries
    return ok;
  }

  async function join({ appId, channel, token, uid }) {
    if (!appId) throw new Error("Agora APP_ID missing");
    if (!channel) throw new Error("Channel missing");

    // auto-load SDK if missing
    if (!hasSDK()) {
      const ok = await ensureSDK({ timeoutMs: 12000 });
      if (!ok) throw new Error("AgoraRTC not loaded");
    }

    if (!client) {
      client = window.AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      wireEvents();
    }

    await client.join(appId, channel, token || null, uid || null);

    // Apply echo settings (safe fallback if SDK ignores unknown keys)
    let track = null;
    try {
      const echoMode = String((App && App.state && App.state.settings && App.state.settings.echoMode) || "AUTO").toUpperCase();
      const cfg = (echoMode === "ON") ? { AEC: true, AGC: true, ANS: true }
        : (echoMode === "OFF") ? { AEC: false, AGC: false, ANS: false }
        : { AEC: true, AGC: true, ANS: true };

      track = await window.AgoraRTC.createMicrophoneAudioTrack(cfg);
    } catch (_) {
      track = await window.AgoraRTC.createMicrophoneAudioTrack();
    }

    localTrack = track;
    await client.publish([localTrack]);

    joined = true;
    return true;
  }

  async function leave() {
    if (!client) return;

    try {
      if (localTrack) {
        localTrack.stop();
        localTrack.close();
      }
    } catch (_) {}
    localTrack = null;

    try {
      for (const [, tr] of remote.entries()) {
        try { tr.stop && tr.stop(); } catch (_) {}
      }
      remote.clear();
    } catch (_) {}

    try { await client.leave(); } catch (_) {}
    joined = false;
  }

  function setMicMuted(muted) {
    if (!localTrack) return;
    try {
      if (typeof localTrack.setEnabled === "function") localTrack.setEnabled(!muted);
      else if (typeof localTrack.setMuted === "function") localTrack.setMuted(!!muted);
    } catch (_) {}
  }

  function setSpeakerMuted(muted) {
    for (const [, tr] of remote.entries()) {
      try { if (tr && typeof tr.setVolume === "function") tr.setVolume(muted ? 0 : 100); } catch (_) {}
    }
  }

  function wireEvents() {
    if (!client) return;

    client.on("user-published", async (user, mediaType) => {
      try {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
          remote.set(String(user.uid), user.audioTrack);
          App.onRemoteUsersChanged();
        }
      } catch (e) {
        Log.write("bad", "Agora subscribe failed: " + errToText(e));
      }
    });

    client.on("user-unpublished", (user, mediaType) => {
      try {
        if (mediaType === "audio") {
          const tr = remote.get(String(user.uid));
          try { tr && tr.stop && tr.stop(); } catch (_) {}
          remote.delete(String(user.uid));
          App.onRemoteUsersChanged();
        }
      } catch (_) {}
    });

    client.on("user-left", (user) => {
      try {
        const tr = remote.get(String(user.uid));
        try { tr && tr.stop && tr.stop(); } catch (_) {}
        remote.delete(String(user.uid));
        App.onRemoteUsersChanged();
      } catch (_) {}
    });

    client.on("network-quality", (stats) => {
      App.onAgoraNetworkQuality(stats);
    });

    client.on("exception", (e) => {
      Log.write("bad", "Agora exception: " + errToText(e));
    });
  }

  return {
    hasSDK,
    ensureSDK,
    getSDKLastError,
    join,
    leave,
    isJoined,
    setMicMuted,
    setSpeakerMuted,
    getLocalTrack,
    getLocalMediaStreamTrack
  };
})();

  /* =========================
     Part 16 — NORMALIZERS + HISTORY
     ========================= */
  function normalizeFriend(f) {
    const o = { ...(f || {}) };
    o.uid = String(o.uid || o.id || "").trim();
    o.displayName = String(o.displayName || "Friend").trim();
    o.email = String(o.email || "").trim();
    o.photoUrl = String(o.photoUrl || "").trim();
    o.id = String(o.id || o.uid || o.email || uidShort()).trim();
    return o;
  }

  const CallHistory = (() => {
    const KEY = "call_history";
    const MAX = 50;

    function list() {
      const a = Store.getJson(KEY, []);
      return Array.isArray(a) ? a : [];
    }

    function push(item) {
      const a = list();
      a.unshift(item);
      while (a.length > MAX) a.pop();
      Store.setJson(KEY, a);
    }

    function mark(type, payload) {
      push({ t: now(), type: String(type || "event"), payload: payload || {} });
    }

    return { list, mark };
  })();

  /* =========================
     Part 17 — APP STATE + INIT
     ========================= */
  const App = {
    state: {
      profile: {
        loggedIn: false,
        uid: null,
        displayName: "Guest",
        email: "",
        photoUrl: "",
        displayNameLocal: ""
      },

      call: {
        inCall: false,
        joining: false,
        leaving: false,
        channel: "",
        token: "",
        startAt: 0,
        timerT: null,
        usageT: null
      },

      speakerOn: false,
      micMuted: false,
      speakerMuted: false,

      fm: {
        enabled: false,
        intervalMs: FM_INTERVAL_MS, // LOCKED
        running: false,
        loopT: null,
        abort: false
      },

      net: {
        type: "none",
        rssi: null,
        linkMbps: null,
        hasInternet: false,
        pingMs: -1,
        jitterMs: 0,
        lossPct: 0,
        upKbps: 0,
        downKbps: 0,
        audioLevel: 0
      },

      friends: { list: [], selected: new Set() },

      incoming: {
        active: false,
        docPath: null,
        fromName: "",
        fromEmail: "",
        channel: "",
        createdAt: 0
      },

      settings: {
        speakerDefault: false,
        micDefault: true,
        soundDefault: true,
        echoMode: "AUTO",
        pingHost: DEFAULT_PING_HOST,
        updateRate: "Normal", // Low/Normal/High
        lockCall: false,
        autoClearLogs: false
      },

      unsub: {
        incomingCalls: null,
        auth: null
      },

      __presenceT: null,
      __netT: null,
      __pingT: null,
      __audioT: null,

      __domObserver: null
    },

    init() {
      this.ensureUIBound();
      this.loadLocal();

      Theme.init();        // NEW
      Drawer.init();       // NEW
      AuthSync.init();

      // LEDs initial
      UI.setLed(UI.els.ledWeb, "on");
      UI.setLed(UI.els.ledFirebase, DB.ready() ? "warn" : "bad");
      UI.setLed(UI.els.ledListener, "off");
      UI.setLed(UI.els.ledMicPerm, "off");
      UI.setLed(UI.els.ledAgora, Voice.hasSDK() ? "warn" : "bad");
      UI.setLed(UI.els.ledInCall, "off");
      UI.setLed(UI.els.ledNet, "off");
      UI.setLed(UI.els.ledSrv, "off");
      UI.setLed(UI.els.ledCallQ, "off");

      this.syncForceMajeureUI();
      this.renderFriends();
      this.initFirebaseAuth();

      this.startNetworkMonitor();
      this.startPingMonitor();
      this.startAudioMeter(); // NEW (updates audioLevel from MicViz)

      UI.setCallTimer(0);
      UI.setCallState("disconnected");

      UI.syncSettingsUI(this.state.settings);
      this.syncButtonsText();

      Log.write("good", "App ready ✅");
      Log.write("info", Voice.hasSDK() ? "Agora SDK: OK" : "Agora SDK: NOT LOADED (check script)");
      Log.write("info", "Version: " + APP_VERSION);

      try { console.log("✅ App.js loaded, AGORA_APP_ID =", AGORA_APP_ID); } catch (_) {}
      this.attachLifecycle();
    },

    /* =========================
       Part 18 — UI REBIND + LIFECYCLE
       ========================= */
    ensureUIBound() {
      const mustExist = () => {
        const a = byId("joinBtn");
        const b = byId("leaveBtn");
        const c = byId("channel");
        const d = byId("log");
        return !!(a && b && c && d);
      };

      const doBind = () => {
        try {
          UI.bind();
          Log.write("good", "UI bound ✅");
          UI.syncSettingsUI(this.state.settings);
          UI.syncThemeUI(Theme.get());
          this.syncButtonsText();
        } catch (e) {
          try { console.warn(e); } catch (_) {}
        }
      };

      if (mustExist()) {
        doBind();
        return;
      }

      try {
        if (this.state.__domObserver) {
          this.state.__domObserver.disconnect();
          this.state.__domObserver = null;
        }
      } catch (_) {}

      const obs = new MutationObserver(() => {
        if (mustExist()) {
          doBind();
          try { obs.disconnect(); } catch (_) {}
        }
      });

      try {
        obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
        this.state.__domObserver = obs;
      } catch (_) {}

      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (mustExist()) {
          clearInterval(t);
          doBind();
          return;
        }
        if (tries >= 12) {
          clearInterval(t);
          try { console.warn("UI bind timed out, check IDs in index.html"); } catch (_) {}
        }
      }, 250);
    },

    attachLifecycle() {
      const onHide = () => { try { this.setPresenceState("offline"); } catch (_) {} };
      const onShow = () => {
        try { this.setPresenceState(this.state.call.inCall ? "in_call" : "online"); } catch (_) {}
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") onHide();
        else onShow();
      });

      window.addEventListener("pagehide", () => onHide());
      window.addEventListener("beforeunload", () => onHide());
    },

    syncForceMajeureUI() {
      if (UI.els.swFM) UI.els.swFM.checked = !!this.state.fm.enabled;

      if (UI.els.fmIntervalSel) {
        UI.els.fmIntervalSel.value = String(FM_INTERVAL_MS);
        UI.els.fmIntervalSel.disabled = true;
      }
      if (UI.els.fmRebootSel) {
        UI.els.fmRebootSel.value = String(FM_REBOOT_SECONDS);
        UI.els.fmRebootSel.disabled = true;
      }

      this.state.fm.intervalMs = FM_INTERVAL_MS;
    },

    syncButtonsText() {
      if (UI.els.btnSpeaker) safeText(UI.els.btnSpeaker, this.state.speakerOn ? "🔊 Speaker: ON" : "🔊 Speaker: OFF");
      if (UI.els.btnMuteMic) safeText(UI.els.btnMuteMic, this.state.micMuted ? "🎙️ Mic: OFF" : "🎙️ Mic: ON");
      if (UI.els.btnMuteSpk) safeText(UI.els.btnMuteSpk, this.state.speakerMuted ? "🔇 Sound: OFF" : "🔇 Sound: ON");
    },

    /* =========================
       Part 19 — LOCAL LOAD/SAVE + AUTH
       ========================= */
    loadLocal() {
      const s = Store.getJson("state", null);
      if (!s) return;

      try {
        if (s.profile) {
          this.state.profile.displayNameLocal = s.profile.displayNameLocal || "";
          this.state.profile.email = s.profile.email || "";
          this.state.profile.photoUrl = s.profile.photoUrl || "";
          this.state.profile.displayName = s.profile.displayName || this.state.profile.displayName;
        }

        if (s.friends && Array.isArray(s.friends.list)) {
          this.state.friends.list = s.friends.list.map(normalizeFriend);
        }

        if (s.fm) {
          this.state.fm.enabled = !!s.fm.enabled;
          this.state.fm.intervalMs = FM_INTERVAL_MS;
        }

        if (s.settings) {
          const x = s.settings;
          this.state.settings.speakerDefault = !!x.speakerDefault;
          this.state.settings.micDefault = (x.micDefault !== undefined) ? !!x.micDefault : true;
          this.state.settings.soundDefault = (x.soundDefault !== undefined) ? !!x.soundDefault : true;
          this.state.settings.echoMode = String(x.echoMode || "AUTO").toUpperCase();
          this.state.settings.pingHost = String(x.pingHost || DEFAULT_PING_HOST);
          this.state.settings.updateRate = String(x.updateRate || "Normal");
          this.state.settings.lockCall = !!x.lockCall;
          this.state.settings.autoClearLogs = !!x.autoClearLogs;
        }
      } catch (_) {}
    },

    persistLocal() {
      const s = {
        profile: {
          displayNameLocal: this.state.profile.displayNameLocal || "",
          displayName: this.state.profile.displayName || "Guest",
          email: this.state.profile.email || "",
          photoUrl: this.state.profile.photoUrl || ""
        },
        friends: { list: this.state.friends.list || [] },
        fm: { enabled: !!this.state.fm.enabled, intervalMs: FM_INTERVAL_MS },
        settings: { ...this.state.settings }
      };
      Store.setJson("state", s);
    },

    getPresenceRoom() {
      const v = UI.els.inPresence ? (UI.els.inPresence.value || "").trim() : "";
      return v || "call_room1";
    },

    getChannel() {
      const v = UI.els.inChannel ? (UI.els.inChannel.value || "").trim() : "";
      return v;
    },

    getToken() {
      const v = UI.els.inToken ? (UI.els.inToken.value || "").trim() : "";
      return v;
    },

    getName() {
      const v = UI.els.inName ? (UI.els.inName.value || "").trim() : "";
      return v || this.state.profile.displayNameLocal || this.state.profile.displayName || "User";
    },

    getMyUid() {
      const u = DB.currentUser && DB.currentUser();
      if (u && u.uid) return u.uid;

      let id = Store.getRaw("pseudo_uid");
      if (!id) {
        id = "device_" + uidShort();
        Store.setRaw("pseudo_uid", id);
      }
      return id;
    },

    getBlockUntil() {
      const v = Number(Store.getRaw("block_until") || "0");
      return Number.isFinite(v) ? v : 0;
    },

    setBlockUntil(ts) {
      Store.setRaw("block_until", String(ts || 0));
    },

    async upsertMyPublicProfile() {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      const dn = this.getName();

      const payload = {
        uid,
        displayName: dn,
        displayNameLower: dn.toLowerCase(),
        email: this.state.profile.email || "",
        emailLower: (this.state.profile.email || "").toLowerCase(),
        photoUrl: this.state.profile.photoUrl || "",
        updatedAt: DB.serverTimestamp() || now()
      };

      await DB.set(`usersPublic/${uid}`, payload, true);
    },

    initFirebaseAuth() {
      if (!DB.authReady()) {
        UI.setLed(UI.els.ledFirebase, "bad");
        Log.write("warn", "Firebase SDK غير محمّل");
        return;
      }

      try { if (this.state.unsub.auth) this.state.unsub.auth(); } catch (_) {}

      this.state.unsub.auth = DB.onAuthStateChanged(async (user) => {
        AuthSync.onFirebaseUserChanged(user);

        if (user) {
          this.state.profile.uid = user.uid;
          UI.setLed(UI.els.ledFirebase, "on");

          this.watchIncomingCalls(true);
          this.startPresenceHeartbeat(true);

          this.upsertMyPublicProfile().catch(() => {});
        } else {
          UI.setLed(UI.els.ledFirebase, "warn");
          const res = await DB.signInAnonymously();
          if (!res) Log.write("warn", "Anonymous sign-in failed (check Firebase config)");
        }
      });
    },

    /* =========================
       Part 20 — CALL FLOW
       ========================= */
    async joinFlow() {
      if (this.state.call.joining) {
        Log.write("warn", "Join already running...");
        return;
      }
      this.state.call.joining = true;

      try {
        const blockUntil = this.getBlockUntil();
        if (blockUntil && now() < blockUntil) {
          const leftSec = Math.ceil((blockUntil - now()) / 1000);
          Log.write("bad", `تم حظر المكالمات مؤقتاً ⛔ (${fmtTime(leftSec)})`);
          return;
        }

        const channel = this.getChannel();
        if (!channel) {
          Log.write("warn", "اكتب Channel يدويًا أولاً");
          return;
        }

        if (!AGORA_APP_ID || !String(AGORA_APP_ID).trim()) {
          Log.write("bad", "AGORA_APP_ID غير موجود");
          UI.setLed(UI.els.ledAgora, "bad");
          return;
        }

        if (!Voice.hasSDK()) {
  UI.setLed(UI.els.ledAgora, "warn");
  Log.write("warn", "Agora SDK غير محمّل — جاري التحميل…");
  const okSdk = await Voice.ensureSDK({ timeoutMs: 12000 });
  if (!okSdk) {
    const hint = (Voice.getSDKLastError && Voice.getSDKLastError()) ? Voice.getSDKLastError() : "";
    Log.write("bad", "AgoraRTC غير محمّل (تحقق من رابط SDK / أو ضع AgoraRTC_N.js داخل assets)");
    if (hint) Log.write("warn", "SDK details: " + hint);
    UI.setLed(UI.els.ledAgora, "bad");
    return;
  }
  Log.write("good", "Agora SDK loaded ✅");
}

        if (!window.isSecureContext && !AndroidBridge.exists()) {
          Log.write("warn", "تنبيه: البيئة ليست SecureContext — قد تمنع صلاحية المايك");
        }

        const token = this.getToken();
        Log.write("warn", `Joining: ${channel}`);

        try {
          AndroidBridge.setCallMode(true);
          UI.setLed(UI.els.ledAgora, "warn");

          await Voice.join({ appId: AGORA_APP_ID, channel, token, uid: null });

          UI.setLed(UI.els.ledMicPerm, "on");
          UI.setLed(UI.els.ledAgora, "on");

          // Apply defaults
          this.state.speakerOn = !!this.state.settings.speakerDefault;
          this.state.micMuted = !this.state.settings.micDefault;
          this.state.speakerMuted = !this.state.settings.soundDefault;

          AndroidBridge.setSpeaker(this.state.speakerOn);
          Voice.setMicMuted(this.state.micMuted);
          Voice.setSpeakerMuted(this.state.speakerMuted);
          this.syncButtonsText();

          // Start mic heart monitor (RESTORED)
          const mst = Voice.getLocalMediaStreamTrack();
          if (mst && UI.els.micWave) {
            const ok = MicViz.start(UI.els.micWave, mst);
            if (ok) Log.write("good", "Mic Heart Monitor: ON ❤️");
            else Log.write("warn", "Mic Heart Monitor: element/track missing");
          } else {
            Log.write("warn", "Mic Heart Monitor: add <canvas id='micWave'> in HTML");
          }

          this.state.call.inCall = true;
          this.state.call.channel = channel;
          this.state.call.token = token;
          this.state.call.startAt = now();

          this.startCallTimer();
          this.startUsageTick();

          UI.setCallState("connected");
          Log.write("good", "✅ CONNECTED");

          CallHistory.mark("join", { channel });

          this.setPresenceState("in_call");

          if (this.state.fm.enabled) this.startForceMajeureLoop();
        } catch (e) {
          const why = errToText(e);
          Log.write("bad", "Join failed (Agora): " + why);
          Log.write("warn", "أسباب شائعة: صلاحية المايك، SDK لم يحمل، Token مطلوب.");

          const low = String(why).toLowerCase();
          UI.setLed(UI.els.ledMicPerm, (low.includes("notallowed") || low.includes("permission")) ? "bad" : "warn");
          UI.setLed(UI.els.ledAgora, "bad");
          UI.setCallState("disconnected");
          AndroidBridge.setCallMode(false);

          this.state.call.inCall = false;
          this.stopCallTimer();
          this.stopUsageTick();

          MicViz.stop();

          CallHistory.mark("join_fail", { channel, error: why });
        }
      } finally {
        this.state.call.joining = false;
      }
    },

    async leaveFlow() {
      if (this.state.call.leaving) {
        Log.write("warn", "Leave already running...");
        return;
      }
      this.state.call.leaving = true;

      try {
        this.stopForceMajeureLoop();
        Log.write("warn", "Leaving...");

        try { await Voice.leave(); } catch (_) {}
        AndroidBridge.setCallMode(false);

        this.state.call.inCall = false;
        this.state.call.channel = "";
        this.state.call.token = "";

        this.stopCallTimer();
        this.stopUsageTick();

        MicViz.stop();
        this.state.net.audioLevel = 0;

        UI.setLed(UI.els.ledAgora, "off");
        UI.setCallState("disconnected");
        Log.write("good", "تم الخروج");

        CallHistory.mark("leave", {});
        this.setPresenceState("online");
      } finally {
        this.state.call.leaving = false;
      }
    },

    endCall() {
      try { AndroidBridge.endCall(); } catch (_) {}
      return this.leaveFlow();
    },

    startCallTimer() {
      this.stopCallTimer();
      this.state.call.timerT = setInterval(() => {
        if (!this.state.call.inCall || !this.state.call.startAt) return UI.setCallTimer(0);
        const sec = Math.floor((now() - this.state.call.startAt) / 1000);
        UI.setCallTimer(sec);
      }, 1000);
    },

    stopCallTimer() {
      if (this.state.call.timerT) clearInterval(this.state.call.timerT);
      this.state.call.timerT = null;
      UI.setCallTimer(0);
    },

    startUsageTick() {
      this.stopUsageTick();
      this.state.call.usageT = setInterval(async () => {
        try {
          if (!this.state.call.inCall) return;
          const dur = now() - (this.state.call.startAt || now());
          if (dur >= CALL_LIMIT_MS) {
            Log.write("bad", "⛔ تم الوصول للحد (3 ساعات) — سيتم إغلاق المكالمة وبدء حظر 20 ساعة");
            Sound.beepPattern();
            AndroidBridge.vibrate(120);

            await this.leaveFlow();

            const until = now() + BLOCK_MS;
            this.setBlockUntil(until);
            Log.write("warn", `حظر: ${fmtTime(Math.ceil(BLOCK_MS / 1000))}`);

            CallHistory.mark("blocked", { until });
          }
        } catch (_) {}
      }, USAGE_TICK_MS);
    },

    stopUsageTick() {
      if (this.state.call.usageT) clearInterval(this.state.call.usageT);
      this.state.call.usageT = null;
    },

    onRemoteUsersChanged() {},

    toggleSpeaker() {
      this.state.speakerOn = !this.state.speakerOn;
      AndroidBridge.setSpeaker(this.state.speakerOn);
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.speakerOn ? "🔊 Speaker ON" : "🔈 Speaker OFF");
    },

    toggleMuteMic() {
      this.state.micMuted = !this.state.micMuted;
      try { Voice.setMicMuted(this.state.micMuted); } catch (_) {}
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.micMuted ? "🎙️ Mic MUTED" : "🎙️ Mic ON");
    },

    toggleMuteSpeaker() {
      this.state.speakerMuted = !this.state.speakerMuted;
      try { Voice.setSpeakerMuted(this.state.speakerMuted); } catch (_) {}
      AndroidBridge.vibrate(20);
      this.syncButtonsText();
      Log.write("info", this.state.speakerMuted ? "🔇 Output MUTED" : "🔊 Output ON");
    },

    /* =========================
       Part 21 — FORCE MAJEURE (LOCKED)
       ========================= */
    toggleForceMajeure() {
      this.state.fm.enabled = !!(UI.els.swFM && UI.els.swFM.checked);
      this.state.fm.intervalMs = FM_INTERVAL_MS;
      this.persistLocal();

      if (this.state.fm.enabled) {
        Log.write("warn", "FM: ON (كل دقيقتين)");
        Sound.tactical();
        if (this.state.call.inCall) this.startForceMajeureLoop();
      } else {
        Log.write("good", "FM: OFF");
        this.stopForceMajeureLoop();
      }
    },

    startForceMajeureLoop() {
      const fm = this.state.fm;
      fm.intervalMs = FM_INTERVAL_MS;
      if (!fm.enabled) return;
      if (fm.running) return;
      if (!this.state.call.inCall) return;

      fm.running = true;
      fm.abort = false;

      const loop = async () => {
        if (!fm.enabled || fm.abort) return;

        await sleepWithAbort(fm.intervalMs, () => (!fm.enabled || fm.abort || !this.state.call.inCall));
        if (!fm.enabled || fm.abort) return;
        if (!this.state.call.inCall) { fm.running = false; return; }

        Sound.beepPattern();
        AndroidBridge.vibrate(60);
        Log.write("warn", "FM: Alarm!");

        const ch = this.getChannel() || this.state.call.channel;
        const token = this.getToken() || this.state.call.token;

        try { await Voice.leave(); } catch (_) {}
        AndroidBridge.setCallMode(false);

        this.state.call.inCall = false;
        this.stopCallTimer();
        this.stopUsageTick();

        UI.setCallState("disconnected");
        UI.setLed(UI.els.ledAgora, "warn");

        let count = FM_REBOOT_SECONDS;
        UI.showReboot(true, count);
        Sound.teesh();

        while (count > 0 && fm.enabled && !fm.abort) {
          UI.showReboot(true, count);
          await sleep(1000);
          count--;
        }

        UI.showReboot(false, 0);
        if (!fm.enabled || fm.abort) { fm.running = false; return; }

        Sound.tentilik();
        Log.write("warn", "FM: Reconnect...");

        try {
          AndroidBridge.setCallMode(true);
          await Voice.join({ appId: AGORA_APP_ID, channel: ch, token, uid: null });

          Voice.setMicMuted(this.state.micMuted);
          Voice.setSpeakerMuted(this.state.speakerMuted);

          // restart visualizer after reconnect
          const mst = Voice.getLocalMediaStreamTrack();
          if (mst && UI.els.micWave) MicViz.start(UI.els.micWave, mst);

          this.state.call.inCall = true;
          this.state.call.startAt = now();

          this.startCallTimer();
          this.startUsageTick();

          UI.setCallState("connected");
          UI.setLed(UI.els.ledAgora, "on");
          UI.setLed(UI.els.ledMicPerm, "on");

          Log.write("good", "FM: ✅ Reconnected");
          CallHistory.mark("fm_reconnect", { channel: ch });
        } catch (e) {
          Log.write("bad", "FM: Rejoin failed: " + errToText(e));
          UI.setLed(UI.els.ledAgora, "bad");
          AndroidBridge.setCallMode(false);
          fm.running = false;
          CallHistory.mark("fm_fail", { error: errToText(e) });
          return;
        }

        if (fm.enabled && !fm.abort) fm.loopT = setTimeout(loop, 50);
        else fm.running = false;
      };

      fm.loopT = setTimeout(loop, 50);
    },

    stopForceMajeureLoop() {
      const fm = this.state.fm;
      fm.abort = true;
      fm.running = false;
      if (fm.loopT) clearTimeout(fm.loopT);
      fm.loopT = null;
      UI.showReboot(false, 0);
    },

    onAgoraNetworkQuality(stats) {
      if (!stats) return;

      const up = Number(stats.uplinkNetworkQuality || 0);
      const down = Number(stats.downlinkNetworkQuality || 0);
      const q = Math.max(up, down);

      let level = "warn";
      if (q === 0) level = "warn";
      else if (q <= 2) level = "on";
      else if (q === 3) level = "warn";
      else level = "bad";

      UI.setLed(UI.els.ledCallQ, level);

      this.state.net.jitterMs = (level === "on") ? 10 : (level === "warn") ? 25 : 70;
      this.state.net.lossPct = (level === "on") ? 0.8 : (level === "warn") ? 3.5 : 12;
      this.updateQualityPanels();
    },

    /* =========================
       Part 22 — PRESENCE + INCOMING CALLS
       ========================= */
    async startPresenceHeartbeat(force = false) {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      if (!uid) return;

      if (this.state.__presenceT && !force) return;
      if (this.state.__presenceT) clearInterval(this.state.__presenceT);

      const roomId = this.getPresenceRoom();
      const path = `presenceRooms/${roomId}/users/${uid}`;

      const writePresence = async () => {
        const payload = {
          uid,
          displayName: this.getName(),
          email: this.state.profile.email || "",
          photoUrl: this.state.profile.photoUrl || "",
          state: this.state.call.inCall ? "in_call" : "online",
          lastSeen: DB.serverTimestamp() || now()
        };
        try { await DB.set(path, payload, true); } catch (_) {}
      };

      await writePresence();
      this.state.__presenceT = setInterval(writePresence, 15000);
    },

    setPresenceState(state) {
      if (!DB.ready()) return;
      const uid = this.getMyUid();
      const roomId = this.getPresenceRoom();
      const path = `presenceRooms/${roomId}/users/${uid}`;
      DB.set(path, { state: state || "online", lastSeen: DB.serverTimestamp() || now() }, true).catch(() => {});
    },

    watchIncomingCalls(force = false) {
      if (!DB.ready()) return;

      const uid = this.getMyUid();
      const roomId = this.getPresenceRoom();
      const callsCol = DB.col(`presenceRooms/${roomId}/calls`);
      if (!callsCol) return;

      if (this.state.unsub.incomingCalls && !force) return;
      if (this.state.unsub.incomingCalls) {
        try { this.state.unsub.incomingCalls(); } catch (_) {}
        this.state.unsub.incomingCalls = null;
      }

      let q;
      try {
        q = callsCol
          .where("status", "==", "ringing")
          .where("toUids", "array-contains", uid)
          .limit(1);
      } catch (_) {
        UI.setLed(UI.els.ledListener, "bad");
        return;
      }

      UI.setLed(UI.els.ledListener, "on");

      this.state.unsub.incomingCalls = DB.onSnapshot(q, (snap) => {
        if (!snap || snap.empty) return;

        const doc = snap.docs[0];
        const data = doc.data() || {};
        const path = doc.ref && doc.ref.path ? doc.ref.path : null;

        if (this.state.incoming.active && this.state.incoming.docPath === path) return;

        this.state.incoming.active = true;
        this.state.incoming.docPath = path;
        this.state.incoming.fromName = data.fromName || "Unknown";
        this.state.incoming.fromEmail = data.fromEmail || "";
        this.state.incoming.channel = data.channel || "";
        this.state.incoming.createdAt = (data.createdAt && data.createdAt.toMillis) ? data.createdAt.toMillis() : now();

        safeText(UI.els.modalFromName, `${this.state.incoming.fromName}`);
        UI.showModal(true);

        Sound.beepPattern();
        AndroidBridge.vibrate(120);
        AndroidBridge.showNotification("📞 Incoming Call", `${this.state.incoming.fromName} is calling you`);

        Log.write("warn", `Incoming: ${this.state.incoming.fromName}`);
        CallHistory.mark("incoming", { from: this.state.incoming.fromName, channel: this.state.incoming.channel });

        this.autoExpireIncomingIfNeeded();
      }, () => {
        UI.setLed(UI.els.ledListener, "bad");
      });
    },

    async autoExpireIncomingIfNeeded() {
      const ttl = 45 * 1000;
      const started = this.state.incoming.createdAt || now();

      await sleepWithAbort(2500, () => !this.state.incoming.active);
      if (!this.state.incoming.active) return;

      const age = now() - started;
      if (age < ttl) return;

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "missed",
            missedAt: DB.serverTimestamp() || now(),
            missedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      UI.showModal(false);
      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      Log.write("warn", "Missed call (expired)");
      CallHistory.mark("missed", {});
    },

    async acceptIncomingCall() {
      if (!this.state.incoming.active) return;

      if (UI.els.inChannel) UI.els.inChannel.value = this.state.incoming.channel || "";
      UI.showModal(false);

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "accepted",
            acceptedAt: DB.serverTimestamp() || now(),
            acceptedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      await this.joinFlow();
    },

    async declineIncomingCall() {
      if (!this.state.incoming.active) return;
      UI.showModal(false);

      try {
        if (DB.ready() && this.state.incoming.docPath) {
          await DB.set(this.state.incoming.docPath, {
            status: "declined",
            declinedAt: DB.serverTimestamp() || now(),
            declinedBy: this.getMyUid()
          }, true);
        }
      } catch (_) {}

      this.state.incoming.active = false;
      this.state.incoming.docPath = null;

      Log.write("info", "تم الرفض");
      CallHistory.mark("decline", {});
    },

    /* =========================
       Part 23 — FRIENDS + INVITES + BROADCAST
       ========================= */
    renderFriends() {
      UI.renderFriends(
        this.state.friends.list,
        this.state.friends.selected,
        (key) => {
          if (this.state.friends.selected.has(key)) this.state.friends.selected.delete(key);
          else this.state.friends.selected.add(key);
          this.renderFriends();
        },
        (key) => {
          this.state.friends.selected.clear();
          this.state.friends.selected.add(key);
          this.sendCallInviteToSelected();
        }
      );
    },

    clearFriendSelection() {
      this.state.friends.selected.clear();
      this.renderFriends();
      Log.write("info", "تم إلغاء التحديد");
    },

    upsertFriend(friend) {
      const f = normalizeFriend(friend);
      const list = this.state.friends.list || [];

      const idx = list.findIndex((x) =>
        (x.uid && f.uid && x.uid === f.uid) ||
        (!f.uid && x.email && f.email && x.email.toLowerCase() === f.email.toLowerCase())
      );

      if (idx >= 0) list[idx] = { ...list[idx], ...f };
      else list.push(f);

      this.state.friends.list = list;
      this.persistLocal();
      this.renderFriends();
    },

    addFriendLocalFromInputs() {
      const name = UI.els.friendName ? (UI.els.friendName.value || "").trim() : "";
      const email = UI.els.friendEmail ? (UI.els.friendEmail.value || "").trim() : "";
      if (!name && !email) return Log.write("warn", "اكتب اسم/إيميل ثم إضافة");

      this.upsertFriend({
        uid: "",
        displayName: name || (email ? email.split("@")[0] : "Friend"),
        email: email || "",
        photoUrl: ""
      });

      Log.write("good", "تمت الإضافة محلياً");
    },

    exportFriends() {
      const pack = { v: 1, t: now(), friends: this.state.friends.list || [] };
      const text = JSON.stringify(pack);
      try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (_) {}
      AndroidBridge.copyToClipboard(text);
      Log.write("good", "تم نسخ الأصدقاء (JSON) للحافظة");
    },

    importFriends() {
      const raw = prompt("ألصق JSON الأصدقاء هنا:");
      if (!raw) return;
      const o = safeJsonParse(raw);
      if (!o || !Array.isArray(o.friends)) return Log.write("bad", "JSON غير صالح");
      this.state.friends.list = o.friends.map(normalizeFriend);
      this.persistLocal();
      this.renderFriends();
      Log.write("good", "تم الاستيراد ✅");
    },

    async searchFriends() {
      const name = UI.els.friendName ? (UI.els.friendName.value || "").trim() : "";
      const email = UI.els.friendEmail ? (UI.els.friendEmail.value || "").trim() : "";

      if (!name && !email) {
        Log.write("warn", "اكتب اسم أو إيميل للبحث");
        return;
      }

      if (!DB.ready()) {
        Log.write("bad", "Firebase غير جاهز / غير محمّل");
        return;
      }

      Log.write("info", "Searching...");

      let results = [];
      if (email) results = await DB.queryUsersByEmail(email);
      if (!results.length && name) results = await DB.queryUsersByNamePrefix(name);

      if (!results.length) {
        const fallback = {
          uid: "",
          displayName: name || (email ? email.split("@")[0] : "Friend"),
          email: email || "",
          photoUrl: ""
        };
        this.upsertFriend(fallback);
        Log.write("warn", "لم يتم العثور — تم إضافة كصديق محلي (بدون UID)");
        return;
      }

      results.forEach((u) => {
        this.upsertFriend({
          uid: u.uid || u.id || "",
          displayName: u.displayName || u.name || "Friend",
          email: u.email || "",
          photoUrl: u.photoUrl || u.photoURL || ""
        });
      });

      Log.write("good", `Found: ${results.length}`);
    },

    async sendCallInviteToSelected() {
      const channel = this.getChannel();
      if (!channel) {
        Log.write("warn", "اكتب Channel يدويًا أولاً");
        return;
      }

      const selKeys = Array.from(this.state.friends.selected);
      if (!selKeys.length) {
        Log.write("warn", "حدد أصدقاء أولاً");
        return;
      }

      if (!DB.ready()) {
        Log.write("bad", "Firebase غير جاهز / غير محمّل");
        return;
      }

      const targets = [];
      (this.state.friends.list || []).forEach((f) => {
        const key = f.uid || f.email || f.id;
        if (selKeys.includes(key) && f.uid) targets.push(f.uid);
      });

      if (!targets.length) {
        Log.write("warn", "لا يوجد UID للأصدقاء المحددين (لا يمكن إرسال نداء)");
        return;
      }

      const roomId = this.getPresenceRoom();
      const payload = {
        status: "ringing",
        channel,
        roomId,
        fromUid: this.getMyUid(),
        fromName: this.getName(),
        fromEmail: this.state.profile.email || "",
        toUids: targets.slice(0, 50),
        createdAt: DB.serverTimestamp() || now()
      };

      try {
        await DB.add(`presenceRooms/${roomId}/calls`, payload);
        Log.write("good", `📞 Call invite sent (${payload.toUids.length})`);
        CallHistory.mark("invite_sent", { targets: payload.toUids.length, channel });
      } catch (e) {
        Log.write("bad", "فشل إرسال النداء: " + errToText(e));
      }
    },

    async sendBroadcastInvite() {
      const channel = this.getChannel();
      if (!channel) return Log.write("warn", "اكتب Channel أولاً");

      if (!DB.ready()) return Log.write("bad", "Firebase غير جاهز / غير محمّل");

      const roomId = this.getPresenceRoom();
      const myUid = this.getMyUid();

      const usersCol = DB.col(`presenceRooms/${roomId}/users`);
      if (!usersCol) return Log.write("bad", "Presence room users غير متاح");

      Log.write("info", "Broadcasting call...");

      let uids = [];
      try {
        let snap = null;
        try {
          snap = await usersCol.where("state", "in", ["online", "in_call"]).limit(50).get();
        } catch (_) {
          snap = await usersCol.limit(50).get();
        }
        snap.forEach((d) => {
          const data = d.data() || {};
          const uid = String(data.uid || d.id || "").trim();
          if (uid && uid !== myUid) uids.push(uid);
        });
      } catch (e) {
        return Log.write("bad", "Broadcast users read fail: " + errToText(e));
      }

      const seen = {};
      uids = uids.filter((x) => (seen[x] ? false : (seen[x] = true)));

      if (!uids.length) return Log.write("warn", "لا يوجد مستخدمين Online لإرسال النداء");

      const payload = {
        status: "ringing",
        channel,
        roomId,
        fromUid: myUid,
        fromName: this.getName(),
        fromEmail: this.state.profile.email || "",
        toUids: uids.slice(0, 50),
        createdAt: DB.serverTimestamp() || now()
      };

      try {
        await DB.add(`presenceRooms/${roomId}/calls`, payload);
        Log.write("good", `📣 Broadcast sent (${payload.toUids.length})`);
        CallHistory.mark("broadcast", { to: payload.toUids.length, channel });
        Sound.tactical();
        AndroidBridge.vibrate(60);
      } catch (e) {
        Log.write("bad", "Broadcast failed: " + errToText(e));
      }
    },

    /* =========================
       Part 24 — NETWORK + PING + AUDIO + SETTINGS + DIAGNOSTICS
       ========================= */
    setDefaults({ speaker, mic, sound }) {
      if (speaker !== undefined) this.state.settings.speakerDefault = !!speaker;
      if (mic !== undefined) this.state.settings.micDefault = !!mic;
      if (sound !== undefined) this.state.settings.soundDefault = !!sound;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("good", "تم حفظ الإعدادات ✅");
    },

    setEchoMode(mode) {
      this.state.settings.echoMode = String(mode || "AUTO").toUpperCase();
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Echo: " + this.state.settings.echoMode);
    },

    setPingHost(host) {
      const h = String(host || "").trim() || DEFAULT_PING_HOST;
      this.state.settings.pingHost = h;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Ping Host: " + h);
    },

    setUpdateRate(rate) {
      const r = String(rate || "Normal");
      this.state.settings.updateRate = (r === "Low" || r === "High") ? r : "Normal";
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Update Rate: " + this.state.settings.updateRate);
      this.startNetworkMonitor(true);
      this.startPingMonitor(true);
    },

    setLockCall(on) {
      this.state.settings.lockCall = !!on;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      UI.setCallState(this.state.call.inCall ? "connected" : "disconnected");
      Log.write("info", "Lock Call: " + (this.state.settings.lockCall ? "ON" : "OFF"));
    },

    setAutoClearLogs(on) {
      this.state.settings.autoClearLogs = !!on;
      this.persistLocal();
      UI.syncSettingsUI(this.state.settings);
      Log.write("info", "Auto Clear Logs: " + (this.state.settings.autoClearLogs ? "ON" : "OFF"));
    },

    updateQualityPanels() {
      const n = this.state.net;

      const netScore = n.hasInternet ? (n.type === "wifi" && typeof n.rssi === "number"
        ? (n.rssi >= -55 ? 95 : n.rssi >= -67 ? 85 : n.rssi >= -78 ? 65 : 35)
        : 80) : 0;

      const ping = n.pingMs;
      const pingScore = (ping < 0) ? 0 : (ping <= 80 ? 95 : ping <= 150 ? 80 : ping <= 250 ? 60 : ping <= 400 ? 40 : 15);

      const jit = Number(n.jitterMs || 0);
      const jitterScore = (jit <= 15 ? 90 : jit <= 30 ? 75 : jit <= 60 ? 50 : 20);

      const loss = Number(n.lossPct || 0);
      const lossScore = (loss <= 1 ? 90 : loss <= 3 ? 75 : loss <= 8 ? 50 : 20);

      const up = Number(n.upKbps || 0);
      const down = Number(n.downKbps || 0);
      const upScore = Math.max(10, Math.min(100, (up / 120) * 100));
      const downScore = Math.max(10, Math.min(100, (down / 200) * 100));

      const audio = Number(n.audioLevel || 0);          // 0..1
      const audioScore = Math.max(10, Math.min(100, audio * 100));

      let grade = "OK";
      if (pingScore >= 85 && jitterScore >= 75 && lossScore >= 75) grade = "Excellent";
      else if (pingScore >= 70 && jitterScore >= 60 && lossScore >= 60) grade = "Good";
      else if (pingScore >= 45 && jitterScore >= 45 && lossScore >= 45) grade = "OK";
      else grade = "Poor";

      const gradeScore = (grade === "Excellent") ? 92 : (grade === "Good") ? 76 : (grade === "OK") ? 55 : 28;

      UI.setQualityUI({
        netText: `${n.type || "none"} ${n.rssi != null ? (String(n.rssi) + " dBm") : ""}`.trim(),
        pingMs: (ping >= 0 ? ping : "..."),
        jitterMs: jit,
        lossPct: loss,
        upKbps: up,
        downKbps: down,
        audioLevel: (audio ? audio.toFixed(2) : "0.00"),
        grade,
        netScore,
        pingScore,
        jitterScore,
        lossScore,
        upScore,
        downScore,
        audioScore,
        gradeScore
      });

      // Diagnostics page
      safeText(UI.els.diagNetType, String(n.type || "none"));
      safeText(UI.els.diagRssi, n.rssi == null ? "..." : String(n.rssi));
      safeText(UI.els.diagLink, n.linkMbps == null ? "..." : String(n.linkMbps));
      safeText(UI.els.diagInternet, String(!!n.hasInternet));
      safeText(UI.els.diagPing, ping < 0 ? "..." : String(ping));
      safeText(UI.els.diagPingGrade, grade);
      safeText(UI.els.diagJitter, String(jit));
      safeText(UI.els.diagLoss, String(loss));
      safeText(UI.els.diagUp, String(up));
      safeText(UI.els.diagDown, String(down));
      safeText(UI.els.diagCodec, "Opus");
      safeText(UI.els.diagCallLedTxt, (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("on")) ? "ON" :
        (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("warn")) ? "WARN" :
        (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("bad")) ? "BAD" : "OFF");

      safeText(UI.els.diagSrvLedTxt,
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("on")) ? "ON" :
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("warn")) ? "WARN" :
        (UI.els.ledSrv && UI.els.ledSrv.classList.contains("bad")) ? "BAD" : "OFF"
      );

      safeText(UI.els.diagSrvBarsTxt, (n.pingMs < 0) ? "0-4" : (n.pingMs < 100 ? "4" : n.pingMs < 200 ? "3" : n.pingMs < 400 ? "2" : "1"));
    },

    startNetworkMonitor(force = false) {
      const rate = this.state.settings.updateRate;
      const interval = (rate === "Low") ? 5000 : (rate === "High") ? 1000 : 2000;

      if (this.state.__netT && !force) return;
      if (this.state.__netT) clearInterval(this.state.__netT);

      const tick = () => {
        let info = null;
        const raw = AndroidBridge.getNetworkInfoJson();
        if (raw) info = safeJsonParse(raw);

        if (info) {
          this.state.net.type = String(info.type || info.netType || "other").toLowerCase();
          this.state.net.rssi = (info.rssi != null) ? Number(info.rssi) : null;
          this.state.net.linkMbps = (info.linkMbps != null) ? Number(info.linkMbps) : null;
          this.state.net.hasInternet = !!(info.hasInternet != null ? info.hasInternet : info.internet);

          UI.setSignalUI({ type: this.state.net.type, rssi: this.state.net.rssi, hasInternet: this.state.net.hasInternet });
          UI.setLed(UI.els.ledNet, this.state.net.hasInternet ? "on" : "bad");
          this.updateQualityPanels();
          return;
        }

        const online = (navigator.onLine !== undefined) ? !!navigator.onLine : true;
        this.state.net.hasInternet = online;

        const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        let type = "other";
        let down = null;

        if (c) {
          type = c.type || c.effectiveType || "other";
          down = (c.downlink != null) ? Math.round(Number(c.downlink) * 1000) : null; // Mbps -> kbps
        }
        this.state.net.type = String(type).toLowerCase();
        this.state.net.downKbps = down != null ? down : this.state.net.downKbps;

        UI.setSignalUI({ type: this.state.net.type, rssi: this.state.net.rssi, hasInternet: this.state.net.hasInternet });
        this.updateQualityPanels();
      };

      tick();
      this.state.__netT = setInterval(tick, interval);
    },

    async doFetchPing(host) {
      const h = String(host || DEFAULT_PING_HOST).trim();
      if (!h) return -1;

      const n = AndroidBridge.tcpPingMs(h, 443, 1500);
      if (typeof n === "number" && n >= 0) return n;

      try {
        const url = "https://" + h + "/favicon.ico?x=" + now();
        const t0 = now();

        const controller = ("AbortController" in window) ? new AbortController() : null;
        const timer = setTimeout(() => { try { controller && controller.abort(); } catch (_) {} }, 1800);

        await fetch(url, { method: "HEAD", cache: "no-store", mode: "no-cors", signal: controller ? controller.signal : undefined });
        clearTimeout(timer);

        const dt = now() - t0;
        return dt > 0 ? dt : 1;
      } catch (_) {
        return -1;
      }
    },

    startPingMonitor(force = false) {
      const rate = this.state.settings.updateRate;
      const interval = (rate === "Low") ? 7000 : (rate === "High") ? 2000 : 3500;

      if (this.state.__pingT && !force) return;
      if (this.state.__pingT) clearInterval(this.state.__pingT);

      const tick = async () => {
        const ms = await this.doFetchPing(this.state.settings.pingHost || DEFAULT_PING_HOST);
        this.state.net.pingMs = ms;

        UI.setPing(ms);
        this.updateQualityPanels();

        if (UI.els.diagNoteTxt) safeText(UI.els.diagNoteTxt, ms < 0 ? "Ping: FAIL" : ("Ping: " + ms + "ms"));

        if (this.state.settings.autoClearLogs && UI.els.log) {
          try {
            const lines = UI.els.log.querySelectorAll(".logLine");
            if (lines.length > 200) {
              for (let i = 200; i < lines.length; i++) lines[i].remove();
            }
          } catch (_) {}
        }
      };

      tick();
      this.state.__pingT = setInterval(tick, interval);
    },

    // NEW: updates audioLevel from MicViz (for quality panel)
    startAudioMeter(force = false) {
      if (this.state.__audioT && !force) return;
      if (this.state.__audioT) clearInterval(this.state.__audioT);

      this.state.__audioT = setInterval(() => {
        const lvl = MicViz.level(); // 0..1
        // if mic muted, show lower (still allow heart animation if audio track gives low)
        this.state.net.audioLevel = this.state.micMuted ? 0 : lvl;
      }, 120);
    },

    refreshDiagnostics() {
      this.updateQualityPanels();
      return this.getDiagnosticsPack();
    },

    getDiagnosticsPack() {
      const n = this.state.net;
      return {
        netType: n.type,
        rssi: n.rssi,
        linkMbps: n.linkMbps,
        internet: n.hasInternet,
        ping: n.pingMs,
        jitter: n.jitterMs,
        loss: n.lossPct,
        up: n.upKbps,
        down: n.downKbps,
        audio: n.audioLevel,
        codec: "Opus",
        callLed: (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("on")) ? "ON" :
          (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("warn")) ? "WARN" :
          (UI.els.ledCallQ && UI.els.ledCallQ.classList.contains("bad")) ? "BAD" : "OFF"
      };
    },

    resetDiagnosticsLocal() {
      this.state.net.jitterMs = 0;
      this.state.net.lossPct = 0;
      this.state.net.upKbps = 0;
      this.state.net.downKbps = 0;
      this.state.net.audioLevel = 0;
      this.updateQualityPanels();
    },
  };

  /* =========================
     Part 25 — EXPORT API for inline HTML hooks
     ========================= */
  window.MDV_APP = {
    join: () => App.joinFlow(),
    leave: () => App.leaveFlow(),
    endCall: () => App.endCall(),

    acceptIncoming: () => App.acceptIncomingCall(),
    rejectIncoming: () => App.declineIncomingCall(),

    refreshDiagnostics: () => App.refreshDiagnostics(),
    resetDiagnostics: () => App.resetDiagnosticsLocal(),
    shareDiagnostics: () => {
      const text = JSON.stringify(App.getDiagnosticsPack());
      try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (_) {}
      AndroidBridge.copyToClipboard(text);
      Log.write("good", "DIAG COPIED");
      return text;
    },

    // Android-side functions
    volumeUp: () => AndroidBridge.volumeUp(),
    volumeDown: () => AndroidBridge.volumeDown(),
    volumeMuteToggle: () => AndroidBridge.volumeMuteToggle(),
    routeSpeaker: () => AndroidBridge.routeSpeaker(),
    routeEarpiece: () => AndroidBridge.routeEarpiece(),
    routeBluetooth: () => AndroidBridge.routeBluetooth(),

    detectAudio: () => AndroidBridge.detectAudio(),
    detectBluetooth: () => AndroidBridge.detectBluetooth(),
    refreshDevices: () => AndroidBridge.refreshDevices(),

    // UI helpers
    toggleDrawer: () => Drawer.toggle(),
    themeCycle: () => Theme.cycle(),
  };

  /* =========================
     Part 26 — BOOT
     ========================= */
  const boot = () => {
    try { App.init(); } catch (e) { try { console.error(e); } catch (_) {} }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();

/* =========================================================
   ملاحظة مهمة لإرجاع "مخطط القلب" (Mic Heart Monitor):
   - لازم يكون عندك في index.html عنصر:
       <canvas id="micWave" style="width:100%;height:56px;"></canvas>
   - JS فوق يدعم IDs بديلة، لكن الأفضل micWave.
   ========================================================= */
