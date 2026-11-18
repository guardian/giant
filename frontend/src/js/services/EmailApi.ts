import authFetch from "../util/auth/authFetch";
import { EmailThread, emailThreadSchema } from "../types/Email";

export async function getEmailThread(uri: string): Promise<EmailThread> {
  const response = await authFetch(`/api/emails/thread/${uri}`);
  const data: unknown = await response.json();
  const result = emailThreadSchema.safeParse(data);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
