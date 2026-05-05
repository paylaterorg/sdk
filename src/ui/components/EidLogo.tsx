/**
 * @dev eID provider brand mark, fetched from DuckDuckGo's icon service.
 *
 * Each market maps to the domain that hosts its national eID provider
 * (BankID, MitID, France Connect+, …). We pull the favicon directly from
 * `icons.duckduckgo.com/ip3/{domain}.ico` rather than shipping the
 * third-party brand SVGs ourselves — those carry their own usage
 * restrictions and would balloon the bundle.
 */

import type { JSX } from "react";
import type { CountryCode } from "../../types";

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
export function EidLogo({
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
