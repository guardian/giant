import React from 'react';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { getCollection, reprocessCollectionResource } from '../../../actions/collections/getCollection';
import { getChildResource, getBasicResource } from '../../../actions/resources/getResource';
import LazyTreeBrowser from '../../viewer/LazyTreeBrowser';
import { BasicResource, Resource } from '../../../types/Resource';
import { Match } from '../../../types/Match';
import { PartialUser } from '../../../types/User';
import { Collection } from '../../../types/Collection';
import { CollectionsState, DescendantResources, GiantState } from '../../../types/redux/GiantState';
import { GiantDispatch } from '../../../types/redux/GiantDispatch';
import { TreeEntry } from '../../../types/Tree';
import { setCollectionFocusedEntry, setCollectionSelectedEntries } from '../../../actions/collections/setCollectionSelectedEntries';
import DetectClickOutside from '../../UtilComponents/DetectClickOutside';
import { Menu } from 'semantic-ui-react';
import { fetchResource } from '../../../services/ResourceApi';

type Props = {
    match: Match,
    currentUser?: PartialUser,
    collections: Collection[],
    resource: Resource | null,
    descendantResources: DescendantResources,
    getCollection: typeof getCollection,
    getBasicResource: typeof getBasicResource,
    getChildResource: typeof getChildResource,
    collectionsState: CollectionsState,
    setFocusedAndSelectedEntry: (entry: TreeEntry<BasicResource>) => void,
    resetFocusedAndSelectedEntries: () => void,
    reprocessCollectionResource: (uri: string, collectionUri: string) => (dispatch: any) => Promise<void>,
    setCollectionSelectedEntries: typeof setCollectionSelectedEntries,
    setCollectionFocusedEntry: typeof setCollectionFocusedEntry
}

type State = {
    resourceLoading: String | null,
    contextMenu: {
        isOpen: boolean,
        entry: null | TreeEntry<BasicResource>,
        positionX: number,
        positionY: number
    },
}

class CurrentCollection extends React.Component<Props, State> {
    state = {
        // Avoid trying to reload the collection again once we start to load it.
        //
        // This happens when you click Back from browsing a large ingestion that triggers
        // the page view and go back to the tree view again.
        resourceLoading: null,
        contextMenu: {
            isOpen: false,
            entry: null,
            positionX: 0,
            positionY: 0
        },
    };

    resourceHasChanged() {
        const uriHasChanged = this.props.resource && this.props.match.params.uri !== this.props.resource.uri;
        const resourceIsLoading = this.state.resourceLoading ? this.state.resourceLoading === this.props.match.params.uri : false;

        return uriHasChanged && !resourceIsLoading;
    }

    loadResource() {
        localStorage.setItem('selectedCollectionUri', this.props.match.params.uri);
        this.props.getBasicResource(this.props.match.params.uri);

        this.setState({ resourceLoading: this.props.match.params.uri });
    }

    componentDidMount() {
        if(!this.props.resource || this.resourceHasChanged()) {
            this.loadResource();
        }
        this.props.getCollection(this.props.match.params.uri);
    }

    componentDidUpdate() {
        if (this.resourceHasChanged()) {
            this.loadResource();
        }

        if (this.props.resource && this.state.resourceLoading === this.props.resource.uri) {
            this.setState({ resourceLoading: null });
        }
    }

    componentWillUnmount() {
        document.title = "Giant";
    }

    onContextMenu = (e: React.MouseEvent, entry: TreeEntry<BasicResource>) => {
        console.log("onContextMenu called");
        if (e.metaKey && e.shiftKey) {
            // override for devs to do "inspect element"
            return;
        }
        e.preventDefault();
        this.props.setFocusedAndSelectedEntry(entry);
        this.setState({
            contextMenu: {
                isOpen: true,
                entry,
                positionX: e.pageX,
                positionY: e.pageY
            }
        })
    };

    closeContextMenu = () => {
        this.setState({
            contextMenu: {
                isOpen: false,
                entry: null,
                positionX: 0,
                positionY: 0
            }
        });
    };    

    renderContextMenu(entry: TreeEntry<BasicResource>, positionX: number, positionY: number, currentUser: PartialUser) {
        const items = [
            // or 'pencil alternate'
            { key: "reprocess", content: "Reprocess source file", icon: "redo" }    
        ];        

        const isFile = entry.data.type === 'file';

        if (isFile) {
            return <DetectClickOutside onClickOutside={this.closeContextMenu}>
            <Menu
                style={{ position: 'absolute', left: positionX, top: positionY }}
                items={items}
                vertical
                onItemClick={(e, menuItemProps) => {
                    const uri = entry.data.uri;
                    console.log(uri);
                    const file = this.props.match.params.id;
                    // if (menuItemProps.content === 'Reprocess source file' && (isWorkspaceLeaf(entry.data))) {
                    //     this.props.reprocessBlob(workspaceId, entry.data.uri)
                    // }
                    if (this.props.resource?.uri) {
                        this.props.reprocessCollectionResource(uri, this.props.resource?.uri);
                    }
                    
                    this.closeContextMenu();
                }}
            />
        </DetectClickOutside>;
        } else return null;
    }

    render() {
        if (this.props.resource && this.props.currentUser) {
            const display = this.props.resource.display || 'Unknown Dataset Name';
            document.title = `${display} - Giant`;

            return (
                <div className='app__main-content'>
                    <div className='app__section'>
                        <LazyTreeBrowser
                            rootResource={this.props.resource}
                            descendantResources={this.props.descendantResources}
                            getChildResource={this.props.getChildResource}
                            onContextMenu={this.onContextMenu}
                        />
                    </div>
                    {this.state.contextMenu.isOpen && this.state.contextMenu.entry
                    ? this.renderContextMenu(
                        this.state.contextMenu.entry,
                        this.state.contextMenu.positionX,
                        this.state.contextMenu.positionY,
                        this.props.currentUser
                    )
                    : null
                }
                </div>

            )
        }

        return null;
    }
}

function mapStateToProps(state: GiantState) {
    // /console.log(`ehsan2: ${state.collectionsState}`);
    return {
        resource: state.resource,
        descendantResources: state.descendantResources,
        currentUser: state.auth.token?.user,
        collections: state.collections,
        collectionsState: state.collectionsState,
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        getCollection: bindActionCreators(getCollection, dispatch),
        getBasicResource: bindActionCreators(getBasicResource, dispatch),
        getChildResource: bindActionCreators(getChildResource, dispatch),
        reprocessCollectionResource: bindActionCreators(reprocessCollectionResource, dispatch),
        resetFocusedAndSelectedEntries: () => {
            dispatch(setCollectionSelectedEntries([]));
            dispatch(setCollectionFocusedEntry(null));
        },
        setFocusedAndSelectedEntry: (entry: TreeEntry<BasicResource>) => {
            dispatch(setCollectionSelectedEntries([entry]));
            dispatch(setCollectionFocusedEntry(entry));
        },        
        setCollectionSelectedEntries: bindActionCreators(setCollectionSelectedEntries, dispatch),
        setCollectionFocusedEntry: bindActionCreators(setCollectionFocusedEntry, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(CurrentCollection);
