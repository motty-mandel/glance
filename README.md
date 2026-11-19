# Glance (PWA)

Agent + glasses interface prototype. Plain HTML/CSS/JS, no build step, no dependencies.

## Run locally in VS Code
1. Open this folder in VS Code.
2. Install the **Live Server** extension, right-click `index.html`, choose **Open with Live Server**.
   (Or in a terminal here: `python3 -m http.server 8080`, then open http://localhost:8080)

`localhost` counts as secure, so the service worker and install prompt work on your computer.

## Put it on a phone
Phones need HTTPS (your computer's `localhost` is not reachable as secure from the phone). Pick one:
- **Deploy free**: drag this folder into Netlify Drop, or push to GitHub Pages / Cloudflare Pages.
- **Tunnel while developing**: `npx localtunnel --port 8080` or `ngrok http 8080`, then open the https URL on the phone.

## Install
- **iOS (Safari)**: Share button, then Add to Home Screen.
- **Android (Chrome)**: menu, then Install app (or Add to Home screen).

## Notes
- Voice input (mic button) appears only where the browser supports speech recognition. Chrome on Android does; iOS support is limited and often absent in installed PWAs. Typing and tapping always work.
- Spoken replies use the browser's built-in speech synthesis.
- After editing any file, bump `CACHE` in `sw.js` (for example `glance-v2`) so installed copies update.
- The agent is scripted. To make it real, replace each scenario's `steps` in `app.js` with calls to your own backend or an LLM API (keep API keys on a server, not in this front end).

## Files
`index.html` markup, `styles.css` look, `app.js` logic and scenarios, `sw.js` offline cache, `manifest.webmanifest` install info, `icons/` app icons, `make_icons.py` icon generator.

## What "access to apps" means here
A PWA runs in the browser sandbox. On both iOS and Android it **cannot read, control, or tap inside other apps**. What it can do, and what this version does, is hand off:
- Universal links / URL schemes open the real app with data pre-filled (Uber, Messages via `sms:`, Mail via `mailto:`, Maps).
- The Web Share API passes a generated `.ics` file to the Calendar app.
- The user taps once in the target app to finish (send, book, save).

For true cross-app automation you need a native app:
- **Android**: an AccessibilityService can read screens and perform taps in other apps (needs a Kotlin/Java app and the user's explicit permission; Google Play restricts this use). Intents and App Actions are the sanctioned route.
- **iOS**: no cross-app control exists. Use App Intents / Shortcuts, which only run actions apps expose.

The more robust route for an agent is calling service APIs directly from a backend (Google Calendar, Twilio, rideshare partner APIs) with the user's OAuth consent, rather than driving app UIs.
