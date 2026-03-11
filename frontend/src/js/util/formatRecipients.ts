type Recipient = { email: string; displayName?: string };

export function formatRecipients(
  recipients: Recipient[],
  maxLength: number,
): string {
  const joined = recipients.map((r) => r.displayName || r.email).join(", ");
  if (joined.length > maxLength) {
    return joined.slice(0, maxLength) + "…";
  }
  return joined;
}
