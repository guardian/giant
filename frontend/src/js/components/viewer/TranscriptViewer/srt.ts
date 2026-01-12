export type TranscriptSegment = {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
};

const oneHourInSeconds = 3600;
const oneMinuteInSeconds = 60;
const oneSecondMilliseconds = 1000;

const timeSegmentToSeconds = (timeSegments: string[]): number => {
  return (
    parseInt(timeSegments[0]!) * oneHourInSeconds +
    parseInt(timeSegments[1]!) * oneMinuteInSeconds +
    parseInt(timeSegments[2]!) +
    parseInt(timeSegments[3]!) / oneSecondMilliseconds
  );
};

export const parseSRT = (srtText: string): TranscriptSegment[] => {
  const segments: TranscriptSegment[] = [];
  const blocks = srtText.trim().split("\n\n");

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3 || !lines[0] || !lines[1]) continue;

    const index = parseInt(lines[0]);
    // example time line: 00:00:03,000 --> 00:00:06,000
    const timeMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/,
    );

    if (!timeMatch || timeMatch.length < 9) continue;

    const startTime = timeSegmentToSeconds(timeMatch.slice(1, 5));

    const endTime = timeSegmentToSeconds(timeMatch.slice(5, 9));

    const text = lines.slice(2).join("\n");

    segments.push({ index, startTime, endTime, text });
  }

  return segments;
};

// TODO: Replace with library if we introduce any other time formatting
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / oneHourInSeconds);
  const minutes = Math.floor((seconds % oneHourInSeconds) / oneMinuteInSeconds);
  const secs = Math.floor(seconds % oneMinuteInSeconds);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};
