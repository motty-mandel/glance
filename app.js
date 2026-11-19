"use strict";

const MODEL = "claude-haiku-5-5"; // used only if you add an API key in Settings

// ===== Settings (stored on this device only) =====
let cfg = { contacts: "", home: "", key: "" };
try { Object.assign(cfg, JSON.parse(localStorage.getItem("glance-cfg") || "{}")); } catch (_) {}
const saveCfg = () => { try { localStorage.setItem("glance-cfg", JSON.stringify(cfg)); } catch (_) {} };

// Contacts: one per line, e.g. "Sam, +15551234567, sam@example.com"
function contactList() {
  return cfg.contacts.split("\n").map((l) => l.split(",").map((x) => x.trim()).filter(Boolean)).filter((p) => p.length)
    .map((p) => ({
      name: p[0],
      tel: (p.slice(1).find((x) => (x.match(/\d/g) || []).length >= 7 && !x.includes("@")) || "").replace(/[^\d+]/g, ""),
      email: p.slice(1).find((x) => x.includes("@")) || "",
    }));
}
function contact(name) {
  const n = (name || "").trim().replace(/[:,]$/, "");
  const hit = contactList().find((c) => c.name.toLowerCase() === n.toLowerCase());
  if (hit) return { label: hit.name, tel: hit.tel, email: hit.email };
  if (n.includes("@")) return { label: n, tel: "", email: n };
  if ((n.match(/\d/g) || []).length >= 7) return { label: n, tel: n.replace(/[^\d+]/g, ""), email: "" };
  return { label: n.charAt(0).toUpperCase() + n.slice(1), tel: "", email: "" };
}

// ===== Understanding: built-in parser =====
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseWhen(text) {
  let rest = text, d = null, m;
  if ((m = rest.match(/\b(today|tonight|tomorrow)\b/i))) {
    d = new Date(); if (/tomorrow/i.test(m[1])) d.setDate(d.getDate() + 1); rest = rest.replace(m[0], " ");
  } else if ((m = rest.match(/\b(?:next\s+|on\s+|this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i))) {
    d = new Date(); d.setDate(d.getDate() + ((DAYS.indexOf(m[1].toLowerCase()) - d.getDay() + 7) % 7 || 7)); rest = rest.replace(m[0], " ");
  }
  const tm = rest.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || rest.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b()/i) || rest.match(/\b(\d{1,2}):(\d{2})\b()/i);
  let start = null;
  if (tm) {
    let h = +tm[1]; const ap = (tm[3] || "").toLowerCase();
    if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
    start = d || new Date(); start = new Date(start); start.setHours(h, +(tm[2] || 0), 0, 0);
    if (!d && start < new Date()) start.setDate(start.getDate() + 1);
    rest = rest.replace(tm[0], " ");
  } else if (d) { start = new Date(d); start.setHours(9, 0, 0, 0); }
  rest = rest.replace(/\s+/g, " ").replace(/\b(at|on|for)\s*$/i, "").trim();
  return { start, rest };
}

function splitNameBody(rest) {
  rest = rest.trim();
  const names = contactList().map((c) => c.name).sort((a, b) => b.length - a.length);
  let name = null;
  for (const n of names) if (rest.toLowerCase() === n.toLowerCase() || rest.toLowerCase().startsWith(n.toLowerCase() + " ") || rest.toLowerCase().startsWith(n.toLowerCase() + ":")) { name = rest.slice(0, n.length); break; }
  if (!name) { const m = rest.match(/^(\S+)/); name = m ? m[1] : rest; }
  const body = rest.slice(name.length).replace(/^[\s:,-]*(?:that|saying|to say)?\s*/i, "").trim();
  return [name.replace(/[:,]$/, ""), body];
}

function parseClause(s) {
  s = s.trim().replace(/[.!]+$/, ""); let m;
  if ((m = s.match(/^(?:text|message|sms|imessage|tell)\s+(?:to\s+)?(.+)$/i))) { const [to, body] = splitNameBody(m[1]); return { type: "text", to, body }; }
  if ((m = s.match(/^whatsapp\s+(?:to\s+)?(.+)$/i))) { const [to, body] = splitNameBody(m[1]); return { type: "whatsapp", to, body }; }
  if ((m = s.match(/^e-?mail\s+(?:to\s+)?(.+)$/i))) {
    const [to, rest] = splitNameBody(m[1]);
    const x = rest.match(/^(?:about|re:?|subject:?)\s+(.+?)(?:\s+(?:saying|that)\s+(.+))?$/i);
    return x ? { type: "email", to, subject: x[1], body: x[2] || "" } : { type: "email", to, body: rest };
  }
  if (/\b(uber|lyft|taxi|cab)\b/i.test(s) || /^(?:get|order|book|request)\s+(?:me\s+)?(?:a|an)\s+ride\b/i.test(s)) {
    m = s.match(/\bto\s+(.+)$/i) || s.match(/\b(home|work)\s*$/i); return { type: "ride", place: m ? m[1] : "" };
  }
  if ((m = s.match(/^facetime\s+(.+)$/i))) return { type: "facetime", to: m[1] };
  if ((m = s.match(/^(?:call|phone|ring|dial)\s+(.+)$/i))) return { type: "call", to: m[1] };
  if ((m = s.match(/^(?:navigate|directions?|get directions|take me|drive me|walk me)\s*(?:me\s+)?(?:to\s+)?(.+)$/i))) return { type: "directions", place: m[1] };
  const near = /\b(nearest|closest|near me|nearby|around here)\b/ig;
  if (near.test(s)) return { type: "places", query: s.replace(/^(?:find|show|where(?:'s| is)|search for|look for)\s+(?:me\s+)?(?:the\s+|a\s+|an\s+)?/i, "").replace(near, "").replace(/\s+/g, " ").trim() || s };
  if ((m = s.match(/^remind me\s+(?:to\s+)?(.+)$/i))) { const w = parseWhen(m[1]); return { type: "reminder", body: w.rest, start: w.start }; }
  if ((m = s.match(/^(?:note|jot down|write down|take a note)\s*(?:that|:)?\s*(.+)$/i))) return { type: "note", body: m[1] };
  if ((m = s.match(/^play\s+(.+?)(?:\s+on\s+(?:spotify|apple music))?$/i))) return { type: "music", query: m[1] };
  if ((m = s.match(/^run\s+(?:the\s+)?(?:shortcut\s+)?(.+?)(?:\s+shortcut)?$/i))) return { type: "shortcut", name: m[1] };
  if (/^(?:schedule|add|create|book|set up|put)\b/i.test(s)) {
    const w = parseWhen(s.replace(/^(?:schedule|add|create|book|set up|put)\s+(?:in\s+)?(?:a\s+|an\s+|my\s+)?(?:new\s+)?(?:calendar\s+)?(?:event|meeting|appointment)?\s*(?:called|named|for|about)?\s*/i, ""));
    if (w.start || /calendar|meeting|event|appointment/i.test(s)) return { type: "event", title: w.rest, start: w.start };
  }
  if (/^(?:search|google|look up|what(?:'s| is)|who(?:'s| is)|how (?:do|to))\b/i.test(s)) return { type: "web", query: s.replace(/^(?:search(?:\s+the\s+web)?(?:\s+for)?|google|look up)\s+/i, "") };
  return null;
}

function localParse(text) {
  const verbs = "text|message|sms|tell|email|e-mail|call|facetime|whatsapp|remind|schedule|add|navigate|directions|take|play|search|note|get|order|book|run";
  const clauses = text.split(new RegExp("\\s+(?:and then|then|and)\\s+(?=(?:" + verbs + ")\\b)", "i"));
  const out = clauses.map(parseClause).filter(Boolean);
  return out.length ? out : [{ type: "web", query: text, fallback: true }];
}

// ===== Understanding: optional LLM (only if an API key is saved) =====
async function llmParse(text) {
  const sys = 'Convert the request into JSON only: {"actions":[...]}. Each action: {"type": text|email|call|facetime|whatsapp|directions|places|ride|event|reminder|note|music|web|shortcut, "to": contact name/number/email, "body": message or note text, "subject", "place": destination ("home" for home), "query": search text, "title", "start": local ISO datetime like 2026-11-20T15:00 or null, "name": shortcut name}. Omit unused fields. Now: ' + new Date().toString();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, system: sys, messages: [{ role: "user", content: text }] }),
  });
  if (!r.ok) throw new Error("API " + r.status);
  const j = await r.json();
  const t = j.content.map((c) => c.text || "").join("").replace(/```json|```/g, "").trim();
  return JSON.parse(t).actions.map((a) => ({ ...a, start: a.start ? new Date(a.start) : null }));
}

// ===== Handoffs: turn an intent into pre-filled links for real iPhone/Android apps =====
const enc = encodeURIComponent;
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const when = (d) => d.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
const shortcut = (name, text) => `shortcuts://run-shortcut?name=${enc(name)}&input=text&text=${enc(text)}`;

function icsFile(title, start) {
  const end = new Date(start.getTime() + 3600000);
  const text = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Glance//EN", "BEGIN:VEVENT", "UID:" + Date.now() + "@glance",
    "DTSTAMP:" + fmt(new Date()), "DTSTART:" + fmt(start), "DTEND:" + fmt(end), "SUMMARY:" + title.replace(/[,;]/g, " "), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return new File([text], "event.ics", { type: "text/calendar" });
}
async function shareOrDownload(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch (_) {} return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
}
function place(p) { return /^home$/i.test(p || "") ? (cfg.home || "") : (p || ""); }

function build(i) {
  const c = i.to ? contact(i.to) : null;
  switch (i.type) {
    case "text": return { title: "Text " + c.label, detail: `“${i.body || ""}”` + (c.tel ? "" : " (pick the recipient in Messages)"),
      actions: [{ label: "Open Messages", href: `sms:${c.tel}?&body=${enc(i.body || "")}` }] };
    case "whatsapp": return { title: "WhatsApp " + c.label, detail: `“${i.body || ""}”` + (c.tel ? "" : " (no number saved)"),
      actions: [{ label: "Open WhatsApp", href: `https://wa.me/${c.tel.replace(/\D/g, "")}?text=${enc(i.body || "")}` }] };
    case "email": return { title: "Email " + c.label, detail: (i.subject ? i.subject + ": " : "") + (i.body || "") + (c.email ? "" : " (no address saved)"),
      actions: [{ label: "Open Mail", href: `mailto:${c.email}?subject=${enc(i.subject || "")}&body=${enc(i.body || "")}` }] };
    case "call": return { title: "Call " + c.label, detail: c.tel ? c.tel : "No number saved. Add one in Settings.",
      actions: c.tel ? [{ label: "Call " + c.label, href: "tel:" + c.tel }] : [] };
    case "facetime": return { title: "FaceTime " + c.label, detail: c.tel || c.email || "No number saved. Add one in Settings.",
      actions: c.tel || c.email ? [{ label: "Start FaceTime", href: "facetime:" + (c.tel || c.email) }] : [] };
    case "directions": { const p = place(i.place);
      return { title: "Directions to " + (p || "home"), detail: p ? "Apple Maps or Google Maps" : "Save a home address in Settings.",
        actions: p ? [{ label: "Apple Maps", href: `https://maps.apple.com/?daddr=${enc(p)}&dirflg=d` }, { label: "Google Maps", href: `https://www.google.com/maps/dir/?api=1&destination=${enc(p)}` }] : [] }; }
    case "places": return { title: "Find " + i.query + " nearby", detail: "Search around your location",
      actions: [{ label: "Apple Maps", href: `https://maps.apple.com/?q=${enc(i.query)}` }, { label: "Google Maps", href: `https://www.google.com/maps/search/${enc(i.query)}` }] };
    case "ride": { const p = place(i.place);
      return { title: "Ride" + (p ? " to " + p : ""), detail: p ? "Uber opens with your destination filled in" : (i.place ? "Save a home address in Settings to prefill it." : "Uber opens with pickup set"),
        actions: [{ label: "Open Uber", href: "https://m.uber.com/ul/?action=setPickup&pickup=my_location" + (p ? `&dropoff[formatted_address]=${enc(p)}` : "") }] }; }
    case "event": { let s = i.start; if (!s || isNaN(s)) { s = new Date(); s.setHours(s.getHours() + 1, 0, 0, 0); }
      const t = cap(i.title || "Event");
      return { title: t, detail: when(s) + ", 1 hour", actions: [{ label: "Add to Calendar", run: () => shareOrDownload(icsFile(t, s)) }] }; }
    case "reminder": { const t = cap(i.body || "");
      const a = [{ label: "Run Reminder shortcut", href: shortcut("Glance Reminder", t + (i.start ? " @ " + when(i.start) : "")) }];
      if (i.start) a.push({ label: "Add to Calendar", run: () => shareOrDownload(icsFile(t, i.start)) });
      return { title: "Remind: " + t, detail: (i.start ? when(i.start) + ". " : "") + "Needs the “Glance Reminder” shortcut (see README)", actions: a }; }
    case "note": return { title: "Save note", detail: `“${i.body}”`, actions: [{ label: "Run Note shortcut", href: shortcut("Glance Note", i.body || "") }] };
    case "music": return { title: "Play " + i.query, detail: "Search in Spotify or Apple Music",
      actions: [{ label: "Spotify", href: "https://open.spotify.com/search/" + enc(i.query) }, { label: "Apple Music", href: "https://music.apple.com/search?term=" + enc(i.query) }] };
    case "shortcut": return { title: "Run shortcut “" + i.name + "”", detail: "Runs in the Shortcuts app", actions: [{ label: "Run it", href: "shortcuts://run-shortcut?name=" + enc(i.name) }] };
    default: return { title: "Search the web", detail: i.fallback ? "I wasn’t sure what you meant. Add an API key in Settings for fuller understanding." : i.query,
      actions: [{ label: "Search", href: "https://www.google.com/search?q=" + enc(i.query || "") }] };
  }
}

// ==== UI ====
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let runId = 0;
const EXAMPLES = ["Get me an Uber home and text Sam I’m running late", "Schedule lunch with Priya tomorrow at 12:30", "Find coffee near me", "Play Fleetwood Mac on Spotify"];

function setStatus(t, live) { $("status").textContent = t; $("dot").className = "dot" + (live ? " on" : ""); }
function setGlance(main, sub) { const g = $("glance"); g.textContent = main; if (sub) { const s = document.createElement("small"); s.textContent = sub; g.appendChild(s); } }
function speak(t) { if ("speechSynthesis" in window) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); } }
function row(title, detail, done) {
  const li = document.createElement("li"); if (done) li.className = "done";
  li.innerHTML = '<span class="ic"></span><span><b></b><span class="d"></span></span>';
  li.querySelector(".ic").textContent = done ? "✓" : "…"; li.querySelector("b").textContent = title; li.querySelector(".d").textContent = detail || "";
  return li;
}
function actionRow(b) {
  const li = document.createElement("li"), box = document.createElement("span"), wrap = document.createElement("span");
  const t = document.createElement("b"); t.textContent = b.title; wrap.className = "acts";
  b.actions.forEach((a) => {
    const el = document.createElement(a.href ? "a" : "button"); el.className = "act"; el.textContent = a.label;
    if (a.href) { el.href = a.href; if (a.href.startsWith("http")) { el.target = "_blank"; el.rel = "noopener"; } } else el.onclick = a.run;
    wrap.appendChild(el);
  });
  if (!b.actions.length) { const d = document.createElement("span"); d.className = "d"; d.textContent = "Nothing to open."; wrap.appendChild(d); }
  box.append(t, wrap); li.innerHTML = '<span class="ic">→</span>'; li.appendChild(box);
  return li;
}

async function run(text) {
  text = (text || "").trim(); if (!text) return;
  const id = ++runId, log = $("log"); $("pinch").className = "pinch"; log.innerHTML = "";
  setStatus("Listening", true); setGlance("“" + text + "”"); await wait(700); if (id !== runId) return;
  setStatus("Working", true);
  let intents = null, note = "";
  if (cfg.key) { try { intents = await llmParse(text); } catch (e) { note = "AI unavailable (" + e.message + "), used built-in understanding."; } }
  if (!intents) intents = localParse(text);
  if (id !== runId) return;
  const built = intents.map(build);
  if (note) log.appendChild(row("Note", note, true));
  for (const b of built) { log.appendChild(row(b.title, b.detail, true)); await wait(450); if (id !== runId) return; }
  setStatus("Needs you", false);
  setGlance(built.length === 1 ? built[0].title : built.length + " things ready", built.length === 1 ? built[0].detail : built.map((b) => b.title).join(" · "));
  speak(built.length === 1 ? built[0].title : built.length + " things ready");
  const pinch = $("pinch"); pinch.className = "pinch show";
  pinch.onclick = () => {
    pinch.className = "pinch"; setGlance("Ready. Finish in your apps."); setStatus("Done", false);
    built.forEach((b) => log.appendChild(actionRow(b)));
  };
}

EXAMPLES.forEach((t) => { const b = document.createElement("button"); b.className = "chip"; b.textContent = "“" + t + "”"; b.onclick = () => run(t); $("chips").appendChild(b); });
$("go").onclick = () => { const v = $("q").value; $("q").value = ""; run(v); };
$("q").onkeydown = (e) => { if (e.key === "Enter") $("go").click(); };

// Settings
[["contacts", "s-contacts"], ["home", "s-home"], ["key", "s-key"]].forEach(([k, id]) => { const el = $(id); el.value = cfg[k]; el.oninput = () => { cfg[k] = el.value; saveCfg(); $("mode").textContent = cfg.key ? "AI understanding on" : "Built-in understanding"; }; });
$("mode").textContent = cfg.key ? "AI understanding on" : "Built-in understanding";

// Clock
const tick = () => { $("clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }; tick(); setInterval(tick, 30000);

// Voice input
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const mic = $("mic"), rec = new SR(); mic.hidden = false; rec.lang = navigator.language || "en-US"; rec.interimResults = false;
  rec.onstart = () => { mic.classList.add("live"); setStatus("Listening", true); };
  rec.onend = () => mic.classList.remove("live");
  rec.onerror = () => setStatus("Mic unavailable", false);
  rec.onresult = (e) => run(e.results[0][0].transcript);
  mic.onclick = () => { try { rec.start(); } catch (_) {} };
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.warn));
