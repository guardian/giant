import { z } from "zod";

// InputSupper.flattenAndUpdate writes these fields; Chips.parseQueryString reads
// them. Keep extra fields when forwarding serialized query fragments.
const queryChipSchema = z
  .looseObject({
    n: z.string(),
    v: z.string(),
    op: z.enum(["+", "-"]),
    t: z.string(),
    workspaceId: z.string().optional(),
    folderId: z.string().optional(),
  })
  .refine(
    (chip) =>
      chip.t !== "workspace_folder" ||
      (chip.workspaceId !== undefined && chip.folderId !== undefined),
    { message: "Workspace chips require workspace and folder IDs" },
  );

export const searchQueryFragmentsSchema = z.array(
  z.union([z.string(), queryChipSchema]),
);
export type SearchQueryFragment = z.infer<
  typeof searchQueryFragmentsSchema
>[number];

export type SearchQuery = {
  q: string;
  filters?: Record<string, string[]>;
  page?: string | number;
  pageSize?: string | number;
  sortBy?: string;
};
