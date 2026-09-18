import { calculateResourceTitle, calculateSearchTitle } from "./documentTitle";

test("default title for undefined resource", () => {
  expect(calculateResourceTitle(undefined)).toBe("Giant");
});

test("default title for empty string", () => {
  expect(calculateResourceTitle({ uri: "", parents: [] })).toBe("Giant");
});

test("default title for single path with no parents", () => {
  expect(calculateResourceTitle({ uri: "1234", parents: [] })).toBe("Giant");
});

test("first parent name for blob", () => {
  const input = {
    uri: "1234",
    parents: [{ uri: "collection/ingestion/test.jpg" }],
  };

  expect(calculateResourceTitle(input)).toBe("test.jpg - Giant");
});

test("last part of path for file", () => {
  const input = { uri: "collection/ingestion/test.jpg", parents: [] };

  expect(calculateResourceTitle(input)).toBe("test.jpg - Giant");
});

test("use subject in title for email", () => {
  const input = {
    type: "email" as const,
    subject: "Testing",
    uri: "",
    parents: [],
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
