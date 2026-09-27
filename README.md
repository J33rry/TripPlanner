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
<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/MapLibre-0d1117?style=flat-square&logo=maplibre&logoColor=ffffff"/><img src="https://img.shields.io/badge/MapLibre-ffffff?style=flat-square&logo=maplibre&logoColor=000000" alt="MapLibre"/></picture>
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

The key is only read by the server route [`app/api/generate/route.js`](app/api/generate/route.js) and never reaches browser code. Never commit `.env.local`.

| script | what it does |
| --- | --- |
| `npm run dev` | dev server (copies the MapLibre worker into `public/vendor/` first) |
| `npm run build` | production build (same copy step) |
| `npm start` | serve the production build |
| `npm run lint` | run ESLint |
| `npm run gen:land-mask` | regenerate `lib/landMask.js`, the globe's land-dot bitmask, from Natural Earth data |

<br>

<a id="features"></a>
<picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/dark/s04.svg"/><img src="docs/readme/s04.svg" alt="04 features"/></picture>

| feature | what it does |
| --- | --- |
| `itinerary panel` | day cards, place photos, inline editing, done/remove menu, drag-and-drop reordering of activities and days, packing list and tips |
| `refine` | follow-up prompts ("make day 2 more relaxed") edit the existing plan instead of regenerating it |
| `trip map` | numbered pins per activity, per-day street routes (walking in a city, driving between spread-out stops, straight lines for long hops or when routing fails), route legend with distance and time, map ⇄ list hover sync |
| `dotted globe` | real coastlines as a 1° dot grid, auto-spin, drag to rotate, orbit rings, flight arcs and destination markers |
| `thinking state` | while a plan generates, the land dots leave their continents and swirl into a pulsing orb, then flow back on success, error or cancel |
| `globe → map` | the globe turns to the destination and dives in; a real map loads at the matching scale, crossfades in and flies down to street level |
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
| `hallucinated coordinates` | missing, `0,0`, out-of-range, or more than 3,000 km from the destination are dropped instead of pinned |
| `empty response` | `502` with a retry |
| `groq json check failed` | retried once on the server, then a friendly `502` |
| `slow / superseded` | an `AbortController` plus a request id in [`useGenerateTrip`](hooks/useGenerateTrip.js) — a newer request or a cancel discards the older response, even mid-parse |
| `rate limit / network / offline` | specific messages for `429`, connection failures and `navigator.onLine === false` |
| `render crash` | an [`ErrorBoundary`](components/ErrorBoundary.js) around the itinerary with a reset |

The error banner shows the message, the validation details and a collapsible **raw AI response**, so a bad answer is inspectable rather than invisible.

**Guardrails** — Roam only plans travel. Every request to `/api/generate` passes through [`lib/guardrails.js`](lib/guardrails.js):

1. **Deterministic limits** — empty text, more than 1,000 characters, or text with no letters is rejected without a model call; refinements must carry a reasonably sized itinerary.
2. **Policy classifier** — `openai/gpt-oss-safeguard-20b` labels the text `travel`, `off_topic`, `prompt_injection` or `harmful` against a written policy, as strict JSON. It runs **in parallel** with generation, so allowed requests don't wait; any other verdict aborts the generation. If the check can't run, the request fails closed.
3. **Hardened prompts** — the planner treats the user's text as data, never as instructions.

Rejections return `422` with `code: "guardrail"` and a fixed, friendly message (never model-written), shown as a gentle notice rather than an error.

<br>

<a id="limits"></a>
<picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/dark/s06.svg"/><img src="docs/readme/s06.svg" alt="06 limits"/></picture>

- Place coordinates come from the AI. Obviously wrong ones are dropped, but pins can still be slightly off, and Roam does not verify place names, opening hours or prices.
- Trips saved before map support have no coordinates; they open on a world map until refined.
- Photos are matched by Wikipedia article title, so some places show an illustrated fallback instead.
- Saved trips live in this browser's local storage and are not synced.
- Strict JSON-schema output is used for `openai/gpt-oss-*` models; other models fall back to JSON mode, which leans harder on the repair step.
- Results are not streamed — the thinking animation covers the wait.

External services are free and keyless, and none of them receive the Groq key. The routing and tile services are community-run and best-effort, so the app falls back to straight-line routes and illustrated thumbnails when they are down.

| service | used for | called from |
| --- | --- | --- |
| [`OpenFreeMap`](https://openfreemap.org) | vector map tiles (OpenStreetMap data) | browser, via MapLibre GL |
| [`FOSSGIS OSRM`](https://routing.openstreetmap.de/about.html) | walking and driving routes | server proxy [`app/api/directions/route.js`](app/api/directions/route.js) |
| [`Wikipedia API`](https://www.mediawiki.org/wiki/API:Main_page) | place and destination photos | browser, [`hooks/usePlaceImages.js`](hooks/usePlaceImages.js) |

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
