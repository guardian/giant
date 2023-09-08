import React from 'react';
import { WorkspaceMetadata, WorkspaceEntry, Workspace } from '../../types/Workspaces';
import ModalAction from '../UtilComponents/ModalAction';
import { Label, Popup } from 'semantic-ui-react';
import {PartialUser, User} from '../../types/User';
import { setWorkspaceFollowers } from '../../actions/workspaces/setWorkspaceFollowers';
import { setWorkspaceIsPublic } from '../../actions/workspaces/setWorkspaceIsPublic';
import { renameWorkspace } from '../../actions/workspaces/renameWorkspace';
import { deleteWorkspace } from '../../actions/workspaces/deleteWorkspace';
import UploadFiles from '../Uploads/UploadFiles';
import { Collection } from '../../types/Collection';
import { TreeEntry, TreeNode } from '../../types/Tree';
import { getWorkspace } from '../../actions/workspaces/getWorkspace';
import ShareWorkspaceModal from './ShareWorkspaceModal';

type Props = {
    workspace: Workspace,
    currentUser: PartialUser,
    myPermissions: any,
    users: PartialUser[],
    setWorkspaceFollowers: typeof setWorkspaceFollowers,
    setWorkspaceIsPublic: typeof setWorkspaceIsPublic,
    renameWorkspace: typeof renameWorkspace,
    deleteWorkspace: typeof deleteWorkspace,
    collections: Collection[],
    getWorkspaceContents: typeof getWorkspace,
    focusedEntry: TreeEntry<WorkspaceEntry> | null,
    workspaces: WorkspaceMetadata[],
    expandedNodes: TreeNode<WorkspaceEntry>[]
}

export default function WorkspaceSummary({
    workspace,
    currentUser,
    myPermissions,
    users,
    setWorkspaceFollowers,
    setWorkspaceIsPublic,
    renameWorkspace,
    deleteWorkspace,
    collections,
    getWorkspaceContents,
    focusedEntry,
    workspaces,
    expandedNodes
}: Props) {

    const workspaceUsers = workspace.followers.filter(follower =>
        follower.username !== currentUser.username
        && follower.username !== workspace.owner.username
    )

    return <div className='page-title workspace__header'>
        <div>
            <h1 className='workspace__title'>{workspace.name}</h1>
            <span className='workspace__created-by'>
                <Label>Created by {workspace.owner.displayName}</Label>
                {workspaceUsers.length ?
                    <Popup content={workspaceUsers.map(u => u.displayName).join(', ')} trigger={
                        <Label>
                            Shared with {workspaceUsers.length} {workspaceUsers.length > 1 ? 'other people' : 'other person'}
                        </Label>
                    }/>
                    : false
                }
            </span>
        </div>
        <div>
            <UploadFiles
                username={currentUser.username}
                workspace={workspace}
                collections={collections}
                getResource={getWorkspaceContents}
                focusedWorkspaceEntry={focusedEntry}
                expandedNodes={expandedNodes}
            />
            <ShareWorkspaceModal
                workspace={workspace}
                workspaceUsers={workspaceUsers}
                allUsers={users}
                currentUser={currentUser}
                myPermissions={myPermissions}
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
                Rename Workspace
            </ModalAction>
            <ModalAction
                actionType="confirm"
                className='btn workspace__button'
                actionDescription='Delete'
                title={`Delete workspace '${workspace.name}'?`}
                onConfirm={() => deleteWorkspace(workspace.id)}
                disabled={currentUser.username !== workspace.owner.username}
            >
                Delete Workspace
            </ModalAction>
        </div>
    </div>;
}
