<picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/dark/header.svg"/><img src="docs/readme/header.svg" alt="Roam — AI trip planner"/></picture>

<div align="center">

<a href="https://github.com/J33rry/TripPlanner"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/REPO-0d1117?style=flat-square&logo=github&logoColor=ffffff"/><img src="https://img.shields.io/badge/REPO-ffffff?style=flat-square&logo=github&logoColor=000000" alt="Repo"/></picture></a>
<a href="#setup"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/SETUP-0d1117?style=flat-square&logo=npm&logoColor=ffffff"/><img src="https://img.shields.io/badge/SETUP-ffffff?style=flat-square&logo=npm&logoColor=000000" alt="Setup"/></picture></a>
<a href="#reliability"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/RELIABILITY-0d1117?style=flat-square&logo=zod&logoColor=ffffff"/><img src="https://img.shields.io/badge/RELIABILITY-ffffff?style=flat-square&logo=zod&logoColor=000000" alt="Reliability"/></picture></a>
<a href="#process"><picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/AI%20USAGE-0d1117?style=flat-square&logo=claude&logoColor=ffffff"/><img src="https://img.shields.io/badge/AI%20USAGE-ffffff?style=flat-square&logo=claude&logoColor=000000" alt="AI usage"/></picture></a>

</div>

<br>

<a id="overview"></a>
<picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/dark/s01.svg"/><img src="docs/readme/s01.svg" alt="01 overview"/></picture>

Roam is an AI trip planner. Spin the globe, describe a trip in your own words, and Roam
dives from the globe into a **map of your itinerary** — a day-by-day plan you can expand,
edit, **reorder, remove and refine**. The model never talks to you directly: it returns
**strict JSON**, which is repaired, validated and rendered as interactive UI.

```
input     free-form text — "4 relaxed days in lisbon with great food"
model     groq · openai/gpt-oss-120b · strict json schema
pipeline  guardrail → generate → repair → zod → interactive ui
edit      expand · inline edit · drag to reorder · remove · refine
saved     browser-local · 10 trips · a url per trip
```

<br>

<a id="stack"></a>
<picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/dark/s02.svg"/><img src="docs/readme/s02.svg" alt="02 stack"/></picture>

<div align="center">

<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/Next.js%2016-0d1117?style=flat-square&logo=nextdotjs&logoColor=ffffff"/><img src="https://img.shields.io/badge/Next.js%2016-ffffff?style=flat-square&logo=nextdotjs&logoColor=000000" alt="Next.js 16"/></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/React%2019-0d1117?style=flat-square&logo=react&logoColor=ffffff"/><img src="https://img.shields.io/badge/React%2019-ffffff?style=flat-square&logo=react&logoColor=000000" alt="React 19"/></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/JavaScript-0d1117?style=flat-square&logo=javascript&logoColor=ffffff"/><img src="https://img.shields.io/badge/JavaScript-ffffff?style=flat-square&logo=javascript&logoColor=000000" alt="JavaScript"/></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/Groq-0d1117?style=flat-square&logoColor=ffffff"/><img src="https://img.shields.io/badge/Groq-ffffff?style=flat-square&logoColor=000000" alt="Groq"/></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/Zod-0d1117?style=flat-square&logo=zod&logoColor=ffffff"/><img src="https://img.shields.io/badge/Zod-ffffff?style=flat-square&logo=zod&logoColor=000000" alt="Zod"/></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/Google%20Maps-0d1117?style=flat-square&logo=googlemaps&logoColor=ffffff"/><img src="https://img.shields.io/badge/Google%20Maps-ffffff?style=flat-square&logo=googlemaps&logoColor=000000" alt="Google Maps"/></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/dnd%20kit-0d1117?style=flat-square&logoColor=ffffff"/><img src="https://img.shields.io/badge/dnd%20kit-ffffff?style=flat-square&logoColor=000000" alt="dnd kit"/></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/Tailwind%20CSS-0d1117?style=flat-square&logo=tailwindcss&logoColor=ffffff"/><img src="https://img.shields.io/badge/Tailwind%20CSS-ffffff?style=flat-square&logo=tailwindcss&logoColor=000000" alt="Tailwind CSS"/></picture>

</div>

<br>

<a id="setup"></a>
<picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/dark/s03.svg"/><img src="docs/readme/s03.svg" alt="03 setup"/></picture>

```bash
npm install
cp .env.example .env.local     # then add your GROQ_API_KEY
npm run dev                    # http://localhost:3000
```

For a production build: `npm run build && npm start`.

| variable | required | purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | yes | server-side access to Groq for generation, refinement and guardrails |
| `GROQ_MODEL` | no | override the generation model — defaults to `openai/gpt-oss-120b` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | for the map | browser key for the Maps JavaScript API, which draws the trip map; without it trips open with a "map couldn't load" notice |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | no | a Google Cloud map ID for custom map styling — defaults to Google's `DEMO_MAP_ID` |
| `GOOGLE_MAPS_API_KEY` | no | server key for Google Places API (New), used for [place grounding](#reliability), and the Routes API, which draws map legs along streets; without it Roam plans from the model's own knowledge and routes with OpenStreetMap |
| `PLACE_GROUNDING` | no | set to `off` to disable place grounding even when a Google key is present |
| `GOOGLE_ROUTING` | no | set to `off` to route with OpenStreetMap even when a Google key is present |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | to save trips | Appwrite project for accounts (email + Google) and saved trips; without it anyone can still plan trips, but saving is off |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | no | defaults to `https://cloud.appwrite.io/v1`; set it to your region's endpoint (e.g. `https://fra.cloud.appwrite.io/v1`) |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` / `NEXT_PUBLIC_APPWRITE_TRIPS_TABLE_ID` | no | where trips are stored — default `roam` / `roam_trips`; pick IDs no other app uses if the database is shared |
| `APPWRITE_API_KEY` | setup only | server key used once by `npm run setup:appwrite`; never shipped to the browser |

`GROQ_API_KEY` and `GOOGLE_MAPS_API_KEY` are only read on the server, by [`app/api/generate/route.js`](app/api/generate/route.js) and the `lib/` modules it uses. The `NEXT_PUBLIC_` values are built into the browser bundle, so use a separate browser key restricted to the **Maps JavaScript API** and your site's addresses (e.g. `http://localhost:3000/*`), and keep the server key restricted to **Places API (New)** and **Routes API**. Never commit `.env.local`.

**Accounts (Appwrite).** Anyone can plan trips; saving one asks you to log in (and saves it right after, even through the Google redirect). To turn it on:

1. Create a project at [cloud.appwrite.io](https://cloud.appwrite.io) and add a **Web** platform with hostname `localhost` (plus your production domain).
2. Under **Auth → Settings**, enable **Google**: paste a Google OAuth client ID/secret, and add the redirect URI Appwrite shows to that client in Google Cloud.
3. Put the project ID (and endpoint) in `.env.local`, create an API key with the databases/tables/columns write scopes, then run `APPWRITE_API_KEY=… npm run setup:appwrite` to create the `roam_trips` table. Rows are private to the account that saved them.

Trips saved in the browser before accounts existed are moved into the first account that logs in on that browser. Each saved trip also stores its map routes (the `routes` column), so reopening it draws streets instantly without asking the routing service again; only legs that changed are fetched. If you created the table before this column existed, run `npm run setup:appwrite` again to add it.

Within Google's free monthly allowances (10,000 map loads for Dynamic Maps, 5,000 Nearby Search Pro calls), a personal project costs nothing; setting daily quota caps on both APIs in Google Cloud makes sure of it.

| script | what it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm start` | serve the production build |
| `npm run lint` | run ESLint |
| `npm run setup:appwrite` | create the Appwrite database and `roam_trips` table (idempotent; refuses to touch a table it didn't make) |
| `npm run gen:land-mask` | regenerate `lib/landMask.js`, the globe's land-dot bitmask, from Natural Earth data |

<br>

<a id="features"></a>
<picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/dark/s04.svg"/><img src="docs/readme/s04.svg" alt="04 features"/></picture>

| feature | what it does |
| --- | --- |
| `itinerary panel` | day cards, place photos, inline editing, done/remove menu, drag-and-drop reordering of activities and days, packing list and tips |
| `place grounding` | with a Google key, the planner builds each day from real, popular places near the destination, and their pins use Google's coordinates |
| `refine` | follow-up prompts ("make day 2 more relaxed") edit the existing plan instead of regenerating it |
| `trip map` | numbered pins per activity and a line per leg in its travel mode — walking, cycling, metro & tram, bus, driving, train, ferry or flight — each with its own colour and pattern (dotted walks, rail-tie train lines, great-circle flight arcs). Walking, cycling, driving and bus legs follow real streets; travel days draw the journey from the previous city. A legend lists the modes in view with line-icon badges, distance and time, and map ⇄ list hover sync |
| `dotted globe` | real coastlines as a 1° dot grid, auto-spin, drag to rotate, orbit rings, flight arcs and destination markers |
| `thinking state` | while a plan generates, the land dots leave their continents and swirl into a pulsing orb, then flow back on success, error or cancel |
| `globe → map` | the globe turns to the destination and dives in until its curve is nearly flat; a Google map loads at exactly the matching scale, crossfades in and flies down to street level on a Google Earth-style zoom curve |
| `saved trips` | browser-local saving (ten kept), a searchable `/trips` page with globe markers, and a page per trip at `/trips/[id]` that survives reloads and Back/Forward |
| `persistent shell` | the globe lives in [`RoamShell`](components/RoamShell.js), rendered by the layout, so Home ⇄ Trips glides one globe instead of remounting it |
| `responsive` | side panel on desktop, bottom sheet on phones, reduced-motion aware |

<br>

<a id="reliability"></a>
<picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/dark/s05.svg"/><img src="docs/readme/s05.svg" alt="05 reliability"/></picture>

The model is treated as an unreliable source. Every failure mode ends in a readable error with a retry — never a crash, never a stale plan.

| failure | handling |
| --- | --- |
| `malformed json` | strict JSON-schema output where the model supports it; otherwise [`parseResponse`](lib/parseResponse.js) tries direct parse → strip code fences → extract the object → drop trailing commas → close truncated brackets |
| `wrong shape` | [`schema.js`](lib/schema.js) validates with Zod — optional fields get defaults, unknown activity types fall back to `activity`, and only truly missing structure (no days, no title) fails with the exact field paths |
| `hallucinated places` | with place grounding on, activities picked from the candidate list are snapped to Google's coordinates (see below) |
| `hallucinated coordinates` | missing, `0,0`, out-of-range, or more than 3,000 km from the destination are dropped instead of pinned |
| `empty response` | `502` with a retry |
| `groq json check failed` | retried once on the server, then a friendly `502` |
| `slow / superseded` | an `AbortController` plus a request id in [`useGenerateTrip`](hooks/useGenerateTrip.js) — a newer request or a cancel discards the older response, even mid-parse |
| `rate limit / network / offline` | specific messages for `429`, connection failures and `navigator.onLine === false` |
| `render crash` | an [`ErrorBoundary`](components/ErrorBoundary.js) around the itinerary with a reset |

The error banner shows the message, the validation details and a collapsible **raw AI response**, so a bad answer is inspectable rather than invisible.

**Guardrails** — Roam only plans travel. Every request to `/api/generate` passes through [`lib/guardrails.js`](lib/guardrails.js):

1. **Deterministic limits** — empty text, more than 1,000 characters, or text with no letters is rejected without a model call; refinements must carry a reasonably sized itinerary.
2. **Policy classifier** — `openai/gpt-oss-safeguard-20b` labels the text `travel`, `off_topic`, `prompt_injection` or `harmful` against a written policy, as strict JSON. It runs **in parallel** with generation (or, with place grounding, with place extraction), so allowed requests don't wait; any other verdict aborts the generation. If the check can't run, the request fails closed.
3. **Hardened prompts** — the planner treats the user's text as data, never as instructions.

Rejections return `422` with `code: "guardrail"` and a fixed, friendly message (never model-written), shown as a gentle notice rather than an error.

**Place grounding** — when `GOOGLE_MAPS_API_KEY` is set, the model picks from real places instead of inventing them ([`lib/placeCandidates.js`](lib/placeCandidates.js), [`lib/googlePlaces.js`](lib/googlePlaces.js)):

1. **Where** — `openai/gpt-oss-20b` names up to three cities or areas the trip covers, with their coordinates (for "a week in Japan", the main cities). It runs alongside the guardrail check.
2. **What's there** — once the guardrail passes, Google Places **Nearby Search** runs two searches per area — one for sights and outdoor spots, one for food — ranked by popularity, all in parallel with a 5 s budget. Results are deduplicated, capped (about 30 sights, 8 outdoor, 12 food) and shared round-robin across areas.
3. **Plan** — the candidates go to the planner as a numbered list (`c7 | Belém Tower | historical place | Lisbon | 38.692,-9.216`). Each activity returns a `placeId`; the server snaps matched activities to Google's coordinates and name, and anything off-list (hotels, transport, walks) keeps the model's coordinates and the usual checks.
4. **Refine** — follow-ups search around clusters of the trip's existing stops, so "add a vegetarian dinner" also draws on real places.

Groq's free tier counts each request as its prompt plus about 5,000 reserved reply tokens against an 8,000 tokens-per-minute limit, so prompts are kept under about 2,800 tokens: refinements send the trip as compact JSON, and the candidate list is trimmed to fit (keeping the mix of sights, outdoors and food) — a long trip being refined may get only a handful of candidates.

Grounding is best-effort: with no key, `PLACE_GROUNDING=off`, an error, a timeout or no results, Roam plans exactly as before and logs why. It adds one small Groq call and typically under a second before generation starts. To stay in the free tier, requests ask only for Pro-tier fields (id, name, location, types — no ratings, photos or reviews); Nearby Search Pro includes 5,000 free calls a month, and a trip uses 2–6.

<br>

<a id="limits"></a>
<picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/dark/s06.svg"/><img src="docs/readme/s06.svg" alt="06 limits"/></picture>

- Without a Google key, place coordinates come from the AI. Obviously wrong ones are dropped, but pins can still be slightly off. Even with grounding, Roam does not check opening hours or prices.
- Trips saved before map support have no coordinates; they open on a world map until refined.
- Photos are matched by Wikipedia article title, so some places show an illustrated fallback instead.
- Saved trips live in this browser's local storage and are not synced.
- Strict JSON-schema output is used for `openai/gpt-oss-*` models; other models fall back to JSON mode, which leans harder on the repair step.
- Results are not streamed — the thinking animation covers the wait.

External services other than Google Maps Platform are free and keyless, and none of them receive the Groq key. The routing service is community-run and best-effort, so the app falls back to straight-line routes and illustrated thumbnails when it or Wikipedia is down.

| service | used for | called from |
| --- | --- | --- |
| [`Google Maps JavaScript API`](https://developers.google.com/maps/documentation/javascript) | the trip map, pins and route lines (vector map, animated with `moveCamera`) | browser, [`components/TripMap.js`](components/TripMap.js) |
| [`Google Routes API`](https://developers.google.com/maps/documentation/routes) | walking, cycling and driving routes (needs the server key; legs are split at 10 intermediate stops to stay on the Essentials tier — 10,000 free calls a month) | server proxy [`app/api/directions/route.js`](app/api/directions/route.js) |
| [`FOSSGIS OSRM`](https://routing.openstreetmap.de/about.html) | fallback router when there's no Google key or Google fails (at most three requests at a time, one retry) | server proxy [`app/api/directions/route.js`](app/api/directions/route.js) |
| [`Wikipedia API`](https://www.mediawiki.org/wiki/API:Main_page) | place and destination photos | browser, [`hooks/usePlaceImages.js`](hooks/usePlaceImages.js) |
| [`Google Places API (New)`](https://developers.google.com/maps/documentation/places/web-service/nearby-search) | candidate places for grounding (optional, needs a key) | server, [`lib/googlePlaces.js`](lib/googlePlaces.js) |

<br>

<a id="process"></a>
<picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/dark/s07.svg"/><img src="docs/readme/s07.svg" alt="07 process"/></picture>

```
ai        claude, via claude code
time      about 8 hours
```

**AI usage** — Most of this codebase was written by AI (Claude, via Claude Code), directed and reviewed by me. Architecture decisions (the guardrail pipeline, prompt structure, JSON-repair and validation strategy, globe and map rendering), component boundaries and debugging happened in an iterative loop where I set the direction and reviewed and tested each change, rather than writing most lines by hand. I can walk through and explain any part of it.

**Time spent** — About 8 hours, in line with the assignment's suggested budget.

<br>

<div align="center">

<sub><code>roam · describe it, then make it yours</code></sub>

</div>
