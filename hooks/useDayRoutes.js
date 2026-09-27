"use client";

import { useEffect, useMemo, useState } from "react";
import { getTripStops, pathLengthKm } from "@/lib/geo";

const MAX_WALK_LEG_KM = 4;
const MAX_WALK_DAY_KM = 15;
const MAX_ROUTED_LEG_KM = 400;
const DEBOUNCE_MS = 350;

const routeCache = new Map();

function planDay(dayId, day, coordinates) {
  let longestLeg = 0;
  for (let i = 1; i < coordinates.length; i++) {
    longestLeg = Math.max(longestLeg, pathLengthKm([coordinates[i - 1], coordinates[i]]));
  }
  const straightKm = pathLengthKm(coordinates);
  const profile = longestLeg <= MAX_WALK_LEG_KM && straightKm <= MAX_WALK_DAY_KM ? "foot" : "car";
  const routable = coordinates.length >= 2 && longestLeg <= MAX_ROUTED_LEG_KM;
  const key = `${profile}:${coordinates.map((point) => point.map((n) => n.toFixed(5)).join(",")).join(";")}`;
  return { dayId, day, coordinates, profile, routable, straightKm, key };
}

export function useDayRoutes(trip) {
  const [, setVersion] = useState(0);

  const plans = useMemo(() => {
    const byDay = new Map();
    for (const stop of getTripStops(trip)) {
      if (!byDay.has(stop.dayId)) byDay.set(stop.dayId, { day: stop.day, coordinates: [] });
      byDay.get(stop.dayId).coordinates.push(stop.lngLat);
    }
    return [...byDay].map(([dayId, { day, coordinates }]) => planDay(dayId, day, coordinates));
  }, [trip]);

  useEffect(() => {
    const pending = plans.filter((plan) => plan.routable && !routeCache.has(plan.key));
    if (!pending.length) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      for (const plan of pending) {
        routeCache.set(plan.key, { status: "loading" });
        fetch("/api/directions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coordinates: plan.coordinates, profile: plan.profile }),
          signal: controller.signal,
        })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error("route failed"))))
          .then((route) => routeCache.set(plan.key, { status: "ready", route }))
          .catch(() => {
            if (!controller.signal.aborted) routeCache.set(plan.key, { status: "failed" });
          })
          .finally(() => {
            if (!controller.signal.aborted) setVersion((v) => v + 1);
          });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      for (const plan of pending) {
        if (routeCache.get(plan.key)?.status === "loading") routeCache.delete(plan.key);
      }
    };
  }, [plans]);

  return plans.map((plan) => {
    const entry = routeCache.get(plan.key);
    return { ...plan, route: entry?.status === "ready" ? entry.route : null, loading: entry?.status === "loading" };
  });
}
