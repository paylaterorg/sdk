/**
 * @dev Catalog of every SDK configuration the showcase demonstrates.
 *
 * Each entry pairs a literal source-code snippet (so partners can copy/paste)
 * with a `Demo` component that renders the configured widget live. The
 * `code` string is intentionally written to mirror what a partner would
 * actually write — pretty-printed, no template trickery — so what you see
 * on the left of each case really is what the right-hand widget runs.
 */

import type { WidgetInstance } from "@paylater/sdk";
import { PayLaterWidget } from "@paylater/sdk/react";
import { useRef, useState, type ReactNode } from "react";

const TEST_KEY = "pk_test_demo";

/**
 * @dev Shape of one showcased configuration scenario.
 */
export interface Case {
  id: string;
  title: string;
  description: string;
  code: string;
  Demo: () => ReactNode;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * @dev Trigger button + ref-controlled widget for modal / drawer positions.
 * Both positions render nothing until `widget.open()` is called.
 */
function ButtonTrigger({
  position,
  label,
}: {
  position: "modal" | "drawer";
  label: string;
}): ReactNode {
  const ref = useRef<WidgetInstance>(null);

  return (
    <>
      <button type="button" className="trigger-btn" onClick={() => ref.current?.open()}>
        {label}
      </button>
      <PayLaterWidget ref={ref} apiKey={TEST_KEY} position={position} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Catalog                                                                    */
/* -------------------------------------------------------------------------- */

export const CASES: Case[] = [
  {
    id: "default",
    title: "Default settings",
    description:
      "The smallest valid call. Just an API key — every other option uses the SDK's defaults: inline position, auto theme, self custody, country auto-detected (Sweden in this demo).",
    code: `<PayLaterWidget apiKey="pk_test_demo" />`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} />,
  },
  {
    id: "inline-popup",
    title: 'Inline + popup (`position: "inline-popup"`)',
    description:
      "Amount step renders inline at the mount point. When the customer clicks Continue, the rest of the flow takes over the viewport as an overlay. The host page gets a 'Continuing in popup' placeholder where the inline tile was. Used by the marketing site.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  position="inline-popup"
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} position="inline-popup" />,
  },
  {
    id: "modal",
    title: 'Modal (`position: "modal"`)',
    description:
      "Entire flow is hidden until the partner calls `widget.open()` — typically from a CTA button on the host page. Centered overlay on the viewport.",
    code: `function Checkout() {
  const ref = useRef<WidgetInstance>(null);
  return (
    <>
      <button onClick={() => ref.current?.open()}>
        Open checkout
      </button>
      <PayLaterWidget
        ref={ref}
        apiKey="pk_test_demo"
        position="modal"
      />
    </>
  );
}`,
    Demo: () => <ButtonTrigger position="modal" label="Open checkout" />,
  },
  {
    id: "drawer",
    title: 'Drawer (`position: "drawer"`)',
    description:
      "Same as modal, but the flow slides in from the right edge of the viewport. Better for desktop side-panel checkout patterns.",
    code: `function Checkout() {
  const ref = useRef<WidgetInstance>(null);
  return (
    <>
      <button onClick={() => ref.current?.open()}>
        Open drawer
      </button>
      <PayLaterWidget
        ref={ref}
        apiKey="pk_test_demo"
        position="drawer"
      />
    </>
  );
}`,
    Demo: () => <ButtonTrigger position="drawer" label="Open drawer" />,
  },
  {
    id: "country-preset",
    title: "Pre-selected country (France)",
    description:
      "Skip the auto-detected country and start the customer in a specific market. They can still change it via the chip in the header unless you also lock it.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  country="FR"
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} country="FR" />,
  },
  {
    id: "country-locked",
    title: "Locked country (Germany)",
    description:
      "Country chip becomes inert (no chevron, not clickable). Required when your business model is single-market.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  country="DE"
  lock={["country"]}
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} country="DE" lock={["country"]} />,
  },
  {
    id: "amount-preset",
    title: "Pre-filled amount",
    description:
      "Drop the customer onto the amount step at a specific value. The value is clamped into the country's [min, max] range automatically.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  country="SE"
  amount={2500}
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} country="SE" amount={2500} />,
  },
  {
    id: "prefilled-email-locked",
    title: "Pre-filled email (locked)",
    description:
      "Customer is already logged in to your platform — pass their email and lock the field so they can't change it.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  prefill={{ email: "customer@yourplatform.com" }}
  lock={["email"]}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        prefill={{ email: "customer@yourplatform.com" }}
        lock={["email"]}
      />
    ),
  },
  {
    id: "hidden-email",
    title: "Hidden email (covered by prefill)",
    description:
      "Same as locked, except the field is removed from the UI entirely. Hidden fields still need a prefill source — the SDK throws at init if a hidden field has no value.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  prefill={{ email: "customer@yourplatform.com" }}
  hide={["email"]}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        prefill={{ email: "customer@yourplatform.com" }}
        hide={["email"]}
      />
    ),
  },
  {
    id: "prefilled-wallet",
    title: "Pre-filled wallet + network (locked)",
    description:
      "Already know where the customer wants their USDT? Skip the network/address inputs by prefilling them and locking both fields.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  prefill={{
    network: "solana",
    walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  }}
  lock={["walletAddress", "network"]}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        prefill={{
          network: "solana",
          walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        }}
        lock={["walletAddress", "network"]}
      />
    ),
  },
  {
    id: "merchant-offchain",
    title: "Merchant custody — off-chain (default)",
    description:
      "Partner runs a custodial product (exchange / wallet / gambling site). The wallet step is hidden — PayLater fires `success` and the partner credits the user's internal balance.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  prefill={{ email: "customer@yourplatform.com" }}
  lock={["email"]}
  custody={{
    mode: "merchant",
    merchantUserId: "usr_4029381",
    description: "Deposit to your account",
  }}
  onSuccess={({ ref, amount, merchantUserId }) => {
    yourBackend.creditUser(merchantUserId, amount, { paylaterRef: ref });
  }}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        prefill={{ email: "customer@yourplatform.com" }}
        lock={["email"]}
        custody={{
          mode: "merchant",
          merchantUserId: "usr_4029381",
          description: "Deposit to your account",
        }}
      />
    ),
  },
  {
    id: "merchant-onchain",
    title: "Merchant custody — on-chain",
    description:
      "Same UX as off-chain merchant custody, but PayLater settles the USDT on-chain into the partner's hot wallet rather than crediting off-chain.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  custody={{
    mode: "merchant",
    merchantUserId: "usr_4029381",
    settlementAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    settlementNetwork: "solana",
  }}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        custody={{
          mode: "merchant",
          merchantUserId: "usr_4029381",
          settlementAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
          settlementNetwork: "solana",
        }}
      />
    ),
  },
  {
    id: "custom-theme",
    title: "Custom brand colors per mode",
    description:
      "Override `theme.light` and `theme.dark` to match your brand. Toggle the host theme at the top of the page to see both schemes live.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  theme={{
    radius: "lg",
    mode: "auto",
    light: { primary: "oklch(0.62 0.22 280)", accent: "oklch(0.92 0.06 280)" },
    dark:  { primary: "oklch(0.78 0.20 280)", accent: "oklch(0.40 0.14 280)" },
  }}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        theme={{
          radius: "lg",
          mode: "auto",
          light: { primary: "oklch(0.62 0.22 280)", accent: "oklch(0.92 0.06 280)" },
          dark: { primary: "oklch(0.78 0.20 280)", accent: "oklch(0.40 0.14 280)" },
        }}
      />
    ),
  },
  {
    id: "forced-light",
    title: 'Forced light mode (`mode: "light"`)',
    description:
      "Pin the widget to light mode regardless of host page theme. Useful when the partner page is dark but checkout needs to feel like a clean light surface (e.g. legal disclosures).",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  theme={{ mode: "light" }}
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} theme={{ mode: "light" }} />,
  },
  {
    id: "forced-dark",
    title: 'Forced dark mode (`mode: "dark"`)',
    description: "Mirror of forced-light — pin to dark regardless of host page theme.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  theme={{ mode: "dark" }}
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} theme={{ mode: "dark" }} />,
  },
  {
    id: "radius-xl",
    title: "Custom radius (`xl`)",
    description:
      "Bump the corner radius across cards / buttons / inputs. The full scale is `none | sm | md | lg | xl`.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  theme={{ radius: "xl" }}
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} theme={{ radius: "xl" }} />,
  },
  {
    id: "radius-none",
    title: "Squared radius (`none`)",
    description: "Goes the other way — flat, hard-edged surface for brutalist brands.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  theme={{ radius: "none" }}
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} theme={{ radius: "none" }} />,
  },
  {
    id: "font-family",
    title: "Custom font family",
    description:
      "Override the system font stack. Pass any CSS font-family value — the widget renders inside Shadow DOM, so the host page must serve the font (or use a system font like `Georgia`).",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  theme={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        theme={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      />
    ),
  },
  {
    id: "events",
    title: "Event handlers (success / phaseChange)",
    description:
      "Wire up partner-side analytics + ledger updates. The success event includes the BNPL reference, settled USDT amount, repayment amount, recipient, custody mode, and (for merchant custody) `merchantUserId`.",
    code: `<PayLaterWidget
  apiKey="pk_test_demo"
  onSuccess={(event) => track("paylater.signed", event)}
  onError={(error) => console.error("[paylater]", error)}
  onPhaseChange={(phase) => console.log("phase →", phase)}
/>`,
    Demo: () => <EventsDemo />,
  },
];

/* -------------------------------------------------------------------------- */
/* Inline event-handlers demo with a tiny inline log so partners can see the   */
/* events fire without opening DevTools.                                       */
/* -------------------------------------------------------------------------- */

function EventsDemo(): ReactNode {
  const [log, setLog] = useState<string[]>([]);

  const append = (msg: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 6));

  return (
    <div className="events-demo">
      <PayLaterWidget
        apiKey={TEST_KEY}
        onSuccess={(event) => append(`success ref=${event.ref} usdt=${event.usdt.toFixed(2)}`)}
        onError={(error) => append(`error code=${error.code}`)}
        onPhaseChange={(phase) => append(`phase → ${phase}`)}
      />
      <aside className="events-log" aria-label="Event log">
        <strong>Event log</strong>
        {log.length === 0 && (
          <span className="events-log-empty">No events yet — tap Continue.</span>
        )}
        {log.map((line, i) => (
          <span key={i} className="events-log-line">
            {line}
          </span>
        ))}
      </aside>
    </div>
  );
}
