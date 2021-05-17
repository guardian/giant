import React from 'react';
import PropTypes from 'prop-types';
import { ProgressAnimation } from '../UtilComponents/ProgressAnimation';
import { config } from '../../types/Config';

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {createUser} from '../../actions/users/createUser';

export class CreateNewUserUnconnected extends React.Component {
    static propTypes = {
        config: config,
        createUser: PropTypes.func.isRequired,
        errors: PropTypes.arrayOf(PropTypes.string).isRequired,
        requesting: PropTypes.bool.isRequired
    };

    state = {
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
        creatingUser: false,
    };

    databaseContinue() {
        return this.props.config.userProvider === 'database' &&
            this.state.username &&
            this.state.password &&
            this.state.confirmPassword;
    }

    pandaContinue() {
        return this.props.config.userProvider === 'panda' &&
            this.state.email;
    }

    canContinue = () => {
        return (this.databaseContinue() || this.pandaContinue()) &&
            this.errors().length === 0 &&
            !this.props.requesting;
    };

    errors = () => {
        let errors = [];
        // https://www.oreilly.com/library/view/regular-expressions-cookbook/9781449327453/ch04s01.html#validation-email-solution-simpleall
        const emailRegex = /^[A-Z0-9_!#$%&'*+/=?`{|}~^.-]+@[A-Z0-9.-]+$/i;

        if (this.props.config.userProvider === 'database') {

            if (this.props.existingUsers.some(existingUser => existingUser.username === this.state.username)) {
                errors.push('The user already exists');
                return errors;
            }

            if (this.state.password) {
                const mismatch = this.state.password !== this.state.confirmPassword;
                const passwordTooShort = this.state.password.length < this.props.config.authConfig.minPasswordLength;
                if (mismatch) errors.push('Passwords do not match');
                if (passwordTooShort) errors.push('Password is too short');
            } else {
                errors.push('Enter a password');
            }
        } else if (this.props.config.userProvider === 'panda') {

            if (this.props.existingUsers.some(existingUser => existingUser.username === this.state.email)) {
                errors.push('The user already exists');
                return errors;
            }

            if (!emailRegex.test(this.state.email)) {
                errors.push('Enter a valid e-mail address');
            }
        }

        return errors;
    };

    submit = (e) => {
        e.preventDefault();

        if (this.canContinue()) {
            if (this.databaseContinue()) {
                this.props.createUser(this.state.username, this.state.password);
            } else if (this.pandaContinue()) {
                this.props.createUser(this.state.email);
            }
        }
    };

    renderActions = () => {
        const errors = [].concat(this.errors(), this.props.errors);

        let progress = <span className='error'>
            <strong>{errors.join(', ')}</strong>
        </span>;

        if(this.props.requesting) {
            progress = <ProgressAnimation />;
        }

        const enabled = this.canContinue();

        return (
            <div className='form__actions'>
                <button className='btn' type='submit' disabled={!enabled}>
                    Finish
                </button>
                {progress}
            </div>
        );
    }

    updateState = (e) => {
        this.setState({[e.target.name]: e.target.value});
    };

    removeWhitespaceAndUpdateState = (e) => {
        this.setState({[e.target.name]: e.target.value.replace(/\s/g, '')});
    }

    renderField = (name, label, type, onChange, onKeyDown, autofocus) => {
        return (
            <div className='form__row'>
                <label className='form__label' htmlFor={'#' + name}>{label}</label>
                    <input
                        id={name} className='form__field' autoFocus={autofocus}
                        type={type} name={name} placeholder={label}
                        value={this.state[name]} onChange={onChange}
                        onKeyDown={onKeyDown} autoComplete='off' required />
            </div>
        );
    }

    renderDatabaseProvider() {
        return (
            <form className='form' onSubmit={this.submit}>
                <h2>Create New User</h2>
                {this.renderField('username', 'Username', 'text', this.removeWhitespaceAndUpdateState, undefined,true)}
                {this.renderField('password', 'Temporary Password', 'password', this.updateState, undefined, false)}
                {this.renderField('confirmPassword', 'Confirm Temporary Password', 'password', this.updateState, (e) => {
                    if(e.key === 'Enter') {
                        this.submit(e);
                    }
                }, false)}
                {this.renderActions()}
            </form>
        );
    }

    renderPandaProvider() {
        return (
            <form className='form' onSubmit={this.submit}>
                <h2>Create New User</h2>
                {this.renderField('email', 'E-mail', 'text', this.removeWhitespaceAndUpdateState, undefined, true)}
                {this.renderActions()}
            </form>
        );
    }

    render() {
        if (!this.props.config) {
            return false;
        }

        if (this.props.config.userProvider === 'database') {
            return this.renderDatabaseProvider();
        } else if (this.props.config.userProvider === 'panda') {
            return this.renderPandaProvider();
        } else {
            return <p>Unknown provider, check server configuration.</p>;
        }
    }
}

function mapStateToProps(state) {
    return {
        config: state.app.config,
        errors: state.users.createUserErrors,
        requesting: state.users.creatingUser,
        existingUsers: state.users.userList
    };
}

function mapDispatchToProps(dispatch) {
    return {
        createUser: bindActionCreators(createUser, dispatch),
    };
}

export const CreateNewUser = connect(mapStateToProps, mapDispatchToProps)(CreateNewUserUnconnected);
