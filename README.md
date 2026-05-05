# @paylaterorg/sdk

> Frictionless USDT checkout. Tap, sign, done. Pay within 30 days.

Drop-in widget that lets your customers buy USDT and settle the bill within 30 days, signed with their national eID. Free for partner platforms — PayLater is compensated on the consumer side. No card-network exposure, no chargeback risk on your books.

[paylater.dev](https://paylater.dev) · [Get sandbox keys](https://paylater.dev) · [Talk to partners](mailto:partners@paylater.dev)

---

## Install

```bash
npm install @paylaterorg/sdk
# or
pnpm add @paylaterorg/sdk
# or
yarn add @paylaterorg/sdk
```

## Quick start

### Vanilla JS / TypeScript

```ts
import { PayLater } from "@paylaterorg/sdk";

const widget = PayLater.init({
  apiKey: "pk_live_*",
  product: "bnpl_30d",
  asset: "usdt",

  // Theme — every value optional
  theme: {
    primary: "#B2E67C",
    radius: "lg",
    mode: "auto", // "light" | "dark" | "auto"
  },

  position: "inline", // "inline" | "modal" | "drawer"
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
import { PayLaterWidget } from "@paylaterorg/sdk/react";

export function Checkout() {
  return (
    <PayLaterWidget
      apiKey="pk_live_*"
      theme={{ primary: "#B2E67C", radius: "lg", mode: "auto" }}
      onSuccess={({ ref }) => console.log("signed", ref)}
    />
  );
}
```

The React adapter wraps the vanilla SDK and handles its own lifecycle. Theme changes update the live widget without remounting.

### CDN (browser, no build step)

```html
<script type="module">
  import { PayLater } from "https://esm.sh/@paylaterorg/sdk";
  PayLater.init({ apiKey: "pk_test_*" }).mount("#paylater");
</script>
<div id="paylater"></div>
```

### Custodial integration

When the partner runs a custodial product — exchanges, gambling platforms, neobank wallets — the customer doesn't need to see USDT plumbing at all. The partner just credits the user's internal balance off-chain and flags the deposit as PayLater-funded, so withdrawals stay locked until the BNPL invoice settles within 30 days.

```ts
import { PayLater } from "@paylaterorg/sdk";

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
    merchantUserId: "usr_4029381", // your internal identifier for the user, for attribution in the webhook
    description: "Deposit to your account",
  },

  on: {
    success: ({ ref, amount, merchantUserId }) => {
      // Credit the user internally + flag the deposit as PayLater-funded
      // so withdrawals stay locked until the BNPL agreement settles.
      yourBackend.creditUser(merchantUserId, amount, { paylaterRef: ref });
    },
  },
}).mount("#paylater");
```

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
| `position`  | `"inline" \| "modal" \| "drawer"`                              | `"inline"`                 | Modal + drawer require explicit `widget.open()`                                                                                        |
| `locale`    | BCP-47 string                                                  | auto-detected              | Falls back to country default                                                                                                          |
| `country`   | `"SE" \| "NO" \| "FI" \| "DK" \| "DE" \| "FR" \| "NL" \| "GB"` | auto-detected              | Pre-select; user can change unless `lock` includes `"country"`                                                                         |
| `amount`    | `number`                                                       | country min                | Pre-fill the amount slider in local currency                                                                                           |
| `prefill`   | `PrefillOptions`                                               | `{}`                       | Pre-populate email / wallet / network / fullName — see below                                                                           |
| `hide`      | `FieldId[]`                                                    | `[]`                       | Remove fields from the UI entirely (must be covered by prefill)                                                                        |
| `lock`      | `FieldId[]`                                                    | `[]`                       | Make fields read-only (must be covered by prefill)                                                                                     |
| `custody`   | `CustodyOptions`                                               | `{ mode: "self" }`         | `"self"` ships USDT on-chain to user wallet; `"merchant"` lets the partner credit the user's balance internally (off-chain by default) |
| `on`        | `EventHandlers`                                                | —                          | See below                                                                                                                              |
| `apiOrigin` | `string`                                                       | `https://api.paylater.dev` | QA-environment override                                                                                                                |

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

| Token        | Type                                     | Default           |
| ------------ | ---------------------------------------- | ----------------- |
| `primary`    | CSS color                                | PayLater lime     |
| `accent`     | CSS color                                | tint of `primary` |
| `radius`     | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | `"lg"`            |
| `mode`       | `"light" \| "dark" \| "auto"`            | `"auto"`          |
| `fontFamily` | CSS font-family                          | system stack      |

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
| `open()`        | Modal/drawer only — open the overlay                                               |
| `close()`       | Modal/drawer only — close the overlay                                              |
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

## Markets

PayLater is live in 8 European markets: 🇸🇪 🇳🇴 🇫🇮 🇩🇰 🇩🇪 🇫🇷 🇳🇱 🇬🇧 — full eID coverage via Scrive.

## Browser support

Modern evergreen browsers: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+. Shadow DOM, ES2022, and CSS custom properties are required. No polyfills are bundled.

## License

MIT
