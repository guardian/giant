import Modal from "../UtilComponents/Modal";
import { Workspace } from "../../types/Workspaces";
import { PartialUser } from "../../types/User";
import { takeOwnershipOfWorkspace } from "../../actions/workspaces/takeOwnershipOfWorkspace";

type Props = {
  workspace: Workspace;
  isAdmin: Boolean;
  currentUser: PartialUser;
  takeOwnershipOfWorkspace: typeof takeOwnershipOfWorkspace;
  isOpen: boolean;
  onClose: () => void;
};

export default function TakeOwnershipOfWorkspaceModal(props: Props) {
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
    props.onClose();
  }

  if (props.currentUser.username === props.workspace.owner.username)
    return null;
  if (!props.isAdmin) return null;

  return (
    <Modal
      isOpen={props.isOpen}
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
  );
}
