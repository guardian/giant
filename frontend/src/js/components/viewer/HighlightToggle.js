import React from 'react';
import PropTypes from 'prop-types';
import {Checkbox} from '../UtilComponents/Checkbox';
import onClickOutside from 'react-onclickoutside';

class HighlightToggle extends React.Component {
    static propTypes = {
        showSearchHighlights: PropTypes.bool.isRequired,
        showCommentHighlights: PropTypes.bool.isRequired,
        updatePreference: PropTypes.func.isRequired,
        onClose: PropTypes.func.isRequired,
    }

    toggleHighlights = () => {
        this.props.updatePreference('showSearchHighlights', !this.props.showSearchHighlights);
    }

    toggleComments = () => {
        this.props.updatePreference('showCommentHighlights', !this.props.showCommentHighlights);
    }

    handleClickOutside = () => {
        this.props.onClose();
    }

    render() {
        return (
            <div className='viewer__toggle-highlighting-panel'>
                <div>
                    <Checkbox
                        highlighted={true}
                        selected={this.props.showSearchHighlights}
                        onClick={this.toggleHighlights}>
                        Search
                    </Checkbox>
                </div>
                <div>
                    <Checkbox
                        highlighted={true}
                        selected={this.props.showCommentHighlights}
                        onClick={this.toggleComments}>
                        Comments
                    </Checkbox>
                </div>
            </div>
        );
    }
}

export default onClickOutside(HighlightToggle);
