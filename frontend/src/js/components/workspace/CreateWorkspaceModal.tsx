import React, { ReactNode } from 'react';
import Select, { ValueType } from 'react-select';
import InfoIcon from 'react-icons/lib/md/info-outline';
import ReactTooltip from 'react-tooltip';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { createWorkspace } from '../../actions/workspaces/createWorkspace';
import { Checkbox } from '../UtilComponents/Checkbox';
import { WorkspacePublicInfoIcon } from './WorkspacePublicInfoIcon';
import { WorkspacePublicMessage } from './WorkspacePublicMessage';
import { GiantDispatch } from '../../types/redux/GiantDispatch';

interface PropsFromParent {
    onComplete: () => void
}

type Props = ReturnType<typeof mapStateToProps>
    & ReturnType<typeof mapDispatchToProps>
    & PropsFromParent

type State = {
    name: string,
    isPublic: boolean,
    tagColor: ValueType<{ value: string, label: string }, boolean>
};

class CreateWorkspaceModalUnconnected extends React.Component<Props, State> {
    state = {
        name: '',
        isPublic: false,
        tagColor: { value: 'grey', label: 'Grey' }
    }

    onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        this.props.createWorkspace(this.state.name, this.state.isPublic, this.state.tagColor.value);
        this.props.onComplete();
    }

    handleChange = (e: React.ChangeEvent<HTMLInputElement>) => this.setState({'name': e.currentTarget.value});

    render() {
        const tagExplain = 'Tags are used to quickly indicate if a document is in a workspace you follow';

        return (
            <form className='form' onSubmit={this.onSubmit}>
                <h2>New Workspace</h2>
                <div className='form__row'>
                    <label className='form__label' htmlFor='#name'>
                        Name
                    </label>

                    <input
                        name='name'
                        className='form__field'
                        type='text'
                        autoFocus
                        placeholder='Name'
                        autoComplete="off"
                        onChange={this.handleChange}
                        value={this.state.name}/>
                </div>

                <div className='form__row'>
                    <WorkspacePublicInfoIcon />
                    <Checkbox
                        selected={this.state.isPublic}
                        onClick={(e) => this.setState({isPublic: !this.state.isPublic})}
                    >
                        Public
                    </Checkbox>
                </div>

                <div className='form__row'>
                    <label className='form__label' htmlFor='#tagColor'>
                        Tag Colour
                        <InfoIcon className='info-icon' data-tip={tagExplain} data-effect='solid'/>
                    </label>
                    <Select
                        name='tagColor'
                        value={this.state.tagColor}
                        className='form__select'
                        options={[
                            { value: 'grey', label: 'Grey'},
                            { value: 'red', label: 'Red'},
                            { value: 'green', label: 'Green'},
                            { value: 'blue', label: 'Blue'},
                            { value: 'orange', label: 'Orange'},
                            { value: 'purple', label: 'Purple'}
                        ]}
                        valueComponent={ColorTagValue}
                        optionComponent={ColorTagOption}
                        onChange={(o: ValueType<{ value: string, label: string }, false>) => this.setState({tagColor: o})}
                        clearable={false}
                        searchable={false}
                    />
                </div>
                {this.state.isPublic ? <WorkspacePublicMessage /> : false}
                <button
                    className='btn'
                    type='submit'
                    disabled={!this.state.name}>Create</button>
                <ReactTooltip insecure={false} html={false}/>
            </form>
        );
    }
}

type ColorTagOptionProps = {
    children: ReactNode[] | ReactNode
    className: string,
    isDisabled: boolean,
    isFocused: boolean,
    isSelected: boolean,
    onFocus: (o: { value: string, title: string }, e: React.MouseEvent) => void,
    onSelect: (o: { value: string, title: string }, e: React.MouseEvent) => void,
    option: { value: string, title: string },
}

class ColorTagOption extends React.Component<ColorTagOptionProps> {
    handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.props.onSelect(this.props.option, e);
    }

    handleMouseEnter = (e: React.MouseEvent) => {
        this.props.onFocus(this.props.option, e);
    }

    handleMouseMove = (e: React.MouseEvent) => {
        if (this.props.isFocused) return;
        this.props.onFocus(this.props.option, e);
    }

    render () {
        const colorClass = `workspace__tag--${this.props.option.value}`;

        return (
            <div className={this.props.className + ' workspace-modal__tag-dropdown'}
                onMouseDown={this.handleMouseDown}
                onMouseEnter={this.handleMouseEnter}
                onMouseMove={this.handleMouseMove}
                title={this.props.option.title}>

                <div className={`workspace__tag ${colorClass}`}/>
                {this.props.children}
            </div>
        );
    }
}

type ColorTagValueProps = {
    children: ReactNode[] | ReactNode
    value: {value: string}
}

class ColorTagValue extends React.Component<ColorTagValueProps> {
    render() {
        const colorClass = `workspace__tag--${this.props.value.value}`;

        return (
            <div className='Select-value'>
                <span className='Select-value-label workspace-modal__tag-dropdown'>
                    <div className={`workspace__tag ${colorClass}`}/>
                    {this.props.children}
                </span>
            </div>
        );
    }
}

function mapStateToProps() {
    return {};
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        createWorkspace: bindActionCreators(createWorkspace, dispatch),
    };
}
export default connect(mapStateToProps, mapDispatchToProps)(CreateWorkspaceModalUnconnected);
