import React from 'react';
import { GiantState } from '../types/redux/GiantState';
import { GiantDispatch } from '../types/redux/GiantDispatch';
import { connect } from 'react-redux';
import GiantEuiSearchResults from './GiantEuiSearchResults';

type Props = ReturnType<typeof mapStateToProps> &
    ReturnType<typeof mapDispatchToProps>

function GiantEuiWorkspace({ currentWorkspace, currentResults, currentQuery, user }: Props) {
    if (currentWorkspace) {
        if (currentResults && currentQuery && user) {
            return <GiantEuiSearchResults currentWorkspace={currentWorkspace} />;
        }

        return <span> { currentWorkspace.name } </span>;
    } else {
        return <span> No workspace found</span>;
    }
}

function mapStateToProps(state: GiantState) {
    return {
        currentWorkspace: state.workspaces.currentWorkspace,
        currentResults: state.search.currentResults,
        currentQuery: state.search.currentQuery?.q,
        user: state.auth.token?.user
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {};
}

export default connect(mapStateToProps, mapDispatchToProps)(GiantEuiWorkspace);

