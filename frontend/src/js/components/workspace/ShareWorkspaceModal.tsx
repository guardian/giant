import React, { useState } from 'react';
import { Dropdown } from 'semantic-ui-react';
import _ from 'lodash';
import Modal from '../UtilComponents/Modal';
import { Workspace } from '../../types/Workspaces';
import { PartialUser } from '../../types/User';
import uniq from 'lodash/uniq';
import { setWorkspaceFollowers } from '../../actions/workspaces/setWorkspaceFollowers';
import { Checkbox } from '../UtilComponents/Checkbox';
import { setWorkspaceIsPublic } from '../../actions/workspaces/setWorkspaceIsPublic';
import { WorkspacePublicInfoIcon } from './WorkspacePublicInfoIcon';
import { WorkspacePublicMessage } from './WorkspacePublicMessage';

type Props = {
    workspace: Workspace,
    workspaceUsers: PartialUser[],
    allUsers: PartialUser[],
    currentUser: PartialUser,
    setWorkspaceFollowers: typeof setWorkspaceFollowers
    setWorkspaceIsPublic: typeof setWorkspaceIsPublic
}

export default function ShareWorkspaceModal(props: Props) {
    const currentFollowers: string[] = props.workspaceUsers.map(u => u.username);
    const currentIsPublic = props.workspace.isPublic;
    const [open, setOpen] = useState(false);

    // These should be undefined when the modal is closed.
    // This stops us preserving state across different openings of the modal,
    // because we always want it to reflect the current state of the workspace
    // when initially opened.
    const [followers, setFollowers] = useState<string[] | undefined>(undefined);
    const [isPublic, setIsPublic] = useState<boolean | undefined>(undefined);

    if (followers === undefined && open) {
        setFollowers(currentFollowers);
    }

    if (isPublic === undefined && open) {
        setIsPublic(currentIsPublic);
    }

    function onSubmit(e?: React.FormEvent) {
        if (e) {
            e.preventDefault();
        }

        if (followers !== undefined && !_.isEqual(followers, currentFollowers)) {
            props.setWorkspaceFollowers(props.workspace.id, (followers as string[]));
        }

        if (isPublic !== undefined && isPublic !== currentIsPublic) {
            props.setWorkspaceIsPublic(props.workspace.id, isPublic)
        }

        onDismiss();
    }

    function onDismiss() {
        setOpen(false);
        setFollowers(undefined);
        setIsPublic(undefined);
    }

    const allUsernames = uniq(
        props.allUsers
            .map(({ username }) => username)
            .concat(props.workspaceUsers.map(w => w.username))
        ).filter(u => u !== props.currentUser.username
    );

    return <React.Fragment>

        {/* The component that triggers the modal (pass-through rendering of children) */}
        <button
            className='btn workspace__button'
            disabled={props.currentUser.username !== props.workspace.owner.username}
            onClick={() => setOpen(true)}
        >
            Share Workspace
        </button>

        <Modal isOpen={open} dismiss={onDismiss} panelClassName="modal-action__panel">
            <form onSubmit={onSubmit}>
                <div className='modal-action__modal'>
                    <h2>Share workspace {props.workspace.name}</h2>
                    <div className="form__row">
                        <WorkspacePublicInfoIcon />
                        <Checkbox
                            selected={isPublic}
                            onClick={() => setIsPublic(!isPublic)}
                        >
                            Public
                        </Checkbox>
                    </div>
                    <div className="form__row">
                        <Dropdown
                            fluid
                            multiple
                            selection
                            search
                            disabled={isPublic}
                            placeholder='Select'
                            options={allUsernames.map(value => ({ value, text: value }))}
                            defaultValue={currentFollowers}
                            onChange={(e, { value }) => setFollowers((value as string[]))}
                         />
                    </div>
                    {isPublic ? <WorkspacePublicMessage /> : false}
                    <div className='modal-action__buttons'>
                        <button
                            className='btn'
                            onClick={onSubmit}
                            disabled={false}
                            autoFocus={false}
                        >
                            Save
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
