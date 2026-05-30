/**
 * @dev Demo data for the eID phase — test mode only. In test mode the widget
 * never contacts an eID provider; it auto-advances through scan → scanned →
 * signing → verified on a fixed timer to give partners a fully interactive
 * preview without bringing real Scrive credentials into the SDK bundle.
 *
 * Live mode (`pk_live_*`) uses real Scrive eID: the widget redirects the
 * customer to Scrive's hosted signing page and the verified identity is carried
 * by the server-side `agreement.signed` webhook, so this demo data is never
 * shown in live.
 */

import type { CountryCode } from "../types";

export const MOCK_NAMES: Record<CountryCode, string> = {
  SE: "Anna Karin Lindqvist",
  NO: "Ola Magnus Hansen",
  FI: "Mikko Juhani Virtanen",
  DK: "Lærke Sofie Jensen",
  DE: "Maximilian Friedrich Müller",
  FR: "Camille Élise Dubois",
  NL: "Sven Pieter de Vries",
  GB: "Oliver James Whitfield",
};

export const MOCK_ID_NUMBERS: Record<CountryCode, string> = {
  SE: "19850412-3829",
  NO: "120385-49271",
  FI: "120385-419K",
  DK: "120385-4928",
  DE: "T01X4F2K9",
  FR: "12AB34567FR",
  NL: "123456782",
  GB: "QQ123456C",
};
