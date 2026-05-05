/**
 * @dev Client-side validation helpers used by the BNPL flow.
 *
 * These checks are intentionally permissive — the real verification happens
 * server-side. Their job is just to gate the Continue button so the customer
 * doesn't paste obviously broken input and then wait for a round-trip to
 * find out.
 */

import type { Network } from "../types";

export const EVM_RE = /^0x[a-fA-F0-9]{40}$/; // Permissive validation for EVM-style hex addresses (Ethereum / Polygon / Arbitrum / Base).
export const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // Permissive validation for Solana base58 addresses.
export const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/; // Permissive validation for Tron addresses.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Pragmatic email regex — catches typos but doesn't try to be RFC-correct.
export const API_KEY_RE = /^pk_(test|live)_[a-zA-Z0-9]+$/; // Public-key shape PayLater issues to partner platforms.

/**
 * @title validateAddress
 * @description Run a permissive client-side check that a wallet address looks valid for the given network. The real check happens server-side; this just gates the Continue button so users don't paste obviously broken addresses.
 * @param {Network} network - The settlement network the address is meant for.
 * @param {string} raw - The user-entered address (whitespace tolerated).
 * @returns {boolean} True when the trimmed address matches the network's regex.
 */
export function validateAddress(network: Network, raw: string): boolean {
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
 * @title isValidApiKey
 * @description Validate that a string matches the public-key shape `pk_(test|live)_*`. Used to short-circuit the flow when partners forget to pass their key during integration.
 * @param {string | undefined} key - The candidate API key.
 * @returns {boolean} True when the key matches the expected shape.
 */
export function isValidApiKey(key: string | undefined): boolean {
  return typeof key === "string" && API_KEY_RE.test(key);
}
