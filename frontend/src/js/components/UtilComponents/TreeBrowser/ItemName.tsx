import React, { MutableRefObject } from 'react';
import MagicTextInput from './MagicTextInput';
import { GiantState } from '../../../types/redux/GiantState';
import { GiantDispatch } from '../../../types/redux/GiantDispatch';
import { bindActionCreators } from 'redux';
import { setEntryBeingRenamed } from '../../../actions/workspaces/setEntryBeingRenamed';
import { connect } from 'react-redux';
import { TreeEntry } from '../../../types/Tree';

type Props<T> = {
    id: string,
    name: string,
    canEdit: boolean,
    onFinishRename: (name: string) => void
    setEntryBeingRenamed: typeof setEntryBeingRenamed,
    entryBeingRenamed: TreeEntry<T> | null
};

type State =  {
    isContextMenuOpen: boolean,
    newName: string,
};

class ItemNameUnconnected<T> extends React.Component<Props<T>, State> {

    componentDidMount() {
        this.setState({newName: this.props.name});
    }

    spanRef: MutableRefObject<null> = React.createRef();

    state = {
        isContextMenuOpen: false,
        newName: '',
    };

    isBeingEdited() {
        return this.props.entryBeingRenamed && (this.props.entryBeingRenamed.id === this.props.id);
    }

    onChange = (newName: string) => {
        this.setState({
            newName
        });
    };

    onSave = () => {
        if (this.state.newName) {
            this.props.onFinishRename(this.state.newName);
        }

        this.props.setEntryBeingRenamed(null);
    };

    onDismiss = () => {
        this.setState({
            newName: this.props.name
        });
        this.props.setEntryBeingRenamed(null);
    };

    render() {
        if (this.isBeingEdited()) {
            return (
                <MagicTextInput
                    className='file-browser__rename-input'
                    value={this.state.newName}
                    placeholder={this.props.name}
                    onChange={this.onChange}
                    onSave={this.onSave}
                    onDismiss={this.onDismiss}
                />
            );
        }
        return (
            <span>{this.props.name}</span>
        );
    }
}

function mapStateToProps(state: GiantState) {
    return {
        entryBeingRenamed: state.workspaces.entryBeingRenamed,
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        setEntryBeingRenamed: bindActionCreators(setEntryBeingRenamed, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ItemNameUnconnected);
