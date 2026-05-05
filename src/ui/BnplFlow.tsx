/**
 * @dev BnplFlow — multi-phase Buy-Now-Pay-Later flow rendered inside the SDK's
 * Shadow Root.
 */

import { useEffect, useState, type JSX } from "react";
import { createPortal } from "react-dom";
import { COUNTRIES } from "../lib/countries";
import { convertAmount, formatMoney, toUsdt } from "../lib/format";
import { MOCK_ID_NUMBERS, MOCK_NAMES } from "../lib/mockEid";
import { NETWORKS } from "../lib/networks";
import { formatDate, generateReference, thirtyDaysFromNow } from "../lib/refs";
import { EMAIL_RE, isValidApiKey, validateAddress } from "../lib/validation";
import type { CountryCode, ErrorEvent, Network, PayLaterOptions, SuccessEvent } from "../types";
import { CountryPicker, EidLogo, NetworkSelect, PhaseDots, SignOverlay } from "./components";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  CoinIcon,
  CopyIcon,
  PayLaterLogo,
  ShieldIcon,
} from "./icons";

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
   * Body-attached shadow-root container the SDK created so the popup
   * overlay can render outside the consumer's mount target — escaping any
   * `transform` / `filter` ancestors that would otherwise turn its
   * `position: fixed` into a containing-block-scoped position.
   */
  portalContainer?: HTMLElement | null;

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
  portalContainer,
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

  // The API key is required to proceed past the amount phase, so we validate
  // it early to avoid wasted time on the rest of the form when it's missing.
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
          </div>
        )}

        {phase === "sign" && signPhase !== "idle" && (
          <SignOverlay phase={signPhase} country={country} reference={reference} />
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
        <ShieldIcon />
        Powered by Scrive eID — {country.eid}
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
          if (e.target === e.currentTarget) reset();
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
