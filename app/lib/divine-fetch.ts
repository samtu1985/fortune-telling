/**
 * Thin wrapper around fetch() for the divination endpoints that intercepts
 * HTTP 402 quota-exhausted responses and routes them to the QuotaExhaustedGate
 * via the supplied `onQuotaExhausted` callback.
 *
 * Callers should check `res.status === 402` after awaiting and bail out of
 * their success path — the appropriate modal will already be opening.
 */
export async function callDivine(
  path: "/api/divine" | "/api/divine-multi",
  body: unknown,
  onQuotaExhausted: (canPurchase: boolean) => void
): Promise<Response> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 402) {
    // Clone so callers can still read the body if they want to surface a
    // message; parsing failures default to canPurchase=false (safer).
    const data = await res
      .clone()
      .json()
      .catch(() => ({}));
    onQuotaExhausted(Boolean((data as { canPurchase?: unknown }).canPurchase));
  }

  return res;
}
