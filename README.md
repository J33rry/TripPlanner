# Roam

Roam is an AI trip planner built with Next.js 16, React 19, Groq and MapLibre. Spin the globe, describe a trip in your own words, and watch Roam dive from the globe into a map of your itinerary, which you can then edit, reorder and refine.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add a Groq API key to `GROQ_API_KEY`.
3. Start the development server with `npm run dev`.
4. Open [http://localhost:3000](http://localhost:3000).

The API key is read by the server route at `app/api/generate/route.js`; it is not exposed to browser code. Never commit `.env.local`.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | Yes | Server-side access to Groq itinerary generation and refinement. |
| `GROQ_MODEL` | No | Override the Groq model used for generation. Defaults to `openai/gpt-oss-120b`. |

## Current features

- **Dotted globe home screen** (canvas): real coastlines as a 1° dot grid, slow auto-spin, drag to rotate, 3D orbit rings and flight arcs, and London / Paris / India markers with hover cards ("Plan a trip here").
- **AI-orb thinking state**: while a plan is generated the land dots leave their continents and swirl around three axes in a pulsing purple orb, then flow back when the plan arrives (or on error/cancel).
- **Globe → map transition**: the globe turns to face the destination and dives in; a real map is loaded underneath at the exact matching globe scale, crossfades in, and flies down to street level to frame the itinerary.
- **Trip map**: numbered pins for every activity, per-day street routes (walking in a city, driving between spread-out stops, straight lines for long hops or if routing fails), a route legend with distance and time, day focus, and hover/click sync between map and list.
- **Itinerary panel**: day cards, place photos, inline editing, done/remove menu, drag-and-drop reordering of activities and days, packing list, tips, and AI refinement ("Make day 2 more relaxed…").
- Server-side Groq requests with strict JSON-schema output, Zod validation, retry, cancellation/stale-response protection, and structured errors.
- **Trips page** (`/trips`, "Trips" in the navbar): every saved trip with search, a globe marker at each trip's destination (hover a trip to turn the globe to it), and the same globe → map dive when a trip or marker is opened.
- **A page per trip** (`/trips/[id]`): opening a saved trip from Recent trips, the Trips page or a globe marker goes to its own URL, which dives in; Back/Forward, reloads and shared links (in the same browser) work too. Saving a fresh plan moves it to its page. Home ⇄ Trips gives the globe a little spin as it glides.
- Browser-local trip saving, reopening and deletion (five on the home screen, all on the Trips page, ten kept).
- The globe, intro and open trip live in a persistent shell (`components/RoamShell.js`, rendered by `app/layout.js`), so moving between Home and Trips keeps the same globe and just glides it to the new framing.
- Responsive (side panel on desktop, bottom sheet on phones) and reduced-motion aware.

## External services

All are free and keyless; none receive the Groq key.

| Service | Used for | Called from |
| --- | --- | --- |
| [OpenFreeMap](https://openfreemap.org) | Vector map tiles (OpenStreetMap data) | Browser, via MapLibre GL |
| [FOSSGIS OSRM](https://routing.openstreetmap.de/about.html) | Walking/driving routes | Server proxy `app/api/directions/route.js` |
| [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page) | Place and destination photos | Browser (`hooks/usePlaceImages.js`) |

The routing and tile services are community-run and best-effort; the app falls back to straight-line routes and illustrated thumbnails when they are unavailable. For production traffic, move to a provider with an SLA.

## Known limitations

- Place coordinates come from the AI. Obviously wrong ones are dropped (missing, 0,0, or more than 3,000 km from the destination), but pins can still be slightly off, and Roam does not verify place names, opening hours or prices.
- Trips saved before map support have no coordinates; they open on a world map until refined.
- Photos are matched by Wikipedia article title, so some places show an illustrated fallback instead.
- Saved trips stay in the current browser's local storage and are not synced.
- Trip generation requires a valid Groq API key and network access; strict JSON-schema output is used for `openai/gpt-oss-*` models, other models fall back to JSON mode.

## Scripts

- `npm run dev` — local development server (copies the MapLibre worker into `public/vendor/` first).
- `npm run build` — production build (same copy step).
- `npm run start` — serve the production build.
- `npm run lint` — run ESLint.
- `npm run gen:land-mask` — regenerate `lib/landMask.js`, the globe's land-dot bitmask, from Natural Earth data.
