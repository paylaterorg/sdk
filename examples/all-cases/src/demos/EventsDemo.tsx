/**
 * @dev Inline event-handlers demo with a tiny activity log so partners can
 * see the `success` / `phaseChange` / `error` events fire without opening
 * DevTools. Lives in its own file so Vite's Fast Refresh stays clean —
 * `cases.tsx` is a data module and shouldn't host top-level components.
 */

import { PayLaterWidget } from "@paylater/sdk/react";
import { useState, type JSX } from "react";

const TEST_KEY: string = import.meta.env.VITE_PAYLATER_API_KEY ?? "pk_test_examplekey1234567890";

/**
 * @title EventsDemo
 * @description Wraps a `PayLaterWidget` and renders a small log panel next to
 * it that captures every event handler invocation. Helps partners see the
 * shape of `SuccessEvent` / `ErrorEvent` and the phase transitions live.
 * @returns {JSX.Element} The widget + log panel.
 */
export function EventsDemo(): JSX.Element {
  const [log, setLog] = useState<string[]>([]);

  const append = (msg: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 6));

  return (
    <div className="events-demo">
      <PayLaterWidget
        apiKey={TEST_KEY}
        onSuccess={(event) => append(`success ref=${event.ref} usdt=${event.usdt.toFixed(2)}`)}
        onError={(error) => append(`error code=${error.code}`)}
        onPhaseChange={(phase) => append(`phase → ${phase}`)}
      />
      <aside className="events-log" aria-label="Event log">
        <strong>Event log</strong>
        {log.length === 0 && (
          <span className="events-log-empty">No events yet — tap Continue.</span>
        )}
        {log.map((line, i) => (
          <span key={i} className="events-log-line">
            {line}
          </span>
        ))}
      </aside>
    </div>
  );
}
