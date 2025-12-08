import React, { useRef, useState, useEffect } from 'react';
import { Message, Dropdown } from 'semantic-ui-react';
import {formatTime, parseSRT, TranscriptSegment} from "./srt";
import {HighlightableText} from "../../../types/Resource";

type TranscriptViewerProps = {
    transcripts: {
        [lang: string]: HighlightableText
    };
    mediaUrl: string | null;
    mediaType: 'audio' | 'video';
};

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
                                                                      transcripts,
    mediaUrl,
    mediaType
}) => {
    const mediaRef = useRef<HTMLVideoElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
    const [segments, setSegments] = useState<TranscriptSegment[]>([]);
    const [language, setLanguage] = useState<string | null>(Object.keys(transcripts)[0] || null);
    const activeSegmentRef = useRef<HTMLDivElement>(null);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        if (transcripts && language) {
            const parsed = parseSRT(transcripts[language].contents);
            setSegments(parsed);
        }
    }, [transcripts, language]);

    useEffect(() => {
        const currentMediaRef = mediaRef.current;
        const handleTimeUpdate = () => {
            if (currentMediaRef) {
                setCurrentTime(currentMediaRef.currentTime);
            }
        };
        currentMediaRef?.addEventListener('timeupdate', handleTimeUpdate);

        return () =>
            currentMediaRef?.removeEventListener('timeupdate', handleTimeUpdate);
    }, [mediaUrl]);

    useEffect(() => {
        // Find the active segment based on current time
        const activeIndex = segments.findIndex(
            (seg) => currentTime >= seg.startTime && currentTime < seg.endTime,
        );
        setActiveSegmentIndex(activeIndex !== -1 ? activeIndex : null);

        // Auto-scroll to active segment within the transcript container only
        if (
            activeSegmentRef.current &&
            transcriptContainerRef.current &&
            activeIndex !== -1
        ) {
            const container = transcriptContainerRef.current;
            const segment = activeSegmentRef.current;

            // Calculate the position to scroll to (center the segment in the container)
            const containerHeight = container.clientHeight;
            const segmentTop = segment.offsetTop;
            const segmentHeight = segment.clientHeight;
            const scrollPosition =
                segmentTop - containerHeight / 2 + segmentHeight / 2;

            container.scrollTo({
                top: scrollPosition,
                behavior: 'smooth',
            });
        }
    }, [currentTime, segments]);

    const handleSegmentClick = (segment: TranscriptSegment) => {
        if (mediaRef.current) {
            mediaRef.current.currentTime = segment.startTime;
            mediaRef.current.play();
        }
    };

    return (
        <div className="transcript-viewer">
            <div className="transcript-viewer__left">
                {mediaUrl ? (
                    <div className="transcript-viewer__media-container">
                        {mediaType === 'audio' ? (
                            <audio
                                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                                controls
                                className="transcript-viewer__audio"
                                src={mediaUrl}
                            >
                                Your browser does not support the audio element.
                            </audio>
                        ) : (
                            <video
                                ref={mediaRef}
                                controls
                                className="transcript-viewer__video"
                                src={mediaUrl}
                            >
                                Your browser does not support the video element.
                            </video>
                        )}
                    </div>
                ) : (
                    <Message info>
                        <Message.Header>Media not available</Message.Header>
                        <p>The source media file is not available for playback</p>
                    </Message>
                )}
            </div>

            <div className="transcript-viewer__right">
                <div className="transcript-viewer__transcript-container">
                    <div className="transcript-viewer__header">
                        <h2>Transcript</h2>
                        {Object.keys(transcripts).length > 1 && (
                            <div className="transcript-viewer__language-selector">
                                <label className="transcript-viewer__language-label">
                                    Transcript language:
                                </label>
                                <Dropdown
                                    selection
                                    value={language || ''}
                                    options={Object.keys(transcripts).map(lang => ({
                                        key: lang,
                                        text: lang,
                                        value: lang
                                    }))}
                                    onChange={(_, data) => setLanguage(data.value as string)}
                                    className="transcript-viewer__language-dropdown"
                                />
                            </div>
                        )}
                    </div>

                    <div
                        ref={transcriptContainerRef}
                        className="transcript-viewer__segments"
                    >
                        {segments.length > 0 ? (
                            segments.map((segment, index) => (
                                <div
                                    key={segment.index}
                                    ref={activeSegmentIndex === index ? activeSegmentRef : null}
                                    className={`transcript-viewer__segment ${
                                        activeSegmentIndex === index
                                            ? 'transcript-viewer__segment--active'
                                            : ''
                                    }`}
                                    onClick={() => handleSegmentClick(segment)}
                                >
                                    <span className="transcript-viewer__timestamp">
                                        {formatTime(segment.startTime)}
                                    </span>
                                    <p className="transcript-viewer__text">
                                        {segment.text}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="transcript-viewer__no-segments">
                                <p>No transcript available</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
