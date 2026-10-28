import "server-only";
import { Query } from "node-appwrite";
import { APPWRITE } from "./appwrite";
import { ADMIN_TABLES, adminServices } from "./adminStore";
import { googleUsage } from "./googleQuota";
import { utcDay } from "./metrics";

export const RANGES = {
  today: { label: "Today", days: 1 },
  "7d": { label: "7 days", days: 7 },
  "30d": { label: "30 days", days: 30 },
  all: { label: "All time", days: null },
};
export const DEFAULT_RANGE = "7d";

const PAGE = 1000;
const MAX_CHART_DAYS = 30;

const dayOffset = (days) => utcDay(new Date(Date.now() - days * 86_400_000));

// One count query; a failure (say, a scope the key lacks) shows as a gap, not a broken page.
async function total(list) {
  try {
    return (await list()).total;
  } catch (err) {
    console.warn("Admin dashboard: a count failed —", String(err?.message ?? err).slice(0, 160));
    return null;
  }
}

async function metricRows(tables, fromDay) {
  const rows = [];
  for (let cursor = null; ; ) {
    const page = await tables.listRows({
      databaseId: APPWRITE.databaseId,
      tableId: ADMIN_TABLES.metrics,
      queries: [
        ...(fromDay ? [Query.greaterThanEqual("day", fromDay)] : []),
        Query.select(["day", "metric", "count"]),
        Query.orderAsc("$id"),
        Query.limit(PAGE),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    });
    rows.push(...page.rows);
    if (page.rows.length < PAGE) return rows;
    cursor = page.rows.at(-1).$id;
  }
}

/** Everything the dashboard shows for a range key (see RANGES). */
export async function loadDashboard(rangeKey) {
  const { tables, users } = adminServices();
  const range = RANGES[rangeKey] || RANGES[DEFAULT_RANGE];
  const fromDay = range.days ? dayOffset(range.days - 1) : null;
  const since = fromDay ? [Query.greaterThanEqual("$createdAt", `${fromDay}T00:00:00.000Z`)] : [];
  const one = [Query.limit(1), Query.select(["$id"])];
  const trips = (queries = []) => () =>
    tables.listRows({ databaseId: APPWRITE.databaseId, tableId: APPWRITE.tripsTableId, queries: [...queries, ...one] });
  const people = (queries = []) => () => users.list({ queries: [...queries, Query.limit(1)] });

  const [counts, metrics, google] = await Promise.all([
    Promise.all([
      total(people()),
      total(people([Query.equal("emailVerification", true)])),
      total(people(fromDay ? [Query.greaterThanEqual("registration", `${fromDay}T00:00:00.000Z`)] : [])),
      total(trips()),
      total(trips(since)),
      total(trips([Query.isNotNull("shareId")])),
      total(trips([Query.isNotNull("teamId")])),
      total(() => tables.listRows({ databaseId: APPWRITE.databaseId, tableId: APPWRITE.expensesTableId, queries: one })),
    ]),
    metricRows(tables, fromDay).catch((err) => {
      console.warn("Admin dashboard: couldn’t read metrics —", String(err?.message ?? err).slice(0, 160));
      return null;
    }),
    googleUsage(),
  ]);
  const [usersTotal, usersVerified, usersNew, tripsTotal, tripsNew, tripsShared, tripsGroup, expenses] = counts;

  const totals = {};
  const daily = new Map();
  for (const row of metrics || []) {
    totals[row.metric] = (totals[row.metric] || 0) + row.count;
    if (/^api\.[^.]+\.requests$/.test(row.metric)) daily.set(row.day, (daily.get(row.day) || 0) + row.count);
  }
  // Every day in the range, quiet days included; "all time" charts the last 30.
  const chartDays = Math.min(range.days || MAX_CHART_DAYS, MAX_CHART_DAYS);
  const series = Array.from({ length: chartDays }, (_, i) => {
    const day = dayOffset(chartDays - 1 - i);
    return { day, requests: daily.get(day) || 0 };
  });

  return {
    range: { key: RANGES[rangeKey] ? rangeKey : DEFAULT_RANGE, ...range, fromDay },
    users: { total: usersTotal, verified: usersVerified, new: usersNew },
    trips: { total: tripsTotal, new: tripsNew, shared: tripsShared, group: tripsGroup },
    expenses,
    metricsAvailable: metrics !== null,
    totals,
    series,
    google,
  };
}
