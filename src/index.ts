/**
 * @dev @paylater/sdk — Frictionless USDT checkout for partner platforms.
 */

import type { PayLaterOptions, PayLaterSDK, WidgetInstance } from "./types";
import { createWidget } from "./widget";

// Replaced at build time by tsup's `define` with the value from package.json's `version` field.
declare const __PKG_VERSION__: string;
export const VERSION: string = __PKG_VERSION__;

/**
 * @dev Top-level SDK namespace. The only object consumers need to import.
 */
export const PayLater: PayLaterSDK = {
  version: VERSION,
  init(options: PayLaterOptions): WidgetInstance {
    return createWidget(options);
  },
};

export default PayLater;

export type {
  Asset,
  CloseEvent,
  ColorMode,
  CountryCode,
  Currency,
  CustodyMode,
  CustodyOptions,
  ErrorEvent,
  EventHandlers,
  FieldId,
  Locale,
  MerchantCustodyOptions,
  Network,
  PayLaterOptions,
  PayLaterSDK,
  Position,
  PrefillOptions,
  Product,
  RadiusScale,
  SelfCustodyOptions,
  SuccessEvent,
  ThemeOptions,
  WidgetInstance,
} from "./types";
