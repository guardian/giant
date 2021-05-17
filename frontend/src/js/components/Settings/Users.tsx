import React from 'react';
import {get as _get, sortBy as _sortBy} from 'lodash';
import { PartialUser, User } from '../../types/User';
import { GiantState } from '../../types/redux/GiantState';
import { GiantDispatch } from '../../types/redux/GiantDispatch';
import Modal from '../UtilComponents/Modal';
import { Checkbox } from '../UtilComponents/Checkbox';
import { CreateNewUser } from '../users/CreateNewUser';
import { Dropdown, DropdownProps } from 'semantic-ui-react';

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {deleteUserApi as deleteUser } from '../../services/UserApi';
import {listUsers} from '../../actions/users/listUsers';
import {getMyPermissions} from '../../actions/users/getMyPermissions';
import {getCollections} from '../../actions/collections/getCollections';
import {addCollectionsToUser} from '../../actions/users/addCollectionToUser';
import {setUserPermissions} from '../../actions/users/setUserPermissions';
import MdDone from 'react-icons/lib/md/done';

type Props = ReturnType<typeof mapStateToProps> &
  ReturnType<typeof mapDispatchToProps>;

type State = {
    deletingUsername: undefined | string,
    updatingUsername: undefined | string,
    creatingUserModal: boolean,
    recentlyCopiedToClipboard: boolean,
};
class Users extends React.Component <Props, State> {

    state = {
        deletingUsername: undefined,
        updatingUsername: undefined,
        creatingUserModal: false,
        recentlyCopiedToClipboard: false
    };

    componentDidMount() {
        this.props.listUsers();
        this.props.getCollections();
        this.props.getMyPermissions();
    }

    UNSAFE_componentWillReceiveProps = (nextProps: Props) => {
        if (this.state.creatingUserModal && this.props.creatingUser && !nextProps.creatingUser && nextProps.createUserErrors.length === 0) {
            this.setState({creatingUserModal: false});
        }
    }

    myUser = (username: string) => {
        return _get(this.props.auth, 'token.user.username') === username;
    }

    deleteUser = (username: string | undefined) => {
        if (username) {
            deleteUser(username).then(() => {
                this.onDismissDeleteModal();
                this.props.listUsers();
            });
        }
    }

    isCreatingUser = () => {
        return this.state.creatingUserModal;
    }

    onDismissDeleteModal = () => {
        this.setState({ deletingUsername: undefined });
    };

    confirmDeleteModal = () => {
        return (
            <Modal isOpen={this.state.deletingUsername !== undefined} dismiss={this.onDismissDeleteModal}>
                <div>
                    <h2 className='modal__title'>Really delete user {this.state.deletingUsername}?</h2>
                    <button className='btn' onClick={() => this.deleteUser(this.state.deletingUsername)}>OK</button>
                    <button className='btn' onClick={this.onDismissDeleteModal}>Cancel</button>
                </div>
            </Modal>
        );
    }

    renderAdminButtons() {
        if(this.props.myPermissions.includes('CanPerformAdminOperations')) {
            return (
                <div>
                    <div className='btn-group btn-group--left btn-group--bottom-padding'>
                        <button className='btn' name='creatingUser' onClick={() => this.setState({creatingUserModal:true})}>
                            Create New User
                        </button>
                        <button className='btn' onClick={this.copyEmailsToClipboard}>
                            Copy Usernames To Clipboard
                        </button>
                        {this.state.recentlyCopiedToClipboard ? <MdDone /> : false }
                    </div>
                    <Modal isOpen={this.isCreatingUser()} dismiss={() => this.setState({creatingUserModal:false})}>
                        <CreateNewUser/>
                    </Modal>
                </div>
            );
        }

        return false;
    }

    renderDeleteButton(canManageUser: boolean, username: string) {
        return (
            <button
                disabled={!canManageUser}
                className='btn'
                onClick={() => this.setState({deletingUsername: username})}>
                Delete
            </button>
        );
    }

    renderUserCollections(username: string, selectedCollections: string[]) {
        const allCollections = this.props.collections.map( (coll) =>
            ({key: coll.uri, text: coll.uri, value: coll.uri})
        );
        return (
            <Dropdown placeholder='Collections' fluid multiple selection search
                      options={allCollections}
                      defaultValue={selectedCollections}
                      onChange={this.saveCollections.bind(this, username)}
            />
        );
    }

    saveCollections(username: string, event: React.FormEvent, data: DropdownProps) {
        const selectedValues = data.value;
        this.props.addCollectionsToUser(username, selectedValues);
    }

    savePermissions(username: string, canManageUsers: boolean) {
        this.props.setUserPermissions(username, canManageUsers ? ['CanPerformAdminOperations'] : []);
    }

    renderUser = ({username, displayName, collections, permissions: { granted } }: User) => {
        const canWeManageUsers = this.props.myPermissions.includes('CanPerformAdminOperations');
        const canTheyManageUsers = granted.includes('CanPerformAdminOperations');
        const canWeManageThisUser = !this.myUser(username) && this.props.myPermissions.includes('CanPerformAdminOperations');

        return (
            <tr className={`data-table__row ${canWeManageThisUser ? 'data-table__row--hover': ''}`} key={username}>
                <td className='data-table__item data-table__item--value'>
                    {username}
                </td>
                <td className='data-table__item data-table__item--value'>
                    {displayName}
                </td>
                {canWeManageUsers ?
                    <td className='data-table__item data-table__item--value'>
                        {this.renderUserCollections(username, collections)}
                    </td> : null
                }
                {<td className='data-table__item data-table__item--value'>
                    <Checkbox disabled={!canWeManageThisUser} selected={canTheyManageUsers} onClick={() => this.savePermissions(username, !canTheyManageUsers)}>
                        Admin
                    </Checkbox>
                </td>}
                <td className='data-table__item data-table__item--value'>
                    {this.renderDeleteButton(canWeManageThisUser, username)}
                </td>
            </tr>
        );
    }

    copyEmailsToClipboard = () => {
        navigator.clipboard.writeText(
            this.props.users.map((u: PartialUser) => u.username).join(',')
        );
        this.setState({recentlyCopiedToClipboard: true});
        setTimeout(() => this.setState({recentlyCopiedToClipboard: false}), 500);
    }

    render() {
        const canManageUsers = this.props.myPermissions.includes('CanPerformAdminOperations');

        if(!canManageUsers) {
            return <span>You must be an administrator to use this page</span>;
        }

        return (
            <div className='app__main-content'>
                <h1 className='page-title'>
                    Users
                </h1>
                {this.renderAdminButtons()}
                {this.confirmDeleteModal()}
                <table className='data-table'>
                    <thead>
                        <tr className='data-table__row'>
                            <th className='data-table__item data-table__item--title'>Username</th>
                            <th className='data-table__item data-table__item--title'>Display Name</th>
                            <th className='data-table__item data-table__item--title'>Collections</th>
                            <th className='data-table__item data-table__item--title'>Permissions</th>
                            <th className='data-table__item data-table__item--title'>Delete user</th>
                        </tr>
                    </thead>
                    <tbody>
                        {this.props.users.length ?
                            _sortBy(this.props.users, ({ username }) => username.toLowerCase()).map(this.renderUser)
                        : <tr className='data-table__row'><td className='data-table__item' colSpan={3}>No results found</td></tr>}
                    </tbody>
                </table>
            </div>
        );
    }
}

function mapStateToProps(state: GiantState) {
    return {
        users: state.users.userList,
        collections: state.collections,
        myPermissions: state.users.myPermissions,
        auth: state.auth,
        creatingUser: state.users.creatingUser,
        createUserErrors: state.users.createUserErrors
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        listUsers: bindActionCreators(listUsers, dispatch),
        getCollections: bindActionCreators(getCollections, dispatch),
        addCollectionsToUser: bindActionCreators(addCollectionsToUser, dispatch),
        getMyPermissions: bindActionCreators(getMyPermissions, dispatch),
        setUserPermissions: bindActionCreators(setUserPermissions, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Users);
