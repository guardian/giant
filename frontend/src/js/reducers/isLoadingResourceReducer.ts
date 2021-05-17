import { LoadingState } from '../types/redux/GiantState';
import { LoadingStateAction, LoadingStateActionType } from '../types/redux/GiantActions';

export default function isLoadingResource(state = false, action: LoadingStateAction): LoadingState {
    switch (action.type) {
        case LoadingStateActionType.SET_RESOURCE_LOADING_STATE:
            return action.isLoadingResource;
        default:
            return state;
    }
}
