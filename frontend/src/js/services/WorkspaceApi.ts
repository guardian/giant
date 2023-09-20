import authFetch from '../util/auth/authFetch';
import { WorkspaceMetadata } from '../types/Workspaces';

export function createWorkspace(name: string, isPublic: boolean, tagColor: string) {
    return authFetch('/api/workspaces', {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'POST',
        body: JSON.stringify({name, isPublic, tagColor})
    }).then(res => res.text());
}

export function updateWorkspaceFollowers(id: string, followers: string[]) {
    return authFetch(`/api/workspaces/${id}/followers`, {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'PUT',
        body: JSON.stringify({ followers })
    });
}

export function updateWorkspaceIsPublic(id: string, isPublic: boolean) {
    return authFetch(`/api/workspaces/${id}/isPublic`, {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'PUT',
        body: JSON.stringify({ isPublic })
    });
}

export function updateWorkspaceName(id: string, name: string) {
    return authFetch(`/api/workspaces/${id}/name`, {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'PUT',
        body: JSON.stringify({ name })
    });
}

export function deleteWorkspace(id: string) {
    return authFetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
    });
}

export function getWorkspacesMetadata(): Promise<WorkspaceMetadata[]> {
    return authFetch('/api/workspaces').then(res => res.json());
}

export function getWorkspace(id: string) {
    return authFetch(`/api/workspaces/${id}`).then(res => res.json());
}

export function moveItem(workspaceId: string, itemId: string, newWorkspaceId?: string, newParentId?: string) {
    return authFetch(`/api/workspaces/${workspaceId}/nodes/${itemId}/parent`, {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'PUT',
        body: JSON.stringify({
            newWorkspaceId: newWorkspaceId,
            newParentId: newParentId
        })
    });
}

export function renameItem(workspaceId: string, itemId: string, newName: string) {
    return authFetch(`/api/workspaces/${workspaceId}/nodes/${itemId}/name`, {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'PUT',
        body: JSON.stringify({
            name: newName
        })
    });
}

export function deleteItem(workspaceId: string, itemId: string) {
    return authFetch(`/api/workspaces/${workspaceId}/nodes/${itemId}`, {
        method: 'DELETE',
    });
}

export function deleteOrRemoveItem(workspaceId: string, blobUri: string) {
    return authFetch(`/api/workspaces/${workspaceId}/nodes/delete/${blobUri}`, {
        method: 'POST',
    });
}

export function addFolderToWorkspace(workspaceId: string, parentId: string, name:  string) {
    return addItemToWorkspace(workspaceId, parentId, name, undefined, 'folder', {});
}

export type AddItemParameters = {
    uri?: string,
    size?: number,
    mimeType?: string,
}

export function addResourceToWorkspace(
    workspaceId: string,
    parentId: string,
    name: string,
    icon: string | undefined,
    parameters: AddItemParameters
) {
    return addItemToWorkspace(workspaceId, parentId, name, icon, 'file', parameters);
}

// Private function for add folder and add file to call into
function addItemToWorkspace(
    workspaceId: string,
    parentId: string,
    name: string,
    icon: string | undefined,
    type: string,
    parameters: AddItemParameters
) {
    const url = `/api/workspaces/${workspaceId}/nodes`;

    return authFetch(url, {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'POST',
        body: JSON.stringify({
            name: name,
            parentId: parentId,
            type: type,
            icon: icon,
            parameters: parameters
        })
    }).then(res => res.json());
}
