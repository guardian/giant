import MdGlobeIcon from "react-icons/lib/md/public";

import React, {FormEvent, useEffect, useMemo, useState} from "react";
import {isWorkspaceNode, Workspace, WorkspaceEntry, WorkspaceMetadata} from "../../types/Workspaces";
import Modal from "../UtilComponents/Modal";
import Select from "react-select";
import TreeBrowser from "../UtilComponents/TreeBrowser";
import {connect} from "react-redux";
import {GiantState} from "../../types/redux/GiantState";
import {isTreeNode, TreeEntry, TreeNode} from "../../types/Tree";
import {GiantDispatch} from "../../types/redux/GiantDispatch";
import {bindActionCreators} from "redux";
import {getWorkspace} from "../../actions/workspaces/getWorkspace";
import {setNodeAsExpanded} from "../../actions/workspaces/setNodeAsExpanded";
import {setNodeAsCollapsed} from "../../actions/workspaces/setNodeAsCollapsed";
import {displayRelativePath} from "../../util/workspaceUtils";
import {getWorkspacesMetadata} from "../../actions/workspaces/getWorkspacesMetadata";
import {setFocusedEntry} from "../../actions/workspaces/setFocusedEntry";
import {captureFromUrl} from "../../services/WorkspaceApi";
import {AppActionType, ErrorAction} from "../../types/redux/GiantActions";
import {useHistory} from "react-router-dom";
import {FileAndFolderCounts} from "../UtilComponents/TreeBrowser/FileAndFolderCounts";
import {EuiCallOut} from "@elastic/eui";

export const getMaybeCaptureFromUrlQueryParamValue = () =>
  new URLSearchParams(window.location.search).get("capture_from_url");

interface CaptureFromUrlProps {
  withButton?: true,
  maybePreSelectedWorkspace?: Workspace,
  getWorkspacesMetadata: () => void,
  workspacesMetadata: WorkspaceMetadata[],
  currentWorkspace: Workspace | null,
  setCurrentWorkspace: (id: string) => void,
  expandedNodes: TreeNode<WorkspaceEntry>[],
  setNodeAsExpanded: (node: TreeNode<WorkspaceEntry>) => void,
  setNodeAsCollapsed: (node: TreeNode<WorkspaceEntry>) => void,
  focusedEntry: TreeEntry<WorkspaceEntry> | null,
  setFocusedEntry: (entry: TreeEntry<WorkspaceEntry> | null) => void,
  refreshWorkspace: (workspaceId: string) => void,

  showError(errorAction: ErrorAction): void
}

export const CaptureFromUrl = connect(
  (state: GiantState) => ({
    workspacesMetadata: state.workspaces.workspacesMetadata,
    currentWorkspace: state.workspaces.currentWorkspace,
    expandedNodes: state.workspaces.expandedNodes,
    focusedEntry: state.workspaces.focusedEntry,
  }),
  (dispatch: GiantDispatch) => ({
    getWorkspacesMetadata: bindActionCreators(getWorkspacesMetadata, dispatch),
    setCurrentWorkspace: bindActionCreators(getWorkspace, dispatch), // aliased to setCurrentWorkspace because that's what it does
    setNodeAsExpanded: bindActionCreators(setNodeAsExpanded, dispatch),
    setNodeAsCollapsed: bindActionCreators(setNodeAsCollapsed, dispatch),
    setFocusedEntry: bindActionCreators(setFocusedEntry, dispatch),
    showError(errorAction: ErrorAction) {
      dispatch(errorAction)
    },
    refreshWorkspace: bindActionCreators(getWorkspace, dispatch)
  })
)(({
     withButton,
     workspacesMetadata,
     currentWorkspace,
     setCurrentWorkspace,
     maybePreSelectedWorkspace,
     expandedNodes,
     setNodeAsExpanded,
     setNodeAsCollapsed,
     focusedEntry,
     setFocusedEntry,
     showError,
     refreshWorkspace
   }: CaptureFromUrlProps) => {

  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    getWorkspacesMetadata()
  }, [isOpen]);

  const maybeCaptureFromUrlViaQueryParamValue = useMemo(
    getMaybeCaptureFromUrlQueryParamValue,
    []
  );

  const [url, setUrl] = useState<string>(maybeCaptureFromUrlViaQueryParamValue ?? "");

  const workspace = currentWorkspace || maybePreSelectedWorkspace;

  const [saveAs, setSaveAs] = useState<string>("");

  useEffect(() => {
    if (maybeCaptureFromUrlViaQueryParamValue) {
      setIsOpen(true);
    }
  }, [maybeCaptureFromUrlViaQueryParamValue]);

  const {push} = useHistory();

  const parentEntry = focusedEntry || currentWorkspace?.rootNode;
  const parentFolder = parentEntry && isTreeNode(parentEntry) ? parentEntry : null;

  const isTargetFolderNameConflict = !!parentFolder?.children?.some(_ => _.name === saveAs);

  const isFormIncomplete = !url || !currentWorkspace || !saveAs || !parentFolder

  const onSubmit = (e: FormEvent) => {

    e.preventDefault();

    if (isFormIncomplete) {
      return console.error("Missing value", {
        url, currentWorkspace, saveAs, parentFolder
      });
    }

    captureFromUrl(currentWorkspace.id, {
      url,
      title: saveAs,
      parentFolderId: parentFolder.id,
    }).then(json => {
      console.log(json);
      push(`/workspaces/${currentWorkspace.id}`);
      setIsOpen(false);
    }).catch(e => {
      console.error(e);
      showError({
        type: AppActionType.APP_SHOW_ERROR,
        error: e,
        message: "Failed to capture from URL"
      });
    }).finally(() => {
      // ensure the target folder is expanded to show the new job
      setNodeAsExpanded(parentFolder);
      // refresh the workspace to show the new job
      refreshWorkspace(currentWorkspace.id);
      // clear fields ready for next use
      setUrl(""); setSaveAs("");
    });
  }

  return <>
    {withButton &&
      <button
        className='btn file-upload__button'
        onClick={() => setIsOpen(true)}
      >
        <MdGlobeIcon className='file-upload__icon'/>
        Capture video from URL
      </button>
    }
    <Modal isOpen={isOpen} dismiss={() => setIsOpen(false)}>
      <form className='form' onSubmit={onSubmit}>
        <h2 className='modal__title'>Capture video from URL</h2>

        <EuiCallOut title="BETA Phase" css={{marginBottom: "10px"}} size="s">
          For now, this feature will attempt to capture video from a URL (e.g. a YouTube link) and ingest into Giant.<br/>
          In the near future, it will also snapshot the page (both the html and as an image).
        </EuiCallOut>

        <div className='form__row'>
          <span className='form__label required-field'>URL</span>
          <input type="text"
                 autoFocus={!maybeCaptureFromUrlViaQueryParamValue}
                 value={url}
                 onChange={e => setUrl(e.target.value)}/>
        </div>

        <div className='form__row'>
          <span className='form__label required-field'>Workspace</span>
          <Select
            name='workspace-select'
            autoFocus
            options={workspacesMetadata.map(w => ({
              value: w.id,
              label: w.name
            }))}
            searchable
            clearable={false}
            isMulti={false}
            value={workspace ? {
              label: workspace.name,
              value: workspace.id
            } : null}
            onChange={selected => selected && setCurrentWorkspace(selected.value)}
          />
        </div>

        {currentWorkspace && currentWorkspace.rootNode.children.length > 0 && <div className='form__row'>
          <span className='form__label'>Folder</span>
          <div className='workspace__tree' style={{maxHeight: "calc(100vh - 590px)"}}>
            <TreeBrowser
              showColumnHeaders={false}
              rootId={currentWorkspace.rootNode.id}
              tree={currentWorkspace.rootNode.children}
              onFocus={entry => isTreeNode(entry) && setFocusedEntry(entry)}
              clearFocus={() => setFocusedEntry(null)}
              selectedEntries={focusedEntry && isTreeNode(focusedEntry) ? [focusedEntry] : []}
              focusedEntry={focusedEntry && isTreeNode(focusedEntry) ? focusedEntry : null}
              onMoveItems={() => {
              }} // can't move things in this view
              onContextMenu={() => {
              }} // can't rename things in this view
              onSelectLeaf={() => {
              }} // leaves are not valid targets to add to, so are not selectable
              onExpandLeaf={() => {
              }} // entire tree is in memory up-front, so no need for an expand leaf callback
              onClickColumn={() => {
              }} // only one column, don't allow reversing the sorting
              columnsConfig={{
                columns: [{
                  name: 'Name',
                  align: 'left',
                  render: (entry) =>
                    isWorkspaceNode(entry.data)
                      ? <>{entry.name || '--'} <FileAndFolderCounts {...entry.data} /></>
                      : <></>, // don't render leaves since they can't be selected
                  sort: (a, b) => a.name.localeCompare(b.name),
                  style: {},
                }],
                sortDescending: false,
                sortColumn: 'Name',
              }}
              expandedEntries={expandedNodes}
              onExpandNode={setNodeAsExpanded}
              onCollapseNode={setNodeAsCollapsed}
            />
          </div>
        </div>
        }

        <div className='form__row'>
          <span className='form__label required-field'>New folder name</span>
          <em>Capturing a URL into Giant will capture as much as possible from the page,
            so a new folder is required to keep everything together.</em>
          <input
            type='text'
            value={saveAs}
            onChange={e => setSaveAs(e.target.value)}
            style={{marginBottom: 0}}
          />
          {isTargetFolderNameConflict &&
            <div className="error-bar__warning" style={{padding: "5px"}}>A file or folder with this name already exists
              in the selected folder.</div>
          }
        </div>

        <div className='form__row'>
          <button type='submit' className='btn' disabled={isFormIncomplete}>
            Capture
          </button>
          {currentWorkspace && parentFolder && saveAs && (<>
            {" "} to <code>{`${displayRelativePath(currentWorkspace.rootNode, parentFolder.id)}${saveAs}`}</code>
          </>)}
        </div>

      </form>
    </Modal>
  </>
});
