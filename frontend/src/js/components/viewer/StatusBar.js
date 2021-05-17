import React from 'react';
import PropTypes from 'prop-types';
import { resourcePropType } from '../../types/Resource';
import PreviewSwitcher from './PreviewSwitcher';
import DownIcon from 'react-icons/lib/md/arrow-downward';
import PreviousIcon from 'react-icons/lib/md/navigate-before';
import NextIcon from 'react-icons/lib/md/navigate-next';
import UpIcon from 'react-icons/lib/md/arrow-upward';
import HighlightToggle from './HighlightToggle';
import { keyboardShortcuts } from '../../util/keyboardShortcuts';
import { KeyboardShortcut } from '../UtilComponents/KeyboardShortcut';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { updatePreference } from '../../actions/preferences';
import { setCurrentHighlight } from '../../actions/highlights';

function NavButton({ IconElement, title, onClick }) {
    const className = onClick ? 'preview__nav-button--active' : 'preview__nav-button--inactive';

    return <span title={title}>
        <IconElement className={className} onClick={onClick ? onClick : () => {}}/>
    </span>;
}

NavButton.propTypes = {
    IconElement: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    onClick: PropTypes.func
};

class StatusBar extends React.Component {
    static propTypes = {
        resource: resourcePropType,
        view: PropTypes.string,
        previewStatus: PropTypes.string,
        nextFn: PropTypes.func,
        previousFn: PropTypes.func,
        preferences: PropTypes.object.isRequired,
        updatePreference: PropTypes.func.isRequired,

        currentHighlight: PropTypes.number,
        totalHighlights: PropTypes.number,

        urlParams: PropTypes.shape({
            details: PropTypes.string,
            q: PropTypes.string,
            view: PropTypes.string,
            highlight: PropTypes.string,
            page: PropTypes.oneOfType([
                PropTypes.string,
                PropTypes.number
            ])
        }),

    };

    state = {
        highlightPanelVisible: false
    };

    nextSearchHighlight = () => {
        let newHighlight;
        if (this.props.currentHighlight === (this.props.totalHighlights - 1)) {
            // wrap
            newHighlight = 0;
        } else if (this.props.currentHighlight === undefined) {
            // start at first result if none highlighted currently
            newHighlight = 0;
        } else {
            newHighlight = this.props.currentHighlight + 1;
        }

        if (this.props.urlParams.view) {
            this.props.setCurrentHighlight(
                this.props.resource.uri,
                this.props.urlParams.q,
                this.props.urlParams.view,
                newHighlight
            );
        }
    };

    previousSearchHighlight = () => {
        let newHighlight;

        if (this.props.currentHighlight === 0) {
            // wrap
            newHighlight = this.props.totalHighlights - 1;
        } else if (this.props.currentHighlight === undefined) {
            // start at last result if none highlighted currently
            newHighlight = this.props.totalHighlights - 1;
        } else {
            newHighlight = this.props.currentHighlight - 1;
        }

        if (this.props.urlParams.view) {
            this.props.setCurrentHighlight(
                this.props.resource.uri,
                this.props.urlParams.q,
                this.props.urlParams.view,
                newHighlight
            );
        }
    };

    renderHighlightToggle = () => {
        if (!this.state.highlightPanelVisible) {
            return false;
        }

        return (
            <HighlightToggle
                showSearchHighlights={this.props.preferences.showSearchHighlights}
                showCommentHighlights={this.props.preferences.showCommentHighlights}
                updatePreference={this.props.updatePreference}
                eventTypes='mouseup'
                onClose={() => this.setState({highlightPanelVisible: false})}
            />
        );
    };

    renderSearchResultNavigation = () => {
        const buttons = <React.Fragment>
            <UpIcon onClick={this.previousSearchHighlight} className='document__status-icon'/>
            <DownIcon onClick={this.nextSearchHighlight} className='document__status-icon'/>
        </React.Fragment>;

        if (this.props.currentHighlight !== undefined && this.props.totalHighlights > 0) {
            // Add one because we don't want to show the zero-indexed number to the user.
            // (It's zero-indexed in the state because we use it to index into an array of elements)
            return <span>
                {buttons}
                <span className='document__status-text'>Result {this.props.currentHighlight + 1} of {this.props.totalHighlights}</span>
            </span>;
        } else if (this.props.totalHighlights > 0) {
            return <span>
                {buttons}
                <span className='document__status-text'>{this.props.totalHighlights} results</span>
            </span>;
        } else {
            return null;
        }
    };

    highlightButtonClicked = (e) => {
        e.stopPropagation();
        this.setState({highlightPanelVisible: true});
    };

    render() {
        return (
            <div className='document__status'>
                <KeyboardShortcut shortcut={keyboardShortcuts.previousHighlight} func={this.previousSearchHighlight} />
                <KeyboardShortcut shortcut={keyboardShortcuts.nextHighlight} func={this.nextSearchHighlight} />
                <span>
                    <NavButton IconElement={PreviousIcon} title={`Previous result (${keyboardShortcuts.previousResult})`} onClick={this.props.previousFn} />
                    <button onClick={this.highlightButtonClicked}
                        className='btn viewer__toggle-highlighting-button'>
                        Highlighting
                    </button>
                    {this.renderHighlightToggle()}
                    {this.renderSearchResultNavigation()}
                </span>
                <span>
                    <PreviewSwitcher view={this.props.view} resource={this.props.resource}/>
                    <NavButton IconElement={NextIcon} title={`Next result (${keyboardShortcuts.nextResult})`} onClick={this.props.nextFn} />
                </span>
            </div>
        );
    }
}

function mapStateToProps(state) {
    return {
        preferences: state.app.preferences,
        urlParams: state.urlParams,
    };
}

function mapDispatchToProps(dispatch) {
    return {
        updatePreference: bindActionCreators(updatePreference, dispatch),
        setCurrentHighlight: bindActionCreators(setCurrentHighlight, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(StatusBar);
