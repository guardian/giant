import { beforeEach, expect, it, vi } from "vitest";
import authFetch from "../util/auth/authFetch";
import { getSuggestedFields, performSearch } from "./SearchApi";
import { performSearch as searchAction } from "../actions/search/performSearch";
import { getSuggestedFields as fieldsAction } from "../actions/search/getSuggestedFields";
import { searchResponseSchema } from "../types/SearchResults";

vi.mock("../util/auth/authFetch", () => ({ default: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const document = {
  uri: "doc",
  highlights: [{ field: "text", display: "Text", highlight: "match" }],
  details: {
    _type: "document",
    mimeTypes: ["text/plain"],
    displayMimeTypes: ["Plain text"],
    fileCategory: "text",
    fileUris: ["file"],
  },
  collections: ["collection"],
};
const response = {
  hits: 1,
  took: 2,
  page: 1,
  pageSize: 100,
  results: [document],
  aggs: [
    {
      key: "createdAt",
      buckets: [{ key: "2020", count: 1, buckets: [{ key: "01", count: 1 }] }],
    },
  ],
};
const query = { q: '["hello"]' };

it("accepts both detail variants, recursive buckets and optional nulls", async () => {
  const data = {
    ...response,
    results: [
      {
        ...document,
        createdAt: 123,
        flag: null,
        fieldWithMostHighlights: null,
        details: { ...document.details, fileSize: null },
      },
      {
        ...document,
        details: {
          _type: "email",
          from: { email: "from@example.com", displayName: null },
          recipients: [{ email: "to@example.com" }],
          subject: "Subject",
          attachmentCount: 0,
        },
      },
    ],
  };
  vi.mocked(authFetch).mockResolvedValue(Response.json(data));
  const result = await performSearch(query);
  expect(result.results[0].createdAt).toBe(123);
  expect(result.results[0].fieldWithMostHighlights).toBeUndefined();
  expect(result.results[1].details._type).toBe("email");
  expect(result.aggs).toEqual(response.aggs);
  expect(result).not.toHaveProperty("pages");
  expect(
    searchResponseSchema.safeParse({
      ...response,
      results: [],
      aggs: [],
      pageSize: 0,
    }).success,
  ).toBe(true);
});

it("preserves filters, defaults, date conversion and workspace chip IDs", async () => {
  vi.mocked(authFetch).mockResolvedValue(Response.json(response));
  const workspace = {
    n: "Folder",
    v: "Folder",
    op: "+",
    t: "workspace_folder",
    workspaceId: "w",
    folderId: "f",
    extra: "keep",
  };
  await performSearch({
    q: JSON.stringify([
      "hello",
      { n: "Created Before", v: "2018", op: "-", t: "date" },
      { n: "Created After", v: "2018", op: "+", t: "date_ex" },
      { n: "Created Before", v: "invalid date", op: "+", t: "date" },
      workspace,
    ]),
    filters: { ingestion: ["collection/ingestion"] },
  });
  const url = String(vi.mocked(authFetch).mock.calls[0][0]);
  const params = new URL(url, "http://localhost").searchParams;
  expect(JSON.parse(params.get("q") ?? "")).toEqual([
    "hello",
    { n: "Created Before", v: String(Date.UTC(2018, 0)), op: "-", t: "date" },
    { n: "Created After", v: String(Date.UTC(2019, 0)), op: "+", t: "date_ex" },
    "",
    workspace,
  ]);
  expect(params.get("ingestion[]")).toBe("collection/ingestion");
  expect(params.get("page")).toBe("1");
  expect(params.get("pageSize")).toBe("100");
  expect(params.get("sortBy")).toBe("relevance");
});

it.each(
  [
    null,
    { ...response, pageSize: undefined },
    { ...response, hits: "1" },
    { ...response, results: [{ ...document, collections: null }] },
    { ...response, results: [{ ...document, details: { _type: "other" } }] },
    {
      ...response,
      results: [{ ...document, highlights: [{ field: "text" }] }],
    },
    {
      ...response,
      aggs: [
        { key: "year", buckets: [{ key: "2020", count: 1, buckets: [null] }] },
      ],
    },
  ].map((data) => ({ data })),
)(
  "rejects malformed search data $data through SEARCH_FAILURE",
  async ({ data }) => {
    vi.mocked(authFetch).mockResolvedValue(Response.json(data));
    const dispatch = vi.fn();
    await searchAction(query)(dispatch);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "SEARCH_FAILURE",
      receivedAt: expect.any(Number),
    });
  },
);

it.each([
  "{",
  "null",
  "[1]",
  '[{"n":"Mime Type","v":"text/plain","op":"+","t":null}]',
  '[{"n":"Folder","v":"Folder","op":"+","t":"workspace_folder"}]',
])("rejects invalid query %s before making a request", async (q) => {
  const dispatch = vi.fn();
  await searchAction({ q })(dispatch);
  expect(authFetch).not.toHaveBeenCalled();
  expect(dispatch).toHaveBeenLastCalledWith({
    type: "SEARCH_FAILURE",
    receivedAt: expect.any(Number),
  });
});

it("validates suggested fields including dropdown options", async () => {
  const fields = [
    { name: "Body Text", type: "text" },
    { name: "Before", type: "date" },
    { name: "After", type: "date_ex" },
    {
      name: "Has Field",
      type: "dropdown",
      options: [{ label: "Text", value: "text" }],
    },
  ];
  vi.mocked(authFetch).mockResolvedValue(Response.json(fields));
  expect(await getSuggestedFields()).toEqual(fields);
  vi.mocked(authFetch).mockResolvedValue(Response.json([]));
  expect(await getSuggestedFields()).toEqual([]);
});

it.each(
  [
    null,
    [{}],
    [{ name: "Bad", type: "other" }],
    [{ name: "Dropdown", type: "dropdown", options: null }],
    [{ name: "Dropdown", type: "dropdown", options: [{ value: "text" }] }],
  ].map((data) => ({ data })),
)("rejects malformed fields $data through APP_SHOW_ERROR", async ({ data }) => {
  vi.mocked(authFetch).mockResolvedValue(Response.json(data));
  const dispatch = vi.fn();
  await fieldsAction()(dispatch);
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenLastCalledWith({
    type: "APP_SHOW_ERROR",
    message: "Failed to get suggested fields",
    error: expect.any(Error),
    receivedAt: expect.any(Number),
  });
});

it.each(["json", "network"])(
  "preserves %s rejection paths",
  async (failure) => {
    if (failure === "json") {
      vi.mocked(authFetch).mockImplementation(async () => new Response("{"));
    } else {
      vi.mocked(authFetch).mockRejectedValue(new Error("Network failure"));
    }
    await expect(performSearch(query)).rejects.toThrow();
    await expect(getSuggestedFields()).rejects.toThrow();
  },
);
