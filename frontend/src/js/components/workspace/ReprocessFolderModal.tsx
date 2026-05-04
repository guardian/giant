import React from "react";
import Modal from "../UtilComponents/Modal";
import { WorkspaceNode } from "../../types/Workspaces";

type ReprocessFolderModalProps = {
  isOpen: boolean;
  folderName: string;
  folderData: WorkspaceNode;
  onReprocessErrored: () => void;
  onReprocessAll: () => void;
  onCancel: () => void;
};

export function ReprocessFolderModal({
  isOpen,
  folderName,
  folderData,
  onReprocessErrored,
  onReprocessAll,
  onCancel,
}: ReprocessFolderModalProps) {
  const totalFiles = folderData.descendantsLeafCount;
  const failedFiles = folderData.descendantsFailedCount;

  return (
    <Modal isOpen={isOpen} isDismissable={true} dismiss={onCancel}>
      <div className="form form-full-width">
        <h2 className="modal__title">Reprocess folder contents</h2>
        <div className="form__row">
          <p>
            The folder <strong>{folderName}</strong> contains{" "}
            <strong>{totalFiles}</strong> file{totalFiles !== 1 ? "s" : ""}
            {failedFiles > 0 && (
              <>
                , of which <strong>{failedFiles}</strong>{" "}
                {failedFiles === 1 ? "has" : "have"} errors
              </>
            )}
            .
          </p>
          <p>How would you like to proceed?</p>
        </div>
        <div className="form__row btn-group btn-group--left">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          {failedFiles > 0 && (
            <button className="btn" onClick={onReprocessErrored}>
              Reprocess Errored
            </button>
          )}
          <button className="btn" onClick={onReprocessAll}>
            Reprocess All
          </button>
        </div>
      </div>
    </Modal>
  );
}
