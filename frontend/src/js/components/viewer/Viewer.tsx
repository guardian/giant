import React from 'react';

import history from '../../util/history';
import buildLink from '../../util/buildLink';

import { HighlightableText, Resource } from '../../types/Resource';

import { TablePreview } from './TablePreview';
import StatusBar from './StatusBar';
import { Preview } from './Preview';
import { EmailDetails } from './EmailDetails';
import { TextPreview } from './TextPreview';
import PageViewer from './PageViewer/PageViewer';
import { calculateResourceTitle } from '../UtilComponents/documentTitle';

import { keyboardShortcuts } from '../../util/keyboardShortcuts';
import { KeyboardShortcut } from '../UtilComponents/KeyboardShortcut';
import _ from 'lodash';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { getChildResource, getResource, resetResource } from '../../actions/resources/getResource';
import { setDetailsView, setResourceView } from '../../actions/urlParams/setViews';
import { setCurrentHighlight } from '../../actions/highlights';
import { setCurrentHighlightInUrl } from '../../actions/urlParams/setCurrentHighlight';
import { getComments } from '../../actions/resources/getComments';
import { setSelection } from '../../actions/resources/setSelection';
import { DescendantResources, GiantState, PagesState, UrlParamsState } from '../../types/redux/GiantState';
import { Auth } from '../../types/Auth';
import { GiantDispatch } from '../../types/redux/GiantDispatch';
import LazyTreeBrowser from './LazyTreeBrowser';
import { SearchResults } from '../../types/SearchResults';
import { getDefaultView } from '../../util/resourceUtils';
import DownloadButton from './DownloadButton';
import PageViewerStatusBar from './PageViewer/PageViewerStatusBar';
import { loadPages } from '../../actions/pages/loadPages';
import { resetPages } from '../../actions/pages/resetPages';

type Props = {
    match: { params: { uri: string } },
    auth: Auth,
    pages: PagesState,
    preferences: any,
    urlParams: UrlParamsState,
    resource: Resource | null,
    isLoadingResource: boolean,
    descendantResources: DescendantResources,
    currentResults?: SearchResults,
    currentHighlight?: number,
    totalHighlights?: number,
    getResource: typeof getResource,
    getChildResource: typeof getChildResource,
    resetResource: typeof resetResource,
    getComments: typeof getComments,
    setResourceView: typeof setResourceView,
    setDetailsView: typeof setDetailsView,
    setCurrentHighlight: typeof setCurrentHighlight,
    setCurrentHighlightInUrl: typeof setCurrentHighlightInUrl,
    setSelection: typeof setSelection,
    loadPages: typeof loadPages,
    resetPages: typeof resetPages
}

type State = {
    resultIdx: number
}

// A viewport for the current search result
class Viewer extends React.Component<Props, State> {
    state = {
        // Default to negative number to prevent next-previous when you're outside the context of a search set
        resultIdx: -10,
    };

    setupSearchContext(props: Props) {
        if (!props.currentResults) {
            return;
        }

        const currentSearchIndex = props.currentResults.results.findIndex(result =>
            result.uri === props.match.params.uri
        );

        if (currentSearchIndex !== -1) {
            this.setState({
                resultIdx: currentSearchIndex
            });
        }
    }

    UNSAFE_componentWillReceiveProps(props: Props) {
        if (!this.props.isLoadingResource && props.match.params.uri !== this.props.match.params.uri) {
            // See comment below in componentDidMount about not racing these two requests
            this.props.getResource(props.match.params.uri, props.urlParams.q);
            this.props.loadPages(props.match.params.uri, props.urlParams.q);
        }

        const currentUri = this.props.resource ? this.props.resource.uri : undefined;

        if (props.resource && props.currentResults && props.resource.uri !== currentUri) {
            this.setupSearchContext(props);
        }
    }

    componentDidMount() {
        this.setupSearchContext(this.props);

        // This has to happen early, because otherwise state changes will get synced to the URL
        // (and the URL state thus lost) before we have a chance to do it the other way round

        if (this.props.urlParams.highlight && this.props.urlParams.view) {
            const highlightFromUrl = parseInt(this.props.urlParams.highlight);

            if(!isNaN(highlightFromUrl)) {
                // If there's something in the URL, it should override the state.
                this.props.setCurrentHighlight(
                    this.props.match.params.uri,
                    this.props.urlParams.q,
                    this.props.urlParams.view,
                    highlightFromUrl
                );
            }
        } else if (this.props.currentHighlight !== undefined) {
            // Otherwise, add the state to the URL.
            this.props.setCurrentHighlightInUrl(this.props.currentHighlight.toString(10));
        }

        // <ViewerSidebar> may have fetched the resource first, so avoid duplicate requests which race each other.
        // Ultimately we'd like the resource fetch to be triggered from a common parent of this and <ViewerSidebar>
        if (!this.props.isLoadingResource && !this.props.resource) {
            this.props.getResource(this.props.match.params.uri, this.props.urlParams.q);
        }

        // TODO: we shouldn't race loading both the resource and the pages. Once the page viewer is the default
        // we should try and load the pages up front and fallback to getResource (to get the old fashioned text, OCR etc)
        // if there aren't any. This might need some API changes to include any required metadata from getResource
        // in the pages response as well.
        //
        // For big documents this race is also not ideal as we could stress React by trying to load a large amount of text
        // returned from getResource before the pages response has come back. That said, there is a circuit breaker on the
        // server for documents that we know have more than N pages so that may help in the meantime before we can refactor this.

        if (this.props.pages.doc === undefined) {
            this.props.loadPages(this.props.match.params.uri, this.props.urlParams.q);
        }

        document.title = calculateResourceTitle(this.props.resource);
    }

    componentDidUpdate(prevProps: Props) {
        if (
            this.props.currentHighlight !== prevProps.currentHighlight ||
            this.props.totalHighlights !== prevProps.totalHighlights
        ) {
            if (this.props.currentHighlight === undefined) {
                // We must have just changed view to a view with no highlight in the state yet.
                // So start at first search result.
                if(this.props.match.params.uri && this.props.urlParams.q && this.props.urlParams.view) {
                    this.props.setCurrentHighlight(
                        this.props.match.params.uri,
                        this.props.urlParams.q,
                        this.props.urlParams.view,
                        0
                    );
                }
            } else {
                // The highlights might have changed because the user has clicked next/previous,
                // or because they've changed view between text & ocr. Either way, we need
                // to get the scroll position and the URL in sync with the highlights.
                this.scrollToCurrentHighlight();
                this.props.setCurrentHighlightInUrl(this.props.currentHighlight.toString(10));
            }
        }

        if(!this.props.urlParams.view && this.props.resource) {
            const maybeDefaultView = getDefaultView(this.props.resource);

            if(maybeDefaultView) {
                this.props.setResourceView(maybeDefaultView);
            }
        }

        document.title = calculateResourceTitle(this.props.resource);
    }

    scrollToCurrentHighlight() {
        if (this.props.totalHighlights !== undefined && this.props.totalHighlights > 0 && this.props.currentHighlight !== undefined) {
            const highlights = document.querySelectorAll('result-highlight');

            if (highlights.length > 0) {
                const currentHighlightElement = document.querySelector('.result-highlight--focused');
                if (currentHighlightElement) {
                    currentHighlightElement.classList.remove('result-highlight--focused');
                }

                if (highlights[this.props.currentHighlight]) {
                    highlights[this.props.currentHighlight].classList.add('result-highlight--focused');
                    highlights[this.props.currentHighlight].scrollIntoView({
                        inline: 'center',
                        block: 'center'
                    });
                } else {
                    console.error(`Could not find element number ${this.props.currentHighlight} in highlights of length ${highlights.length}`);
                }
            } else {
                console.error("Actual count of highlights does not match expected number of highlights")
            }
        }

        return null;
    }

    componentWillUnmount() {
        document.title = "Giant";
        this.props.resetResource();
        this.props.resetPages();
    }

    previousResult = () => {
        const currentHits = this.props.currentResults ? this.props.currentResults.results : undefined;
        if (currentHits) {
            const idx = this.state.resultIdx - 1;
            if (idx >= 0) {
                const to = `${currentHits[idx].uri}`;
                history.push(buildLink(to, this.props.urlParams, {}));
            }
        }
    }

    nextResult = () => {
        const currentHits = this.props.currentResults ? this.props.currentResults.results : undefined;
        if (currentHits) {
            const idx = this.state.resultIdx + 1;
            if (idx < currentHits.length) {
                const to = `${currentHits[idx].uri}`;
                history.push(buildLink(to, this.props.urlParams, {}));
            }
        }
    }

    hasPreviousResult() {
        if(!this.props.currentResults || this.props.resource === undefined) {
            return false;
        }

        const { page, results } = this.props.currentResults;

        if(page > 1) {
            return true;
        } else {
            const ix = results.findIndex(({ uri }) => uri === this.props.resource!.uri);
            return ix !== -1 && ix > 0;
        }
    }

    hasNextResult() {
        if(!this.props.currentResults || this.props.resource === undefined) {
            return false;
        }

        const { page, pages, results } = this.props.currentResults;

        if(page < pages) {
            return true;
        } else {
            const ix = results.findIndex(({ uri }) => uri === this.props.resource!.uri);
            return ix !== -1 && ix < (results.length - 1);
        }
    }

    renderTextPreview(resource: Resource, highlightableText: HighlightableText, view: string) {
        return <TextPreview
            uri={resource.uri}
            currentUser={this.props.auth.token!.user}
            text={highlightableText.contents}
            searchHighlights={highlightableText.highlights}
            view={view}
            comments={resource.comments}
            selection={resource.selection}
            preferences={this.props.preferences}
            getComments={this.props.getComments}
            setSelection={this.props.setSelection}
        />;
    }

    renderNoPreview() {
        return <div className='viewer__no-text-preview'>
            <p>
                Cannot display this document. It could still be processing or it could be too large.
            </p>
            <DownloadButton />
        </div>;
    }

    renderFullContents(resource: Resource, view: string) {
        if (view === 'table') {
            return <TablePreview text={resource.text.contents}/>
        } else if (view === 'preview') {
            return <Preview fingerprint={resource.uri} />;
        } else if (view.startsWith('ocr')) {
            if (resource.ocr) {
                return this.renderTextPreview(resource, _.get(this.props.resource, view), view);
            } else {
                // Only matters if a user has manually changed the view in the URL params or is visiting a link with them in
                return this.renderNoPreview();
            }
        } else if (resource.extracted) {
            return this.renderTextPreview(resource, resource.text, 'text');
        } else if (resource.children.length) {
            return <LazyTreeBrowser
                rootResource={resource}
                descendantResources={this.props.descendantResources}
                getChildResource={this.props.getChildResource}
            />;
        } else {
            return this.renderNoPreview();
        }
    }

    renderFullResource(resource: Resource, view: string) {
        let docClass = 'document';

        if(this.props.urlParams.view === 'preview') {
            docClass += ' document-fixed';
        }

        if(resource.type === 'email') {
            docClass += ' document--browser';
        }

        if(resource.children.length) {
            docClass += ' document--browser document--full-height';
        }

        if (resource.type === 'blob') {
            return (
                <div className={docClass}>
                    {this.renderFullContents(resource, view)}
                </div>
           );
        } else if (resource.type === 'email') {
            return (
                <div className={docClass}>
                    <EmailDetails email={this.props.resource} detailsType={this.props.urlParams.details} setDetailsView={this.props.setDetailsView} match={this.props.match}/>
                    {this.renderFullContents(resource, view)}
                </div>
            );
        } else {
            return <div>Unknown resource type {resource.uri}</div>;
        }
    }

    renderResource(resource: Resource) {
        const { view, q } = this.props.urlParams;
        const { uri } = resource;
        const { featurePageViewer } = this.props.preferences;

        if (featurePageViewer && this.props.pages.doc?.summary.numberOfPages) {
            return <PageViewer
                uri={uri}
                q={q}
            />;
        }

        return <div className='viewer__main'>
            {this.renderFullResource(resource, view || 'text')}
        </div>;
    }

    render() {
        console.log('this.props.match: ', this.props.match);
        if (!this.props.resource) {
            return false;
        }

        return (
            <div className='viewer'>
                <KeyboardShortcut shortcut={keyboardShortcuts.nextResult} func={this.nextResult} />
                <KeyboardShortcut shortcut={keyboardShortcuts.previousResult} func={this.previousResult} />

                {this.renderResource(this.props.resource)}
                <div className='viewer__footer'>
                    {this.props.preferences.featurePageViewer && this.props.pages.doc?.summary.numberOfPages ?
                        <PageViewerStatusBar
                            previousDocumentFn={this.hasPreviousResult() ? () => this.previousResult() : undefined}
                            nextDocumentFn={this.hasNextResult() ? () => this.nextResult() : undefined}
                        />
                    :
                        <StatusBar
                            resource={this.props.resource}
                            view={this.props.urlParams.view}
                            currentHighlight={this.props.currentHighlight}
                            totalHighlights={this.props.totalHighlights}
                            previousFn={this.hasPreviousResult() ? () => this.previousResult() : undefined}
                            nextFn={this.hasNextResult() ? () => this.nextResult() : undefined}
                        />
                    }
                </div>
            </div>);
    }
}

function mapStateToProps(state: GiantState) {
    const view = state.urlParams.view;
    let currentHighlight, totalHighlights;

    if (state.resource && state.urlParams && view) {
        // The current highlight is stored separately in redux so it can be preserved on navigation.
        const highlights = state.highlights[`${state.resource.uri}-${state.urlParams.q}`];
        if (highlights && _.get(highlights, view)) {
            currentHighlight = _.get(highlights, view).currentHighlight;
        }
        if (_.get(state.resource, view)) {
            // The total highlights comes from the server representation of a resource.
            totalHighlights = _.get(state.resource, view).highlights.length;
        }
    }

    return {
        pages: state.pages,
        auth: state.auth,
        urlParams: state.urlParams,
        resource: state.resource,
        isLoadingResource: state.isLoadingResource,
        descendantResources: state.descendantResources,
        currentResults: state.search.currentResults,
        preferences: state.app.preferences,
        currentHighlight,
        totalHighlights,
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        setResourceView: bindActionCreators(setResourceView, dispatch),
        setDetailsView: bindActionCreators(setDetailsView, dispatch),
        getResource: bindActionCreators(getResource, dispatch),
        resetResource: bindActionCreators(resetResource, dispatch),
        getChildResource: bindActionCreators(getChildResource, dispatch),
        setCurrentHighlight: bindActionCreators(setCurrentHighlight, dispatch),
        setCurrentHighlightInUrl: bindActionCreators(setCurrentHighlightInUrl, dispatch),
        getComments: bindActionCreators(getComments, dispatch),
        setSelection: bindActionCreators(setSelection, dispatch),
        loadPages: bindActionCreators(loadPages, dispatch),
        resetPages: bindActionCreators(resetPages, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Viewer);
