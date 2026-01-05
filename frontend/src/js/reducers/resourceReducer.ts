import {
  ResourceAction,
  ResourceActionType,
} from "../types/redux/GiantActions";
import { Resource } from "../types/Resource";

export default function resource(
  state: Resource | null = null,
  action: ResourceAction,
): Resource | null {
  switch (action.type) {
    case ResourceActionType.GET_RECEIVE:
      return action.resource;

    case ResourceActionType.RESET_RESOURCE:
      return null;

    case ResourceActionType.SET_COMMENTS:
      return { ...state!, comments: action.comments };

    case ResourceActionType.SET_SELECTION:
      return { ...state!, selection: action.selection };

    default:
      return state;
  }
}
