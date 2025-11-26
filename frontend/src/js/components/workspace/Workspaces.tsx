import React, {ClipboardEventHandler} from 'react';
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
import { deleteResourceFromWorkspace } from '../../actions/workspaces/deleteResourceFromWorkspace';
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
import {Icon, Loader, Menu, Popup} from 'semantic-ui-react';
import WorkspaceSummary from './WorkspaceSummary';
import {ColumnsConfig, isTreeLeaf, isTreeNode, TreeEntry, TreeLeaf} from '../../types/Tree';
import {isWorkspaceLeaf, isWorkspaceNode, Workspace, WorkspaceEntry} from '../../types/Workspaces';
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
import { reprocessBlob } from '../../actions/workspaces/reprocessBlob';
import { DeleteModal, ModalStatus, RemoveFromWorkspaceModal } from './ConfirmModal';
import { PartialUser } from '../../types/User';
import { getMyPermissions } from '../../actions/users/getMyPermissions';
import buildLink from '../../util/buildLink';
import history from '../../util/history';
import {takeOwnershipOfWorkspace} from "../../actions/workspaces/takeOwnershipOfWorkspace";
import {setNodesAsExpanded} from "../../actions/workspaces/setNodesAsExpanded";
import {FileAndFolderCounts} from "../UtilComponents/TreeBrowser/FileAndFolderCounts";
import {EuiLoadingSpinner} from "@elastic/eui";
import MdGlobeIcon from "react-icons/lib/md/public";
import ReactTooltip from "react-tooltip";


type Props = ReturnType<typeof mapStateToProps>
    & ReturnType<typeof mapDispatchToProps>
    & RouteComponentProps<{id: string, workspaceLocation:string}>;


type State = {
    createFolderModalOpen: boolean,
    haveAppliedWorkspaceLocationParam: boolean,
    hoverOverReprocessIconEntry: null | TreeEntry<WorkspaceEntry>;
    contextMenu: {
        isOpen: boolean,
        entry: null | TreeEntry<WorkspaceEntry>,
        positionX: number,
        positionY: number
    },
    columnsConfig: ColumnsConfig<WorkspaceEntry>,
    previousShiftClickSelectedEntries: TreeEntry<WorkspaceEntry>[],
    deleteModalContext: {
        isOpen: boolean,
        entry: null | TreeEntry<WorkspaceEntry>,
        status: ModalStatus,
    },
    removeFromWorkspaceModalContext: {
        isOpen: boolean,
        entry: null | TreeEntry<WorkspaceEntry>,
        status: ModalStatus,
    }
}

type ContextMenuEntry = {
    key: string
    content: string;
    icon: string;

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
        else if(isWorkspaceNode(entry.data) && entry.data.descendantsProcessingTaskCount > 0) {
          return <Loader active inline size="tiny" className="file-browser__icon" />;
        }
    };

  renderReprocessIcon = (entry: TreeEntry<WorkspaceEntry>) => {

    // TODO hopefully support re-processing remote ingests in future
    if(entry.id.startsWith("RemoteIngestTask/")){
      return null;
    }

    const reprocessAction = (entry: TreeEntry<WorkspaceEntry>) => {
      if (isWorkspaceLeaf(entry.data)) {
        const workspaceId = this.props.match.params.id;
        this.props.reprocessBlob(workspaceId, entry.data.uri);
      }
    };

    const handleMouseEnter = () => {
      this.setState({
        hoverOverReprocessIconEntry: entry,
      });
    };

    const handleMouseLeave = () => {
      this.setState({
        hoverOverReprocessIconEntry: null,
      });
    };

    const buttonStyle= {
      paddingLeft: '0.4em',
      color: this.state.hoverOverReprocessIconEntry === entry ? 'black' : 'grey',
    }
    return (
        <Popup content='Reprocess source file'
            trigger={
                <button style = {buttonStyle} onClick={() => reprocessAction(entry)}>
                  <Icon
                      name="redo"
                      inline
                      size="small"
                      className="file-browser__icon"
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                  />
                </button>
            }
        />
    );
  };

  renderStatus = (entry: TreeEntry<any>) =>{
    if (isTreeLeaf<WorkspaceEntry>(entry) && isWorkspaceLeaf(entry.data)) {
      return (
          <React.Fragment>
            {processingStageToString(entry.data.processingStage)}
            {entry.data.processingStage.type === "failed" && this.renderReprocessIcon(entry)}
          </React.Fragment>
      )
    }
    else if (isWorkspaceNode(entry.data)){
      return <>
        {entry.data.descendantsProcessingTaskCount > 0 && <em>
          {entry.data.descendantsProcessingTaskCount.toLocaleString()} task{entry.data.descendantsProcessingTaskCount > 1 && "s"} remaining{" "}
        </em>}
        {entry.data.descendantsProcessingTaskCount > 0 && entry.data.descendantsFailedCount > 0 && <>&nbsp;&amp;&nbsp;</>}
        {entry.data.descendantsFailedCount > 0 && <em>{entry.data.descendantsFailedCount.toLocaleString()} failed</em>}
      </>
    }
    return (<></>)
  }

    allColumns = [
        {
            name: 'Name',
            align: 'left' as const,
            style: {
                width: '500px'
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
                    {entry.data.maybeCapturedFromURL && <>
                        <span data-tip>
                          <MdGlobeIcon className='file-upload__icon' style={{color: "grey", marginLeft: "5px"}}/>
                        </span>
                      <ReactTooltip place="left">
                        <div style={{textAlign: "center"}}>
                          <strong>Captured from URL</strong>
                          <br />
                          {entry.data.maybeCapturedFromURL}
                        </div>
                      </ReactTooltip>
                    </>}
                    <ItemName canEdit={canEdit} id={entry.id} name={entry.name} onFinishRename={curryRename}/>
                    {isWorkspaceNode(entry.data) && <FileAndFolderCounts {...entry.data} />}
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
                width: '170px',
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
                width: '300px',
            },
            render: (entry: TreeEntry<WorkspaceEntry>) => (
                this.renderStatus(entry)
            ),
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
        haveAppliedWorkspaceLocationParam: false,
        hoverOverReprocessIconEntry: null,
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
        previousShiftClickSelectedEntries: [],
        deleteModalContext: {
            isOpen: false,
            entry: null,
            status: "unconfirmed",
        },
        removeFromWorkspaceModalContext: {
            isOpen: false,
            entry: null,
            status: "unconfirmed",
        }
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
        if (localStorage.getItem('selectedWorkspaceId') !== this.props.match.params.id) {
            localStorage.setItem('selectedWorkspaceId', this.props.match.params.id);
        }

        const workspaceId = this.props.match.params.id;
        const prevWorkspaceId = prevProps.match.params.id;

        if(workspaceId !== prevWorkspaceId) {
            this.props.getWorkspace(workspaceId, { shouldClearFirst: true });
        }

        const workspaceLocation = this.props.match.params.workspaceLocation;
        if(workspaceLocation && !this.state.haveAppliedWorkspaceLocationParam && this.props.currentWorkspace) {
          const entryTreeEntries = this.getEntryTreeNodes(workspaceLocation, this.props.currentWorkspace.rootNode) || [];
          const entriesWithoutRoot = entryTreeEntries.filter((entry)=>this.props.currentWorkspace && entry.id !== this.props.currentWorkspace.rootNode.id)
          const entryTreeNodes= entriesWithoutRoot.filter(isTreeNode);

          if (entryTreeNodes.length > 0) {
            this.props.setNodesAsExpanded(entryTreeNodes);
          }

          if (entriesWithoutRoot.length > 0){
            const lastEntry = entriesWithoutRoot[entriesWithoutRoot.length - 1]
            this.props.setFocusedEntry(lastEntry);
          }
          this.setState({haveAppliedWorkspaceLocationParam: true})
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

    UNSAFE_componentWillMount() {
        this.props.getMyPermissions();
    }

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
        this.props.history.push({
          pathname: `/workspaces/${this.props.match.params.id}/${entry.id}`,
        });

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

    onDeleteModalOpen = (isOpen: boolean) => {
        if (isOpen)
            this.setState({deleteModalContext: {entry: this.state.deleteModalContext.entry, isOpen, status: "unconfirmed"}});
        else
            this.setState({deleteModalContext: {entry: null, isOpen, status: "unconfirmed"}});
    }

    onRemoveFromWorkspaceModalOpen = (isOpen: boolean) => {
        if (isOpen)
            this.setState({removeFromWorkspaceModalContext: {entry: this.state.removeFromWorkspaceModalContext.entry, isOpen, status: "unconfirmed"}});
        else
            this.setState({removeFromWorkspaceModalContext: {entry: null, isOpen, status: "unconfirmed"}});
    }

    onDeleteCompleteHandler = (isSuccess: boolean) => {
        const modalContext = this.state.deleteModalContext;
        if (modalContext.isOpen) {
            const status = isSuccess ? "done" : "failed"
            this.setState({deleteModalContext: {...modalContext, status}});
        }
    }
    onRemoveCompleteHandler = (isSuccess: boolean) => {
        const modalContext = this.state.removeFromWorkspaceModalContext;
        if (modalContext.isOpen) {
            const status = isSuccess ? "done" : "failed"
            this.setState({removeFromWorkspaceModalContext: {...modalContext, status}});
        }
    }

    onDeleteItem = (workspaceId: string, entry: TreeEntry<WorkspaceEntry> | null) => () => {
        if (entry && isWorkspaceLeaf(entry.data)) {
            const deleteContext = this.state.deleteModalContext;
            this.setState({deleteModalContext: {...deleteContext, status: "doing"}});
            this.props.deleteResourceFromWorkspace(workspaceId, entry.data.uri, this.onDeleteCompleteHandler);
            this.props.resetFocusedAndSelectedEntries();
        }
    }

    onRemoveFromWorkspace = (workspaceId: string, entry: TreeEntry<WorkspaceEntry> | null) => () => {
        if (entry) {
            const removeFromWorkspaceModalContext = this.state.removeFromWorkspaceModalContext;
            this.setState({removeFromWorkspaceModalContext: {...removeFromWorkspaceModalContext, status: "doing"}});
            this.props.deleteItem(workspaceId, entry.id, this.onRemoveCompleteHandler);
            this.props.resetFocusedAndSelectedEntries();
        }
    }

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

    /**
     * Searches through tree beginning at startNode for entryId, if successful returns an array of nodes between startNode and entryId
     * @param entryId
     * @param startNode
     */
    getEntryTreeNodes (entryId: string, startNode: TreeEntry<WorkspaceEntry>): TreeEntry<WorkspaceEntry>[] | undefined {
        if (startNode.id === entryId) {
            return [startNode]
        }
        if (isTreeNode(startNode)) {
            for (const child of startNode.children) {
                const result = this.getEntryTreeNodes(entryId, child)
                if (result !== undefined) {
                    return [startNode, ...result]
                }
            }
        }
        return undefined
    }

    getEntryPath (entryId: string, workspaceRootNode: TreeEntry<WorkspaceEntry>): string {
       const pathArray = this.getEntryTreeNodes(entryId, workspaceRootNode)
        if (pathArray) {
            const path = pathArray.map(p => p.name).join("/")
            console.log(path)
            return path
        }
        return "unknown"
    }


    renderContextMenu(entry: TreeEntry<WorkspaceEntry>, positionX: number, positionY: number, currentUser: PartialUser, workspace: Workspace) {
        const copyFilenameContent = "Copy file name"
        const copyFilePathContent = "Copy file path"
        const copyCaptureURLContent = "Copy URL this was captured from"

        const isRemoteIngest = entry.id.startsWith("RemoteIngest")

        const items = [
            {key : "copyFilename", content: copyFilenameContent, icon: "copy"},
            {key : "copyFilePath", content: copyFilePathContent, icon: "copy"},
        ];

        if(!isRemoteIngest){
          items.push(
            { key: "rename", content: "Rename", icon: "pen square" }, // or 'pencil alternate'
            { key: "remove", content: "Remove from workspace", icon: "trash" }
          )
        }

        if (entry.data.addedBy.username === currentUser.username && isWorkspaceLeaf(entry.data) && !isRemoteIngest) {
            items.push({ key: "deleteOrRemove", content: "Delete file", icon: "trash" });
        }

        if(isRemoteIngest && isWorkspaceLeaf(entry.data) && entry.data.processingStage.type === "failed") {
            items.push({ key: "dismissFailed", content: `Dismiss failed '${entry.data.mimeType}'`, icon: "trash" });
        }

        if(entry.data.maybeCapturedFromURL){
          items.push({ key: "copyCaptureURL", content: copyCaptureURLContent, icon: "linkify" });
        }

        if (isWorkspaceNode(entry.data) && !isRemoteIngest) {
            items.push({ key: "search", content: "Search in folder", icon: "search" })
        } else if (isWorkspaceLeaf(entry.data) && !isRemoteIngest) { // TODO hopefully support re-processing remote ingests in future
          items.push({ key: "reprocess", content: "Reprocess source file", icon: "redo" });
        }

        return <DetectClickOutside onClickOutside={this.closeContextMenu}>
            <Menu
                style={{ position: 'absolute', left: positionX, top: positionY }}
                items={items}
                vertical
                onItemClick={(e, menuItemProps) => {
                    const workspaceId = this.props.match.params.id;
                    let closeMenuDelay = 0;
                    if (menuItemProps.content === 'Rename') {
                        this.props.setEntryBeingRenamed(entry);
                    }

                    if (menuItemProps.content === 'Remove from workspace') {
                        this.setState({
                            removeFromWorkspaceModalContext: {
                                isOpen: true,
                                entry,
                                status: "unconfirmed",
                            }
                        });
                    }

                    if ([copyFilenameContent, copyFilePathContent, copyCaptureURLContent].includes(menuItemProps.content as string)) {
                        switch (menuItemProps.content) {
                          case copyFilenameContent:
                            navigator.clipboard.writeText(entry.name);
                            break;
                          case copyFilePathContent:
                            navigator.clipboard.writeText(this.getEntryPath(entry.id, workspace.rootNode));
                            break;
                          case copyCaptureURLContent:
                            navigator.clipboard.writeText(entry.data.maybeCapturedFromURL!);
                            break;
                        }

                        const menuItem = items.find((i: ContextMenuEntry) => i.content === menuItemProps.content)
                        if (menuItem) {
                            menuItem.content = 'Copied!'
                            menuItem.icon = 'check'
                            closeMenuDelay = 700;
                        }
                    }

                    if (menuItemProps.content === "Delete file" || menuItemProps.content?.toString().startsWith("Dismiss failed")) {
                        this.setState({
                            deleteModalContext: {
                                isOpen: true,
                                entry,
                                status: "unconfirmed",
                            }
                        });
                    }

                    if (menuItemProps.content === 'Reprocess source file' && (isWorkspaceLeaf(entry.data))) {
                        this.props.reprocessBlob(workspaceId, entry.data.uri)
                    }

                    if (menuItemProps.content === "Search in folder"){
                        history.push(
                            buildLink("/search", {
                                q: JSON.stringify([
                                    "",
                                    {
                                        n: "Workspace Folder",
                                        v: entry.name,
                                        op: "+",
                                        t: "workspace_folder",
                                        workspaceId: workspace.id,
                                        folderId: entry.id,
                                    },
                                    "*"
                                ]),
                                page: 1
                            }),
                        )
                    }

                    setTimeout(() => this.closeContextMenu(), closeMenuDelay);
                }}
            />
        </DetectClickOutside>;
    }

    onCopy: ClipboardEventHandler<HTMLDivElement> = (e) => {
      e.clipboardData.setData(
        'text/plain',
        this.props.selectedEntries?.map(entry => entry.name).join('\n')
      );
      e.preventDefault();
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
            <div className='workspace__tree' onCopy={this.onCopy}>
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
        if(!this.props.currentWorkspace && this.props.match.params.id){
          return <div className='app__main-content'>
            <EuiLoadingSpinner size="l" />
          </div>;
        }

        if (!this.props.currentWorkspace || !this.props.currentUser) {
          return false;
        }

        return (
            <div className='app__main-content'>
                <WorkspaceSummary
                    workspace={this.props.currentWorkspace}
                    currentUser={this.props.currentUser}
                    users={this.props.users}
                    setWorkspaceFollowers={this.props.setWorkspaceFollowers}
                    setWorkspaceIsPublic={this.props.setWorkspaceIsPublic}
                    renameWorkspace={this.props.renameWorkspace}
                    deleteWorkspace={this.props.deleteWorkspace}
                    takeOwnershipOfWorkspace={this.props.takeOwnershipOfWorkspace}
                    collections={this.props.collections}
                    getWorkspaceContents={this.props.getWorkspace}
                    focusedEntry={this.props.focusedEntry}
                    workspaces={this.props.workspacesMetadata}
                    expandedNodes={this.props.expandedNodes}
                    isAdmin={this.props.myPermissions.includes('CanPerformAdminOperations')}
                />
                <div className='workspace'>
                    {this.renderFolderTree(this.props.currentWorkspace)}
                </div>
                {this.state.contextMenu.isOpen && this.state.contextMenu.entry
                    ? this.renderContextMenu(
                        this.state.contextMenu.entry,
                        this.state.contextMenu.positionX,
                        this.state.contextMenu.positionY,
                        this.props.currentUser,
                        this.props.currentWorkspace
                    )
                    : null
                }
                <DeleteModal
                    deleteItemHandler={this.onDeleteItem(this.props.match.params.id, this.state.deleteModalContext.entry)}
                    isOpen={this.state.deleteModalContext.isOpen}
                    setModalOpen={this.onDeleteModalOpen}
                    deleteStatus={this.state.deleteModalContext.status}
                    entry={this.state.deleteModalContext.entry}
                />
                <RemoveFromWorkspaceModal
                    removeHandler={this.onRemoveFromWorkspace(this.props.match.params.id, this.state.removeFromWorkspaceModalContext.entry)}
                    isOpen={this.state.removeFromWorkspaceModalContext.isOpen}
                    setModalOpen={this.onRemoveFromWorkspaceModalOpen}
                    removeStatus={this.state.removeFromWorkspaceModalContext.status}
                    entry={this.state.removeFromWorkspaceModalContext.entry}
                />
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
        myPermissions: state.users.myPermissions,
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        moveItems: bindActionCreators(moveItems, dispatch),
        renameItem: bindActionCreators(renameItem, dispatch),
        deleteItem: bindActionCreators(deleteItem, dispatch),
        reprocessBlob: bindActionCreators(reprocessBlob, dispatch),
        deleteResourceFromWorkspace: bindActionCreators(deleteResourceFromWorkspace, dispatch),
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
        setNodesAsExpanded: bindActionCreators(setNodesAsExpanded, dispatch),
        setNodeAsCollapsed: bindActionCreators(setNodeAsCollapsed, dispatch),
        renameWorkspace: bindActionCreators(renameWorkspace, dispatch),
        takeOwnershipOfWorkspace: bindActionCreators(takeOwnershipOfWorkspace, dispatch),
        setWorkspaceFollowers: bindActionCreators(setWorkspaceFollowers, dispatch),
        setWorkspaceIsPublic: bindActionCreators(setWorkspaceIsPublic, dispatch),
        listUsers: bindActionCreators(listUsers, dispatch),
        getCollections: bindActionCreators(getCollections, dispatch),
        getWorkspacesMetadata: bindActionCreators(getWorkspacesMetadata, dispatch),
        getWorkspace: bindActionCreators(getWorkspace, dispatch),
        getMyPermissions: bindActionCreators(getMyPermissions, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(WorkspacesUnconnected);
