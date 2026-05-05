/**
 * @dev Branded settlement-network logo, sourced from `@web3icons/react`.
 *
 * Each `Network` maps to its tree-shakeable `Network*` icon component so
 * partners only pay for the icons we actually render.
 */

import NetworkArbitrumOne from "@web3icons/react/icons/networks/NetworkArbitrumOne";
import NetworkBase from "@web3icons/react/icons/networks/NetworkBase";
import NetworkEthereum from "@web3icons/react/icons/networks/NetworkEthereum";
import NetworkPolygon from "@web3icons/react/icons/networks/NetworkPolygon";
import NetworkSolana from "@web3icons/react/icons/networks/NetworkSolana";
import NetworkTron from "@web3icons/react/icons/networks/NetworkTron";
import type { JSX } from "react";
import type { Network } from "../../types";

/**
 * @dev Mapping from settlement network id to its branded icon component. Kept
 * inside this module so the `@web3icons/react` import surface only enters
 * the bundle when the chain logo is actually rendered.
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
export function ChainLogo({ chain, size = 16 }: { chain: Network; size?: number }): JSX.Element {
  const Icon = CHAIN_ICONS[chain];

  return <Icon variant="branded" size={size} />;
}
