/**
 * @dev Catalog of every SDK configuration the showcase demonstrates.
 *
 * Each entry pairs a literal source-code snippet (so partners can copy/paste)
 * with a `Demo` component that renders the configured widget live. The
 * `code` string is intentionally written to mirror what a partner would
 * actually write — pretty-printed, no template trickery — so what you see
 * on the left of each case really is what the right-hand widget runs.
 */

import { PayLaterWidget } from "@paylater/sdk/react";
import { type ReactNode } from "react";
import { BuyButtonDemo } from "./demos/BuyButtonDemo";
import { EventsDemo } from "./demos/EventsDemo";
import { LiveUpdateDemo } from "./demos/LiveUpdateDemo";
import { WebhookVerifyDemo } from "./demos/WebhookVerifyDemo";

/**
 * @dev Sandbox key used for every showcased widget. Pulled from
 * `VITE_PAYLATER_API_KEY` (set in `.env` — see `.env.example`) so partners
 * can plug in their own key without editing source. Falls back to a
 * placeholder so the showcase still renders out of the box, though the
 * widget will show its "Provide a valid pk_test_* key" warning until a
 * real key is supplied.
 */
const TEST_KEY: string = import.meta.env.VITE_PAYLATER_API_KEY ?? "pk_test_examplekey1234567890";

/**
 * @dev Optional `pk_live_*` key for the live-mode showcase. Live keys are
 * issued only after admin grants `canCreateLiveTokens` on the partner's
 * account. When unset, the showcase renders with a placeholder that the
 * api will reject with `not_found` — the widget falls back to its
 * "Provide a valid pk_..." warning, which still demonstrates the validation
 * path.
 */
const LIVE_KEY: string = import.meta.env.VITE_PAYLATER_LIVE_KEY ?? "pk_live_examplekey1234567890";

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
/* Catalog                                                                    */
/* -------------------------------------------------------------------------- */

export const CASES: Case[] = [
  {
    id: "default",
    title: "Default settings",
    description:
      "The smallest valid call. Just an API key — every other option uses the SDK's defaults: inline position, auto theme, self custody, country auto-detected (Sweden in this demo).",
    code: `<PayLaterWidget apiKey="pk_test_examplekey1234567890" />`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} />,
  },
  {
    id: "inline-popup",
    title: 'Inline + popup (`position: "inline-popup"`)',
    description:
      "Amount step renders inline at the mount point. When the customer clicks Continue, the rest of the flow takes over the viewport as an overlay. The host page gets a 'Continuing in popup' placeholder where the inline tile was. Used by the marketing site.",
    code: `<PayLaterWidget
  apiKey="pk_test_examplekey1234567890"
  position="inline-popup"
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} position="inline-popup" />,
  },
  {
    id: "country-preset",
    title: "Pre-selected country (France)",
    description:
      "Skip the auto-detected country and start the customer in a specific market. They can still change it via the chip in the header unless you also lock it.",
    code: `<PayLaterWidget
  apiKey="pk_test_examplekey1234567890"
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
  apiKey="pk_test_examplekey1234567890"
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
  apiKey="pk_test_examplekey1234567890"
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
  apiKey="pk_test_examplekey1234567890"
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
  apiKey="pk_test_examplekey1234567890"
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
  apiKey="pk_test_examplekey1234567890"
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
    id: "prefilled-fullname",
    title: "Pre-filled legal name",
    description:
      "Already KYC'd the customer? Pass the legal name via `prefill.fullName`. The eID provider remains the source of truth in production, but the success summary surfaces this name immediately rather than waiting for the mock to fill it in.",
    code: `<PayLaterWidget
  apiKey="pk_test_examplekey1234567890"
  prefill={{
    email: "customer@yourplatform.com",
    fullName: "Jane Q. Customer",
  }}
  lock={["email"]}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        prefill={{
          email: "customer@yourplatform.com",
          fullName: "Jane Q. Customer",
        }}
        lock={["email"]}
      />
    ),
  },
  {
    id: "merchant-offchain",
    title: "Merchant custody — off-chain (default)",
    description:
      "Partner runs a custodial product (exchange / wallet / gambling site). The wallet step is hidden — PayLater fires `success` so the partner page can show a confirmation state. The actual ledger update happens server-side from the signed webhook (the publishable key alone never authorizes money movement).",
    code: `<PayLaterWidget
  apiKey="pk_test_examplekey1234567890"
  prefill={{ email: "customer@yourplatform.com" }}
  lock={["email"]}
  custody={{
    mode: "merchant",
    merchantUserId: "usr_example123",
    description: "Deposit to your account",
  }}
  // Use \`success\` for UX (toast, redirect, optimistic balance ping) — the
  // authoritative credit happens when PayLater POSTs the signed agreement
  // to your webhook endpoint, verified with your secret key (\`sk_*\`).
  onSuccess={({ ref, merchantUserId }) => {
    track("paylater.signed", { ref, userId: merchantUserId });
  }}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        prefill={{ email: "customer@yourplatform.com" }}
        lock={["email"]}
        custody={{
          mode: "merchant",
          merchantUserId: "usr_example123",
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
  apiKey="pk_test_examplekey1234567890"
  custody={{
    mode: "merchant",
    merchantUserId: "usr_example123",
    settlementAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    settlementNetwork: "solana",
  }}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        custody={{
          mode: "merchant",
          merchantUserId: "usr_example123",
          settlementAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
          settlementNetwork: "solana",
        }}
      />
    ),
  },
  {
    id: "kitchen-sink",
    title: "Realistic partner integration (everything together)",
    description:
      "What an actual partner integration looks like in production: inline-popup position so the page stays compact, country locked to a single market, customer's email prefilled from the partner's session and locked, KYC'd legal name prefilled, off-chain merchant custody tied to the partner's user id, custom brand colors per mode, and a `success` handler that fires partner-side analytics (the authoritative ledger update arrives via the signed webhook).",
    code: `<PayLaterWidget
  apiKey="pk_test_examplekey1234567890"
  position="inline-popup"
  country="SE"
  lock={["country", "email"]}
  prefill={{
    email: "customer@yourplatform.com",
    fullName: "Jane Q. Customer",
  }}
  custody={{
    mode: "merchant",
    merchantUserId: "usr_example123",
    description: "Deposit to your account",
  }}
  theme={{
    radius: "lg",
    mode: "auto",
    light: { primary: "oklch(0.62 0.22 280)", accent: "oklch(0.92 0.06 280)" },
    dark:  { primary: "oklch(0.78 0.20 280)", accent: "oklch(0.40 0.14 280)" },
  }}
  onSuccess={({ ref, merchantUserId }) => {
    track("paylater.signed", { ref, userId: merchantUserId });
  }}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        position="inline-popup"
        country="SE"
        lock={["country", "email"]}
        prefill={{
          email: "customer@yourplatform.com",
          fullName: "Jane Q. Customer",
        }}
        custody={{
          mode: "merchant",
          merchantUserId: "usr_example123",
          description: "Deposit to your account",
        }}
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
    id: "custom-theme",
    title: "Custom brand colors per mode",
    description:
      "Override `theme.light` and `theme.dark` to match your brand. Toggle the host theme at the top of the page to see both schemes live.",
    code: `<PayLaterWidget
  apiKey="pk_test_examplekey1234567890"
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
    id: "accent-only",
    title: "Accent-only brand override",
    description:
      "Keep the SDK's default lime primary but tweak just the accent (used by tinted backgrounds, the amount-card gradient, and summary highlights). Lets partners nudge the look without choosing a full brand color.",
    code: `<PayLaterWidget
  apiKey="pk_test_examplekey1234567890"
  theme={{
    light: { accent: "oklch(0.93 0.10 28)" },
    dark:  { accent: "oklch(0.4 0.14 28)" },
  }}
/>`,
    Demo: () => (
      <PayLaterWidget
        apiKey={TEST_KEY}
        theme={{
          light: { accent: "oklch(0.93 0.10 28)" },
          dark: { accent: "oklch(0.4 0.14 28)" },
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
  apiKey="pk_test_examplekey1234567890"
  theme={{ mode: "light" }}
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} theme={{ mode: "light" }} />,
  },
  {
    id: "forced-dark",
    title: 'Forced dark mode (`mode: "dark"`)',
    description: "Mirror of forced-light — pin to dark regardless of host page theme.",
    code: `<PayLaterWidget
  apiKey="pk_test_examplekey1234567890"
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
  apiKey="pk_test_examplekey1234567890"
  theme={{ radius: "xl" }}
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} theme={{ radius: "xl" }} />,
  },
  {
    id: "radius-none",
    title: "Squared radius (`none`)",
    description: "Goes the other way — flat, hard-edged surface for brutalist brands.",
    code: `<PayLaterWidget
  apiKey="pk_test_examplekey1234567890"
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
  apiKey="pk_test_examplekey1234567890"
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
    id: "font-webfont",
    title: "Custom font (webfont)",
    description:
      "Same fontFamily knob as before, but loading a webfont from the host page. The host's `<link>` to Google Fonts (`Inter` in this showcase's `index.html`) makes the font available; the SDK just references it by name.",
    code: `// In your host page <head>:
// <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />

<PayLaterWidget
  apiKey="pk_test_examplekey1234567890"
  theme={{ fontFamily: "Inter, sans-serif" }}
/>`,
    Demo: () => <PayLaterWidget apiKey={TEST_KEY} theme={{ fontFamily: "Inter, sans-serif" }} />,
  },
  {
    id: "live-update",
    title: "Live theme updates (`update()` via React state)",
    description:
      "Partners can flip the theme on the fly without remounting the widget. The React adapter forwards updated `theme` props through `instance.update()` under the hood. Click the buttons to swap brand color schemes — every active widget rerenders in place.",
    code: `function LiveTheme() {
  const [scheme, setScheme] = useState<"lime" | "purple" | "rose">("lime");
  const themes = {
    lime:   { light: { primary: "oklch(76% 0.19 132)" }, dark: { primary: "oklch(0.88 0.17 131)" } },
    purple: { light: { primary: "oklch(0.62 0.22 280)" }, dark: { primary: "oklch(0.78 0.20 280)" } },
    rose:   { light: { primary: "oklch(0.65 0.24 12)" },  dark: { primary: "oklch(0.78 0.22 12)" } },
  };

  return (
    <>
      <button onClick={() => setScheme("lime")}>Lime</button>
      <button onClick={() => setScheme("purple")}>Purple</button>
      <button onClick={() => setScheme("rose")}>Rose</button>
      <PayLaterWidget apiKey="pk_test_examplekey1234567890" theme={themes[scheme]} />
    </>
  );
}`,
    Demo: () => <LiveUpdateDemo />,
  },
  {
    id: "deferred-mount",
    title: "Deferred mount (CTA-gated)",
    description:
      "The widget isn't rendered until the customer taps the CTA. Open DevTools → Network and watch: no `/v1/tokens/validate` call happens at page load. The request fires only when the widget actually mounts. Useful pattern for landing pages and modal-driven checkout flows; also handy for verifying the on-mount key validation behavior.",
    code: `function BuyButton() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}>Buy with PayLater</button>
    );
  }

  return (
    <>
      <PayLaterWidget apiKey="pk_test_examplekey1234567890" />
      <button onClick={() => setOpen(false)}>Hide widget (unmount)</button>
    </>
  );
}`,
    Demo: () => <BuyButtonDemo />,
  },
  {
    id: "events",
    title: "Event handlers (success / phaseChange)",
    description:
      "Wire up partner-side analytics + ledger updates. The success event includes the BNPL reference, settled USDT amount, repayment amount, recipient, custody mode, and (for merchant custody) `merchantUserId`.",
    code: `<PayLaterWidget
  apiKey="pk_test_examplekey1234567890"
  onSuccess={(event) => track("paylater.signed", event)}
  onError={(error) => console.error("[paylater]", error)}
  onPhaseChange={(phase) => console.log("phase →", phase)}
/>`,
    Demo: () => <EventsDemo />,
  },
  {
    id: "pk-live-mode",
    title: "Production key (`pk_live_*`)",
    description:
      "Same widget, same code — only the key prefix changes. Live mode validates against the production token collection and still runs the existing mockEid signing flow; webhook events fired from this session carry `livemode: true` so your backend can route accordingly. The `TEST` chip in the widget header is suppressed when the validated mode is `live`. Provision a real `pk_live_*` via the dashboard once admin grants live access on your account; set it as `VITE_PAYLATER_LIVE_KEY` in `.env` to see this case render against your own key.",
    code: `<PayLaterWidget apiKey="pk_live_xxxxxxxxxxxxxxxxxxxxx" />`,
    Demo: () => <PayLaterWidget apiKey={LIVE_KEY} />,
  },
  {
    id: "webhook-verify-node",
    title: "Verify webhooks on your Node backend (`@paylater/sdk/webhooks`)",
    description:
      "PayLater POSTs each event to the URL configured in your dashboard with an `X-PayLater-Signature: t=<unix>,v1=<hex>` header. The SDK ships a Node-only helper that parses the header, computes the HMAC, and either returns the parsed event or throws a typed error. Default 5-minute two-sided tolerance window guards against both clock skew and replay. The helper lives at the `@paylater/sdk/webhooks` sub-import — it is excluded from browser bundles via the package `exports` map (it depends on `node:crypto`).",
    code: `// Express handler — same pattern works for Fastify, Hono, or a
// serverless function. The raw body is required (not the parsed JSON)
// because the signature is computed over the exact bytes we sent.
import express from "express";
import {
  constructEvent,
  PayLaterSignatureVerificationError,
} from "@paylater/sdk/webhooks";

const app = express();
const SECRET = process.env.PAYLATER_WEBHOOK_SECRET!; // sk_test_... or sk_live_...

app.post(
  "/webhooks/paylater",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const event = constructEvent(
        req.body.toString("utf8"),
        req.header("X-PayLater-Signature") ?? "",
        SECRET,
        // { tolerance: 300 }  // optional; default is 300s, two-sided
      );

      switch (event.type) {
        case "agreement.signed":
          // event.livemode tells you test vs production
          // event.data carries ref, usdt amount, merchantUserId, etc.
          handleAgreementSigned(event);
          break;
        case "test.ping":
          // Fired by the dashboard "Send test event" button
          break;
      }
      res.status(200).end();
    } catch (err) {
      if (err instanceof PayLaterSignatureVerificationError) {
        // err.reason is "invalid_header" | "signature_mismatch" | "timestamp_outside_tolerance"
        return res.status(400).end();
      }
      throw err;
    }
  },
);`,
    Demo: () => <WebhookVerifyDemo />,
  },
];

// EventsDemo + LiveUpdateDemo live in `./demos/` so this file can stay a
// pure data module — Vite's React Fast Refresh requires component files
// not to mix component definitions with non-component exports like CASES.
