/**
 * @dev Four-step progress indicator for the BNPL flow.
 */

import type { JSX } from "react";
import type { Phase } from "../BnplFlow";

/**
 * @title PhaseDots
 * @description Four-step progress indicator showing which BNPL phase the user is currently on. The active dot is wide and lime; completed dots are short and lime-tinted; pending dots are muted.
 * @param {Object} props
 * @param {Phase} props.phase - The phase to highlight as active.
 * @returns {JSX.Element} A row of four dots with `data-state` attributes for CSS to style.
 */
export function PhaseDots({ phase }: { phase: Phase }): JSX.Element {
  const order: Phase[] = ["amount", "delivery", "sign", "done"];
  const idx = order.indexOf(phase);

  return (
    <div className="pl-dots">
      {order.map((p, i) => (
        <span
          key={p}
          aria-hidden
          className="pl-dot"
          data-state={i === idx ? "active" : i < idx ? "done" : "pending"}
        />
      ))}
    </div>
  );
}
