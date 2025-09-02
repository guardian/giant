import React from 'react';
import PropTypes from 'prop-types';
import {resourcePropType} from '../../types/Resource';
import _ from 'lodash';

import {keyboardShortcuts} from '../../util/keyboardShortcuts';
import {KeyboardShortcut} from '../UtilComponents/KeyboardShortcut';

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {setResourceView} from '../../actions/urlParams/setViews';

class PreviewSwitcher extends React.Component {
    static propTypes = {
        resource: resourcePropType,
        view: PropTypes.string,
        setResourceView: PropTypes.func.isRequired
    }

    currentViewModeIsValid(resource) {
        if (!this.props.view) {
            return false;
        }
        
        if (this.props.view === 'table' && (!resource.parents || !resource.parents.some(m => m.uri.endsWith("csv") || m.uri.endsWith("tsv")) || !resource.text)) {
            return false;
        }

        if (this.props.view === 'text' && !resource.text) {
            return false;
        }

        if (this.props.view.startsWith('ocr') && !_.get(resource, this.props.view)) {
            return false;
        }

        if (this.props.view === 'preview' && !this.canPreview(resource.previewStatus)) {
            return false;
        }

        return true;
    }

    canPreview(previewStatus) {
        return previewStatus !== 'disabled';
    }

    componentDidUpdateOrMount() {
        if (this.props.resource && this.props.view && !this.currentViewModeIsValid(this.props.resource)) {
            // Automatically switch to a preview if you can preview but there's no extracted text or OCR
            if (this.props.resource.text) {
                this.props.setResourceView('text');
            } else if (this.props.resource.ocr) {
                const languages = Object.keys(this.props.resource.ocr);
                if (languages.length > 0) {
                    this.props.setResourceView(`ocr.${languages[0]}`);
                }
            } else if (this.canPreview(this.props.resource.previewStatus)) {
                this.props.setResourceView('preview');
            }
        }
    }

    componentDidMount() {
        this.componentDidUpdateOrMount();
    }

    componentDidUpdate() {
        this.componentDidUpdateOrMount();
    }

    showText = () => {
        this.props.setResourceView('text');
    }

    showPreview = () => {
        if(this.supported())
            this.props.setResourceView('preview');
    }

    showTable = () => {
        this.props.setResourceView('table');
    }

    renderMultiLangLinks(current, view, textPrefix) {
        if (_.get(this.props.resource, view)) {
            const languages = Object.keys(_.get(this.props.resource, view));
            if (languages.length > 0) {
                return languages.map( l => <PreviewLink key={l} current={current} to={`${view}.${l}`} text={`${textPrefix || ''} (${_.startCase(l)})`} navigate={this.props.setResourceView} />);
            }
        }
        return false;
    }

    render() {
        const current = this.props.view ? this.props.view : this.props.resource.transcript ? 'transcript' : 'text';

        const {parents} = this.props.resource;

        return <nav className='preview__links'>
            <KeyboardShortcut shortcut={keyboardShortcuts.showText} func={this.showText} />
            <KeyboardShortcut shortcut={keyboardShortcuts.showPreview} func={this.showPreview} />
            {this.props.resource.text && !this.props.resource.transcript ? <PreviewLink current={current} text='Text' to='text' navigate={this.props.setResourceView} />    : false}
            {this.props.resource.transcript  ? this.renderMultiLangLinks(current, 'transcript', 'Transcript')    : false}
            {this.props.resource.transcriptVtt  ? this.renderMultiLangLinks(current, 'transcriptVtt', 'Transcript time codes')    : false}
            {!this.props.resource.transcript && this.renderMultiLangLinks(current, 'ocr', 'OCR')}
            {this.canPreview(this.props.resource.previewStatus) ? <PreviewLink current={current} text='Preview' to='preview' navigate={this.props.setResourceView} /> : false}
            {parents && parents.some(m => m.uri.endsWith("csv") || m.uri.endsWith("tsv")) && <PreviewLink current={current} text="Table" to="table" navigate={this.props.setResourceView} /> }
        </nav>;
    }
}

function PreviewLink({current, text, to, navigate }) {
    const active = current === to.toLowerCase();
    const clazz = `btn-link preview__link ${active ? 'preview__link--active' : ''}`;

    const onClick = (e) => {
        e.preventDefault();
        navigate(to);
    };

    return <button href='#' className={clazz} onClick={onClick}>{text}</button>;
}

PreviewLink.propTypes = {
    current: PropTypes.string.isRequired,
    to: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    navigate: PropTypes.func.isRequired
};

function mapStateToProps() {
    return {
    };
}

function mapDispatchToProps(dispatch) {
    return {
        setResourceView: bindActionCreators(setResourceView, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PreviewSwitcher);
