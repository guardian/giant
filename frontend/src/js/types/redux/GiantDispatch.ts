import { GiantState } from './GiantState';
import { GiantAction } from './GiantActions';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';

export type GiantDispatch = ThunkDispatch<GiantState, void, GiantAction>
