import {
  isWorkspaceLeaf,
  Workspace,
  WorkspaceEntry,
} from "../../types/Workspaces";
import Modal from "../UtilComponents/Modal";
import { isTreeNode, TreeEntry } from "../../types/Tree";
import {
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
}: DownloadTextModalProps) => {
  const [workspaceWordCount, setWorkspaceWordCount] = useState<number | null>(
    null,
  );
  useEffect(() => {
    getWorkspaceTotalWordCount(workspace.id).then(setWorkspaceWordCount);
  }, [workspace.id]);

  const blobUriToWorkspacePath = useMemo(
    () => getFileBlobUriMap(workspace.rootNode),
    [workspace.rootNode],
  );

  const allBlobUris = useMemo(
    () => Object.keys(blobUriToWorkspacePath),
    [blobUriToWorkspacePath],
  );

  const [targetNumOfResultFiles, setTargetNumOfResultFiles] = useState(
    Math.min(allBlobUris.length, 250),
  );

  const [progress, setProgress] = useState<number | null>(null);

  const downloadAllText = async () => {
    setProgress(0.01);

    const fetchTextBatchSize = Math.min(1000, workspaceWordCount! / 15_000);

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

    const dumpToFile = () => {
      const filename = `${workspace.name} (${workspace.id}).${currentOutputFile.number}.txt`;
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
      document.body.removeChild(a);
      URL.revokeObjectURL(blobURL);

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
            dumpToFile();
          }
          currentOutputFile.text += wrappedText;
          delete buffer[blobUri];
        }
      }
    }

    if (currentOutputFile.text.length > 0) {
      dumpToFile();
    }

    setProgress(1);
  };

  const wordsPerFile =
    workspaceWordCount &&
    Math.ceil(workspaceWordCount / targetNumOfResultFiles);

  return (
    <Modal isOpen={isOpen} dismiss={dismiss}>
      <div style={{ padding: "10px" }}>
        <h2>Download Workspace as Text</h2>
        <p>
          {workspaceWordCount === null ? (
            <span>
              <EuiLoadingSpinner size="s" /> Calculating total word count for
              workspace...
            </span>
          ) : (
            `This workspace has a total of ${workspaceWordCount.toLocaleString()} words across all files and languages.`
          )}
        </p>
        <p>
          This will download the text for all the{" "}
          <strong>{allBlobUris.length.toLocaleString()}</strong> files in this
          workspace, with each file's text separated by a header indicating the
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
              {progress === 1 ? (
                "Done!"
              ) : (
                <span>
                  Generating{" "}
                  <code>
                    {
                      Object.entries(progress).find(
                        ([_, isComplete]) => !isComplete,
                      )?.[0]
                    }
                  </code>
                </span>
              )}
            </div>
          </div>
        ) : (
          <EuiButton
            onClick={downloadAllText}
            disabled={!workspaceWordCount || allBlobUris.length === 0}
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
