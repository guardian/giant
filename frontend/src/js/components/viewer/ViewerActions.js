import React from 'react';
import DownloadButton from './DownloadButton';
import DeleteButton from './DeleteButtonModal';
import AddToWorkspaceModal from './AddToWorkspaceModal';
import { resourcePropType } from '../../types/Resource';
import PropTypes from 'prop-types';
import { deleteBlob, deleteBlobForAdmin } from '../../services/BlobApi';

export default class ViewerActions extends React.Component {
    static propTypes = {
        resource: resourcePropType,
        isAdmin: PropTypes.bool,
        disableDelete: PropTypes.bool,
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

                    <DeleteButton deleteBlob={deleteBlob} />

                    {!this.props.disableDelete && this.props.isAdmin && this.props.resource && <DeleteButton deleteBlob={deleteBlobForAdmin} buttonTitle='Admin delete' />  }

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
