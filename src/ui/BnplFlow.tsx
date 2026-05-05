/**
 * @dev BnplFlow — demonstration of the Shadow-DOM widget.
 *
 * This component is intentionally minimal. It renders the brand
 * surface, exposes the public API surface (theme, position, locale, country,
 * amount), and lifts a "Continue" event up to the consumer's success handler.
 *
 * The public API surface is stable, so consumers can integrate
 * today and receive the deeper UI as a non-breaking upgrade.
 */

import { useState, type JSX } from "react";
import { COUNTRIES } from "../lib/countries";
import { formatMoney, toUsdt } from "../lib/format";
import type { CountryCode, ErrorEvent, PayLaterOptions, SuccessEvent } from "../types";

/**
 * @dev The public API for the BNPL flow component.
 */
export interface BnplFlowProps {
  options: PayLaterOptions; // The options accepted by `PayLater.init()`.
  onPhaseChange: (phase: "amount" | "delivery" | "sign" | "done") => void; // Callback for when the BNPL flow changes phase.
  onSuccess: (event: SuccessEvent) => void; // Callback for when the BNPL flow completes successfully.
  onError: (event: ErrorEvent) => void; // Callback for when an error occurs in the BNPL flow.
  onDismiss?: () => void; // Optional callback for when the BNPL flow is dismissed.
}

/**
 * @title BnplFlow
 * @description A React component that demonstrates the BNPL flow within the SDK's widget. It renders a simple UI for selecting an amount and simulates a successful purchase when the "Continue" button is clicked. The component accepts options and callbacks via props, allowing it to integrate with the broader widget infrastructure and communicate with the consumer's handlers.
 * @param {BnplFlowProps} props - The props for configuring the BNPL flow, including options and event handlers.
 * @returns {JSX.Element} The rendered BNPL flow component.
 * @dev This component is intentionally minimal and serves as a demonstration of the SDK's capabilities.
 */
export function BnplFlow({
  options,
  onPhaseChange,
  onSuccess,
  onDismiss,
}: BnplFlowProps): JSX.Element {
  const initialCountry: CountryCode = options.country ?? "SE";
  const country = COUNTRIES[initialCountry];

  const [amount, setAmount] = useState<number>(() => {
    const requested = options.amount;
    if (typeof requested !== "number") return country.minAmount;

    return Math.max(country.minAmount, Math.min(country.maxAmount, requested));
  });

  const usdt = toUsdt(country, amount);

  return (
    <div className="pl-tile">
      <header className="pl-tile-header">
        <span>
          <span aria-hidden style={{ marginRight: "0.4em" }}>
            {country.flag}
          </span>
          PayLater
        </span>
        {onDismiss ? (
          <button
            type="button"
            className="pl-close"
            onClick={onDismiss}
            aria-label="Close PayLater"
          >
            ×
          </button>
        ) : null}
      </header>

      <div className="pl-tile-body">
        <div className="pl-stack">
          <h3 className="pl-h3">Buy USDT, pay within 30 days</h3>
          <p className="pl-caption">0% interest. No card. Self-custodial.</p>
        </div>

        <div className="pl-stack" style={{ gap: "0.625rem" }}>
          <div className="pl-row">
            <span className="pl-eyebrow">You pay later</span>
            <span className="pl-amount">{formatMoney(country, amount)}</span>
          </div>
          <input
            type="range"
            min={country.minAmount}
            max={country.maxAmount}
            step={country.step}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-label="Amount"
            style={{
              width: "100%",
              accentColor: "var(--paylater-primary)",
            }}
          />
          <div className="pl-row" style={{ justifyContent: "flex-start", gap: "0.5rem" }}>
            <span className="pl-caption">≈ {usdt.toFixed(2)} USDT</span>
          </div>
        </div>

        <button
          type="button"
          className="pl-btn pl-btn-primary"
          onClick={() => {
            // skip directly to success with mock data so the consumer
            // can verify their handlers wire up correctly.
            onPhaseChange("done");
            const custody = options.custody;
            const merchantCustody = custody?.mode === "merchant";
            const network = merchantCustody
              ? (custody.settlementNetwork ?? options.prefill?.network ?? "solana")
              : (options.prefill?.network ?? "solana");
            const recipient = merchantCustody
              ? (custody.settlementAddress ?? null)
              : (options.prefill?.walletAddress ?? null);
            onSuccess({
              ref: `paylater_demo_${Date.now()}`,
              network,
              usdt,
              amount,
              country: initialCountry,
              custody: merchantCustody ? "merchant" : "self",
              recipient,
              ...(merchantCustody ? { merchantUserId: custody.merchantUserId } : {}),
            });
          }}
          disabled={!isValidApiKey(options.apiKey)}
        >
          Continue
        </button>

        {!isValidApiKey(options.apiKey) ? (
          <p className="pl-caption" style={{ color: "var(--paylater-muted)" }}>
            Provide a valid <code>pk_test_*</code> or <code>pk_live_*</code> API key.
          </p>
        ) : null}
      </div>

      <footer className="pl-tile-footer">
        <span>Powered by PayLater · {country.regulator}</span>
      </footer>
    </div>
  );
}

function isValidApiKey(key: string | undefined): boolean {
  return typeof key === "string" && /^pk_(test|live)_[a-zA-Z0-9]+$/.test(key);
}
