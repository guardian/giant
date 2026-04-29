import {
  ResourceAction,
  ResourceActionType,
} from "../types/redux/GiantActions";

export default function pendingScrollToCommentId(
  state: string | null = null,
  action: ResourceAction,
): string | null {
  switch (action.type) {
    case ResourceActionType.PENDING_SCROLL_TO_COMMENT:
      return action.commentId ?? null;
    default:
      return state;
  }
}
