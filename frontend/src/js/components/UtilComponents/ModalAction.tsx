import React, { useState } from 'react';
import Modal from './Modal';
import { Dropdown } from 'semantic-ui-react';
import _ from 'lodash';

type BaseProps = {
    actionType: string
    actionDescription: string,
    className: string,
    title: string,
    text?: string,
    disabled?: boolean
}

type ConfirmProps = BaseProps & {
    actionType: "confirm",
    onConfirm: () => void
}

type EditProps = BaseProps & {
    actionType: "edit",
    value: string,
    onConfirm: (value: string) => void
}

type SelectMultipleProps = BaseProps & {
    actionType: "select_multiple",
    currentValues: string[],
    possibleValues: string[],
    onConfirm: (values: string[]) => void
}

export default function ModalAction(props: React.PropsWithChildren<ConfirmProps | EditProps | SelectMultipleProps>) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState<string | string[] | undefined>(undefined);

    function onSubmit(e?: React.FormEvent) {
        if(e) {
            e.preventDefault();
        }

        switch(props.actionType) {
            case 'confirm':
                props.onConfirm();
                break;

            case 'edit':
                if(value && value !== props.value) {
                    props.onConfirm((value as string));
                }

                break;
            
            case 'select_multiple':
                if(value && !_.isEqual(value, props.currentValues)) {
                    props.onConfirm((value as string[]));
                }

                break;
        }

        onDismiss();
    }

    function onDismiss() {
        setOpen(false);
        setValue(undefined);
    }

    const canSubmit = props.actionType === "edit" ? value !== undefined && value !== "" : true;

    return <React.Fragment>
        
        {/* The component that triggers the modal (pass-through rendering of children) */}
        <button
            className={props.className}
            disabled={props.disabled}
            onClick={() => setOpen(true)}
        >
            {props.children}
        </button>

        <Modal isOpen={open} dismiss={onDismiss} panelClassName="modal-action__panel">
            <form onSubmit={onSubmit}>
                <div className='modal-action__modal'>
                    <h2>{props.title}</h2>

                    {
                        props.text
                        ?
                            <div className='modal-action__modal-text'>
                                {props.text}
                            </div>
                        :
                            false
                    }

                    {
                        props.actionType === "edit"
                        ?
                            <input
                                type="text"
                                value={value || props.value}
                                onChange={(e) => setValue(e.target.value)}
                                autoFocus={props.actionType === "edit"}
                            />
                        :
                            false
                    }

                    {
                        props.actionType === "select_multiple"
                        ?
                            <Dropdown
                                fluid
                                multiple
                                selection
                                search    
                                placeholder='Select'
                                options={props.possibleValues.map(value => { return { value, text: value } })}
                                defaultValue={value || props.currentValues}
                                onChange={(e, { value }) => setValue((value as string[]))}
                             />
                        :
                            false
                    }

                    <div className='modal-action__buttons'>
                        <button
                            className='btn'
                            onClick={onSubmit}
                            disabled={!canSubmit}
                            autoFocus={props.actionType === 'confirm'}
                        >
                            {props.actionDescription}
                        </button>
                        <button
                            className='btn'
                            onClick={onDismiss}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    </React.Fragment>;
}
