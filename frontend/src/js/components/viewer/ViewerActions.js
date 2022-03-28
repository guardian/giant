import React from 'react';
import DownloadButton from './DownloadButton';
import DeleteButton from './DeleteButton';
import AddToWorkspaceModal from './AddToWorkspaceModal';
import { resourcePropType } from '../../types/Resource';
import {permissionsPropType} from "../../types/User";

export default class ViewerActions extends React.Component {
    static propTypes = {
        resource: resourcePropType,
        isAdmin: Boolean,
    }

    state = {
        action: '',
        downloadModalOpen: false,
        addToWorkspaceModalOpen: false
    }

    render() {
        return (
            <div className='sidebar__list-item'>
                <div className='btn-group btn-group--left'>
                    <button className="btn" onClick={() => this.setState({addToWorkspaceModalOpen: true})}>
                        Add to Workspace
                    </button>
                    <DownloadButton />
                    <DeleteButton isAdmin={this.props.isAdmin} />
                </div>

                <AddToWorkspaceModal
                    resource={this.props.resource}
                    isOpen={this.state.addToWorkspaceModalOpen}
                    dismissModal={() => this.setState({addToWorkspaceModalOpen: false})}
                />
            </div>
        );
    }
}
