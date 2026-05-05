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
