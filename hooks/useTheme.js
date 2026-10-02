"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_KEY } from "@/lib/theme";

const CHANGE_EVENT = "roam-theme-change";

function storedTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return theme === "light" || theme === "dark" ? theme : null;
  } catch {
    return null;
  }
}

const systemTheme = () => (window.matchMedia(DARK_QUERY).matches ? "dark" : "light");
const currentTheme = () => storedTheme() || systemTheme();
const applyTheme = () => document.documentElement.setAttribute("data-theme", currentTheme());

function subscribe(onChange) {
  const media = window.matchMedia(DARK_QUERY);
  const update = (event) => {
    if (event.type === "storage" && event.key !== THEME_KEY && event.key !== null) return;
    applyTheme();
    onChange();
  };
  media.addEventListener("change", update);
  window.addEventListener("storage", update); // another tab switched
  window.addEventListener(CHANGE_EVENT, update);
  return () => {
    media.removeEventListener("change", update);
    window.removeEventListener("storage", update);
    window.removeEventListener(CHANGE_EVENT, update);
  };
}

/** The resolved theme ("light" until hydrated) and a toggle that remembers the choice. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light");

  // React's dev remount clears the attribute the inline script set on <html>; put it back before paint.
  useLayoutEffect(applyTheme, []);

  const toggleTheme = useCallback(() => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    try {
      // Choosing the system's own theme goes back to following the system.
      if (next === systemTheme()) localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch { }
    // Swap every colour at once rather than letting each control fade at its own pace.
    const root = document.documentElement;
    root.classList.add("theme-switching");
    window.dispatchEvent(new Event(CHANGE_EVENT));
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
  }, []);

  return { theme, toggleTheme };
}
