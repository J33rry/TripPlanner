import "server-only";
import { Query } from "node-appwrite";
import { APPWRITE } from "./appwrite";
import { ADMIN_TABLES, adminServices } from "./adminStore";
import { count, utcDay } from "./metrics";

// Keeps Google Maps Platform usage inside its free monthly allowances. Each SKU
// has its own free cap per billing account per month (Essentials 10,000, Pro
// 5,000), so every call is counted in the metrics table as google.<sku>, and once
// a SKU reaches its share of the cap the app stops calling it until the month
// turns (UTC): routing falls back to OpenStreetMap, trips plan without place
// grounding, and the trip map isn't shown. Counts are best effort (lib/metrics.js)
// and each server process re-reads the month's total once a minute, so the cap
// stops short of the full allowance: GOOGLE_FREE_TIER_CAP is the percentage to
// stop at (default 90), or "off" to count without stopping.
//
// Without APPWRITE_ADMIN_API_KEY nothing is tracked, so nothing is stopped either.
export const GOOGLE_SKUS = {
  maps_load: { name: "Dynamic Maps", api: "Maps JavaScript API", free: 10_000, use: "trip map loads", paused: "map hidden" },
  places_text: { name: "Text Search Pro", api: "Places API (New)", free: 5_000, use: "locating towns", paused: "no grounding" },
  places_nearby: { name: "Nearby Search Pro", api: "Places API (New)", free: 5_000, use: "nearby popular places", paused: "no grounding" },
  routes: { name: "Compute Routes Essentials", api: "Routes API", free: 10_000, use: "street routing", paused: "OpenStreetMap routes" },
};
const SKUS = Object.keys(GOOGLE_SKUS);
const DEFAULT_CAP_PERCENT = 90;
const REFRESH_MS = 60_000;

const metricName = (sku) => `google.${sku}`;
const blockedName = (sku) => `google.${sku}.blocked`;
const thisMonth = () => utcDay().slice(0, 7);
const zero = () => Object.fromEntries(SKUS.map((sku) => [sku, 0]));

/** The percentage of each free allowance to stop at, or null when capping is off. */
export function capPercent() {
  const setting = process.env.GOOGLE_FREE_TIER_CAP?.trim();
  if (setting === "off") return null;
  const percent = setting ? Number(setting) : DEFAULT_CAP_PERCENT;
  return Number.isFinite(percent) && percent >= 0 ? Math.min(percent, 100) : DEFAULT_CAP_PERCENT;
}

const limitFor = (sku, percent = capPercent()) =>
  percent == null ? Infinity : Math.floor((GOOGLE_SKUS[sku].free * percent) / 100);

// The month's counts as last read, plus calls this process has counted since that read began.
let usage = null;
let local = zero();
let refreshing = null;
let lastWarning = 0;

async function readMonth(tables, month) {
  const used = zero();
  const blocked = zero();
  const { rows } = await tables.listRows({
    databaseId: APPWRITE.databaseId,
    tableId: ADMIN_TABLES.metrics,
    queries: [
      Query.greaterThanEqual("day", `${month}-01`),
      Query.equal("metric", SKUS.flatMap((sku) => [metricName(sku), blockedName(sku)])),
      Query.select(["metric", "count"]),
      Query.limit(500), // at most 31 days × 8 metrics
    ],
    total: false,
  });
  for (const row of rows) {
    const [, sku, kind] = row.metric.split(".");
    (kind === "blocked" ? blocked : used)[sku] += row.count;
  }
  return { used, blocked };
}

async function currentUsage() {
  const tables = adminServices()?.tables;
  if (!tables) return null;
  const month = thisMonth();
  if (usage?.month !== month) {
    usage = { month, used: zero(), blocked: zero(), read: false, at: 0 };
    local = zero();
  }
  if (Date.now() - usage.at > REFRESH_MS) {
    refreshing ??= (async () => {
      // Calls counted from here on may also land in this read; counting them twice errs on the safe side.
      const sent = local;
      local = zero();
      try {
        usage = { month, ...(await readMonth(tables, month)), read: true, at: Date.now() };
      } catch (err) {
        SKUS.forEach((sku) => { local[sku] += sent[sku]; });
        usage.at = Date.now();
        if (Date.now() - lastWarning > 10 * 60_000) {
          lastWarning = Date.now();
          console.warn("Google quota: couldn’t read this month’s usage —", String(err?.message ?? err).slice(0, 200));
        }
      } finally {
        refreshing = null;
      }
    })();
    await refreshing;
  }
  return usage;
}

const used = (state, sku) => state.used[sku] + local[sku];

/** Whether each of these SKUs still has free allowance left this month. */
export async function hasFreeQuota(...skus) {
  const percent = capPercent();
  if (percent == null) return true;
  const state = await currentUsage();
  return !state || skus.every((sku) => used(state, sku) < limitFor(sku, percent));
}

/**
 * Counts n calls to a SKU about to be made, or returns false (and makes no
 * count) when they would take it past this month's cap.
 */
export async function claimFreeQuota(sku, n = 1) {
  const percent = capPercent();
  const state = percent == null ? null : await currentUsage();
  if (state && used(state, sku) + n > limitFor(sku, percent)) {
    count(blockedName(sku), n);
    return false;
  }
  count(metricName(sku), n);
  // Only needed for capping; with it off the admin page reads the stored counts.
  if (percent != null) local[sku] += n;
  return true;
}

/** This month's usage per SKU, for the admin page. */
export async function googleUsage() {
  const percent = capPercent();
  const state = await currentUsage();
  return {
    month: thisMonth(),
    tracked: Boolean(state?.read),
    capPercent: percent,
    skus: SKUS.map((sku) => ({
      key: sku,
      ...GOOGLE_SKUS[sku],
      used: state ? used(state, sku) : null,
      blocked: state?.blocked[sku] ?? null,
      limit: limitFor(sku, percent),
    })),
  };
}
