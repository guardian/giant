import React from 'react';
import PropTypes from 'prop-types';
import * as R from 'ramda';
import _isString from 'lodash/isString';
import _isObject from 'lodash/isObject';

import Chip from './Chip';
import InlineInput from './InlineInput';
import SuggestionsPanel from './SuggestionsPanel';

export default class InputSupper extends React.Component {
    static propTypes = {
        value: PropTypes.string,
        className: PropTypes.string,
        chips: PropTypes.array.isRequired,
        onChange: PropTypes.func.isRequired,
        disabled: PropTypes.bool,
        updateSearchText: PropTypes.func
    }

    state = {
        elements: [],
        currentElement: -1,
        currentChip: 0,
        filteredSuggestions: [],
    }

    focus = () => {
        this.currentRef.focus();
    }

    select = () => {
        this.currentRef.select();
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        if (nextProps.value) {
            this.chippifyText(nextProps.chips, nextProps.value);
        } else {
            this.setState({
                elements: [
                    {
                        type: 'input',
                        value: ''
                    }
                ],
                currentElement: 0
            });
        }
    }

    getChipType = (name) => {
        const chip = this.props.chips.find(s => s.name === name);
        if (chip) {
            return chip.type;
        } else {
            return 'unknown';
        }
    }

    chippifyText(chips, value) {
        let overrideElements = JSON.parse(value).map(e => {
            if (_isString(e)) {
                return {
                    type: 'input',
                    value: e
                };
            } else if (_isObject(e)) {
                return {
                    type: 'chip',
                    name: e.n,
                    value: e.v,
                    negate: e.op === '-',
                    chipType: e.t
                };
            }

            return undefined;
        });

        // Fill options on dropdown chips
        overrideElements = overrideElements.map(c => {
            if (c.chipType === 'dropdown') {
                const chip = chips.find(s => s.name === c.name);
                c.options = chip && chip.options ? chip.options : [];
                return c;
            } else {
                return c;
            }
        });

        if (this.state.elements.length === overrideElements.length &&
            this.state.elements.every((e, i) => overrideElements[i].value.startsWith(e.value))) {
            this.setState({
                elements: this.state.elements.map((e, i) => Object.assign(e, overrideElements[i]))
            });
        } else {
            this.setState({
                elements: overrideElements
            });
        }
    }

    componentDidUpdate() {
        if (this.state.currentElement >= 0) {
            // Actions such as deleting and stepping out of a chip might mean we need to select the END of the current input
            if (this.state.focusEnd) {
                this.currentRef.focusEnd();
                this.setState({
                    focusEnd: undefined
                });
            } else {
                this.currentRef.focus();
            }
        }
        this.flattenAndUpdate(this.state.elements);
    }

    flattenAndUpdate(elements) {
        const flattened = JSON.stringify(elements.map(e => {
            if (e.type === 'input') {
                return e.value;
            } else if (e.type === 'chip') {
                return {
                    n: e.name,
                    v: e.value,
                    op: e.negate ? '-' : '+',
                    t: e.chipType
                };
            }
            return '';
        }));

        // Update internal reference to most recent flattened so we can tell if an
        // external value change requires us to reparse the chips
        if (flattened && flattened !== this.state.flattened) {
            this.props.onChange(flattened);
            this.setState({
                flattened: flattened
            });
        }
    }

    inputUpdated = (index, inputInfo) => {
        const newElement = Object.assign({}, this.state.elements[index], inputInfo);
        const newElements = R.update(index, newElement, this.state.elements);

        const filteredSuggestions = this.props.chips.filter(s => {
            const {value, chipStart, cursorPosition} = newElements[index];
            if (value && chipStart !== undefined && cursorPosition !== undefined) {
                const currentText = value.substring(chipStart + 1, cursorPosition);
                return s.name.toLowerCase().startsWith(currentText.toLowerCase());
            } else {
                return false;
            }
        });

        this.setState({
            currentElement: index,
            elements: newElements,
            currentChip: 0,
            filteredSuggestions: filteredSuggestions
        });

    }

    chipSelected = (field) => {
        // split the input at the current point
        const element = this.state.elements[this.state.currentElement];
        if (element.type === 'input') {
            const {value, chipStart, cursorPosition} = this.state.elements[this.state.currentElement];
            const chipType = this.getChipType(field.name);

            const elementsToInsert = [
                {
                    type: 'input',
                    value: value.substring(0, chipStart).trim()
                },
                {
                    type: 'chip',
                    name: field.name,
                    value: '',
                    negate: value[chipStart] === '-' ? true : false,
                    chipType: chipType,
                    options: field.options
                },
                {
                    type: 'input',
                    value: value.substring(cursorPosition, value.length).trim()
                }
            ];


            this.setState({
                currentElement: this.state.currentElement + 1,
                elements: R.insertAll(
                    this.state.currentElement,
                    elementsToInsert,
                    R.remove(this.state.currentElement, 1, this.state.elements)
                )
            });
        }
    }

    onChipEnterPressed = (index) => {
        this.setState({
            currentElement: index + 1
        });
    }

    onNegateClicked = (index) => {
        const current = this.state.elements[index];
        const newElement = Object.assign({}, this.state.elements[index], {negate: !current.negate});
        const newElements = R.update(index, newElement, this.state.elements);
        this.setState({
            elements: newElements
        });
    }

    onDeleteClicked = (index) => {
        const removed = R.remove(index, 1, this.state.elements);

        const newElements = removed.reduce((acc, cur, i) => {
                if (i - 1 >= 0 && cur.type === 'input' && acc[acc.length - 1].type === 'input') {
                    // If we would merge in an empty input - simply skip that element
                    if (cur.value.trim() === '') {
                        return acc;
                    }

                    return R.update(acc.length - 1, {
                        type: 'input',
                        value: acc[acc.length - 1].value.trim() + ' ' + cur.value.trim()
                    }, acc);
                } else {
                    return R.append(cur, acc);
                }
            }, []);

        this.setState({
            // Deletion offset makes the reslection focus select in the proper position
            focusEnd: true,
            currentElement: index - 1,
            elements: newElements
        });
    }

    onFocus = (index) => {
        this.setState({
            currentElement: index,
            hasFocus: true
        });
    }

    onBlur = () => {
        this.setState({
            // Used for hiding the chips when we have a chip ready to go but no focus
            hasFocus: false
        });
    }

    onStepOut = (index, step) => {
        const targetSibling = index + step;
        if (targetSibling < 0 || targetSibling > this.state.elements.length -1) {
            return;
        }

        // if our step is backwards we need to focus the end of the next element
        const focusEnd = step < 0;

        this.setState({
            currentElement: targetSibling,
            focusEnd: focusEnd
        });
    }

    onDeleteSibling = (index, step) => {
        // Only want to let cells delete their immediate left or right sibling
        if (Math.abs(step) !== 1) {
            return;
        }

        const targetSibling = index + step;
        if (targetSibling < 0 || targetSibling > this.state.elements.length -1) {
            return;
        }

        if (this.state.stagedForDeletion === targetSibling) {
            this.onDeleteClicked(targetSibling);
            this.setState({
                stagedForDeletion: undefined,
            });
        } else {
            this.setState({
                stagedForDeletion: targetSibling,
                deleteExpiry: 2
            });
            this.deleteExpiryInterval = setInterval(this.deleteExpiryTick, 1000);
        }
    }

    deleteExpiryTick = () => {
        if (this.state.deleteExpiry > 0) {
            const countdown = this.state.deleteExpiry - 1;
            this.setState({
                deleteExpiry: countdown
            });

            if (this.state.deleteExpiry <= 0) {
                clearInterval(this.deleteExpiryInterval);
                this.setState({
                    stagedForDeletion: undefined,
                    deleteExpiry: undefined
                });
            }
        }
    }

    moveSuggestions = (step) => {
        const i = this.state.currentChip + step;
        const len = this.state.filteredSuggestions.length;
        this.setState({
            currentChip: (i % len + len) % len
        });
    }

    onEnter = () => {
        const selectedField = this.state.filteredSuggestions[this.state.currentChip];
        if (selectedField) {
            this.chipSelected(selectedField);
        } else {
          this.props.updateSearchText();
        }
    }

    renderElement = (e, index) => {
        switch (e.type) {
            case 'input': {
                const {currentElement, filteredSuggestions, hasFocus} = this.state;

                const shouldRenderSuggestions = currentElement === index && filteredSuggestions.length !== 0 && hasFocus;
                const renderSuggestions = shouldRenderSuggestions ? this.renderSuggestions : () => false;


                return (
                        <InlineInput
                            key={index}
                            disabled={this.props.disabled}
                            ref={r => this.state.currentElement === index ? this.currentRef = r : undefined}
                            index={index}
                            onUpdate={this.inputUpdated}
                            value={e.value}
                            onMoveSuggestion={this.moveSuggestions}
                            onEnter={this.onEnter}
                            onFocus={this.onFocus}
                            onBlur={this.onBlur}
                            onStepOut={this.onStepOut}
                            onDeleteSibling={this.onDeleteSibling}
                            lastInput={index === this.state.elements.length - 1}
                            renderSuggestions={renderSuggestions}/>
                );
            }
            case 'chip': {
                return (
                    <Chip key={index} index={index} negate={e.negate} name={e.name} value={e.value} type={e.chipType} options={e.options}
                        ref={r => this.state.currentElement === index ? this.currentRef = r : undefined}
                        stagedForDeletion={this.state.stagedForDeletion === index}
                        onFocus={this.onFocus}
                        onStepOut={this.onStepOut}
                        onEnterPressed={this.onChipEnterPressed}
                        onUpdate={this.inputUpdated}
                        onDeleteClicked={this.onDeleteClicked}
                        onNegateClicked={this.onNegateClicked}/>
                );
            }

            default:
                //
        }
    }

    chipHover = (idx) => {
        this.setState({
            currentChip: idx,
        });
    }

    renderSuggestions = () => {
        const cIndex = this.state.currentElement;
        if (cIndex >= 0 && cIndex < this.state.elements.length) {
            const cur = this.state.elements[cIndex];
            if (cur.chipStart !== undefined && cur.cursorPosition !== undefined) {
                return <SuggestionsPanel
                    currentIndex={this.state.currentChip}
                    filteredSuggestions={this.state.filteredSuggestions}
                    onSuggestionSelected={this.chipSelected}
                    onSuggestionHover={this.chipHover}
                    />;
            }

        }
        return false;
    }

    render() {
        return (
            <div className={this.props.className}>
                <div className='input-supper'>
                    {this.state.elements.map((e, index) => this.renderElement(e, index))}
                </div>
            </div>
        );
    }
}
