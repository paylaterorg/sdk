/**
 * @dev WidgetInstance factory.
 *
 * Owns the lifecycle of a single rendered widget: shadow root attach, React
 * render, option mutations, and clean teardown. Both supported positions
 * (`inline` and `inline-popup`) render immediately at the mount target —
 * there is no hidden / open state to toggle.
 *
 * The consumer-facing surface is intentionally small: `init` returns one of
 * these instances, the consumer calls `mount` once, and everything else is
 * either reactive (theme/handlers) or terminal (unmount).
 */

import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  applyColorMode,
  applyTheme,
  attachShadowHost,
  injectStyles,
  resolveTarget,
} from "./shadow";
import type { PayLaterOptions, WidgetInstance } from "./types";
import { Widget } from "./ui/Widget";

// The CSS bundle is compiled by Tailwind into a string and inlined at
// build time via tsup's `loader: { ".css": "text" }` rule.
import inlineCss from "./styles.css";

/**
 * @dev Default options merged on top of whatever the consumer passes.
 *
 * These are the values the marketing site advertises, so changing them is a
 * public-API change.
 */
const DEFAULT_OPTIONS = {
  product: "bnpl_30d" as const,
  asset: "usdt" as const,
  position: "inline" as const,
  apiOrigin: "https://api.paylater.dev",
};

/**
 * @dev Internal book-keeping for a single widget instance. The factory holds
 * exactly one of these in closure scope and mutates it directly — every
 * exposed method (mount / unmount / update) reads or writes a field here.
 * Nullable references are populated on `mount` and reset to `null` on
 * `unmount`, which lets `mounted` be a single source of truth.
 */
interface InternalState {
  options: PayLaterOptions; // The merged options driving this instance (defaults applied).
  host: HTMLElement | null; // The consumer's mount target — where the inline shadow root attaches.
  shadow: ShadowRoot | null; // Shadow root attached to the host. Carries the SDK CSS + theme.
  container: HTMLDivElement | null; // `data-paylater-root` div inside `shadow`; the React tree's mount node.

  /**
   * @dev Body-attached host element for the popup overlay. Its own Shadow
   * Root carries a copy of the SDK's CSS, so the overlay tile can render
   * outside the consumer's mount target — escaping any `transform` /
   * `filter` ancestors that would turn `position: fixed` into a
   * containing-block-scoped position (which is how the popup sometimes
   * appeared "at the widget's location" instead of centered on the
   * viewport during early page-load clicks).
   */
  portalHost: HTMLElement | null;

  portalShadow: ShadowRoot | null; // Shadow root inside `portalHost`. Mirrors `shadow`'s CSS + theme.
  portalContainer: HTMLDivElement | null; // `data-paylater-root` div inside `portalShadow`; React's portal target.
  reactRoot: Root | null; // The React 18 root rendering into `container`.
  phase: WidgetInstance["phase"]; // Cached phase so `instance.phase` is a synchronous read.
  mounted: boolean; // True between successful `mount()` and `unmount()`.
}

/**
 * @title createWidget
 * @description Factory function that creates and manages a PayLater widget instance.
 * @param {PayLaterOptions} initialOptions - The initial configuration options for the widget.
 * @returns {WidgetInstance} A WidgetInstance that can be mounted, updated, and unmounted.
 * @throws Will throw an error if required options are missing or invalid.
 */
export function createWidget(initialOptions: PayLaterOptions): WidgetInstance {
  _validateOptions(initialOptions);

  const state: InternalState = {
    options: _mergeDefaults(initialOptions),
    host: null,
    shadow: null,
    container: null,
    portalHost: null,
    portalShadow: null,
    portalContainer: null,
    reactRoot: null,
    phase: "amount",
    mounted: false,
  };

  function render() {
    if (!state.reactRoot) return;

    state.reactRoot.render(
      createElement(Widget, {
        options: state.options,
        portalContainer: state.portalContainer,
        onPhaseChange: (next) => {
          state.phase = next;
          state.options.on?.phaseChange?.(next);
        },
      }),
    );
  }

  const instance: WidgetInstance = {
    get phase() {
      return state.phase;
    },
    get mounted() {
      return state.mounted;
    },
    mount(target) {
      if (state.mounted) return instance; // Idempotent — re-mounting at the same target is a no-op.

      // Resolve the host element, attach a shadow root, inject styles, and apply the theme.
      const host = resolveTarget(target);
      const { shadow, container } = attachShadowHost(host);
      injectStyles(shadow, inlineCss);
      applyTheme(shadow, state.options.theme);
      applyColorMode(shadow.host as HTMLElement, state.options.theme?.mode ?? "auto");

      // Body-attached portal host. Its sole purpose is to anchor the popup
      // overlay outside the consumer's mount target, escaping any
      // `transform` / `filter` ancestors (think framer-motion `<motion.div>`
      // wrappers) that would otherwise turn the overlay's `position: fixed`
      // into a containing-block-scoped position. The portal carries its
      // own copy of the SDK CSS + theme + color-mode so the rendered tile
      // looks identical to the inline one.
      const portalHost = document.createElement("div");
      portalHost.setAttribute("data-paylater-portal", "");
      portalHost.style.cssText = "all:initial;";
      document.body.appendChild(portalHost);
      const { shadow: portalShadow, container: portalContainer } = attachShadowHost(portalHost);
      injectStyles(portalShadow, inlineCss);
      applyTheme(portalShadow, state.options.theme);
      applyColorMode(portalShadow.host as HTMLElement, state.options.theme?.mode ?? "auto");

      // Store all references in the internal state object, so we can clean them up on unmount.
      state.host = host;
      state.shadow = shadow;
      state.container = container;
      state.portalHost = portalHost;
      state.portalShadow = portalShadow;
      state.portalContainer = portalContainer;
      state.reactRoot = createRoot(container);
      state.mounted = true;

      render();

      // `ready` fires on the next microtask so React has flushed the first
      // render before the consumer's handler runs.
      queueMicrotask(() => state.options.on?.ready?.());

      return instance;
    },
    unmount() {
      if (!state.mounted) return;

      state.options.on?.close?.({
        abandoned: state.phase !== "done",
        phase: state.phase,
      });
      state.reactRoot?.unmount();

      // Clean up all references and DOM nodes to prevent memory leaks.
      if (state.host && state.shadow) state.shadow.innerHTML = "";
      if (state.portalHost?.parentNode) state.portalHost.parentNode.removeChild(state.portalHost);
      state.reactRoot = null;
      state.container = null;
      state.shadow = null;
      state.host = null;
      state.portalContainer = null;
      state.portalShadow = null;
      state.portalHost = null;
      state.mounted = false;
    },
    update(patch) {
      state.options = _mergeDefaults({ ...state.options, ...patch });

      // Mirror theme + mode updates onto both the inline and the portal
      // shadow roots so they stay visually in lockstep.
      const roots = [state.shadow, state.portalShadow];
      for (const root of roots) {
        if (!root) continue;

        if (patch.theme) applyTheme(root, state.options.theme);
        if (patch.theme?.mode) applyColorMode(root.host as HTMLElement, patch.theme.mode);
      }

      render();
    },
  };

  return instance;
}

/**
 * @dev Merges the consumer's options with the default options, ensuring that all required fields are populated.
 * Also applies defaults for nested objects like theme and custody, and ensures that lock/hide arrays are defined.
 * @param {PayLaterOptions} opts - The consumer's options to merge with defaults.
 * @returns {PayLaterOptions} The merged options object with defaults applied.
 */
function _mergeDefaults(opts: PayLaterOptions): PayLaterOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...opts,
    theme: { mode: "auto", ...opts.theme },
    custody: opts.custody ?? { mode: "self" },
    lock: opts.lock ?? [],
    hide: opts.hide ?? [],
    prefill: opts.prefill ?? {},
  };
}

/**
 * @dev Validates the provided options object to ensure that all required fields are present and correctly formatted.
 * @param {PayLaterOptions} opts - The options object to validate.
 * @throws Will throw an error if required options are missing or invalid.
 */
function _validateOptions(opts: PayLaterOptions) {
  if (!opts.apiKey)
    throw new Error(
      `[paylater] Missing required option "apiKey". ` +
        `Sandbox keys (pk_test_*) are issued from https://paylater.dev.`,
    );

  if (!/^pk_(test|live)_[a-zA-Z0-9]+$/.test(opts.apiKey))
    throw new Error(
      `[paylater] Invalid apiKey "${opts.apiKey}". ` +
        `Keys start with pk_test_ (sandbox) or pk_live_ (production).`,
    );

  // Merchant-custody coherence: settlementAddress + settlementNetwork travel
  // together. If you set one, you must set the other.
  if (opts.custody?.mode === "merchant") {
    if (!opts.custody.merchantUserId)
      throw new Error(
        `[paylater] custody.mode="merchant" requires a "merchantUserId" so the ` +
          `success event can attribute the deposit to the right user in your system.`,
      );

    const hasAddr = Boolean(opts.custody.settlementAddress);
    const hasNet = Boolean(opts.custody.settlementNetwork);
    if (hasAddr !== hasNet)
      throw new Error(
        `[paylater] custody.settlementAddress and custody.settlementNetwork must ` +
          `be supplied together. Set both for on-chain settlement, or neither for ` +
          `accounting-only mode (PayLater holds the USDT and reconciles via webhook).`,
      );
  }

  // Hidden / locked fields must be covered.
  const merchantCustody = opts.custody?.mode === "merchant";
  const prefill = opts.prefill ?? {};
  const lock = new Set(opts.lock ?? []);
  const hide = new Set(opts.hide ?? []);

  // Lock requires a value source.
  for (const field of lock) {
    if (!_hasFieldValue(field, opts, prefill, merchantCustody))
      throw new Error(
        `[paylater] lock includes "${field}" but no value was supplied. ` +
          `Pass it via prefill.${field} (or amount/country at the top level).`,
      );
  }

  // Hide requires either a value source or merchant-custody coverage.
  for (const field of hide) {
    if (!_hasFieldValue(field, opts, prefill, merchantCustody))
      throw new Error(
        `[paylater] hide includes "${field}" but no value source was supplied. ` +
          `Either provide it via prefill, or use custody.mode="merchant" for the ` +
          `wallet/network fields.`,
      );
  }
}

/**
 * @dev Helper function to determine if a given field has a value source, either directly from the options or via prefill.
 * For walletAddress and network, merchant custody counts as a value source since it hides those fields entirely.
 * Used during validation to ensure that locked or hidden fields have a way to be populated.
 * @param {string} field - The field name to check for a value source (e.g., "amount", "country", "email", "walletAddress", "network", "fullName").
 * @param {PayLaterOptions} opts - The full options object to check for top-level values.
 * @param {NonNullable<PayLaterOptions["prefill"]>} prefill - The prefill object to check for nested values.
 * @param {boolean} merchantCustody - Whether merchant custody is enabled, which affects wallet/network coverage.
 * @returns {boolean} True if the field has a value source, false otherwise.
 */
function _hasFieldValue(
  field: string,
  opts: PayLaterOptions,
  prefill: NonNullable<PayLaterOptions["prefill"]>,
  merchantCustody: boolean,
): boolean {
  switch (field) {
    case "amount":
      return typeof opts.amount === "number";
    case "country":
      return Boolean(opts.country);
    case "email":
      return Boolean(prefill.email);
    case "walletAddress":
      // Merchant custody hides the wallet step entirely — counts as covered.
      return merchantCustody || Boolean(prefill.walletAddress);
    case "network":
      return merchantCustody || Boolean(prefill.network);
    case "fullName":
      return Boolean(prefill.fullName);
    default:
      return false;
  }
}
