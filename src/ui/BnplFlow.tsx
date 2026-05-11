/**
 * @dev BnplFlow — multi-phase Buy-Now-Pay-Later flow rendered inside the SDK's
 * Shadow Root.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";
import { COUNTRIES } from "../lib/countries";
import { convertAmount, formatCompact, formatMoney, toUsdt } from "../lib/format";
import { MOCK_ID_NUMBERS, MOCK_NAMES } from "../lib/mockEid";
import { NETWORKS } from "../lib/networks";
import { formatDate, generateReference, thirtyDaysFromNow } from "../lib/refs";
import { EMAIL_RE, isValidApiKey, validateAddress } from "../lib/validation";
import type {
  CountryCode,
  Currency,
  ErrorEvent,
  Network,
  PayLaterOptions,
  SuccessEvent,
} from "../types";
import { EidLogo, PhaseDots } from "./components";
import { CountryPicker } from "./components/CountryPicker";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  CoinIcon,
  CopyIcon,
  PayLaterLogo,
} from "./icons";

/**
 * @dev Lazy chunks. Each pulls a heavy dependency that's only needed at one
 * specific phase, so the initial parse stays minimal:
 *
 * - `NetworkSelect` brings in `@web3icons/react` (~12KB of branded chain
 *   SVGs) — only relevant during the delivery phase.
 * - `SignOverlay` brings in `qrcode` (~30KB of QR encoder) — only relevant
 *   during the sign phase.
 *
 * `CountryPicker` is imported eagerly because its on-tap latency was
 * noticeable, and `EidLogo` is fully local SVG so neither needs splitting.
 *
 * `tsup` is configured with `splitting: true`, so these become real
 * separate chunks at consumer-bundle time.
 */
const NetworkSelect = lazy(() =>
  import("./components/NetworkSelect").then((m) => ({ default: m.NetworkSelect })),
);
const SignOverlay = lazy(() =>
  import("./components/SignOverlay").then((m) => ({ default: m.SignOverlay })),
);

/**
 * @dev Module-level scroll-lock state.
 *
 * Multiple `inline-popup` widgets on the same page would clobber each other's
 * `body.style.overflow` snapshots if they each tracked it independently.
 * Counting active overlays here means we lock once on the first overlay's
 * mount and unlock once when the last overlay unmounts — restoring whatever
 * value the host page had set before the first lock.
 */
let _scrollLockCount = 0;
let _scrollLockPrevBody = "";
let _scrollLockPrevHtml = "";

const AMOUNT_PRESETS: Record<Currency, number[]> = {
  SEK: [500, 1000, 2500, 5000],
  NOK: [500, 1000, 2500, 5000],
  DKK: [250, 500, 1500, 4000],
  EUR: [50, 100, 250, 500],
  GBP: [50, 100, 250, 500],
};

/**
 * @dev Top-level phase of the BNPL flow.
 *
 * Drives both the visible content and the popup-after-amount overlay logic
 * for inline-popup positions. Order is canonical: amount → delivery → sign → done.
 */
export type Phase = "amount" | "delivery" | "sign" | "done";

/**
 * @dev Sub-phase of the eID signing overlay.
 *
 * The widget never actually contacts an eID provider — it auto-advances
 * scan → scanned → signing → verified on a fixed timer to give partners a
 * realistic preview without bringing real Scrive credentials into the bundle.
 */
export type SignPhase = "idle" | "scan" | "scanned" | "signing" | "verified";

/**
 * @dev Props the BnplFlow component accepts.
 *
 * `onSuccess` / `onError` / `onPhaseChange` are forwarded from the consumer's
 * `EventHandlers`. `portalContainer` is the body-attached shadow root the
 * factory in `widget.ts` created so the popup-after-amount overlay can
 * escape transformed ancestors of the mount target.
 */
export interface BnplFlowProps {
  options: PayLaterOptions; // The merged options PayLater.init() produced.
  onPhaseChange: (phase: Phase) => void; // Bubble up phase transitions for analytics.
  onSuccess: (event: SuccessEvent) => void; // Fired after the eID mock auto-advances to verified.
  onError: (event: ErrorEvent) => void; // Fired on unrecoverable failures.

  /**
   * Body-attached shadow-root container the SDK created so the popup
   * overlay can render outside the consumer's mount target — escaping any
   * `transform` / `filter` ancestors that would otherwise turn its
   * `position: fixed` into a containing-block-scoped position.
   */
  portalContainer?: HTMLElement | null;
}

/**
 * @title BnplFlow
 * @description Multi-phase Buy-Now-Pay-Later flow rendered inside the SDK's Shadow Root. Hosts all phase state (amount, country, network, wallet, email, sign sub-phase, reference, due date). For `position: "inline-popup"`, the post-amount phases render as a viewport-centered overlay portaled into the body-attached shadow root.
 * @param {BnplFlowProps} props - See {@link BnplFlowProps}.
 * @returns {JSX.Element} Either the bare tile (`inline`) or a placeholder + portaled overlay pair (`inline-popup` past amount).
 */
export function BnplFlow({
  options,
  onPhaseChange,
  onSuccess,
  portalContainer,
}: BnplFlowProps): JSX.Element {
  const initialCountry: CountryCode = options.country ?? "SE";
  const merchantCustody = options.custody?.mode === "merchant";

  const hide = useMemo(() => new Set(options.hide ?? []), [options.hide]);
  const lock = useMemo(() => new Set(options.lock ?? []), [options.lock]);

  const showWalletField = !merchantCustody && !hide.has("walletAddress");
  const showNetworkField = !merchantCustody && !hide.has("network");
  const showEmailField = !hide.has("email");
  const countryEditable = !lock.has("country");

  // Lock support for the form fields. `lock` keeps the field visible but
  // read-only (vs `hide`, which removes it entirely).
  const emailLocked = lock.has("email");
  const walletLocked = lock.has("walletAddress");
  const networkLocked = lock.has("network");

  // The settlement network is meaningful when USDT actually moves on-chain —
  // either to the customer's wallet (`self` custody) or to the partner's hot
  // wallet (merchant custody with `settlementAddress` set). Pure off-chain
  // merchant custody has no chain, so the success summary hides the row.
  const merchantSettlementOnChain =
    options.custody?.mode === "merchant" && Boolean(options.custody.settlementAddress);
  const showSettlementNetwork = !merchantCustody || merchantSettlementOnChain;

  const [phase, setPhaseInternal] = useState<Phase>("amount");
  const [countryCode, setCountryCode] = useState<CountryCode>(initialCountry);
  const country = COUNTRIES[countryCode];
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [amount, setAmount] = useState<number>(() => {
    const requested = options.amount;
    if (typeof requested !== "number") return COUNTRIES[initialCountry].minAmount;
    return Math.max(
      COUNTRIES[initialCountry].minAmount,
      Math.min(COUNTRIES[initialCountry].maxAmount, requested),
    );
  });

  const [network, setNetwork] = useState<Network>(options.prefill?.network ?? "solana");
  const [walletAddress, setWalletAddress] = useState<string>(options.prefill?.walletAddress ?? "");
  const [email, setEmail] = useState<string>(options.prefill?.email ?? "");
  const [signPhase, setSignPhase] = useState<SignPhase>("idle");

  // The widget only ever renders client-side (the React adapter mounts the
  // shadow root in a useEffect), so lazy initial state with Date.now() /
  // Math.random() can never cause SSR hydration mismatches.
  const [reference, setReference] = useState<string>(generateReference);
  const [dueDate, setDueDate] = useState<Date>(thirtyDaysFromNow);

  const setPhase = (next: Phase) => {
    setPhaseInternal(next);
    onPhaseChange(next);
  };

  // Reactive option propagation. Local state is initialised lazily from
  // `options.*` once at mount; if the partner calls `instance.update({ ... })`
  // afterwards, we want the new value to land in the corresponding piece of
  // state. The React-recommended pattern is to track the previous prop value
  // and adjust state during render — this avoids cascading effects and
  // keeps the update synchronous with the prop change.
  const [prevOptionAmount, setPrevOptionAmount] = useState(options.amount);
  if (options.amount !== prevOptionAmount) {
    setPrevOptionAmount(options.amount);

    if (typeof options.amount === "number") {
      const next = COUNTRIES[countryCode];
      setAmount(Math.max(next.minAmount, Math.min(next.maxAmount, options.amount)));
    }
  }

  const [prevOptionCountry, setPrevOptionCountry] = useState(options.country);
  if (options.country !== prevOptionCountry) {
    setPrevOptionCountry(options.country);
    if (options.country) setCountryCode(options.country);
  }

  const [prevOptionEmail, setPrevOptionEmail] = useState(options.prefill?.email);
  if (options.prefill?.email !== prevOptionEmail) {
    setPrevOptionEmail(options.prefill?.email);
    if (options.prefill?.email !== undefined) setEmail(options.prefill.email);
  }

  const [prevOptionWallet, setPrevOptionWallet] = useState(options.prefill?.walletAddress);
  if (options.prefill?.walletAddress !== prevOptionWallet) {
    setPrevOptionWallet(options.prefill?.walletAddress);

    if (options.prefill?.walletAddress !== undefined)
      setWalletAddress(options.prefill.walletAddress);
  }

  const [prevOptionNetwork, setPrevOptionNetwork] = useState(options.prefill?.network);
  if (options.prefill?.network !== prevOptionNetwork) {
    setPrevOptionNetwork(options.prefill?.network);
    if (options.prefill?.network) setNetwork(options.prefill.network);
  }

  const usdt = toUsdt(country, amount);
  const amountValid = amount >= country.minAmount && amount <= country.maxAmount;

  // Locale-correct currency symbol + position so the inline editable amount
  // can render "€500" or "500 kr" depending on market without us hard-coding
  // a per-country lookup table.
  const { amountSymbol, amountSymbolFirst } = useMemo(() => {
    const parts = new Intl.NumberFormat(country.locale, {
      style: "currency",
      currency: country.currency,
      maximumFractionDigits: 0,
    }).formatToParts(1234);

    const symbolIdx = parts.findIndex((p) => p.type === "currency");
    const numIdx = parts.findIndex((p) => p.type === "integer");

    return {
      amountSymbol: parts[symbolIdx]?.value ?? country.currency,
      amountSymbolFirst: symbolIdx >= 0 && numIdx >= 0 && symbolIdx < numIdx,
    };
  }, [country.locale, country.currency]);

  // Slider gradient fill — clamp so a typed out-of-range value (below min, or
  // mid-typing partial number) doesn't push --sl-pct negative or past 100%.
  const sliderPct = Math.max(
    0,
    Math.min(100, ((amount - country.minAmount) / (country.maxAmount - country.minAmount)) * 100),
  );
  const addrTouched = walletAddress.trim().length > 0;
  const addrValid = validateAddress(network, walletAddress);
  const emailValid = EMAIL_RE.test(email.trim());
  const deliveryValid =
    (showWalletField ? addrValid : true) && (showEmailField ? emailValid : true);

  // The API key is required to proceed past the amount phase, so we validate
  // it early to avoid wasted time on the rest of the form when it's missing.
  const apiKeyValid = isValidApiKey(options.apiKey);

  // Country is editable when the partner hasn't locked it AND the customer
  // hasn't already passed the delivery step — once a credit agreement is
  // about to be signed, swapping markets would invalidate the eID provider
  // mid-flow.
  const countryUnlocked = countryEditable && (phase === "amount" || phase === "delivery");

  // Latest-values ref so the sign-phase verified callback always reads fresh
  // state without the effect needing to re-run (and the timer chain to be
  // torn down) on every state change. Refreshed in an effect after every
  // commit — the timer fires hundreds of milliseconds later, well after the
  // commit-time refresh has run.
  const signCtxRef = useRef({
    walletAddress,
    network,
    reference,
    usdt,
    amount,
    countryCode,
    merchantCustody,
    options,
    onSuccess,
  });
  useEffect(() => {
    signCtxRef.current = {
      walletAddress,
      network,
      reference,
      usdt,
      amount,
      countryCode,
      merchantCustody,
      options,
      onSuccess,
    };
  });

  // Sign phase auto-advance machine.
  useEffect(() => {
    if (signPhase === "idle") return;

    let cancelled = false;

    const wait = (ms: number, next: () => void) => {
      const t = setTimeout(() => {
        if (!cancelled) next();
      }, ms);

      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    };

    if (signPhase === "scan") return wait(2200, () => setSignPhase("scanned"));
    if (signPhase === "scanned") return wait(1100, () => setSignPhase("signing"));
    if (signPhase === "signing") return wait(1600, () => setSignPhase("verified"));
    if (signPhase === "verified")
      return wait(900, () => {
        const ctx = signCtxRef.current;

        const merchantSettlementAddress =
          ctx.options.custody?.mode === "merchant"
            ? ctx.options.custody.settlementAddress
            : undefined;
        const merchantSettlementNetwork =
          ctx.options.custody?.mode === "merchant"
            ? ctx.options.custody.settlementNetwork
            : undefined;
        const recipient = ctx.merchantCustody
          ? (merchantSettlementAddress ?? null)
          : ctx.walletAddress.trim() || ctx.options.prefill?.walletAddress || null;
        const settledNetwork: Network = ctx.merchantCustody
          ? (merchantSettlementNetwork ?? ctx.options.prefill?.network ?? ctx.network)
          : ctx.network;

        const event: SuccessEvent = {
          ref: ctx.reference,
          network: settledNetwork,
          usdt: ctx.usdt,
          amount: ctx.amount,
          country: ctx.countryCode,
          custody: ctx.merchantCustody ? "merchant" : "self",
          recipient,
          ...(ctx.merchantCustody && ctx.options.custody?.mode === "merchant"
            ? { merchantUserId: ctx.options.custody.merchantUserId }
            : {}),
        };

        setSignPhase("idle");
        setPhase("done");
        ctx.onSuccess(event);
      });
  }, [signPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setSignPhase("idle");
    setPhase("amount");
    setReference(generateReference());
    setDueDate(thirtyDaysFromNow());
  };

  // User-initiated close (X button or backdrop click). Fires the partner's
  // `on.close` with `abandoned: true` whenever the customer leaves mid-flow,
  // mirroring what `unmount()` would emit. "Run again" from the done view
  // uses plain `reset()` because that's a re-entry, not an abandonment.
  const dismiss = () => {
    options.on?.close?.({ abandoned: phase !== "done", phase });
    reset();
  };

  // Partners that have already KYC'd the customer can pre-resolve the
  // verified name via `prefill.fullName`. The eID provider is still the
  // source of truth in production — this just controls what we display.
  const verifiedName = options.prefill?.fullName ?? MOCK_NAMES[countryCode];
  const verifiedId = MOCK_ID_NUMBERS[countryCode];

  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyReference = () => {
    navigator.clipboard?.writeText(reference);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 1500);
  };
  useEffect(
    () => () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    },
    [],
  );

  const position = options.position ?? "inline";
  const showAsOverlay = position === "inline-popup" && phase !== "amount";

  // Lock the host page's scroll while the popup overlay is open so the user
  // can't scroll the underlying page through the dimmed backdrop. We use a
  // module-level counter so multiple widgets on the same page coordinate
  // correctly: the lock applies on the first overlay's mount, and the
  // original overflow value is restored only when the last overlay unmounts.
  useEffect(() => {
    if (!showAsOverlay) return;

    if (_scrollLockCount === 0) {
      _scrollLockPrevBody = document.body.style.overflow;
      _scrollLockPrevHtml = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    _scrollLockCount += 1;

    return () => {
      _scrollLockCount -= 1;
      if (_scrollLockCount === 0) {
        document.body.style.overflow = _scrollLockPrevBody;
        document.documentElement.style.overflow = _scrollLockPrevHtml;
      }
    };
  }, [showAsOverlay]);

  // In popup mode the back button lives in the top-left of the dialog (mobile-app
  // nav-bar pattern) instead of at the bottom of each phase. From sign we step
  // back to delivery; from delivery we step back to amount (which collapses the
  // overlay and reveals the inline amount tile again).
  const headerBack: Phase | null =
    showAsOverlay && phase === "sign"
      ? "delivery"
      : showAsOverlay && phase === "delivery"
        ? "amount"
        : null;

  const tile = (
    <div className="pl-tile">
      <header className="pl-tile-header">
        {headerBack ? (
          <button
            type="button"
            className="pl-close"
            onClick={() => setPhase(headerBack)}
            aria-label="Go back"
          >
            <ArrowLeftIcon />
          </button>
        ) : (
          <span className="pl-brand">
            <PayLaterLogo />
            PayLater
          </span>
        )}
        <span style={{ display: "inline-flex", gap: "0.375rem", alignItems: "center" }}>
          <button
            type="button"
            className="pl-country-chip"
            onClick={() => countryUnlocked && setCountryPickerOpen(true)}
            disabled={!countryUnlocked}
            aria-label={`Change country, currently ${country.name}`}
          >
            <span aria-hidden style={{ fontSize: "0.875rem", lineHeight: 1 }}>
              {country.flag}
            </span>
            {country.currency}
            {countryUnlocked && <ChevronDownIcon />}
          </button>
          {showAsOverlay && (
            <button
              type="button"
              className="pl-close"
              onClick={dismiss}
              aria-label="Close PayLater"
            >
              <CloseIcon />
            </button>
          )}
        </span>
      </header>

      <PhaseDots phase={phase} />

      <div className="pl-tile-body" style={{ position: "relative" }}>
        {phase === "amount" && (
          <div data-pl-phase="amount" className="pl-stack" style={{ gap: "1rem" }}>
            <div className="pl-stack" style={{ gap: "0.25rem" }}>
              <h3 className="pl-h3">Buy USDT, pay within 30 days</h3>
              <p className="pl-caption">0% interest. No card. Self-custodial.</p>
            </div>

            <div className="pl-amount-card">
              <div className="pl-row">
                <span className="pl-eyebrow">You pay later</span>
                <label className="pl-amount">
                  {amountSymbolFirst && (
                    <span className="pl-amount-symbol" aria-hidden>
                      {amountSymbol}
                    </span>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="pl-amount-input"
                    value={amount === 0 ? "" : String(amount)}
                    placeholder="0"
                    maxLength={7}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      // Strip everything that isn't a digit — no decimals, no
                      // separators. Lets the partner's customer type a custom
                      // amount that doesn't snap to country.step (e.g. 51 EUR).
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 7);
                      if (digits === "") {
                        setAmount(0);
                        return;
                      }

                      // Don't clamp during typing — silent capping (e.g. typing
                      // "1000" in a 500-max market jumping to 500 mid-keystroke)
                      // is surprising. Min/max enforcement happens onBlur.
                      setAmount(Number(digits));
                    }}
                    onBlur={() => {
                      if (amount > 0 && amount < country.minAmount) setAmount(country.minAmount);
                      else if (amount === 0) setAmount(country.minAmount);
                      else if (amount > country.maxAmount) setAmount(country.maxAmount);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // Prevent the keystroke from bubbling up to a host page
                        // <form> ancestor and submitting it through the shadow
                        // boundary (form ancestry is not isolated by Shadow DOM).
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    style={{
                      width: `${Math.max(2, String(amount === 0 ? country.minAmount : amount).length)}ch`,
                    }}
                    aria-label="Custom amount"
                  />
                  {!amountSymbolFirst && (
                    <span className="pl-amount-symbol" aria-hidden>
                      {amountSymbol}
                    </span>
                  )}
                </label>
              </div>
              <input
                type="range"
                className="pl-slider"
                min={country.minAmount}
                max={country.maxAmount}
                step={country.step}
                value={Math.max(country.minAmount, Math.min(country.maxAmount, amount))}
                style={{
                  ["--sl-pct" as string]: `${sliderPct}%`,
                }}
                onChange={(e) => setAmount(Number(e.target.value))}
                aria-label="Amount"
              />
              <div className="pl-presets" role="group" aria-label="Preset amounts">
                {AMOUNT_PRESETS[country.currency]
                  .filter((p) => p >= country.minAmount && p <= country.maxAmount)
                  .map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`pl-preset-btn${amount === preset ? " pl-preset-btn--active" : ""}`}
                      onClick={() => setAmount(preset)}
                    >
                      <span className="pl-preset-full">{formatMoney(country, preset)}</span>
                      <span className="pl-preset-short">{formatCompact(preset)}</span>
                    </button>
                  ))}
              </div>
            </div>

            <div className="pl-usdt-pill">
              <CoinIcon />≈ {usdt.toFixed(2)} USDT
            </div>

            <button
              type="button"
              className="pl-btn pl-btn-primary"
              onClick={() => setPhase("delivery")}
              disabled={!apiKeyValid || !amountValid}
            >
              Continue
              <ArrowRightIcon />
            </button>

            {!apiKeyValid && (
              <p className="pl-caption" style={{ textAlign: "center" }}>
                Provide a valid <code>pk_test_*</code> or <code>pk_live_*</code> API key.
              </p>
            )}
          </div>
        )}

        {phase === "delivery" && (
          <div data-pl-phase="delivery" className="pl-stack" style={{ gap: "0.875rem" }}>
            <div className="pl-stack" style={{ gap: "0.25rem" }}>
              <h3 className="pl-h2">{merchantCustody ? "Confirm details" : "Where to deliver?"}</h3>
              <p className="pl-caption">
                {merchantCustody
                  ? "Your purchase will be credited to your account."
                  : "Any chain. Receipt to your inbox."}
              </p>
            </div>

            {showNetworkField && (
              <div>
                <label className="pl-label" htmlFor="pl-network">
                  Network
                </label>
                <Suspense fallback={null}>
                  <NetworkSelect value={network} onChange={setNetwork} disabled={networkLocked} />
                </Suspense>
              </div>
            )}

            {showWalletField && (
              <div>
                <label className="pl-label" htmlFor="pl-wallet">
                  {NETWORKS.find((n) => n.id === network)?.label} wallet address
                </label>
                <textarea
                  id="pl-wallet"
                  className="pl-textarea"
                  rows={2}
                  placeholder={
                    network === "solana"
                      ? "7xKXtg2C…rUq"
                      : network === "tron"
                        ? "TQrX…dRm"
                        : "0xAbC123…789"
                  }
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  aria-invalid={addrTouched && !addrValid}
                  readOnly={walletLocked}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                {addrTouched && !addrValid && (
                  <p className="pl-error">
                    {network === "solana"
                      ? "Solana addresses are 32–44 base58 chars."
                      : network === "tron"
                        ? "Tron addresses start with T and are 34 chars."
                        : "EVM addresses are 0x followed by 40 hex chars."}
                  </p>
                )}
              </div>
            )}

            {showEmailField && (
              <div>
                <label className="pl-label" htmlFor="pl-email">
                  Email
                </label>
                <input
                  id="pl-email"
                  type="email"
                  className="pl-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={emailLocked}
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
            )}

            <div className="pl-summary">
              <div className="pl-summary-row" data-highlight>
                <span>You receive</span>
                <span>{usdt.toFixed(2)} USDT</span>
              </div>
              <div className="pl-summary-row">
                <span>Pay later</span>
                <span>{formatMoney(country, amount)}</span>
              </div>
            </div>

            <div className="pl-btn-row">
              {!showAsOverlay && (
                <button
                  type="button"
                  className="pl-btn pl-btn-ghost"
                  onClick={() => setPhase("amount")}
                >
                  <ArrowLeftIcon />
                  Back
                </button>
              )}
              <button
                type="button"
                className="pl-btn pl-btn-primary"
                onClick={() => setPhase("sign")}
                disabled={!deliveryValid}
              >
                Continue
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        )}

        {phase === "sign" && signPhase === "idle" && (
          <div data-pl-phase="sign" className="pl-stack" style={{ gap: "0.875rem" }}>
            <div className="pl-stack" style={{ gap: "0.25rem" }}>
              <h3 className="pl-h2">Sign with {country.eid}</h3>
              <p className="pl-caption">One tap. Signed and authorised.</p>
            </div>

            <div className="pl-sign-card">
              <span className="pl-eyebrow">You receive</span>
              <span className="pl-amount-large">{usdt.toFixed(2)} USDT</span>
              <div className="pl-pay-by">
                <span style={{ color: "var(--paylater-muted)" }}>Pay</span>
                <span style={{ fontWeight: 700 }}>{formatMoney(country, amount)}</span>
                <span style={{ color: "var(--paylater-muted)" }}>by</span>
                <span style={{ fontWeight: 600 }}>{formatDate(dueDate)}</span>
              </div>
            </div>

            <p className="pl-disclosure">
              Tapping <strong>Sign with {country.eid}</strong> is your legal acceptance of the
              credit agreement. Subject to status and affordability.
            </p>

            <div className="pl-btn-row">
              {!showAsOverlay && (
                <button
                  type="button"
                  className="pl-btn pl-btn-ghost"
                  onClick={() => setPhase("delivery")}
                >
                  <ArrowLeftIcon />
                  Back
                </button>
              )}
              <button
                type="button"
                className="pl-btn pl-btn-primary"
                onClick={() => setSignPhase("scan")}
              >
                <EidLogo country={countryCode} size={16} />
                Sign with {country.eid}
              </button>
            </div>
          </div>
        )}

        {phase === "sign" && signPhase !== "idle" && (
          <Suspense fallback={null}>
            <SignOverlay phase={signPhase} country={country} reference={reference} />
          </Suspense>
        )}

        {phase === "done" && (
          <div
            data-pl-phase="done"
            className="pl-stack"
            style={{ gap: "0.875rem", textAlign: "center" }}
          >
            <div className="pl-success-icon">
              <CheckIcon />
            </div>

            <div className="pl-stack" style={{ gap: "0.25rem" }}>
              <h3 className="pl-h2">{merchantCustody ? "Deposit confirmed" : "USDT on the way"}</h3>
              <p className="pl-caption">
                Signed with {country.eid}. Receipt sent to {email || "your email"}.
              </p>
            </div>

            <div className="pl-summary" style={{ textAlign: "left" }}>
              <div className="pl-summary-row" data-highlight>
                <span>Receive</span>
                <span>{usdt.toFixed(2)} USDT</span>
              </div>
              {showSettlementNetwork && (
                <div className="pl-summary-row">
                  <span>Network</span>
                  <span>{NETWORKS.find((n) => n.id === network)?.ticker ?? network}</span>
                </div>
              )}
              <div className="pl-summary-row">
                <span>Repay</span>
                <span>{formatMoney(country, amount)}</span>
              </div>
              <div className="pl-summary-row">
                <span>Due</span>
                <span>{formatDate(dueDate)}</span>
              </div>
              <div className="pl-summary-row" data-mono>
                <span>Ref</span>
                <span>{reference}</span>
              </div>
              <div className="pl-summary-row">
                <span>Verified</span>
                <span>{verifiedName}</span>
              </div>
              <div className="pl-summary-row" data-mono>
                <span>ID</span>
                <span>{verifiedId}</span>
              </div>
            </div>

            <div className="pl-btn-row" style={{ justifyContent: "center" }}>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={copyReference}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "Copied" : "Copy reference"}
              </button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={reset}>
                Run again
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="pl-tile-footer">
        <span className="pl-footer-mark">
          <PayLaterLogo size={14} />
          PayLater
        </span>
        <span className="pl-footer-sep" aria-hidden>
          ·
        </span>
        <span className="pl-footer-mark">
          <EidLogo country={countryCode} size={14} />
          {country.eid}
        </span>
      </footer>

      {countryPickerOpen && (
        <CountryPicker
          current={countryCode}
          onPick={(code) => {
            // Convert the slider's amount into the new market's currency at
            // pick time so the user keeps roughly the same purchasing power
            // when they swap markets mid-flow.
            const next = COUNTRIES[code];
            setAmount(convertAmount(country, next, amount));
            setCountryCode(code);
            setCountryPickerOpen(false);
          }}
          onClose={() => setCountryPickerOpen(false)}
        />
      )}
    </div>
  );

  if (showAsOverlay) {
    const overlay = (
      <div
        className="pl-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="PayLater checkout"
        // The class supplies the polish (backdrop blur, animation, theme
        // tokens) but we duplicate the critical positioning + dimming as
        // inline styles so the overlay is never visible as an inline-flow
        // black box if the stylesheet is still parsing on the very first
        // render after page load.
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 999999,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) dismiss();
        }}
      >
        {tile}
      </div>
    );

    return (
      <>
        <div className="pl-tile pl-placeholder" aria-hidden>
          <div className="pl-tile-body" style={{ alignItems: "center", textAlign: "center" }}>
            <div className="pl-success-icon" style={{ opacity: 0.5 }}>
              <CheckIcon />
            </div>
            <p className="pl-h3">Continuing in popup</p>
            <p className="pl-caption" style={{ maxWidth: "20rem" }}>
              Finish your USDT purchase in the dialog. Close it any time to come back.
            </p>
          </div>
        </div>

        {/* Portal into the body-attached shadow root when available so any
            transformed ancestors of the consumer's mount target (e.g.
            framer-motion <motion.div> wrappers) can't trap our position:fixed
            overlay inside their containing block. Falls back to inline render
            if the SDK didn't allocate a portal host. */}
        {portalContainer ? createPortal(overlay, portalContainer) : overlay}
      </>
    );
  }

  return tile;
}
