import React from 'react';
import DownloadButton from './DownloadButton';
import DeleteButton from './DeleteButton';
import AddToWorkspaceModal from './AddToWorkspaceModal';
import { resourcePropType } from '../../types/Resource';

export default class ViewerActions extends React.Component {
    static propTypes = {
        resource: resourcePropType
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
                    <DeleteButton />
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
