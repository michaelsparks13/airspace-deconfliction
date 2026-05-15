# airspace-deconfliction — 3D fire-airspace prototype

A standalone browser prototype that explores improved 3D support for airspace deconfliction over wildland fires — the kind of capability a public-safety SA tool like CloudTAK would want. Aircraft render at their true MSL altitude over real terrain, AGL is computed from the live DEM, and pairs that violate separation minima are surfaced in 3D and in a side panel.

Sibling to [`etl-nws-alerts`](../etl-nws-alerts) in this `co-coe` interview portfolio for the dfpc-coe (Colorado Center of Excellence).

---

## Section 1 — One-minute pitch

> "I built `airspace-deconfliction` — a Vite + Vue 3 prototype that puts aircraft at their **real altitude** over 3D terrain, computes AGL against a terrarium-encoded DEM, and flags separation conflicts pairwise. The interesting wrinkle is that current TAK-family tools render aircraft as flat icons on a 2D map, even when you're stacking a Type 1 helicopter at 300 ft AGL, a tanker on a retardant run at 150 ft, and a fixed-wing recon at 2,500 ft over the same drainage. Operators have to read off a numeric altitude column and form the picture in their head. This prototype shows what the 3D version would look like — including a TFR cylinder, AGL color-bands, conflict pulses, and an offline mode so you can demo it on a plane. Replay scenario is fictional and engineered to fire the conflict UI around T+44 s; live mode is a real OpenSky integration over a wilderness bbox where you'll usually see zero aircraft, but the wiring's all there."

That's the elevator pitch. Everything below is what to say when they drill in.

---

## Section 2 — Architecture in one diagram (in your head)

```
   Replay JSON  ──┐
   (scripted)     │
                  ├──► useAircraftStore  ──►  reactive Aircraft[]  ───────►  AircraftLayer  (three.js CustomLayer)
                  │     (computed from              │                        SidePanel       (queryTerrainElevation
   OpenSky API ──┘      current mode)               │                        ConflictBanner   per-aircraft → AGL)
   (live mode)                                      │
                                                    ▼
                                            useDeconfliction
                                            (haversine + Δalt
                                            pairwise, pure)
                                                    │
                                                    ▼
                                            ConflictPair[]   ───►  AircraftLayer (red pulse + 3D dashed line)
                                                                   ConflictBanner (DOM alert)
                                                                   SidePanel      (row flash)
```

**Layered map stack (bottom → top):**

1. CARTO Dark Matter raster basemap (no-labels variant).
2. MapLibre `hillshade` derived from a terrarium-encoded `raster-dem` source.
3. Custom curated POI markers (towns + named peaks) — DOM via `maplibregl.Marker`.
4. Fire perimeter — semi-transparent fill + brighter outline (MapLibre fill/line).
5. TFR custom layer — translucent extruded prism (`three.js`, its own GL scene).
6. Aircraft custom layer — fleet meshes + halos + stems + conflict viz (`three.js`).

Two `CustomLayerInterface` layers means two three.js scenes sharing the MapLibre GL context. Both apply the same matrix composition: MapLibre projection × translate(originMercator) × scale(s, -s, s), where `s = originMercator.meterInMercatorCoordinateUnits()`, atop a scene that's been pre-rotated so its local axes are (east, up, north) in meters.

---

## Section 3 — Conventions & conscious deviations

- **Vite + Vue 3 + TypeScript, `<script setup>` Composition API.** Matches the rest of `co-coe` (TS-only, ESM). No Pinia (state lives in module-scoped composables), no router (single view), no UI framework (hand-rolled CSS keeps the tactical aesthetic from sliding toward Material).
- **`src/config.ts` is the single source of truth** for every threshold and tunable — separation minima, AGL bands, TFR ceiling, replay rate, OpenSky poll interval, demo bbox, tile sources. Changing any rule is a one-file edit.
- **Internal math is SI:** meters, m/s, radians. `src/geo/units.ts` is the *only* place feet, knots, and nm appear. UI strings format on the way out.
- **Replay and Live adapters expose the same `Aircraft[]` shape.** Renderer + deconfliction + TFR-test code never branches on data source. `useAircraftStore.aircraft` is a computed ref that switches based on `mode`.
- **`src/aircraft/AircraftLayer.ts` owns the matrix math once.** Every aircraft is positioned in scene-local meters from a fixed scenario-center origin; the camera matrix is composed once per frame.
- **Tradeoff we made explicit:** the bundled offline tile pack (`public/tiles/`, 39 MB) is a derived artifact — it's gitignored and produced by `npm run fetch-tiles`. The script (`scripts/fetch-tiles.ts`) is source-of-truth; the tiles are reproducible. The `useLocal` flag in `config.ts` flips between local and remote sources without touching `setupMap.ts`.

---

## Section 4 — Data sources & their limits

| Source | Use | Limit / caveat |
|---|---|---|
| AWS Public Datasets — terrarium DEM (`elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png`) | 3D terrain mesh + `queryTerrainElevation` for AGL | Public-domain, no key. AGL accuracy ≈ terrain tile resolution (~30 m at zoom 13). |
| CARTO Dark Matter (`basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png`) | Muted basemap | CC-BY, redistributable with attribution. |
| Hand-curated POIs (`src/map/places.ts`) | Town + peak labels | Population-scaled raster labels (Montrose dominant over Silverton) didn't read tactically — replaced with DOM markers. |
| `src/data/mock-san-juans-fire.json` | 90 s replay scenario | Generated by `scripts/generate-scenario.ts`; engineered conflict at T+44 ± 4 s. |
| OpenSky `/states/all` | Live mode | Wilderness bbox usually returns 0 aircraft. Anonymous rate limits tightened in 2024 — 10 s polling fits but is on the edge; OAuth client-credentials would lift the cap. |

---

## Section 5 — What is real vs. faked

| Real | Faked |
|---|---|
| Terrain elevations (terrarium DEM) | Fire perimeter polygon |
| `queryTerrainElevation` → AGL | TFR boundary (= perimeter polygon; real TFRs are usually circular with buffer mileage) |
| `MercatorCoordinate.fromLngLat([lng,lat], alt_m)` + meter-scale matrix math | The 5-aircraft scenario (callsigns, tracks, timing) |
| Haversine separation | Aircraft category in live mode (OpenSky doesn't tell us tanker vs scout) |
| OpenSky integration (real fetch, real state-vector decode) | Engineered conflict at T+44s |
| All thresholds match real-world operational minima (1 nm / 500 ft) | |

Aircraft *categories* (Type 1 helo, air tanker, ATGS, sheriff UAS) are real fire-aviation roles; the *callsigns* aren't real.

---

## Section 6 — This is a prototype — scope

Out of scope:

- No actual TAK/CoT output (`etl-nws-alerts` covers that part of the portfolio).
- No real-time ADS-B ingestion beyond OpenSky's 10 s `/states/all` polling.
- No persistence — page reload starts fresh.
- One fire, one TFR. No multi-incident support.
- No predicted closest-approach (TCAS-like). Current-state only.
- No mobile / touch tuning, no a11y audit beyond reasonable contrast.

---

## Section 7 — What production would need

If this graduated from "interview-portfolio prototype" to "thing CloudTAK actually ships":

1. **Bidirectional CoT.** Aircraft state in and conflict events out, so the same picture mirrors into ATAK/WinTAK on the ground.
2. **Persistent track storage.** Per-aircraft 4D history with on-disk retention, replay over arbitrary time windows.
3. **Hardware-clock-synced timeline.** Multi-source data (ADS-B + ATC + dispatch + on-aircraft GPS) doesn't tick at one frequency; current code naïvely assumes synchronized wall-clock samples.
4. **FAA TFR feed.** Real NOTAM ingestion (FAA's NOTAM API) instead of a hand-edited GeoJSON, with TFR shapes parsed from the `Action` text (it's still freeform).
5. **Terrain-following TFR ceiling.** Real wildfire restrictions are often stated as "X ft AGL", which means the top contour follows terrain. The current ceiling is flat MSL.
6. **Predicted closest-approach.** Lookahead pairwise: based on current `(lat, lon, alt, vel, vrate, heading)`, project N seconds forward and trigger before separation goes red. TCAS RA-style.
7. **Per-aircraft conflict acknowledgment.** Right now conflicts auto-clear when separation grows. Operationally you want a dispatcher to ack each one.
8. **Auth.** Certificate-pinned API client + TAK Server registration if live data is ingested into the operational network.
9. **Spatial indexing.** O(n²) pairwise check is fine at 5 aircraft; at 500 you want a uniform grid or k-d tree to keep latency bounded.

---

## Section 8 — How to run

Requirements: Node 24+, npm 10+.

```bash
npm install
npm run fetch-tiles      # ~12 s, downloads 711 × 2 tiles into public/tiles/
npm run dev              # http://localhost:5173/
```

After `fetch-tiles` runs once, the demo runs **fully offline** — replay mode loads the bundled JSON, the basemap and DEM are local, the place labels are DOM (no remote glyphs). Live mode obviously still needs network.

Other tasks:

```bash
npm run generate-scenario   # rewrites src/data/mock-san-juans-fire.json
npm run typecheck           # vue-tsc --noEmit
npm run build               # vite production build
npm run preview             # serve dist/
```

---

## Section 9 — Deploy

Coming with slice 10: `netlify.toml` + `vercel.json`. Replace the placeholders once live:

- Netlify: _(link to be added)_
- Vercel: _(link to be added)_

Both deploys ship `dist/` plus the bundled tile pack from `public/tiles/`. The OpenSky live mode works from a deployed origin (no CORS shim required).

---

## Section 10 — Talking points if they drill in

Three or four ready prompts:

- **"Walk me through the matrix math for placing an aircraft at MSL altitude over moving 3D terrain."** → `MercatorCoordinate.fromLngLat([lng,lat], alt_m)` gives you the scene origin in Mercator units; `meterInMercatorCoordinateUnits()` gives you the meters→Mercator scale; compose `mapProj × translate(origin) × scale(s,-s,s)` and you can place meshes in real meters relative to that origin. The Y-negation in the matrix combined with the scene's pre-rotation puts scene-local axes at (east, up, north). See `src/aircraft/AircraftLayer.ts` lines ~125 and ~250.
- **"How do you handle a null return from `queryTerrainElevation`?"** → It returns `null` before terrain tiles for that lng/lat have loaded. Per-aircraft `lastAgl` cache, fall back to the cached value, hide the ground stem if there's never been a valid AGL. Otherwise the halo color would flicker grey-then-correct on every pan/zoom.
- **"Why compute AGL from `MSL − terrain` rather than trusting the aircraft's reported AGL?"** → ADS-B reports baro_altitude (pressure altitude, MSL-ish), not AGL. Even radar altimeters on the aircraft don't surface in standard tracking feeds. AGL is implicitly a relationship between the aircraft and a piece of geometry under it — computing it locally against the DEM means the same source-of-truth as the visualization.
- **"If this were ingesting 500 aircraft instead of 5, what's the first thing that breaks?"** → The O(n²) pairwise loop in `detectConflicts` (125,000 pair checks per snapshot, 60 Hz of that = ~7.5M ops/s — fine actually). What breaks first is the `queryTerrainElevation` cost in `AircraftLayer.render` — that's a per-aircraft tile lookup at 60 Hz, and 500 of them would dominate. The fix is to throttle terrain lookups to ~5 Hz (the same throttle the SidePanel already uses for the AGL display) and interpolate between samples.

---

*This README, the codebase, and the scenario are a portfolio piece. Any resemblance to real CO incidents, callsigns, or operational deployments is coincidental.*
