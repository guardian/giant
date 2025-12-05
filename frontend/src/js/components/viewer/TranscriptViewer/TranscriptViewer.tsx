import React, { useRef, useState, useEffect } from 'react';
import {formatTime, parseSRT, TranscriptSegment} from "./srt";

type TranscriptViewerProps = {
    srt: string;
    mediaUrl: string | null;
    filename: string;
    mediaType: 'audio' | 'video';
};

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
                                                                      srt,
                                                                      mediaUrl,
                                                                      filename,
    mediaType
                                                                  }) => {
    const mediaRef = useRef<HTMLVideoElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(
        null,
    );
    const [segments, setSegments] = useState<TranscriptSegment[]>([]);
    const activeSegmentRef = useRef<HTMLDivElement>(null);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (srt) {
            const parsed = parseSRT(srt);
            setSegments(parsed);
        }
    }, [srt]);

    useEffect(() => {
        const handleTimeUpdate = () => {
            if (mediaRef.current) {
                setCurrentTime(mediaRef.current.currentTime);
            }
        };
        mediaRef.current?.addEventListener('timeupdate', handleTimeUpdate);

        return () =>
            mediaRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Media Player - Order 1 on mobile, 1 on desktop */}
            <div className="order-1">
                {mediaUrl ? (
                    <div className="bg-black rounded-lg overflow-hidden">
                        {mediaType === 'audio'? (
                            <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
                                <div className="text-white text-center mb-4">
                                    <svg
                                        className="w-24 h-24 mx-auto mb-4 opacity-50"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                                    </svg>
                                    <p className="text-lg font-medium">{filename}</p>
                                </div>
                                <audio
                                    ref={mediaRef as React.RefObject<HTMLAudioElement>}
                                    controls
                                    className="w-full"
                                    src={mediaUrl}
                                >
                                    Your browser does not support the audio element.
                                </audio>
                            </div>
                        ) : (
                            <video ref={mediaRef} controls className="w-full" src={mediaUrl}>
                                Your browser does not support the video element.
                            </video>
                        )}
                    </div>
                ) : (
                    <div className="bg-gray-100 rounded-lg p-8 text-center min-h-[300px] flex items-center justify-center">
                        <div>
                            <p className="text-gray-600 mb-2">Media not available</p>
                            <p className="text-sm text-gray-500">
                                The source media file is not available for playback
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Interactive Transcript - Order 2 on mobile, 2 on desktop */}
            <div className="order-2">
                <h3 className="font-semibold text-gray-900 mb-3">
                    Interactive Transcript
                </h3>
                <div
                    ref={transcriptContainerRef}
                    className="bg-white border border-gray-200 rounded-lg max-h-[600px] overflow-y-auto"
                >
                    {segments.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {segments.map((segment, index) => (
                                <div
                                    key={segment.index}
                                    ref={activeSegmentIndex === index ? activeSegmentRef : null}
                                    className={`p-3 cursor-pointer transition-colors ${
                                        activeSegmentIndex === index
                                            ? 'bg-blue-50 border-l-4 border-blue-500'
                                            : 'hover:bg-gray-50'
                                    }`}
                                    onClick={() => handleSegmentClick(segment)}
                                >
                                    <div className="flex items-start gap-3">
										<span
                                            className={`text-xs font-mono mt-0.5 ${
                                                activeSegmentIndex === index
                                                    ? 'text-blue-600 font-semibold'
                                                    : 'text-gray-500'
                                            }`}
                                        >
											{formatTime(segment.startTime)}
										</span>
                                        <p
                                            className={`text-sm flex-1 ${
                                                activeSegmentIndex === index
                                                    ? 'text-gray-900 font-medium'
                                                    : 'text-gray-700'
                                            }`}
                                        >
                                            {segment.text}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            <p>No timestamped transcript available</p>
                            <p className="text-sm mt-2">
                                The transcript text is available in the section to the left
                            </p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};
