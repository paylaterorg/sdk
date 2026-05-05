/**
 * @dev WidgetInstance factory.
 *
 * Owns the lifecycle of a single rendered widget: shadow root attach, React
 * render, option mutations, modal/drawer open/close, and clean teardown.
 *
 * The consumer-facing surface is intentionally small — `init` returns one of
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

interface InternalState {
  options: PayLaterOptions;
  host: HTMLElement | null;
  shadow: ShadowRoot | null;
  container: HTMLDivElement | null;
  reactRoot: Root | null;
  phase: WidgetInstance["phase"];
  mounted: boolean;
  open: boolean;
}

/**
 * @title createWidget
 * @description Factory function that creates and manages a PayLater widget instance.
 * @param {PayLaterOptions} initialOptions - The initial configuration options for the widget.
 * @returns {WidgetInstance} A WidgetInstance that can be mounted, updated, opened, closed, and unmounted.
 * @throws Will throw an error if required options are missing or invalid.
 */
export function createWidget(initialOptions: PayLaterOptions): WidgetInstance {
  _validateOptions(initialOptions);

  const state: InternalState = {
    options: _mergeDefaults(initialOptions),
    host: null,
    shadow: null,
    container: null,
    reactRoot: null,
    phase: "amount",
    mounted: false,
    open: _isInlineLike(initialOptions.position ?? "inline"),
  };

  function render() {
    if (!state.reactRoot) return;

    state.reactRoot.render(
      createElement(Widget, {
        options: state.options,
        open: state.open,
        onPhaseChange: (next) => {
          state.phase = next;
          state.options.on?.phaseChange?.(next);
        },
        onClose: (event) => {
          state.open = false;
          state.options.on?.close?.(event);
          render();
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

      // Store all references in the internal state object, so we can clean them up on unmount.
      state.host = host;
      state.shadow = shadow;
      state.container = container;
      state.reactRoot = createRoot(container);
      state.mounted = true;
      state.open = _isInlineLike(state.options.position);

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
      state.reactRoot = null;
      state.container = null;
      state.shadow = null;
      state.host = null;
      state.mounted = false;
      state.open = false;
    },
    open() {
      if (_isInlineLike(state.options.position)) return;
      state.open = true;

      render();
    },
    close() {
      if (_isInlineLike(state.options.position)) return;
      state.open = false;

      render();

      state.options.on?.close?.({
        abandoned: state.phase !== "done",
        phase: state.phase,
      });
    },
    update(patch) {
      state.options = _mergeDefaults({ ...state.options, ...patch });

      if (state.shadow) {
        if (patch.theme) applyTheme(state.shadow, state.options.theme);
        if (patch.theme?.mode) applyColorMode(state.shadow.host as HTMLElement, patch.theme.mode);
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

/**
 * @dev `inline` and `inline-popup` are both rendered immediately at the mount
 * target — `state.open` is true by default and `open()` / `close()` are no-ops
 * because there's no overlay shell to toggle. Modal and drawer positions are
 * the opposite: hidden until the consumer calls `open()`.
 */
function _isInlineLike(position: PayLaterOptions["position"] | undefined): boolean {
  return position === "inline" || position === "inline-popup" || position === undefined;
}
