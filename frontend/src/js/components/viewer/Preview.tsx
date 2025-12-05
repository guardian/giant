import React from 'react';
import ErrorIcon from 'react-icons/lib/md/error';

import { EmbeddedPdfViewer } from './EmbeddedPdfViewer';
import { getPreviewType, getPreviewImage, fetchPreviewLink } from '../../services/PreviewApi';
import { ProgressAnimation } from '../UtilComponents/ProgressAnimation';

interface PreviewErrorProps {
    message: string;
}

function LoadingPreview(): React.ReactElement {
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

function PreviewError({ message }: PreviewErrorProps): React.ReactElement {
    return <div className='preview__dialog preview__dialog--error'>
        <ErrorIcon className='error-bar__icon' />
        <span>{message}</span>
    </div>;
}

interface PreviewProps {
    fingerprint: string;
}

interface PreviewState {
    currentFingerprint: string | null;
    doc: any; // Could be string or object depending on the preview type
    mimeType: string | null;
    error: string | null;
}

export class Preview extends React.Component<PreviewProps, PreviewState> {
    baseState: PreviewState = {
        currentFingerprint: null,
        doc: null,
        mimeType: null,
        error: null
    };

    state: PreviewState = this.baseState;

    componentDidUpdateOrMount(): void {
        const { fingerprint } = this.props;

        if (fingerprint !== this.state.currentFingerprint) {
            this.setState(Object.assign({}, this.baseState, { currentFingerprint: fingerprint }));

            getPreviewType(fingerprint).then((mimeType: string | null) => {
                switch(mimeType) {
                    case 'image/jpeg':
                    case 'image/gif':
                    case 'image/png':
                        return getPreviewImage(fingerprint).then((doc: any) => {
                            if (this.state.currentFingerprint === fingerprint) {
                                this.setState({ doc, mimeType });
                            }
                        });

                    default:
                        return fetchPreviewLink(fingerprint).then((doc: any) => {
                            if (this.state.currentFingerprint === fingerprint) {
                                this.setState({ doc, mimeType });
                            }
                        });
                }
            }).catch((e: any) => {
                this.setState({ error: String(e) });
            });
        }
    }

    componentDidMount(): void {
        this.componentDidUpdateOrMount();
    }

    componentDidUpdate(): void {
        this.componentDidUpdateOrMount();
    }

    onMediaError = (): void => {
        this.setState({ error: `Cannot preview unsupported format ${this.state.mimeType}`});
    }

    render(): React.ReactElement {
        if(this.state.error) {
            return <PreviewError message={this.state.error} />;
        }

        if(this.state.doc) {
            if(this.state.mimeType && this.state.mimeType.startsWith('image/')) {
                return <img className='viewer__preview-img' alt='Preview' {...this.state.doc} />;
            }

            if(this.state.mimeType === 'application/pdf') {
                return <EmbeddedPdfViewer doc={this.state.doc} />;
            }

            if(this.state.mimeType && this.state.mimeType.startsWith('video/')) {
                return <video className="viewer__preview-video" src={this.state.doc} controls onError={this.onMediaError} />;
            }

            if(this.state.mimeType && this.state.mimeType.startsWith('audio/')) {
                return <audio className="viewer__preview-audio" src={this.state.doc} controls onError={this.onMediaError} />;
            }
        }

        return <LoadingPreview />;
    }
}
