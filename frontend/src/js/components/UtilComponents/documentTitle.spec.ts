import { calculateResourceTitle, calculateSearchTitle } from "./documentTitle";
import type { Resource } from "../../types/Resource";

const resource: Resource = {
  uri: "",
  type: "blob",
  isExpandable: false,
  processingStage: { type: "processed" },
  extracted: false,
  mimeTypes: [],
  fileSize: 0,
  parents: [],
  children: [],
  comments: [],
  previewStatus: "disabled",
};

test("default title for null resource", () => {
  expect(calculateResourceTitle(null)).toBe("Giant");
});

test("default title for empty string", () => {
  expect(calculateResourceTitle(resource)).toBe("Giant");
});

test("default title for single path with no parents", () => {
  expect(calculateResourceTitle({ ...resource, uri: "1234" })).toBe("Giant");
});

test("first parent name for blob", () => {
  const input = {
    ...resource,
    uri: "1234",
    parents: [{ ...resource, uri: "collection/ingestion/test.jpg" }],
  };

  expect(calculateResourceTitle(input)).toBe("test.jpg - Giant");
});

test("last part of path for file", () => {
  const input = { ...resource, uri: "collection/ingestion/test.jpg" };

  expect(calculateResourceTitle(input)).toBe("test.jpg - Giant");
});

test("use subject in title for email", () => {
  const input = {
    ...resource,
    type: "email" as const,
    subject: "Testing",
  };

  expect(calculateResourceTitle(input)).toBe("Testing - Giant");
});

test("use default title for plain q string", () => {
  expect(calculateSearchTitle("hello")).toBe("Search - Giant");
});

test("use default title for malformed JSON q string", () => {
  expect(calculateSearchTitle({ q: "{ half: finished" })).toBe(
    "Search - Giant",
  );
});

test("collapse empty array q string", () => {
  // This happens when you manually deleted everything from the search bar
  expect(calculateSearchTitle({ q: JSON.stringify([""]) })).toBe(
    "Search - Giant",
  );
});

test("collapse query parts", () => {
  // This happens when you manually deleted everything from the search bar
  expect(calculateSearchTitle({ q: JSON.stringify(["hello", "world"]) })).toBe(
    "hello world - Search - Giant",
  );
});

test("collapse chips in query parts", () => {
  const q = ["hello", { n: "Mime Type", v: "application/json" }];

  // This happens when you manually deleted everything from the search bar
  expect(calculateSearchTitle({ q: JSON.stringify(q) })).toBe(
    "hello Mime Type: application/json - Search - Giant",
  );
});

test("collapse negative chips in query parts", () => {
  const q = ["hello", { op: "-", n: "Mime Type", v: "application/json" }];

  // This happens when you manually deleted everything from the search bar
  expect(calculateSearchTitle({ q: JSON.stringify(q) })).toBe(
    "hello -Mime Type: application/json - Search - Giant",
  );
});

test.each([
  null,
  {},
  "plain text",
  [null],
  [42],
  [{ n: "Mime Type" }],
  [{ n: null, v: "text/plain" }],
  [{ n: "Mime Type", v: null }],
  [{ n: "Mime Type", v: "text/plain", op: "invalid" }],
])("use default title for invalid query data: %j", (query) => {
  expect(calculateSearchTitle({ q: JSON.stringify(query) })).toBe(
    "Search - Giant",
  );
});

test.each([undefined, null, {}, { q: "" }, { q: [] }, { q: "[]" }])(
  "use default title for missing or empty query: %j",
  (search) => {
    expect(calculateSearchTitle(search)).toBe("Search - Giant");
  },
);

test("render date and workspace chips without using their extra fields", () => {
  const q = [
    { n: "Created Before", v: "2018", op: "+", t: "date" },
    { n: "Created After", v: "Feb 2019", op: "-", t: "date_ex" },
    {
      n: "Folder",
      v: "Evidence",
      t: "workspace_folder",
      workspaceId: "w",
      folderId: "f",
    },
  ];
  expect(calculateSearchTitle({ q: JSON.stringify(q) })).toBe(
    "Created Before: 2018 -Created After: Feb 2019 Folder: Evidence - Search - Giant",
  );
});
