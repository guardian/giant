import { parseDate, parseDateNoFallback } from "./parseDate";

// --------------
// - FROM START -
// --------------

test("correctly parse just year", () => {
  expect(parseDateNoFallback("2018", "from_start")).toBe(Date.UTC(2018, 0));
});

test("correctly parse month and year", () => {
  expect(parseDateNoFallback("January 2018", "from_start")).toBe(
    Date.UTC(2018, 0),
  );
});

test("correctly parse lowercase month and year", () => {
  expect(parseDateNoFallback("january 2018", "from_start")).toBe(
    Date.UTC(2018, 0),
  );
});

test("correctly parse short month and year", () => {
  expect(parseDateNoFallback("Feb 2018", "from_start")).toBe(Date.UTC(2018, 1));
});

test("correctly parse day, month and year", () => {
  expect(parseDateNoFallback("9 Feb 2018", "from_start")).toBe(
    Date.UTC(2018, 1, 9),
  );
});

test("correctly parse day, month and year with day ordinal indicator", () => {
  expect(parseDateNoFallback("9th Feb 2018", "from_start")).toBe(
    Date.UTC(2018, 1, 9),
  );
});

// ------------
// - FROM END -
// ------------

test("correctly parse just year from end", () => {
  expect(parseDateNoFallback("2018", "from_end")).toBe(Date.UTC(2019, 0, 1));
});

test("correctly parse month and year from end", () => {
  expect(parseDateNoFallback("January 2018", "from_end")).toBe(
    Date.UTC(2018, 1),
  );
});

test("correctly parse lowercase month and year from end", () => {
  expect(parseDateNoFallback("january 2018", "from_end")).toBe(
    Date.UTC(2018, 1),
  );
});

test("correctly parse short month and year from end", () => {
  expect(parseDateNoFallback("Feb 2018", "from_end")).toBe(Date.UTC(2018, 2));
});

test("correctly parse day, month and year from end", () => {
  expect(parseDateNoFallback("9 Feb 2018", "from_end")).toBe(
    Date.UTC(2018, 1, 10),
  );
});

test("correctly parse day, month and year with day ordinal indicator from end", () => {
  expect(parseDateNoFallback("9th Feb 2018", "from_end")).toBe(
    Date.UTC(2018, 1, 10),
  );
});

test("correctly parse month and year from end when it rolls over a year", () => {
  expect(parseDateNoFallback("December 2018", "from_end")).toBe(
    Date.UTC(2019, 0),
  );
});

test("correctly parse day, month and year from end when it rolls over a year", () => {
  expect(parseDateNoFallback("31st December 2018", "from_end")).toBe(
    Date.UTC(2019, 0),
  );
});

// ------------
// - FALLBACK -
// ------------

test("correctly fall back to standard date parser", () => {
  expect(parseDate("2018-08-16T00:00:00+00:00", "from_start")).toBe(
    new Date("2018-08-16T00:00:00+00:00").getTime(),
  );
});

test("correctly fall back to standard date parser and fail in the expected way when using from_end", () => {
  expect(parseDate("2018-08-16T00:00:00+00:00", "from_end")).toBe(
    new Date("2018-08-16T00:00:00+00:00").getTime(),
  );
});
