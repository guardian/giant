import React, { useReducer, useState } from 'react';
import uuid from 'uuid/v4';
import MdFileUpload from 'react-icons/lib/md/file-upload';
import Modal from '../UtilComponents/Modal';
import FilePicker from './FilePicker';
import FileList from './FileList';
import { Button, Form, Progress } from 'semantic-ui-react';
import { getUploadTarget, WorkspaceTarget } from './UploadTarget';
import { setPreference } from '../../actions/preferences';
import { getCollection } from '../../actions/collections/getCollection';
import { uploadFileWithNewIngestion } from '../../services/CollectionsApi';
import history from '../../util/history';
import { displayRelativePath } from '../../util/workspaceUtils';
import { Collection } from '../../types/Collection';
import { addFolderToWorkspace } from '../../services/WorkspaceApi';
import sortBy from 'lodash/sortBy';
import filesize from 'filesize';
import { Workspace, WorkspaceEntry } from '../../types/Workspaces';
import { isTreeLeaf, isTreeNode, TreeEntry, TreeNode } from '../../types/Tree';
import { getWorkspace } from '../../actions/workspaces/getWorkspace';
import { useDispatch } from 'react-redux';
import { AppActionType } from '../../types/redux/GiantActions';

const MAX_FILE_UPLOAD_SIZE_MBYTES = 250 // should correspond to http.parser.maxDiskBuffer in application.conf
const MAX_FILE_UPLOAD_SIZE_BYTES = MAX_FILE_UPLOAD_SIZE_MBYTES*1024*1024


type InProgressFileUploadState = {
    description: 'uploading',
    loadedBytes?: number,
    totalBytes: number
};

type FailedFileUploadState = {
    description: 'failed',
    failureReason?: string
}

type FileUploadState =
    { description: 'pending' } |
    InProgressFileUploadState |
    { description: 'uploaded' } |
    FailedFileUploadState;

export function isFailedFileUploadState(uploadState: FileUploadState): uploadState is FailedFileUploadState {
    return uploadState.description === "failed"
}

export type WorkspaceUploadMetadata = {
    workspaceId: string,
    workspaceName: string,
    parentNodeId: string
}

export type UploadFile = { file: File, state: FileUploadState };

type Props = {
    username: string,
    workspace: Workspace,
    collections?: Collection[],
    getResource: typeof getCollection | typeof getWorkspace,
    focusedWorkspaceEntry: TreeEntry<WorkspaceEntry> | null,
    expandedNodes?: TreeNode<WorkspaceEntry>[]
}

type State = {
    // TODO MRB: explore whether this really needs to be a map compared to
    // an object or a straight-forward array of files
    files: Map<string, UploadFile>,
    target?: WorkspaceTarget
}

export type Action =
    { type: "Reset", state: State } |
    { type: "Set_Target", target: WorkspaceTarget } |
    { type: "Add_Files", files: Map<string, File> } |
    { type: "Remove_Path", path: string } |
    { type: "Set_Upload_State", file: string, state: FileUploadState };


function reducer(state: State, action: Action): State {
    switch(action.type) {
        case "Reset":
            return action.state;

        case "Set_Target":
            return { ...state, target: action.target };

        case "Add_Files": {
            for(const [path, file] of action.files) {
                state.files.set(path, { file, state: { description: 'pending' }});
            }

            // Create a new object to make React re-render
            return { ...state };
        }

        case "Remove_Path": {
            for(const [key] of state.files) {
                if(key.startsWith(action.path)) {
                    state.files.delete(key);
                }
            }

            // Create a new object to make React re-render
            return { ...state };
        }

        case "Set_Upload_State": {
            const existing = state.files.get(action.file);

            if(existing) {
                state.files.set(action.file, { ...existing, state: action.state });
            }

            // Create a new object to make React re-render
            return { ...state };
        }
    }
}

async function createIntermediateDirectories(workspaceId: string, workspaceParentId: string, directories: string[], mutableCache: Map<string, string>): Promise<string> {
    let parent = workspaceParentId;
    let parentName = "";

    for(const part of directories) {
        const partName = parentName === "" ? part : parentName + "/" + part;
        let idFromCache = mutableCache.get(partName);

        if(!idFromCache) {
            const { id } = (await addFolderToWorkspace(workspaceId, parent, part) as { id: string });
            mutableCache.set(partName, id);

            idFromCache = id;
        }

        parentName = partName;
        parent = idFromCache;
    }

    return parent;
}

async function buildWorkspaceUploadMetadata(path: string, target: WorkspaceTarget, mutableFolderCache: Map<string, string>): Promise<WorkspaceUploadMetadata> {
    const workspaceId = target.workspace.id;
    const parentId = target.workspaceEntry.id;

    const parts = path.split("/");
    const parentDirectoryNames = parts.slice(0, parts.length - 1);

    const parentNodeId = await createIntermediateDirectories(workspaceId, parentId, parentDirectoryNames, mutableFolderCache);

    return {
        workspaceId,
        workspaceName: target.workspace.name,
        parentNodeId
    };
}

async function uploadFiles(target: WorkspaceTarget, files: Map<string, UploadFile>, dispatch: React.Dispatch<Action>): Promise<void> {

    const uploadId = uuid();
    let workspaceFolderCache: Map<string, string> = new Map();

    async function nextFile(target: WorkspaceTarget, files: Array<[string, UploadFile]>) {
        const [path, { file }] = files[0];

        const state: FileUploadState = { description: 'uploading', totalBytes: file.size };
        dispatch({ type: 'Set_Upload_State', file: path, state });

        if (file.size > MAX_FILE_UPLOAD_SIZE_BYTES) {
            console.error(`Error uploading ${path}: file is too large (limit ${MAX_FILE_UPLOAD_SIZE_MBYTES}MB`)
            dispatch({ type: "Set_Upload_State", file: path, state: { description: 'failed', failureReason: `File too large (limit ${MAX_FILE_UPLOAD_SIZE_MBYTES}MB)` }});
        } else {
            try {
                function onProgress(loadedBytes: number, totalBytes: number) {
                    const state: FileUploadState = { description: 'uploading', loadedBytes, totalBytes };
                    dispatch({ type: 'Set_Upload_State', file: path, state });
                }

                const metadata = await buildWorkspaceUploadMetadata(path, target, workspaceFolderCache);
                await uploadFileWithNewIngestion(target.collectionUri, target.ingestionName, uploadId, file, path, metadata, onProgress);

                dispatch({ type: "Set_Upload_State", file: path, state: { description: 'uploaded' }});
            } catch(e) {
                console.error(`Error uploading ${path}: ${e}`);
                dispatch({ type: "Set_Upload_State", file: path, state: { description: 'failed' }});
            }
        }

        if(files.length > 1) {
            await nextFile(target, files.slice(1));
        }
    }

    const sortedFiles = sortBy(Array.from(files.entries()), ([key]) => key);
    await nextFile(target, sortedFiles);
}

function getCurrentlyUploading(state: State): { file: string, uploadState: InProgressFileUploadState } | undefined {
    for(const [, upload] of state.files) {
        if(upload.state.description === 'uploading') {
            return { file: upload.file.name, uploadState: upload.state }
        }
    }

    return undefined;
}

function FileUploadProgressBar({ file, uploadState: { loadedBytes, totalBytes } }: { file: string, uploadState: InProgressFileUploadState }) {
    if(loadedBytes && loadedBytes !== totalBytes) {
        return <Progress value={loadedBytes} total={totalBytes}>
            Uploading {file}: {`${filesize(loadedBytes)} of ${filesize(totalBytes)}`}
        </Progress>;
    } else {
        /* Indicate activity (via a nice sparkly animation) */
        return <Progress active value={1} total={1}>Processing {file}</Progress>;
    }
}

export default function UploadFiles(props: Props) {
    let target: WorkspaceTarget | undefined = undefined;

    const appDispatch = useDispatch();
    const [state, dispatch] = useReducer(reducer, { files: new Map() });

    const currentUpload = getCurrentlyUploading(state);
    const isUploading = currentUpload !== undefined;

    const completeCount = [...state.files.values()].filter(({ state }) => state.description === 'uploaded').length;
    const isComplete = [...state.files.values()].some(({ state }) => state.description === 'uploaded');

    const isEditDisabled = isUploading || isComplete;

    function dismissAndResetModal() {
        setOpen(false);
        dispatch({ type: "Reset", state: { files: new Map(), target: undefined } });
    }

    const [open, setOpen] = useState(false);
    const [focusedWorkspaceFolder, setFocusedWorkspaceFolder] = useState<TreeNode<WorkspaceEntry> | null>(null);

    async function onSubmit() {

        const { username, workspace, collections, getResource } = props;
        if (!collections) {
            throw new Error('No collections when submitting upload dialog');
        }

        try {
            target = await getUploadTarget(username, workspace, collections, focusedWorkspaceFolder);

            if (isComplete) {
                dismissAndResetModal();
                history.push(`/workspaces/${target.workspace.id}`);
            } else {
                await uploadFiles(target, state.files, dispatch).then(() => {
                    getResource(workspace.id);
                });
            }
        } catch(error) {
            appDispatch({
                type: AppActionType.APP_SHOW_ERROR,
                message: `Error uploading files ${error}`,
                error: error,
            });
        }
    }

    function onDismiss() {
        setOpen(false);

        setFocusedWorkspaceFolder(null);
        dispatch({ type: "Reset", state: { files: new Map(), target: undefined } });
    }

    function onClick() {
        setOpen(true);
        if (props.focusedWorkspaceEntry) {
            const { focusedWorkspaceEntry } = props;

            // Set the folder we are focused on. If we are focused on a leaf, then
            // the focused leaf is the parent of that folder.
            if (isTreeNode(focusedWorkspaceEntry)) {
                setFocusedWorkspaceFolder(focusedWorkspaceEntry);
            }
            else if (isTreeLeaf(focusedWorkspaceEntry)) {
                const rootNodeId = props.workspace.rootNode.id;
                const parentId = focusedWorkspaceEntry.data.maybeParentId;

                if (parentId && parentId !== rootNodeId) {
                    const focusedUploadFolder = props.expandedNodes && props.expandedNodes.find(node => node.id === parentId);
                    if (focusedUploadFolder) {
                        setFocusedWorkspaceFolder(focusedUploadFolder);
                    }
                }
            }
        }
    }

    const focusedWorkspaceRelativePath = (focusedWorkspaceFolder && props.workspace.rootNode)
        ? displayRelativePath(props.workspace.rootNode, focusedWorkspaceFolder.id)
        : null;

    return (
        <React.Fragment>
            <button
                className='btn file-upload__button'
                onClick={onClick}
            >
              <MdFileUpload className='file-upload__icon'/>
              Upload to workspace
            </button>
            <Modal isOpen={open} dismiss={onDismiss} isDismissable={!isUploading}>
                <Form onSubmit={onSubmit}>
                    <h2 className='form__title'>Upload Files (limit {MAX_FILE_UPLOAD_SIZE_MBYTES}MB per file)</h2>
                    { focusedWorkspaceRelativePath ? <div className='form__row'>Uploading to folder {focusedWorkspaceRelativePath}</div> : false}
                    <Form.Field>
                        <FilePicker
                            disabled={isEditDisabled}
                            onAddFiles={(files) => {
                                dispatch({ type: "Add_Files", files })
                            }}
                        />
                    </Form.Field>
                    <Form.Field>
                        <FileList
                            files={state.files}
                            disabled={isEditDisabled}
                            removeByPath={(path: string) => {
                                dispatch({ type: "Remove_Path", path })
                            }}
                        />
                    </Form.Field>
                    {currentUpload ? <FileUploadProgressBar file={currentUpload.file} uploadState={currentUpload.uploadState} /> : false}
                    { !isComplete ?
                        <Button
                            type="submit"
                            primary
                            disabled={state.files.size === 0 || isUploading}
                            loading={isUploading}
                        >
                            {'Upload'}
                        </Button>
                    : false }
                    {isComplete && !isUploading ?
                        <Button
                            type="button"
                            onClick={() => dismissAndResetModal()}
                        >
                            Close
                        </Button>
                    : false}
                    {isUploading ?
                        <span>Uploaded {completeCount}/{state.files.size}</span>
                    : false}
                </Form>
            </Modal>
        </React.Fragment>
    );
}
