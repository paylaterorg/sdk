/**
 * @dev Reference + date helpers for the BNPL flow.
 *
 * `generateReference` builds the demo BNPL reference shown in the success
 * summary. `thirtyDaysFromNow` computes the BNPL repayment due date.
 * `formatDate` renders that date in a short, locale-aware string for the
 * sign + done phases. None of these touch network — they're pure helpers
 * that only read `Date.now()` / `Math.random()`.
 */

/**
 * @title generateReference
 * @description Build a demo BNPL reference string of the form `USDT-XXXX-NNNN`. Mixes a random base36 segment with the last 4 digits of the current timestamp for visual uniqueness in the success summary.
 * @returns {string} A fresh reference identifier.
 */
export function generateReference(): string {
  return (
    "USDT-" +
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    "-" +
    Date.now().toString().slice(-4)
  );
}

/**
 * @title thirtyDaysFromNow
 * @description Compute the BNPL repayment due date — 30 days after the moment of generation.
 * @returns {Date} A new Date 30 days in the future.
 */
export function thirtyDaysFromNow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);

  return d;
}

/**
 * @title formatDate
 * @description Format a Date as "DD MMM YYYY" using the en-GB locale. Used for the BNPL "due by" date in the sign + done phases.
 * @param {Date} d - The date to format.
 * @returns {string} A short, locale-aware date string.
 */
export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}
