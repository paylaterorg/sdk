/**
 * @dev Formatting + FX helpers used by the widget.
 *
 * `formatMoney` uses Intl.NumberFormat with the country's BCP-47 locale.
 * `toUsdt` converts a local-currency amount to USDT using either provided
 * rates or the fallback indicative rates baked into the SDK.
 */

import type { Currency } from "../types";
import { FALLBACK_USD_PER_UNIT, type CountryConfig } from "./countries";

/**
 * @title formatMoney
 * @description Format a local-currency amount as a string using Intl.NumberFormat.
 * @param {CountryConfig} country - The country config (drives currency + locale).
 * @param {number} amount - Amount in the country's local currency.
 * @returns {string} A string representing the formatted amount in the local currency, according to the country's locale.
 */
export function formatMoney(country: CountryConfig, amount: number): string {
  return new Intl.NumberFormat(country.locale, {
    style: "currency",
    currency: country.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * @title formatCompact
 * @description Short numeric label used by preset chips at narrow widths
 * (Galaxy S8+, sidebars, narrow modals) where the full "5 000 kr" string
 * gets ellipsis-truncated. 1000+ collapses to "k" form: 1000→"1k",
 * 2500→"2.5k", 5000→"5k". Currency is dropped because the customer already
 * sees it on the editable amount row directly above.
 * @param {number} value - The preset amount in local currency units.
 * @returns {string} Compact label suitable for a tight chip.
 */
export function formatCompact(value: number): string {
  if (value < 1000) return String(value);

  const k = value / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * @title toUsdt
 * @description Convert a local-currency amount to its USDT equivalent.
 * @param {CountryConfig} country - The country config (drives currency + locale).
 * @param {number} amount - Amount in the country's local currency.
 * @param {Partial<Record<Currency, number>>} [rates] - Optional override of the USD-per-unit FX table. Falls back to indicative bundled rates if absent.
 * @returns {number} The equivalent amount in USDT.
 */
export function toUsdt(
  country: CountryConfig,
  amount: number,
  rates?: Partial<Record<Currency, number>>,
): number {
  const rate = rates?.[country.currency] ?? FALLBACK_USD_PER_UNIT[country.currency];
  return Math.round(amount * rate * 100) / 100;
}

/**
 * @title convertAmount
 * @description Convert an amount from one country's local currency to another's, snapping to the destination country's slider step and clamping into its [min, max] range. When the customer switches market mid-flow we want the slider to land on a value that's roughly the same purchasing power, not jump back to the country minimum.
 * @param {CountryConfig} from - The country the amount is currently denominated in.
 * @param {CountryConfig} to - The country we're converting to.
 * @param {number} amount - Amount in `from`'s local currency.
 * @param {Partial<Record<Currency, number>>} [rates] - Optional override of the USD-per-unit FX table. Falls back to indicative bundled rates.
 * @returns {number} The converted amount in `to`'s local currency, snapped to its step and clamped to its range.
 */
export function convertAmount(
  from: CountryConfig,
  to: CountryConfig,
  amount: number,
  rates?: Partial<Record<Currency, number>>,
): number {
  const fromRate = rates?.[from.currency] ?? FALLBACK_USD_PER_UNIT[from.currency];
  const toRate = rates?.[to.currency] ?? FALLBACK_USD_PER_UNIT[to.currency];
  if (!fromRate || !toRate) return to.minAmount;

  const usd = amount * fromRate;
  const raw = usd / toRate;
  const snapped = Math.round(raw / to.step) * to.step;

  return Math.max(to.minAmount, Math.min(to.maxAmount, snapped));
}
