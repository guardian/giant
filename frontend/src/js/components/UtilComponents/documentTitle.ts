import {
  SearchQueryFragment,
  parseSearchQueryFragments,
} from "../../types/SearchQuery";
import type { Resource } from "../../types/Resource";

export function calculateResourceTitle(resource: Resource | null): string {
  const postfix = "Giant";

  if (resource) {
    if (resource.type === "email" && resource.subject) {
      return `${resource.subject} - ${postfix}`;
    }

    const parts = (resource.display || decodeURIComponent(resource.uri)).split(
      "/",
    );

    const isResource = parts.length > 1;
    const isBlob = !isResource && resource.parents.length > 0;

    if (isResource) {
      return `${parts[parts.length - 1]} - ${postfix}`;
    } else if (isBlob) {
      // Render parent resource name if viewing a blob.
      // For user-uploaded files this will be the filename they uploaded with.
      const parts = resource.parents[0].uri.split("/");

      if (parts.length > 1) {
        return `${decodeURIComponent(parts[parts.length - 1])} - ${postfix}`;
      }
    }
  }

  return postfix;
}

export function calculateSearchTitle(
  search:
    | { q?: string | string[]; fragments?: SearchQueryFragment[] }
    | string
    | null
    | undefined,
): string {
  if (
    search &&
    typeof search === "object" &&
    typeof search.q === "string" &&
    search.q
  ) {
    try {
      const query = search.fragments ?? parseSearchQueryFragments(search.q);
      const parts = query.map((part) => {
        if (typeof part !== "string" && part.n) {
          if (part.op === "-") {
            return `-${part.n}: ${part.v}`;
          }

          return `${part.n}: ${part.v}`;
        }

        return part;
      });

      if (parts.length > 0 && !(parts.length === 1 && parts[0] === "")) {
        return `${parts.join(" ")} - Search - Giant`;
      }
    } catch {
      // We don't understand the format
    }
  }

  return "Search - Giant";
}
