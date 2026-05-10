/**
 * @dev eID provider brand mark, served from a locally-bundled image asset.
 *
 * Each market's favicon lives in `../logos/{cc}.ico` and is imported here as
 * a static asset. tsup is configured (`loader: { ".ico": "dataurl" }`) to
 * inline each one as a base64 `data:` URI at build time, so the widget
 * stays fully self-contained — no runtime network round trip and no
 * asset-path coordination required for SDK consumers.
 */

import { memo, type JSX } from "react";
import type { CountryCode } from "../../types";
import deLogo from "../logos/de.ico";
import dkLogo from "../logos/dk.ico";
import fiLogo from "../logos/fi.ico";
import frLogo from "../logos/fr.ico";
import gbLogo from "../logos/gb.svg";
import nlLogo from "../logos/nl.ico";
import noLogo from "../logos/no.ico";
import seLogo from "../logos/se.ico";

const EID_LOGOS: Record<CountryCode, string> = {
  SE: seLogo,
  NO: noLogo,
  FI: fiLogo,
  DK: dkLogo,
  DE: deLogo,
  FR: frLogo,
  NL: nlLogo,
  GB: gbLogo,
};

/**
 * @title EidLogo
 * @description Render the eID provider brand mark for a given country, sourced from the bundled per-market favicon. Sits on a tiny white pill so it stays legible on both light and dark widget themes.
 * @param {Object} props
 * @param {CountryCode} props.country - The market whose eID provider should be displayed.
 * @param {number} [props.size] - Pixel width and height. Defaults to 18.
 * @returns {JSX.Element | null} An `<img>` tag, or `null` if the country isn't supported.
 */
export const EidLogo = memo(function EidLogo({
  country,
  size = 18,
}: {
  country: CountryCode;
  size?: number;
}): JSX.Element | null {
  const src = EID_LOGOS[country];
  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
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
});
