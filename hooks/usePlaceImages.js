"use client";

import { useEffect, useMemo, useState } from "react";

const API = "https://en.wikipedia.org/w/api.php";
const BATCH_SIZE = 50;
const imageCache = new Map();

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

export function usePlaceImages(titles) {
  const [, setVersion] = useState(0);
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

  return Object.fromEntries(wanted.map((title) => [title, imageCache.get(title) ?? null]));
}
