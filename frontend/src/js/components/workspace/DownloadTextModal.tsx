import {
  isWorkspaceLeaf,
  Workspace,
  WorkspaceEntry,
} from "../../types/Workspaces";
import Modal from "../UtilComponents/Modal";
import { isTreeNode, TreeEntry } from "../../types/Tree";
import {
  getWordCountForBlobs,
  getWorkspaceText,
  getWorkspaceTotalWordCount,
} from "../../services/WorkspaceApi";
import { useEffect, useMemo, useState } from "react";
import {
  EuiButton,
  EuiCallOut,
  EuiLoadingSpinner,
  EuiProgress,
} from "@elastic/eui";

interface DownloadTextModalProps {
  isOpen: boolean;
  dismiss: () => void;
  workspace: Workspace;
  // When supplied, the download is scoped to this folder's subtree rather than the whole workspace.
  // `label` is used for the modal heading and the downloaded filename.
  rootEntry?: TreeEntry<WorkspaceEntry>;
  label?: string;
}

const getFileBlobUriMap = (
  entry: TreeEntry<WorkspaceEntry>,
  pathSoFar: string = "",
): { [blobUri: string]: string } => {
  if (isWorkspaceLeaf(entry.data)) {
    return { [entry.data.uri]: `${pathSoFar}/${entry.name}` };
  } else if (isTreeNode(entry)) {
    return entry.children.reduce(
      (blobUriMap, child) => ({
        ...blobUriMap,
        ...getFileBlobUriMap(
          child,
          // don't include the workspace name again (as that is the 'name' of the root node)
          pathSoFar ? `${pathSoFar}/${entry.name}` : "",
        ),
      }),
      {},
    );
  }
  return {};
};

export const DownloadTextModal = ({
  isOpen,
  dismiss,
  workspace,
  rootEntry,
  label,
}: DownloadTextModalProps) => {
  const isFolderDownload = rootEntry !== undefined;
  const downloadName = label ?? workspace.name;
  const scopeNoun = isFolderDownload ? "folder" : "workspace";

  // Always build full, workspace-root-relative paths (for provenance in the file headers), then restrict
  // to the chosen subtree's blobs when scoped to a folder.
  const blobUriToWorkspacePath = useMemo(() => {
    const fullMap = getFileBlobUriMap(workspace.rootNode);
    if (!rootEntry) {
      return fullMap;
    }
    const scopeUris = new Set(Object.keys(getFileBlobUriMap(rootEntry)));
    return Object.fromEntries(
      Object.entries(fullMap).filter(([uri]) => scopeUris.has(uri)),
    );
  }, [workspace.rootNode, rootEntry]);

  const allBlobUris = useMemo(
    () => Object.keys(blobUriToWorkspacePath),
    [blobUriToWorkspacePath],
  );

  const [totalWordCount, setTotalWordCount] = useState<number | null>(null);
  useEffect(() => {
    // Folder counts go via the blob-scoped endpoint; the whole-workspace count keeps its dedicated
    // (cheaper, tag-filtered) endpoint. Both use the same Elasticsearch aggregation, so the figures
    // are computed identically and reconcile.
    if (rootEntry) {
      getWordCountForBlobs(workspace.id, allBlobUris).then(setTotalWordCount);
    } else {
      getWorkspaceTotalWordCount(workspace.id).then(setTotalWordCount);
    }
  }, [workspace.id, rootEntry, allBlobUris]);

  const [targetNumOfResultFiles, setTargetNumOfResultFiles] = useState(
    Math.min(allBlobUris.length, 250),
  );

  const [progress, setProgress] = useState<number | null>(null);

  const downloadAllText = async () => {
    setProgress(0.01);

    const fetchTextBatchSize = Math.min(1000, totalWordCount! / 15_000);

    let buffer: {
      [blobUri: string]: {
        [lang: string]: string;
      };
    } = {};

    let fetchedCounter = 0;
    let currentOutputFile = {
      number: 0,
      text: "",
    };

    const dumpToFile = async () => {
      const filename = `${downloadName} (${workspace.id}).${currentOutputFile.number}.txt`;
      const myBlob = new Blob([currentOutputFile.text.trim()], {
        type: "text/plain",
      });
      const blobURL = URL.createObjectURL(myBlob);
      const a = document.createElement("a");
      a.setAttribute("href", blobURL);
      a.setAttribute("download", filename);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      // short wait between each download to ensure they actually happen
      await new Promise((resolve) => setTimeout(resolve, 500));
      document.body.removeChild(a);
      setTimeout(
        () => URL.revokeObjectURL(blobURL),
        5_000, // allow the file to be downloaded before releasing the object URL
      );

      currentOutputFile.number++;
      currentOutputFile.text = "";
      setProgress(
        Math.min(0.95, currentOutputFile.number / targetNumOfResultFiles),
      );
    };

    while (
      fetchedCounter < allBlobUris.length ||
      Object.keys(buffer).length > 0
    ) {
      let bufferEntries = Object.entries(buffer);
      if (
        bufferEntries.length <
        Math.min(fetchTextBatchSize, allBlobUris.length - fetchedCounter)
      ) {
        const blobUrisForThisBatch = allBlobUris.slice(
          fetchedCounter,
          Math.min(fetchedCounter + fetchTextBatchSize, allBlobUris.length),
        );
        const textForBatch = await getWorkspaceText(
          workspace.id,
          blobUrisForThisBatch,
        );
        fetchedCounter += blobUrisForThisBatch.length;
        buffer = {
          ...buffer,
          ...textForBatch,
        };
        bufferEntries = Object.entries(buffer);
      }
      for (const [blobUri, langTextMap] of bufferEntries) {
        for (const [lang, text] of Object.entries(langTextMap)) {
          const file = `${blobUriToWorkspacePath[blobUri]} (${lang})`;
          const wrappedText = `----- START OF ${file} -----\n\n${text}\n\n----- END OF ${file} -----\n\n\n`;
          const wordCount = wrappedText.split(/\s+/).length;
          const runningTotalWordCount =
            currentOutputFile.text.split(/\s+/).length;
          if (
            currentOutputFile.text.length > 0 &&
            runningTotalWordCount + wordCount > wordsPerFile!
          ) {
            await dumpToFile();
          }
          currentOutputFile.text += wrappedText;
          delete buffer[blobUri];
        }
      }
    }

    if (currentOutputFile.text.length > 0) {
      await dumpToFile();
    }

    setProgress(1);
  };

  const wordsPerFile =
    totalWordCount && Math.ceil(totalWordCount / targetNumOfResultFiles);

  return (
    <Modal isOpen={isOpen} dismiss={dismiss}>
      <div style={{ padding: "10px" }}>
        <h2>Download {isFolderDownload ? "Folder" : "Workspace"} as Text</h2>
        <p>
          {totalWordCount === null ? (
            <span>
              <EuiLoadingSpinner size="s" /> Calculating total word count for{" "}
              {scopeNoun}...
            </span>
          ) : (
            `This ${scopeNoun} has a total of ${totalWordCount.toLocaleString()} words across all files and languages.`
          )}
        </p>
        <p>
          This will download the text for all the{" "}
          <strong>{allBlobUris.length.toLocaleString()}</strong> files in this{" "}
          {scopeNoun}, with each file's text separated by a header indicating the
          file path and language.
        </p>
        <p>
          <label>
            Split into roughly{" "}
            <input
              type="number"
              value={targetNumOfResultFiles}
              min={1}
              max={allBlobUris.length}
              disabled={progress !== null}
              onChange={(e) =>
                setTargetNumOfResultFiles(parseInt(e.target.value))
              }
            />{" "}
            files (so approximately{" "}
            {wordsPerFile ? (
              wordsPerFile.toLocaleString()
            ) : (
              <EuiLoadingSpinner size="s" />
            )}{" "}
            words per file).
          </label>
        </p>
        {progress ? (
          <div>
            <EuiProgress value={progress} max={1.0} />
            <div>
              {progress === 1
                ? "Done! (please check the resulting files are contiguous)"
                : "Generating..."}
            </div>
          </div>
        ) : (
          <EuiButton
            onClick={downloadAllText}
            disabled={!totalWordCount || allBlobUris.length === 0}
          >
            Start Download
          </EuiButton>
        )}
        <br />
        <br />
        <EuiCallOut color={"warning"} title="Note">
          If prompted for permission to download <strong>multiple</strong>{" "}
          files, you must accept in order to use this functionality.
        </EuiCallOut>
      </div>
    </Modal>
  );
};
