import React from 'react';
import PropTypes from 'prop-types';
import {authorizedDownload} from '../../services/AuthApi';
import {authDownloadLink} from '../../services/DocumentApi';
import {authPreviewLink} from '../../services/PreviewApi';
import {resourcePropType} from '../../types/Resource';
import Modal from '../UtilComponents/Modal';
import Select from 'react-select';
import hdate from 'human-date';
import startCase from 'lodash/startCase';

export class DownloadModal extends React.Component {
    static propTypes = {
        resource: resourcePropType,
        isOpen: PropTypes.bool.isRequired,
        dismissModal: PropTypes.func.isRequired
    };

    state = {
        isOpen: false,
        downloadType: '',
        saveAs: '',
        extension: ''
    }

    resetExtension() {
        if (this.props.resource.parents[0]) {
            const parentUriParts = this.props.resource.parents[0].uri.split('/');
            const lastPart = parentUriParts[parentUriParts.length - 1];
            const lastPartParts = lastPart.split('.');

            if (lastPartParts.length > 1) {
                this.setState({
                    extension: lastPartParts[lastPartParts.length - 1]
                });
            } else {
                this.setState({
                    extension: undefined
                });
            }
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.isOpen && !prevProps.isOpen) {
            if (this.props.resource.parents[0]) {
                if (this.props.resource.type === 'email') {
                    const subject = this.props.resource.subject;
                    this.setState({
                        saveAs: subject ? subject : 'Unknown Subject'
                    });
                } else {
                    const parentUriParts = this.props.resource.parents[0].uri.split('/');
                    const lastPart = parentUriParts[parentUriParts.length - 1];
                    const lastPartParts = lastPart.split('.');

                    let saveAs = '';
                    let extension = '';
                    if (lastPartParts.length > 1) {
                        saveAs = decodeURIComponent(lastPartParts.slice(0, lastPartParts.length - 1));
                        extension = lastPartParts[lastPartParts.length - 1];

                        this.setState({
                            saveAs: saveAs,
                            extension: extension
                        });
                    } else {
                        this.setState({
                            saveAs: lastPart
                        });
                    }
                }
            } else {
                this.setState({
                    saveAs: 'unknown filename' // Should not be able to have a blob without parents
                });
            }
        }
    }

    handleChange = (e) => this.setState({[e.target.name]: e.target.value});

    handleKeyDown = (e) => {
        if(e.key === 'Enter') {
            this.onConfirmClick();
        }
    }

    download(text) {
        let downloadable = text;
        if (this.props.resource.type === 'email') {
            const email = this.props.resource;
            const emailToString = (emailPair) => (emailPair.displayName || '') + (emailPair.displayName && emailPair.address ? ' / ' : '') + (emailPair.address || '');
            let header =
`From:
    ${emailToString(email.from)}

Recipients:
    ${email.recipients.map(r => emailToString(r)).join('\n    ')}

Sent At:
    ${
        email.sentAt
        ?
            hdate.prettyPrint(new Date(email.sentAt), {showTime: true})
        :
            '<Unknown Sent At Date>'
    }

Subject:
    ${email.subject ? email.subject : '<Unknown Subject>'}

Email Body:
================================================================================

`;

            downloadable = header + text;
        }

        var element = document.createElement('a');
        const escaped = encodeURIComponent(downloadable);
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + escaped);
        element.setAttribute('download', this.state.saveAs + '.' + this.state.extension);

        element.click();
    }

    onConfirmClick = (e) => {
        e.stopPropagation();

        const filename = `${this.state.saveAs}.${this.state.extension}`;

        switch (this.state.downloadType) {
            case 'preview': {
                authorizedDownload(authPreviewLink(this.props.resource.uri, filename))
                    .then(target => window.location.href = target);
                break;
            }
            case 'extractedText': {
                const text = this.props.resource.text.replace('<result-highlight>', '').replace('</result-highlight>', '');
                this.download(text);
                break;
            }
            case 'ocrText': {
                this.download(this.props.resource.ocr[this.state.downloadLanguage].contents);
                break;
            }
            case 'original':
            default: {
                authorizedDownload(authDownloadLink(this.props.resource.uri, filename))
                    .then(target => window.location.href = target);
                break;
            }
        }
        this.props.dismissModal();
    };

    downloadTypes() {
        let types = this.props.resource.type !== 'email' ? [{value: 'original', label: 'Original'}] : [];

        if (this.props.resource.previewStatus === 'pdf_generated') {
            types.push({value: 'preview', label: 'PDF Preview'});
        }

        if (this.props.resource.text) {
            types.push({value: 'extractedText', label: 'Extracted Text'});
        }

        if (this.props.resource.ocr) {
            const languages = Object.keys(this.props.resource.ocr);

            for(const language of languages) {
                types.push({value: 'ocrText', label: `OCR Text (${startCase(language)})`, language });
            }
        }

        return types;
    }

    downloadTypeSelected = (v) => {
        switch (v.value) {
            case 'preview':
                this.setState({downloadType: 'perview', extension: 'pdf'});
                break;
            case 'extractedText':
                this.setState({downloadType: 'extractedText', extension: 'txt'});
                break;
            case 'ocrText':
                this.setState({downloadType: 'ocrText', downloadLanguage: v.language, extension: `${v.language}.ocr.txt` });
                break;
            default:
            case 'original':
                this.resetExtension();
                this.setState({downloadType: 'original'});
                break;
        }
    }

    renderModal() {
        return (
            <form className="form">
                <h2 className='modal__title'>Download File</h2>
                <div className='form__row'>
                    <span className='form__label required-field'>Download As</span>
                    <div>
                        <Select
                            name='downloadType'
                            value={this.state.downloadType}
                            autofocus
                            options={this.downloadTypes()}
                            onChange={this.downloadTypeSelected}
                            placeholder="Select download type..."
                            searchable={false}
                            clearable={false}/>
                    </div>
                </div>
                <div className='form__row'>
                    <span className='form__label required-field'>Save As</span>
                    <div className='download-modal__name'>
                        <input
                            name='saveAs'
                            type='text'
                            className='form__field'
                            onChange={this.handleChange}
                            onKeyDown={this.handleKeyDown}
                            value={this.state.saveAs}/>
                        <div className='download-modal_extension'>
                            {this.state.extension ? '.' + this.state.extension : ''}
                        </div>
                    </div>
                </div>
                <button
                    className='btn'
                    onClick={this.onConfirmClick}
                            disabled={!this.state.saveAs || !this.state.downloadType}>Download</button>
            </form>
        );
    }

    render() {
        return (
            <Modal isOpen={this.props.isOpen} dismiss={this.props.dismissModal}>
                {this.renderModal()}
            </Modal>
        );
    }
}
