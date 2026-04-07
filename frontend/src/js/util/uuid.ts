// randomUUID() is supported in all browsers but typescript doesn't recognise it yet so we do this
// see mdn docs here https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
export function uuidOrFallback(): string {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto &&
    typeof (crypto as any).randomUUID === "function"
  ) {
    return (crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
