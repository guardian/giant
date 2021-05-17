import {applyMiddleware, compose, createStore} from 'redux';
import thunkMiddleware from 'redux-thunk';
import createRootReducer from '../reducers';
import { routerMiddleware } from 'connected-react-router';
import history from './history';
import {paramStringToObject} from './UrlParameters';

import {
    updateUrlFromStateChangeMiddleware,
    updateStateFromUrlChangeMiddleware
} from './storeMiddleware.js';
import { updateUrlParams } from '../actions/urlParams/updateSearchQuery';


function configureStore(history) {
    const store = createStore(
        createRootReducer(history),
        compose(
            applyMiddleware(thunkMiddleware),
            applyMiddleware(updateUrlFromStateChangeMiddleware),
            applyMiddleware(updateStateFromUrlChangeMiddleware),
            applyMiddleware(routerMiddleware(history)),
            window.devToolsExtension ? window.devToolsExtension() : f => f
        )
    );

    /* globals module:false */
    if (module.hot) {
        module.hot.accept('../reducers', () => {
            store.replaceReducer(createRootReducer(history));
        });
    }

    return store;
}

const store = configureStore(history);
export default store;

// Actions to setup the store on page load
store.dispatch(
    updateUrlParams(
        paramStringToObject(history.location.search)
    )
);
