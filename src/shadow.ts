/**
 * @dev Shadow DOM hosting helpers.
 *
 * The SDK renders inside a Shadow Root attached to a host element so the
 * widget's CSS can never leak into the partner's page and the partner's CSS
 * can never break the widget. Theming flows through CSS custom properties
 * scoped to `:host`, which we update in JS whenever the consumer calls
 * `widget.update({ theme: ... })`.
 */

import type { ColorMode, RadiusScale, ThemeOptions } from "./types";

/**
 * @dev Pixel values for each radius scale token. We convert these to CSS custom
 * properties when applying a theme.
 */
const RADIUS_PX: Record<RadiusScale, string> = {
  none: "0px",
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
};

/**
 * @title resolveTarget
 * @description Resolve a string or HTMLElement target into the actual element.
 * @param {string | HTMLElement} target - The target to resolve, either as a CSS selector string or an actual HTMLElement.
 * @returns {HTMLElement} The resolved HTMLElement that matches the provided target.
 * @throws Will throw an error if the target is a string but no matching element is found, if the found element is not an HTMLElement, or if the target is of an invalid type.
 */
export function resolveTarget(target: string | HTMLElement): HTMLElement {
  // If the target is a string, treat it as a CSS selector and attempt to find the element.
  if (typeof target === "string") {
    const el = document.querySelector(target);
    if (!el)
      throw new Error(
        `[paylater] Mount target "${target}" not found. Pass a CSS selector ` +
          `that matches an element already in the DOM.`,
      );
    if (!(el instanceof HTMLElement))
      throw new Error(`[paylater] Mount target "${target}" must be an HTMLElement.`);

    return el;
  }

  // If the target is already an HTMLElement, return it directly.
  if (target instanceof HTMLElement) return target;

  // For any other type of target, throw an error.
  throw new Error(`[paylater] Mount target must be a CSS selector string or an HTMLElement.`);
}

/**
 * @title attachShadowHost
 * @description Attach an open Shadow Root to the provided host element and prepare a container for rendering.
 * @param {HTMLElement} host - The host element to which the Shadow Root will be attached.
 * @returns {{ shadow: ShadowRoot; container: HTMLDivElement }} An object containing the attached Shadow Root and the container div for rendering.
 */
export function attachShadowHost(host: HTMLElement): {
  shadow: ShadowRoot;
  container: HTMLDivElement;
} {
  // Re-use an existing shadow root if the host already has one (e.g. on
  // hot-reload or repeated mount calls). Browsers throw if you attach twice.
  const existing = host.shadowRoot;
  const shadow = existing ?? host.attachShadow({ mode: "open" });

  // Wipe any prior render so a remount starts from a clean slate.
  shadow.innerHTML = "";

  // The container is where the widget content goes. We set `all: initial` to
  // reset all inherited styles so the widget looks the same regardless of the
  // partner page's CSS, then re-establish the SDK's font/color tokens via
  // CSS variables defined on `:host` — that way the body-attached portal
  // shadow looks identical to the inline one even though its host element
  // has `all: initial` and no useful inherited font.
  const container = document.createElement("div");
  container.setAttribute("data-paylater-root", "");
  container.style.cssText =
    "all:initial;display:block;font-family:var(--paylater-font-family);color:var(--paylater-fg);";
  shadow.appendChild(container);

  return { shadow, container };
}

/**
 * @title injectStyles
 * @description Inject a CSS string into the provided Shadow Root by creating a <style> element.
 * @param {ShadowRoot} shadow - The Shadow Root into which the styles will be injected.
 * @param {string} css - The CSS string that contains the styles to be applied to the Shadow DOM.
 */
export function injectStyles(shadow: ShadowRoot, css: string) {
  const style = document.createElement("style");
  style.setAttribute("data-paylater-styles", "");
  style.textContent = css;

  shadow.insertBefore(style, shadow.firstChild);
}

/**
 * @title applyTheme
 * @description Apply theme tokens to the shadow root host as CSS custom properties.
 * @param {ShadowRoot} shadow - The Shadow Root whose host element will receive the theme styles.
 * @param {ThemeOptions} theme - An object containing the theme tokens (primary, accent, fontFamily, radius, mode) to apply to the widget.
 */
export function applyTheme(shadow: ShadowRoot, theme: ThemeOptions = {}) {
  // The host element receives the styles; `:host` selectors in the inlined
  // stylesheet pick them up.
  const host = shadow.host as HTMLElement;
  if (theme.primary) host.style.setProperty("--paylater-primary", theme.primary);
  if (theme.accent) host.style.setProperty("--paylater-accent", theme.accent);
  if (theme.fontFamily) host.style.setProperty("--paylater-font-family", theme.fontFamily);
  if (theme.radius) host.style.setProperty("--paylater-radius", RADIUS_PX[theme.radius]);
  if (theme.mode) applyColorMode(host, theme.mode);
}

/**
 * @title applyColorMode
 * @description Resolve and apply a color-scheme mode to the host.
 * @param {HTMLElement} host - The host element to which the color mode will be applied.
 * @param {ColorMode} mode - The color mode to apply ("auto", "light", or "dark").
 */
export function applyColorMode(host: HTMLElement, mode: ColorMode) {
  // Tear down any previous auto-mode listeners on this host before reconfiguring.
  const prevDispose = _autoDisposers.get(host);
  if (prevDispose) {
    prevDispose();
    _autoDisposers.delete(host);
  }

  if (mode !== "auto") {
    host.setAttribute("data-paylater-mode", mode);
    return;
  }

  // Auto mode resolves to the host page's effective color scheme so the widget
  // matches the surrounding theme. We probe a few common signals on
  // `<html>` (Tailwind's `.dark` class, `data-theme="dark"`, `data-mode="dark"`)
  // and fall back to `prefers-color-scheme`. A MutationObserver + matchMedia
  // listener keep the widget in sync when the host page toggles theme live.
  const apply = () => host.setAttribute("data-paylater-mode", _detectHostMode());
  apply();

  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "data-mode", "style"],
  });

  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onChange = () => apply();
  mq?.addEventListener("change", onChange);

  _autoDisposers.set(host, () => {
    observer.disconnect();
    mq?.removeEventListener("change", onChange);
  });
}

/**
 * @dev Per-host registry of teardown callbacks for auto-mode listeners. Indexed
 * by host element so a single host that calls `applyColorMode` repeatedly
 * (e.g. via `update({ theme })`) reuses one set of listeners instead of
 * leaking them.
 */
const _autoDisposers = new WeakMap<HTMLElement, () => void>();

/**
 * @title _detectHostMode
 * @description Resolve whether the host page is rendering in light or dark mode by probing common signals on `<html>`. Class-based theming wins (Tailwind's `.dark`/`.light`); then attribute-based theming (`data-theme`, `data-mode`); then the inline or computed `color-scheme`; with `prefers-color-scheme` as the last-resort OS fallback. Returning a concrete light/dark string lets the SDK reflect it as `data-paylater-mode` on the shadow host so its `:host([data-paylater-mode="dark"])` rules apply deterministically.
 * @returns {"light" | "dark"} The resolved color scheme.
 */
function _detectHostMode(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const root = document.documentElement;

  // Class-based theming (Tailwind, shadcn, etc.) is the most explicit signal.
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";

  // Attribute-based theming.
  const dt = root.getAttribute("data-theme");
  if (dt === "dark") return "dark";
  if (dt === "light") return "light";
  const dm = root.getAttribute("data-mode");
  if (dm === "dark") return "dark";
  if (dm === "light") return "light";

  // Inline `style="color-scheme: light"` or computed `color-scheme` is what
  // many themers actually toggle. Hosts that have explicitly opted into a
  // scheme this way win over the OS default.
  const inlineScheme = root.style.colorScheme;
  if (inlineScheme === "light") return "light";
  if (inlineScheme === "dark") return "dark";
  const computedScheme = window.getComputedStyle?.(root).colorScheme;
  if (computedScheme === "light") return "light";
  if (computedScheme === "dark") return "dark";

  // Last resort: OS-level preference.
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
