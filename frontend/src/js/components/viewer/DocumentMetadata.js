import React from 'react';
import PropTypes from 'prop-types';
import {resourcePropType} from '../../types/Resource';
import {ResourceBreadcrumbs} from '../ResourceBreadcrumbs';
import HoverSearchLink from '../UtilComponents/HoverSearchLink';
import ViewerActions from './ViewerActions';
import _ from 'lodash';
import hdate from 'human-date';
import { permissionsPropType } from '../../types/User';

export class DocumentMetadata extends React.Component {
    static propTypes = {
        resource: resourcePropType,
        preferences: PropTypes.object,
        myPermissions: permissionsPropType,
    };

    state = {
        raw: false
    };

    renderMetadata = (key, values) => {
        return(
            <li key={key} className='sidebar__list-item'>
                <div className='sidebar__list-title'>{key}</div>
                {
                    values.map(value =>
                        <div key={value} className='sidebar__list-value'>
                            <HoverSearchLink highlight q={value}/>
                        </div>
                    )
                }
            </li>
        );
    };

    renderEnrichedMetadata = (key, value) => {
        const prettyValue = (key === 'createdAt' || key === 'lastModified') ? hdate.prettyPrint(new Date(value), {showTime: true}) : value;

        return(
            <li className="sidebar__list-item" key={key}>
                <div className='sidebar__list-title'>{_.startCase(key)}</div>
                <div className='sidebar__list-value'>
                    <HoverSearchLink highlight q={prettyValue.toString()}/>
                </div>
            </li>
        );
    }

    toggleRaw = () => {
        this.setState({raw: !this.state.raw});
    };

    renderChildren = () => {
        if (this.props.resource.children.length === 0) {
            return false;
        }

        return (
            <div className='sidebar__group'>
                <div className='sidebar__title'>
                    <span>Subdocuments</span>
                </div>
                <ResourceBreadcrumbs resource={this.props.resource} showChildren={true} lastSegmentOnly={true} />
            </div>
        );
    }

    renderDevTools = () => {
        if (!this.props.myPermissions || !this.props.myPermissions.includes('CanPerformAdminOperations')) {
            return false;
        }

        return <React.Fragment>
            <div className='sidebar__title'>Dev Tools</div>

            <ul className='sidebar__list'>
                <li className='sidebar__list-item'>
                    <div className='sidebar__list-title'>elasticsearch</div>
                    <div className='sidebar__list-value'>
                        <a target='_blank' rel='noopener noreferrer' href={`http://localhost:9200/pfi/_doc/${this.props.resource.uri}`}>dev</a>
                    </div>
                    <div className='sidebar__list-value'>
                        <a target='_blank' rel='noopener noreferrer' href={`http://localhost:19200/pfi/_doc/${this.props.resource.uri}`}>prod</a>
                    </div>
                </li>
                <li className='sidebar__list-item'>
                </li>
            </ul>
        </React.Fragment>;
    }

    renderTextViewLink() {
        if (!window.location.href.includes('viewer/')) {
            return null;
        }

        const url = new URL(window.location);
        url.href = url.href.replace('viewer', 'viewer-old');
        url.searchParams.set('view', 'text');

        return <a className="btn" target="_blank" rel="noopener noreferrer" href={url.toString()}>
            View as text
        </a>
    }

    render () {
        const metadata = Object.keys(this.props.resource.metadata || {})
            .map(k => ({key: k, value: this.props.resource.metadata[k]}));

        // Little dance required because empty object doesn't have nice falsey/truthy properties.
        const emdKeys = this.props.resource.enrichedMetadata ? Object.keys(this.props.resource.enrichedMetadata) : undefined;
        const hasEnrichedMetadata =  emdKeys && !!emdKeys.length;
        const enrichedMetadata = hasEnrichedMetadata ? emdKeys.map(k => ({key: k, value: this.props.resource.enrichedMetadata[k]})) : [];

        return (
            <div className='sidebar__group'>
                <div className='sidebar__title'>
                    Actions
                </div>
                <ViewerActions resource={this.props.resource} config={this.props.config} isAdmin={this.props.myPermissions.includes('CanPerformAdminOperations')} />

                <div className='sidebar__title'>
                    Locations
                    {this.renderTextViewLink()}
                </div>

                <ResourceBreadcrumbs childClass='sidebar__list-item' resource={this.props.resource} showParents={true} />

                {this.renderDevTools()}

                <div className='sidebar__title'>
                    <span>File Metadata</span>
                    {hasEnrichedMetadata ?
                        <button className='btn' onClick={this.toggleRaw}>{this.state.raw ? 'View Metadata' : 'View Raw Metadata'}</button>
                        : false
                    }

                </div>
                <ul className='sidebar__list'>
                        {!this.state.raw && hasEnrichedMetadata ?
                            enrichedMetadata.map(metadata => this.renderEnrichedMetadata(metadata.key, metadata.value))
                            : metadata.map(metadata => this.renderMetadata(metadata.key, metadata.value))
                        }
                </ul>

                {this.renderChildren()}

            </div>
        );
    }
}
