"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { arrivalRadius } from "@/lib/globeGeometry";
import { cameraForPoints, centerWithPadding, easeOutCubic, flightPath, zoomForGlobeRadius } from "@/lib/mapCamera";
import { MODE_STYLES, TRAVEL_MODES } from "@/lib/travelModes";
import { MODE_ICONS } from "./icons";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const REVEAL_FLY_MS = 2800;
const REFIT_MS = 1100;
const FIT_MAX_ZOOM = 16.5;
const STOP_ZOOM = 15.5;
const CITY_ZOOM = 12;

function loadGoogleMaps() {
  // A global flag, not a module one: hot reloads re-run this module, and the
  // loader warns (printing the options, key included) if configured twice.
  if (!globalThis.__roamMapsConfigured) {
    setOptions({ key: API_KEY, v: "weekly" });
    globalThis.__roamMapsConfigured = true;
  }
  return Promise.all([importLibrary("maps"), importLibrary("marker")]);
}

// Google reports a rejected key (wrong API, referrer not allowed) through this global hook.
const authFailureListeners = new Set();
if (typeof window !== "undefined") {
  window.gm_authFailure = () => authFailureListeners.forEach((listener) => listener());
}

function formatDistance(meters) {
  return meters >= 10000 ? `${Math.round(meters / 1000).toLocaleString("en")} km` : `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

const toLatLng = ([lng, lat]) => ({ lat, lng });

// Symbol paths for Google polylines, in symbol units centred on 0,0; "up" points along the line.
const CIRCLE = "M -1,0 a 1,1 0 1,0 2,0 a 1,1 0 1,0 -2,0";
const DASH = "M 0,-1 0,1";
const TIE = "M -1,0 1,0";
const PLANE = "M0 -9.5c.9 0 1.5.9 1.5 2V-3l7 4v2l-7-2v4.5l2 1.5v1.5L0 7.5l-3.5 1V7l2-1.5V1l-7 2v-2l7-4V-7.5c0-1.1.6-2 1.5-2Z";

/** Polyline layers (white casing first) that draw one travel mode's line style. */
function lineLayers(mode, emphasis) {
  const { color, pattern } = MODE_STYLES[mode];
  const casing = { strokeColor: "#ffffff", strokeOpacity: 0.75 * emphasis, strokeWeight: 7, zIndex: 1 };
  const repeated = (icons) => ({ strokeOpacity: 0, zIndex: 2, icons });
  const dash = (scale, weight, repeat) => ({
    icon: { path: DASH, strokeColor: color, strokeOpacity: emphasis, strokeWeight: weight, scale },
    offset: "0",
    repeat,
  });
  switch (pattern) {
    case "dots":
      return [casing, repeated([{ icon: { path: CIRCLE, fillColor: color, fillOpacity: emphasis, strokeOpacity: 0, scale: 1.8 }, offset: "0", repeat: "8px" }])];
    case "dash":
      return [casing, repeated([dash(2, 3, "10px")])];
    case "longdash":
      return [casing, repeated([dash(3.5, 3.5, "14px")])];
    case "rail":
      return [
        { ...casing, strokeWeight: 9 },
        { strokeColor: color, strokeOpacity: emphasis, strokeWeight: 2.5, zIndex: 2 },
        repeated([{ icon: { path: TIE, strokeColor: color, strokeOpacity: emphasis, strokeWeight: 2, scale: 3.5 }, offset: "0", repeat: "11px" }]),
      ];
    case "arc":
      return [
        { ...casing, geodesic: true },
        {
          ...repeated([
            dash(2.5, 2.8, "12px"),
            { icon: { path: PLANE, fillColor: color, fillOpacity: emphasis, strokeColor: "#ffffff", strokeOpacity: emphasis, strokeWeight: 1.2, scale: 0.95 }, offset: "50%" },
          ]),
          geodesic: true,
        },
      ];
    default:
      return [casing, { strokeColor: color, strokeOpacity: emphasis, strokeWeight: 3.5, zIndex: 2 }];
  }
}

/** A small line sample for the legend, matching the map's line style for the mode. */
function LegendSwatch({ mode }) {
  const { color, pattern } = MODE_STYLES[mode];
  const line = { stroke: color, strokeWidth: 2.6, strokeLinecap: "round", fill: "none" };
  return (
    <svg className="legend-swatch" width="30" height="12" viewBox="0 0 30 12" aria-hidden="true">
      {pattern === "dots" && [3, 9, 15, 21, 27].map((x) => <circle key={x} cx={x} cy="6" r="1.7" fill={color} />)}
      {pattern === "dash" && <path d="M2 6h26" {...line} strokeDasharray="4 4.5" />}
      {pattern === "longdash" && <path d="M2 6h26" {...line} strokeWidth="3" strokeDasharray="7 5" />}
      {pattern === "solid" && <path d="M2 6h26" {...line} strokeWidth="3" />}
      {pattern === "rail" && (
        <>
          <path d="M1 6h28" {...line} strokeWidth="2" />
          <path d="M5 2.5v7M12 2.5v7M19 2.5v7M26 2.5v7" {...line} strokeWidth="1.6" />
        </>
      )}
      {pattern === "arc" && <path d="M2 10Q15 -2 28 10" {...line} strokeDasharray="3.5 3.5" />}
    </svg>
  );
}
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  const frameRef = useRef(null);
  const containerRef = useRef(null);
  const legendRef = useRef(null);
  const mapRef = useRef(null);
  const libRef = useRef(null);
  const markersRef = useRef(new Map());
  const animationRef = useRef(0);
  const initialCenter = useRef(center);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(!API_KEY);
  const hasRevealed = useRef(false);
  const lastFitKey = useRef("");

  const live = useRef({ onReady, onStopSelect });
  useEffect(() => {
    live.current = { ...live.current, onReady, onStopSelect };
  });

  useEffect(() => {
    if (!API_KEY) {
      console.warn("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set, so the trip map is unavailable.");
      live.current.onReady?.();
      return;
    }

    let cancelled = false;
    const listeners = [];
    const fail = () => {
      if (cancelled) return;
      setFailed(true);
      live.current.onReady?.();
    };
    authFailureListeners.add(fail);

    loadGoogleMaps()
      .then(([maps, marker]) => {
        if (cancelled) return;
        libRef.current = { Polyline: maps.Polyline, AdvancedMarkerElement: marker.AdvancedMarkerElement };

        // Start exactly where the globe's arrival dive ends: same centre, same scale.
        const { width, height } = frameRef.current.getBoundingClientRect();
        const start = initialCenter.current;
        const map = new maps.Map(containerRef.current, {
          center: start || { lat: 20, lng: 0 },
          zoom: start ? zoomForGlobeRadius(arrivalRadius(width, height), start.lat) : 2,
          mapId: MAP_ID,
          renderingType: maps.RenderingType.VECTOR,
          colorScheme: "LIGHT",
          isFractionalZoomEnabled: true,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          backgroundColor: "#f3f1ec",
        });
        mapRef.current = map;

        const stopAnimation = () => cancelAnimationFrame(animationRef.current);
        listeners.push(map.addListener("dragstart", stopAnimation));
        containerRef.current.addEventListener("wheel", stopAnimation, { passive: true });
        const ready = map.addListener("tilesloaded", () => {
          ready.remove();
          live.current.onReady?.();
        });
        listeners.push(ready);
        setLoaded(true);
      })
      .catch((err) => {
        console.error("Could not load the map:", err);
        fail();
      });

    const markers = markersRef.current;
    return () => {
      cancelled = true;
      authFailureListeners.delete(fail);
      cancelAnimationFrame(animationRef.current);
      listeners.forEach((listener) => listener.remove());
      markers.forEach((marker) => { marker.map = null; });
      markers.clear();
      mapRef.current = null;
    };
  }, []);

  // The visible map area once the itinerary panel is in place. The canvas
  // shrinks with the panel's slide-in, so Google's logo and terms stay visible.
  const finalSize = useCallback(() => {
    const { width, height } = frameRef.current.getBoundingClientRect();
    return { width: width - (insets?.right || 0), height: height - (insets?.bottom || 0) };
  }, [insets?.right, insets?.bottom]);

  const getPadding = useCallback(() => {
    const { width, height } = finalSize();
    const compact = width + (insets?.right || 0) < 900;
    // Keep stops clear of the legend: it sits at the top on narrow screens and
    // bottom-left otherwise, and grows with the number of travel modes shown.
    const legendHeight = legendRef.current?.offsetHeight || 0;
    const padding = {
      top: compact ? Math.max(84, legendHeight + 64) : 96, // pins rise ~40px above their point
      left: compact ? 28 : 72,
      right: compact ? 28 : 64,
      bottom: compact ? 28 : Math.max(110, legendHeight + 60),
    };
    const shrink = (total, room) => (total > room ? Math.max(0, room) / total : 1);
    const sy = shrink(padding.top + padding.bottom, height - 90);
    const sx = shrink(padding.left + padding.right, width - 90);
    return { top: padding.top * sy, bottom: padding.bottom * sy, left: padding.left * sx, right: padding.right * sx };
  }, [finalSize, insets?.right]);

  const animateTo = useCallback((target, duration, easing) => {
    const map = mapRef.current;
    if (!map) return;
    cancelAnimationFrame(animationRef.current);
    if (!duration || prefersReducedMotion()) {
      map.moveCamera(target);
      return;
    }
    const from = { center: map.getCenter().toJSON(), zoom: map.getZoom() };
    const path = flightPath(from, target, finalSize(), easing ? { easing } : undefined);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      map.moveCamera(path(t));
      if (t < 1) animationRef.current = requestAnimationFrame(step);
    };
    animationRef.current = requestAnimationFrame(step);
  }, [finalSize]);

  useEffect(() => {
    live.current = { ...live.current, stops, getPadding, animateTo };
  });

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!loaded || !map || !lib) return;
    const lines = [];
    for (const segment of dayRoutes) {
      const path = (segment.route?.geometry?.coordinates || segment.coordinates).map(toLatLng);
      const emphasis = !activeDayId || activeDayId === segment.dayId ? 1 : 0.28;
      for (const layer of lineLayers(segment.mode, emphasis)) {
        lines.push(new lib.Polyline({ map, path, clickable: false, ...layer }));
      }
    }
    return () => lines.forEach((line) => line.setMap(null));
  }, [loaded, dayRoutes, activeDayId]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!loaded || !map || !lib) return;
    const markers = markersRef.current;
    for (const stop of stops) {
      const el = document.createElement("div");
      el.className = "map-pin";
      el.dataset.dayId = stop.dayId;
      const head = document.createElement("span");
      head.className = "map-pin-head";
      head.textContent = String(stop.number);
      const label = document.createElement("span");
      label.className = "map-pin-label";
      label.textContent = stop.location || stop.title;
      el.append(head, label);
      const marker = new lib.AdvancedMarkerElement({
        map,
        position: toLatLng(stop.lngLat),
        content: el,
        title: `Stop ${stop.number}: ${stop.title}`,
        gmpClickable: true,
      });
      marker.addEventListener("gmp-click", () => live.current.onStopSelect?.(stop.id));
      markers.set(stop.id, marker);
    }
    return () => {
      markers.forEach((marker) => { marker.map = null; });
      markers.clear();
    };
  }, [loaded, stops]);

  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.content;
      const emphasised = id === hoveredStopId || id === selectedStopId;
      el.classList.toggle("is-hovered", emphasised);
      el.classList.toggle("is-dimmed", Boolean(activeDayId) && el.dataset.dayId !== activeDayId);
      marker.zIndex = emphasised ? 10 : null;
    });
  }, [hoveredStopId, selectedStopId, activeDayId, stops, loaded]);

  useEffect(() => {
    if (!loaded || !mapRef.current || !revealed) return;
    const focus = activeDayId ? stops.filter((stop) => stop.dayId === activeDayId) : stops;
    const points = (focus.length ? focus : stops).map((stop) => stop.lngLat);
    const key = `${activeDayId || "all"}|${points.map((p) => p.join(",")).join(";")}|${insets?.right}|${insets?.bottom}`;
    if (key === lastFitKey.current) return;
    lastFitKey.current = key;
    const padding = getPadding();

    // The first flight continues the globe's dive, so it starts fast and settles.
    const first = !hasRevealed.current;
    hasRevealed.current = true;
    const duration = first ? REVEAL_FLY_MS : REFIT_MS;
    const easing = first ? easeOutCubic : undefined;

    if (!points.length) {
      if (center) animateTo({ center: centerWithPadding(center, CITY_ZOOM, padding), zoom: CITY_ZOOM }, duration, easing);
      return;
    }
    if (points.length === 1) {
      animateTo({ center: centerWithPadding(toLatLng(points[0]), STOP_ZOOM, padding), zoom: STOP_ZOOM }, duration, easing);
      return;
    }
    animateTo(cameraForPoints(points, { size: finalSize(), padding, maxZoom: FIT_MAX_ZOOM }), duration, easing);
  }, [loaded, revealed, stops, activeDayId, getPadding, finalSize, animateTo, insets?.right, insets?.bottom, center]);

  useEffect(() => {
    const map = mapRef.current;
    const { stops: currentStops, getPadding: padding, animateTo: fly } = live.current;
    const stop = currentStops?.find((s) => s.id === selectedStopId);
    if (!loaded || !map || !revealed || !stop) return;
    const zoom = Math.max(map.getZoom(), STOP_ZOOM);
    fly({ center: centerWithPadding(toLatLng(stop.lngLat), zoom, padding()), zoom }, 700);
  }, [selectedStopId, loaded, revealed]);

  const legend = useMemo(() => {
    const segments = dayRoutes.filter((segment) => !activeDayId || segment.dayId === activeDayId);
    if (!segments.length) return null;
    const byMode = new Map();
    for (const segment of segments) {
      const entry = byMode.get(segment.mode) || { mode: segment.mode, meters: 0, seconds: 0, timed: true, loading: false };
      entry.meters += segment.route ? segment.route.distance : segment.straightKm * 1000;
      entry.seconds += segment.route?.duration || 0;
      entry.timed &&= Boolean(segment.route);
      entry.loading ||= segment.loading;
      byMode.set(segment.mode, entry);
    }
    // Bus legs are routed as cars, so their times would be too optimistic; show distance only.
    const rows = TRAVEL_MODES.filter((mode) => byMode.has(mode)).map((mode) => {
      const { meters, seconds, timed, loading } = byMode.get(mode);
      const detail = loading
        ? "Finding the way…"
        : timed && mode !== "bus"
          ? `${formatDistance(meters)} · ${formatDuration(seconds)}`
          : `~${formatDistance(meters)}`;
      return { mode, detail };
    });
    return { title: activeDayId ? `Day ${segments[0].day} · Getting around` : "Getting around", rows };
  }, [dayRoutes, activeDayId]);

  const zoomBy = (delta) => {
    const map = mapRef.current;
    if (map) animateTo({ center: map.getCenter().toJSON(), zoom: map.getZoom() + delta }, 300);
  };
  const refit = () => {
    lastFitKey.current = "";
    if (mapRef.current && stops.length > 1) {
      animateTo(cameraForPoints(stops.map((s) => s.lngLat), { size: finalSize(), padding: getPadding(), maxZoom: FIT_MAX_ZOOM }), REFIT_MS);
    }
  };

  return (
    <div ref={frameRef} className="trip-map">
      <div
        ref={containerRef}
        className="trip-map-canvas"
        style={revealed ? { right: insets?.right || 0, bottom: insets?.bottom || 0 } : undefined}
      />
      <div className="map-controls" role="group" aria-label="Map zoom">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">−</button>
        <button type="button" onClick={refit} aria-label="Show the whole trip" title="Show the whole trip">⤢</button>
      </div>
      {failed && <div className="map-notice">The map couldn’t load. Your itinerary is still here to edit.</div>}
      {!failed && loaded && !stops.length && (
        <div className="map-notice">This plan has no mapped places yet — ask Roam to refine it and they’ll appear here.</div>
      )}
      <div ref={legendRef} className="map-legend">
        {legend && (
          <>
            <p className="legend-title">{legend.title}</p>
            <ul className="legend-modes">
              {legend.rows.map(({ mode, detail }) => {
                const Icon = MODE_ICONS[mode];
                return (
                  <li key={mode} style={{ "--mode": MODE_STYLES[mode].color }}>
                    <span className="legend-mode-icon"><Icon /></span>
                    <span className="legend-mode-label">{MODE_STYLES[mode].label}</span>
                    <LegendSwatch mode={mode} />
                    <span className="legend-mode-detail">{detail}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="map-credit">
          Routes © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors via{" "}
          <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">FOSSGIS</a> · Places and routes are AI suggestions
        </p>
      </div>
    </div>
  );
}
