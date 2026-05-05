/**
 * @dev BnplFlow — multi-phase Buy-Now-Pay-Later flow rendered inside the SDK's
 * Shadow Root.
 */

import NetworkArbitrumOne from "@web3icons/react/icons/networks/NetworkArbitrumOne";
import NetworkBase from "@web3icons/react/icons/networks/NetworkBase";
import NetworkEthereum from "@web3icons/react/icons/networks/NetworkEthereum";
import NetworkPolygon from "@web3icons/react/icons/networks/NetworkPolygon";
import NetworkSolana from "@web3icons/react/icons/networks/NetworkSolana";
import NetworkTron from "@web3icons/react/icons/networks/NetworkTron";
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { COUNTRIES } from "../lib/countries";
import { formatMoney, toUsdt } from "../lib/format";
import { MOCK_ID_NUMBERS, MOCK_NAMES } from "../lib/mockEid";
import type { CountryCode, ErrorEvent, Network, PayLaterOptions, SuccessEvent } from "../types";

/**
 * @dev Top-level phase of the BNPL flow.
 *
 * Drives both the visible content and the popup-after-amount overlay logic
 * for inline-popup positions. Order is canonical: amount → delivery → sign → done.
 */
type Phase = "amount" | "delivery" | "sign" | "done";

/**
 * @dev Sub-phase of the eID signing overlay.
 *
 * The widget never actually contacts an eID provider — it auto-advances
 * scan → scanned → signing → verified on a fixed timer to give partners a
 * realistic preview without bringing real Scrive credentials into the bundle.
 */
type SignPhase = "idle" | "scan" | "scanned" | "signing" | "verified";

/**
 * @dev Static metadata for each settlement network the widget exposes.
 */
interface NetworkOption {
  id: Network; // Discriminator matching the public `Network` union.
  label: string; // Human-readable network name shown in the picker.
  ticker: string; // USDT variant ticker for that chain.
}

/**
 * @dev Settlement networks PayLater supports for self-custody. Order is the
 * order shown in the network dropdown.
 */
const NETWORKS: NetworkOption[] = [
  { id: "solana", label: "Solana", ticker: "USDT-SPL" },
  { id: "ethereum", label: "Ethereum", ticker: "USDT-ERC20" },
  { id: "polygon", label: "Polygon", ticker: "USDT-Polygon" },
  { id: "tron", label: "Tron", ticker: "USDT-TRC20" },
  { id: "arbitrum", label: "Arbitrum", ticker: "USDT-Arbitrum" },
  { id: "base", label: "Base", ticker: "USDT-Base" },
];

/**
 * @dev Domain hosting each eID provider's brand mark. We pull each as a
 * favicon from DuckDuckGo's icon service so the SDK doesn't have to ship
 * third-party brand SVGs (which carry their own usage restrictions).
 */
const EID_DOMAIN: Record<CountryCode, string> = {
  SE: "bankid.com",
  NO: "bankid.no",
  FI: "ftn.fi",
  DK: "mitid.dk",
  DE: "d-trust.net",
  FR: "franceconnect.gouv.fr",
  NL: "idin.nl",
  GB: "oneid.uk",
};

/**
 * @title EidLogo
 * @description Render the eID provider brand mark for a given country, fetched from DuckDuckGo's `icons.duckduckgo.com/ip3/{domain}.ico` endpoint. Lazy-loaded so it doesn't block render. Sits on a tiny white pill so it stays legible on both light and dark widget themes.
 * @param {Object} props
 * @param {CountryCode} props.country - The market whose eID provider should be displayed.
 * @param {number} [props.size] - Pixel width and height. Defaults to 18.
 * @returns {JSX.Element | null} An `<img>` tag, or `null` if the country isn't supported.
 */
function EidLogo({
  country,
  size = 18,
}: {
  country: CountryCode;
  size?: number;
}): JSX.Element | null {
  const domain = EID_DOMAIN[country];
  if (!domain) return null;

  return (
    <img
      src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "0.25rem",
        background: "white",
        objectFit: "contain",
        padding: "0.125rem",
      }}
    />
  );
}

/**
 * @dev Branded chain logos sourced from `@web3icons/react`. Each network maps
 * to its tree-shakeable `Network*` icon component so partners only pay for
 * the icons we actually render.
 */
const CHAIN_ICONS = {
  solana: NetworkSolana,
  ethereum: NetworkEthereum,
  polygon: NetworkPolygon,
  tron: NetworkTron,
  arbitrum: NetworkArbitrumOne,
  base: NetworkBase,
};

/**
 * @title ChainLogo
 * @description Render the branded logo for a settlement network.
 * @param {Object} props
 * @param {Network} props.chain - The settlement network to render the logo for.
 * @param {number} [props.size] - Pixel size for both width and height. Defaults to 16.
 * @returns {JSX.Element} The branded `Network*` icon.
 */
function ChainLogo({ chain, size = 16 }: { chain: Network; size?: number }): JSX.Element {
  const Icon = CHAIN_ICONS[chain];

  return <Icon variant="branded" size={size} />;
}

const EVM_RE = /^0x[a-fA-F0-9]{40}$/; // Permissive validation for EVM-style hex addresses (Ethereum / Polygon / Arbitrum / Base).
const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // Permissive validation for Solana base58 addresses.
const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/; // Permissive validation for Tron addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Pragmatic email regex — catches typos but doesn't try to be RFC-correct.

/**
 * @title validateAddress
 * @description Run a permissive client-side check that a wallet address looks valid for the given network. The real check happens server-side; this just gates the Continue button so users don't paste obviously broken addresses.
 * @param {Network} network - The settlement network the address is meant for.
 * @param {string} raw - The user-entered address (whitespace tolerated).
 * @returns {boolean} True when the trimmed address matches the network's regex.
 */
function validateAddress(network: Network, raw: string): boolean {
  const addr = raw.trim();
  if (!addr) return false;

  switch (network) {
    case "ethereum":
    case "polygon":
    case "arbitrum":
    case "base":
      return EVM_RE.test(addr);
    case "solana":
      return SOLANA_RE.test(addr);
    case "tron":
      return TRON_RE.test(addr);
  }
}

/**
 * @title generateReference
 * @description Build a demo BNPL reference string of the form `USDT-XXXX-NNNN`. Mixes a random base36 segment with the last 4 digits of the current timestamp for visual uniqueness in the success summary.
 * @returns {string} A fresh reference identifier.
 */
function generateReference(): string {
  return (
    "USDT-" +
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    "-" +
    Date.now().toString().slice(-4)
  );
}

/**
 * @title thirtyDaysFromNow
 * @description Compute the BNPL repayment due date — 30 days after the moment of generation.
 * @returns {Date} A new Date 30 days in the future.
 */
function thirtyDaysFromNow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);

  return d;
}

/**
 * @title isValidApiKey
 * @description Validate that a string matches the public-key shape `pk_(test|live)_*`. Used to short-circuit the flow when partners forget to pass their key during integration.
 * @param {string | undefined} key - The candidate API key.
 * @returns {boolean} True when the key matches the expected shape.
 */
function isValidApiKey(key: string | undefined): boolean {
  return typeof key === "string" && /^pk_(test|live)_[a-zA-Z0-9]+$/.test(key);
}

/**
 * @dev Props the BnplFlow component accepts.
 *
 * `onSuccess` / `onError` / `onPhaseChange` are forwarded from the consumer's
 * `EventHandlers`. `onDismiss` is wired by the Widget shell only for
 * modal/drawer positions — its presence tells BnplFlow not to render its own
 * popup-after-amount overlay (the shell already is one).
 */
export interface BnplFlowProps {
  options: PayLaterOptions; // The merged options PayLater.init() produced.
  onPhaseChange: (phase: Phase) => void; // Bubble up phase transitions for analytics.
  onSuccess: (event: SuccessEvent) => void; // Fired after the eID mock auto-advances to verified.
  onError: (event: ErrorEvent) => void; // Fired on unrecoverable failures.

  /**
   * Provided by the Widget shell when this flow is rendered inside a
   * modal/drawer overlay. When present, the popup-after-amount behaviour is
   * suppressed (the shell is already an overlay).
   */
  onDismiss?: () => void;
}

/**
 * @title BnplFlow
 * @description Multi-phase Buy-Now-Pay-Later flow rendered inside the SDK's Shadow Root. Hosts all phase state (amount, country, network, wallet, email, sign sub-phase, reference, due date) so swapping between inline tile and popup overlay never remounts the form.
 * @param {BnplFlowProps} props - See {@link BnplFlowProps}.
 * @returns {JSX.Element} Either the bare tile (inline / non-popup positions) or a placeholder + overlay pair (inline-popup with phase past amount).
 */
export function BnplFlow({
  options,
  onPhaseChange,
  onSuccess,
  onDismiss,
}: BnplFlowProps): JSX.Element {
  const initialCountry: CountryCode = options.country ?? "SE";
  const merchantCustody = options.custody?.mode === "merchant";
  const hide = new Set(options.hide ?? []);
  const lock = new Set(options.lock ?? []);
  const showWalletField = !merchantCustody && !hide.has("walletAddress");
  const showNetworkField = !merchantCustody && !hide.has("network");
  const showEmailField = !hide.has("email");
  const countryEditable = !lock.has("country");

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

  // Switching country resets the amount to the new market's minimum.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmount(country.minAmount);
  }, [country.minAmount, country.maxAmount]);

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

  const usdt = toUsdt(country, amount);
  const amountValid = amount >= country.minAmount && amount <= country.maxAmount;
  const addrTouched = walletAddress.trim().length > 0;
  const addrValid = validateAddress(network, walletAddress);
  const emailValid = EMAIL_RE.test(email.trim());
  const deliveryValid =
    (showWalletField ? addrValid : true) && (showEmailField ? emailValid : true);

  // The API key is required to proceed past the amount phase, so we validate it early to avoid wasted time on the rest of the form when it's missing or malformed.
  const apiKeyValid = isValidApiKey(options.apiKey);

  // Country is editable when the partner hasn't locked it AND the customer
  // hasn't already passed the delivery step — once a credit agreement is
  // about to be signed, swapping markets would invalidate the eID provider
  // mid-flow.
  const countryUnlocked = countryEditable && (phase === "amount" || phase === "delivery");

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
        const merchantSettlementAddress =
          options.custody?.mode === "merchant" ? options.custody.settlementAddress : undefined;
        const merchantSettlementNetwork =
          options.custody?.mode === "merchant" ? options.custody.settlementNetwork : undefined;
        const recipient = merchantCustody
          ? (merchantSettlementAddress ?? null)
          : walletAddress.trim() || options.prefill?.walletAddress || null;
        const settledNetwork: Network = merchantCustody
          ? (merchantSettlementNetwork ?? options.prefill?.network ?? network)
          : network;

        const event: SuccessEvent = {
          ref: reference,
          network: settledNetwork,
          usdt,
          amount,
          country: initialCountry,
          custody: merchantCustody ? "merchant" : "self",
          recipient,
          ...(merchantCustody && options.custody?.mode === "merchant"
            ? { merchantUserId: options.custody.merchantUserId }
            : {}),
        };

        setSignPhase("idle");
        setPhase("done");
        onSuccess(event);
      });
  }, [signPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setSignPhase("idle");
    setPhase("amount");
    setReference(generateReference());
    setDueDate(thirtyDaysFromNow());
  };

  const verifiedName = MOCK_NAMES[initialCountry];
  const verifiedId = MOCK_ID_NUMBERS[initialCountry];

  const [copied, setCopied] = useState(false);
  const copyReference = () => {
    navigator.clipboard?.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const position = options.position ?? "inline";
  const showAsOverlay = position === "inline-popup" && phase !== "amount" && !onDismiss;

  const tile = (
    <div className="pl-tile">
      <header className="pl-tile-header">
        <span className="pl-brand">
          <PayLaterLogo />
          PayLater
        </span>
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
          {(onDismiss || showAsOverlay) && (
            <button
              type="button"
              className="pl-close"
              onClick={() => {
                if (showAsOverlay) {
                  reset();
                } else {
                  onDismiss?.();
                }
              }}
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
                <span className="pl-amount">{formatMoney(country, amount)}</span>
              </div>
              <input
                type="range"
                className="pl-slider"
                min={country.minAmount}
                max={country.maxAmount}
                step={country.step}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                aria-label="Amount"
              />
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
                <NetworkSelect value={network} onChange={setNetwork} />
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
              <button
                type="button"
                className="pl-btn pl-btn-ghost"
                onClick={() => setPhase("amount")}
              >
                <ArrowLeftIcon />
                Back
              </button>
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

        {phase === "sign" && (
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
                <span style={{ fontWeight: 600 }}>{_formatDate(dueDate)}</span>
              </div>
            </div>

            <p className="pl-disclosure">
              Tapping <strong>Sign with {country.eid}</strong> is your legal acceptance of the
              credit agreement. Subject to status and affordability.
            </p>

            <div className="pl-btn-row">
              <button
                type="button"
                className="pl-btn pl-btn-ghost"
                onClick={() => setPhase("delivery")}
              >
                <ArrowLeftIcon />
                Back
              </button>
              <button
                type="button"
                className="pl-btn pl-btn-primary"
                onClick={() => setSignPhase("scan")}
              >
                <EidLogo country={countryCode} size={16} />
                Sign with {country.eid}
              </button>
            </div>

            {signPhase !== "idle" && (
              <SignOverlay phase={signPhase} country={country} reference={reference} />
            )}
          </div>
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
              <div className="pl-summary-row">
                <span>Network</span>
                <span>{NETWORKS.find((n) => n.id === network)?.ticker ?? network}</span>
              </div>
              <div className="pl-summary-row">
                <span>Repay</span>
                <span>{formatMoney(country, amount)}</span>
              </div>
              <div className="pl-summary-row">
                <span>Due</span>
                <span>{_formatDate(dueDate)}</span>
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
        <ShieldIcon />
        Powered by Scrive eID — {country.eid}
      </footer>

      {countryPickerOpen && (
        <CountryPicker
          current={countryCode}
          onPick={(code) => {
            setCountryCode(code);
            setCountryPickerOpen(false);
          }}
          onClose={() => setCountryPickerOpen(false)}
        />
      )}
    </div>
  );

  if (showAsOverlay) {
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

        <div
          className="pl-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="PayLater checkout"
          onClick={(e) => {
            if (e.target === e.currentTarget) reset();
          }}
        >
          {tile}
        </div>
      </>
    );
  }

  return tile;
}

/* -------------------------------------------------------------------------- */
/* Subcomponents                                                              */
/* -------------------------------------------------------------------------- */

/**
 * @title NetworkSelect
 * @description Custom dropdown for picking a settlement network. Native `<select>` can't render arbitrary JSX inside its options, so this builds a controlled trigger + listbox that shows each chain's branded logo, label, and ticker. Click-outside and Escape both dismiss the menu.
 * @param {Object} props
 * @param {Network} props.value - The currently selected network id.
 * @param {(next: Network) => void} props.onChange - Called with the new network id when the user picks an option.
 * @returns {JSX.Element} The trigger button, plus the listbox when open.
 */
function NetworkSelect({
  value,
  onChange,
}: {
  value: Network;
  onChange: (next: Network) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Inside Shadow DOM, `e.target` is retargeted to the shadow host for
    // light-DOM listeners — `contains()` against the in-shadow container
    // would always return false. `composedPath()` walks across shadow
    // boundaries and exposes the real click target.
    const onDocClick = (e: MouseEvent) => {
      const path = e.composedPath();
      if (containerRef.current && !path.includes(containerRef.current)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = NETWORKS.find((n) => n.id === value) ?? NETWORKS[0]!;

  return (
    <div ref={containerRef} className="pl-network-select">
      <button
        type="button"
        className="pl-network-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ChainLogo chain={selected.id} size={20} />
        <span className="pl-network-label">{selected.label}</span>
        <span className="pl-network-ticker">{selected.ticker}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <ul className="pl-network-menu" role="listbox">
          {NETWORKS.map((n) => {
            const active = n.id === value;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`pl-network-option${active ? " pl-network-option-active" : ""}`}
                  onClick={() => {
                    onChange(n.id);
                    setOpen(false);
                  }}
                >
                  <ChainLogo chain={n.id} size={20} />
                  <span className="pl-network-label">{n.label}</span>
                  <span className="pl-network-ticker">{n.ticker}</span>
                  {active && (
                    <span style={{ color: "var(--paylater-primary)" }}>
                      <CheckIcon />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * @title CountryPicker
 * @description In-tile sheet that lists the 8 supported markets with a search input. Slides over the active phase content rather than opening a separate window so the country swap stays contained inside the widget tile.
 * @param {Object} props
 * @param {CountryCode} props.current - The currently selected country, used to mark the active row.
 * @param {(code: CountryCode) => void} props.onPick - Fired when the user selects a country.
 * @param {() => void} props.onClose - Fired when the user dismisses (Escape, close button, or selection).
 * @returns {JSX.Element} The full-bleed in-tile sheet.
 */
function CountryPicker({
  current,
  onPick,
  onClose,
}: {
  current: CountryCode;
  onPick: (code: CountryCode) => void;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = Object.values(COUNTRIES);
    if (!q) return all;

    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q) ||
        c.eid.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pl-country-sheet" role="dialog" aria-modal="true" aria-label="Choose country">
      <header className="pl-country-sheet-header">
        <strong>Choose country</strong>
        <button
          type="button"
          className="pl-close"
          onClick={onClose}
          aria-label="Close country picker"
        >
          <CloseIcon />
        </button>
      </header>
      <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--paylater-border)" }}>
        <input
          type="text"
          className="pl-input"
          autoFocus
          placeholder="Search by country, currency or eID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="pl-country-list">
        {list.length === 0 && (
          <li className="pl-caption" style={{ padding: "1rem 1.25rem", textAlign: "center" }}>
            No countries match "{query}"
          </li>
        )}
        {list.map((c) => (
          <li key={c.code}>
            <button
              type="button"
              className={`pl-country-row${c.code === current ? " pl-country-row-active" : ""}`}
              onClick={() => onPick(c.code)}
            >
              <span aria-hidden style={{ fontSize: "1.25rem", lineHeight: 1 }}>
                {c.flag}
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span className="pl-country-name">{c.name}</span>
                <span className="pl-country-meta">
                  {c.eid} · {c.currency}
                </span>
              </span>
              {c.code === current && (
                <span style={{ color: "var(--paylater-primary)" }}>
                  <CheckIcon />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * @title PhaseDots
 * @description Four-step progress indicator showing which BNPL phase the user is currently on. The active dot is wide and lime; completed dots are short and lime-tinted; pending dots are muted.
 * @param {Object} props
 * @param {Phase} props.phase - The phase to highlight as active.
 * @returns {JSX.Element} A row of four dots with `data-state` attributes for CSS to style.
 */
function PhaseDots({ phase }: { phase: Phase }): JSX.Element {
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

/**
 * @title SignOverlay
 * @description Absolutely-positioned overlay rendered inside the tile body during the sign phase. Shows a deterministic fake QR with auto-advancing scan → scanned → signing → verified status messages, plus a per-country eID app hint and a 2-minute "QR expires in" timer for the initial scan state.
 * @param {Object} props
 * @param {SignPhase} props.phase - Sub-phase of the eID mock state machine.
 * @param {ReturnType<() => typeof COUNTRIES[CountryCode]>} props.country - Country config used to localize copy.
 * @param {string} props.reference - The session reference seeded into the fake QR pattern.
 * @returns {JSX.Element} The overlay surface with QR + steps + timer.
 */
function SignOverlay({
  phase,
  country,
  reference,
}: {
  phase: SignPhase;
  country: (typeof COUNTRIES)[CountryCode];
  reference: string;
}): JSX.Element {
  const [secondsLeft, setSecondsLeft] = useState(120);

  useEffect(() => {
    if (phase !== "scan") return;

    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);

    return () => clearInterval(t);
  }, [phase]);

  const qrSvg = useMemo(() => _makeFakeQrSvg(reference), [reference]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="pl-qr-shell">
      <h4 className="pl-h2" style={{ textAlign: "center" }}>
        Sign with {country.eid}
      </h4>
      <p className="pl-caption" style={{ textAlign: "center" }}>
        {country.qrHint}.
      </p>

      <div className="pl-qr-frame">
        <span dangerouslySetInnerHTML={{ __html: qrSvg }} />
        {phase !== "scan" && (
          <div className="pl-qr-overlay">
            {phase === "scanned" && (
              <>
                <ScanIcon />
                <strong>QR scanned</strong>
                <span style={{ color: "var(--paylater-muted)" }}>Open {country.eidAppName}…</span>
              </>
            )}
            {phase === "signing" && (
              <>
                <span className="pl-spinner" />
                <strong>Waiting for signature…</strong>
                <span style={{ color: "var(--paylater-muted)" }}>
                  Confirm in {country.eidAppName}
                </span>
              </>
            )}
            {phase === "verified" && (
              <>
                <CheckIcon />
                <strong>Signature verified</strong>
              </>
            )}
          </div>
        )}
      </div>

      {phase === "scan" && (
        <p className="pl-qr-timer">
          QR expires in <span>{mins}</span>:<span>{secs.toString().padStart(2, "0")}</span>
        </p>
      )}

      <ol className="pl-qr-steps">
        <li>Open {country.eidAppName} on your phone.</li>
        <li>Scan this QR code.</li>
        <li>Confirm the signature in {country.eidAppName}.</li>
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * @title formatDate
 * @description Format a Date as "DD MMM YYYY" using the en-GB locale. Used for the BNPL "due by" date in the sign + done phases.
 * @param {Date} d - The date to format.
 * @returns {string} A short, locale-aware date string.
 */
function _formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * @title makeFakeQrSvg
 * @description Build a deterministic 21×21 QR-shaped SVG from a seed string. It is not a real QR code — the demo flow auto-advances after a few seconds and the user never scans it — but the resulting pattern keeps the UI honest without bundling a real QR encoder.
 * @param {string} seed - Any stable string (we use the BNPL reference) to seed the FNV-1a hash + xorshift RNG.
 * @returns {string} A serialized SVG string with positional finder squares and a pseudo-random module pattern.
 */
function _makeFakeQrSvg(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const SIZE = 21;
  let cells = "";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const isFinder = (x < 7 && y < 7) || (x >= SIZE - 7 && y < 7) || (x < 7 && y >= SIZE - 7);
      const finderEdge =
        isFinder &&
        (x === 0 ||
          x === 6 ||
          y === 0 ||
          y === 6 ||
          (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
          (x >= SIZE - 7 && (x === SIZE - 7 || x === SIZE - 1)) ||
          (y >= SIZE - 7 && (y === SIZE - 7 || y === SIZE - 1)));
      const filled = isFinder ? finderEdge : rng() > 0.55;
      if (filled) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  }
  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${cells}</svg>`;
}

/* -------------------------------------------------------------------------- */
/* Inline SVG icons                                                           */
/*                                                                            */
/* All icons are hand-rolled inline SVG so the SDK never has to ship          */
/* lucide-react (~50KB tree-shaken). Each icon picks up `currentColor` so it  */
/* themes naturally with whatever container it's in.                          */
/* -------------------------------------------------------------------------- */

/**
 * @dev Default sizing for the inline icons. 1rem matches the SDK's body font
 * size (16px) and is consistent with button + form-control proportions.
 */
const ICON_STYLE: React.CSSProperties = {
  width: "1rem",
  height: "1rem",
  flexShrink: 0,
};

/**
 * @title ArrowRightIcon
 * @description Right-pointing arrow used on Continue buttons.
 * @returns {JSX.Element} An inline SVG arrow.
 */
function ArrowRightIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/**
 * @title ArrowLeftIcon
 * @description Left-pointing arrow used on Back buttons.
 * @returns {JSX.Element} An inline SVG arrow.
 */
function ArrowLeftIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

/**
 * @title CheckIcon
 * @description Tick mark used in success states + active row indicators (country picker, network select).
 * @returns {JSX.Element} An inline SVG checkmark.
 */
function CheckIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * @title PayLaterLogo
 * @description Inlined paths from `paylater-emblem.svg`. The lime fill + dark forest glyph route through `--paylater-primary` / `--paylater-primary-foreground` so partner-overridden brand colors invert correctly. Clipped to a circle via CSS.
 * @returns {JSX.Element} The 22×22 emblem SVG.
 */
function PayLaterLogo(): JSX.Element {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width="22"
      height="22"
      style={{ flexShrink: 0, borderRadius: "50%" }}
      aria-hidden
    >
      <rect width="1024" height="1024" fill="var(--paylater-primary)" />
      <path
        d="M369 274H655V416.8L559.667 512L655 607.2V750H369V607.2L464.333 512L369 416.8V274ZM607.333 619.1L512 523.9L416.667 619.1V702.4H607.333V619.1ZM512 500.1L607.333 404.9V321.6H416.667V404.9L512 500.1ZM464.333 369.2H559.667V387.05L512 434.65L464.333 387.05V369.2Z"
        fill="var(--paylater-primary-foreground)"
      />
    </svg>
  );
}

/**
 * @title ChevronDownIcon
 * @description Small chevron rendered inside the country chip + network dropdown trigger to signal "click me to open".
 * @returns {JSX.Element} A 0.75rem SVG chevron.
 */
function ChevronDownIcon(): JSX.Element {
  return (
    <svg
      style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * @title CoinIcon
 * @description Stacked-coins glyph rendered inside the USDT pill on the amount step.
 * @returns {JSX.Element} An inline SVG coin icon.
 */
function CoinIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="M16.71 13.88l.7.71-2.82 2.82" />
    </svg>
  );
}

/**
 * @title CloseIcon
 * @description Cross used in the tile's close button + the country picker's close button.
 * @returns {JSX.Element} An inline SVG cross.
 */
function CloseIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * @title CopyIcon
 * @description Two-rectangles glyph for the "Copy reference" action on the success step.
 * @returns {JSX.Element} An inline SVG copy icon.
 */
function CopyIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * @title ScanIcon
 * @description Bracket-and-line glyph used on the "QR scanned" status in the sign overlay. Sized larger than the body icons (1.5rem) and tinted with the primary brand color.
 * @returns {JSX.Element} An inline SVG scanning frame.
 */
function ScanIcon(): JSX.Element {
  return (
    <svg
      style={{ width: "1.5rem", height: "1.5rem" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--paylater-primary)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M3 4v3a1 1 0 0 0 1 1h3" />
      <path d="M21 4v3a1 1 0 0 1-1 1h-3" />
      <path d="M3 20v-3a1 1 0 0 1 1-1h3" />
      <path d="M21 20v-3a1 1 0 0 0-1-1h-3" />
    </svg>
  );
}

/**
 * @title ShieldIcon
 * @description Trust badge icon used in the "Powered by Scrive eID" footer. Tiny (0.75rem) and tinted lime to signal regulated security without screaming.
 * @returns {JSX.Element} An inline SVG shield.
 */
function ShieldIcon(): JSX.Element {
  return (
    <svg
      style={{ width: "0.75rem", height: "0.75rem", color: "var(--paylater-primary)" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
