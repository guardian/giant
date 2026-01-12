import { GiantDispatch } from "../../types/redux/GiantDispatch";
import { fetchComments } from "../../services/CommentsApi";
import {
  ResourceActionType,
  AppActionType,
} from "../../types/redux/GiantActions";
import { CommentData } from "../../types/Resource";

export function getComments(uri: string) {
  return async (dispatch: GiantDispatch) => {
    try {
      const response = await fetchComments(uri);
      const comments = response as CommentData[];

      dispatch({
        type: ResourceActionType.SET_COMMENTS,
        receivedAt: Date.now(),
        comments,
      });
    } catch (error) {
      // @ts-ignore
      dispatch({
        type: AppActionType.APP_SHOW_ERROR,
        message: "Failed to get comments",
        error: error,
        receivedAt: Date.now(),
      });
    }
  };
}
