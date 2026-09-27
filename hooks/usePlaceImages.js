"use client";

import { useEffect, useMemo, useState } from "react";

// Thumbnails come from Wikipedia's public API (CORS enabled via origin=*).
// Titles that aren't articles, or articles without a lead image, resolve to
// null and the UI shows an illustrated fallback instead.
const API = "https://en.wikipedia.org/w/api.php";
const BATCH_SIZE = 50; // the API's limit on titles per request
const imageCache = new Map(); // title -> url | null

async function fetchBatch(titles, signal) {
  const params = new URLSearchParams({
    action: "query",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "320",
    redirects: "1",
    format: "json",
    formatversion: "2",
    origin: "*",
    titles: titles.join("|"),
  });
  const response = await fetch(`${API}?${params}`, { signal });
  if (!response.ok) throw new Error("Wikipedia request failed");
  const { query = {} } = await response.json();

  // Follow the API's title normalisation and redirects back to what we asked for.
  const resolve = new Map(titles.map((title) => [title, title]));
  for (const step of [...(query.normalized || []), ...(query.redirects || [])]) {
    for (const [original, current] of resolve) {
      if (current === step.from) resolve.set(original, step.to);
    }
  }
  const thumbnails = new Map((query.pages || []).map((page) => [page.title, page.thumbnail?.source || null]));
  for (const [original, finalTitle] of resolve) {
    imageCache.set(original, thumbnails.get(finalTitle) ?? null);
  }
}

/** Map of title -> thumbnail URL (or null) for the given place names. */
export function usePlaceImages(titles) {
  const [, setVersion] = useState(0);
  // Key on the titles' content so callers can pass a fresh array each render.
  // ("|" can't appear in Wikipedia titles, so it's a safe separator.)
  const key = [...new Set(titles.map((title) => title?.trim()).filter(Boolean))].join("|");
  const wanted = useMemo(() => (key ? key.split("|") : []), [key]);

  useEffect(() => {
    const missing = wanted.filter((title) => !imageCache.has(title));
    if (!missing.length) return;
    const controller = new AbortController();
    const batches = [];
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      batches.push(fetchBatch(missing.slice(i, i + BATCH_SIZE), controller.signal).catch(() => {}));
    }
    Promise.all(batches).then(() => {
      if (!controller.signal.aborted) setVersion((v) => v + 1);
    });
    return () => controller.abort();
  }, [wanted]);

  // Read straight from the cache each render; the version bump above re-renders
  // once a batch lands.
  return Object.fromEntries(wanted.map((title) => [title, imageCache.get(title) ?? null]));
}
