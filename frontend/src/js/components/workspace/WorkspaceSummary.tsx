import React, {useState} from 'react';
import {WorkspaceMetadata, WorkspaceEntry, Workspace, isWorkspaceNode} from '../../types/Workspaces';
import ModalAction from '../UtilComponents/ModalAction';
import { Label, Popup } from 'semantic-ui-react';
import { PartialUser } from '../../types/User';
import { setWorkspaceFollowers } from '../../actions/workspaces/setWorkspaceFollowers';
import { setWorkspaceIsPublic } from '../../actions/workspaces/setWorkspaceIsPublic';
import { renameWorkspace } from '../../actions/workspaces/renameWorkspace';
import { deleteWorkspace } from '../../actions/workspaces/deleteWorkspace';
import UploadFiles from '../Uploads/UploadFiles';
import { Collection } from '../../types/Collection';
import { TreeEntry, TreeNode } from '../../types/Tree';
import { getWorkspace } from '../../actions/workspaces/getWorkspace';
import ShareWorkspaceModal from './ShareWorkspaceModal';
import MdEdit from "react-icons/lib/md/edit";
import MdDelete from "react-icons/lib/md/delete";
import MdMore from "react-icons/lib/md/expand-more";
import TakeOwnershipOfWorkspaceModal from "./TakeOwnershipOfWorkspaceModal";
import {takeOwnershipOfWorkspace} from "../../actions/workspaces/takeOwnershipOfWorkspace";
import {CaptureFromUrl} from "../Uploads/CaptureFromUrl";
import {EuiText} from "@elastic/eui";
import {FileAndFolderCounts} from "../UtilComponents/TreeBrowser/FileAndFolderCounts";
import history from '../../util/history';

type Props = {
    workspace: Workspace,
    currentUser: PartialUser,
    users: PartialUser[],
    setWorkspaceFollowers: typeof setWorkspaceFollowers,
    setWorkspaceIsPublic: typeof setWorkspaceIsPublic,
    renameWorkspace: typeof renameWorkspace,
    deleteWorkspace: typeof deleteWorkspace,
    takeOwnershipOfWorkspace: typeof takeOwnershipOfWorkspace,
    collections: Collection[],
    getWorkspaceContents: typeof getWorkspace,
    focusedEntry: TreeEntry<WorkspaceEntry> | null,
    workspaces: WorkspaceMetadata[],
    expandedNodes: TreeNode<WorkspaceEntry>[],
    isAdmin: boolean,
    clearFocus: () => void
}

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
    clearFocus
}: Props) {

    const [isShowingMoreOptions, setIsShowingMoreOptions] = useState(false);

    const workspaceUsers = workspace.followers.filter(follower =>
        follower.username !== currentUser.username
        && follower.username !== workspace.owner.username
    )

    const maybeRootNodeData = isWorkspaceNode(workspace.rootNode.data) && workspace.rootNode.data;

    const handleTitleClick = () => {
        clearFocus();
        history.push(`/workspaces/${workspace.id}`);
    };

    return <div className='page-title workspace__header shrinkable-buttons'>
        <h1 className='workspace__title' onClick={handleTitleClick} style={{ cursor: "pointer" }}>
            {workspace.name}{maybeRootNodeData && <>
              <br/>
              <EuiText size="s"><FileAndFolderCounts
                descendantsNodeCount={maybeRootNodeData.descendantsNodeCount}
                descendantsLeafCount={maybeRootNodeData.descendantsLeafCount}
              /></EuiText>
            </>}
        </h1>
        <div className='workspace__badges'>
            {workspace.owner.username !== workspace.creator.username && (<Label>Created&nbsp;by {workspace.creator.displayName}</Label>)}
            <Label>Owned&nbsp;by {workspace.owner.displayName}</Label>
            {workspaceUsers.length ?
                <Popup content={workspaceUsers.map(u => u.displayName).join(', ')} trigger={
                    <Label>
                        Shared&nbsp;with {workspaceUsers.length}&nbsp;other&nbsp;{workspaceUsers.length > 1 ? 'people' : 'person'}
                    </Label>
                }/>
                : false
            }
        </div>
        <div style={{flexGrow: 1}}></div>
        <UploadFiles
          username={currentUser.username}
          workspace={workspace}
          collections={collections}
          getResource={getWorkspaceContents}
          focusedWorkspaceEntry={focusedEntry}
          expandedNodes={expandedNodes}
        />
        <CaptureFromUrl maybePreSelectedWorkspace={workspace} withButton />
        <div>
            <button className="btn workspace__button" onClick={() => setIsShowingMoreOptions(prev => {
                if(!prev){
                    document.addEventListener("click", () => {
                        setIsShowingMoreOptions(false);
                    }, {once: true});
                }
                return !prev;
            })}>
                <MdMore />
            </button>
            <div
              className={`workspace__header ${isShowingMoreOptions ? "" : "hide-direct-child-buttons"}`}
              style={{
                position: 'absolute',
                alignItems: "flex-end"
,               flexDirection: 'column',
                gap: "5px",
                padding: "12px",
                right: 0,
                zIndex: 9999,
            }}>
                <TakeOwnershipOfWorkspaceModal
                  workspace={workspace}
                  isAdmin={isAdmin}
                  currentUser={currentUser}
                  takeOwnershipOfWorkspace={takeOwnershipOfWorkspace}
                />
                    <ShareWorkspaceModal
                      workspace={workspace}
                      workspaceUsers={workspaceUsers}
                      allUsers={users}
                      currentUser={currentUser}
                      setWorkspaceFollowers={setWorkspaceFollowers}
                      setWorkspaceIsPublic={setWorkspaceIsPublic}
                    />
                    <ModalAction
                      actionType="edit"
                      className='btn workspace__button'
                      actionDescription='Rename'
                      title={`Rename workspace '${workspace.name}'`}
                      value={workspace.name}
                      onConfirm={(newName) => renameWorkspace(workspace.id, newName)}
                      disabled={currentUser.username !== workspace.owner.username}
                    >
                        <MdEdit />
                        Rename Workspace
                    </ModalAction>
                    <ModalAction
                      actionType="confirm"
                      className='btn workspace__button'
                      actionDescription='Delete'
                      title={`Delete workspace '${workspace.name}'?`}
                      onConfirm={() => deleteWorkspace(workspace.id)}
                      disabled={currentUser.username !== workspace.owner.username && !(isAdmin && workspace.isPublic)}
                    >
                        <MdDelete />
                        Delete Workspace
                    </ModalAction>
                </div>
        </div>
    </div>;
}
