import React from 'react';
import { Route } from 'react-router-dom';
import GiantEuiHeader from './GiantEuiHeader';
import GiantEuiSettings from './GiantEuiSettings';
import GiantEuiWorkspace from './GiantEuiWorkspace';
import { headerHeight } from './displayConstants';

export default function GiantEuiApp() {

    return <React.Fragment>
        <GiantEuiHeader/>
        <div style={{marginTop: headerHeight}}>
            <Route path='/settings' component={GiantEuiSettings} />
            <Route path='/workspaces/:id' component={GiantEuiWorkspace}/>
        </div>
    </React.Fragment>;
}
