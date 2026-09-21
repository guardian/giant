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
    uri: "1234",
    parents: [],
  };

  expect(calculateResourceTitle(input)).toBe("Testing - Giant");
});

test("use default title for plain q string", () => {
  expect(calculateSearchTitle({ q: "hello" })).toBe("Search - Giant");
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

test.each([undefined, null, {}, { q: "" }])(
  "default title for absent query %j",
  (search) => {
    expect(calculateSearchTitle(search)).toBe("Search - Giant");
  },
);

test.each(
  [
    null,
    {},
    "hello",
    [null],
    [42],
    [{ n: "Mime Type" }],
    [{ v: "application/json" }],
    [{ n: "Mime Type", v: null }],
    [{ n: null, v: "application/json" }],
    [{ n: "Mime Type", v: "application/json", op: null }],
    ["valid text", { n: "Mime Type", v: [] }],
  ].map((query) => ({ query })),
)("default title for invalid query data $query", ({ query }) => {
  expect(calculateSearchTitle({ q: JSON.stringify(query) })).toBe(
    "Search - Giant",
  );
});

test("collapse an empty query", () => {
  expect(calculateSearchTitle({ q: "[]" })).toBe("Search - Giant");
});

test("render date chips without interpreting their values or metadata", () => {
  const q = [
    { n: "After", v: "Feb 2019", op: "+", t: "date" },
    { n: "Before", v: "2020", op: "-", t: "date_ex" },
  ];
  expect(calculateSearchTitle({ q: JSON.stringify(q) })).toBe(
    "After: Feb 2019 -Before: 2020 - Search - Giant",
  );
});
