import { useState } from "react";
import { type Case } from "./cases";

/**
 * @title CaseCard
 * @description Renders one SDK configuration scenario: a numbered title,
 * a short description, the literal source the partner would write (with a
 * one-tap copy button), and the live widget that source produces. The two
 * halves stack on small viewports and sit side-by-side on larger ones.
 */
export function CaseCard({ index, caseDef }: { index: number; caseDef: Case }) {
  const { id, title, description, code, Demo } = caseDef;
  const [copied, setCopied] = useState(false);

  /**
   * @dev Copy the case's source to the clipboard. Uses the modern Clipboard
   * API; if it's unavailable (older Safari, insecure context), falls back
   * to a hidden `<textarea>` + `document.execCommand("copy")`.
   */
  const handleCopy = async () => {
    const source = code.trim();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(source);
      } else {
        const ta = document.createElement("textarea");
        ta.value = source;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Best-effort — silent failure leaves the button label as "Copy".
    }
  };

  return (
    <section className="case" id={id}>
      <header className="case-header">
        <h2>
          <span className="case-index">#{index}</span>
          {title}
        </h2>
        <p className="case-description">{description}</p>
      </header>
      <div className="case-grid">
        <div className="case-code">
          <div className="case-code-bar">
            <span>code</span>
            <button
              type="button"
              className="case-copy-btn"
              onClick={handleCopy}
              aria-label={copied ? "Code copied" : "Copy code"}
            >
              {copied ? (
                <>
                  <CheckIcon /> Copied
                </>
              ) : (
                <>
                  <CopyIcon /> Copy
                </>
              )}
            </button>
          </div>
          <pre>
            <code>{code.trim()}</code>
          </pre>
        </div>
        <div className="case-demo">
          <div className="case-demo-bar">
            <span>live</span>
          </div>
          <div className="case-demo-canvas">
            <Demo />
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Tiny icons for the copy button. Inline SVG so the page doesn't pull in     */
/* an icon library just for two glyphs.                                       */
/* -------------------------------------------------------------------------- */

function CopyIcon() {
  return (
    <svg
      width="12"
      height="12"
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

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
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
