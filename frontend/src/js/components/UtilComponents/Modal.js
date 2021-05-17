import React from 'react';
import PropTypes from 'prop-types';
import {KeyboardShortcut} from '../UtilComponents/KeyboardShortcut';

export default class Modal extends React.Component {
    static defaultProps = {
        isDismissable: true
    };

    static propTypes = {
        isOpen: PropTypes.bool.isRequired,
        dismiss: PropTypes.func.isRequired,
        children: PropTypes.oneOfType([
            PropTypes.arrayOf(PropTypes.node),
            PropTypes.node
        ]).isRequired,

        isDismissable: PropTypes.bool,
        panelClassName: PropTypes.string
    };

    preventClosingClick (event) {
        event.stopPropagation();
    };

    dismiss() {
        if (this.props.isDismissable) {
            this.props.dismiss();
        }
    }

    render() {
        if (!this.props.isOpen) {
            return false;
        }

        return (
            <div className='modal' onClick={this.dismiss.bind(this)}>
                <KeyboardShortcut shortcut='esc' func={this.dismiss.bind(this)} />
                <div className='modal__content' onClick={this.preventClosingClick}>
                    <div className={`modal__panel ${this.props.panelClassName || ''}`}>
                        <button className='btn modal__dismiss' disabled={!this.props.isDismissable} onClick={this.dismiss.bind(this)}>
                            Close
                        </button>
                        {this.props.children}
                    </div>
                </div>
            </div>
        );

    }
}
