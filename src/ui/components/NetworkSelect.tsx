/**
 * @dev Custom dropdown for picking a settlement network.
 *
 * Native `<select>` can't render arbitrary JSX inside its options, so we
 * build a controlled trigger + listbox that shows each chain's branded
 * logo, label, and ticker. Handles click-outside (cross-Shadow-DOM aware)
 * and Escape dismissal.
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { NETWORKS } from "../../lib/networks";
import type { Network } from "../../types";
import { CheckIcon, ChevronDownIcon } from "../icons";
import { ChainLogo } from "./ChainLogo";

/**
 * @title NetworkSelect
 * @description Custom dropdown for picking a settlement network. Native `<select>` can't render arbitrary JSX inside its options, so this builds a controlled trigger + listbox that shows each chain's branded logo, label, and ticker. Click-outside and Escape both dismiss the menu. When `disabled` is set (the partner locked `network`), the trigger renders as a non-interactive read-only chip — the menu can't open.
 * @param {Object} props
 * @param {Network} props.value - The currently selected network id.
 * @param {(next: Network) => void} props.onChange - Called with the new network id when the user picks an option.
 * @param {boolean} [props.disabled] - When true, the trigger is non-interactive and the chevron is hidden.
 * @returns {JSX.Element} The trigger button, plus the listbox when open.
 */
export function NetworkSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: Network;
  onChange: (next: Network) => void;
  disabled?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Inside Shadow DOM, `e.target` is retargeted to the shadow host for
    // light-DOM listeners — `contains()` against the in-shadow container
    // would always return false. `composedPath()` walks across shadow
    // boundaries and exposes the real click target.
    const onDocClick = (e: MouseEvent) => {
      const path = e.composedPath();
      if (containerRef.current && !path.includes(containerRef.current)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = NETWORKS.find((n) => n.id === value) ?? NETWORKS[0]!;

  return (
    <div ref={containerRef} className="pl-network-select">
      <button
        type="button"
        className="pl-network-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ChainLogo chain={selected.id} size={20} />
        <span className="pl-network-label">{selected.label}</span>
        <span className="pl-network-ticker">{selected.ticker}</span>
        {!disabled && <ChevronDownIcon />}
      </button>
      {open && (
        <ul className="pl-network-menu" role="listbox">
          {NETWORKS.map((n) => {
            const active = n.id === value;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`pl-network-option${active ? " pl-network-option-active" : ""}`}
                  onClick={() => {
                    onChange(n.id);
                    setOpen(false);
                  }}
                >
                  <ChainLogo chain={n.id} size={20} />
                  <span className="pl-network-label">{n.label}</span>
                  <span className="pl-network-ticker">{n.ticker}</span>
                  {active && (
                    <span style={{ color: "var(--paylater-primary)" }}>
                      <CheckIcon />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
