// The File And Directories API is not in Typescript yet
//  - https://github.com/Microsoft/TypeScript/issues/29548
//  - https://wicg.github.io/entries-api/
interface File extends Blob {
  readonly lastModified: number;
  readonly name: string;
  readonly webkitRelativePath?: string;
}

export interface FileSystemEntry {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
}

export interface FileSystemFileEntry extends FileSystemEntry {
  fullPath?: string;
  file(
    successCallback: (file: File) => void,
    errorCallback?: (error: any) => void,
  ): undefined;
}

export interface FileSystemDirectoryReader extends FileSystemEntry {
  readEntries(
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (error: any) => void,
  ): undefined;
}

export interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader(): FileSystemDirectoryReader;
}

function getPath(entry: FileSystemFileEntry, file: File): string {
  const { fullPath } = entry;

  if (fullPath) {
    if (fullPath.startsWith("/")) {
      return fullPath.substring(1);
    } else {
      return fullPath;
    }
  } else if (file.webkitRelativePath) {
    return file.webkitRelativePath;
  }

  return file.name;
}

export async function readFileEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

export async function readDirectoryEntry(
  entry: FileSystemDirectoryEntry,
): Promise<Map<string, File>> {
  async function entriesToMap(
    entries: FileSystemEntry[],
  ): Promise<Map<string, File>> {
    const ret = new Map<string, File>();

    for (const entry of entries) {
      if (entry.isFile) {
        const fsEntry = entry as FileSystemFileEntry;

        const file = await readFileEntry(fsEntry);
        const path = getPath(fsEntry, file);

        ret.set(path, file);
      } else if (entry.isDirectory) {
        const files = await readDirectoryEntry(
          entry as FileSystemDirectoryEntry,
        );

        files.forEach((file, path) => {
          ret.set(path, file);
        });
      }
    }

    return ret;
  }

  return new Promise((resolve, reject) => {
    entry
      .createReader()
      .readEntries((entries) => entriesToMap(entries).then(resolve), reject);
  });
}
