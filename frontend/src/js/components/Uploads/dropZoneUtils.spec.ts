import {
  readFilesFromDragEvent,
  dragEventContainsFiles,
} from "./dropZoneUtils";
import * as FileApiHelpers from "./FileApiHelpers";

// Mock the FileApiHelpers module
jest.mock("./FileApiHelpers");
const mockedReadFileEntry = FileApiHelpers.readFileEntry as jest.MockedFunction<
  typeof FileApiHelpers.readFileEntry
>;
const mockedReadDirectoryEntry =
  FileApiHelpers.readDirectoryEntry as jest.MockedFunction<
    typeof FileApiHelpers.readDirectoryEntry
  >;

function makeFile(name: string): File {
  return new File(["content"], name);
}

type MockItem = {
  webkitGetAsEntry: () => FileApiHelpers.FileSystemEntry | null;
  getAsFile: () => File | null;
};

function makeFileEntry(name: string): FileApiHelpers.FileSystemFileEntry {
  const file = makeFile(name);
  return {
    isFile: true,
    isDirectory: false,
    fullPath: `/${name}`,
    file: (cb: (f: File) => void) => {
      cb(file);
      return undefined as undefined;
    },
  };
}

function makeDirectoryEntry(): FileApiHelpers.FileSystemDirectoryEntry {
  return {
    isFile: false,
    isDirectory: true,
    createReader: () =>
      ({
        isFile: false,
        isDirectory: false,
        readEntries: (
          cb: (entries: FileApiHelpers.FileSystemEntry[]) => void,
        ) => {
          cb([]);
          return undefined as undefined;
        },
      }) as FileApiHelpers.FileSystemDirectoryReader,
  };
}

function makeDragEvent(
  items: MockItem[],
  types: string[] = ["Files"],
): React.DragEvent {
  return {
    dataTransfer: {
      items: items as unknown as DataTransferItemList,
      types,
    },
  } as unknown as React.DragEvent;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe("readFilesFromDragEvent", () => {
  test("reads a single file via webkitGetAsEntry", async () => {
    const entry = makeFileEntry("test.txt");
    const file = makeFile("test.txt");

    mockedReadFileEntry.mockResolvedValue(file);

    const event = makeDragEvent([
      { webkitGetAsEntry: () => entry, getAsFile: () => null },
    ]);

    const result = await readFilesFromDragEvent(event);

    expect(result.size).toBe(1);
    expect(result.get("test.txt")).toBe(file);
  });

  test("reads multiple files", async () => {
    const entry1 = makeFileEntry("a.txt");
    const entry2 = makeFileEntry("b.txt");
    const file1 = makeFile("a.txt");
    const file2 = makeFile("b.txt");

    mockedReadFileEntry
      .mockResolvedValueOnce(file1)
      .mockResolvedValueOnce(file2);

    const event = makeDragEvent([
      { webkitGetAsEntry: () => entry1, getAsFile: () => null },
      { webkitGetAsEntry: () => entry2, getAsFile: () => null },
    ]);

    const result = await readFilesFromDragEvent(event);

    expect(result.size).toBe(2);
    expect(result.get("a.txt")).toBe(file1);
    expect(result.get("b.txt")).toBe(file2);
  });

  test("reads a single directory", async () => {
    const dirEntry = makeDirectoryEntry();
    const dirFiles = new Map<string, File>([
      ["dir/a.txt", makeFile("a.txt")],
      ["dir/b.txt", makeFile("b.txt")],
    ]);

    mockedReadDirectoryEntry.mockResolvedValue(dirFiles);

    const event = makeDragEvent([
      { webkitGetAsEntry: () => dirEntry, getAsFile: () => null },
    ]);

    const result = await readFilesFromDragEvent(event);

    expect(result.size).toBe(2);
    expect(result.has("dir/a.txt")).toBe(true);
    expect(result.has("dir/b.txt")).toBe(true);
  });

  test("rejects multiple directories", async () => {
    const dir1 = makeDirectoryEntry();
    const dir2 = makeDirectoryEntry();

    const event = makeDragEvent([
      { webkitGetAsEntry: () => dir1, getAsFile: () => null },
      { webkitGetAsEntry: () => dir2, getAsFile: () => null },
    ]);

    await expect(readFilesFromDragEvent(event)).rejects.toThrow(
      "Dragging multiple folders at once is not supported",
    );
  });

  test("rejects mixed files and directory", async () => {
    const dirEntry = makeDirectoryEntry();
    const fileEntry = makeFileEntry("test.txt");

    const event = makeDragEvent([
      { webkitGetAsEntry: () => dirEntry, getAsFile: () => null },
      { webkitGetAsEntry: () => fileEntry, getAsFile: () => null },
    ]);

    await expect(readFilesFromDragEvent(event)).rejects.toThrow(
      "not both at the same time",
    );
  });

  test("rejects directory mixed with fallback files", async () => {
    const dirEntry = makeDirectoryEntry();
    const fallbackFile = makeFile("fallback.txt");

    const event = makeDragEvent([
      { webkitGetAsEntry: () => dirEntry, getAsFile: () => null },
      { webkitGetAsEntry: () => null, getAsFile: () => fallbackFile },
    ]);

    await expect(readFilesFromDragEvent(event)).rejects.toThrow(
      "not both at the same time",
    );
  });

  test("falls back to getAsFile when webkitGetAsEntry returns null", async () => {
    const file = makeFile("fallback.txt");

    const event = makeDragEvent([
      { webkitGetAsEntry: () => null, getAsFile: () => file },
    ]);

    const result = await readFilesFromDragEvent(event);

    expect(result.size).toBe(1);
    expect(result.get("fallback.txt")).toBe(file);
    expect(mockedReadFileEntry).not.toHaveBeenCalled();
  });

  test("skips items where both webkitGetAsEntry and getAsFile return null", async () => {
    const file = makeFile("real.txt");

    mockedReadFileEntry.mockResolvedValue(file);

    const event = makeDragEvent([
      { webkitGetAsEntry: () => null, getAsFile: () => null },
      {
        webkitGetAsEntry: () => makeFileEntry("real.txt"),
        getAsFile: () => null,
      },
    ]);

    const result = await readFilesFromDragEvent(event);

    expect(result.size).toBe(1);
    expect(result.get("real.txt")).toBe(file);
  });
});

describe("dragEventContainsFiles", () => {
  test("returns false when application/json is present (internal drag)", () => {
    const event = makeDragEvent([], ["application/json", "Files"]);
    expect(dragEventContainsFiles(event)).toBe(false);
  });

  test("returns true when Files type is present", () => {
    const event = makeDragEvent([], ["Files"]);
    expect(dragEventContainsFiles(event)).toBe(true);
  });

  test("returns true when items contain a file kind", () => {
    const event = {
      dataTransfer: {
        types: ["text/plain"],
        items: [{ kind: "file" }] as unknown as DataTransferItemList,
      },
    } as unknown as React.DragEvent;

    expect(dragEventContainsFiles(event)).toBe(true);
  });

  test("returns false when no files and no file items", () => {
    const event = {
      dataTransfer: {
        types: ["text/plain"],
        items: [{ kind: "string" }] as unknown as DataTransferItemList,
      },
    } as unknown as React.DragEvent;

    expect(dragEventContainsFiles(event)).toBe(false);
  });

  test("returns false for empty dataTransfer", () => {
    const event = {
      dataTransfer: {
        types: [],
        items: [] as unknown as DataTransferItemList,
      },
    } as unknown as React.DragEvent;

    expect(dragEventContainsFiles(event)).toBe(false);
  });
});
