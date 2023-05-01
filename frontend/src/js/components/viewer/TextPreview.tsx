import React, { useState } from 'react';
import TextPopover from './TextPopover';
import { CommentHighlighter } from './CommentHighlighter';
import { filterCommentsInView } from '../../util/commentUtils';
import { ResourceRange, Highlight, CommentData } from '../../types/Resource';
import sortBy from 'lodash/sortBy';
import { CommentPanel } from './CommentPanel/CommentPanel';
import { PartialUser } from '../../types/User';

function getExistingCommentHighlights(comments: CommentData[], view?: string): Highlight[] {
    return filterCommentsInView(comments, view).map(({ id, anchor }) => {
        return {
            id,
            type: 'comment',
            range: {
                startCharacter: anchor!.startCharacter,
                endCharacter: anchor!.endCharacter
            }
        }
    });
}

function getNewCommentHighlight(selection?: ResourceRange): Highlight[] {
    return selection ?
        [{ id: 'new-comment', type: 'comment', range: { startCharacter: selection.startCharacter, endCharacter: selection.endCharacter }}] :
        [];
}

type Props = {
    uri: string,
    currentUser: PartialUser,
    view: string,
    text: string,
    comments: CommentData[],
    searchHighlights: Highlight[],
    selection?: ResourceRange,
    preferences: {
        showSearchHighlights?: boolean,
        showCommentHighlights?: boolean
    },
    getComments: (uri: string) => void,
    setSelection: (selection?: Selection) => void
}

export type HighlightRenderedPositions = {
    [id: string]: { top: number }
}

export function TextPreview({ uri, currentUser, view, text, comments, searchHighlights, selection, preferences, getComments, setSelection }: Props) {
    const commentHighlightsToDisplay = preferences.showCommentHighlights ? getExistingCommentHighlights(comments, view) : [];
    const newCommentHighlight = getNewCommentHighlight(selection);
    const searchHighlightsToDisplay: Highlight[] = preferences.showSearchHighlights ? searchHighlights : [];

    const unsortedHighlights = commentHighlightsToDisplay.concat(newCommentHighlight).concat(searchHighlightsToDisplay);
    const sortedHighlights = sortBy(unsortedHighlights, ({ range: {  startCharacter } }) => startCharacter);

    const [highlightRenderedPositions, setHighlightRenderedPosition] = useState<HighlightRenderedPositions>({});

    const [focusedCommentId, setFocusedCommentId] = useState<string | undefined>(undefined);
    // We match the behaviour of Google Docs where the comments do not re-arrange themselves back to the original
    // layout once the user de-selects but rather maintain the layout as if the last comment were still selected
    const [previousFocusedCommentId, setPreviousFocusedCommentId] = useState<string | undefined>(undefined);

    function focusComment(id?: string) {
        setFocusedCommentId(id);
        setPreviousFocusedCommentId(focusedCommentId);
    }

    return (
        <div className='document__preview' onClick={() => focusComment(undefined)}>
            <div className='document__preview__text-wrapper' data-selectable-text-preview>
                <CommentHighlighter
                    text={text}
                    highlights={sortedHighlights}
                    focusedId={focusedCommentId}
                    focusComment={focusComment}
                    onHighlightMount={(id: string, top: number) => {
                        setHighlightRenderedPosition((before: HighlightRenderedPositions) => {
                            return { ...before, [id]: { top } };
                        });
                    }}
                />
            </div>
            <TextPopover target='data-selectable-text-preview' allowComments={preferences.showCommentHighlights || false} />
            {preferences.showCommentHighlights ? <CommentPanel
                uri={uri}
                view={view}
                currentUser={currentUser}
                comments={comments}
                selection={selection}
                getComments={getComments}
                highlightRenderedPositions={highlightRenderedPositions}
                clearSelection={() => setSelection(undefined)}
                focusedCommentId={focusedCommentId}
                previousFocusedCommentId={previousFocusedCommentId}
                focusComment={focusComment}
            /> : false}
        </div>
    );
}
