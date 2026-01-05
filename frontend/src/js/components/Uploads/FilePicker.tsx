import React from "react";
import { Button } from "semantic-ui-react";
import {
  readFileEntry,
  readDirectoryEntry,
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemDirectoryEntry,
} from "./FileApiHelpers";

async function readDragEvent(e: React.DragEvent): Promise<Map<string, File>> {
  const files = new Map<string, File>();

  for (const item of e.dataTransfer.items) {
    if (item.webkitGetAsEntry()) {
      const entry: FileSystemEntry | null = item.webkitGetAsEntry();

      if (entry && entry.isFile) {
        const file = await readFileEntry(entry as FileSystemFileEntry);
        files.set(file.name, file as File);
      } else if (entry && entry.isDirectory) {
        const directoryFiles = await readDirectoryEntry(
          entry as FileSystemDirectoryEntry,
        );

        for (const [path, file] of directoryFiles) {
          files.set(path, file as File);
        }
      }
    } else {
      const file = item.getAsFile();

      if (file) {
        files.set(file.name, file);
      }
    }
  }

  return files;
}

type Props = {
  disabled: boolean;
  onAddFiles: (files: Map<string, File>) => void;
};

type State = {
  readingFiles: boolean;
};

type Action = "files" | "directory";

function UploadButton({
  action,
  loading,
  disabled,
  onClick,
}: {
  action: Action;
  loading: boolean;
  disabled: boolean;
  onClick: (action: Action) => void;
}) {
  // type=button prevents the button auto-submitting the form it is a part of
  return (
    <Button
      primary
      type="button"
      disabled={disabled}
      loading={loading}
      onClick={() => onClick(action)}
    >
      {action === "directory" ? "Add Directory" : "Add Files"}
    </Button>
  );
}

export default class FilePicker extends React.Component<Props, State> {
  state = { readingFiles: false };
  input: React.RefObject<HTMLInputElement>;

  constructor(props: Props) {
    super(props);

    this.input = React.createRef();
  }

  onClick = (type: "files" | "directory") => {
    if (this.input.current) {
      // Typescript doesn't know about webkitdirectory
      if (type === "directory") {
        // @ts-ignore
        this.input.current.webkitdirectory = true;
      } else {
        // @ts-ignore
        this.input.current.webkitdirectory = false;
      }

      this.input.current.click();
    }
  };

  onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files: Map<string, File> = new Map();

      for (const newFile of e.target.files) {
        // @ts-ignore
        // Typescript does not know about webkitRelativePath which is non-standard
        // but supported by all major browsers
        const newPath: string = newFile.webkitRelativePath || newFile.name;

        files.set(newPath, newFile);
      }

      this.props.onAddFiles(files);

      if (this.input.current) {
        // Avoids a bug where you add a folder, remove it and then try to add it again
        this.input.current.value = "";
      }
    }
  };

  onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  onDrop = (e: React.DragEvent) => {
    e.preventDefault();

    // Prevents React re-uses the event since readDragEvent is asynchronous
    e.persist();

    this.setState({ readingFiles: true });
    readDragEvent(e).then((files) => {
      this.props.onAddFiles(files);
      this.setState({ readingFiles: false });
    });
  };

  render() {
    return (
      <React.Fragment>
        <input
          type="file"
          multiple
          ref={this.input}
          style={{ display: "none" }}
          onChange={this.onChange}
        />
        <Button.Group onDragOver={this.onDragOver} onDrop={this.onDrop}>
          <UploadButton
            action="files"
            disabled={this.props.disabled}
            loading={this.state.readingFiles}
            onClick={this.onClick}
          />
          <Button.Or />
          <UploadButton
            action="directory"
            disabled={this.props.disabled}
            loading={this.state.readingFiles}
            onClick={this.onClick}
          />
        </Button.Group>
      </React.Fragment>
    );
  }
}
