/**
 * @dev Widget — top-level React component rendered inside the SDK's shadow root.
 *
 * Both supported positions (`inline` and `inline-popup`) render the
 * `<BnplFlow>` directly at the mount target. There is no open/close shell —
 * `BnplFlow` itself owns the popup-after-amount overlay (for `inline-popup`)
 * and portals it to the body-attached shadow root via `portalContainer`.
 */

import type { JSX } from "react";
import type { PayLaterOptions } from "../types";
import { BnplFlow } from "./BnplFlow";

/**
 * @dev The public API for the Widget component.
 */
export interface WidgetProps {
  options: PayLaterOptions; // The options accepted by `PayLater.init()`.

  /**
   * Body-attached shadow-root container the SDK creates so the popup overlay
   * can escape any `transform` / `filter` ancestors of the consumer's
   * mount target. Owned by the factory in `widget.ts`.
   */
  portalContainer: HTMLElement | null;

  onPhaseChange: (phase: "amount" | "delivery" | "sign" | "done") => void; // Callback for when the BNPL flow changes phase.
}

/**
 * @title Widget
 * @description Top-level React component rendered inside the SDK's shadow root. Renders the BNPL flow directly — both `inline` and `inline-popup` are always-on positions, so there's no overlay shell here. `BnplFlow` itself manages the popup-after-amount overlay for `inline-popup` and portals it to `portalContainer`.
 * @param {WidgetProps} props - Options + portal container + phase callback.
 * @returns {JSX.Element} The rendered BNPL flow.
 */
export function Widget({ options, portalContainer, onPhaseChange }: WidgetProps): JSX.Element {
  return (
    <BnplFlow
      options={options}
      portalContainer={portalContainer}
      onPhaseChange={onPhaseChange}
      onSuccess={(event) => options.on?.success?.(event)}
      onError={(event) => options.on?.error?.(event)}
    />
  );
}
