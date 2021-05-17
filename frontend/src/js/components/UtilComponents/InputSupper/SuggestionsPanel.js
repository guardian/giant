import React from 'react';
import PropTypes from 'prop-types';
import md5 from 'md5';

export default class SuggestionsPanel extends React.Component {
    static propTypes = {
        currentIndex: PropTypes.number.isRequired,
        filteredSuggestions: PropTypes.array.isRequired,

        onSuggestionHover: PropTypes.func.isRequired,
        onSuggestionSelected: PropTypes.func.isRequired
    }

    state = {
        currentItem: 0
    }

    suggestionClicked = (suggestion) => {
        return () => this.props.onSuggestionSelected(suggestion);
    }

    suggestionHover = (index) => {
        return () => this.props.onSuggestionHover(index);
    }

    render() {
        if (this.props.filteredSuggestions === []) {
            return false;
        }

        return (
            <div className='select-list'>
                <ul className='select-list__container'>
                    {
                        this.props.filteredSuggestions
                            .map((s, idx) =>
                                    <li key={md5(s.name)}
                                        className={this.props.currentIndex === idx ? 'select-list__item select-list__item--selected' : 'select-list__item'}
                                        onClick={this.suggestionClicked(s)}
                                        onMouseOver={this.suggestionHover(idx)}>
                                        {s.name}
                                    </li>
                             )
                    }
                </ul>
            </div>
        );
    }
}
