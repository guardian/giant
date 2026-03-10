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

  it("removes .DS_Store files", () => {
    const files = toMap([
      ["folder/.DS_Store", makeFile(".DS_Store")],
      [".DS_Store", makeFile(".DS_Store")],
      ["readme.md", makeFile("readme.md")],
    ]);

    const result = filterSystemFiles(files);
    expect([...result.keys()]).toEqual(["readme.md"]);
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

  it("removes __MACOSX directory entries", () => {
    const files = toMap([
      ["__MACOSX/folder/._file.txt", makeFile("._file.txt")],
      ["__MACOSX/.DS_Store", makeFile(".DS_Store")],
      ["docs/notes.txt", makeFile("notes.txt")],
    ]);

    const result = filterSystemFiles(files);
    expect([...result.keys()]).toEqual(["docs/notes.txt"]);
  });

  it("removes Windows system files", () => {
    const files = toMap([
      ["folder/Thumbs.db", makeFile("Thumbs.db")],
      ["desktop.ini", makeFile("desktop.ini")],
      ["data.csv", makeFile("data.csv")],
    ]);

    const result = filterSystemFiles(files);
    expect([...result.keys()]).toEqual(["data.csv"]);
  });

  it("removes macOS system directories", () => {
    const files = toMap([
      [".Spotlight-V100/store.db", makeFile("store.db")],
      [".Trashes/501/file.txt", makeFile("file.txt")],
      [".fseventsd/0000001", makeFile("0000001")],
      ["real-file.txt", makeFile("real-file.txt")],
    ]);

    const result = filterSystemFiles(files);
    expect([...result.keys()]).toEqual(["real-file.txt"]);
  });

  it("is case-insensitive", () => {
    const files = toMap([
      [".ds_store", makeFile(".ds_store")],
      ["THUMBS.DB", makeFile("THUMBS.DB")],
      ["__MACOSX/file", makeFile("file")],
      ["keep.txt", makeFile("keep.txt")],
    ]);

    const result = filterSystemFiles(files);
    expect([...result.keys()]).toEqual(["keep.txt"]);
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
