import React from 'react';
import { WorkspaceMetadata, WorkspaceEntry, Workspace } from '../../types/Workspaces';
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
import TakeOwnershipOfWorkspaceModal from "./TakeOwnershipOfWorkspaceModal";
import {takeOwnershipOfWorkspace} from "../../actions/workspaces/takeOwnershipOfWorkspace";

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
    isAdmin
}: Props) {

    const workspaceUsers = workspace.followers.filter(follower =>
        follower.username !== currentUser.username
        && follower.username !== workspace.owner.username
    )

    return <div className='page-title workspace__header'>
        <h1 className='workspace__title'>{workspace.name}</h1>
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
    </div>;
}
