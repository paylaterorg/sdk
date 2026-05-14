# @paylater/sdk

> Frictionless USDT checkout. Tap, sign, done. Pay within 30 days.

Drop-in widget that lets your customers buy USDT and settle the bill within 30 days, signed with their national eID. Free for partner platforms — PayLater is compensated on the consumer side. No card-network exposure, no chargeback risk on your books.

[paylater.dev](https://paylater.dev) · [Create developer account](https://paylater.dev/register) · [Contact us](mailto:contact@paylater.dev)

---

## Install

```bash
npm install @paylater/sdk
# or
pnpm add @paylater/sdk
# or
yarn add @paylater/sdk
# or
bun add @paylater/sdk
```

The React adapter (`@paylater/sdk/react`) declares `react` and `react-dom` as **optional peer dependencies** — install them only if you use it. The vanilla entry point (`@paylater/sdk`) has zero runtime dependencies on your end.

You'll also need a sandbox key (`pk_test_*`) to render the widget without warnings:

1. Create a free developer account at [paylater.dev/register](https://paylater.dev/register) and verify your email.
2. In the dashboard, click **Create test token** and copy the `pk_test_*` issued once. That's it — drop the key into your widget and you're integrated.

Production keys (`pk_live_*`) are issued after a short partner call — book it from the dashboard once your sandbox integration looks right.

## Quick start

### React (recommended)

```tsx
import { PayLaterWidget } from "@paylater/sdk/react";

export function Checkout() {
  return <PayLaterWidget apiKey="pk_test_*" onSuccess={({ ref }) => console.log("signed", ref)} />;
}
```

That's it — three taps from your customer to a signed 30-day BNPL agreement. The adapter wraps the vanilla SDK and handles its own lifecycle; theme changes patch the live widget without remounting.

A fuller example with theme tokens, locale, and event handlers:

```tsx
<PayLaterWidget
  apiKey="pk_test_*"
  position="inline" // "inline" | "inline-popup"
  locale="en-SE"
  theme={{
    radius: "lg",
    mode: "auto", // "light" | "dark" | "auto"
    light: {
      primary: "oklch(76.02% 0.18901 132.705)",
      accent: "oklch(0.93 0.08 131)",
    },
    dark: {
      primary: "oklch(0.876 0.166 131)",
      accent: "oklch(0.4 0.12 131)",
    },
  }}
  onReady={() => console.log("widget mounted")}
  onSuccess={(event) => track("paylater.signed", event)}
  onError={(error) => console.error("[paylater]", error)}
  onPhaseChange={(phase) => console.log("phase →", phase)}
/>
```

### Vanilla JS / TypeScript

```ts
import { PayLater } from "@paylater/sdk";

const widget = PayLater.init({
  apiKey: "pk_test_*",
  on: {
    success: ({ ref }) => track("paylater.signed", { ref }),
    error: (e) => console.error(e),
  },
});

widget.mount("#paylater");
```

Same options surface as the React adapter — see the API tables below.

### CDN (browser, no build step)

```html
<script type="module">
  import { PayLater } from "https://esm.sh/@paylater/sdk";
  PayLater.init({ apiKey: "pk_test_*" }).mount("#paylater");
</script>
<div id="paylater"></div>
```

### Custodial integration

When the partner runs a custodial product — exchanges, gambling platforms, neobank wallets — the customer doesn't need to see USDT plumbing at all. The partner just credits the user's internal balance off-chain and flags the deposit as PayLater-funded, so withdrawals stay locked until the BNPL invoice settles within 30 days.

```tsx
import { PayLaterWidget } from "@paylater/sdk/react";

export function Deposit() {
  return (
    <PayLaterWidget
      apiKey="pk_test_*"
      // The user is already logged in to your platform — skip everything they
      // shouldn't have to retype.
      prefill={{ email: "customer@yourplatform.com" }}
      lock={["email"]} // visible but not editable
      // Off-chain merchant custody: no wallet, no network, no on-chain
      // transfer. PayLater records the obligation, fires `success`, and your
      // backend credits the user's balance from the signed webhook.
      custody={{
        mode: "merchant",
        merchantUserId: "usr_example123", // your internal id, echoed in the webhook
        description: "Deposit to your account",
      }}
      onSuccess={({ ref, merchantUserId }) => {
        // `success` is for UX (toasts, redirects, optimistic balance updates).
        // The authoritative credit happens in your webhook handler.
        track("paylater.signed", { ref, userId: merchantUserId });
      }}
    />
  );
}
```

> **Authoritative settlement runs server-side.** The publishable key (`pk_*`) is safe to ship in the browser — it can't move money. When the customer signs, PayLater posts the signed credit agreement to your webhook endpoint, signed with your secret key (`sk_*`). That webhook is what actually credits the user's balance and flags the deposit as PayLater-funded. Treat the client-side `success` event as a UX cue, not as authorization.

Prefer to receive USDT on-chain into your hot wallet instead of crediting off-chain? Pass `settlementAddress` + `settlementNetwork` together — the end-user UX is identical, only PayLater's settlement path changes.

## How it works

The SDK renders inside a **Shadow DOM** attached to your mount target. That means:

- ✅ Your CSS can never break the widget — every selector is isolated
- ✅ The widget's CSS can never leak into your page — no global pollution
- ✅ Theming flows through CSS custom properties on the `:host`, so live updates are cheap
- ✅ The widget renders in your domain — no redirects, no swap funnels, no drop-off

## API

### `PayLater.init(options)` / `<PayLaterWidget {...options} />`

Returns a `WidgetInstance` (vanilla) or renders a self-managing component (React). Both consume the same option surface.

| Option       | Type                                                           | Default                      | Notes                                                                                                                                                       |
| ------------ | -------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey`     | `string` (required)                                            | —                            | Starts with `pk_test_` or `pk_live_`. Verified against the PayLater API on mount; an unrecognized or unreachable key replaces the flow with an error panel. |
| `apiBaseUrl` | `string`                                                       | `"https://api.paylater.dev"` | Override the API origin used for the on-mount key check. Mainly useful for self-host or local dev.                                                          |
| `theme`      | `ThemeOptions`                                                 | brand defaults               | See below                                                                                                                                                   |
| `position`   | `"inline" \| "inline-popup"`                                   | `"inline"`                   | See "Position modes" below.                                                                                                                                 |
| `locale`     | BCP-47 string                                                  | auto-detected                | Falls back to country default                                                                                                                               |
| `country`    | `"SE" \| "NO" \| "FI" \| "DK" \| "DE" \| "FR" \| "NL" \| "GB"` | auto-detected                | Pre-select; user can change unless `lock` includes `"country"`                                                                                              |
| `amount`     | `number`                                                       | country min                  | Pre-fill the amount slider in local currency                                                                                                                |
| `prefill`    | `PrefillOptions`                                               | `{}`                         | Pre-populate email / wallet / network / fullName — see below                                                                                                |
| `hide`       | `FieldId[]`                                                    | `[]`                         | Remove fields from the UI entirely (must be covered by prefill)                                                                                             |
| `lock`       | `FieldId[]`                                                    | `[]`                         | Make fields read-only (must be covered by prefill)                                                                                                          |
| `custody`    | `CustodyOptions`                                               | `{ mode: "self" }`           | `"self"` ships USDT on-chain to user wallet; `"merchant"` lets the partner credit the user's balance internally (off-chain by default)                      |
| `on`         | `EventHandlers`                                                | —                            | Vanilla SDK only — the React adapter takes `onSuccess`, `onError`, `onClose`, `onReady`, `onPhaseChange` as top-level props                                 |

### Position modes

How the widget renders relative to its mount target.

| Position         | Behavior                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"inline"`       | Entire flow stays in one tile at the mount target. Every phase (amount → delivery → sign → done) renders in the same card. No page-level overlay. Use this for dedicated checkout pages.                  |
| `"inline-popup"` | Amount step renders inline at the mount target. When the customer clicks Continue, the rest of the flow pops up as a viewport-centered overlay. Best for landing pages where the inline tile is a teaser. |

### `PrefillOptions`

Anything you set here renders as the initial value. Pair with `lock` to make a prefilled field read-only or `hide` to remove it entirely.

| Field           | Type      | Notes                                                                   |
| --------------- | --------- | ----------------------------------------------------------------------- |
| `email`         | `string`  | Customer email — receipt + repayment reminders go here                  |
| `walletAddress` | `string`  | Self-custody recipient wallet (ignored when `custody="merchant"`)       |
| `network`       | `Network` | Settlement chain for self-custody (ignored when `custody="merchant"`)   |
| `fullName`      | `string`  | Pre-resolved legal name from your KYC — surfaced on the success summary |

### `FieldId`

`"amount" | "country" | "email" | "walletAddress" | "network" | "fullName"` — the field identifiers used in `hide` and `lock`.

### `CustodyOptions`

How the BNPL settlement reaches the end customer.

#### `{ mode: "self" }` — default

USDT lands in the customer's own wallet. The widget shows the network picker + wallet-address input during the delivery phase.

#### `{ mode: "merchant", merchantUserId, ... }`

The wallet/network UI is hidden — the customer only sees amount → eID sign → done. By **default this is off-chain**: PayLater records the obligation, fires `success`, and the partner increments the user's balance in their own ledger. No wallet, no network, no transfer.

If the partner prefers to receive USDT on-chain into their hot wallet, pass `settlementAddress` + `settlementNetwork` together. The customer experience is identical — only PayLater's settlement path changes.

| Field               | Type         | Required                 | Notes                                                                                                |
| ------------------- | ------------ | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `mode`              | `"merchant"` | yes                      | Discriminator                                                                                        |
| `merchantUserId`    | `string`     | yes                      | Your identifier for the user — echoed back via `SuccessEvent.merchantUserId` for webhook attribution |
| `settlementAddress` | `string`     | no                       | Optional on-chain settlement to your hot wallet. Omit for the default off-chain credit flow          |
| `settlementNetwork` | `Network`    | with `settlementAddress` | Required when `settlementAddress` is set                                                             |
| `description`       | `string`     | no                       | Surfaced on the confirmation screen (e.g. `"Deposit to your account"`)                               |

### `ThemeOptions`

Brand colors are inherently mode-specific (a lime that pops on dark forest washes out on white) so the SDK exposes them only inside `light` / `dark`. Layout and typography knobs that don't change between modes sit at the top level.

| Token        | Type                                     | Default      | Notes                                                                                                            |
| ------------ | ---------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `radius`     | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | `"lg"`       | Border-radius scale for cards, buttons, inputs.                                                                  |
| `mode`       | `"light" \| "dark" \| "auto"`            | `"auto"`     | `"auto"` follows your page (Tailwind `.dark`, `data-theme`, `style.colorScheme`, OS preference — in that order). |
| `fontFamily` | CSS font-family                          | system stack | Falls back to the Apple system stack.                                                                            |
| `light`      | `ThemeColors`                            | brand lime   | Brand colors used when the widget renders in light mode.                                                         |
| `dark`       | `ThemeColors`                            | brand lime   | Brand colors used when the widget renders in dark mode.                                                          |

#### `ThemeColors`

| Token     | Type      | Notes                                      |
| --------- | --------- | ------------------------------------------ |
| `primary` | CSS color | Brand primary color for that color scheme. |
| `accent`  | CSS color | Brand accent color for that color scheme.  |

```tsx
<PayLaterWidget
  apiKey="pk_test_*"
  theme={{
    radius: "lg",
    mode: "auto",
    // Per-mode brand colors. Set both, one, or neither — defaults take over
    // for anything you omit. Values below match the SDK's bundled defaults.
    light: { primary: "oklch(76.02% 0.18901 132.705)", accent: "oklch(0.93 0.08 131)" },
    dark: { primary: "oklch(0.876 0.166 131)", accent: "oklch(0.4 0.12 131)" },
  }}
/>
```

### `EventHandlers`

Vanilla SDK accepts an `on: { ... }` object. The React adapter exposes the same handlers as top-level props (`onSuccess`, `onError`, `onClose`, `onReady`, `onPhaseChange`).

```ts
on: {
  success?: (event: SuccessEvent) => void;       // signed credit agreement
  error?:   (event: ErrorEvent) => void;         // unrecoverable failure
  close?:   (event: CloseEvent) => void;         // unmounted (abandoned: true if mid-flow)
  ready?:   () => void;                          // mounted and ready
  phaseChange?: (phase: "amount" | "delivery" | "sign" | "done") => void;
}
```

### `WidgetInstance`

The object returned by `PayLater.init()` (vanilla SDK only — the React adapter manages it for you).

| Method          | Effect                                                                             |
| --------------- | ---------------------------------------------------------------------------------- |
| `mount(target)` | Mount at a CSS selector or `HTMLElement`. Idempotent.                              |
| `unmount()`     | Detach + clean up. Fires `close` with `abandoned: true` if mid-flow.               |
| `update(opts)`  | Patch options on the fly. Theme + handlers are reactive; everything else remounts. |
| `phase`         | Current phase (read-only)                                                          |
| `mounted`       | Whether the widget is currently mounted (read-only)                                |

## Error codes

| Code                    | When                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `invalid_api_key`       | `apiKey` is missing, not in `pk_(test\|live)_*` shape, or the PayLater API does not recognize it  |
| `country_not_supported` | `country` is set to an ISO that PayLater does not yet operate in                                  |
| `amount_out_of_range`   | `amount` is outside the country's `[min, max]` range                                              |
| `wallet_invalid`        | The wallet address fails network-specific validation                                              |
| `eid_signing_failed`    | The eID provider returned a failure or the QR session expired                                     |
| `network_error`         | Lost connectivity during a backend call (including the on-mount key check, which blocks the flow) |
| `unknown`               | Catch-all — `cause` is populated                                                                  |

## Try it locally

A live showcase of every SDK configuration lives at `examples/all-cases/` — a Vite React app that renders each scenario alongside the exact code that produced it (and a one-tap copy button on every snippet).

```bash
git clone https://github.com/paylaterorg/sdk.git
cd sdk

# Build the SDK once so the example can resolve `@paylater/sdk` via its file dep
npm install
npm run build

# Then boot the showcase
cd examples/all-cases
npm install
cp .env.example .env       # plug in your sandbox key — see "API key" below
npm run dev
```

Vite serves it on `http://localhost:5174`. Toggle the host-page theme at the top of the page to see every widget set to `mode: "auto"` flip in lockstep.

#### API key

The showcase reads its sandbox key from `VITE_PAYLATER_API_KEY` in `examples/all-cases/.env`. The `.env.example` file ships with a placeholder — replace it with your own `pk_test_*` key (issued from [paylater.dev/register](https://paylater.dev/register)) to clear the widget's "Provide a valid `pk_test_*` API key" warning. Without a `.env`, the showcase falls back to a placeholder so the layout still renders, but the Continue button stays disabled with the warning shown.

#### What's covered

Both position modes (inline / inline-popup), country presets and locks, prefilled / hidden / locked fields, both custody modes (off-chain + on-chain), per-mode brand themes, forced light/dark mode, custom radius and font family, live theme updates via `update()`, and an event-handlers panel that surfaces the `success` / `phaseChange` payloads inline.

#### Minimal entry points

If you just want a single file to copy:

- **`examples/react.tsx`** — drop-in React component
- **`examples/vanilla.html`** — single-file ES module import

## Markets

PayLater is live in 8 European markets: 🇸🇪 🇳🇴 🇫🇮 🇩🇰 🇩🇪 🇫🇷 🇳🇱 🇬🇧 — full eID coverage via Scrive.

## Browser support

Modern evergreen browsers: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+. Shadow DOM, ES2022, and CSS custom properties are required. No polyfills are bundled.

## License

MIT
