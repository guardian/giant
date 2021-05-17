import { Collection } from '../../types/Collection';
import { TreeEntry, isTreeNode } from '../../types/Tree';
import { WorkspaceEntry, Workspace } from '../../types/Workspaces';
import { createNewIngestion } from '../../services/CollectionsApi';

export type WorkspaceTarget = {
    id: string,
    ingestion: string,
    workspace: Workspace,
    workspaceEntry: TreeEntry<WorkspaceEntry>
}

// Defaults are a property of ingestions rather than collections. A default collection
// which backs up all the workspaces will have a default ingestion and possibly ingestions
// which do not have a default flag. This is a hangover from an age when we uploaded all files
// to the same collections. The default flag does not make much sense anymore and we might want to
// rethink this in the future.
function getDefaultCollection(username: string, collections: Collection[]): Collection | undefined {
    return collections.find(collection => {
        return collection.ingestions.some(ingestion => ingestion.default) && collection.createdBy === username;
    });
}

async function createUploadIngestion(collection: Collection): Promise<string> {
    const ingestionName = `${new Date().toISOString()}`;
    const newIngestion = await createNewIngestion(collection.uri, `Upload ${ingestionName}`);
    return newIngestion.uri;
}

export async function getUploadTarget(
    username: string,
    workspace: Workspace,
    collections: Collection[],
    focusedEntry: TreeEntry<WorkspaceEntry> | null,
): Promise<WorkspaceTarget> {

    const defaultCollection = getDefaultCollection(username, collections);
    if (!defaultCollection) {
        throw new Error(`No default collection for user ${username} amongst collections ${collections.map(c => c.uri).join(',')}, cannot upload to workspace`);
    }

    const workspaceEntry = (focusedEntry && isTreeNode(focusedEntry)) ? focusedEntry : workspace.rootNode;
    if (!workspaceEntry) {
        throw new Error(`No workspace entry in either focused entry ${focusedEntry} or root of workspace ${workspace.id}, cannot upload to workspace`);
    }

    const ingestionUri = await createUploadIngestion(defaultCollection);

    return {
        id: `${workspace.id}-${ingestionUri}`,
        ingestion: ingestionUri,
        workspace,
        workspaceEntry
    }
}

