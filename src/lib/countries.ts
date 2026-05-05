/**
 * @dev Per-country configuration for the 8 markets PayLater is live in.
 */

import type { CountryCode, Currency, Locale } from "../types";

/**
 * @dev Local eID provider integrated via Scrive in each market.
 */
export type EidProvider =
  | "BankID"
  | "Norwegian BankID"
  | "Finnish Trust Network"
  | "MitID"
  | "D-Trust sign-me"
  | "France Connect+"
  | "iDIN"
  | "OneID";

/**
 * @dev Configuration for each country, used to drive the widget's behavior and copy.
 */
export interface CountryConfig {
  code: CountryCode; // ISO 3166-1 alpha-2 country code
  flag: string; // Unicode emoji flag for the country.
  name: string; // Localized country name shown in the widget.
  eid: EidProvider; // Local eID provider integrated via Scrive.
  idLabel: string; // What the user is asked for in step 2 (eID-flow phase).
  idPlaceholder: string; // Placeholder shown in the ID input.
  idPattern: RegExp; // Permissive client-side validation regex.
  currency: Currency; // Local currency code (ISO 4217) used for formatting the amount input and the final price shown to the user.
  currencySymbol: string; // Local currency symbol shown in the UI (e.g. "kr", "€", "£").
  minAmount: number; // Minimum amount allowed for purchase, in local currency (e.g. 100 for SEK).
  maxAmount: number; // Maximum amount allowed for purchase, in local currency (e.g. 5000 for SEK).
  step: number; // Step shown on the amount slider.
  locale: Locale; // BCP-47 locale used for number formatting.
  regulator: string; // Local financial supervisor referenced in the legal contract.
  eidAppName: string; // Native eID app name end-users install on their phone.
  qrHint: string; // Hint shown above the QR code during signing.
}

/**
 * @dev Per-country configuration for the 8 markets PayLater is live in, keyed by ISO 3166-1 alpha-2 country code.
 */
export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  SE: {
    code: "SE",
    flag: "🇸🇪",
    name: "Sweden",
    eid: "BankID",
    idLabel: "Personnummer",
    idPlaceholder: "YYYYMMDD-XXXX",
    idPattern: /^\d{8}[- ]?\d{4}$/,
    currency: "SEK",
    currencySymbol: "kr",
    minAmount: 100,
    maxAmount: 5000,
    step: 100,
    locale: "sv-SE",
    regulator: "Finansinspektionen",
    eidAppName: "BankID",
    qrHint: "Open the BankID app and scan the QR code",
  },
  NO: {
    code: "NO",
    flag: "🇳🇴",
    name: "Norway",
    eid: "Norwegian BankID",
    idLabel: "Fødselsnummer",
    idPlaceholder: "DDMMYY XXXXX",
    idPattern: /^\d{6}[- ]?\d{5}$/,
    currency: "NOK",
    currencySymbol: "kr",
    minAmount: 100,
    maxAmount: 5000,
    step: 100,
    locale: "nb-NO",
    regulator: "Finanstilsynet",
    eidAppName: "BankID på mobil",
    qrHint: "Åpne BankID-appen og skann QR-koden",
  },
  FI: {
    code: "FI",
    flag: "🇫🇮",
    name: "Finland",
    eid: "Finnish Trust Network",
    idLabel: "Henkilötunnus",
    idPlaceholder: "DDMMYY-XXXX",
    idPattern: /^\d{6}[-+A]\d{3}[0-9A-Z]$/i,
    currency: "EUR",
    currencySymbol: "€",
    minAmount: 10,
    maxAmount: 500,
    step: 10,
    locale: "fi-FI",
    regulator: "Finanssivalvonta",
    eidAppName: "your bank's mobile ID app",
    qrHint: "Avaa pankkisi mobiilitunnistus ja skannaa QR-koodi",
  },
  DK: {
    code: "DK",
    flag: "🇩🇰",
    name: "Denmark",
    eid: "MitID",
    idLabel: "CPR-nummer",
    idPlaceholder: "DDMMYY-XXXX",
    idPattern: /^\d{6}[- ]?\d{4}$/,
    currency: "DKK",
    currencySymbol: "kr",
    minAmount: 70,
    maxAmount: 4000,
    step: 10,
    locale: "da-DK",
    regulator: "Finanstilsynet",
    eidAppName: "MitID",
    qrHint: "Åbn MitID-appen og scan QR-koden",
  },
  DE: {
    code: "DE",
    flag: "🇩🇪",
    name: "Germany",
    eid: "D-Trust sign-me",
    idLabel: "Personalausweisnummer",
    idPlaceholder: "T01000000",
    idPattern: /^[A-Z0-9]{9,10}$/i,
    currency: "EUR",
    currencySymbol: "€",
    minAmount: 10,
    maxAmount: 500,
    step: 10,
    locale: "de-DE",
    regulator: "BaFin",
    eidAppName: "AusweisApp",
    qrHint: "Öffne die AusweisApp und scanne den QR-Code",
  },
  FR: {
    code: "FR",
    flag: "🇫🇷",
    name: "France",
    eid: "France Connect+",
    idLabel: "Numéro de pièce d'identité",
    idPlaceholder: "12AB34567",
    idPattern: /^[A-Z0-9]{9,12}$/i,
    currency: "EUR",
    currencySymbol: "€",
    minAmount: 10,
    maxAmount: 500,
    step: 10,
    locale: "fr-FR",
    regulator: "ACPR",
    eidAppName: "France Identité",
    qrHint: "Ouvrez l'application France Identité et scannez le QR code",
  },
  NL: {
    code: "NL",
    flag: "🇳🇱",
    name: "Netherlands",
    eid: "iDIN",
    idLabel: "BSN",
    idPlaceholder: "123456789",
    idPattern: /^\d{8,9}$/,
    currency: "EUR",
    currencySymbol: "€",
    minAmount: 10,
    maxAmount: 500,
    step: 10,
    locale: "nl-NL",
    regulator: "AFM",
    eidAppName: "your bank's app (iDIN)",
    qrHint: "Open je bank-app en scan de QR-code via iDIN",
  },
  GB: {
    code: "GB",
    flag: "🇬🇧",
    name: "United Kingdom",
    eid: "OneID",
    idLabel: "National Insurance number",
    idPlaceholder: "QQ123456C",
    idPattern: /^[A-Z]{2}\d{6}[A-D]$/i,
    currency: "GBP",
    currencySymbol: "£",
    minAmount: 10,
    maxAmount: 500,
    step: 10,
    locale: "en-GB",
    regulator: "the FCA",
    eidAppName: "your bank's app (OneID)",
    qrHint: "Open your bank app and scan the QR code via OneID",
  },
};

export const COUNTRY_LIST = Object.values(COUNTRIES);

/**
 * @dev Indicative FX used only for the USDT conversion preview in the widget.
 */
export const FALLBACK_USD_PER_UNIT: Record<Currency, number> = {
  SEK: 0.095,
  NOK: 0.094,
  DKK: 0.144,
  EUR: 1.07,
  GBP: 1.27,
};
