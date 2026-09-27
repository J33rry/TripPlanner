"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { arrivalRadius, zoomForGlobeRadius } from "@/lib/globeGeometry";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const WORKER_PATH = "/vendor/maplibre/maplibre-gl-worker.mjs";
const REVEAL_FLY_MS = 2800;
const REFIT_MS = 900;

const PAINT_OVERRIDES = {
  background: { "background-color": "#f3f1ec" },
  park: { "fill-color": "#d3e8c5", "fill-opacity": 0.85 },
  landcover_wood: { "fill-color": "#d9ebcd", "fill-opacity": 0.55 },
  landuse_residential: { "fill-color": "#eeebe5", "fill-opacity": 0.55 },
  water: { "fill-color": "#b7daf0" },
  waterway: { "line-color": "#b7daf0" },
  building: { "fill-color": "#e8e5e0" },
};

const ROUTE_SOURCE = "trip-routes";
const STOP_SOURCE = "trip-stops";

function formatDistance(meters) {
  return meters >= 10000 ? `${Math.round(meters / 1000)} km` : `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function boundsOf(points) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [lng, lat] of points) {
    west = Math.min(west, lng); east = Math.max(east, lng);
    south = Math.min(south, lat); north = Math.max(north, lat);
  }
  return [[west, south], [east, north]];
}

function firstSymbolLayer(map) {
  return map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
}

export default function TripMap({
  center,
  stops,
  dayRoutes,
  activeDayId,
  hoveredStopId,
  selectedStopId,
  revealed,
  insets,
  onReady,
  onStopSelect,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const libRef = useRef(null);
  const markersRef = useRef(new Map());
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasRevealed = useRef(false);
  const lastFitKey = useRef("");

  const live = useRef({ onReady, onStopSelect });
  useEffect(() => {
    live.current = { onReady, onStopSelect };
  });

  useEffect(() => {
    let cancelled = false;
    let map;
    import("maplibre-gl")
      .then((maplibregl) => {
        if (cancelled) return;
        libRef.current = maplibregl;
        maplibregl.setWorkerUrl(new URL(WORKER_PATH, window.location.href).href);

        const { width, height } = containerRef.current.getBoundingClientRect();
        const start = center || { lat: 20, lng: 0 };
        map = new maplibregl.Map({
          container: containerRef.current,
          style: STYLE_URL,
          center: [start.lng, start.lat],
          zoom: center ? zoomForGlobeRadius(arrivalRadius(width, height), start.lat) : 1.2,
          attributionControl: false,
          fadeDuration: 150,
        });
        mapRef.current = map;

        map.on("style.load", () => {
          map.setProjection({ type: "globe" });
          for (const [layer, paint] of Object.entries(PAINT_OVERRIDES)) {
            if (!map.getLayer(layer)) continue;
            for (const [property, value] of Object.entries(paint)) map.setPaintProperty(layer, property, value);
          }
          const beforeId = firstSymbolLayer(map);
          map.addSource(ROUTE_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addSource(STOP_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: "trip-stop-halos",
            type: "circle",
            source: STOP_SOURCE,
            paint: {
              "circle-radius": 22,
              "circle-color": "#a57be6",
              "circle-opacity": ["*", 0.16, ["get", "emphasis"]],
              "circle-blur": 0.55,
            },
          }, beforeId);
          map.addLayer({
            id: "trip-route-casing",
            type: "line",
            source: ROUTE_SOURCE,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": ["*", 0.7, ["get", "emphasis"]] },
          }, beforeId);
          map.addLayer({
            id: "trip-route-line",
            type: "line",
            source: ROUTE_SOURCE,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#7a4fd4",
              "line-width": 2.6,
              "line-dasharray": [1.4, 1.6],
              "line-opacity": ["get", "emphasis"],
            },
          }, beforeId);
          setLoaded(true);
          map.once("idle", () => live.current.onReady?.());
        });
        map.on("error", (event) => console.warn("Map error:", event?.error?.message));
      })
      .catch((err) => {
        console.error("Could not load the map:", err);
        setFailed(true);
        live.current.onReady?.();
      });

    const markers = markersRef.current;
    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
      markers.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const emphasis = (dayId) => (!activeDayId || activeDayId === dayId ? 1 : 0.28);
    map.getSource(ROUTE_SOURCE)?.setData({
      type: "FeatureCollection",
      features: dayRoutes
        .filter((plan) => plan.coordinates.length >= 2)
        .map((plan) => ({
          type: "Feature",
          properties: { dayId: plan.dayId, emphasis: emphasis(plan.dayId) },
          geometry: plan.route?.geometry || { type: "LineString", coordinates: plan.coordinates },
        })),
    });
    map.getSource(STOP_SOURCE)?.setData({
      type: "FeatureCollection",
      features: stops.map((stop) => ({
        type: "Feature",
        properties: { emphasis: emphasis(stop.dayId) },
        geometry: { type: "Point", coordinates: stop.lngLat },
      })),
    });
  }, [loaded, dayRoutes, stops, activeDayId]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libRef.current;
    if (!loaded || !map || !maplibregl) return;
    const markers = markersRef.current;
    markers.forEach((marker) => marker.remove());
    markers.clear();
    for (const stop of stops) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "map-pin";
      el.dataset.dayId = stop.dayId;
      el.setAttribute("aria-label", `Stop ${stop.number}: ${stop.title}`);
      const head = document.createElement("span");
      head.className = "map-pin-head";
      head.textContent = String(stop.number);
      const label = document.createElement("span");
      label.className = "map-pin-label";
      label.textContent = stop.location || stop.title;
      el.append(head, label);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        live.current.onStopSelect?.(stop.id);
      });
      markers.set(stop.id, new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(stop.lngLat).addTo(map));
    }
  }, [loaded, stops]);

  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      el.classList.toggle("is-hovered", id === hoveredStopId || id === selectedStopId);
      el.classList.toggle("is-dimmed", Boolean(activeDayId) && el.dataset.dayId !== activeDayId);
    });
  }, [hoveredStopId, selectedStopId, activeDayId, stops, loaded]);

  const getPadding = useCallback(() => {
    const { width, height } = containerRef.current.getBoundingClientRect();
    const compact = width < 900;
    const padding = {
      top: compact ? 84 : 96,
      left: compact ? 28 : 72,
      right: (insets?.right || 0) + (compact ? 28 : 64),
      bottom: (insets?.bottom || 0) + (compact ? 28 : 96),
    };
    const shrink = (total, room) => (total > room ? Math.max(0, room) / total : 1);
    const sy = shrink(padding.top + padding.bottom, height - 90);
    const sx = shrink(padding.left + padding.right, width - 90);
    return { top: padding.top * sy, bottom: padding.bottom * sy, left: padding.left * sx, right: padding.right * sx };
  }, [insets?.right, insets?.bottom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !revealed) return;
    const focus = activeDayId ? stops.filter((stop) => stop.dayId === activeDayId) : stops;
    const points = (focus.length ? focus : stops).map((stop) => stop.lngLat);
    const key = `${activeDayId || "all"}|${points.map((p) => p.join(",")).join(";")}|${insets?.right}|${insets?.bottom}`;
    if (key === lastFitKey.current) return;
    lastFitKey.current = key;
    const padding = getPadding();

    const first = !hasRevealed.current;
    hasRevealed.current = true;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : first ? REVEAL_FLY_MS : REFIT_MS;

    if (!points.length) {
      if (center) map.flyTo({ center: [center.lng, center.lat], zoom: 11, padding, duration, essential: true });
      return;
    }
    if (points.length === 1) {
      map.flyTo({ center: points[0], zoom: 14.5, padding, duration, essential: true });
      return;
    }
    map.fitBounds(boundsOf(points), { padding, maxZoom: 15.5, duration, essential: true, curve: 1.5 });
  }, [loaded, revealed, stops, activeDayId, getPadding, insets?.right, insets?.bottom, center]);

  useEffect(() => {
    const map = mapRef.current;
    const stop = stops.find((s) => s.id === selectedStopId);
    if (!loaded || !map || !revealed || !stop) return;
    map.easeTo({ center: stop.lngLat, zoom: Math.max(map.getZoom(), 14.5), padding: getPadding(), duration: 700 });
  }, [selectedStopId, loaded, revealed]);

  const legend = useMemo(() => {
    const plans = dayRoutes.filter((plan) => plan.coordinates.length >= 2 && (!activeDayId || plan.dayId === activeDayId));
    if (!plans.length) return null;
    const routed = plans.filter((plan) => plan.route);
    const walking = plans.every((plan) => plan.profile === "foot");
    const label = activeDayId ? `Day ${plans[0].day} · ${walking ? "Walking" : "Driving"} route` : walking ? "Walking routes" : "Suggested routes";
    let detail;
    if (routed.length === plans.length) {
      const distance = routed.reduce((sum, plan) => sum + plan.route.distance, 0);
      const duration = routed.reduce((sum, plan) => sum + plan.route.duration, 0);
      detail = `~${formatDistance(distance)} · ${formatDuration(duration)}`;
    } else if (plans.some((plan) => plan.loading)) {
      detail = "Finding the best way around…";
    } else {
      detail = `~${formatDistance(plans.reduce((sum, plan) => sum + plan.straightKm * 1000, 0))} as the crow flies`;
    }
    return { label, detail, walking };
  }, [dayRoutes, activeDayId]);

  const zoomBy = (delta) => mapRef.current?.easeTo({ zoom: mapRef.current.getZoom() + delta, duration: 300 });
  const refit = () => {
    lastFitKey.current = "";
    const map = mapRef.current;
    if (map && stops.length > 1) map.fitBounds(boundsOf(stops.map((s) => s.lngLat)), { padding: getPadding(), maxZoom: 15.5, duration: REFIT_MS });
  };

  return (
    <div className="trip-map">
      <div ref={containerRef} className="trip-map-canvas" />
      <div className="map-controls" role="group" aria-label="Map zoom">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">−</button>
        <button type="button" onClick={refit} aria-label="Show the whole trip" title="Show the whole trip">⤢</button>
      </div>
      {failed && <div className="map-notice">The map couldn’t load. Your itinerary is still here to edit.</div>}
      {!failed && loaded && !stops.length && (
        <div className="map-notice">This plan has no mapped places yet — ask Roam to refine it and they’ll appear here.</div>
      )}
      <div className="map-legend">
        {legend && (
          <div className="map-legend-route">
            <span className="legend-icon" aria-hidden="true">{legend.walking ? "🚶" : "🚗"}</span>
            <span className="legend-line" aria-hidden="true" />
            <div>
              <strong>{legend.label}</strong>
              <small>{legend.detail}</small>
            </div>
          </div>
        )}
        <p className="map-credit">
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>{" "}
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Routes{" "}
          <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">FOSSGIS</a> · Places and routes are AI suggestions
        </p>
      </div>
    </div>
  );
}
