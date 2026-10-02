// A stored "light" or "dark" overrides the system setting; no stored value follows the system.
export const THEME_KEY = "roam_theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Runs inline in <head>, before first paint, so a dark-mode visit never flashes light. */
export const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("${DARK_QUERY}").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)})()`;
