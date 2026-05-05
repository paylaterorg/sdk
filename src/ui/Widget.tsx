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
import { createPortal } from "react-dom";
import type { CloseEvent, PayLaterOptions } from "../types";
import { BnplFlow } from "./BnplFlow";

/**
 * @dev The public API for the Widget component.
 */
export interface WidgetProps {
  options: PayLaterOptions; // The options accepted by `PayLater.init()`.
  open: boolean; // Whether the widget is currently open (relevant for modal/drawer).

  /**
   * Body-attached shadow-root container the SDK creates so popup overlays
   * can escape any `transform` / `filter` ancestors of the consumer's
   * mount target. The factory in `widget.ts` owns its lifecycle.
   */
  portalContainer: HTMLElement | null;

  onPhaseChange: (phase: "amount" | "delivery" | "sign" | "done") => void; // Callback for when the BNPL flow changes phase.
  onClose: (event: CloseEvent) => void; // Callback for when the widget is closed (either by user action or programmatically).
}

/**
 * @title Widget
 * @description Top-level React component rendered inside the SDK's shadow root. It is responsible for rendering the BNPL flow inside a positioned shell (inline, modal, or drawer), handling dismissal for modal and drawer positions (via overlay click and ESC key), and passing the consumer's options down to the BNPL flow component. The actual BNPL flow is implemented in the `<BnplFlow>` component, allowing for separation of concerns between positioning and flow logic.
 * @param {WidgetProps} props - The props for configuring the Widget, including options, open state, and event handlers.
 * @returns {JSX.Element | null} The rendered Widget component containing the BNPL flow, or `null` for hidden modal/drawer positions.
 * @dev This component serves as the main entry point for rendering the BNPL experience within the SDK's UI infrastructure.
 */
export function Widget({
  options,
  open,
  portalContainer,
  onPhaseChange,
  onClose,
}: WidgetProps): JSX.Element | null {
  const position = options.position ?? "inline";

  const inlineLike = position === "inline" || position === "inline-popup";

  // ESC key dismissal for modal + drawer. The inline-popup overlay is owned by
  // BnplFlow itself, which has its own dismissal handling.
  useEffect(() => {
    if (inlineLike || !open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose({ abandoned: true, phase: "amount" });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [inlineLike, open, onClose]);

  if (inlineLike) {
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

  if (!open) return null;

  const isDrawer = position === "drawer";
  const overlayClass = isDrawer ? "pl-overlay pl-drawer-overlay" : "pl-overlay";

  const overlay = (
    <div
      className={overlayClass}
      // The class supplies the polish (backdrop blur, animation, theme
      // tokens) but we duplicate the critical positioning + dimming as
      // inline styles so the overlay is never visible as an inline-flow
      // black box if the stylesheet is still parsing on the very first
      // render after page load.
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: isDrawer ? "stretch" : "center",
        justifyContent: isDrawer ? "flex-end" : "center",
        padding: isDrawer ? 0 : "1rem",
        background: "rgba(0, 0, 0, 0.5)",
        zIndex: 999999,
      }}
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
        portalContainer={portalContainer}
        onPhaseChange={onPhaseChange}
        onSuccess={(event) => options.on?.success?.(event)}
        onError={(event) => options.on?.error?.(event)}
        onDismiss={() => onClose({ abandoned: true, phase: "amount" })}
      />
    </div>
  );

  // Portal the overlay into the body-attached shadow root (when available)
  // so any `transform` / `filter` ancestors of the consumer's mount target
  // can't trap our `position: fixed` overlay inside their containing block.
  return portalContainer ? createPortal(overlay, portalContainer) : overlay;
}
