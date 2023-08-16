import React from 'react';
import PropTypes from 'prop-types';
import {
  Route,
  Redirect,
  Switch
} from 'react-router-dom';

import {ConnectedRouter} from 'connected-react-router';

import {isLoggedIn} from './util/isLoggedIn';

import Header from './components/Header';
import Collections from './components/Collections/Collections';
import CurrentCollection from './components/Collections/CurrentCollection/CurrentCollection';
import CollectionsSidebar from './components/Collections/CollectionsSidebar/CollectionsSidebar';
import Search from './components/Search/Search';
import {SearchSidebar} from './components/SearchSidebar/SearchSidebar';
import {ResourceHandler} from './components/ResourceHandler/ResourceHandler';
import Directory from './components/Directory/Directory';
import Thread from './components/EmailBrowser/Thread';
import Viewer from './components/viewer/Viewer';
import ViewerSidebar from './components/viewer/ViewerSidebar';
import {ErrorBar} from './components/UtilComponents/ErrorBar';
import Login from './components/Login/Login';
import Register from './components/users/Register';
import SessionKeepalive from './components/Login/SessionKeepalive';
import WorkspacesSidebar from './components/workspace/WorkspacesSidebar';
import Workspaces from './components/workspace/Workspaces';

import SettingsSidebar from './components/Settings/SettingsSidebar';
import ExtractionFailures from './components/Settings/ExtractionFailuresComponent';
import Users from './components/Settings/Users';
import About from './components/Settings/About';
import FeatureSwitches from './components/Settings/FeatureSwitches';
import { WeeklyUploadsFeed } from './components/Uploads/Uploads';

import {connect} from 'react-redux';
import FileTypes from './components/Settings/FileTypes/FileTypes';
import DatasetPermissions from './components/Settings/DatasetPermissions';

import { getCurrentResource } from './util/resourceUtils';

import GiantEuiApp from './eui-components/GiantEuiApp';
import { PageViewerOrFallback } from './components/PageViewerOrFallback';
import IngestionEvents from "./components/IngestEvents/IngestionEvents";

class App extends React.Component {
    static propTypes = {
        history: PropTypes.object.isRequired,
        auth: PropTypes.object.isRequired,
        config: PropTypes.object,
        preferences: PropTypes.object
    };

    renderLoggedInWithEUI(user) {
        return <React.Fragment>
            <SessionKeepalive/>
            <GiantEuiApp user={user} />
        </React.Fragment>
    }

    renderLoggedIn() {
        return <div>
            <SessionKeepalive/>
            <div className='app__page'>
                <Route path='/collections' component={CollectionsSidebar} />
                <Route path='/search' component={SearchSidebar} />
                <Route path={['/viewer-old/:uri', '/viewer/:uri']} component={ViewerSidebar} />
                <Route path='/settings' component={SettingsSidebar} />
                <Route path='/workspaces/:id?' component={WorkspacesSidebar} />

                <div className='app__content'>
                    <ErrorBar />

                    <Route path='/collections' exact component={Collections} />
                    <Route path='/collections/:uri' component={CurrentCollection} />
                    <Route path='/search' component={Search} />
                    <Route path='/viewer-old/:uri' component={Viewer} />
                    <Route path='/viewer/:uri' component={PageViewerOrFallback} />
                    <Route path='/files/*' component={() => <Directory currentResource={getCurrentResource()} />} />
                    <Route path='/emails/thread/:uri' component={Thread} />
                    <Route path='/ingestions/*' component={() => <Directory currentResource={getCurrentResource()} />} />
                    <Route path='/settings/users' component={Users} />
                    <Route path='/settings/failures' component={ExtractionFailures} />
                    <Route path='/settings/file-types' component={FileTypes} />
                    <Route path='/settings/dataset-permissions' component={DatasetPermissions} />
                    <Route path='/settings/features' component={FeatureSwitches} />
                    <Route path='/settings/about' component={About} />
                    <Route path='/settings/uploads' component={WeeklyUploadsFeed} />
                    <Route path='/workspaces/:id' component={Workspaces} />

                    <Route path = '/ingest-events/:collection' component={IngestionEvents} />
                    <Route path = '/ingest-events/:collection/:ingestId' component={IngestionEvents} />
                </div>
            </div>
            <Route exact path='/' render={() => <Redirect to='/search' />} />
            <Route exact path='/login' render={() => {
                const currentUrl = new URL(window.location);
                const returnUrl = currentUrl.searchParams.get('returnUrl');
                if (returnUrl) {
                    const url = new URL(returnUrl);
                    return <Redirect to={{
                        pathname: url.pathname,
                        search: url.search
                    }}/>;
                } else {
                    return <Redirect to='/search' />;
                }
            }} />
            <Route path='/resources/*' render={() => <ResourceHandler currentResource={getCurrentResource()} />} />
        </div>;
    }

    renderAnonymouse() {
        return <Switch>
            <Route path='/login' component={Login} />
            <Route path='/register' component={Register} />
            <Redirect to={{
                pathname: '/login',
                search: `?returnUrl=${encodeURIComponent(window.location.href)}`
            }}/>
        </Switch>;
    }

    render() {
        const { featureEUI } = this.props.preferences;
        const loggedIn = isLoggedIn(this.props.auth);
        const maybeUser = loggedIn ? this.props.auth.token.user : undefined;

        if(featureEUI && maybeUser) {
            return <ConnectedRouter history={this.props.history}>
                {this.renderLoggedInWithEUI(maybeUser)}
            </ConnectedRouter>;
        }

        return (
            <ConnectedRouter history={this.props.history}>
                <div className='app'>
                    <Header user={maybeUser} config={this.props.config} preferences={this.props.preferences}/>
                    {loggedIn ? this.renderLoggedIn() : this.renderAnonymouse()}
                </div>
            </ConnectedRouter>
        );
    }
}

function mapStateToProps(state) {
    return {
        auth: state.auth,
        config: state.app.config,
        preferences: state.app.preferences
    };
}

export default connect(mapStateToProps)(App);
