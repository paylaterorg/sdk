/**
 * @dev Four-step progress indicator for the BNPL flow.
 */

import { memo, type JSX } from "react";
import type { Phase } from "../BnplFlow";

/**
 * @dev Phase order, hoisted out of the component so each render reuses the
 * same array reference instead of allocating a fresh one.
 */
const ORDER: readonly Phase[] = ["amount", "delivery", "sign", "done"];

/**
 * @title PhaseDots
 * @description Four-step progress indicator showing which BNPL phase the user is currently on. The active dot is wide and lime; completed dots are short and lime-tinted; pending dots are muted. Wrapped in `React.memo` since `phase` is the only prop — the dots only re-render when the customer actually advances.
 * @param {Object} props
 * @param {Phase} props.phase - The phase to highlight as active.
 * @returns {JSX.Element} A row of four dots with `data-state` attributes for CSS to style.
 */
export const PhaseDots = memo(function PhaseDots({ phase }: { phase: Phase }): JSX.Element {
  const idx = ORDER.indexOf(phase);

  return (
    <div className="pl-dots">
      {ORDER.map((p, i) => (
        <span
          key={p}
          aria-hidden
          className="pl-dot"
          data-state={i === idx ? "active" : i < idx ? "done" : "pending"}
        />
      ))}
    </div>
  );
});
