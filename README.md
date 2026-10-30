# Breeding-risk viewer — React version (7.0.0)

Full rewrite of `index.html` (survey-risk-v6) in React + Vite. Same backend, same API calls, same request bodies.
**Deployment links are unchanged**: the default `API_BASE` is still the Cloud Run URL
`https://charis-detection-backend-376770076331.europe-west1.run.app`. Nothing here deploys anything.

## Run it
```bash
npm install
npm run dev          # http://localhost:5173  (uses the Cloud Run backend by default)
npm run build        # writes dist/  -> the static files that replace the old index.html
npm run preview      # serve dist/ locally
```
Local backend: copy `.env.example` to `.env.local` and set `VITE_API_BASE=http://localhost:8010` (never commit `.env.local`).
Hosting: `dist/` is a plain static site (relative paths), so it drops into the same hosting folder as the old `index.html`.

## Version check
The viewer still refuses a backend whose `build_id` differs from its own (default `survey-risk-v6`).
The 15 Oct snapshot notes list the backend `app.py` as `survey-risk-v7`: if you see "Version mismatch",
set `VITE_BUILD_ID` to what the backend reports, then rebuild.

## Structure
```
src/store.js            external store (state), todayStr
src/api.js              API_BASE, build check, JSON helpers, chunked upload (8 MB parts)
src/actions.js          run, rescore, edit (merge/delete/reshape/reclassify), field visits, weight versions, legend
src/mapController.js    all Leaflet code (layers, canvas rendering, selection, popup host, Geoman reshape)
src/lib/weights.js      collect / merge weights, date context, validation
src/lib/scoring.js      colours, risk eligibility, helpers
src/components/         ControlBar, EditTools, SettingsPanel, Legend, SummaryPanel, ParcelPopup, RunOverlay, MapView, NumField
```
React owns the UI and data; Leaflet is driven through one controller, so layers are never re-created by React re-renders.

## What is the same
Chunked upload and progress polling, Run overlay, false-colour / NDVI / NDWI / RGB / LULC layers, water polygons, risk drawn from the
wet-only geometry, class tick-boxes, risk settings (both profiles, month points, vegetation, rice, habitat points), saved weight versions,
merge / delete / reshape / reclassify, popup with breakdown, observations and field-visit form, inspection list, export of field records,
water_pct > 30 % warning, date rules (assessment date on or after flight date).

## What is new
* **Risk summary panel** with three tabs: Overview (parcels, flagged, share, wet area, score histogram, flagged by habitat),
  To check (search, sort, minimum score, click-to-zoom, CSV) and Inspection (the backend's priority list).
* **Upload check** before Run: counts, size, non-.tif files, stack/RGB mismatch.
* **Live cursor coordinates**; the map fits to the data with room left for the control bar.
* **Popup is a React component**: form text and open sections survive re-scoring (the old draft-capture code is gone).
* Control bar and legend are one column, so they never overlap; settings text fields keep what you type.
* Legend colours are known before parcels are drawn (the old viewer drew them once hidden and fixed it on re-score).
* Backend ping is cached for 30 s instead of one ping per request.
* "Save named weight version" uses an inline form instead of two `prompt()` dialogs.
* Entering/leaving Edit mode no longer re-scores every tile.

## Tested (headless Chrome, mocked backend)
Defaults load, date validation, upload + run + overlay, re-score, summary panel, popup from list and from a real map click,
reclassify, observation (popup stays open), field visit save, edit-mode select / merge / delete / reclassify / reshape (Geoman),
class tick-boxes, profile switch, weight-version save and load, inspection tab. Not tested against the real backend or real GeoTIFFs.

## Field-worker restyle (v2 UI)

- Light, high-contrast pine-green theme; 46 px tap targets; phone layout uses a bottom sheet that collapses after a run.
- Control bar is a 4-step flow: Add drone images, Set the dates, Run (with a plain reason when disabled), Review and correct.
- Parcel popup: two score chips (flagged / below threshold), collapsible "Why this score", "Correct what the model got wrong", and "Record a field visit" with inline save errors.
- Results panel: profile switch, Overview / To check / Visit order tabs, habitat filter chips, CSV download.
- Risk settings: grouped sections, "edited (was N)" markers, reset to defaults, "Changes not applied yet" badge, weight versions.
- API contract and element ids used by the tests are unchanged.

## Styling: Tailwind CSS

The UI is styled with Tailwind CSS 3.4 utility classes directly in the JSX.

- `tailwind.config.js` maps theme colours (`pine`, `amber`, `danger`, `ok`, `ink`, `muted`, `surface`, `wash`, `line`) to the CSS variables in `src/styles.css`, so the light and dark token sets still work.
- `src/ui.jsx` holds the shared pieces (`Button` variants, `Card`, `Input`, `Select`, `Lbl`, `Summary`) and `cx()` (`clsx` + `tailwind-merge`) for conditional classes.
- `src/styles.css` now only has the Tailwind directives, the design tokens, base rules and Leaflet's own markup.
- Phone layout uses the `max-sm:` variant (under 640 px).
- After pulling: `npm install` (adds tailwindcss, postcss, autoprefixer, clsx, tailwind-merge).
