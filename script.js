/* =========================================================
   app.js — Walkie-Talkie (Agora + Firebase + Fixed AdSense)
   ✅ Includes:
   - 3h call usage limit -> block 20h (soft block by UID)
   - (optional) store public IP for reference
   - Theme (dark/light)
   - Desktop-like prompt
   - AdSense fixed slots init (NO auto-ads)
   - Beeps (تيت تيت تيت)
   - LED UI + Battery demo
   - ECG/Waveform حساس للصوت (يتحرك فقط عند الكلام)
   - Firebase Presence: Online/Offline + Activity log
   - Deterrence Mode (القوة القاهرة/الرادعة): كل دقيقة خروج ثم بعد 6 ثواني دخول + صفارة
   - Copy Link
   - Audio output: volume + playback device (إن دعم المتصفح)
   - Incoming Call / Accept / Decline (Signaling عبر Firestore)
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/* =========================
   CONFIG
========================= */
// ✅ Agora App ID (حسب آخر بياناتك)
const AGORA_APP_ID = "eb80a41c4a3c400f865a5c88bdf293be";

// ✅ Firebase Web config (من مشروعك Web App)
const firebaseConfig = {
  apiKey: "AIzaSyApUvLTt0OLAc_3Rk2e1BnmvX64T5RTmA8",
  authDomain: "minidiscordvoice-b7310.firebaseapp.com",
  databaseURL: "https://minidiscordvoice-b7310-default-rtdb.firebaseio.com",
  projectId: "minidiscordvoice-b7310",
  storageBucket: "minidiscordvoice-b7310.firebasestorage.app",
  messagingSenderId: "1073341648468",
  appId: "1:1073341648468:web:9af59b1fcc577d4468e7c1",
  measurementId: "G-7R4MRJHWY6",
};

// ✅ Limit settings
const CALL_LIMIT_MS = 3 * 60 * 60 * 1000;  // 3 hours
const BLOCK_MS      = 20 * 60 * 60 * 1000; // 20 hours
const USAGE_TICK_MS = 15 * 1000;           // update every 15s

// ✅ Optional: store public IP (for reference only)
const ENABLE_PUBLIC_IP_LOOKUP = true;      // set false if you don't want external request
const IP_LOOKUP_URL = "https://api.ipify.org?format=json"; // may fail in some networks

/* =========================
   DOM HELPERS
========================= */
const $ = (id) => document.getElementById(id);
const $$id = (id) => Array.from(document.querySelectorAll(`#${CSS.escape(id)}`)); // if duplicate IDs accidentally exist
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowStr = () => new Date().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });

function log(msg) {
  const el = $("status");
  if (el) el.textContent = msg;
}

function addActivity(text) {
  const stamp = `[${nowStr()}] `;
  const msg = stamp + text;

  const box = $("activityBox");
  if (box) {
    const div = document.createElement("div");
    div.className = "activityLine";
    div.textContent = msg;
    box.prepend(div);
    while (box.children.length > 25) box.removeChild(box.lastChild);
  }

  const ul = $("activityList");
  if (ul) {
    const li = document.createElement("li");
    li.textContent = msg;
    ul.prepend(li);
    while (ul.children.length > 25) ul.removeChild(ul.lastChild);
  }
}

function fmtMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}س ${m}د ${ss}ث`;
}

function fmtDateTime(d) {
  try {
    return new Date(d).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  } catch {
    return String(d);
  }
}

/* =========================
   THEME
========================= */
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  setTheme(cur === "dark" ? "light" : "dark");
}

/* =========================
   DESKTOP-LIKE PROMPT
========================= */
function enableDesktopLike() {
  document.body.classList.add("desktopLike");
  const vp = $("vp");
  if (vp) vp.setAttribute("content", "width=980, initial-scale=0.92");
  localStorage.setItem("desktopLike", "1");
}
function disableDesktopLike() {
  document.body.classList.remove("desktopLike");
  const vp = $("vp");
  if (vp) vp.setAttribute("content", "width=device-width,initial-scale=1");
  localStorage.setItem("desktopLike", "0");
}
function maybeShowDesktopPrompt() {
  const asked = localStorage.getItem("desktopLikeAsked");
  if (asked) return;
  const isMobile = window.innerWidth < 760;
  if (!isMobile) return;
  localStorage.setItem("desktopLikeAsked", "1");
  $("deskPrompt")?.classList.remove("hidden");
}

/* =========================
   ADSENSE (Fixed slots only)
========================= */
function initAdSenseFixedSlots() {
  const insList = Array.from(document.querySelectorAll("ins.adsbygoogle"));
  if (!insList.length) return;

  window.adsbygoogle = window.adsbygoogle || [];
  for (const ins of insList) {
    if (ins.dataset.pushed === "1") continue;
    try {
      window.adsbygoogle.push({});
      ins.dataset.pushed = "1";
    } catch (e) {
      console.warn("AdSense push failed:", e);
    }
  }
}

/* =========================
   AUDIO BEEPS
========================= */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}
async function beepOnce(freq = 900, dur = 120, vol = 0.07) {
  const ctx = ensureAudio();
  if (!ctx) return;
  if (ctx.state === "suspended") { try { await ctx.resume(); } catch {} }

  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(ctx.destination);
  o.start();
  await sleep(dur);
  o.stop();
}
async function beepTriplet() {
  await beepOnce(1100, 110); await sleep(90);
  await beepOnce(1100, 110); await sleep(90);
  await beepOnce(1100, 110);
}

/* =========================
   LED UI
========================= */
function led(id, on, extraCls) {
  const el = $(id);
  if (!el) return;
  if (extraCls) el.classList.toggle(extraCls, !!on);
  el.classList.toggle("on", !!on);
}
function setBattery(percent) {
  const el = $("batFill");
  if (!el) return;
  el.style.width = `${Math.max(8, Math.min(100, percent))}%`;
}
function setStatePill(text, tone) {
  const p = $("statePill");
  if (!p) return;
  p.textContent = text;
  p.style.color = "";
  if (tone === "ok") p.style.color = "var(--accent)";
  if (tone === "warn") p.style.color = "var(--warn)";
  if (tone === "bad") p.style.color = "var(--danger)";
}

/* =========================
   TOP INFO
========================= */
function updateTopInfo() {
  if ($("chDisplay")) $("chDisplay").textContent = $("channel")?.value?.trim() || "—";
  if ($("roomDisplay")) $("roomDisplay").textContent = $("room")?.value?.trim() || "—";
  if ($("nameDisplay")) $("nameDisplay").textContent = $("name")?.value?.trim() || "—";
}

/* =========================
   SHARE LINK
========================= */
function makeShareLink() {
  const url = new URL(location.href);
  url.searchParams.set("name", $("name")?.value?.trim() || "User");
  url.searchParams.set("room", $("room")?.value?.trim() || "call_room1");
  url.searchParams.set("channel", $("channel")?.value?.trim() || "Room1");
  return url.toString();
}
function readQueryToInputs() {
  const q = new URLSearchParams(location.search);
  if (q.get("name") && $("name")) $("name").value = q.get("name");
  if (q.get("room") && $("room")) $("room").value = q.get("room");
  if (q.get("channel") && $("channel")) $("channel").value = q.get("channel");
}

/* =========================
   WAVEFORM (ECG) - voice sensitive
========================= */
const canvasEl = () => $("wave");
let ctx2d = null;
let t = 0;
let level = 0;         // 0..1
let smoothLevel = 0;
let lastVoiceAt = 0;

function initCanvas() {
  const c = canvasEl();
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = c.getBoundingClientRect();
  c.width = Math.floor(rect.width * dpr);
  c.height = Math.floor(160 * dpr);
  ctx2d = c.getContext("2d");
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawWave() {
  const c = canvasEl();
  if (!c || !ctx2d) return;

  const w = c.getBoundingClientRect().width;
  const h = 160;
  const baseY = h * 0.58;
  ctx2d.clearRect(0, 0, w, h);

  // grid
  ctx2d.globalAlpha = 0.25;
  ctx2d.lineWidth = 1;
  ctx2d.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--line");
  ctx2d.beginPath();
  for (let x = 0; x <= w; x += 28) { ctx2d.moveTo(x, 0); ctx2d.lineTo(x, h); }
  for (let y = 0; y <= h; y += 22) { ctx2d.moveTo(0, y); ctx2d.lineTo(w, y); }
  ctx2d.stroke();
  ctx2d.globalAlpha = 1;

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#53F6C7";
  const accent2 = getComputedStyle(document.documentElement).getPropertyValue("--accent2").trim() || "#6CA8FF";

  smoothLevel = smoothLevel * 0.86 + level * 0.14;

  const amp = level > 0 ? (8 + smoothLevel * 58) : 0;
  if (amp === 0) {
    ctx2d.shadowBlur = 0;
    ctx2d.globalAlpha = 0.8;
    ctx2d.lineWidth = 2;
    ctx2d.strokeStyle = accent;
    ctx2d.beginPath();
    ctx2d.moveTo(0, baseY);
    ctx2d.lineTo(w, baseY);
    ctx2d.stroke();
    ctx2d.globalAlpha = 1;
    requestAnimationFrame(drawWave);
    return;
  }

  const spikeChance = smoothLevel > 0.55 ? 0.15 : 0.05;

  ctx2d.lineWidth = 3;
  ctx2d.strokeStyle = accent;
  ctx2d.shadowColor = accent;
  ctx2d.shadowBlur = 14;

  ctx2d.beginPath();
  let x = 0;
  let localT = t;

  while (x <= w) {
    let y =
      baseY +
      Math.sin(localT * 0.055) * (amp * 0.25) +
      Math.sin(localT * 0.12) * (amp * 0.14) +
      (Math.random() - 0.5) * (amp * 0.05);

    if (Math.random() < spikeChance) {
      ctx2d.lineTo(x, y);
      ctx2d.lineTo(x + 6, y - amp * 0.9);
      ctx2d.lineTo(x + 10, y + amp * 0.55);
      ctx2d.lineTo(x + 16, y - amp * 0.15);
      x += 16;
      localT += 10;
      continue;
    }

    if (x === 0) ctx2d.moveTo(x, y);
    else ctx2d.lineTo(x, y);

    x += 6;
    localT += 6;
  }
  ctx2d.stroke();

  ctx2d.shadowBlur = 0;
  ctx2d.globalAlpha = 0.55;
  ctx2d.lineWidth = 2;
  ctx2d.strokeStyle = accent2;

  ctx2d.beginPath();
  x = 0; localT = t + 40;
  while (x <= w) {
    const y = baseY + Math.sin(localT * 0.06) * (amp * 0.12);
    if (x === 0) ctx2d.moveTo(x, y);
    else ctx2d.lineTo(x, y);
    x += 10; localT += 10;
  }
  ctx2d.stroke();
  ctx2d.globalAlpha = 1;

  t += 1 + smoothLevel * 6;
  requestAnimationFrame(drawWave);
}

/* =========================
   AGORA STATE
========================= */
let client = null;
let localAudioTrack = null;
let joined = false;
let muted = false;

const remoteAudioTracks = new Map(); // uid -> track
let speakerVol = Number(localStorage.getItem("spkVol") || 80);
let playbackDeviceId = localStorage.getItem("playbackDeviceId") || "";

/* =========================
   FIREBASE STATE
========================= */
let fbEnabled = false;
let fbDb = null;
let fbUid = null;

let usersUnsub = null;
let callsUnsub = null;

/* =========================
   LIMITS STATE (3h -> block 20h)
========================= */
let publicIp = null;
let usageTicker = null;
let callSessionStartedAt = 0;
let lastUsageTickAt = 0;
let cachedBlockedUntil = null; // Date|null

function limitsDocRef(room) {
  return doc(fbDb, "rooms", room, "limits", fbUid);
}

async function getPublicIpIfEnabled() {
  if (!ENABLE_PUBLIC_IP_LOOKUP) return null;
  try {
    const res = await fetch(IP_LOOKUP_URL, { cache: "no-store" });
    const j = await res.json();
    if (j && typeof j.ip === "string") return j.ip;
  } catch (e) {
    console.warn("IP lookup failed:", e);
  }
  return null;
}

async function ensureLimitsDoc(room) {
  if (!fbEnabled) return;
  const ref = limitsDocRef(room);
  try {
    await setDoc(ref, {
      usageMs: 0,
      blockedUntil: null,
      lastIp: publicIp || null,
      userAgent: navigator.userAgent || null,
      updatedAt: serverTimestamp(),
      reason: "init",
    }, { merge: true });
  } catch (e) {
    console.warn("ensureLimitsDoc:", e);
  }
}

async function loadBlockState(room) {
  if (!fbEnabled) return { blocked: false, blockedUntil: null, usageMs: 0 };
  const ref = limitsDocRef(room);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return { blocked: false, blockedUntil: null, usageMs: 0 };
    const data = snap.data() || {};
    const usageMs = Number(data.usageMs || 0);

    const bu = data.blockedUntil?.toDate ? data.blockedUntil.toDate() : (data.blockedUntil ? new Date(data.blockedUntil) : null);
    const blocked = !!(bu && bu.getTime() > Date.now());

    cachedBlockedUntil = bu || null;
    return { blocked, blockedUntil: bu || null, usageMs };
  } catch (e) {
    console.warn("loadBlockState:", e);
    return { blocked: false, blockedUntil: null, usageMs: 0 };
  }
}

async function enforceBlockIfNeeded(room, usageAfterMs) {
  if (!fbEnabled) return false;

  if (usageAfterMs < CALL_LIMIT_MS) return false;

  const until = new Date(Date.now() + BLOCK_MS);
  cachedBlockedUntil = until;

  try {
    await updateDoc(limitsDocRef(room), {
      blockedUntil: until,
      updatedAt: serverTimestamp(),
      reason: "limit_3h",
      lastIp: publicIp || null,
      userAgent: navigator.userAgent || null,
    });
  } catch (e) {
    // if doc missing, create merge
    try {
      await setDoc(limitsDocRef(room), {
        blockedUntil: until,
        updatedAt: serverTimestamp(),
        reason: "limit_3h",
        lastIp: publicIp || null,
        userAgent: navigator.userAgent || null,
      }, { merge: true });
    } catch (e2) {
      console.warn("enforceBlockIfNeeded:", e2);
    }
  }

  return true;
}

async function checkBlockedOrStop(room) {
  const st = await loadBlockState(room);
  if (!st.blocked) return { blocked: false, st };

  const untilText = st.blockedUntil ? fmtDateTime(st.blockedUntil) : "—";
  const msg = `⛔ تم حظرك مؤقتًا لمدة 20 ساعة (تجاوزت 3 ساعات مكالمة).\nسيُسمح لك بعد: ${untilText}`;
  log(msg);
  addActivity(`⛔ حظر مؤقت حتى ${untilText}`);

  // disable join button visually
  if ($("joinBtn")) $("joinBtn").disabled = true;
  setStatePill("محظور", "bad");
  led("ledWarn", true, "warn");
  return { blocked: true, st };
}

async function updateUsageTick(room) {
  if (!fbEnabled || !joined) return;

  const now = Date.now();
  const delta = Math.max(0, now - lastUsageTickAt);
  lastUsageTickAt = now;

  // increment usageMs safely
  try {
    await updateDoc(limitsDocRef(room), {
      usageMs: increment(delta),
      updatedAt: serverTimestamp(),
      lastIp: publicIp || null,
      userAgent: navigator.userAgent || null,
      reason: "in_call",
    });
  } catch (e) {
    // maybe doc missing
    await ensureLimitsDoc(room);
    try {
      await updateDoc(limitsDocRef(room), {
        usageMs: increment(delta),
        updatedAt: serverTimestamp(),
        lastIp: publicIp || null,
        userAgent: navigator.userAgent || null,
        reason: "in_call",
      });
    } catch (e2) {
      console.warn("updateUsageTick:", e2);
      return;
    }
  }

  // read current usage occasionally to enforce
  // (to reduce reads, do it every ~60s)
  if ((now - callSessionStartedAt) % 60000 < USAGE_TICK_MS) {
    const st = await loadBlockState(room);
    const usageAfter = (st.usageMs || 0);
    const blockedNow = await enforceBlockIfNeeded(room, usageAfter);
    if (blockedNow) {
      const untilText = cachedBlockedUntil ? fmtDateTime(cachedBlockedUntil) : "—";
      addActivity(`⛔ وصلت حد 3 ساعات — سيتم الحظر حتى ${untilText}`);
      await leaveCall(true);
      await checkBlockedOrStop(room);
    }
  }
}

function startUsageTicker(room) {
  stopUsageTicker();
  callSessionStartedAt = Date.now();
  lastUsageTickAt = Date.now();
  usageTicker = setInterval(() => updateUsageTick(room), USAGE_TICK_MS);
}

function stopUsageTicker() {
  if (usageTicker) {
    clearInterval(usageTicker);
    usageTicker = null;
  }
}

/* =========================
   PRESENCE
========================= */
async function setPresence(isOnline) {
  if (!fbEnabled || !fbDb || !fbUid) return;

  const room = $("room")?.value?.trim() || "call_room1";
  const name = $("name")?.value?.trim() || "User";
  const ref = doc(fbDb, "rooms", room, "users", fbUid);

  await setDoc(ref, {
    name,
    online: isOnline,
    lastSeen: serverTimestamp(),
    lastAction: isOnline ? "join" : "leave",
  }, { merge: true });
}

function listenUsers() {
  if (!fbEnabled || !fbDb) return;
  if (usersUnsub) { usersUnsub(); usersUnsub = null; }

  const room = $("room")?.value?.trim() || "call_room1";
  const colRef = collection(fbDb, "rooms", room, "users");

  usersUnsub = onSnapshot(colRef, (snap) => {
    const onlineUls = $$id("onlineList");
    const offlineUls = $$id("offlineList");
    for (const ul of onlineUls) ul.innerHTML = "";
    for (const ul of offlineUls) ul.innerHTML = "";

    const all = [];
    snap.forEach((d) => all.push({ id: d.id, ...(d.data() || {}) }));

    const online = all.filter((u) => !!u.online);
    const offline = all.filter((u) => !u.online);

    online.forEach((u) => {
      for (const ul of onlineUls) {
        const li = document.createElement("li");
        li.textContent = `🟢 ${u.name || "User"}${u.id === fbUid ? " (أنا)" : ""}`;
        ul.appendChild(li);
      }
    });

    offline.forEach((u) => {
      for (const ul of offlineUls) {
        const li = document.createElement("li");
        const act = u.lastAction === "join" ? "دخل" : "خرج";
        li.textContent = `⚪ ${u.name || "User"} — آخر حالة: ${act}${u.id === fbUid ? " (أنا)" : ""}`;
        ul.appendChild(li);
      }
    });
  }, (e) => console.warn(e));
}

/* =========================
   CALL SIGNALING (Incoming / Accept / Decline)
========================= */
function ensureCallBoxUI() {
  if ($("callBox")) return;
  const screen = document.querySelector(".screen");
  if (!screen) return;

  const div = document.createElement("div");
  div.id = "callBox";
  div.className = "callBox hidden";
  div.innerHTML = `
    <div class="callTitle">📞 مكالمة واردة</div>
    <div class="callMeta">من: <b id="callFrom">—</b> • قناة: <b id="callChannel">—</b></div>
    <div class="callBtns">
      <button id="callAccept" class="btn primary">✅ قبول</button>
      <button id="callDecline" class="btn danger">❌ رفض</button>
    </div>
    <div class="callHint mutedSmall">عند القبول سيتم الدخول للقناة تلقائيًا.</div>
  `;
  const pre = $("status")?.closest("pre");
  if (pre && pre.parentElement === screen) screen.insertBefore(div, pre);
  else screen.appendChild(div);
}

let ringing = false;
let incomingCallRef = null;
let incomingCallData = null;

function showCallBox(show) {
  const el = $("callBox");
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

async function startRinging() {
  if (ringing) return;
  ringing = true;
  led("ledWarn", true, "warn");
  while (ringing) {
    try { await beepTriplet(); } catch {}
    await sleep(1200);
  }
}
function stopRinging() {
  ringing = false;
  led("ledWarn", false, "warn");
}

function listenCalls() {
  if (!fbEnabled || !fbDb) return;
  if (callsUnsub) { callsUnsub(); callsUnsub = null; }

  const room = $("room")?.value?.trim() || "call_room1";
  const callsRef = collection(fbDb, "rooms", room, "calls");
  const qRef = query(callsRef, orderBy("createdAt", "desc"), limit(12));

  callsUnsub = onSnapshot(qRef, (snap) => {
    // إذا عندنا مكالمة حالية شغالة رنين لا نستبدلها
    if (incomingCallRef && incomingCallData?.status === "ringing") return;

    let found = null;
    snap.forEach((d) => {
      const data = d.data() || {};
      if (data.status === "ringing" && data.fromUid && data.fromUid !== fbUid) {
        if (!found) found = { id: d.id, data };
      }
    });
    if (!found) return;

    ensureCallBoxUI();

    incomingCallRef = doc(fbDb, "rooms", room, "calls", found.id);
    incomingCallData = found.data;

    if ($("callFrom")) $("callFrom").textContent = incomingCallData.fromName || "مستخدم";
    if ($("callChannel")) $("callChannel").textContent = incomingCallData.channel || "—";

    showCallBox(true);
    addActivity(`📞 مكالمة واردة من ${incomingCallData.fromName || "مستخدم"} (CH: ${incomingCallData.channel || "—"})`);
    startRinging();
  }, (e) => console.warn(e));
}

async function acceptIncoming() {
  if (!incomingCallRef || !incomingCallData) return;
  stopRinging();

  try {
    await updateDoc(incomingCallRef, {
      status: "accepted",
      acceptedByUid: fbUid,
      acceptedByName: $("name")?.value?.trim() || "User",
      acceptedAt: serverTimestamp(),
    });
  } catch (e) { console.warn(e); }

  const ch = incomingCallData.channel || "";
  if (ch && $("channel")) $("channel").value = ch;
  updateTopInfo();

  addActivity(`✅ تم قبول المكالمة (CH: ${ch || "—"})`);
  showCallBox(false);

  if (joined) await leaveCall(true);
  await joinCall();

  incomingCallRef = null;
  incomingCallData = null;
}

async function declineIncoming() {
  if (!incomingCallRef) return;
  stopRinging();
  try {
    await updateDoc(incomingCallRef, {
      status: "declined",
      declinedByUid: fbUid,
      declinedByName: $("name")?.value?.trim() || "User",
      declinedAt: serverTimestamp(),
    });
  } catch (e) { console.warn(e); }

  addActivity("❌ تم رفض المكالمة");
  showCallBox(false);

  incomingCallRef = null;
  incomingCallData = null;
}

async function sendCallInvite() {
  if (!fbEnabled) { addActivity("⚠️ النداء يحتاج Firebase شغال."); return; }

  const room = $("room")?.value?.trim() || "call_room1";
  const channel = $("channel")?.value?.trim() || "";
  const name = $("name")?.value?.trim() || "User";
  if (!channel) { addActivity("❌ اكتب Channel قبل إرسال نداء."); return; }

  const callId = (crypto?.randomUUID?.() || `call_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  const ref = doc(fbDb, "rooms", room, "calls", callId);

  await setDoc(ref, {
    fromUid: fbUid,
    fromName: name,
    channel,
    status: "ringing",
    createdAt: serverTimestamp(),
  });

  addActivity(`📞 تم إرسال نداء (CH: ${channel})`);
}

/* =========================
   SPEAKER VOL + OUTPUT
========================= */
function setSpeakerVol(v) {
  speakerVol = Math.max(0, Math.min(100, Number(v)));
  localStorage.setItem("spkVol", String(speakerVol));
  if ($("spkVolVal")) $("spkVolVal").textContent = String(speakerVol);

  remoteAudioTracks.forEach((t) => { try { t.setVolume(speakerVol); } catch {} });
}

async function refreshPlaybackDevices() {
  const sel = $("outSel");
  if (!sel) return;

  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Default (افتراضي)";
  sel.appendChild(opt0);

  if (!window.AgoraRTC?.getPlaybackDevices) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "غير مدعوم في هذا المتصفح";
    sel.appendChild(opt);
    sel.value = "";
    if ($("outText")) $("outText").textContent = "غير مدعوم";
    return;
  }

  try {
    const devices = await AgoraRTC.getPlaybackDevices();
    devices.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Playback (${d.deviceId.slice(0, 6)}...)`;
      sel.appendChild(opt);
    });

    sel.value = playbackDeviceId || "";
    if ($("outText")) $("outText").textContent = sel.value ? "Custom" : "Default";
  } catch (e) {
    console.warn(e);
    if ($("outText")) $("outText").textContent = "غير متاح";
  }
}

async function applyPlaybackDevice(track) {
  if (!track || !playbackDeviceId) return;
  if (typeof track.setPlaybackDevice !== "function") return;
  try { await track.setPlaybackDevice(playbackDeviceId); } catch (e) { console.warn(e); }
}

/* =========================
   UI STATE
========================= */
let deterrenceEnabled = false;
let deterrenceTimer = null;
let deterrenceInProgress = false;

function setUi() {
  if ($("joinBtn")) $("joinBtn").disabled = joined;        // سيتم تعطيلها أيضاً عند الحظر في checkBlockedOrStop
  if ($("leaveBtn")) $("leaveBtn").disabled = !joined;
  if ($("muteBtn")) $("muteBtn").disabled = !joined;

  // ✅ زر القوة القاهرة/الرادعة (مهم)
  if ($("deterrenceBtn")) $("deterrenceBtn").disabled = !joined;
  if ($("muteBtn")) $("muteBtn").textContent = muted ? "🎙️ تشغيل" : "🎙️ كتم";
  if ($("deterrenceBtn")) $("deterrenceBtn").textContent =
    deterrenceEnabled ? "⚡ القوة القاهرة: ON" : "⚡ القوة القاهرة: OFF";

  if ($("spkVol")) $("spkVol").value = String(speakerVol);
  if ($("spkVolVal")) $("spkVolVal").textContent = String(speakerVol);
}

function updateLevelUI() {
  if ($("lvlText")) $("lvlText").textContent = String(Math.round(level * 100));
}

/* =========================
   FIREBASE INIT
========================= */
function looksFirebaseConfigured() {
  return !!(firebaseConfig?.apiKey && firebaseConfig?.projectId);
}

async function initFirebaseIfPossible() {
  if (!looksFirebaseConfigured()) { fbEnabled = false; return; }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  fbDb = getFirestore(app);

  const cred = await signInAnonymously(auth);
  fbUid = cred.user.uid;

  fbEnabled = true;
  log("✅ Firebase جاهز + Anonymous sign-in.");
}

/* =========================
   DETERRENCE MODE
========================= */
async function deterrenceCycleOnce() {
  if (!deterrenceEnabled || deterrenceInProgress) return;
  deterrenceInProgress = true;

  try {
    led("ledWarn", true, "warn");
    await beepOnce(740, 140); await sleep(140);
    await beepOnce(740, 140); await sleep(140);
    await beepOnce(740, 140);

    await leaveCall(true);
    await sleep(6000);
    await joinCall();

    addActivity("⚡ تمت دورة القوة القاهرة (خروج ثم دخول).");
  } catch (e) {
    console.warn(e);
  } finally {
    led("ledWarn", false, "warn");
    deterrenceInProgress = false;
  }
}

function startDeterrence() {
  if (deterrenceEnabled) return;
  deterrenceEnabled = true;
  addActivity("⚡ تشغيل القوة القاهرة");
  setUi();
  deterrenceTimer = setInterval(deterrenceCycleOnce, 60000);
}
function stopDeterrence() {
  deterrenceEnabled = false;
  if (deterrenceTimer) { clearInterval(deterrenceTimer); deterrenceTimer = null; }
  setUi();
}
function toggleDeterrence() {
  if (!joined) return;
  if (!deterrenceEnabled) startDeterrence();
  else { stopDeterrence(); addActivity("🛑 إيقاف القوة القاهرة"); }
}

/* =========================
   AGORA JOIN/LEAVE
========================= */
async function joinCall() {
  const channel = $("channel")?.value?.trim() || "";
  const token = $("token")?.value?.trim() || "";

  if (!window.AgoraRTC) { log("❌ AgoraRTC غير موجود (تأكد سكربت Agora)."); return; }
  if (!AGORA_APP_ID) { log("❌ Agora App ID ناقص."); return; }
  if (!channel) { log("❌ اكتب Channel."); return; }

  // ✅ check block before joining
  const room = $("room")?.value?.trim() || "call_room1";
  if (fbEnabled) {
    await ensureLimitsDoc(room);
    const res = await checkBlockedOrStop(room);
    if (res.blocked) return;
  }

  updateTopInfo();
  setStatePill("جارِ الدخول…", "warn");
  led("ledPower", true);
  led("ledNet", false);
  led("ledMic", false);
  led("ledWarn", false, "warn");
  setBattery(72);

  try {
    await setPresence(true);
    listenUsers();
    listenCalls();
  } catch {}

  client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  client.enableAudioVolumeIndicator();
  client.on("volume-indicator", (vols) => {
    let max = 0;
    for (const v of vols || []) max = Math.max(max, v.level || 0);

    // threshold: أقل من 6 = صمت
    if (max >= 6) {
      level = Math.min(1, max / 100);
      lastVoiceAt = Date.now();
    } else {
      if (Date.now() - lastVoiceAt > 250) level = 0;
    }
    updateLevelUI();
  });

  client.on("user-joined", async (user) => {
    addActivity(`🟢 دخل مستخدم للمكالمة (uid=${user.uid})`);
    try { await beepTriplet(); } catch {}
  });

  client.on("user-published", async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    if (mediaType === "audio") {
      const t = user.audioTrack;
      remoteAudioTracks.set(user.uid, t);
      try { t.setVolume(speakerVol); } catch {}
      await applyPlaybackDevice(t);
      t.play();
      led("ledNet", true);
      addActivity(`🔊 بدأ صوت الطرف الآخر (uid=${user.uid})`);
    }
  });

  client.on("user-unpublished", (user, mediaType) => {
    if (mediaType === "audio") {
      remoteAudioTracks.delete(user.uid);
      addActivity(`📴 توقف صوت (uid=${user.uid})`);
    }
  });

  client.on("user-left", (user) => {
    remoteAudioTracks.delete(user.uid);
    addActivity(`⚪ خرج من المكالمة (uid=${user.uid})`);
  });

  try {
    log("⏳ جارِ الدخول…");
    await client.join(AGORA_APP_ID, channel, token || null, null);

    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    await client.publish([localAudioTrack]);

    joined = true;
    muted = false;
    setUi();

    led("ledNet", true);
    led("ledMic", true);
    setStatePill("متصل", "ok");
    log(`✅ دخلت القناة: ${channel}\n🎙️ المايك شغال`);

    // ✅ start usage ticker while in call
    if (fbEnabled) startUsageTicker(room);

  } catch (e) {
    console.error(e);
    joined = false;
    setUi();
    setStatePill("فشل", "bad");
    led("ledWarn", true, "warn");
    log(`❌ فشل الدخول: ${e?.message || e}\n- لو 110: Token مطلوب/خطأ\n- تأكد App ID والقناة`);
  }
}

async function leaveCall(silent) {
  stopDeterrence();
  stopUsageTicker();

  // flush last usage tick once on leave
  if (fbEnabled && joined) {
    const room = $("room")?.value?.trim() || "call_room1";
    try { await updateUsageTick(room); } catch {}
  }

  try {
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
      localAudioTrack = null;
    }
    if (client) {
      await client.leave();
      client = null;
    }
  } catch {}

  remoteAudioTracks.clear();
  joined = false;
  muted = false;
  level = 0;
  updateLevelUI();

  led("ledNet", false);
  led("ledMic", false);
  led("ledWarn", false, "warn");
  setStatePill("غير متصل", "warn");

  setUi();
  try { await setPresence(false); } catch {}

  if (!silent) log("✅ تم الخروج");
}

async function toggleMute() {
  if (!localAudioTrack) return;
  muted = !muted;
  await localAudioTrack.setEnabled(!muted);
  led("ledMic", !muted);
  setUi();
  log(muted ? "🔇 تم كتم المايك" : "🎙️ تم تشغيل المايك");
}

/* =========================
   BOOT
========================= */
(async function boot() {
  // Theme init
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) setTheme(savedTheme);
  else {
    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
    setTheme(prefersLight ? "light" : "dark");
  }

  // Desktop-like init
  if (localStorage.getItem("desktopLike") === "1") enableDesktopLike();
  maybeShowDesktopPrompt();

  readQueryToInputs();
  updateTopInfo();

  // Canvas
  initCanvas();
  requestAnimationFrame(drawWave);
  window.addEventListener("resize", initCanvas);

  // LEDs base
  led("ledPower", true);
  setBattery(72);
  setStatePill("جاهز", "warn");

  // ensure important buttons exist (if HTML forgot them)
  // ✅ deterrence button (القوة القاهرة) MUST exist
  if (!$("deterrenceBtn")) {
    const rows = document.querySelectorAll(".btnRow");
    const row = rows?.[0] || null;
    if (row) {
      const b = document.createElement("button");
      b.id = "deterrenceBtn";
      b.className = "btn warn";
      b.disabled = true;
      b.textContent = "⚡ القوة القاهرة: OFF";
      row.appendChild(b);
    }
  }

  // ensure call box
  ensureCallBoxUI();

  // volume init
  setSpeakerVol(speakerVol);
  setUi();

  // Firebase optional
  try {
    await initFirebaseIfPossible();
    if (fbEnabled) {
      // optional IP
      publicIp = await getPublicIpIfEnabled();
      if (publicIp) addActivity(`🌐 تم تسجيل IP (تجريبي): ${publicIp}`);

      // ensure limits doc + check block at startup
      const room = $("room")?.value?.trim() || "call_room1";
      await ensureLimitsDoc(room);
      await checkBlockedOrStop(room);

      listenUsers();
      listenCalls();
      addActivity("📡 Firebase Presence + Calls جاهزة.");
    } else {
      addActivity("⚠️ Firebase غير مفعّل — Presence/Calls/Limits لن تعمل.");
    }
  } catch (e) {
    console.warn(e);
    fbEnabled = false;
    addActivity("⚠️ فشل Firebase — تأكد من firebaseConfig.");
  }

  // playback devices
  try { await refreshPlaybackDevices(); } catch {}

  // AdSense fixed slots
  initAdSenseFixedSlots();

  /* ===== Events ===== */
  if ($("themeBtn")) $("themeBtn").onclick = () => toggleTheme();

  if ($("deskYes")) $("deskYes").onclick = () => { enableDesktopLike(); $("deskPrompt")?.classList.add("hidden"); };
  if ($("deskNo"))  $("deskNo").onclick  = () => { disableDesktopLike(); $("deskPrompt")?.classList.add("hidden"); };

  if ($("callAccept")) $("callAccept").onclick = async () => { ensureAudio()?.resume?.().catch(()=>{}); await acceptIncoming(); };
  if ($("callDecline")) $("callDecline").onclick = async () => { ensureAudio()?.resume?.().catch(()=>{}); await declineIncoming(); };

  if ($("joinBtn")) $("joinBtn").onclick = async () => { ensureAudio()?.resume?.().catch(()=>{}); await joinCall(); };
  if ($("leaveBtn")) $("leaveBtn").onclick = async () => { ensureAudio()?.resume?.().catch(()=>{}); await leaveCall(false); };
  if ($("muteBtn")) $("muteBtn").onclick = async () => { ensureAudio()?.resume?.().catch(()=>{}); await toggleMute(); };

  if ($("deterrenceBtn")) $("deterrenceBtn").onclick = async () => { ensureAudio()?.resume?.().catch(()=>{}); toggleDeterrence(); };

  if ($("callBtn")) $("callBtn").onclick = async () => { ensureAudio()?.resume?.().catch(()=>{}); await sendCallInvite(); };

  if ($("copyBtn")) $("copyBtn").onclick = async () => {
    const link = makeShareLink();
    try {
      await navigator.clipboard.writeText(link);
      addActivity("✅ تم نسخ الرابط.");
      log("✅ تم نسخ الرابط.");
    } catch {
      prompt("انسخ الرابط:", link);
    }
  };

  if ($("spkVol")) $("spkVol").oninput = (e) => setSpeakerVol(e.target.value);

  if ($("outRefreshBtn")) $("outRefreshBtn").onclick = async () => {
    ensureAudio()?.resume?.().catch(()=>{});
    await refreshPlaybackDevices();
    addActivity("✅ تم تحديث مخارج الصوت (إن كانت مدعومة).");
  };

  if ($("outSel")) $("outSel").onchange = async (e) => {
    playbackDeviceId = e.target.value || "";
    localStorage.setItem("playbackDeviceId", playbackDeviceId);
    if ($("outText")) $("outText").textContent = playbackDeviceId ? "Custom" : "Default";
    for (const t of remoteAudioTracks.values()) await applyPlaybackDevice(t);
  };

  // If room changes, re-subscribe + re-check block
  if ($("room")) {
    $("room").addEventListener("change", async () => {
      updateTopInfo();
      if (!fbEnabled) return;
      const room = $("room").value.trim() || "call_room1";
      await ensureLimitsDoc(room);
      await checkBlockedOrStop(room);
      listenUsers();
      listenCalls();
    });
  }

  ["name", "channel"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", updateTopInfo);
  });

  // Cleanup
  window.addEventListener("beforeunload", async () => {
    try { await setPresence(false); } catch {}
    try {
      if (fbEnabled && joined) {
        const room = $("room")?.value?.trim() || "call_room1";
        await updateUsageTick(room);
      }
    } catch {}
  });

  log(
    "جاهز ✅\n" +
    "- أدخل نفس Channel على جهازين للمكالمة\n" +
    "- Room (Presence+Calls) لتتبع المستخدمين/الإشعارات\n" +
    "- حد 3 ساعات مكالمة ثم حظر 20 ساعة (تجريبي)\n" +
    "⚠️ أكواد تدريبية للتعليم فقط."
  );
})();