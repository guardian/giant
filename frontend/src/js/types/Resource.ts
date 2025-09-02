import PropTypes from 'prop-types';
import { PartialUser } from './User';

export type ProcessingStage =
    { type: 'processing', tasksRemaining: number, note?: string } |
    { type: 'processed' } |
    { type: 'failed' };

export type BasicResource = {
    uri: string,
    type: 'file' | 'directory' | 'ingestion' | 'collection' | 'blob' | 'email',
    isExpandable: boolean,
    processingStage: ProcessingStage
    display?: string,
    children?: BasicResource[],
    parents?: BasicResource[]
};

export type BasicResourceWithSingleBlobChild = BasicResource & {
    type: 'file',
    children: [BasicResource]
};

export const basicResourcePropType = PropTypes.shape({
    uri: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired
});

export type HighlightType = 'search_result' | 'comment';

export type Highlight = {
    id: string,
    type: HighlightType,
    range: ResourceRange
}

export type ResourceRange = {
    startCharacter: number,
    endCharacter: number
}

export type CommentData = {
    // from the server
    id: string;
    author: PartialUser;
    postedAt: number;
    text: string;
    anchor?: CommentAnchor;
}

export type CommentAnchor =
    { type: "text", startCharacter: number, endCharacter: number } |
    { type: "ocr", language: string, startCharacter: number, endCharacter: number };

export type HighlightableText = {
    contents: string,
    highlights: Highlight[]
}

export type Resource = BasicResource & {
    extracted: boolean,
    mimeTypes: string[],
    fileSize: number,
    parents: BasicResource[],
    children: BasicResource[],
    comments: CommentData[],
    selection?: ResourceRange,
    text: HighlightableText,
    ocr?: {
        [lang: string]: HighlightableText
    },
    transcript?: {
        [lang: string]: HighlightableText
    }
    transcriptVtt?: {
        [lang: string]: HighlightableText
    }
}

export const resourcePropType = PropTypes.shape({
    uri: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    parents: PropTypes.arrayOf(basicResourcePropType).isRequired,
    children: PropTypes.arrayOf(basicResourcePropType).isRequired
});

