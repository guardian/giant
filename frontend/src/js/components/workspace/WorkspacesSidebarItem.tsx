import React, { FC, useState } from "react";
import SidebarSearchLink from "../UtilComponents/SidebarSearchLink";
import { moveItems } from "../../actions/workspaces/moveItem";
import { GiantState } from "../../types/redux/GiantState";
import { bindActionCreators } from "redux";
import { GiantDispatch } from "../../types/redux/GiantDispatch";
import { connect } from "react-redux";
import { getIdsOfEntriesToMove } from "../../util/treeUtils";
import { copyItems } from "../../actions/workspaces/copyItem";
import Modal from "../UtilComponents/Modal";
import { CopyOrMoveModal } from "./CopyOrMoveModal";

interface PropsFromParent {
  selectedWorkspaceId: string;
  linkedToWorkspaceId: string;
  linkedToWorkspaceName: string;
}

type PropTypes = ReturnType<typeof mapDispatchToProps> &
  ReturnType<typeof mapStateToProps> &
  PropsFromParent;

const WorkspacesSidebarItem: FC<PropTypes> = ({
  selectedEntries,
  moveItems,
  copyItems,
  selectedWorkspaceId,
  linkedToWorkspaceId,
  linkedToWorkspaceName,
}) => {
  const [copyOrMoveModalOpen, setCopyOrMoveModalOpen] =
    useState<boolean>(false);
  const [entryIds, setEntryIds] = useState<string[]>([]);
  const [invalidDestinationModalOpen, setInvalidDestinationModalOpen] =
    useState<boolean>(false);
  return (
    <>
      <SidebarSearchLink
        onDrop={(e: React.DragEvent) => {
          if (linkedToWorkspaceId === selectedWorkspaceId) {
            setInvalidDestinationModalOpen(true);
            return;
          }
          const json = e.dataTransfer.getData("application/json");
          const { id: idOfDraggedEntry } = JSON.parse(json);
          const entryIds = getIdsOfEntriesToMove(
            selectedEntries,
            idOfDraggedEntry,
          );
          setEntryIds(entryIds);
          // Ask user whether they want to move or copy or move the files
          setCopyOrMoveModalOpen(true);
        }}
        key={linkedToWorkspaceId}
        to={`/workspaces/${linkedToWorkspaceId}`}
      >
        <div className="sidebar__item__text">{linkedToWorkspaceName}</div>
      </SidebarSearchLink>
      <Modal
        isOpen={invalidDestinationModalOpen}
        dismiss={() => setInvalidDestinationModalOpen(false)}
      >
        <form className="form">
          Sorry, you cannot copy or move items to a workspace they are already
          in
        </form>
      </Modal>
      <Modal
        isOpen={copyOrMoveModalOpen}
        dismiss={() => setCopyOrMoveModalOpen(false)}
      >
        <CopyOrMoveModal
          destinationWorkspaceName={linkedToWorkspaceName}
          onSubmit={(action: "copy" | "move") => {
            const actionFn = action === "copy" ? copyItems : moveItems;
            actionFn(selectedWorkspaceId, entryIds, linkedToWorkspaceId);
            setCopyOrMoveModalOpen(false);
          }}
        />
      </Modal>
    </>
  );
};

function mapStateToProps(state: GiantState) {
  return {
    selectedEntries: state.workspaces.selectedEntries,
  };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    moveItems: bindActionCreators(moveItems, dispatch),
    copyItems: bindActionCreators(copyItems, dispatch),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(WorkspacesSidebarItem);
