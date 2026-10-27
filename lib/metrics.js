import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { APPWRITE } from "./appwrite";
import { ADMIN_TABLES, adminServices } from "./adminStore";

// Usage counters for the admin page: one row per metric per UTC day in the
// metrics table, bumped with Appwrite's atomic increment. Counts gather in
// memory while a request runs and are written after its response is sent, so
// tracking never slows a request down. Best effort: a failed write is dropped.
//
// Names: api.<route>.{requests,2xx,4xx,5xx,ms} · cache.<name>.{hit,miss}
//        upstream.<service>.{calls,errors} · generate.* for the AI pipeline
const pending = new Map();
let lastWarning = 0;

export const utcDay = (date = new Date()) => date.toISOString().slice(0, 10);

export function count(metric, n = 1) {
  if (!n) return;
  const key = `${utcDay()}|${metric}`;
  pending.set(key, (pending.get(key) || 0) + n);
}

async function bump(tables, key, n) {
  const split = key.indexOf("|");
  const day = key.slice(0, split);
  const metric = key.slice(split + 1);
  const row = {
    databaseId: APPWRITE.databaseId,
    tableId: ADMIN_TABLES.metrics,
    rowId: createHash("sha1").update(key).digest("hex").slice(0, 32),
  };
  try {
    return await tables.incrementRowColumn({ ...row, column: "count", value: n });
  } catch (err) {
    if (err?.code !== 404) throw err;
  }
  // First count of the day for this metric; another request may create it at the same moment.
  try {
    return await tables.createRow({ ...row, data: { day, metric, count: n } });
  } catch (err) {
    if (err?.code !== 409) throw err;
  }
  return tables.incrementRowColumn({ ...row, column: "count", value: n });
}

export async function flushMetrics() {
  const tables = adminServices()?.tables;
  const batch = [...pending];
  pending.clear();
  if (!tables || !batch.length) return;
  const results = await Promise.allSettled(batch.map(([key, n]) => bump(tables, key, n)));
  const failed = results.find((result) => result.status === "rejected");
  if (failed && Date.now() - lastWarning > 60_000) {
    lastWarning = Date.now();
    console.warn(
      "Metrics: couldn’t save usage counts —",
      String(failed.reason?.message ?? failed.reason).slice(0, 200),
      "(run `npm run setup:appwrite`, and check APPWRITE_ADMIN_API_KEY has rows.read and rows.write)"
    );
  }
}

/** Wraps a route handler to count its requests, status classes and total time. */
export function instrument(route, handler) {
  return async function instrumented(request, context) {
    const started = performance.now();
    let status = 500;
    try {
      const response = await handler(request, context);
      status = response.status;
      return response;
    } finally {
      count(`api.${route}.requests`);
      count(`api.${route}.${Math.floor(status / 100)}xx`);
      count(`api.${route}.ms`, Math.round(performance.now() - started));
      after(flushMetrics);
    }
  };
}

/** A fetch that counts calls to (and failed responses from) an outside service. */
export function trackedFetch(service) {
  return async (...args) => {
    count(`upstream.${service}.calls`);
    try {
      const response = await fetch(...args);
      if (!response.ok) count(`upstream.${service}.errors`);
      return response;
    } catch (err) {
      if (err?.name !== "AbortError") count(`upstream.${service}.errors`);
      throw err;
    }
  };
}
