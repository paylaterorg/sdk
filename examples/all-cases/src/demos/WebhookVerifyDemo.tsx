/**
 * @dev Placeholder for the "Verify webhooks (Node)" case. The actual helper
 * — `paylater.webhooks.constructEvent` from `@paylater/sdk/webhooks` — is a
 * Node-only export (uses `node:crypto`) and is intentionally tree-shaken
 * out of browser bundles by the package's `exports` map. So there's no live
 * widget to render here; the demo slot explains the runtime instead.
 */
export function WebhookVerifyDemo() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 20,
        borderRadius: 12,
        background: "color-mix(in srgb, currentColor 4%, transparent)",
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      <strong style={{ fontSize: 13, letterSpacing: 0.2 }}>
        Runs on your Node server — not in the browser
      </strong>
      <p style={{ margin: 0 }}>
        The webhook verification helper lives at the <code>@paylater/sdk/webhooks</code> sub-import
        and uses <code>node:crypto</code> for constant-time HMAC comparison. It is deliberately
        excluded from browser bundles via the package&apos;s <code>exports</code> map.
      </p>
      <p style={{ margin: 0 }}>
        Copy the snippet on the left into your Node webhook handler (Express, Fastify, Hono, or a
        serverless function). Configure the destination URL from your PayLater dashboard →{" "}
        <em>API keys → Webhook</em>, and store the secret you reveal there as{" "}
        <code>PAYLATER_WEBHOOK_SECRET</code> on your backend.
      </p>
      <p style={{ margin: 0 }}>
        Events fired: <code>agreement.signed</code> (after the customer reaches the success state in
        the widget) and <code>test.ping</code> (from the dashboard &ldquo;Send test event&rdquo;
        button). Payloads carry a <code>livemode</code> flag so the same handler can route test vs
        production traffic.
      </p>
    </div>
  );
}
