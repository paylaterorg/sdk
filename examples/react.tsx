/**
 * React example — drop <PayLaterWidget /> into any tree.
 */
import { PayLaterWidget } from "@paylater/sdk/react";
import { useState } from "react";

export function CheckoutExample() {
  const [mode, setMode] = useState<"light" | "dark" | "auto">("auto");

  return (
    <main style={{ padding: "4rem 1.5rem", display: "grid", placeItems: "center", gap: "2rem" }}>
      <h1>PayLater - React example</h1>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={() => setMode("light")}>Light</button>
        <button onClick={() => setMode("dark")}>Dark</button>
        <button onClick={() => setMode("auto")}>Auto</button>
      </div>

      <PayLaterWidget
        apiKey="pk_test_examplekey1234567890"
        country="SE"
        amount={500}
        theme={{
          // Brand colors live under `light` / `dark`. The values below are
          // the SDK's bundled defaults — partners override one or both
          // when their lime differs from PayLater's.
          light: {
            primary: "oklch(76.02% 0.18901 132.705)",
            accent: "oklch(0.93 0.08 131)",
          },
          dark: {
            primary: "oklch(0.876 0.166 131)",
            accent: "oklch(0.4 0.12 131)",
          },
          radius: "lg",
          mode,
        }}
        onReady={() => console.log("widget mounted")}
        onSuccess={(event) => console.log("signed", event)}
        onError={(event) => console.error("error", event)}
        onPhaseChange={(phase) => console.log("phase", phase)}
      />
    </main>
  );
}
