/**
 * @dev Deferred-mount demo. The widget is not in the tree until the customer
 * taps the CTA — useful for verifying that the on-mount `validate` request
 * fires exactly when the widget enters the DOM, not at page load. Tap "Hide"
 * to unmount and re-trigger so you can watch the request fire again in the
 * Network panel.
 *
 * Lives in its own file so Vite's Fast Refresh stays clean — `cases.tsx`
 * is a data module and shouldn't host top-level components.
 */

import { PayLaterWidget } from "@paylater/sdk/react";
import { useState, type JSX } from "react";

const TEST_KEY: string = import.meta.env.VITE_PAYLATER_API_KEY ?? "pk_test_examplekey1234567890";

/**
 * @title BuyButtonDemo
 * @description Renders a "Buy with PayLater" CTA in place of the widget. On
 * click, the widget mounts below the button (which firing the on-mount key
 * validate call as a side effect). A "Hide widget" link unmounts it so the
 * cycle can be repeated for inspection in the Network panel.
 * @returns {JSX.Element} The CTA or, after click, the mounted widget.
 */
export function BuyButtonDemo(): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="buy-button-demo">
      {!open && (
        <button
          type="button"
          className="buy-button-cta"
          onClick={() => setOpen(true)}
          aria-expanded={false}
        >
          Buy with PayLater
        </button>
      )}
      {open && (
        <>
          <PayLaterWidget apiKey={TEST_KEY} />
          <button type="button" className="buy-button-hide" onClick={() => setOpen(false)}>
            Hide widget (unmount)
          </button>
        </>
      )}
    </div>
  );
}
