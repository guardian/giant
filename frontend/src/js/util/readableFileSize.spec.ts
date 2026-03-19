import { readableFileSize } from "./readableFileSize";

test("correctly convert small number", () => {
  expect(readableFileSize(1)).toBe("1.0 B");
});

test("correctly convert kilobyte range number", () => {
  expect(readableFileSize(1550)).toBe("1.5 KiB");
});

test("correctly convert metabyte range number", () => {
  expect(readableFileSize(1600000)).toBe("1.5 MiB");
});

test("correctly convert gigabyte range number", () => {
  expect(readableFileSize(1600000000)).toBe("1.5 GiB");
});

test("correctly convert terrabyte range number", () => {
  expect(readableFileSize(1600000000000)).toBe("1.5 TiB");
});

test("throw when bytes is negative", () => {
  expect(() => readableFileSize(-1)).toThrow();
});

test("throw when bytes is too big", () => {
  expect(() => readableFileSize(11258999092738498732498732946842624)).toThrow();
});
