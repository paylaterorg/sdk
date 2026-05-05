/**
 * @dev Public type surface for @paylater/sdk.
 *
 * Anything exported from this file is part of the SDK's public API and is
 * subject to semver. Internal types live next to their implementation.
 */

/**
 * @dev Currencies supported by PayLater across the 8 live markets.
 */
export type Currency = "SEK" | "NOK" | "EUR" | "DKK" | "GBP";

/**
 * @dev ISO-3166 codes for the 8 markets where PayLater is currently live.
 */
export type CountryCode = "SE" | "NO" | "FI" | "DK" | "DE" | "FR" | "NL" | "GB";

/**
 * @dev Settlement networks supported for USDT delivery.
 *
 * The chain determines which token variant the customer receives
 * (USDT-SPL, USDT-ERC20, etc.) and the fee model.
 */
export type Network = "solana" | "ethereum" | "polygon" | "tron" | "arbitrum" | "base";

/**
 * @dev Asset variants offered by PayLater. Currently only USDT.
 */
export type Asset = "usdt";

/**
 * @dev Product variants. v1 is bnpl_30d (Buy now, Pay within 30 days).
 */
export type Product = "bnpl_30d";

/**
 * @dev How the widget renders relative to its mount target.
 */
export type Position = "inline" | "modal" | "drawer";

/**
 * @dev Color-scheme mode the widget renders in.
 */
export type ColorMode = "light" | "dark" | "auto";

/**
 * @dev Border-radius scale tokens.
 */
export type RadiusScale = "none" | "sm" | "md" | "lg" | "xl";

/**
 * @dev Per-locale BCP-47 tags PayLater can render the UI in.
 */
export type Locale =
  | "en-SE"
  | "en-NO"
  | "en-FI"
  | "en-DK"
  | "en-DE"
  | "en-FR"
  | "en-NL"
  | "en-GB"
  | "sv-SE"
  | "nb-NO"
  | "fi-FI"
  | "da-DK"
  | "de-DE"
  | "fr-FR"
  | "nl-NL";

/**
 * @dev Theming knobs surfaced to partners.
 */
export interface ThemeOptions {
  primary?: string; // Brand primary color. Accepts any CSS color. Defaults to PayLater lime.
  radius?: RadiusScale; // Border-radius scale for cards, buttons, inputs. Defaults to "lg".
  mode?: ColorMode; // Color scheme. "auto" follows the host page or OS. Defaults to "auto".
  accent?: string; // Optional accent color override (defaults to a tint of `primary`).
  fontFamily?: string; // Font family override. Falls back to system fonts.
}

/* -------------------------------------------------------------------------- */
/* Custody                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * @dev How the BNPL settlement reaches the end customer.
 *
 * - `"self"` (default) — USDT lands in the customer's own self-custodial
 *   wallet. The widget shows the network picker + wallet-address input
 *   during the delivery phase, and the customer types/pastes their address.
 *
 * - `"merchant"` — the partner credits the customer's internal balance
 *   directly. By default this is purely off-chain: PayLater records the
 *   obligation, fires `success`, and the partner increments the user's
 *   balance in their own ledger — no wallet, no network, no on-chain
 *   transfer. The wallet/network UI is hidden. Useful when the partner runs
 *   a custodial product (exchange, gambling site, neobank wallet) where the
 *   user already has a balance and doesn't need to see USDT plumbing.
 *
 *   Optionally, the partner can supply `settlementAddress` +
 *   `settlementNetwork` to receive the USDT on-chain into their own hot
 *   wallet instead. Same UX, just an extra hop on PayLater's side.
 */
export type CustodyMode = "self" | "merchant";

/**
 * @dev Configuration for `custody: { mode: "merchant" }`.
 *
 * The widget hides the network picker + wallet-address input. The default
 * is off-chain — the partner credits the user's internal balance after
 * `success` fires. Pass `settlementAddress` + `settlementNetwork` to opt
 * into on-chain settlement to the partner's hot wallet instead.
 */
export interface MerchantCustodyOptions {
  mode: "merchant"; // Discriminant for the union. Must be "merchant" to activate merchant custody mode.

  /**
   * The merchant's identifier for the end user. Echoed back to the partner
   * via `SuccessEvent.merchantUserId` so webhooks and ledgers can attribute
   * the BNPL deposit to the right account.
   */
  merchantUserId: string;

  /**
   * Optional: receive USDT on-chain into the partner's hot wallet instead of
   * crediting off-chain. Omit for the default off-chain flow where the
   * partner just increments the user's balance internally.
   */
  settlementAddress?: string;

  /**
   * Chain to settle on. Required when `settlementAddress` is set.
   */
  settlementNetwork?: Network;

  /**
   * Optional human-readable description of the deposit, surfaced to the
   * customer on the confirmation screen (e.g. "Deposit to your account").
   * Falls back to a generic copy.
   */
  description?: string;
}

/**
 * @dev Configuration for `custody: { mode: "self" }`. The default.
 */
export interface SelfCustodyOptions {
  mode: "self"; // Discriminant for the union. Must be "self" to activate self custody mode.
}

/**
 * @dev Discriminated union for the `custody` option.
 */
export type CustodyOptions = SelfCustodyOptions | MerchantCustodyOptions;

/* -------------------------------------------------------------------------- */
/* Prefill, hide, lock                                                        */
/* -------------------------------------------------------------------------- */

/**
 * @dev IDs of input fields the partner can hide or lock.
 *
 * - **Hide** removes the field from the UI entirely. Hidden fields must be
 *   covered by either `prefill` or `custody.mode === "merchant"` (which
 *   automatically hides `walletAddress` + `network`).
 * - **Lock** keeps the field visible but read-only — useful for showing the
 *   pre-filled value without letting the customer change it. Locked fields
 *   must be supplied via `prefill` (or one of the top-level shorthands like
 *   `country` / `amount`).
 */
export type FieldId = "amount" | "country" | "email" | "walletAddress" | "network" | "fullName";

/**
 * @dev Pre-populate any field in the flow.
 *
 * Fields left undefined here are blank and editable by the customer. Pair with `lock` to make a field read-only, or `hide` to remove it from the UI.
 */
export interface PrefillOptions {
  email?: string; // Customer email — receipt + repayment reminders go here.

  /**
   * Self-custody recipient wallet. Ignored when `custody.mode === "merchant"`.
   * Must match the format expected by `network`.
   */
  walletAddress?: string;

  network?: Network; // Settlement network for self-custody. Ignored when merchant-managed.

  /**
   * Pre-resolved legal name from the partner's KYC. Becomes the displayed
   * value in the eID phase. The actual contract is still bound to whatever
   * the eID issuer returns — this is presentation-only.
   */
  fullName?: string;
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * @dev Payload delivered to `on.success`.
 */
export interface SuccessEvent {
  ref: string; // Server-side reference for the signed credit agreement.
  network: Network; // Settlement network used. In merchant custody, this is the partner's chain.
  usdt: number; // USDT amount settled.
  amount: number; // Local-currency amount the customer will repay within 30 days.
  country: CountryCode; // ISO-3166 code of the country the customer signed in.
  custody: CustodyMode; // Custody mode this transaction settled under.

  /**
   * Wallet/account that received the USDT.
   *
   * - In `self` custody: the customer's wallet address.
   * - In `merchant` custody: the partner's settlement address when on-chain
   *   settlement is configured, or `null` for the default off-chain flow
   *   where the partner credits the user's balance internally.
   */
  recipient: string | null;

  /**
   * The partner's identifier for the end user. Present only when
   * `custody.mode === "merchant"`. Echoes back what the partner passed in
   * `custody.merchantUserId` so webhooks can attribute the deposit.
   */
  merchantUserId?: string;
}

/**
 * @dev Payload delivered to `on.error`.
 */
export interface ErrorEvent {
  /**
   * Stable error code. See README for the full table.
   */
  code:
    | "invalid_api_key"
    | "country_not_supported"
    | "amount_out_of_range"
    | "wallet_invalid"
    | "eid_signing_failed"
    | "network_error"
    | "missing_prefill"
    | "merchant_custody_misconfigured"
    | "unknown";

  message: string; // Human-readable message. Localized when possible.
  cause?: unknown; // Underlying cause when available (network errors, etc.).
}

/**
 * @dev Payload delivered to `on.close`.
 */
export interface CloseEvent {
  abandoned: boolean; // True if the customer closed the widget mid-flow without signing.
  phase: "amount" | "delivery" | "sign" | "done"; // Phase the customer was in at close.
}

/**
 * @dev Lifecycle callbacks. All optional.
 */
export interface EventHandlers {
  success?: (event: SuccessEvent) => void; // Fires when the customer successfully signs the credit agreement.
  error?: (event: ErrorEvent) => void; // Fires when an unrecoverable error stops the flow.
  close?: (event: CloseEvent) => void; // Fires when the widget is dismissed (modal/drawer) or unmounted.
  ready?: () => void; // Fires once when the widget has mounted and is ready to interact.

  /**
   * Fires whenever the customer changes phase. Useful for analytics.
   * Phases: amount → delivery → sign → done.
   */
  phaseChange?: (phase: "amount" | "delivery" | "sign" | "done") => void;
}

/* -------------------------------------------------------------------------- */
/* Init options                                                               */
/* -------------------------------------------------------------------------- */

/**
 * @dev Options accepted by `PayLater.init()`.
 */
export interface PayLaterOptions {
  apiKey: string; // Publishable API key. `pk_test_*` for sandbox, `pk_live_*` for production.
  product?: Product; // Product variant. Currently only `"bnpl_30d"`.
  asset?: Asset; // Asset variant. Currently only `"usdt"`.
  theme?: ThemeOptions; // Theme tokens. Merged over the brand defaults.
  position?: Position; // How the widget renders. Inline (default), Modal, or Drawer.
  locale?: Locale; // Locale for the widget UI. Falls back to the customer's detected country.
  country?: CountryCode; // Pre-select a country at mount time. The customer can still change it.
  amount?: number; // Pre-fill the amount slider in local currency. Clamped to the country's range.

  /**
   * Pre-populate any combination of email, wallet address, network, or full
   * name. See {@link PrefillOptions} for the field-by-field reference. Pair
   * with `lock` to make a prefilled field read-only, or `hide` to remove it.
   */
  prefill?: PrefillOptions;

  /**
   * Hide fields from the UI. Hidden fields must be covered by `prefill`
   * (or by `custody.mode === "merchant"` for `walletAddress` / `network`).
   */
  hide?: FieldId[];

  /**
   * Lock fields — keep them visible but read-only. Locked fields must be
   * supplied via `prefill` (or `country` / `amount` at the top level).
   */
  lock?: FieldId[];

  /**
   * Settlement custody. `"self"` (default) sends USDT to the customer's
   * wallet. `"merchant"` settles to the partner and the partner credits the
   * user internally — see {@link MerchantCustodyOptions}.
   */
  custody?: CustodyOptions;

  on?: EventHandlers; // Lifecycle callbacks.

  /**
   * Override the API origin. Useful for QA environments.
   * Defaults to `https://api.paylater.dev`.
   */
  apiOrigin?: string;
}

/* -------------------------------------------------------------------------- */
/* Instance + namespace                                                       */
/* -------------------------------------------------------------------------- */

/**
 * @dev A mounted widget instance returned by `PayLater.init()`.
 *
 * The instance is reactive — call `update()` to change theme, prefill, or
 * other options without unmounting.
 */
export interface WidgetInstance {
  mount(target: string | HTMLElement): WidgetInstance; // Mount the widget at the given target. Returns the same instance for chaining.
  unmount(): void; // Remove the widget from the DOM and detach all listeners.
  open(): void; // Open the widget (modal/drawer position only — inline is always open).
  close(): void; // Close the widget (modal/drawer position only).

  /**
   * Update options on the fly. Reactive options (theme, prefill, lock, hide,
   * event handlers) patch in place. Other changes remount the widget.
   */
  update(opts: Partial<PayLaterOptions>): void;

  readonly phase: "amount" | "delivery" | "sign" | "done"; // Currently rendered phase.
  readonly mounted: boolean; // Whether the widget is currently mounted.
}

/**
 * @dev Top-level SDK namespace.
 */
export interface PayLaterSDK {
  init(options: PayLaterOptions): WidgetInstance; // Initialize a widget with the given options. Call `mount()` on the result.
  readonly version: string; // SDK version.
}
