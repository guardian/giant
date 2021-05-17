import React from 'react';
import PropTypes from 'prop-types';
import QRCode from 'qrcode.react';
import { ProgressAnimation } from '../UtilComponents/ProgressAnimation';

export class Setup2Fa extends React.Component {
    static propTypes = {
        username: PropTypes.string.isRequired,
        secret: PropTypes.string.isRequired,
        url: PropTypes.string.isRequired
    }

    renderQrCode() {
        if (!this.props.username) {
            return (
                <div className='users__setup2fa-waiting'>
                    <div style={{'textAlign': 'center'}} className='diminish'>Please provide username</div>
                </div>
            );
        }

        if (!this.props.url) {
            return (
                <div className='users__setup2fa-waiting'>
                    <div style={{'textAlign': 'center'}} className='diminish'>{'Generating QR\u2011Code'}</div>
                    <ProgressAnimation/>
                </div>
            );
        }

        return <React.Fragment>
            <div className='users__qr-code'>
                <QRCode value={this.props.url} size={256} level='H'/>
            </div>
            <div>
                {this.props.secret}
            </div>
        </React.Fragment>;
    }

    render() {
        return (
            <div>
                <ol>
                    <li>Get the authenticator app from your phones app store</li>
                    <li>Go to the setup account page</li>
                    <li>Select the scan barcode option</li>
                    <li>Enter the code below and click finish</li>
                </ol>
                <div className='users__setup2fa-qr-container'>
                    {this.renderQrCode()}
                </div>
            </div>
        );
    }
}
