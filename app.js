"use strict";

// ---- Scripted scenarios. Replace `steps` with real API calls to make it live. ----
const SCENARIOS = [
  { keys: ["home", "ride"], say: "Get me home, cheaper than usual, and tell Sam I’m late",
    steps: [["Checked 3 rides", "Pool is $9 cheaper than your usual, 4 min longer"],
            ["Compared transit", "Next train is 22 min away, so the ride wins"],
            ["Drafted a note to Sam", "“Running about 20 min late, start without me.”"]],
    glance: "Pool ride, $11.40, arrives 7:06", sub: "Sam will hear you’re about 20 min late.",
    done: "Ready. Finish in your apps." },
  { keys: ["3pm", "move", "meeting"], say: "Move my 3pm to tomorrow and let them know",
    steps: [["Read your calendar", "Tomorrow 10:30 AM is free for everyone"],
            ["Checked the invite list", "4 attendees, none out of office"],
            ["Wrote the update", "“Moving to tomorrow 10:30, same link.”"]],
    glance: "Move 3pm to tomorrow 10:30?", sub: "4 people get the update.",
    done: "Ready. Finish in your apps." },
  { keys: ["coffee", "cafe", "drink"], say: "Order my usual coffee for when I walk past",
    steps: [["Found your usual", "Oat flat white, no sugar"],
            ["Located the nearest shop", "Two blocks ahead, 3 min walk"],
            ["Timed the order", "Ready as you arrive"]],
    glance: "Oat flat white, ready in 3 min", sub: "Two blocks ahead on your left.",
    done: "Ready. Finish in your apps." },
];


// ---- Handoffs: what a web app CAN do. It opens your real apps with the work pre-filled;
// ---- you finish with one tap inside them. (It cannot tap buttons in other apps for you.)
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const enc = encodeURIComponent;

function icsFile() {
  const s = new Date(); s.setDate(s.getDate() + 1); s.setHours(10, 30, 0, 0);
  const e = new Date(s.getTime() + 3600000);
  const f = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const text = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Glance//EN", "BEGIN:VEVENT",
    "UID:" + Date.now() + "@glance", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(s), "DTEND:" + f(e),
    "SUMMARY:Team sync (moved)", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return new File([text], "moved-meeting.ics", { type: "text/calendar" });
}

async function shareOrDownload(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name }); return; } catch (_) { return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = file.name; a.click();
}

const ACTIONS = [
  [{ label: "Open Uber", href: "https://m.uber.com/ul/?action=setPickup&pickup=my_location" },
   { label: "Text Sam", href: "sms:?&body=" + enc("Running about 20 min late, start without me.") }],
  [{ label: "Add to Calendar", run: () => shareOrDownload(icsFile()) },
   { label: "Email attendees", href: "mailto:?subject=" + enc("Meeting moved") + "&body=" + enc("Moving to tomorrow 10:30, same link.") }],
  [{ label: "Find coffee nearby", href: IOS ? "https://maps.apple.com/?q=coffee" : "https://www.google.com/maps/search/coffee" }],
];

function actionRow(index) {
  const li = document.createElement("li");
  const wrap = document.createElement("span");
  wrap.className = "acts";
  ACTIONS[index].forEach((a) => {
    const el = document.createElement(a.href ? "a" : "button");
    el.className = "act"; el.textContent = a.label;
    if (a.href) { el.href = a.href; el.target = "_blank"; el.rel = "noopener"; }
    else el.onclick = a.run;
    wrap.appendChild(el);
  });
  li.appendChild(wrap);
  return li;
}

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let runId = 0;

function setStatus(text, live) {
  $("status").textContent = text;
  $("dot").className = "dot" + (live ? " on" : "");
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function setGlance(main, sub) {
  const g = $("glance");
  g.textContent = main;
  if (sub) {
    const s = document.createElement("small");
    s.textContent = sub;
    g.appendChild(s);
  }
}

function stepRow(title, detail, done) {
  const li = document.createElement("li");
  li.innerHTML = '<span class="ic"></span><span><b></b><span class="d"></span></span>';
  li.querySelector(".ic").textContent = done ? "✓" : "…";
  li.querySelector("b").textContent = title;
  li.querySelector(".d").textContent = detail || "";
  if (done) li.className = "done";
  return li;
}

async function run(index) {
  const id = ++runId, s = SCENARIOS[index], log = $("log");
  $("pinch").className = "pinch";
  log.innerHTML = "";
  setStatus("Listening", true);
  setGlance("“" + s.say + "”");
  await wait(1100); if (id !== runId) return;

  setStatus("Working", true);
  for (const [title, detail] of s.steps) {
    const li = stepRow(title, detail, false);
    log.appendChild(li);
    await wait(900); if (id !== runId) return;
    li.className = "done";
    li.querySelector(".ic").textContent = "✓";
  }

  setStatus("Needs you", false);
  setGlance(s.glance, s.sub);
  speak(s.glance);
  const pinch = $("pinch");
  pinch.className = "pinch show";
  pinch.onclick = () => {
    pinch.className = "pinch";
    setGlance(s.done);
    setStatus("Done", false);
    log.appendChild(stepRow("Confirmed", "Tap below to finish in your apps", true));
    log.appendChild(actionRow(index));
    speak(s.done);
  };
}

function match(text) {
  const t = text.toLowerCase();
  return SCENARIOS.findIndex((s) => s.keys.some((k) => t.includes(k)));
}

function ask(text) {
  const v = (text || $("q").value).trim();
  if (!v) return;
  const i = match(v);
  if (i > -1) { $("q").value = ""; run(i); }
  else {
    runId++;
    setStatus("Not sure", false);
    setGlance("I can’t do that in this demo.", "Try “home”, “3pm” or “coffee”.");
  }
}

// ---- UI wiring ----
SCENARIOS.forEach((s, i) => {
  const b = document.createElement("button");
  b.className = "chip";
  b.textContent = "“" + s.say + "”";
  b.onclick = () => run(i);
  $("chips").appendChild(b);
});
$("go").onclick = () => ask();
$("q").onkeydown = (e) => { if (e.key === "Enter") ask(); };

// Clock
const tick = () => { $("clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
tick(); setInterval(tick, 30000);

// Voice input (progressive enhancement: shown only where the browser supports it)
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const mic = $("mic"), rec = new SR();
  mic.hidden = false;
  rec.lang = navigator.language || "en-US";
  rec.interimResults = false;
  rec.onstart = () => { mic.classList.add("live"); setStatus("Listening", true); };
  rec.onend = () => mic.classList.remove("live");
  rec.onerror = () => setStatus("Mic unavailable", false);
  rec.onresult = (e) => ask(e.results[0][0].transcript);
  mic.onclick = () => { try { rec.start(); } catch (_) {} };
}

// Service worker (offline + installability)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.warn));
}
