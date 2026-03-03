import { format } from 'date-fns';

export function formatDate(date) {
  return format(date, "MMM d, yyyy 'at' h:mmaaa");
}
