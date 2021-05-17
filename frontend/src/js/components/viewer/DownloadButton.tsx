import React, { useState } from 'react';
import { GiantState } from '../../types/redux/GiantState';
import { connect } from 'react-redux';
import { DownloadModal } from './DownloadModal';
import { Resource } from '../../types/Resource';

function DownloadButton({ resource, hideDownloadButton }: { resource: Resource | null, hideDownloadButton: boolean }) {
    const [modalOpen, setModalOpen] = useState(false);

    if (hideDownloadButton || !resource) {
        /*
            NB: hideDownloadButton is discouraging the user to download files rather than a proper security feature
            to disable them from doing it entirely. The rationale is that it makes Giant safer for the average user
            to use on an unmanaged machine as they cannot habitually download each document they find for easier reading.
        */
       return null;
    }

    return <React.Fragment>
        <DownloadModal
            resource={resource}
            isOpen={modalOpen}
            dismissModal={() => setModalOpen(false)}
        />
        <button className="btn" onClick={() => setModalOpen(true)}>
            Download
        </button>
    </React.Fragment>;
}

function mapStateToProps(state: GiantState) {
    return {
        resource: state.resource,
        hideDownloadButton: state.app.config.hideDownloadButton
    };
}

export default connect(mapStateToProps)(DownloadButton);
