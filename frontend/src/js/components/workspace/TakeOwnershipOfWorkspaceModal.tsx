import React, { useState } from "react";
import Modal from "../UtilComponents/Modal";
import MdSupervisorAccount from "react-icons/lib/md/supervisor-account";
import { Workspace } from "../../types/Workspaces";
import { PartialUser } from "../../types/User";
import { takeOwnershipOfWorkspace } from "../../actions/workspaces/takeOwnershipOfWorkspace";

type Props = {
  workspace: Workspace;
  isAdmin: Boolean;
  currentUser: PartialUser;
  takeOwnershipOfWorkspace: typeof takeOwnershipOfWorkspace;
};

export default function TakeOwnershipOfWorkspaceModal(props: Props) {
  const [open, setOpen] = useState(false);

  function onSubmit(e?: React.FormEvent) {
    if (e) {
      e.preventDefault();
    }

    if (props.isAdmin) {
      props.takeOwnershipOfWorkspace(
        props.workspace.id,
        props.currentUser.username,
      );
    }
    onDismiss();
  }

  function onDismiss() {
    setOpen(false);
  }

  if (props.currentUser.username === props.workspace.owner.username)
    return null;
  if (!props.isAdmin) return null;

  return (
    <React.Fragment>
      {/* The component that triggers the modal (pass-through rendering of children) */}
      <button
        className="btn workspace__button"
        onClick={() => setOpen(true)}
        title="Take ownership"
      >
        <MdSupervisorAccount /> Take Ownership
      </button>

      <Modal
        isOpen={open}
        dismiss={onDismiss}
        panelClassName="modal-action__panel"
      >
        <form onSubmit={onSubmit}>
          <div className="modal-action__modal">
            <h2>Take over workspace {props.workspace.name}</h2>
            <div className="modal-action__buttons">
              <button className="btn" onClick={onSubmit} autoFocus={false}>
                Take Ownership
              </button>
              <button className="btn" onClick={onDismiss}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </React.Fragment>
  );
}
