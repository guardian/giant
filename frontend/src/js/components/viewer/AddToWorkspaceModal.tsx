import React from 'react';
import { Resource } from '../../types/Resource';
import Modal from '../UtilComponents/Modal';
import Select from 'react-select';
import TreeBrowser from '../UtilComponents/TreeBrowser';
import { addResourceToWorkspace } from '../../services/WorkspaceApi';
import { displayRelativePath } from '../../util/workspaceUtils';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { getWorkspacesMetadata } from '../../actions/workspaces/getWorkspacesMetadata';
import { setNodeAsExpanded } from '../../actions/workspaces/setNodeAsExpanded';
import { setNodeAsCollapsed } from '../../actions/workspaces/setNodeAsCollapsed';
import { WorkspaceEntry, WorkspaceMetadata } from '../../types/Workspaces';
import { GiantState } from '../../types/redux/GiantState';
import { GiantDispatch } from '../../types/redux/GiantDispatch';
import { isTreeNode, TreeEntry, TreeNode } from '../../types/Tree';
import { ValueType } from 'react-select/src/types';
import { getWorkspace } from '../../actions/workspaces/getWorkspace';

interface PropsFromParent {
    resource: Resource,
    isOpen: boolean,
    dismissModal: () => void
}

type Props = ReturnType<typeof mapStateToProps>
    & ReturnType<typeof mapDispatchToProps>
    & PropsFromParent;

type State = {
    saveAs: string,
    selectedParentNode: TreeNode<WorkspaceEntry> | null
    workspaceId: string | null
}

class AddToWorkspaceModalUnconnected extends React.Component<Props, State> {

    state: State = {
        workspaceId: null,
        saveAs: '',
        selectedParentNode: null
    };

    componentDidMount() {
        this.props.getWorkspacesMetadata();
        this.componentDidMountOrUpdate();
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        this.componentDidMountOrUpdate(prevProps, prevState);
    }

    componentDidMountOrUpdate(prevProps?: Props, prevState?: State) {
        if ((!prevProps || this.props.resource.uri !== prevProps.resource.uri) && this.props.resource.parents.length > 0) {
            const parentUriParts = this.props.resource.parents[0].uri.split('/');
            const lastPart = parentUriParts[parentUriParts.length - 1];

            this.setState({
                saveAs: decodeURIComponent(lastPart),
            });
        }

        if (this.state.workspaceId) {
            if(prevState && prevState.workspaceId !== this.state.workspaceId) {
                this.props.getWorkspace(this.state.workspaceId);
            }
        }

        if (this.props.isOpen && !(prevProps && prevProps.isOpen)) {
            this.props.getWorkspacesMetadata();

            if(this.state.workspaceId) {
                this.props.getWorkspace(this.state.workspaceId);
            }
        }
    }

    onSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        let params = {};
        let icon = '';

        if (this.props.resource.type === 'email') {
            icon = 'email';
            params = {
                uri: this.props.resource.uri
            };
        } else if (this.props.resource.type === 'blob') {
            icon = 'document';
            params = {
                uri: this.props.resource.uri,
                mimeType: this.props.resource.mimeTypes.length > 1 ? 'multiple types detected' : this.props.resource.mimeTypes[0],
                size: this.props.resource.fileSize
            };
        }

        if (this.props.currentWorkspace) {
            const parentNode = this.state.selectedParentNode ?? this.props.currentWorkspace.rootNode;
            addResourceToWorkspace(this.props.currentWorkspace.id, parentNode.id, this.state.saveAs, icon, params)
                .then(() => this.props.dismissModal());
        }
    };

    workspaceSelection = () => {
        return this.props.workspacesMetadata.map(w => ({value: w.id, label: w.name}));
    };

    workspaceSelected = (selected: ValueType<{value: string, label: string}>): void => {
        const s = Array.isArray(selected) ? selected[0] : selected;
        this.setState({workspaceId: s.value});
    };

    onFocus = (entry: TreeEntry<WorkspaceEntry>) => {
        // don't allow focus if it's not a directory - an existing file is not a valid location to add to
        if (isTreeNode(entry)) {
            this.setState({selectedParentNode: entry});
        }
    };

    clearFocus = () => {
        if (this.props.currentWorkspace) {
            this.setState({selectedParentNode: null});
        }
    };

    renderTree = (workspace: WorkspaceMetadata, rootNode: TreeNode<WorkspaceEntry>) => {
        return (
            <div className='workspace__tree workspace__tree--fixed'>
                <TreeBrowser
                    showColumnHeaders={false}
                    rootId={rootNode.id}
                    tree={rootNode.children}
                    onFocus={this.onFocus}
                    clearFocus={this.clearFocus}
                    selectedEntries={this.state.selectedParentNode ? [this.state.selectedParentNode] : []}
                    focusedEntry={this.state.selectedParentNode ? this.state.selectedParentNode : null}
                    // can't move things in this view
                    onMoveItems={() => {}}
                    // can't rename things in this view
                    onContextMenu={() => {}}
                    // leaves are not valid targets to add to, so are not selectable
                    onSelectLeaf={() => {}}
                    // entire tree is in memory up-front, so no need for an expand leaf callback
                    onExpandLeaf={() => {}}
                    // only one column, don't allow reversing the sorting
                    onClickColumn={() => {}}
                    columnsConfig={{
                        columns: [{
                            name: 'Name',
                            align: 'left',
                            render: (entry) => <React.Fragment>{entry.name || '--'}</React.Fragment>,
                            sort: (a, b) => a.name.localeCompare(b.name),
                            style: {},
                        }],
                        sortDescending: false,
                        sortColumn: 'Name',
                    }}
                    expandedEntries={this.props.expandedNodes}
                    onExpandNode={this.props.setNodeAsExpanded}
                    onCollapseNode={this.props.setNodeAsCollapsed}
                />
            </div>
        );
    };

    renderPrettyPath = () => {
        if (this.props.currentWorkspace) {
            const prefix = this.state.selectedParentNode
                ? displayRelativePath(this.props.currentWorkspace.rootNode, this.state.selectedParentNode.id)
                : `${this.props.currentWorkspace.name}/`;

            return prefix + this.state.saveAs;
        }

        return false;
    };

    render() {
        return (
            <Modal isOpen={this.props.isOpen} dismiss={this.props.dismissModal}>
                <form className='form'  onSubmit={this.onSubmit}>
                    <h2 className='modal__title'>Add to Workspace</h2>

                    <div className='form__row'>
                        <span className='form__label required-field'>Workspace</span>
                        {/* TODO probably make this have custom rendering to make it obvious what's personal and what's public*/}
                        <Select
                            name='workspace-select'
                            value={this.props.currentWorkspace ?  {
                                value: this.props.currentWorkspace.id,
                                label: this.props.currentWorkspace.name,
                            } : null}
                            autofocus
                            options={this.workspaceSelection()}
                            searchable={true}
                            clearable={false}
                            onChange={this.workspaceSelected}
                        />
                    </div>

                    <div className='form__row'>
                        <span className='form__label required-field'>Folder</span>
                        {
                            this.props.currentWorkspace
                            ?
                            this.renderTree(this.props.currentWorkspace, this.props.currentWorkspace.rootNode)
                            :
                            <div className='workspace__tree workspace__tree--fixed'>
                                <p className='centered diminish'>Select a workspace...</p>
                            </div>
                        }
                    </div>


                    <div className='form__row'>
                        <span className='form__label required-field'>Save As</span>
                        <input type='text'
                                onChange={(e) => this.setState({saveAs: e.target.value})}
                                value={this.state.saveAs}/>
                    </div>

                    <div className='form__row'>
                        <span className='form__label'>Name</span>
                        {this.renderPrettyPath()}
                    </div>

                    <div className='form__row'>
                        <button type='submit' className='btn' disabled={!this.state.saveAs || !this.props.currentWorkspace}>
                            Save
                        </button>
                    </div>
                </form>
            </Modal>
        );
    }
}

function mapStateToProps(state: GiantState) {
    return {
        workspacesMetadata: state.workspaces.workspacesMetadata,
        currentWorkspace: state.workspaces.currentWorkspace,
        expandedNodes: state.workspaces.expandedNodes,
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        getWorkspacesMetadata: bindActionCreators(getWorkspacesMetadata, dispatch),
        getWorkspace: bindActionCreators(getWorkspace, dispatch),
        setNodeAsExpanded: bindActionCreators(setNodeAsExpanded, dispatch),
        setNodeAsCollapsed: bindActionCreators(setNodeAsCollapsed, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddToWorkspaceModalUnconnected);
