import React from 'react';
import PropTypes from 'prop-types';

import SidebarSearchLink from '../UtilComponents/SidebarSearchLink';

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {invalidateAuthToken} from '../../actions/auth/invalidateAuthToken';
import {getMyPermissions} from '../../actions/users/getMyPermissions';

class SettingsSidebar extends React.Component {
    static propTypes = {
        invalidateAuthToken: PropTypes.func.isRequired,
        getMyPermissions: PropTypes.func.isRequired,
        myPermissions: PropTypes.arrayOf(PropTypes.string).isRequired
    }

    componentDidMount() {
        this.props.getMyPermissions();
    }

    logout = () => {
        this.props.invalidateAuthToken();
    }

    renderAdminLinks = () => {
        return <React.Fragment>
            <SidebarSearchLink className='sidebar__item' to='/settings/uploads'>
                <div className='sidebar__item__text'>Uploads</div>
            </SidebarSearchLink>
            <SidebarSearchLink className='sidebar__item' to='/settings/users'>
                <div className='sidebar__item__text'>Users</div>
            </SidebarSearchLink>
            <SidebarSearchLink className='sidebar__item' to='/settings/failures'>
                <div className='sidebar__item__text'>Extraction Failures</div>
            </SidebarSearchLink>
            <SidebarSearchLink className='sidebar__item' to='/settings/file-types'>
                <div className='sidebar__item__text'>File Types</div>
            </SidebarSearchLink>
        </React.Fragment>;
    }

    render() {
        const canManageUsers = this.props.myPermissions.includes('CanPerformAdminOperations');

        return <div className='sidebar'>
            <div className='sidebar__group'>
                <div className='sidebar__title'>Settings</div>
                <SidebarSearchLink className='sidebar__item' to='/settings/dataset-permissions'>
                    <div className='sidebar__item__text'>Dataset Permissions</div>
                </SidebarSearchLink>
                <SidebarSearchLink className='sidebar__item' to='/settings/features'>
                    <div className='sidebar__item__text'>Feature Switches</div>
                </SidebarSearchLink>
                <SidebarSearchLink className='sidebar__item' to='/settings/about'>
                    <div className='sidebar__item__text'>About</div>
                </SidebarSearchLink>
                {canManageUsers ? this.renderAdminLinks() : false}
                <div className='sidebar__item'>
                    <button className='sidebar__item__text btn-link' onClick={this.logout}>Logout</button>
                </div>
            </div>
        </div>;
    }
}

function mapStateToProps(state) {
    return {
        myPermissions: state.users.myPermissions
    };
}

function mapDispatchToProps(dispatch) {
    return {
        invalidateAuthToken: bindActionCreators(invalidateAuthToken, dispatch),
        getMyPermissions: bindActionCreators(getMyPermissions, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SettingsSidebar);
