import { format } from "date-fns";

export function formatDate(date: Date | number): string {
  return format(date, "MMM d, yyyy 'at' h:mmaaa");
}
