import React, { useState } from "react";
import {
  WorkspaceMetadata,
  WorkspaceEntry,
  Workspace,
  isWorkspaceNode,
} from "../../types/Workspaces";
import ModalAction from "../UtilComponents/ModalAction";
import { Dropdown, Icon, Label, Popup } from "semantic-ui-react";
import { PartialUser } from "../../types/User";
import { setWorkspaceFollowers } from "../../actions/workspaces/setWorkspaceFollowers";
import { setWorkspaceIsPublic } from "../../actions/workspaces/setWorkspaceIsPublic";
import { renameWorkspace } from "../../actions/workspaces/renameWorkspace";
import { deleteWorkspace } from "../../actions/workspaces/deleteWorkspace";
import UploadFiles from "../Uploads/UploadFiles";
import { Collection } from "../../types/Collection";
import { TreeEntry, TreeNode } from "../../types/Tree";
import { getWorkspace } from "../../actions/workspaces/getWorkspace";
import ShareWorkspaceModal from "./ShareWorkspaceModal";
import SearchIcon from "react-icons/lib/md/search";
import TakeOwnershipOfWorkspaceModal from "./TakeOwnershipOfWorkspaceModal";
import { takeOwnershipOfWorkspace } from "../../actions/workspaces/takeOwnershipOfWorkspace";
import { CaptureFromUrl } from "../Uploads/CaptureFromUrl";
import { EuiText } from "@elastic/eui";
import { FileAndFolderCounts } from "../UtilComponents/TreeBrowser/FileAndFolderCounts";
import buildLink from "../../util/buildLink";
import { buildWorkspaceSearchQ } from "../Search/chipParsing";
import history from "../../util/history";
import { workspaceEntryPath } from "../../util/workspaceUtils";

type Props = {
  workspace: Workspace;
  currentUser: PartialUser;
  users: PartialUser[];
  setWorkspaceFollowers: typeof setWorkspaceFollowers;
  setWorkspaceIsPublic: typeof setWorkspaceIsPublic;
  renameWorkspace: typeof renameWorkspace;
  deleteWorkspace: typeof deleteWorkspace;
  takeOwnershipOfWorkspace: typeof takeOwnershipOfWorkspace;
  collections: Collection[];
  getWorkspaceContents: typeof getWorkspace;
  focusedEntry: TreeEntry<WorkspaceEntry> | null;
  workspaces: WorkspaceMetadata[];
  expandedNodes: TreeNode<WorkspaceEntry>[];
  isAdmin: boolean;
  clearFocus: () => void;
};

export default function WorkspaceSummary({
  workspace,
  currentUser,
  users,
  setWorkspaceFollowers,
  setWorkspaceIsPublic,
  renameWorkspace,
  deleteWorkspace,
  takeOwnershipOfWorkspace,
  collections,
  getWorkspaceContents,
  focusedEntry,
  workspaces,
  expandedNodes,
  isAdmin,
  clearFocus,
}: Props) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [takeOwnershipModalOpen, setTakeOwnershipModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const isOwner = currentUser.username === workspace.owner.username;
  const canDelete = isOwner || (isAdmin && workspace.isPublic);

  const workspaceUsers = workspace.followers.filter(
    (follower) =>
      follower.username !== currentUser.username &&
      follower.username !== workspace.owner.username,
  );

  const maybeRootNodeData =
    isWorkspaceNode(workspace.rootNode.data) && workspace.rootNode.data;

  const handleTitleClick = () => {
    clearFocus();
    history.push(workspaceEntryPath(workspace.id));
  };

  return (
    <div className="page-title workspace__header shrinkable-buttons">
      <h1
        className="workspace__title"
        onClick={handleTitleClick}
        style={{ cursor: "pointer" }}
      >
        {workspace.name}
        {maybeRootNodeData && (
          <>
            <br />
            <EuiText size="s">
              <FileAndFolderCounts
                descendantsNodeCount={maybeRootNodeData.descendantsNodeCount}
                descendantsLeafCount={maybeRootNodeData.descendantsLeafCount}
              />
            </EuiText>
          </>
        )}
      </h1>
      <div className="workspace__badges">
        {workspace.creator.username !== workspace.owner.username && (
          <Label>Created&nbsp;by {workspace.creator.displayName}</Label>
        )}
        <Label>Owned&nbsp;by {workspace.owner.displayName}</Label>
        {workspaceUsers.length ? (
          <Popup
            content={workspaceUsers.map((u) => u.displayName).join(", ")}
            trigger={
              <Label>
                Shared&nbsp;with {workspaceUsers.length}&nbsp;other&nbsp;
                {workspaceUsers.length > 1 ? "people" : "person"}
              </Label>
            }
          />
        ) : (
          false
        )}
      </div>
      <div style={{ flexGrow: 1 }}></div>
      <button
        className="btn"
        onClick={() => {
          const searchUrl = buildLink("/search", {
            q: buildWorkspaceSearchQ(workspace.id),
            page: 1,
          });
          window.open(searchUrl, "_blank", "noopener");
        }}
        title="Search workspace"
        aria-label={`Search workspace ${workspace.name}`}
      >
        <SearchIcon style={{ marginRight: "3px", marginBottom: "1px" }} />
        Search workspace
      </button>
      <UploadFiles
        username={currentUser.username}
        workspace={workspace}
        collections={collections}
        getResource={getWorkspaceContents}
        focusedWorkspaceEntry={focusedEntry}
        expandedNodes={expandedNodes}
        isAdmin={isAdmin}
      />
      <CaptureFromUrl maybePreSelectedWorkspace={workspace} withButton />
      <Dropdown
        icon={null}
        trigger={
          <Icon name="bars" size="large" style={{ cursor: "pointer" }} />
        }
        direction="left"
        pointing="top right"
      >
        <Dropdown.Menu>
          {isAdmin && !isOwner && (
            <Dropdown.Item
              icon="user plus"
              text="Take Ownership"
              onClick={() => setTakeOwnershipModalOpen(true)}
            />
          )}
          <Dropdown.Item
            icon="share alternate"
            text="Share Workspace"
            disabled={!isOwner}
            onClick={() => setShareModalOpen(true)}
          />
          <Dropdown.Item
            icon="edit"
            text="Rename Workspace"
            disabled={!isOwner}
            onClick={() => setRenameModalOpen(true)}
          />
          <Dropdown.Item
            icon="trash"
            text="Delete Workspace"
            disabled={!canDelete}
            onClick={() => setDeleteModalOpen(true)}
          />
        </Dropdown.Menu>
      </Dropdown>
      <TakeOwnershipOfWorkspaceModal
        workspace={workspace}
        isAdmin={isAdmin}
        currentUser={currentUser}
        takeOwnershipOfWorkspace={takeOwnershipOfWorkspace}
        isOpen={takeOwnershipModalOpen}
        onClose={() => setTakeOwnershipModalOpen(false)}
      />
      <ShareWorkspaceModal
        workspace={workspace}
        workspaceUsers={workspaceUsers}
        allUsers={users}
        currentUser={currentUser}
        setWorkspaceFollowers={setWorkspaceFollowers}
        setWorkspaceIsPublic={setWorkspaceIsPublic}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
      <ModalAction
        actionType="edit"
        actionDescription="Rename"
        title={`Rename workspace '${workspace.name}'`}
        value={workspace.name}
        onConfirm={(newName) => renameWorkspace(workspace.id, newName)}
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
      />
      <ModalAction
        actionType="confirm"
        actionDescription="Delete"
        title={`Delete workspace '${workspace.name}'?`}
        onConfirm={() => deleteWorkspace(workspace.id)}
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}
