/**
 * @dev Absolutely-positioned overlay rendered inside the tile body during the
 * sign phase. Drives the auto-advancing fake-eID state machine: scan →
 * scanned → signing → verified.
 */

import { useEffect, useMemo, useState, type JSX } from "react";
import type { COUNTRIES } from "../../lib/countries";
import { makeFakeQrSvg } from "../../lib/qr";
import type { CountryCode } from "../../types";
import type { SignPhase } from "../BnplFlow";
import { CheckIcon, ScanIcon } from "../icons";

/**
 * @title SignOverlay
 * @description Absolutely-positioned overlay rendered inside the tile body during the sign phase. Shows a deterministic fake QR with auto-advancing scan → scanned → signing → verified status messages, plus a per-country eID app hint and a 2-minute "QR expires in" timer for the initial scan state.
 * @param {Object} props
 * @param {SignPhase} props.phase - Sub-phase of the eID mock state machine.
 * @param {ReturnType<() => typeof COUNTRIES[CountryCode]>} props.country - Country config used to localize copy.
 * @param {string} props.reference - The session reference seeded into the fake QR pattern.
 * @returns {JSX.Element} The overlay surface with QR + steps + timer.
 */
export function SignOverlay({
  phase,
  country,
  reference,
}: {
  phase: SignPhase;
  country: (typeof COUNTRIES)[CountryCode];
  reference: string;
}): JSX.Element {
  const [secondsLeft, setSecondsLeft] = useState(120);

  useEffect(() => {
    if (phase !== "scan") return;

    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);

    return () => clearInterval(t);
  }, [phase]);

  const qrSvg = useMemo(() => makeFakeQrSvg(reference), [reference]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="pl-qr-shell">
      <h4 className="pl-h2" style={{ textAlign: "center" }}>
        Sign with {country.eid}
      </h4>
      <p className="pl-caption" style={{ textAlign: "center" }}>
        {country.qrHint}.
      </p>

      <div className="pl-qr-frame">
        <span dangerouslySetInnerHTML={{ __html: qrSvg }} />
        {phase !== "scan" && (
          <div className="pl-qr-overlay">
            {phase === "scanned" && (
              <>
                <ScanIcon />
                <strong>QR scanned</strong>
                <span style={{ color: "var(--paylater-muted)" }}>Open {country.eidAppName}…</span>
              </>
            )}
            {phase === "signing" && (
              <>
                <span className="pl-spinner" />
                <strong>Waiting for signature…</strong>
                <span style={{ color: "var(--paylater-muted)" }}>
                  Confirm in {country.eidAppName}
                </span>
              </>
            )}
            {phase === "verified" && (
              <>
                <CheckIcon />
                <strong>Signature verified</strong>
              </>
            )}
          </div>
        )}
      </div>

      {phase === "scan" && (
        <p className="pl-qr-timer">
          QR expires in <span>{mins}</span>:<span>{secs.toString().padStart(2, "0")}</span>
        </p>
      )}

      <ol className="pl-qr-steps">
        <li>Open {country.eidAppName} on your phone.</li>
        <li>Scan this QR code.</li>
        <li>Confirm the signature in {country.eidAppName}.</li>
      </ol>
    </div>
  );
}
