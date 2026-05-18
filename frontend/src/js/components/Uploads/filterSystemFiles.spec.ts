import { filterSystemFiles } from "./filterSystemFiles";

function makeFile(name: string): File {
  return new File([""], name);
}

function toMap(entries: [string, File][]): Map<string, File> {
  return new Map(entries);
}

describe("filterSystemFiles", () => {
  it("passes through normal files unchanged", () => {
    const files = toMap([
      ["report.pdf", makeFile("report.pdf")],
      ["photos/holiday.jpg", makeFile("holiday.jpg")],
    ]);

    const result = filterSystemFiles(files);
    expect([...result.keys()]).toEqual(["report.pdf", "photos/holiday.jpg"]);
  });

  it("removes known junk basenames regardless of case", () => {
    const files = toMap([
      ["folder/.DS_Store", makeFile(".DS_Store")],
      [".ds_store", makeFile(".ds_store")],
      ["folder/Thumbs.db", makeFile("Thumbs.db")],
      ["DESKTOP.INI", makeFile("DESKTOP.INI")],
      ["keep.txt", makeFile("keep.txt")],
    ]);

    const result = filterSystemFiles(files);
    expect([...result.keys()]).toEqual(["keep.txt"]);
  });

  it("removes AppleDouble resource fork files (._prefix)", () => {
    const files = toMap([
      ["folder/._image.png", makeFile("._image.png")],
      ["._document.pdf", makeFile("._document.pdf")],
      ["folder/image.png", makeFile("image.png")],
    ]);

    const result = filterSystemFiles(files);
    expect([...result.keys()]).toEqual(["folder/image.png"]);
  });

  it("removes files under junk directory segments", () => {
    const files = toMap([
      ["__MACOSX/folder/._file.txt", makeFile("._file.txt")],
      [".Spotlight-V100/store.db", makeFile("store.db")],
      [".Trashes/501/file.txt", makeFile("file.txt")],
      [".fseventsd/0000001", makeFile("0000001")],
      ["docs/notes.txt", makeFile("notes.txt")],
    ]);

    const result = filterSystemFiles(files);
    expect([...result.keys()]).toEqual(["docs/notes.txt"]);
  });

  it("returns empty map when all files are junk", () => {
    const files = toMap([
      [".DS_Store", makeFile(".DS_Store")],
      ["._secret", makeFile("._secret")],
    ]);

    const result = filterSystemFiles(files);
    expect(result.size).toBe(0);
  });

  it("returns empty map for empty input", () => {
    const result = filterSystemFiles(new Map());
    expect(result.size).toBe(0);
  });
});
