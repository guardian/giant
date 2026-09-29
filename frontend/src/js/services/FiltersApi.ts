import authFetch from "../util/auth/authFetch";
import { SearchFilter, searchFiltersSchema } from "../types/SearchFilter";

export async function fetchFilters(): Promise<SearchFilter[]> {
  const response = await authFetch("/api/filters");
  const data: unknown = await response.json();
  const result = searchFiltersSchema.safeParse(data);
  if (!result.success) {
    // Reject through getFilters' existing APP_SHOW_ERROR path, like fetch/JSON errors.
    throw result.error;
  }
  return result.data;
}
