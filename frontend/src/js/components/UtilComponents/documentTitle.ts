import { z } from "zod";
import type { Resource } from "../../types/Resource";

type TitleResource = Pick<Resource, "uri" | "display"> & {
  type?: Resource["type"];
  subject?: string;
  parents: Pick<Resource, "uri">[];
};

// Only the fields used to render a title. Chip metadata (including date types)
// is left to the query editor and search API to interpret.
const titleQuerySchema = z.array(
  z.union([
    z.string(),
    z.object({ n: z.string(), v: z.string(), op: z.string().optional() }),
  ]),
);
type TitleQuery = z.infer<typeof titleQuerySchema>;

export function calculateResourceTitle(
  resource: TitleResource | null | undefined,
): string {
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
  search: { q?: string } | null | undefined,
): string {
  if (search && search.q) {
    try {
      const parsed: unknown = JSON.parse(search.q);
      const result = titleQuerySchema.safeParse(parsed);
      // Invalid query data uses the same default title as malformed JSON.
      if (!result.success) return "Search - Giant";
      const query: TitleQuery = result.data;
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
