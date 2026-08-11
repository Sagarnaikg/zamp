import { Theme } from "@/constants";

export const THEME_STORAGE_KEY = "zamp-theme";
/** The attribute the CSS overrides key off: `:root[data-theme="dark"]`. */
export const THEME_ATTRIBUTE = "data-theme";

/**
 * Runs before first paint, ahead of React, so the page never renders in the
 * wrong theme and then snaps — the flash is the whole problem this solves.
 *
 * Inlined as a string because it must be a blocking script in <head>; a
 * component would run too late. Kept deliberately tiny and dependency-free,
 * and wrapped in try/catch since localStorage throws in private browsing.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)}, theme);
  } catch (e) {}
})();
`;

/**
 * The `data-theme` attribute is the source of truth — the init script sets it
 * before paint, and the toggle writes it. Exposing it as an external store
 * means components read the real value instead of keeping a second copy of it
 * in React state that has to be synced back.
 */
export function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [THEME_ATTRIBUTE],
  });
  return () => observer.disconnect();
}

export function getTheme(): Theme {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === Theme.Dark
    ? Theme.Dark
    : Theme.Light;
}

/** SSR has no way to know the user's theme; the script corrects it before paint. */
export function getServerTheme(): Theme {
  return Theme.Light;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing: the theme still applies for this session.
  }
}
