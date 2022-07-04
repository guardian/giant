import React from 'react';
import PropTypes from 'prop-types';
import AutosizeInput from 'react-input-autosize';

export default class InlineInput extends React.Component {
    static propTypes = {
        index: PropTypes.number.isRequired,
        value: PropTypes.string.isRequired,

        disabled: PropTypes.bool,
        lastInput: PropTypes.bool.isRequired,

        renderSuggestions: PropTypes.func.isRequired,

        // Bubble up suggestion navigation attempts from the input where they're captured
        onEnter: PropTypes.func.isRequired,
        onMoveSuggestion: PropTypes.func.isRequired,

        onStepOut: PropTypes.func.isRequired,
        onDeleteSibling: PropTypes.func.isRequired,
        onFocus: PropTypes.func.isRequired,
        onUpdate: PropTypes.func.isRequired,
    }

    focus = () => {
        this.textInput.focus();
    }

    focusEnd = () => {
        this.textInput.focus();
        this.textInput.input.selectionStart = this.textInput.input.selectionEnd = this.textInput.input.value.length;
    }

    select = () => {
        this.textInput.select();
    }

    onKeyPress = (e) => {
        const inputStart = this.textInput.input.selectionStart;
        const inputEnd = this.textInput.input.selectionEnd;
        const noSelection = inputStart === inputEnd;

        if (e.key === 'ArrowLeft') {
            if (inputStart === 0 && noSelection) {
                e.preventDefault();
                this.props.onStepOut(this.props.index, -1);
            } else {
                this.checkForSuggestionsAndUpdate(this.props.value, inputStart - 1);
            }
        } else if (e.key === 'ArrowRight') {
            if (inputStart === this.props.value.length && noSelection) {
                e.preventDefault();
                this.props.onStepOut(this.props.index, +1);
            } else {
                this.checkForSuggestionsAndUpdate(this.props.value, inputStart + 1);
            }
        } else if (e.key === 'Backspace' && inputStart === 0 && noSelection) {
            e.preventDefault();
            this.props.onDeleteSibling(this.props.index, -1);
        } else if (e.key === 'Delete' && inputStart === this.props.value.length && noSelection) {
            e.preventDefault();
            this.props.onDeleteSibling(this.props.index, +1);
        } else if (e.key === 'ArrowUp' && noSelection) {
            e.preventDefault();
            this.props.onMoveSuggestion(-1);
            e.preventDefault();
        } else if (e.key === 'ArrowDown' && noSelection) {
            this.props.onMoveSuggestion(+1);
        } else if (e.key === 'Enter' && noSelection) {
            e.preventDefault();
            this.props.onEnter();
        }
    }

    onUpdate = (e) => {
        const text = e.target.value;
        this.checkForSuggestionsAndUpdate(text, e.target.selectionStart);
    }

    checkForSuggestionsAndUpdate = (text, cursorPosition) => {
        const textToCursor = text.substring(0, cursorPosition);
        const lastChipStart = Math.max(textToCursor.lastIndexOf('+'), textToCursor.lastIndexOf('-'));

        if (lastChipStart > -1) {
            this.props.onUpdate(this.props.index, {
                type: 'input',
                value: text,
                chipType: text[lastChipStart],
                chipStart: lastChipStart,
                cursorPosition: cursorPosition
            });
        } else {
            this.props.onUpdate(this.props.index, {
                type: 'input',
                value: text,
                chipType: undefined,
                chipStart: undefined,
                cursorPosition: undefined
            });
        }
    }

    onClickWrapper = () => {
        this.textInput.focus();

        // Not sure of the reason for this self-assignment (Joe, Oct 2020)
        // but using an intermediate variable to avoid eslint warning
        const value = this.textInput.value;
        this.textInput.value = value;

        this.textInput.input.selectionStart = this.textInput.input.selectionEnd = this.props.value.length;
    }

    onDoubleClickWrapper = () => {
        this.textInput.select();
    }

    onClickInput = (e) => {
        this.textInput.focus();
        e.stopPropagation();
    }

    onFocus = () => {
        this.props.onFocus(this.props.index);
    }

    render() {
        return (
            <span className='input-supper__input-wrapper' onClick={this.onClickWrapper} onDoubleClick={this.onDoubleClickWrapper}>
                <AutosizeInput
                    disabled={this.props.disabled}
                    ref={(input) => {this.textInput = input; }}
                    inputClassName='input-supper__inline-input'
                    type='text'
                    onChange={this.onUpdate}
                    value={this.props.value}
                    inputStyle={{ fontSize: 18, fontFamily: "Avenir Next" }}
                    onKeyDown={this.onKeyPress}
                    onClick={this.onClickInput}
                    onFocus={this.onFocus}
                />
                {this.props.renderSuggestions()}
            </span>
        );
    }
}
