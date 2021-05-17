import React from 'react';
import PropTypes from 'prop-types';
import {searchFilterOption} from '../../types/SearchFilter.js';
import SearchFilterValue from './SearchFilterValue';
import {searchAggBucketPropType} from '../../types/SearchResults';

export class SearchFilterOption extends React.Component {

    static propTypes = {
        rootKey: PropTypes.string.isRequired,
        option: searchFilterOption.isRequired,
        selectedOptions: PropTypes.arrayOf(PropTypes.string).isRequired,
        updateSelectedOptions: PropTypes.func.isRequired,
        aggBucket: searchAggBucketPropType,
        hideable: PropTypes.bool.isRequired,
        missingAggValue: PropTypes.string.isRequired
    }

    state = {
        expanded: false
    }

    toggleExpanded = () => {
        this.setState({
            expanded: !this.state.expanded
        });
    }

    toggleMainSearchFilter = (searchFilterValue) => {

        //Have we just selected the main option? Then we should unselect any subOptions
        if (!this.isMainOptionSelected()) {
            const subOptions = this.props.option.suboptions || [];
            const subOptionValues = subOptions.map((o) => o.value);

            const filteredSelections = this.props.selectedOptions.filter((selectOption) => {
                return subOptionValues.indexOf(selectOption) === -1;
            });

            this.props.updateSelectedOptions(filteredSelections.concat([searchFilterValue]));
        } else {
            this.props.updateSelectedOptions(this.props.selectedOptions.filter((a) => a !== searchFilterValue));
        }
    }

    toggleSubOptionSearchFilter = (searchFilterValue) => {

        //Check if a subOption was selected when main one is Active
        //In this case we unselect the main option and select all subOptions
        //apart from the one that was just clicked.
        if (this.isMainOptionSelected()) {
            const oldSelections = this.props.selectedOptions.filter((value) => {
                return value !== this.props.option.value;
            });

            const subOptions = this.props.option.suboptions || [];
            const subOptionValues = subOptions.map((o) => o.value);
            const filteredSubOptions = subOptionValues.filter((o) => o !== searchFilterValue);

            this.props.updateSelectedOptions(oldSelections.concat(filteredSubOptions));
            return;
        }

        if (this.props.selectedOptions.indexOf(searchFilterValue) === -1) {
            const newSelectedOptions = this.props.selectedOptions.concat([searchFilterValue]);

            const allSubOptions = this.props.option.suboptions || [];
            const allSubOptionsValues = allSubOptions.map((o) => o.value);

            //Are all the suboptions now selected?
            const notAllOptionsAreSelected = allSubOptionsValues.reduce((missingSoFar, value) => {
                return newSelectedOptions.indexOf(value) === -1 ? true : missingSoFar;
            }, false);

            //If all the options are now selected... remove all and select main option
            if (notAllOptionsAreSelected) {
                this.props.updateSelectedOptions(newSelectedOptions);
            } else {
                //Get all the options that arn't subOptions
                const filteredSelectedOptions = newSelectedOptions.filter((val) => {
                    return allSubOptionsValues.indexOf(val) === -1;
                });
                //Add the main option
                this.props.updateSelectedOptions(filteredSelectedOptions.concat([this.props.option.value]));
            }

        } else {
            this.props.updateSelectedOptions(this.props.selectedOptions.filter((a) => a !== searchFilterValue));
        }
    }

    isMainOptionSelected() {
        return this.props.selectedOptions.indexOf(this.props.option.value) !== -1;
    }

    hasCheckedSubOptions() {
        const allSubOptions = this.props.option.suboptions || [];
        const allSubOptionsValues = allSubOptions.map((o) => o.value);

        return allSubOptionsValues.reduce((anySoFar, value) => {
            return this.props.selectedOptions.indexOf(value) !== -1 ? true : anySoFar;
        }, false);
    }

    renderSubOptions() {
        if (!this.state.expanded || !this.props.option.suboptions) {
            return false;
        }

        return this.props.option.suboptions.map((subOption) => {
            return (
                <SearchFilterValue
                    rootKey={this.props.rootKey}
                    key={subOption.value}
                    optionValue={subOption}
                    hideable={this.props.hideable}
                    toggleSelected={this.toggleSubOptionSearchFilter}
                    disabled={this.isMainOptionSelected()}
                    selected={this.props.selectedOptions.indexOf(subOption.value) !== -1}
                    aggBucket={this.props.aggBucket ? this.props.aggBucket.buckets.find(b => b.key === subOption.value) : undefined}
                    missingAggValue={this.props.missingAggValue}
                />
            );
        });
    }

    render () {
        return (
            <div>
                <div className='sidebar__filtervalue' onClick={this.toggleExpanded}>
                    <SearchFilterValue
                        rootKey={this.props.rootKey}
                        optionValue={this.props.option}
                        hideable={this.props.hideable}
                        expandable={this.props.option.suboptions && this.props.option.suboptions.length}
                        expanded={this.state.expanded}
                        selected={this.isMainOptionSelected()}
                        toggleSelected={this.toggleMainSearchFilter}
                        indeterminate={!this.isMainOptionSelected() && this.hasCheckedSubOptions()}
                        aggBucket={this.props.aggBucket}
                        missingAggValue={this.props.missingAggValue}
                        />
                </div>
                {this.renderSubOptions()}
            </div>
        );
    }
}
