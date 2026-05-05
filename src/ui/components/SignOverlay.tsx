/**
 * @dev Absolutely-positioned overlay rendered inside the tile body during the
 * sign phase. Drives the auto-advancing fake-eID state machine: scan →
 * scanned → signing → verified.
 */

import QRCode from "qrcode";
import { useEffect, useState, type JSX } from "react";
import type { COUNTRIES } from "../../lib/countries";
import type { CountryCode } from "../../types";
import type { SignPhase } from "../BnplFlow";
import { CheckIcon, ScanIcon } from "../icons";

/**
 * @title SignOverlay
 * @description Absolutely-positioned overlay rendered inside the tile body during the sign phase. Generates a real QR pointing at a synthetic Scrive session URL and overlays it with auto-advancing scan → scanned → signing → verified status messages, plus a per-country eID app hint and a 2-minute "QR expires in" timer for the initial scan state.
 * @param {Object} props
 * @param {SignPhase} props.phase - Sub-phase of the eID mock state machine.
 * @param {ReturnType<() => typeof COUNTRIES[CountryCode]>} props.country - Country config used to localize copy.
 * @param {string} props.reference - The session reference, used as the QR payload seed.
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
  // Synthesize a Scrive-shaped session URL so the QR encodes something
  // deterministic and recognizable. The session token is generated once at
  // mount via lazy `useState` initialization — `Math.random()` in render
  // would violate React's purity rules.
  const [scriveUrl] = useState<string>(() => {
    const sessionToken =
      Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
    return `https://api.scrive.com/api/v2/sessions/${sessionToken}?ref=${reference}&eid=${encodeURIComponent(country.eid)}`;
  });

  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState(120);

  // Generate the QR data URL once per reference. `toDataURL` is async, so we
  // ignore stale resolutions if the component unmounts mid-flight.
  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(scriveUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((d) => {
      if (!cancelled) setQrDataUrl(d);
    });

    return () => {
      cancelled = true;
    };
  }, [scriveUrl]);

  // Tick the QR-expiry counter once per second, but only while the user is
  // still on the scan sub-phase — the moment the mock advances we stop the
  // interval to avoid wasted re-renders.
  useEffect(() => {
    if (phase !== "scan") return;

    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);

    return () => clearInterval(t);
  }, [phase]);

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
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`Scrive ${country.eid} QR`} />
        ) : (
          <div className="pl-qr-loading">
            <span className="pl-spinner" />
          </div>
        )}
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
