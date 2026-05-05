/**
 * React example — drop <PayLaterWidget /> into any tree.
 */
import { PayLaterWidget } from "@paylaterorg/sdk/react";
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
        theme={{ primary: "#B2E67C", radius: "lg", mode }}
        onReady={() => console.log("widget mounted")}
        onSuccess={(event) => console.log("signed", event)}
        onError={(event) => console.error("error", event)}
        onPhaseChange={(phase) => console.log("phase", phase)}
      />
    </main>
  );
}
