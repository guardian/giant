import { TreeEntry, TreeNode } from './Tree';
import { PartialUser } from './User';
import { ProcessingStage } from './Resource';


export interface BaseWorkspaceEntry {
    addedBy: PartialUser,
    addedOn?: number,
    maybeParentId?: string
}

export interface WorkspaceNode extends BaseWorkspaceEntry {
    descendantsLeafCount:number;
    descendantsNodeCount:number;
    descendantsProcessingTaskCount:number;
    descendantsFailedCount:number;
}

export interface WorkspaceLeaf extends BaseWorkspaceEntry {
    processingStage: ProcessingStage,
    uri: string,
    mimeType: string,
    size?: number,
}

export type WorkspaceEntry = WorkspaceNode | WorkspaceLeaf


export function isWorkspaceLeaf(workspaceEntry: WorkspaceEntry): workspaceEntry is WorkspaceLeaf {
    return (workspaceEntry as WorkspaceLeaf).uri !== undefined;
}

export function isWorkspaceNode(workspaceEntry: WorkspaceEntry): workspaceEntry is WorkspaceNode {
    return !isWorkspaceLeaf(workspaceEntry);
}

export type WorkspaceMetadata = {
    id: string,
    name: string,
    isPublic: boolean,
    tagColor: string,
    owner: PartialUser,
    creator: PartialUser,
    followers: PartialUser[],
}

export type WorkspaceContents = {
    rootNode: TreeNode<WorkspaceEntry>
}

export type Workspace = WorkspaceMetadata & WorkspaceContents

export type FocusedWorkspace = {
    workspace: WorkspaceMetadata,
    entry?: TreeEntry<WorkspaceEntry>
}
