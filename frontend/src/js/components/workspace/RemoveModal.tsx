import React from "react";
import { GiantState } from "../../types/redux/GiantState";
import { connect } from "react-redux";
import Modal from "../UtilComponents/Modal";
import { ProgressAnimation } from "../UtilComponents/ProgressAnimation";

export type RemoveStatus = "unconfirmed" | "removing" | "removed" | "failed";

export function RemoveModal({
  removeItemHandler,
  isOpen,
  setModalOpen,
  removeStatus,
  entryName,
  isParent,
}: {
  removeItemHandler: () => void;
  isOpen: boolean;
  setModalOpen: (value: boolean) => void;
  removeStatus: RemoveStatus;
  entryName: string | undefined;
  isParent: boolean;
}) {
  const modalTitle: Record<RemoveStatus, string> = {
    unconfirmed: "Remove item?",
    removing: "Removing item",
    removed: "Item removed",
    failed: "Failed to remove",
  };

  const parentText = isParent ? " and everything nested inside it" : "";

  const modalMessage: Record<RemoveStatus, string> = {
    unconfirmed: `This will remove the file ${entryName || ""} ${parentText} from the current workspace. It cannot be undone. Are you sure you want to proceed?`,
    removing: "",
    removed: "This item has been successfully removed from the workspace.",
    failed:
      "Failed to remove item. Please contact the administrator to delete this item.",
  };

  const removeItem = () => {
    try {
      removeItemHandler();
    } catch (e) {
      console.error("Error removing item", e);
    }
  };

  const onDismiss = () => {
    setModalOpen(false);
  };

  const spinner = removeStatus === "removing" ? <ProgressAnimation /> : false;

  return (
    <React.Fragment>
      <Modal isOpen={isOpen} isDismissable={true} dismiss={onDismiss}>
        <div className="form form-full-width">
          <h2 className="modal__title">{modalTitle[removeStatus]}</h2>
          <div className="form__row">{modalMessage[removeStatus]}</div>
          <div className="form__row btn-group btn-group--left">
            {removeStatus === "unconfirmed" && (
              <>
                <button className="btn" onClick={onDismiss}>
                  Cancel
                </button>
                <button className="btn" onClick={removeItem}>
                  Remove
                </button>
              </>
            )}
            {removeStatus === "removed" && (
              <>
                <button
                  className="btn"
                  onClick={() => (document.location.href = "/")}
                >
                  Giant Home
                </button>
                <button className="btn" onClick={onDismiss}>
                  Close
                </button>
              </>
            )}
            {removeStatus === "failed" && (
              <button className="btn" onClick={onDismiss}>
                Cancel
              </button>
            )}
            {spinner}
          </div>
        </div>
      </Modal>
    </React.Fragment>
  );
}

function mapStateToProps(state: GiantState) {
  return {
    resource: state.resource,
  };
}

export default connect(mapStateToProps)(RemoveModal);
