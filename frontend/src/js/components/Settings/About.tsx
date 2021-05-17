import React from 'react';
import {startCase} from 'lodash';
import { GiantState } from '../../types/redux/GiantState';

import {connect} from 'react-redux';

type Props = ReturnType<typeof mapStateToProps>

class About extends React.Component<Props> {

    render() {
        const version = this.props.config.buildInfo;

        return (
            <div className='app__main-content'>
                <h1 className='page-title'>Version Data</h1>
                <table className='data-table'>
                    <tbody>
                    { Object.keys(version).map((key) =>
                        <tr key={key} className='data-table__row'>
                            <td className='data-table__item data-table__item--key'>{startCase(key)}</td>
                            <td className='data-table__item data-table__item--value'>{version[key]}</td>
                        </tr>
                    )}
                    </tbody>
                </table>
                <h1 className='page-title'>Auth token</h1>
                <p>This token can be used for uploading content via the command line tool. DO NOT reveal this to anyone as it allows them access to your account.</p>
                <pre className='wrap-my-pre'>{ this.props.auth.jwtToken }</pre>
            </div>
        );
    }
}

function mapStateToProps(state: GiantState) {
    return {
        config: state.app.config,
        auth: state.auth
    };
}

function mapDispatchToProps() {
    return {
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(About);
