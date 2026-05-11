/**
 * @dev Inline SVG icons used by the SDK widget.
 *
 * All icons are hand-rolled inline SVG so the SDK never has to ship
 * lucide-react (~50KB tree-shaken). Each icon picks up `currentColor`
 * (or a brand token) so it themes naturally with whatever container it's in.
 *
 * Re-exported as a flat surface from this file so any UI module can
 * `import { CheckIcon } from "../icons"` without juggling individual files.
 */

import type { JSX } from "react";

/**
 * @dev Default sizing for the inline icons. 1rem matches the SDK's body font
 * size (16px) and is consistent with button + form-control proportions.
 */
const ICON_STYLE: React.CSSProperties = {
  width: "1rem",
  height: "1rem",
  flexShrink: 0,
};

/**
 * @title ArrowRightIcon
 * @description Right-pointing arrow used on Continue buttons.
 * @returns {JSX.Element} An inline SVG arrow.
 */
export function ArrowRightIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/**
 * @title ArrowLeftIcon
 * @description Left-pointing arrow used on Back buttons.
 * @returns {JSX.Element} An inline SVG arrow.
 */
export function ArrowLeftIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

/**
 * @title CheckIcon
 * @description Tick mark used in success states + active row indicators (country picker, network select).
 * @returns {JSX.Element} An inline SVG checkmark.
 */
export function CheckIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * @title ChevronDownIcon
 * @description Small chevron rendered inside the country chip + network dropdown trigger to signal "click me to open".
 * @returns {JSX.Element} A 0.75rem SVG chevron.
 */
export function ChevronDownIcon(): JSX.Element {
  return (
    <svg
      style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * @title CloseIcon
 * @description Cross used in the tile's close button + the country picker's close button.
 * @returns {JSX.Element} An inline SVG cross.
 */
export function CloseIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * @title CoinIcon
 * @description Stacked-coins glyph rendered inside the USDT pill on the amount step.
 * @returns {JSX.Element} An inline SVG coin icon.
 */
export function CoinIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="M16.71 13.88l.7.71-2.82 2.82" />
    </svg>
  );
}

/**
 * @title CopyIcon
 * @description Two-rectangles glyph for the "Copy reference" action on the success step.
 * @returns {JSX.Element} An inline SVG copy icon.
 */
export function CopyIcon(): JSX.Element {
  return (
    <svg
      style={ICON_STYLE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * @title PayLaterLogo
 * @description Inlined paths from `paylater-emblem.svg`. The lime fill + dark forest glyph route through `--paylater-primary` / `--paylater-primary-foreground` so partner-overridden brand colors invert correctly. Clipped to a circle via CSS.
 * @param {Object} [props]
 * @param {number} [props.size] - Side length in pixels. Defaults to 22 to match the header brand. Use ~14–16 for the compact footer brand line.
 * @returns {JSX.Element} The square emblem SVG.
 */
export function PayLaterLogo({ size = 22 }: { size?: number } = {}): JSX.Element {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      style={{ flexShrink: 0, borderRadius: "50%" }}
      aria-hidden
    >
      <rect width="1024" height="1024" fill="var(--paylater-primary)" />
      <path
        d="M369 274H655V416.8L559.667 512L655 607.2V750H369V607.2L464.333 512L369 416.8V274ZM607.333 619.1L512 523.9L416.667 619.1V702.4H607.333V619.1ZM512 500.1L607.333 404.9V321.6H416.667V404.9L512 500.1ZM464.333 369.2H559.667V387.05L512 434.65L464.333 387.05V369.2Z"
        fill="var(--paylater-primary-foreground)"
      />
    </svg>
  );
}

/**
 * @title ScanIcon
 * @description Bracket-and-line glyph used on the "QR scanned" status in the sign overlay. Sized larger than the body icons (1.5rem) and tinted with the primary brand color.
 * @returns {JSX.Element} An inline SVG scanning frame.
 */
export function ScanIcon(): JSX.Element {
  return (
    <svg
      style={{ width: "1.5rem", height: "1.5rem" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--paylater-primary)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M3 4v3a1 1 0 0 0 1 1h3" />
      <path d="M21 4v3a1 1 0 0 1-1 1h-3" />
      <path d="M3 20v-3a1 1 0 0 1 1-1h3" />
      <path d="M21 20v-3a1 1 0 0 0-1-1h-3" />
    </svg>
  );
}

/**
 * @title ShieldIcon
 * @description Trust badge icon used in the "Powered by Scrive eID" footer. Tiny (0.75rem) and tinted lime to signal regulated security without screaming.
 * @returns {JSX.Element} An inline SVG shield.
 */
export function ShieldIcon(): JSX.Element {
  return (
    <svg
      style={{ width: "0.75rem", height: "0.75rem", color: "var(--paylater-primary)" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
