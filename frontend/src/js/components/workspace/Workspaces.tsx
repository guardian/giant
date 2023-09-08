import React from 'react';
import * as R from 'ramda';
import Modal from '../UtilComponents/Modal';
import CreateFolderModal from './CreateFolderModal';
import TreeBrowser from '../UtilComponents/TreeBrowser';
import ItemName from '../UtilComponents/TreeBrowser/ItemName';
import hdate from 'human-date';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { addFolderToWorkspace } from '../../actions/workspaces/addFolderToWorkspace';
import { deleteWorkspace } from '../../actions/workspaces/deleteWorkspace';
import { renameItem } from '../../actions/workspaces/renameItem';
import { moveItems } from '../../actions/workspaces/moveItem';
import { deleteItem } from '../../actions/workspaces/deleteItem';
import { setSelectedEntries } from '../../actions/workspaces/setSelectedEntries';
import { setEntryBeingRenamed } from '../../actions/workspaces/setEntryBeingRenamed';
import { renameWorkspace } from '../../actions/workspaces/renameWorkspace';
import { setWorkspaceFollowers } from '../../actions/workspaces/setWorkspaceFollowers';
import { getWorkspacesMetadata } from '../../actions/workspaces/getWorkspacesMetadata';
import { getWorkspace } from '../../actions/workspaces/getWorkspace';
import { getCollections } from '../../actions/collections/getCollections';
import { setNodeAsCollapsed } from '../../actions/workspaces/setNodeAsCollapsed';
import { setNodeAsExpanded } from '../../actions/workspaces/setNodeAsExpanded';
import { listUsers } from '../../actions/users/listUsers';
import DocumentIcon from 'react-icons/lib/ti/document';
import { Icon, Loader, Menu } from 'semantic-ui-react';
import WorkspaceSummary from './WorkspaceSummary';
import { ColumnsConfig, isTreeLeaf, isTreeNode, TreeEntry, TreeLeaf } from '../../types/Tree';
import { isWorkspaceLeaf, Workspace, WorkspaceEntry } from '../../types/Workspaces';
import { GiantState } from '../../types/redux/GiantState';
import { GiantDispatch } from '../../types/redux/GiantDispatch';
import DetectClickOutside from '../UtilComponents/DetectClickOutside';
import {
    entriesAreEqual,
    entriesIncludes,
    getShiftClickSelectedEntries,
    newSelectionFromShiftClick,
    treeToOrderedEntries
} from '../../util/treeUtils';
import { setFocusedEntry } from '../../actions/workspaces/setFocusedEntry';
import { processingStageToString, workspaceHasProcessingFiles } from '../../util/workspaceUtils';
import { setWorkspaceIsPublic } from '../../actions/workspaces/setWorkspaceIsPublic';
import { RouteComponentProps } from 'react-router-dom';
import {getMyPermissions} from "../../actions/users/getMyPermissions";


type Props = ReturnType<typeof mapStateToProps>
    & ReturnType<typeof mapDispatchToProps>
    & RouteComponentProps<{id: string}>;


type State = {
    createFolderModalOpen: boolean,
    contextMenu: {
        isOpen: boolean,
        entry: null | TreeEntry<WorkspaceEntry>,
        positionX: number,
        positionY: number
    },
    columnsConfig: ColumnsConfig<WorkspaceEntry>,
    previousShiftClickSelectedEntries: TreeEntry<WorkspaceEntry>[]
}

class WorkspacesUnconnected extends React.Component<Props, State> {

    stringSort = (a: string, b: string) => {
        if (a && b) {
            return a.localeCompare(b);
        } else {
            return 0;
        }
    };

    numberSort = (a: number, b: number) => {
        if (a && b) {
            return a - b;
        } else {
            return 0;
        }
    };

    renderIcon = (entry: TreeEntry<WorkspaceEntry>) => {
        if (isTreeLeaf<WorkspaceEntry>(entry) && isWorkspaceLeaf(entry.data)) {
            switch (entry.data.processingStage.type) {
                case 'processing':
                    return <Loader active inline size="tiny" className="file-browser__icon" />;
                case 'failed':
                    return <Icon name="exclamation triangle" inline size="small" color="red" className="file-browser__icon"/>;
                default:
                    // TODO: this used to use .icon, which seems to me a rendering layer thing so I removed from the server response
                    // Also there's only a single workspace node in prod where icon is 'email'. Can this be right??
                    return <DocumentIcon className="file-browser__icon" />;
            }
        }

    };

    allColumns = [
        {
            name: 'Name',
            align: 'left' as const,
            style: {
                width: '400px'
            },
            render: (entry: TreeEntry<WorkspaceEntry>) => {
                const workspaceId = this.props.match.params.id;
                const canEdit = this.props.entryBeingRenamed !== null;

                const curryRename = (newName: string) => {
                    if (this.props.entryBeingRenamed) {
                        this.props.renameItem(workspaceId, this.props.entryBeingRenamed.id, newName);
                    }
                };

                return <React.Fragment>
                    {this.renderIcon(entry)}
                    <ItemName canEdit={canEdit} id={entry.id} name={entry.name} onFinishRename={curryRename}/>
                </React.Fragment>;
            },
            sort: (a: TreeEntry<WorkspaceEntry>, b: TreeEntry<WorkspaceEntry>) => {
                // Folders grouped separately (top or bottom)
                if (isTreeNode(a) && isTreeLeaf(b)) {
                    return -1;
                }
                if (isTreeNode(b) && isTreeLeaf(a)) {
                    return 1;
                }
                return this.stringSort(a.name, b.name)
            }
        },
        {
            name: 'Added By',
            align: 'left' as const,
            style: {
                width: '150px',
            },
            render: (entry: TreeEntry<WorkspaceEntry>) =>
                <React.Fragment>
                    {/*TODO: why does outputting PartialUser here still typecheck, but break at runtime?? */}
                    {entry.data.addedBy.displayName}
                </React.Fragment>,

            sort: (a: TreeEntry<WorkspaceEntry>, b: TreeEntry<WorkspaceEntry>) => this.stringSort(a.data.addedBy.displayName, b.data.addedBy.displayName)
        },
        {
            name: 'Added On',
            align: 'left' as const,
            style: {
                width: '240px',
            },
            render: (entry: TreeEntry<WorkspaceEntry>) =>
                <React.Fragment>
                    {hdate.prettyPrint(new Date(Number(entry.data.addedOn)), {showTime: true})}
                </React.Fragment>,

            sort: (a: TreeEntry<WorkspaceEntry>, b: TreeEntry<WorkspaceEntry>) => this.numberSort(a.data.addedOn || 0, b.data.addedOn || 0)
        },
        {
            name: 'File Type',
            align: 'center' as const,
            style: {
                width: '140px',
            },
            render: (entry: TreeEntry<WorkspaceEntry>) =>
                <React.Fragment>
                    {isTreeLeaf<WorkspaceEntry>(entry) && isWorkspaceLeaf(entry.data) ? entry.data.mimeType : ''}
                </React.Fragment>,
            sort: (a: TreeEntry<WorkspaceEntry>, b: TreeEntry<WorkspaceEntry>) => {
                // Sort folders on top (or bottom)
                let aVal = '';
                let bVal = '';
                if (isTreeLeaf(a) && isWorkspaceLeaf(a.data)) {
                    aVal = a.data.mimeType;
                }
                if (isTreeLeaf(b) && isWorkspaceLeaf(b.data)) {
                    bVal = b.data.mimeType;
                }
                return this.stringSort(aVal, bVal);
            }
        },
        {
            name: 'Processing Stage',
            align: 'center' as const,
            style: {
                width: '120px',
            },
            render: (entry: TreeEntry<WorkspaceEntry>) =>
                <React.Fragment>
                    {isTreeLeaf<WorkspaceEntry>(entry) && isWorkspaceLeaf(entry.data) ? processingStageToString(entry.data.processingStage) : ''}
                </React.Fragment>,
            sort: (a: TreeEntry<WorkspaceEntry>, b: TreeEntry<WorkspaceEntry>) => {
                // Sort folders on top (or bottom)
                let aVal = '';
                let bVal = '';
                if (isTreeLeaf(a) && isWorkspaceLeaf(a.data)) {
                    aVal = processingStageToString(a.data.processingStage);
                }
                if (isTreeLeaf(b) && isWorkspaceLeaf(b.data)) {
                    bVal = processingStageToString(b.data.processingStage);
                }
                return this.stringSort(aVal, bVal);
            }
        }
    ];

    state: State = {
        createFolderModalOpen: false,
        contextMenu: {
            isOpen: false,
            entry: null,
            positionX: 0,
            positionY: 0
        },
        columnsConfig: {
            sortDescending: false,
            sortColumn: 'Name',
            columns: [
                ...this.allColumns
            ]
        },
        previousShiftClickSelectedEntries: []
    };

    poller: NodeJS.Timeout | null = null;

    componentDidMount() {
        this.setTitle();
        this.props.listUsers();
        this.props.getCollections();
        this.props.getWorkspace(this.props.match.params.id);

        this.poller = setInterval(this.performPollingIfRequired, 5000);
    }

    componentDidUpdate(prevProps: Props) {
        this.setTitle();
        this.props.getMyPermissions()
        if (localStorage.getItem('selectedWorkspaceId') !== this.props.match.params.id) {
            localStorage.setItem('selectedWorkspaceId', this.props.match.params.id);
        }

        const workspaceId = this.props.match.params.id;
        const prevWorkspaceId = prevProps.match.params.id;

        if(workspaceId !== prevWorkspaceId) {
            this.props.getWorkspace(workspaceId);
        }
    }

    componentWillUnmount() {
        document.title = "Giant";

        if(this.poller !== null) {
            clearInterval(this.poller);
        }
    }

    setTitle = () => {
        if(this.props.currentWorkspace) {
            document.title = `${this.props.currentWorkspace.name} - Giant`;
        } else {
            document.title = "Workspaces - Giant";
        }
    };

    UNSAFE_componentWillReceiveProps(nextProps: Props) {
        const workspaceId = this.props.match.params.id;
        const nextWorkspaceId = nextProps.match.params.id;
        if (workspaceId !== nextWorkspaceId) {
            this.clearFocus();
        }
    };

    performPollingIfRequired = ()  => {
        if(this.props.currentWorkspace && workspaceHasProcessingFiles(this.props.currentWorkspace)) {
            this.props.getWorkspace(this.props.currentWorkspace.id);
        }
    };

    clearFocus = () => {
        this.props.resetFocusedAndSelectedEntries();
    };

    setSelectedEntriesAfterShiftClick = (newlyFocusedEntry: TreeEntry<WorkspaceEntry>) => {
        if (!this.props.currentWorkspace) {
            return;
        }

        let previouslyFocusedEntry = this.props.focusedEntry;
        const orderedEntries = treeToOrderedEntries(this.props.currentWorkspace.rootNode.children, this.state.columnsConfig, this.props.expandedNodes);
        if (!previouslyFocusedEntry) {
            // if nothing focused, set the focused node to the top one
            previouslyFocusedEntry = orderedEntries[0];
            if (orderedEntries.length) {
                this.props.setFocusedEntry(previouslyFocusedEntry);
            }
        }

        const newShiftClickSelectedEntries = getShiftClickSelectedEntries(orderedEntries, previouslyFocusedEntry, newlyFocusedEntry);

        this.props.setSelectedEntries(newSelectionFromShiftClick(
            this.state.previousShiftClickSelectedEntries,
            newShiftClickSelectedEntries,
            this.props.selectedEntries
        ));

        // Specifically do not change the focused entry when setting a shift-click selection,
        // because we want the "anchor" for changing the shift-click area to remain the same.
        // This allows you to reduce/redefine your selection if you want.
        this.setState({previousShiftClickSelectedEntries: newShiftClickSelectedEntries});
    };

    setSelectedEntriesAfterMetaClick = (entry: TreeEntry<WorkspaceEntry>) => {
        this.setState({previousShiftClickSelectedEntries: []});
        if (entriesIncludes(this.props.selectedEntries, entry)) {
            // deselect the clicked entry
            const newSelectedEntries = this.props.selectedEntries.filter(n => n.id !== entry.id);
            this.props.setSelectedEntries(newSelectedEntries);

            // if the deselected node is the focused one, we need to pick a new node to focus.
            // let's choose the most recently selected, if there's anything left.
            if (this.props.focusedEntry && entriesAreEqual(this.props.focusedEntry, entry)) {
                this.props.setFocusedEntry(newSelectedEntries[newSelectedEntries.length - 1] || null);
            }
        } else {
            this.props.setSelectedEntries(R.append(entry, this.props.selectedEntries));
            this.props.setFocusedEntry(entry);
        }
    };

    setSelectedEntry = (entry: TreeEntry<WorkspaceEntry>) => {
        this.props.setFocusedAndSelectedEntry(entry);
        this.setState({previousShiftClickSelectedEntries: []});
    };

    onFocus = (entry: TreeEntry<WorkspaceEntry>, isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => {
        if (isMetaKeyHeld) {
            this.setSelectedEntriesAfterMetaClick(entry);
        } else if (isShiftKeyHeld) {
            this.setSelectedEntriesAfterShiftClick(entry);
        } else {
            this.setSelectedEntry(entry);
        }
    };

    onClickColumn = (column: string) => {
        if (this.state.columnsConfig.sortColumn === column) {

            this.setState({
                columnsConfig: {
                    sortDescending: !this.state.columnsConfig.sortDescending,
                    sortColumn: this.state.columnsConfig.sortColumn,
                    columns: this.state.columnsConfig.columns
                }
            });
        } else {

            this.setState({
                columnsConfig: {
                    sortDescending: false,
                    sortColumn: column,
                    columns: this.state.columnsConfig.columns
                }
            });
        }
    };

    onMoveItems = (itemIds: string[], newParentId: string) => {
        const workspaceId = this.props.match.params.id;
        this.props.moveItems(workspaceId, itemIds, workspaceId, newParentId);
    };

    onContextMenu = (e: React.MouseEvent, entry: TreeEntry<WorkspaceEntry>) => {
        if (e.metaKey && e.shiftKey) {
            // override for devs to do "inspect element"
            return;
        }
        e.preventDefault();
        this.props.setFocusedAndSelectedEntry(entry);
        this.setState({
            contextMenu: {
                isOpen: true,
                entry,
                positionX: e.pageX,
                positionY: e.pageY
            }
        })
    };

    closeContextMenu = () => {
        this.setState({
            contextMenu: {
                isOpen: false,
                entry: null,
                positionX: 0,
                positionY: 0
            }
        });
    };

    renderContextMenu(entry: TreeEntry<WorkspaceEntry>, positionX: number, positionY: number) {

        return <DetectClickOutside onClickOutside={this.closeContextMenu}>
            <Menu
                style={{ position: 'absolute', left: positionX, top: positionY }}
                items={[
                    // or 'pencil alternate'
                    { key: "rename", content: "Rename", icon: "pen square" },
                    { key: "remove", content: "Remove from workspace", icon: "trash" },
                ]}
                vertical
                onItemClick={(e, menuItemProps) => {
                    if (menuItemProps.content === 'Rename') {
                        this.props.setEntryBeingRenamed(entry);
                    }

                    if (menuItemProps.content === 'Remove from workspace') {
                        const workspaceId = this.props.match.params.id;
                        this.props.deleteItem(workspaceId, entry.id);
                        this.props.resetFocusedAndSelectedEntries();
                    }

                    this.closeContextMenu();
                }}
            />
        </DetectClickOutside>;
    }

    renderFolderTree = (workspace: Workspace) => {
        const onSelectLeaf = (entry: TreeLeaf<WorkspaceEntry>) => {
            // TODO: it would be nice to not have to do this check
            // if it could know that because it's a TreeLeaf the type parameter is a WorkspaceLeaf.
            // don't know of a way to do it though...
            if (isWorkspaceLeaf(entry.data) && !this.props.entryBeingRenamed) {
                window.open(`/viewer/${entry.data.uri}`, '_blank');
            }
        };

        // TODO: would it make sense to always set the focused node back to the rootNode when "clearing" focus?
        // then we wouldn't need this little bit of logic
        const createFolderDestination = this.props.focusedEntry || workspace.rootNode;
        const selectedCount = this.props.selectedEntries.length;

        return (
            <div className='workspace__tree'>
                <div className='workspace__tree-header'>
                    <div className='workspace__tree-actions'>
                        <button className='btn btn--primary workspace__button' disabled={selectedCount > 1} onClick={() => this.createFolder()}>New Folder</button>

                        {/*<button className='btn btn--primary' onClick={() => alert('not yet implemented')}>{t('Manage Columns')}</button>*/}
                        <Modal isOpen={this.state.createFolderModalOpen} dismiss={this.dismissModal}>
                            <CreateFolderModal onComplete={this.dismissModal} workspace={workspace} parentEntry={createFolderDestination} addFolderToWorkspace={this.props.addFolderToWorkspace}/>
                        </Modal>
                    </div>
                </div>
                <TreeBrowser
                    showColumnHeaders={true}
                    rootId={workspace.rootNode.id}
                    tree={workspace.rootNode.children}
                    onFocus={this.onFocus}
                    clearFocus={this.clearFocus}
                    selectedEntries={this.props.selectedEntries}
                    focusedEntry={this.props.focusedEntry}
                    onMoveItems={this.onMoveItems}
                    onSelectLeaf={onSelectLeaf}
                    columnsConfig={this.state.columnsConfig}
                    onClickColumn={this.onClickColumn}
                    // entire tree is in memory up-front
                    onExpandLeaf={() => {}}
                    expandedEntries={this.props.expandedNodes}
                    onExpandNode={this.props.setNodeAsExpanded}
                    onCollapseNode={this.props.setNodeAsCollapsed}
                    onContextMenu={this.onContextMenu}
                />
            </div>
        );
    };

    dismissModal = () => {
        this.setState({
            createFolderModalOpen: false
        });
    };

    createFolder = () => {
        this.setState({
            createFolderModalOpen: true
        });
    };

    render() {
        if (!this.props.currentWorkspace || !this.props.currentUser) {
            return false;
        }

        return (
            <div className='app__main-content'>
                <WorkspaceSummary
                    workspace={this.props.currentWorkspace}
                    currentUser={this.props.currentUser}
                    myPermissions={this.props.myPermissions}
                    users={this.props.users}
                    setWorkspaceFollowers={this.props.setWorkspaceFollowers}
                    setWorkspaceIsPublic={this.props.setWorkspaceIsPublic}
                    renameWorkspace={this.props.renameWorkspace}
                    deleteWorkspace={this.props.deleteWorkspace}
                    collections={this.props.collections}
                    getWorkspaceContents={this.props.getWorkspace}
                    focusedEntry={this.props.focusedEntry}
                    workspaces={this.props.workspacesMetadata}
                    expandedNodes={this.props.expandedNodes}
                />
                <div className='workspace'>
                    {this.renderFolderTree(this.props.currentWorkspace)}
                </div>
                {this.state.contextMenu.isOpen && this.state.contextMenu.entry
                    ? this.renderContextMenu(
                        this.state.contextMenu.entry,
                        this.state.contextMenu.positionX,
                        this.state.contextMenu.positionY
                    )
                    : null
                }
            </div>
        );
    }
}

function mapStateToProps(state: GiantState) {
    return {
        workspacesMetadata: state.workspaces.workspacesMetadata,
        currentWorkspace: state.workspaces.currentWorkspace,
        selectedEntries: state.workspaces.selectedEntries,
        focusedEntry: state.workspaces.focusedEntry,
        entryBeingRenamed: state.workspaces.entryBeingRenamed,
        currentUser: state.auth.token?.user,
        users: state.users.userList,
        expandedNodes: state.workspaces.expandedNodes,
        collections: state.collections,
        myPermissions: state.users.myPermissions
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        moveItems: bindActionCreators(moveItems, dispatch),
        renameItem: bindActionCreators(renameItem, dispatch),
        deleteItem: bindActionCreators(deleteItem, dispatch),
        addFolderToWorkspace: bindActionCreators(addFolderToWorkspace, dispatch),
        deleteWorkspace: bindActionCreators(deleteWorkspace, dispatch),
        resetFocusedAndSelectedEntries: () => {
            dispatch(setSelectedEntries([]));
            dispatch(setFocusedEntry(null));
        },
        setFocusedAndSelectedEntry: (entry: TreeEntry<WorkspaceEntry>) => {
            dispatch(setSelectedEntries([entry]));
            dispatch(setFocusedEntry(entry));
        },
        setSelectedEntries: bindActionCreators(setSelectedEntries, dispatch),
        setFocusedEntry: bindActionCreators(setFocusedEntry, dispatch),
        setEntryBeingRenamed: bindActionCreators(setEntryBeingRenamed, dispatch),
        setNodeAsExpanded: bindActionCreators(setNodeAsExpanded, dispatch),
        setNodeAsCollapsed: bindActionCreators(setNodeAsCollapsed, dispatch),
        renameWorkspace: bindActionCreators(renameWorkspace, dispatch),
        setWorkspaceFollowers: bindActionCreators(setWorkspaceFollowers, dispatch),
        setWorkspaceIsPublic: bindActionCreators(setWorkspaceIsPublic, dispatch),
        listUsers: bindActionCreators(listUsers, dispatch),
        getCollections: bindActionCreators(getCollections, dispatch),
        getWorkspacesMetadata: bindActionCreators(getWorkspacesMetadata, dispatch),
        getWorkspace: bindActionCreators(getWorkspace, dispatch),
        getMyPermissions: bindActionCreators(getMyPermissions, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(WorkspacesUnconnected);
