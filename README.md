# @paylater/sdk

> Frictionless USDT checkout. Tap, sign, done. Pay within 30 days.

Drop-in widget that lets your customers buy USDT and settle the bill within 30 days, signed with their national eID. Free for partner platforms — PayLater is compensated on the consumer side. No card-network exposure, no chargeback risk on your books.

[paylater.dev](https://paylater.dev) · [Get sandbox keys](https://paylater.dev) · [Talk to partners](mailto:partners@paylater.dev)

---

## Install

```bash
npm install @paylater/sdk
# or
pnpm add @paylater/sdk
# or
yarn add @paylater/sdk
```

## Quick start

### Vanilla JS / TypeScript

```ts
import { PayLater } from "@paylater/sdk";

const widget = PayLater.init({
  apiKey: "pk_live_*",
  product: "bnpl_30d",
  asset: "usdt",

  // Theme — every value optional. Brand colors live under `light` / `dark`.
  theme: {
    light: {
      primary: "oklch(76.02% 0.18901 132.705)",
      accent: "oklch(0.93 0.08 131)",
    },
    dark: {
      primary: "oklch(0.876 0.166 131)",
      accent: "oklch(0.4 0.12 131)",
    },
    radius: "lg",
    mode: "auto", // "light" | "dark" | "auto"
  },

  position: "inline", // "inline" | "inline-popup"
  locale: "en-SE",

  on: {
    success: ({ ref }) => track("paylater.signed", { ref }),
    error: (e) => console.error(e),
  },
});

widget.mount("#paylater");
```

### React

```tsx
import { PayLaterWidget } from "@paylater/sdk/react";

export function Checkout() {
  return (
    <PayLaterWidget
      apiKey="pk_live_*"
      theme={{
        light: {
          primary: "oklch(76.02% 0.18901 132.705)",
          accent: "oklch(0.93 0.08 131)",
        },
        dark: {
          primary: "oklch(0.876 0.166 131)",
          accent: "oklch(0.4 0.12 131)",
        },
        radius: "lg",
        mode: "auto",
      }}
      onSuccess={({ ref }) => console.log("signed", ref)}
    />
  );
}
```

The React adapter wraps the vanilla SDK and handles its own lifecycle. Theme changes update the live widget without remounting.

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

```ts
import { PayLater } from "@paylater/sdk";

PayLater.init({
  apiKey: "pk_live_*",

  // The user is already logged in to your platform — skip everything they
  // shouldn't have to retype.
  prefill: {
    email: "customer@yourplatform.com",
  },
  lock: ["email"], // visible but not editable

  // Off-chain merchant custody: no wallet, no network, no on-chain
  // transfer. PayLater records the obligation, fires `success`, and you
  // increment the user's balance in your own ledger.
  custody: {
    mode: "merchant",
    merchantUserId: "usr_example123", // your internal identifier for the user, for attribution in the webhook
    description: "Deposit to your account",
  },

  on: {
    success: ({ ref, merchantUserId }) => {
      // Use `success` for UX only — show the customer a confirmation state,
      // emit analytics, optimistically refresh their balance display.
      track("paylater.signed", { ref, userId: merchantUserId });
    },
  },
}).mount("#paylater");
```

> **Authoritative settlement runs server-side.** The publishable key (`pk_*`) above is safe to ship in the browser — it can't move money. When the customer signs, PayLater posts the signed credit agreement to your webhook endpoint, signed with your secret key (`sk_*`). That webhook is what actually credits the user's balance and flags the deposit as PayLater-funded. Treat the client-side `success` event as a UX cue, not as authorization.

Prefer to receive USDT on-chain into your hot wallet instead of crediting off-chain? Pass `settlementAddress` + `settlementNetwork` together — the end-user UX is identical, only PayLater's settlement path changes.

## How it works

The SDK renders inside a **Shadow DOM** attached to your mount target. That means:

- ✅ Your CSS can never break the widget — every selector is isolated
- ✅ The widget's CSS can never leak into your page — no global pollution
- ✅ Theming flows through CSS custom properties on the `:host`, so live updates are cheap
- ✅ The widget renders in your domain — no redirects, no swap funnels, no drop-off

## API

### `PayLater.init(options)`

Returns a `WidgetInstance`. Call `mount()` on the result.

| Option      | Type                                                           | Default                    | Notes                                                                                                                                  |
| ----------- | -------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey`    | `string` (required)                                            | —                          | Starts with `pk_test_` or `pk_live_`                                                                                                   |
| `product`   | `"bnpl_30d"`                                                   | `"bnpl_30d"`               | Only one product variant for now                                                                                                       |
| `asset`     | `"usdt"`                                                       | `"usdt"`                   | Only one asset variant for now                                                                                                         |
| `theme`     | `ThemeOptions`                                                 | brand defaults             | See below                                                                                                                              |
| `position`  | `"inline" \| "inline-popup"`                                   | `"inline"`                 | See "Position modes" below.                                                                                                            |
| `locale`    | BCP-47 string                                                  | auto-detected              | Falls back to country default                                                                                                          |
| `country`   | `"SE" \| "NO" \| "FI" \| "DK" \| "DE" \| "FR" \| "NL" \| "GB"` | auto-detected              | Pre-select; user can change unless `lock` includes `"country"`                                                                         |
| `amount`    | `number`                                                       | country min                | Pre-fill the amount slider in local currency                                                                                           |
| `prefill`   | `PrefillOptions`                                               | `{}`                       | Pre-populate email / wallet / network / fullName — see below                                                                           |
| `hide`      | `FieldId[]`                                                    | `[]`                       | Remove fields from the UI entirely (must be covered by prefill)                                                                        |
| `lock`      | `FieldId[]`                                                    | `[]`                       | Make fields read-only (must be covered by prefill)                                                                                     |
| `custody`   | `CustodyOptions`                                               | `{ mode: "self" }`         | `"self"` ships USDT on-chain to user wallet; `"merchant"` lets the partner credit the user's balance internally (off-chain by default) |
| `on`        | `EventHandlers`                                                | —                          | See below                                                                                                                              |
| `apiOrigin` | `string`                                                       | `https://api.paylater.dev` | QA-environment override                                                                                                                |

### Position modes

How the widget renders relative to its mount target.

| Position         | Behavior                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"inline"`       | Entire flow stays in one tile at the mount target. Every phase (amount → delivery → sign → done) renders in the same card. No page-level overlay. Use this for dedicated checkout pages.                  |
| `"inline-popup"` | Amount step renders inline at the mount target. When the customer clicks Continue, the rest of the flow pops up as a viewport-centered overlay. Best for landing pages where the inline tile is a teaser. |

### `PrefillOptions`

Anything you set here renders as the initial value. Pair with `lock` to make a prefilled field read-only or `hide` to remove it entirely.

| Field           | Type      | Notes                                                                 |
| --------------- | --------- | --------------------------------------------------------------------- |
| `email`         | `string`  | Customer email — receipt + repayment reminders go here                |
| `walletAddress` | `string`  | Self-custody recipient wallet (ignored when `custody="merchant"`)     |
| `network`       | `Network` | Settlement chain for self-custody (ignored when `custody="merchant"`) |
| `fullName`      | `string`  | Pre-resolved legal name from your KYC — presentation-only             |

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

```ts
PayLater.init({
  apiKey: "pk_live_*",
  theme: {
    radius: "lg",
    mode: "auto",
    // Per-mode brand colors. Set both, one, or neither — defaults take over
    // for anything you omit.
    light: { primary: "oklch(76.02% 0.18901 132.705)", accent: "oklch(0.93 0.08 131)" },
    dark: { primary: "oklch(0.876 0.166 131)", accent: "oklch(0.4 0.12 131)" },
  },
});
```

### `EventHandlers`

```ts
on: {
  success?: (event: SuccessEvent) => void;       // signed credit agreement
  error?:   (event: ErrorEvent) => void;         // unrecoverable failure
  close?:   (event: CloseEvent) => void;         // dismissed mid-flow
  ready?:   () => void;                          // mounted and ready
  phaseChange?: (phase: "amount" | "delivery" | "sign" | "done") => void;
}
```

### `WidgetInstance`

The object returned by `init()`.

| Method          | Effect                                                                             |
| --------------- | ---------------------------------------------------------------------------------- |
| `mount(target)` | Mount at a CSS selector or `HTMLElement`. Idempotent.                              |
| `unmount()`     | Detach + clean up. Fires `close` with `abandoned: true` if mid-flow.               |
| `update(opts)`  | Patch options on the fly. Theme + handlers are reactive; everything else remounts. |
| `phase`         | Current phase (read-only)                                                          |
| `mounted`       | Whether the widget is currently mounted (read-only)                                |

## Error codes

| Code                    | When                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| `invalid_api_key`       | `apiKey` is missing or not in `pk_(test\|live)_*` shape          |
| `country_not_supported` | `country` is set to an ISO that PayLater does not yet operate in |
| `amount_out_of_range`   | `amount` is outside the country's `[min, max]` range             |
| `wallet_invalid`        | The wallet address fails network-specific validation             |
| `eid_signing_failed`    | The eID provider returned a failure or the QR session expired    |
| `network_error`         | Lost connectivity during a backend call                          |
| `unknown`               | Catch-all — `cause` is populated                                 |

## Try it locally

A live showcase of every SDK configuration lives at `examples/all-cases/` — a Vite React app that renders each scenario alongside the exact code that produced it. Run it locally:

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

#### API key

The showcase reads its sandbox key from `VITE_PAYLATER_API_KEY` in `examples/all-cases/.env`. The `.env.example` file ships with a placeholder — replace it with your own `pk_test_*` key (issued from [paylater.dev](https://paylater.dev)) to clear the widget's "Provide a valid `pk_test_*` API key" warning. Without a `.env`, the showcase falls back to a placeholder so the layout still renders, but the Continue button stays disabled with the warning shown.

Vite serves it on `http://localhost:5174`. Toggle the host-page theme at the top of the page to see every widget set to `mode: "auto"` flip in lockstep.

The showcase covers: both position modes (inline / inline-popup), country presets and locks, prefilled / hidden / locked fields, both custody modes (off-chain + on-chain), per-mode brand themes, forced light/dark mode, custom radius and font family, and an event-handlers panel that surfaces the `success` / `phaseChange` payloads inline.

There are also two minimal entry points if you just want a single file to copy:

- **`examples/react.tsx`** — drop-in React component
- **`examples/vanilla.html`** — single-file ES module import

## Markets

PayLater is live in 8 European markets: 🇸🇪 🇳🇴 🇫🇮 🇩🇰 🇩🇪 🇫🇷 🇳🇱 🇬🇧 — full eID coverage via Scrive.

## Browser support

Modern evergreen browsers: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+. Shadow DOM, ES2022, and CSS custom properties are required. No polyfills are bundled.

## License

MIT
