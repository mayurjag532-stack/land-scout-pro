# Land Scout Pro

Private, mobile-first land site-visit intelligence tool. Capture the exact
GPS location of a plot, pull map intelligence around it (roads, residential
density, sports/fitness, schools, access points), run your own site
checklist, log owner due-diligence answers separately, attach photos, and
get a transparent 0-100 site-signal score per property.

All data is stored **locally in the browser** (IndexedDB, with a
localStorage mirror as a fallback). Nothing is uploaded anywhere by default.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Leaflet + react-leaflet (map rendering, OpenStreetMap tiles)
- Overpass API (OpenStreetMap POI/road data) — free, no key required
- Browser Geolocation API
- IndexedDB (via `idb`) + localStorage fallback

No backend. No database server. No API keys required by default.

## 1. Install

```bash
npm install
```

## 2. Run locally

```bash
npm run dev
```

Opens on `http://localhost:5173`. Geolocation works on `localhost` even over
plain HTTP — this is a browser exception for local development.

## 3. Test on your phone during development

Your phone and laptop must be on the same Wi-Fi. Vite will print a `Network:`
URL (something like `http://192.168.x.x:5173`) when you run `npm run dev` —
but **browser Geolocation will refuse to run over a plain-HTTP LAN address**
on most mobile browsers. Two options:

- Use `npx vite --host --https` with a local cert tool (e.g. `mkcert`), or
- Just deploy it (step 4) and test on the real HTTPS URL — this is the
  simplest path and matches how you'll actually use it.

## 4. Deploy on HTTPS (required for real GPS use)

Geolocation requires a "secure context" (HTTPS) on real devices — this is a
browser/OS rule, not something the app can work around, other than
`localhost`. Easiest path:

### Vercel (recommended, same stack you already use for NAVAKYA)

```bash
npm install -g vercel
vercel
```

Accept the defaults — Vercel auto-detects Vite. It builds with
`npm run build` and serves the `dist/` folder over HTTPS automatically. Every
push to your connected GitHub repo redeploys automatically, same as your
NAVAKYA site.

### Netlify (equally simple alternative)

```bash
npm run build
npx netlify-cli deploy --prod --dir=dist
```

Either way you get a free `*.vercel.app` / `*.netlify.app` HTTPS URL you can
open directly on your phone and add to your home screen (Share → Add to Home
Screen) so it behaves like an app icon.

## 5. Environment variables

None required. See `.env.example` for what to do if you later swap the free
Overpass lookups for a paid places API.

## Project structure

```
src/
  types.ts               Data model, checklist items, owner questions
  db.ts                  IndexedDB + localStorage persistence
  utils/
    geo.ts               Distance math, Google Maps link helpers/parser
    overpass.ts           OpenStreetMap POI/road fetch + categorisation
    scoring.ts            Transparent 0-100 score + explanation
    export.ts             JSON/CSV export, printable report
  components/
    LocationCapture.tsx    GPS capture button, error states, Maps-URL fallback
    MapView.tsx             Leaflet map render
    MapIntelligence.tsx     Auto POI analysis + quick Google Maps searches
    SiteChecklist.tsx       Your own on-site observations (not owner-facing)
    OwnerQuestions.tsx      Owner due-diligence Q&A (kept separate, plain wording)
    PriceData.tsx           Price/area entry + per-sqft/guntha calc
    PhotoEvidence.tsx       Photo capture (resized client-side before storing)
    Notes.tsx               General notes
    FinalStatus.tsx         Score display + manual status override
    PropertyList.tsx        Saved properties screen
    PropertyHeader.tsx      Per-property action bar (maps link, share, export)
    Settings.tsx            Storage info, export all, delete all
  App.tsx                  Navigation shell (New Visit / Saved / Settings)
```

## What was tested

- `npx tsc --noEmit` — clean, no type errors
- `npx vite build` — production build succeeds (~350KB JS, ~12KB CSS)
- Not yet tested: actual GPS permission flow, Overpass query results, or
  photo capture on a real device/browser — do this after first deploy.

## Known limitations (read before relying on this in the field)

1. **Overpass is a free, best-effort public service.** It rate-limits and
   occasionally goes down. The app tries two mirror endpoints before
   reporting failure, but if you're checking 40 shops/plots a day, you may
   want to add a paid POI API (Google Places, Mapbox) if reliability becomes
   a problem — that's a real risk, not a hypothetical one.
2. **Straight-line distance only.** "Nearest road: 220m" is a straight line,
   not a walking/driving distance. Labeled as such everywhere in the UI/export.
3. **OSM data completeness varies by area.** Rural/newly-developed plots in
   Pune's outskirts may have sparse OSM tagging — the app says "not found in
   searched radius," never "does not exist," but you should still physically
   verify.
4. **Photos are stored as base64 inside the property JSON record.** Fine for
   normal use (resized to max 1280px, ~70% JPEG quality), but a property with
   30+ photos will bloat the exported JSON. No cloud backup exists — back up
   via Settings → Export regularly if the phone could be lost/reset.
5. **Score is explicitly not a valuation.** It only reflects your own
   checklist answers and OSM map signals — see the disclaimer baked into the
   UI and every exported report.
