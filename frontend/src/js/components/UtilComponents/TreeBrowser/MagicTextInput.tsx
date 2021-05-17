import React from 'react';
import onClickOutside from 'react-onclickoutside';

type Props = {
    placeholder: string
    value: string
    onChange: (newValue: string) => void
    onDismiss: () => void
    onSave: () => void
    className: string
};

class MagicTextInput extends React.Component<Props, {}> {
    static defaultProps = {
        className: 'form__field'
    };

    handleClickOutside = () => {
        if(this.props.value) {
            this.props.onSave();
        } else {
            this.props.onDismiss();
        }
    };

    onKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if(e.key === 'Enter') {
            this.props.onSave();
        } else if(e.key === 'Escape') {
            this.props.onDismiss();
        }
    };

    render() {
        return (
            <input
                type='text'
                className={this.props.className}
                placeholder={this.props.placeholder}
                value={this.props.value}
                onKeyDown={this.onKeyDown}
                onChange={e => this.props.onChange(e.target.value)}
                autoFocus
                onFocus={e => {
                    // ABSOLUTE MADNESS TO AUTO-FOCUS WITH THE CURSOR AT THE END
                    const before = e.target.value;
                    e.target.value = '';
                    e.target.value = before;
                }}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onMouseUp={e => e.stopPropagation()}
            />
        );
    }
}

export default onClickOutside(MagicTextInput);
