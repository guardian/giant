import React, { useState } from 'react';
import Modal from '../UtilComponents/Modal';
import { Workspace } from '../../types/Workspaces';
import { PartialUser } from '../../types/User';
import {takeOwnershipOfWorkspace} from "../../actions/workspaces/takeOwnershipOfWorkspace";

type Props = {
    workspace: Workspace,
    isAdmin: Boolean,
    currentUser: PartialUser,
    takeOwnershipOfWorkspace: typeof takeOwnershipOfWorkspace
}

export default function TakeOwnershipOfWorkspaceModal(props: Props) {
    const [open, setOpen] = useState(false);

    function onSubmit(e?: React.FormEvent) {
        if (e) {
            e.preventDefault();
        }

        if (props.isAdmin) {
            props.takeOwnershipOfWorkspace(props.workspace.id, props.currentUser.username)
        }
        onDismiss();
    }

    function onDismiss() {
        setOpen(false);
    }

    return props.currentUser.username !== props.workspace.owner.username && !props.isAdmin ? null : <React.Fragment>

        {/* The component that triggers the modal (pass-through rendering of children) */}
        <button
            className='btn workspace__button'
            onClick={() => setOpen(true)}
        >
            Take Ownership
        </button>

        <Modal isOpen={open} dismiss={onDismiss} panelClassName="modal-action__panel">
            <form onSubmit={onSubmit}>
                <div className='modal-action__modal'>
                    <h2>Take over workspace {props.workspace.name}</h2>
                    <div className='modal-action__buttons'>
                        <button
                            className='btn'
                            onClick={onSubmit}
                            disabled={false}
                            autoFocus={false}
                        >
                            Take Ownership
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
