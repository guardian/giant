import React, { useState } from "react";
import {
  WorkspaceMetadata,
  WorkspaceEntry,
  Workspace,
  isWorkspaceNode,
} from "../../types/Workspaces";
import ModalAction from "../UtilComponents/ModalAction";
import { Divider, Icon, Label, Menu, Popup } from "semantic-ui-react";
import { PartialUser } from "../../types/User";
import { setWorkspaceFollowers } from "../../actions/workspaces/setWorkspaceFollowers";
import { setWorkspaceIsPublic } from "../../actions/workspaces/setWorkspaceIsPublic";
import { renameWorkspace } from "../../actions/workspaces/renameWorkspace";
import { deleteWorkspace } from "../../actions/workspaces/deleteWorkspace";
import UploadFiles, { DroppedFilesInfo } from "../Uploads/UploadFiles";
import { Collection } from "../../types/Collection";
import { TreeEntry, TreeNode } from "../../types/Tree";
import { getWorkspace } from "../../actions/workspaces/getWorkspace";
import ShareWorkspaceModal from "./ShareWorkspaceModal";
import MdEdit from "react-icons/lib/md/edit";
import MdDelete from "react-icons/lib/md/delete";
import SearchIcon from "react-icons/lib/md/search";
import MdFileDownload from "react-icons/lib/md/file-download";
import TakeOwnershipOfWorkspaceModal from "./TakeOwnershipOfWorkspaceModal";
import { takeOwnershipOfWorkspace } from "../../actions/workspaces/takeOwnershipOfWorkspace";
import { CaptureFromUrl } from "../Uploads/CaptureFromUrl";
import { EuiText } from "@elastic/eui";
import { exportWorkspaceInventory } from "../../services/WorkspaceApi";
import { FileAndFolderCounts } from "../UtilComponents/TreeBrowser/FileAndFolderCounts";
import buildLink from "../../util/buildLink";
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
  /** Files dropped from the file system (via drag-and-drop) */
  droppedFiles?: DroppedFilesInfo;
  /** Callback to clear the dropped files after they've been consumed */
  onClearDroppedFiles?: () => void;
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
  droppedFiles,
  onClearDroppedFiles,
}: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  const closeMenu = () => setIsMenuOpen(false);

  const isOwner = currentUser.username === workspace.owner.username;
  const canDelete = isOwner || (isAdmin && workspace.isPublic);

  const menuButton = (
    <button className="btn workspace__button" aria-label="Workspace actions">
      <Icon name="bars" />
    </button>
  );

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
        {workspace.owner.username !== workspace.creator.username && (
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
            q: JSON.stringify([
              "",
              {
                n: "Workspace",
                v: workspace.id,
                op: "+",
                t: "workspace",
              },
              "",
            ]),
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
        droppedFiles={droppedFiles}
        onClearDroppedFiles={onClearDroppedFiles}
      />
      <CaptureFromUrl maybePreSelectedWorkspace={workspace} withButton />
      <Popup
        trigger={menuButton}
        open={isMenuOpen}
        onOpen={() => setIsMenuOpen(true)}
        onClose={closeMenu}
        on="click"
        position="bottom right"
        basic
        style={{ padding: 0 }}
      >
        <Menu vertical compact style={{ minWidth: 200 }}>
          {/* Sharing & ownership */}
          <ShareWorkspaceModal
            workspace={workspace}
            workspaceUsers={workspaceUsers}
            allUsers={users}
            currentUser={currentUser}
            setWorkspaceFollowers={setWorkspaceFollowers}
            setWorkspaceIsPublic={setWorkspaceIsPublic}
          />
          <TakeOwnershipOfWorkspaceModal
            workspace={workspace}
            isAdmin={isAdmin}
            currentUser={currentUser}
            takeOwnershipOfWorkspace={takeOwnershipOfWorkspace}
          />

          <Divider fitted style={{ margin: 0 }} />

          {/* Edit actions */}
          <ModalAction
            actionType="edit"
            className="item workspace-menu__item"
            actionDescription="Rename"
            title={`Rename workspace '${workspace.name}'`}
            value={workspace.name}
            onConfirm={(newName) => renameWorkspace(workspace.id, newName)}
            disabled={!isOwner}
          >
            <MdEdit />
            Rename Workspace
          </ModalAction>
          <ModalAction
            actionType="confirm"
            className="item workspace-menu__item workspace-menu__item--danger"
            actionDescription="Delete"
            title={`Delete workspace '${workspace.name}'?`}
            onConfirm={() => deleteWorkspace(workspace.id)}
            disabled={!canDelete}
          >
            <MdDelete />
            Delete Workspace
          </ModalAction>

          {isAdmin && (
            <>
              <Divider fitted style={{ margin: 0 }} />

              {/* Admin export actions */}
              <Menu.Item
                className="workspace-menu__item"
                onClick={() => {
                  exportWorkspaceInventory(workspace.id, "json");
                  closeMenu();
                }}
              >
                <MdFileDownload />
                Export Inventory as JSON
              </Menu.Item>
              <Menu.Item
                className="workspace-menu__item"
                onClick={() => {
                  exportWorkspaceInventory(workspace.id, "csv");
                  closeMenu();
                }}
              >
                <MdFileDownload />
                Export Inventory as CSV
              </Menu.Item>
            </>
          )}
        </Menu>
      </Popup>
    </div>
  );
}
