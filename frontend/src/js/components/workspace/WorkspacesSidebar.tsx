import React from 'react';
import sortBy from 'lodash/sortBy';

import CreateWorkspaceModal from './CreateWorkspaceModal';
import Modal from '../UtilComponents/Modal';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { getWorkspacesMetadata } from '../../actions/workspaces/getWorkspacesMetadata';
import WorkspacesSidebarItem from './WorkspacesSidebarItem';
import { GiantDispatch } from '../../types/redux/GiantDispatch';
import { GiantState } from '../../types/redux/GiantState';
import { RouteComponentProps } from 'react-router-dom';
import { WorkspaceMetadata } from '../../types/Workspaces';

type Props = ReturnType<typeof mapStateToProps>
    & ReturnType<typeof mapDispatchToProps>
    & RouteComponentProps<{id: string}>;

type State = {
    modalOpen: boolean,
    myWorkspaces: WorkspaceMetadata[],
    sharedWorkspaces: WorkspaceMetadata[],
    publicWorkspaces: WorkspaceMetadata[],
}

class WorkspacesSidebarUnconnected extends React.Component<Props, State> {
    componentDidMount() {
        this.props.getWorkspacesMetadata();
    }

    UNSAFE_componentWillReceiveProps(props: Props) {
        if (props.workspacesMetadata !== this.props.workspacesMetadata) {
            const workspacesMetadata = props.workspacesMetadata || [];
            const currentUser = props.currentUser;

            if (!currentUser) {
                return;
            }

            const selectedWorkspaceId = localStorage.getItem('selectedWorkspaceId');
            const selectedWorkspaceExists = props.workspacesMetadata && !!props.workspacesMetadata.find(workspace => workspace.id === selectedWorkspaceId);
            const urlHasWorkspaceId = !!this.props.match.params.id;
            // We want to redirect to workspace stored in localStorage if the workspace stored in there exists
            // and if the url we accessing does not already contain a workspace id
            if (selectedWorkspaceId && selectedWorkspaceExists && !urlHasWorkspaceId) {
                this.props.history.push(`/workspaces/${selectedWorkspaceId}`)
            }
            if (selectedWorkspaceId && !selectedWorkspaceExists) {
                localStorage.removeItem('selectedWorkspaceId');
            }

            this.setState({
                myWorkspaces: sortBy(workspacesMetadata.filter(w =>
                    !w.isPublic && w.owner.username === currentUser.username
                ), w => w.name.toLowerCase()),
                sharedWorkspaces: sortBy(workspacesMetadata.filter(w =>
                    !w.isPublic && w.owner.username !== currentUser.username
                ), w => w.name.toLowerCase()),
                publicWorkspaces: sortBy(workspacesMetadata.filter(w => w.isPublic), w => w.name.toLowerCase()),
            });
        }
    }

    state = {
        modalOpen: false,
        myWorkspaces: [],
        sharedWorkspaces: [],
        publicWorkspaces: [],
    };

    openModal = () => this.setState({modalOpen: true});

    dismissModal = () => {
        this.setState({modalOpen: false});
        this.props.getWorkspacesMetadata();
    };

    renderSidebarItems = (workspaces: WorkspaceMetadata[]) => workspaces.map(w =>
        <WorkspacesSidebarItem
            selectedWorkspaceId={this.props.match.params.id}
            linkedToWorkspaceId={w.id}
            linkedToWorkspaceName={w.name}
        />
    )

    render() {
        if(!this.props.currentUser) {
            return false;
        }

        const noWorkspacesMessage =
            <div className='sidebar__item'>
                <div className='sidebar__item__text sidebar__item__text--disabled'>no workspaces</div>
            </div>;

        return (
            <div className='sidebar'>
                <div className='sidebar__group'>
                    <div className='sidebar__title'>Owned by me</div>
                    {this.state.myWorkspaces.length !== 0 ?
                        this.renderSidebarItems(this.state.myWorkspaces)
                        : noWorkspacesMessage
                    }
                    <button className='btn btn--primary sidebar__button' onClick={this.openModal}>New Workspace</button>
                    <Modal isOpen={this.state.modalOpen} dismiss={this.dismissModal}>
                        <CreateWorkspaceModal onComplete={this.dismissModal} />
                    </Modal>
                </div>
                {this.state.sharedWorkspaces.length !== 0 ?
                    <div className='sidebar__group'>
                        <div className='sidebar__title'>Shared with me</div>
                        {this.renderSidebarItems(this.state.sharedWorkspaces)}
                    </div> : null
                }
                {this.state.publicWorkspaces.length !== 0 ?
                    <div className='sidebar__group'>
                        <div className='sidebar__title'>Public</div>
                        {this.renderSidebarItems(this.state.publicWorkspaces)}
                    </div> : null
                }
            </div>
        );
    }
}

function mapStateToProps(state: GiantState) {
    return {
        workspacesMetadata: state.workspaces.workspacesMetadata,
        currentUser: state.auth.token?.user,
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        getWorkspacesMetadata: bindActionCreators(getWorkspacesMetadata, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(WorkspacesSidebarUnconnected);
