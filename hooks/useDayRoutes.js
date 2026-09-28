"use client";

import { useEffect, useMemo, useState } from "react";
import { distanceKm, pathLengthKm } from "@/lib/geo";
import { legModes, MODE_STYLES } from "@/lib/travelModes";

const MAX_ROUTED_LEG_KM = 400;
const RELOCATION_KM = 30; // a day starting this far from the last one began with a journey
const DEBOUNCE_MS = 350;

const MAX_IN_FLIGHT = 3; // the community routing server rate-limits bursts

const routeCache = new Map();
let inFlight = 0;
const waiting = [];

function limited(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      inFlight += 1;
      task().then(resolve, reject).finally(() => {
        inFlight -= 1;
        waiting.shift()?.();
      });
    };
    if (inFlight < MAX_IN_FLIGHT) run();
    else waiting.push(run);
  });
}

const isMappable = (activity) => activity.latitude != null && activity.longitude != null;

function makeSegment(dayId, day, mode, coordinates) {
  let longestLeg = 0;
  for (let i = 1; i < coordinates.length; i++) {
    longestLeg = Math.max(longestLeg, pathLengthKm([coordinates[i - 1], coordinates[i]]));
  }
  const profile = MODE_STYLES[mode].routing;
  const routable = Boolean(profile) && longestLeg <= MAX_ROUTED_LEG_KM;
  const key = `${profile}:${coordinates.map((point) => point.map((n) => n.toFixed(5)).join(",")).join(";")}`;
  return { dayId, day, mode, coordinates, profile, routable, straightKm: pathLengthKm(coordinates), key };
}

/**
 * Splits each day into legs between consecutive mapped stops, gives each leg a
 * travel mode, and joins consecutive legs of the same mode into one segment.
 * A day that starts far from where the previous one ended (a travel day) also
 * gets the journey from there.
 */
export function planSegments(trip) {
  const segments = [];
  let lastStop = null;
  for (const day of trip?.stops || []) {
    const stops = day.activities.filter(isMappable);
    if (!stops.length) continue;
    if (lastStop && distanceKm(lastStop, stops[0]) > RELOCATION_KM) {
      stops.unshift({ type: "origin", latitude: lastStop.latitude, longitude: lastStop.longitude });
    }
    lastStop = stops[stops.length - 1];

    const kms = stops.slice(1).map((stop, i) => distanceKm(stops[i], stop));
    const modes = legModes(stops, kms);
    let current = null;
    modes.forEach((mode, i) => {
      const to = [stops[i + 1].longitude, stops[i + 1].latitude];
      if (current?.mode === mode) {
        current.coordinates.push(to);
      } else {
        if (current) segments.push(makeSegment(day.id, day.day, current.mode, current.coordinates));
        current = { mode, coordinates: [[stops[i].longitude, stops[i].latitude], to] };
      }
    });
    if (current) segments.push(makeSegment(day.id, day.day, current.mode, current.coordinates));
  }
  return segments;
}

export function useDayRoutes(trip) {
  const [, setVersion] = useState(0);
  const segments = useMemo(() => planSegments(trip), [trip]);

  useEffect(() => {
    const pending = segments.filter((segment) => segment.routable && !routeCache.has(segment.key));
    if (!pending.length) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      for (const segment of pending) {
        routeCache.set(segment.key, { status: "loading" });
        limited(() =>
          fetch("/api/directions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coordinates: segment.coordinates, profile: segment.profile }),
            signal: controller.signal,
          })
        )
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error("route failed"))))
          .then((route) => routeCache.set(segment.key, { status: "ready", route }))
          .catch(() => {
            if (!controller.signal.aborted) routeCache.set(segment.key, { status: "failed" });
          })
          .finally(() => {
            if (!controller.signal.aborted) setVersion((v) => v + 1);
          });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      for (const segment of pending) {
        if (routeCache.get(segment.key)?.status === "loading") routeCache.delete(segment.key);
      }
    };
  }, [segments]);

  return segments.map((segment) => {
    const entry = routeCache.get(segment.key);
    return { ...segment, route: entry?.status === "ready" ? entry.route : null, loading: entry?.status === "loading" };
  });
}
