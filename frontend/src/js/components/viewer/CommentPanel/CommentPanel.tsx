import React, {FC, useState} from "react";

import { Comment } from 'semantic-ui-react';
import hdate from 'human-date';
import { postComment, deleteComment } from "../../../services/CommentsApi";
import { PartialUser } from "../../../types/User";
import { ResourceRange, CommentData, CommentAnchor } from "../../../types/Resource";
import { AddComment } from "./AddComment";
import { filterCommentsInView } from "../../../util/commentUtils";
import { HighlightRenderedPositions } from "../TextPreview";

import { sortBy, sumBy, takeWhile } from 'lodash';

type CommentPanelProps = {
  uri: string;
  view: string;
  currentUser: PartialUser;
  comments: CommentData[],
  selection?: ResourceRange,
  highlightRenderedPositions: HighlightRenderedPositions,
  focusedCommentId?: string,
  previousFocusedCommentId?: string,
  getComments: (uri: string) => void,
  clearSelection: () => void,
  focusComment: (id: string) => void
}

function selectionToAnchor(view: string, selection: ResourceRange): CommentAnchor {
  if(view.startsWith("ocr.")) {
    const language = view.split(".")[1];

    return {
      type: 'ocr',
      language,
      startCharacter: selection.startCharacter,
      endCharacter: selection.endCharacter
    }
  }

  return {
    type: 'text',
    startCharacter: selection.startCharacter,
    endCharacter: selection.endCharacter
  }
}

type CommentLayout = { id: string, height: number, postedAt: number };
export type CommentGroup = { top: number, height: number, comments: CommentLayout[] };

// Google Docs maintains comments against the same line of text in order of insertion. If you select a comment below, all the
// comments against the line above are pushed up. This stops the UI feeling like it "jumps about".
export function groupCommentsByTop(comments: CommentData[], highlightRenderedPositions: HighlightRenderedPositions, commentHeights: { [commentId: string]: number }, margin: number): CommentGroup[] {
  const grouped: Map<number, CommentLayout[]> = new Map();

  for(const { id, postedAt } of comments) {
    // Has the comment been mounted in the DOM yet?
    const top = highlightRenderedPositions[id]?.top;
    const height = commentHeights[id];
  
    if(top !== undefined && height !== undefined) {
      const before = grouped.get(top) || [];
      const after = [...before, { id, height, postedAt }];

      grouped.set(top, after);
    }
  }

  // Return comments in the order of the lines they are attached to
  return sortBy([...grouped.entries()].map(([top, comments]) => {
    return {
      top,
      height: sumBy(comments, 'height') + (margin * comments.length),
      // Within each line, order by insertion (with the timestamp being the best proxy we have for that at the moment)
      comments: sortBy(comments, 'postedAt')
    };
  }), 'top');
}

export function layoutComments(groups: CommentGroup[], margin: number, rootCommentId?: string): { [commentId: string]: number } {
  if(groups.length === 0) {
    return {};
  }

  // If a comment has been focused (ie selected by the user or the last one they have previously selected) then we want
  // it to be next to the line it is attached to. Find the group that contains the focused comment.
  const root = groups.find(({ comments }) => comments.some(({ id }) => id === rootCommentId));
  const modifiedGroups = ([] as CommentGroup[]);

  let ixRoot: number | undefined = undefined;
  let offset = groups[0].top;

  // Lay out the comment groups in order
  groups.forEach((group, ix) => {
    const modifiedGroup = { ...group };

    if(root !== undefined && group.top === root.top) {
      ixRoot = ix;
      
      // Pull up the root group (if needed) so the focused comment is in the center
      const beforeRootInGroup = takeWhile(root.comments, ({ id }) => id !== rootCommentId);
      const offsetWithinGroup = sumBy(beforeRootInGroup, 'height') + (margin * beforeRootInGroup.length);

      modifiedGroup.top -= offsetWithinGroup;
    } else if(group.top < offset) {
      // Push down the group so that it doesn't overlap with the previous group
      modifiedGroup.top = offset;
    }

    modifiedGroups.push(modifiedGroup);
    offset = (modifiedGroup.top + modifiedGroup.height) + margin;
  });

  if(ixRoot !== undefined) {
    // Pull up any groups above the now relocated root group
    let offset = modifiedGroups[ixRoot].top;

    for(let i = (ixRoot - 1); i >= 0; i--) {
      const group = modifiedGroups[i];
      const overlap = (group.top + group.height) - offset;

      if(overlap > 0) {
        group.top -= overlap;
      }

      offset = group.top;
    }
  }

  // Collapse each group into the individual comments and their positions
  const ret = ({} as { [commentId: string]: number });

  for(const group of modifiedGroups) {
    let offset = 0;
    
    for(const comment of group.comments) {
      ret[comment.id] = group.top + offset;
      offset += comment.height + margin;
    }
  }

  return ret;
}

export const CommentPanel: FC<CommentPanelProps> = ({uri, view, currentUser, comments, selection, highlightRenderedPositions, focusedCommentId, previousFocusedCommentId, getComments, clearSelection, focusComment }) => {
  const [sendingComment, setSendingComment] = useState(false);
  const [commentHeights, setCommentHeights] = useState<{ [commentId: string]: number }>({});

  const postCommentRefresh = (newComment: string) => {
    const anchor = selection ? selectionToAnchor(view, selection) : undefined;

    setSendingComment(true);
    postComment(uri, newComment, anchor)
      .then(() => {
        setSendingComment(false)
        clearSelection();
        getComments(uri)
      })
  };

  const deleteCommentRefresh = (commentId: string) => {
    deleteComment(commentId)
      .then(() => {
        getComments(uri)
      })
  };

  const onCommentMount = (id: string) => {
    return (element: HTMLDivElement | null) => {
      if(element && commentHeights[id] !== element.offsetHeight) {
        setCommentHeights({ ...commentHeights, [id]: element.offsetHeight });
      }
    };
  };

  const onCommentClick = (id: string) => {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      focusComment(id);
    };
  };

  const visibleComments = filterCommentsInView(comments, view);

  if(comments.length === 0 && selection === undefined) {
    return <React.Fragment></React.Fragment>;
  }

  const margin = 10; // px
  const groups = groupCommentsByTop(comments, highlightRenderedPositions, commentHeights, margin);
  const positions = layoutComments(groups, margin, focusedCommentId || previousFocusedCommentId);

  return <div className="comments-sidebar">
    {visibleComments
      .sort((a, b) => a.postedAt - b.postedAt)
      .map((c, ix) =>  {
        const style = {
          // Mount the comment in the DOM to get the height but only show it once we've been able to lay it out
          display: c.id in positions ? 'block' : 'none',
          top: positions[c.id] !== undefined ? `${positions[c.id]}px` : `0px`,
          left: c.id === focusedCommentId ? `-15px` : `0px`,
          zIndex: c.id === focusedCommentId ? visibleComments.length : ix,
          cursor: 'pointer'
        }

        return (
          <div key={c.id} className="comment comment--animatable" style={style} onClick={onCommentClick(c.id)} ref={onCommentMount(c.id)}>
            <Comment.Group>
              <Comment>
                <Comment.Content>
                  <Comment.Author as='div'>{c.author.displayName}</Comment.Author>
                  <Comment.Metadata>
                    <div>{hdate.prettyPrint(new Date(c.postedAt), {showTime: true})}</div>
                  </Comment.Metadata>
                  <Comment.Text>
                    {c.text}
                  </Comment.Text>
                  {currentUser.username === c.author.username && <Comment.Actions>
                    <Comment.Action onClick={() => deleteCommentRefresh(c.id)}>Delete</Comment.Action>
                  </Comment.Actions>}
                </Comment.Content>
              </Comment>
            </Comment.Group>
          </div>
        );
      })}
      {(selection || sendingComment) ?
          <AddComment
            sendingComment={sendingComment}
            numberOfComments={visibleComments.length}
            top={highlightRenderedPositions['new-comment']?.top}
            onSubmit={postCommentRefresh}
            onCancel={clearSelection}
          />
      : false}
    </div>
};
