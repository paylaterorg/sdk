/**
 * @dev Widget — top-level React component rendered inside the SDK's shadow root.
 *
 * Responsibilities:
 *  - Render the BNPL flow inside a positioned shell (inline / modal / drawer)
 *  - Handle modal/drawer dismissal (overlay click + ESC key)
 *  - Pass the consumer's options down to the flow component
 *
 * The actual BNPL flow lives in `<BnplFlow>` so position concerns and flow
 * concerns can evolve independently.
 */

import { useEffect, type JSX } from "react";
import type { CloseEvent, PayLaterOptions } from "../types";
import { BnplFlow } from "./BnplFlow";

/**
 * @dev The public API for the Widget component.
 */
export interface WidgetProps {
  options: PayLaterOptions; // The options accepted by `PayLater.init()`.
  open: boolean; // Whether the widget is currently open (relevant for modal/drawer).
  onPhaseChange: (phase: "amount" | "delivery" | "sign" | "done") => void; // Callback for when the BNPL flow changes phase.
  onClose: (event: CloseEvent) => void; // Callback for when the widget is closed (either by user action or programmatically).
}

/**
 * @title Widget
 * @description Top-level React component rendered inside the SDK's shadow root. It is responsible for rendering the BNPL flow inside a positioned shell (inline, modal, or drawer), handling dismissal for modal and drawer positions (via overlay click and ESC key), and passing the consumer's options down to the BNPL flow component. The actual BNPL flow is implemented in the `<BnplFlow>` component, allowing for separation of concerns between positioning and flow logic.
 * @param {WidgetProps} props - The props for configuring the Widget, including options, open state, and event handlers.
 * @returns {JSX.Element} The rendered Widget component containing the BNPL flow.
 * @dev This component serves as the main entry point for rendering the BNPL experience within the SDK's UI infrastructure.
 */
export function Widget({ options, open, onPhaseChange, onClose }: WidgetProps): JSX.Element | null {
  const position = options.position ?? "inline";

  // ESC key dismissal for modal + drawer.
  useEffect(() => {
    if (position === "inline" || !open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose({ abandoned: true, phase: "amount" });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [position, open, onClose]);

  if (position === "inline") {
    return (
      <BnplFlow
        options={options}
        onPhaseChange={onPhaseChange}
        onSuccess={(event) => options.on?.success?.(event)}
        onError={(event) => options.on?.error?.(event)}
      />
    );
  }

  if (!open) return null;

  const overlayClass = position === "drawer" ? "pl-overlay pl-drawer-overlay" : "pl-overlay";

  return (
    <div
      className={overlayClass}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose({ abandoned: true, phase: "amount" });
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="PayLater checkout"
    >
      <BnplFlow
        options={options}
        onPhaseChange={onPhaseChange}
        onSuccess={(event) => options.on?.success?.(event)}
        onError={(event) => options.on?.error?.(event)}
        onDismiss={() => onClose({ abandoned: true, phase: "amount" })}
      />
    </div>
  );
}
