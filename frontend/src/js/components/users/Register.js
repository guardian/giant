import React from 'react';
import PropTypes from 'prop-types';
import {RegisterUser} from './RegisterUser';
import * as R from 'ramda';
import {ErrorBarUnconnected} from '../UtilComponents/ErrorBar';

import {connect} from 'react-redux';

class Register extends React.Component {
    static propTypes = {
        config: PropTypes.object.isRequired
    };

    state = {
        errors: []
    }

    onComplete = () => {
        window.location = '/login';
    }

    onError = (text) => {
        this.setState({
            errors: R.append(text, this.state.errors)
        });
    }

    render() {
        const appState = {
            errors: this.state.errors,
            warnings: []
        };

        return (
            <div className='app__content'>
                <ErrorBarUnconnected app={appState} />
                <RegisterUser title='User Registration' config={this.props.config} onComplete={this.onComplete} onError={this.onError}/>
            </div>
        );
    }
}

function mapStateToProps(state) {
    return {
        config: state.app.config
    };
}

function mapDispatchToProps() {
    return {
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Register);
