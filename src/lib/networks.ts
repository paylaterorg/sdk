/**
 * @dev Static metadata for the settlement networks the widget exposes.
 *
 * The `Network` union itself lives in the public type surface (`types.ts`)
 * since partners may pass it through prefill / settlement options. This file
 * adds the per-network display metadata (label + ticker) that only the UI
 * needs.
 */

import type { Network } from "../types";

/**
 * @dev Static metadata for each settlement network the widget exposes.
 */
export interface NetworkOption {
  id: Network; // Discriminator matching the public `Network` union.
  label: string; // Human-readable network name shown in the picker.
  ticker: string; // USDT variant ticker for that chain.
}

/**
 * @dev Settlement networks PayLater supports for self-custody. Order is the
 * order shown in the network dropdown.
 */
export const NETWORKS: NetworkOption[] = [
  { id: "solana", label: "Solana", ticker: "USDT-SPL" },
  { id: "ethereum", label: "Ethereum", ticker: "USDT-ERC20" },
  { id: "polygon", label: "Polygon", ticker: "USDT-Polygon" },
  { id: "tron", label: "Tron", ticker: "USDT-TRC20" },
  { id: "arbitrum", label: "Arbitrum", ticker: "USDT-Arbitrum" },
  { id: "base", label: "Base", ticker: "USDT-Base" },
];
