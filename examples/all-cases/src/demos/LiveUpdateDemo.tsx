/**
 * @dev Live theme-swap demo. Three pill buttons flip a state-bound `theme`
 * prop. The React adapter forwards the change to `instance.update({ theme })`
 * under the hood, so the widget repaints in place — no remount, no flicker.
 *
 * Lives in its own file so Vite's Fast Refresh stays clean — `cases.tsx`
 * is a data module and shouldn't host top-level components.
 */

import { PayLaterWidget } from "@paylater/sdk/react";
import { useState, type JSX } from "react";

const TEST_KEY: string = import.meta.env.VITE_PAYLATER_API_KEY ?? "pk_test_examplekey1234567890";

/**
 * @dev Brand color schemes the demo cycles through. Keeping them outside the
 * component keeps the object identity stable across renders so the React
 * adapter's reactive theme effect doesn't fire spuriously.
 */
const SCHEMES: Record<
  "lime" | "purple" | "rose",
  { light: { primary: string }; dark: { primary: string } }
> = {
  lime: {
    light: { primary: "oklch(76.02% 0.18901 132.705)" },
    dark: { primary: "oklch(0.876 0.166 131)" },
  },
  purple: {
    light: { primary: "oklch(0.62 0.22 280)" },
    dark: { primary: "oklch(0.78 0.20 280)" },
  },
  rose: {
    light: { primary: "oklch(0.65 0.24 12)" },
    dark: { primary: "oklch(0.78 0.22 12)" },
  },
};

/**
 * @title LiveUpdateDemo
 * @description Three brand-color pills swap the widget's `theme.light.primary`
 * / `theme.dark.primary` via state. The widget repaints in place via the
 * React adapter's reactive theme effect — useful when partners want to flip
 * branding for A/B tests or seasonal moments without remounting.
 * @returns {JSX.Element} The pill row above the widget.
 */
export function LiveUpdateDemo(): JSX.Element {
  const [scheme, setScheme] = useState<"lime" | "purple" | "rose">("lime");

  return (
    <div className="live-update-demo">
      <div className="scheme-row" role="radiogroup" aria-label="Brand color">
        {(Object.keys(SCHEMES) as Array<keyof typeof SCHEMES>).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={scheme === id}
            className={`scheme-btn scheme-btn-${id}${scheme === id ? " active" : ""}`}
            onClick={() => setScheme(id)}
          >
            {id[0]!.toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>
      <PayLaterWidget apiKey={TEST_KEY} theme={SCHEMES[scheme]} />
    </div>
  );
}
