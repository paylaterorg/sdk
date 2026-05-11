/**
 * @dev In-tile sheet that lets the customer change market.
 *
 * Slides over the active phase content rather than opening a separate
 * window so the country swap stays contained inside the widget tile.
 * Listens for Escape to dismiss.
 */

import { useEffect, useMemo, useState, type JSX } from "react";
import { COUNTRIES } from "../../lib/countries";
import type { CountryCode } from "../../types";
import { CheckIcon, CloseIcon } from "../icons";

/**
 * @title CountryPicker
 * @description In-tile sheet that lists the 8 supported markets with a search input. Slides over the active phase content rather than opening a separate window so the country swap stays contained inside the widget tile.
 * @param {Object} props
 * @param {CountryCode} props.current - The currently selected country, used to mark the active row.
 * @param {(code: CountryCode) => void} props.onPick - Fired when the user selects a country.
 * @param {() => void} props.onClose - Fired when the user dismisses (Escape, close button, or selection).
 * @returns {JSX.Element} The full-bleed in-tile sheet.
 */
export function CountryPicker({
  current,
  onPick,
  onClose,
}: {
  current: CountryCode;
  onPick: (code: CountryCode) => void;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = Object.values(COUNTRIES);
    if (!q) return all;

    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q) ||
        c.eid.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pl-country-sheet" role="dialog" aria-modal="true" aria-label="Choose country">
      <header className="pl-country-sheet-header">
        <strong>Choose country</strong>
        <button
          type="button"
          className="pl-close"
          onClick={onClose}
          aria-label="Close country picker"
        >
          <CloseIcon />
        </button>
      </header>
      <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--paylater-border)" }}>
        <input
          type="text"
          className="pl-input"
          placeholder="Search by country, currency or eID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="pl-country-list">
        {list.length === 0 && (
          <li className="pl-caption" style={{ padding: "1rem 1.25rem", textAlign: "center" }}>
            No countries match "{query}"
          </li>
        )}
        {list.map((c) => (
          <li key={c.code}>
            <button
              type="button"
              className={`pl-country-row${c.code === current ? " pl-country-row-active" : ""}`}
              onClick={() => onPick(c.code)}
            >
              <span aria-hidden style={{ fontSize: "1.25rem", lineHeight: 1 }}>
                {c.flag}
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span className="pl-country-name">{c.name}</span>
                <span className="pl-country-meta">
                  {c.eid} · {c.currency}
                </span>
              </span>
              {c.code === current && (
                <span style={{ color: "var(--paylater-primary)" }}>
                  <CheckIcon />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
