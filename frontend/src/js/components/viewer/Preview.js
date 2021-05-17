import React from 'react';
import PropTypes from 'prop-types';
import ErrorIcon from 'react-icons/lib/md/error';

import { EmbeddedPdfViewer } from './EmbeddedPdfViewer';
import { getPreviewType, getPreviewImage, fetchPreviewLink } from '../../services/PreviewApi';
import { ProgressAnimation } from '../UtilComponents/ProgressAnimation';

function LoadingPreview() {
    return <div className='preview__dialog'>
        <div>Loading Preview</div>
        <div className='preview__dialog__loading'>
            <ProgressAnimation />
        </div>
        <p>
            <small>This will take a while the first time a document is viewed</small>
        </p>
    </div>;
}

function PreviewError({ message }) {
    return <div className='preview__dialog preview__dialog--error'>
        <ErrorIcon className='error-bar__icon' />
        <span>{message}</span>
    </div>;
}

PreviewError.propTypes = { message: PropTypes.string.isRequired };

export class Preview extends React.Component {
    static propTypes = {
        fingerprint: PropTypes.string.isRequired
    }

    baseState = {
        currentFingerprint: null,
        doc: null,
        mimeType: null,
        error: null
    }

    state = this.baseState

    componentDidUpdateOrMount() {
        const { fingerprint } = this.props;

        if (fingerprint !== this.state.currentFingerprint) {
            this.setState(Object.assign({}, this.baseState, { currentFingerprint: fingerprint }));

            getPreviewType(fingerprint).then(mimeType => {
                switch(mimeType) {
                    case 'image/jpeg':
                    case 'image/gif':
                    case 'image/png':
                        return getPreviewImage(fingerprint).then(doc => {
                            if (this.state.currentFingerprint === fingerprint) {
                                this.setState({ doc, mimeType });
                            }
                        });

                    default:
                        return fetchPreviewLink(fingerprint).then(doc => {
                            if (this.state.currentFingerprint === fingerprint) {
                                this.setState({ doc, mimeType });
                            }
                        });
                }
            }).catch(e => {
                this.setState({ error: String(e) });
            });
        }
    }

    componentDidMount() {
        this.componentDidUpdateOrMount();
    }

    componentDidUpdate() {
        this.componentDidUpdateOrMount();
    }

    onMediaError = () => {
        this.setState({ error: `Cannot preview unsupported format ${this.state.mimeType}`});
    }

    render() {
        if(this.state.error) {
            return <PreviewError message={this.state.error} />;
        }

        if(this.state.doc) {
            if(this.state.mimeType.startsWith('image/')) {
                return <img className='viewer__preview-img' alt='Preview' {...this.state.doc} />;
            }

            if(this.state.mimeType === 'application/pdf') {
                return <EmbeddedPdfViewer doc={this.state.doc} />;
            }

            if(this.state.mimeType.startsWith('video/')) {
                return <video className="viewer__preview-video" src={this.state.doc} controls onError={this.onMediaError} />;
            }

            if(this.state.mimeType.startsWith('audio/')) {
                return <audio className="viewer__preview-audio" src={this.state.doc} controls onError={this.onMediaError} />;
            }
        }

        return <LoadingPreview />;
    }
}
