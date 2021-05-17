
import React from 'react';
import PropTypes from 'prop-types';
import md5 from 'md5';

import { config } from '../../types/Config';
import { ProgressAnimation } from '../UtilComponents/ProgressAnimation';
import { CreateGenesisUser } from '../users/CreateGenesisUser';

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getAuthToken} from '../../actions/auth/getAuthToken';
import {setupCheck} from '../../actions/users/genesisSetupCheck';

class Login extends React.Component {
    static AUTO_AUTH_KEY = 'autoAuthAttempts';

    static propTypes = {
        requesting: PropTypes.bool.isRequired,
        errors: PropTypes.arrayOf(PropTypes.string).isRequired,
        getToken: PropTypes.func.isRequired,
        getGenesisSetupState: PropTypes.func.isRequired,
        genesisSetupComplete: PropTypes.bool.isRequired,
        require2fa: PropTypes.bool.isRequired,
        requirePanda: PropTypes.bool.isRequired,
        config: config
    };

    state = {
        username: '',
        password: '',
        tfaCode: '',
        auth: null
    };

    componentDidMount() {
        this.props.getGenesisSetupState();
        if (this.props.genesisSetupComplete && this.props.config.userProvider === 'panda') {
            this.autoLogin();
        }
    }

    componentWillUnmount() {
        // run this when the login component stops being displayed (a good proxy for a successful login)
        localStorage.removeItem(Login.AUTO_AUTH_KEY);
    }

    componentDidUpdate(prevProps) {
        if (this.props.require2fa && !prevProps.require2fa) {
            this.tfaInput.focus();
        }
    }

    login = (e) => {
        e && e.preventDefault();
        this.props.getToken(this.state.username, this.state.password, this.state.tfaCode);
    };

    // when using panda we should be able to automatically login, but we need some logic to
    // ensure that we don't go around in circles
    autoLogin = () => {
        const lsAuthAttempts = localStorage.getItem(Login.AUTO_AUTH_KEY);
        const attemptsString = lsAuthAttempts || '0';
        const attempts = parseInt(attemptsString) + 1;
        localStorage.setItem(Login.AUTO_AUTH_KEY, attempts);

        if (attempts < 3 && this.props.errors.length === 0) {
            this.login();
        } else if (attempts >= 3) {
            // do nothing other than reset the state ready for a page refresh
            console.log('auto login attempts exceeded');
            localStorage.removeItem(Login.AUTO_AUTH_KEY);
        }
    };

    updateUsername = (e) => {
        this.setState({username: e.target.value});
    };

    updatePassword = (e) => {
        this.setState({password: e.target.value});
    };

    updateTfaCode = (e) => {
        this.setState({tfaCode: e.target.value});
    };

    databaseLoginEnabled() {
        return this.props.config.userProvider === 'database' &&
            ((!this.props.require2fa && this.state.username && this.state.password) || (this.props.require2fa && this.state.tfaCode));
    }

    pandaLoginEnabled() {
        return this.props.config.userProvider === 'panda';
    }

    renderActions = () => {
        let progress = <p className='form__error'>
            {this.props.errors.join(' ')}
        </p>;

        if(this.props.requesting) {
            progress = <ProgressAnimation />;
        }

        const enabled = (this.databaseLoginEnabled() || this.pandaLoginEnabled()) && !this.props.requesting;

        return (
            <div className='form__actions'>
                <button className='btn' type='submit' disabled={!enabled}>
                    Login
                </button>
                {progress}
            </div>
        );
    }

    renderUsernamePassword() {
        return (
            <div className='app__page app__page--centered'>
                <form className='form' onSubmit={this.login}>
                    <h2 className='form__title'>Login</h2>
                    <div className='form__row'>
                        <label className='form__label' htmlFor='#username'>Username</label>
                        <input
                            className='form__field'
                            id='username'
                            name='username'
                            type='text'
                            placeholder='Username'
                            value={this.state.username}
                            onChange={e => this.updateUsername(e)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className='form__row'>
                        <label className='form__label' htmlFor='#password'>Password</label>
                        <input
                            className='form__field'
                            id='password'
                            name='password'
                            type='password'
                            placeholder='Password'
                            value={this.state.password}
                            onChange={e => this.updatePassword(e)}
                            required
                        />
                    </div>

                    {this.renderActions()}
                </form>
            </div>
        );
    }

    render2fa() {
        return (
            <div className='app__page app__page--centered'>
                <form className='form' onSubmit={this.login}>
                    <h2 className='form__title'>Login</h2>
                    <div>
                        <label className='form__label' htmlFor='#tfa'>Authentication Code</label>
                        <input
                            ref={input => {this.tfaInput = input;}}
                            className='form__field'
                            id='tfa'
                            name='tfa'
                            type='text'
                            placeholder='Authentication Code'
                            value={this.state.tfaCode}
                            onChange={e => this.updateTfaCode(e)}
                            autoComplete='off'
                            required
                            autoFocus
                        />
                    </div>
                    {this.renderActions()}
                </form>
            </div>
        );
    }

    renderForbidden() {
        return (
            <div className='app__page app__page--centered'>
                <div className='form'>
                    <h2>Forbidden</h2>
                    <div>
                        <p>
                            Your account has been blocked from accessing the platform for the following reasons:
                        </p>

                        {this.props.errors.map(e => <p key={md5(e)}>{e}</p>)}

                        <p>
                            If you think this is a mistake please contact your administrator, providing them with the information above.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    renderDatabaseProvider(require2fa) {
        if (require2fa) {
            return this.render2fa();
        } else {
            return this.renderUsernamePassword();
        }
    }

    renderPanDomainProvider() {
        if (this.props.requirePanda) {
            console.log('Redirecting away from SPA to login service.');

            const currentUrl = new URL(window.location);
            const returnUrl = currentUrl.searchParams.get('returnUrl') || currentUrl.href;

            const newUrl = new URL(this.props.config.authConfig.loginUrl);
            newUrl.searchParams.set('returnUrl', returnUrl);

            window.location.href = newUrl.href;
            return false;
        } else {
            return (
                <div className='app__page app__page--centered'>
                    <form className='form' onSubmit={this.login}>
                        <h2 className='form__title'>Login</h2>

                        {this.renderActions()}
                    </form>
                </div>
            );
        }
    }

    render() {
        const {genesisSetupComplete, require2fa } = this.props;
        if (genesisSetupComplete) {
            if (this.props.config.userProvider === 'database') {
                return this.renderDatabaseProvider(require2fa);
            } else if (this.props.config.userProvider === 'panda') {
                return this.renderPanDomainProvider();
            }

        } else {
            return <CreateGenesisUser/>;
        }
    }
}

function mapStateToProps(state) {
    const { requesting, errors, require2fa, requirePanda } = state.auth;
    const { genesisSetupComplete } = state.users;
    const { config } = state.app;

    return {
        config,
        requesting,
        errors,
        genesisSetupComplete,
        require2fa,
        requirePanda
    };
}

function mapDispatchToProps(dispatch) {
    return {
        getToken: bindActionCreators(getAuthToken, dispatch),
        getGenesisSetupState: bindActionCreators(setupCheck, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(Login);
