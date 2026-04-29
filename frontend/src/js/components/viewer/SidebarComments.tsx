import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import hdate from "human-date";
import CommentIcon from "react-icons/lib/md/comment";
import ExpandLess from "react-icons/lib/md/expand-less";
import ExpandMore from "react-icons/lib/md/expand-more";

import { CommentData, Resource } from "../../types/Resource";
import { PartialUser } from "../../types/User";
import { GiantState } from "../../types/redux/GiantState";
import {
  getCommentSnippet,
  getCommentViewLabel,
  getViewForAnchor,
} from "../../util/commentUtils";
import { postComment, deleteComment } from "../../services/CommentsApi";
import { getComments } from "../../actions/resources/getComments";
import { setResourceView } from "../../actions/urlParams/setViews";

type SidebarCommentsProps = {
  resource: Resource;
  currentView: string | undefined;
  currentUser: PartialUser | undefined;
};

export function SidebarComments({
  resource,
  currentView,
  currentUser,
}: SidebarCommentsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const dispatch = useDispatch();
  const comments = resource.comments ?? [];

  const handleSubmit = async () => {
    if (!newCommentText.trim()) return;

    setSendingComment(true);
    try {
      await postComment(resource.uri, newCommentText.trim());
      setNewCommentText("");
      setAdding(false);
      dispatch(getComments(resource.uri) as any);
    } finally {
      setSendingComment(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
    dispatch(getComments(resource.uri) as any);
  };

  const handleCommentClick = (comment: CommentData) => {
    const targetView = getViewForAnchor(comment.anchor);
    if (!targetView) {
      // Document-level comment — no navigation
      return;
    }
    if (targetView !== currentView) {
      dispatch(setResourceView(targetView));
    }
    // TODO(#702): set focusedCommentId to scroll to comment in CommentPanel
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setAdding(false);
      setNewCommentText("");
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="sidebar-comments">
      <div className="sidebar__title">
        <span
          className="sidebar-comments__header"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ExpandMore /> : <ExpandLess />}
          Comments{comments.length > 0 ? ` (${comments.length})` : ""}
        </span>
      </div>

      {!collapsed && (
        <>
          <ul className="sidebar-comments__list">
            {comments.map((comment) => (
              <SidebarComment
                key={comment.id}
                comment={comment}
                resource={resource}
                currentView={currentView}
                currentUser={currentUser}
                onClick={() => handleCommentClick(comment)}
                onDelete={() => handleDelete(comment.id)}
              />
            ))}
          </ul>

          {adding ? (
            <div className="sidebar-comments__add">
              <textarea
                rows={3}
                placeholder="Add a comment about this document…"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <div className="sidebar-comments__add-actions">
                <input
                  type="submit"
                  className="btn"
                  disabled={!newCommentText.trim() || sendingComment}
                  value="Comment"
                  onClick={handleSubmit}
                />
                <input
                  type="button"
                  className="btn"
                  disabled={sendingComment}
                  value="Cancel"
                  onClick={() => {
                    setAdding(false);
                    setNewCommentText("");
                  }}
                />
              </div>
            </div>
          ) : (
            <button
              className="btn sidebar-comments__add-btn"
              onClick={() => setAdding(true)}
            >
              <CommentIcon /> Add comment
            </button>
          )}
        </>
      )}
    </div>
  );
}

type SidebarCommentProps = {
  comment: CommentData;
  resource: Resource;
  currentView: string | undefined;
  currentUser: PartialUser | undefined;
  onClick: () => void;
  onDelete: () => void;
};

function SidebarComment({
  comment,
  resource,
  currentView,
  currentUser,
  onClick,
  onDelete,
}: SidebarCommentProps) {
  const viewLabel = getCommentViewLabel(comment.anchor);
  const snippet = getCommentSnippet(comment.anchor, resource);
  const targetView = getViewForAnchor(comment.anchor);
  const isInCurrentView = targetView === currentView;
  const isClickable = !!targetView;
  const canDelete =
    currentUser && comment.author.username === currentUser.username;

  return (
    <li
      className={`sidebar-comments__comment ${isClickable ? "sidebar-comments__comment--clickable" : ""}`}
      onClick={isClickable ? onClick : undefined}
    >
      <div className="sidebar-comments__comment-header">
        <span className="sidebar-comments__author">
          {comment.author.displayName}
        </span>
        <span
          className={`sidebar-comments__view-tag ${isInCurrentView ? "sidebar-comments__view-tag--current" : ""}`}
        >
          {viewLabel}
        </span>
      </div>

      {snippet && (
        <div className="sidebar-comments__snippet">&ldquo;{snippet}&rdquo;</div>
      )}

      <div className="sidebar-comments__text">{comment.text}</div>

      <div className="sidebar-comments__footer">
        <span className="sidebar-comments__time">
          {hdate.relativeTime(new Date(comment.postedAt))}
        </span>
        {canDelete && (
          <button
            className="btn sidebar-comments__delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}
