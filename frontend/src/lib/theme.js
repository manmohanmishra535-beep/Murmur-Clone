/** Theme preference: "system" | "light" | "dark". Stored locally for Phase 1. */

export const THEME_KEY = "murmur-theme";
export const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function getStoredTheme() {
  if (typeof window === "undefined") return "system";
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return THEMES.some((theme) => theme.value === value) ? value : "system";
  } catch {
    return "system";
  }
}

/** Writes data-theme on <html>; "system" removes it so the OS decides. */
export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode with storage disabled still applies for this session.
  }
}
