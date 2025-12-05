import React, {useEffect, useState} from 'react';
import ErrorIcon from 'react-icons/lib/md/error';

import { EmbeddedPdfViewer } from './EmbeddedPdfViewer';
import { getPreviewType, getPreviewImage, fetchPreviewLink } from '../../services/PreviewApi';
import { ProgressAnimation } from '../UtilComponents/ProgressAnimation';
import {Resource} from "../../types/Resource";
import {TranscriptViewer} from "./TranscriptViewer/TranscriptViewer";

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
    resource: Resource;
}

export function Preview({ resource }: PreviewProps): React.ReactElement {
    const [currentFingerprint, setCurrentFingerprint] = useState<string | null>(null);
    const [doc, setDoc] = useState<any>(null);
    const [mimeType, setMimeType] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const transcriptsAvailable = resource.vttTranscript && Object.keys(resource.vttTranscript).length > 0

    const onMediaError = (mimeType: string): void =>
        setError(`Cannot preview unsupported format ${mimeType}`);


    useEffect(() => {
        const fingerprint = resource.uri;

        if (fingerprint !== currentFingerprint) {
            // Reset state
            setCurrentFingerprint(fingerprint);
            setDoc(null);
            setMimeType(null);
            setError(null);

            getPreviewType(fingerprint).then((mimeType: string | null) => {
                switch(mimeType) {
                    case 'image/jpeg':
                    case 'image/gif':
                    case 'image/png':
                        return getPreviewImage(fingerprint).then((doc: any) => {
                            if (fingerprint === resource.uri) {
                                setDoc(doc);
                                setMimeType(mimeType);
                            }
                        });

                    default:
                        return fetchPreviewLink(fingerprint).then((doc: any) => {
                            if (fingerprint === resource.uri) {
                                setDoc(doc);
                                setMimeType(mimeType);
                            }
                        });
                }
            }).catch((e: any) => {
                setError(String(e));
            });
        }
    }, [resource.uri, currentFingerprint]);

    if(error) {
        return <PreviewError message={error} />;
    }

    if(doc) {
        if(mimeType && mimeType.startsWith('image/')) {
            return <img className='viewer__preview-img' alt='Preview' {...doc} />;
        }

        if(mimeType === 'application/pdf') {
            return <EmbeddedPdfViewer doc={doc} />;
        }

        if(mimeType && mimeType.startsWith('video/')) {
            if (transcriptsAvailable && resource.vttTranscript) {
                return <TranscriptViewer transcripts={resource.vttTranscript} mediaUrl={doc} mediaType={'video'} />
            }
            return <video className="viewer__preview-video" src={doc} controls onError={() => onMediaError(mimeType)} />;
        }

        if(mimeType && mimeType.startsWith('audio/')) {
            if (transcriptsAvailable && resource.vttTranscript) {
                console.log("let's go")
                return <TranscriptViewer transcripts={resource.vttTranscript} mediaUrl={doc} mediaType={'audio'} />
            }
            return <audio className="viewer__preview-audio" src={doc} controls onError={() => onMediaError(mimeType)} />;
        }
    }

    return <LoadingPreview />;
}
