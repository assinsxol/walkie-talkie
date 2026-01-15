/* =========================================================
   Mini Discord Voice — Tactical V5 (EXTRACTED JS)
   - Firebase Google Auth gate
   - Agora join/leave/mute/speaker
   - Drawer navigation
   - Force Majeure 2 minutes (120000ms)
   ========================================================= */

window.addEventListener("load", function () {
  // ✅ Firebase config (كما أرسلته)
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyApUvLTt0OLAc_3Rk2e1BnmvX64T5RTmA8",
    authDomain: "minidiscordvoice-b7310.firebaseapp.com",
    databaseURL: "https://minidiscordvoice-b7310-default-rtdb.firebaseio.com",
    projectId: "minidiscordvoice-b7310",
    storageBucket: "minidiscordvoice-b7310.firebasestorage.app",
    messagingSenderId: "1073341648468",
    appId: "1:1073341648468:web:9af59b1fcc577d4468e7c1",
    measurementId: "G-7R4MRJHWY6",
  };

  const APP_ID = "eb80a41c4a3c400f865a5c88bdf293be"; // Agora
  const FM_INTERVAL = 120000;

  const $ = (id) => document.getElementById(id);

  const uiGate = {
    gate: $("authGate"),
    login: $("authLoginBtn"),
    reload: $("authReloadBtn"),
    err: $("authErr"),
    email: $("authEmail"),
    diagFb: $("diagFbStatus"),
    topEmail: $("topUserEmail"),
    setEmail: $("userEmail"),
    loginBtn: $("loginBtn"),
    logoutBtn2: $("logoutBtn2"),
    btnLogout: $("btnLogout"),
  };

  function setGateError(msg) {
    if (uiGate.err) uiGate.err.textContent = msg || "";
  }

  // 1) INIT FIREBASE AUTH
  let auth = null;
  let provider = null;
  let appStarted = false;

  function initFirebase() {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      auth = firebase.auth();
      provider = new firebase.auth.GoogleAuthProvider();
      auth.useDeviceLanguage();
      uiGate.diagFb && (uiGate.diagFb.textContent = "OK");
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
    } catch (e) {
      uiGate.diagFb && (uiGate.diagFb.textContent = "CONFIG ERROR");
      setGateError("Firebase CONFIG غير صحيح أو لم يتم تحميل Firebase.");
      console.error(e);
    }
  }

  function lockUI() {
    document.body.classList.add("auth-locked");
    if (uiGate.gate) uiGate.gate.classList.add("show");
    if (uiGate.topEmail) uiGate.topEmail.textContent = "—";
    if (uiGate.setEmail) uiGate.setEmail.textContent = "—";
  }

  function unlockUI(user) {
    document.body.classList.remove("auth-locked");
    if (uiGate.gate) uiGate.gate.classList.remove("show");

    const email = user && user.email ? user.email : "";
    const name = user && user.displayName ? user.displayName : "";

    if (uiGate.topEmail) uiGate.topEmail.textContent = email || name || "OK";
    if (uiGate.setEmail) uiGate.setEmail.textContent = email || name || "OK";
    if (uiGate.email) uiGate.email.textContent = email ? "✅ " + email : "";
    if ($("displayName") && name) $("displayName").value = name;

    setGateError("");
  }

  async function signInGoogle() {
    if (!auth || !provider) {
      setGateError("Firebase غير جاهز.");
      return;
    }
    setGateError("");
    try {
      await auth.signInWithRedirect(provider);
    } catch (e) {
      try {
        await auth.signInWithPopup(provider);
      } catch (e2) {
        setGateError("فشل تسجيل الدخول: " + (e2 && e2.message ? e2.message : e2));
      }
    }
  }

  async function handleRedirectResult() {
    if (!auth) return;
    try {
      await auth.getRedirectResult();
    } catch (e) {
      setGateError("Redirect Error: " + (e && e.message ? e.message : e));
    }
  }

  function requireAuthOrLock() {
    if (!auth || !auth.currentUser) {
      lockUI();
      return false;
    }
    return true;
  }

  // 2) APP LOGIC — guarded by auth
  const loadScript = (src) =>
    new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });

  async function ensureAgora() {
    if (typeof AgoraRTC !== "undefined") return true;
    return await loadScript("https://unpkg.com/agora-rtc-sdk-ng@4.20.2/AgoraRTC_N.js");
  }

  function startAppOnce() {
    if (appStarted) return;
    appStarted = true;

    ensureAgora().then((loaded) => {
      if (!loaded) {
        $("mainStatus").innerText = "LIB ERROR";
        return;
      }
      initApp();
    });
  }

  function initApp() {
    const ui = {
      scrCh: $("scrCh"),
      scrStat: $("scrStat"),
      mainStat: $("mainStatus"),
      timer: $("callTimer"),
      ping: $("pingVal"),
      net: $("netTower"),
      join: $("joinBtn"),
      leave: $("leaveBtn"),
      mute: $("muteBtn"),
      spk: $("spkBtn"),
      fm: $("fmSwitch"),
      vid: $("videoAdBtn"),
      reboot: $("rebootOverlay"),
      rCount: $("rebootCount"),
      incoming: $("incomingOverlay"),
      incFrom: $("incomingFrom"),
      acc: $("acceptBtn"),
      rej: $("rejectBtn"),
      menu: $("menuBtn"),
      drawer: $("drawer"),
      overlay: $("drawerOverlay"),
      tabs: document.querySelectorAll(".tabBtn[data-target]"),
      pages: document.querySelectorAll(".page"),
    };

    // NAVIGATION
    if (ui.menu) ui.menu.onclick = () => ui.drawer.classList.toggle("open");
    if (ui.overlay) ui.overlay.onclick = () => ui.drawer.classList.remove("open");

    ui.tabs.forEach((btn) => {
      btn.onclick = () => {
        ui.tabs.forEach((b) => b.classList.remove("active"));
        ui.pages.forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const target = $(btn.dataset.target);
        if (target) target.classList.add("active");
        ui.drawer.classList.remove("open");
      };
    });

    // "قريباً"
    document.querySelectorAll('[data-soon="1"]').forEach((b) => {
      b.addEventListener("click", () => alert("قريباً"));
    });

    // STATE
    let client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    let localTracks = { audio: null };
    let state = { joined: false, muted: false, speaker: true, remote: false };
    let timerInt, fmTimer;

    // Visualizer
    let animId;
    function startVisualizer(isActive) {
      const canvas = $("waveCanvas");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const w = 300,
        h = 150;
      canvas.width = w;
      canvas.height = h;

      function draw() {
        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = 2;
        ctx.strokeStyle = isActive ? (state.remote ? "#21d07a" : "#9b7aff") : "#333";
        ctx.beginPath();
        const t = Date.now();
        for (let x = 0; x < w; x += 5) {
          const y = h / 2 + Math.sin(x * 0.05 + t * 0.01) * (isActive ? 20 : 2);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        animId = requestAnimationFrame(draw);
      }
      if (animId) cancelAnimationFrame(animId);
      draw();
    }
    startVisualizer(false);

    // AGORA EVENTS
    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") {
        user.audioTrack.play();
        ui.mainStat.innerText = "RECEIVING";
        ui.mainStat.style.color = "#21d07a";
        state.remote = true;
        const ledRec = $("ledRec");
        if (ledRec) ledRec.classList.add("on");
        startVisualizer(true);
      }
    });

    client.on("user-unpublished", () => {
      state.remote = false;
      ui.mainStat.innerText = "CONNECTED";
      ui.mainStat.style.color = "#9b7aff";
      const ledRec = $("ledRec");
      if (ledRec) ledRec.classList.remove("on");
      startVisualizer(true);
    });

    // JOIN (guarded)
    if (ui.join)
      ui.join.onclick = async () => {
        if (!requireAuthOrLock()) {
          setGateError("لازم تسجل دخول أولاً.");
          return;
        }
        const ch = $("channel").value;
        if (!ch) return alert("Enter Channel");

        try {
          ui.mainStat.innerText = "CONNECTING...";
          ui.join.disabled = true;

          await client.join(APP_ID, ch, null, null);
          localTracks.audio = await AgoraRTC.createMicrophoneAudioTrack();
          await client.publish([localTracks.audio]);

          state.joined = true;
          ui.scrCh.innerText = ch;
          ui.scrStat.innerText = "ONLINE";
          ui.scrStat.style.color = "#21d07a";
          ui.mainStat.innerText = "CONNECTED";
          ui.mainStat.style.color = "#9b7aff";

          ui.join.disabled = true;
          ui.leave.disabled = false;
          ui.mute.disabled = false;

          const ledNet = $("ledNet");
          if (ledNet) ledNet.classList.add("on");
          const ledMic = $("ledMic");
          if (ledMic) ledMic.classList.add("on");

          startTimer();
          startVisualizer(true);
          if (ui.fm.checked) startFM();
        } catch (e) {
          console.error(e);
          ui.mainStat.innerText = "ERROR";
          ui.mainStat.style.color = "red";
          ui.join.disabled = false;
        }
      };

    // LEAVE
    if (ui.leave)
      ui.leave.onclick = async () => {
        stopFM();
        try {
          if (localTracks.audio) {
            localTracks.audio.close();
            localTracks.audio = null;
          }
          await client.leave();

          state.joined = false;
          ui.join.disabled = false;
          ui.leave.disabled = true;
          ui.mute.disabled = true;

          ui.mainStat.innerText = "STANDBY";
          ui.mainStat.style.color = "#fff";
          ui.scrStat.innerText = "OFFLINE";
          ui.scrStat.style.color = "#888";
          ui.scrCh.innerText = "--";

          const ledNet = $("ledNet");
          if (ledNet) ledNet.classList.remove("on");
          const ledMic = $("ledMic");
          if (ledMic) ledMic.classList.remove("on");
          const ledRec = $("ledRec");
          if (ledRec) ledRec.classList.remove("on");

          stopTimer();
          startVisualizer(false);
        } catch (e) {
          console.error(e);
        }
      };

    // CONTROLS
    if (ui.mute)
      ui.mute.onclick = () => {
        if (!requireAuthOrLock()) return;
        if (!localTracks.audio) return;

        state.muted = !state.muted;
        localTracks.audio.setMuted(state.muted);
        ui.mute.innerText = state.muted ? "🔇 كتم" : "🎙️ المايك";

        const ledMic = $("ledMic");
        if (ledMic) ledMic.classList.toggle("on", !state.muted);
      };

    if (ui.spk)
      ui.spk.onclick = () => {
        if (!requireAuthOrLock()) return;
        state.speaker = !state.speaker;
        ui.spk.innerText = state.speaker ? "🔊 سبيكر" : "👂 سماعة";
      };

    // FORCE MAJEURE (2 minutes)
    function startFM() {
      if (fmTimer) clearTimeout(fmTimer);
      fmTimer = setTimeout(async () => {
        if (!state.joined) return;
        await ui.leave.click();

        if (ui.reboot) {
          ui.reboot.classList.add("show");
          let c = 6;
          ui.rCount.innerText = c;

          let cd = setInterval(() => {
            c--;
            ui.rCount.innerText = c;
            if (c <= 0) {
              clearInterval(cd);
              ui.reboot.classList.remove("show");
              if (ui.fm.checked) ui.join.click();
            }
          }, 1000);
        }
      }, FM_INTERVAL);
    }

    function stopFM() {
      if (fmTimer) clearTimeout(fmTimer);
    }

    if (ui.fm)
      ui.fm.onchange = () => {
        if (ui.fm.checked && state.joined) startFM();
        else stopFM();
      };

    // UTIL: Timer
    function startTimer() {
      let s = 0;
      if (timerInt) clearInterval(timerInt);
      timerInt = setInterval(() => {
        s++;
        const date = new Date(s * 1000);
        ui.timer.innerText = date.toISOString().substr(11, 8);
      }, 1000);
    }

    function stopTimer() {
      clearInterval(timerInt);
      ui.timer.innerText = "00:00:00";
    }

    // Copy
    const copyBtn = $("copyBtn");
    if (copyBtn)
      copyBtn.onclick = () => {
        if (!requireAuthOrLock()) return;
        const ch = $("channel").value || "";
        const txt = "Channel: " + ch;
        try {
          navigator.clipboard.writeText(txt);
        } catch (_) {}
      };

    // Fake ping loop
    setInterval(() => {
      const p = Math.floor(Math.random() * 50) + 20;
      ui.ping.innerText = p;

      const bars = document.querySelectorAll(".bar");
      bars.forEach((b) => b.classList.remove("on"));
      if (p < 100) bars.forEach((b) => b.classList.add("on"));
    }, 2000);
  }

  // 3) HOOK BUTTONS
  if (uiGate.reload) uiGate.reload.onclick = () => location.reload();
  if (uiGate.login) uiGate.login.onclick = () => signInGoogle();
  if (uiGate.loginBtn) uiGate.loginBtn.onclick = () => signInGoogle();

  function doSignOut() {
    if (!auth) return location.reload();
    auth
      .signOut()
      .then(() => {
        lockUI();
        location.reload();
      })
      .catch(() => {
        lockUI();
        location.reload();
      });
  }

  if (uiGate.btnLogout) uiGate.btnLogout.onclick = doSignOut;
  if (uiGate.logoutBtn2) uiGate.logoutBtn2.onclick = doSignOut;

  // 4) BOOT
  initFirebase();
  handleRedirectResult().then(() => {
    if (!auth) {
      lockUI();
      return;
    }
    auth.onAuthStateChanged((user) => {
      if (user) {
        unlockUI(user);
        startAppOnce();
      } else {
        lockUI();
      }
    });
  });
});
