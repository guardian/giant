import React from 'react';
import PropTypes from 'prop-types';
import {resourcePropType} from '../../types/Resource';
import {ResourceBreadcrumbs} from '../ResourceBreadcrumbs';
import ViewerActions from './ViewerActions';

export class EmailMetadata extends React.Component {
    static propTypes = {
        resource: resourcePropType,
        config: PropTypes.object,
        isAdmin: Boolean
    }

    render() {
        return (
            <div className='sidebar__group'>
                <div className='sidebar__title'>
                    Actions
                </div>
                <ViewerActions
                    resource={this.props.resource}
                    config={this.props.config}
                    isAdmin={this.props.isAdmin}
                    // emails are awkward to delete so keep this disabled for now
                    disableDelete={true}
                />

                <div className='sidebar__title'>
                    Locations
                </div>
                <ResourceBreadcrumbs childClass='sidebar__list-item' resource={this.props.resource} showParents={true} />

                {
                    this.props.resource.children.length > 0
                    ?
                    <div>
                        <div className='sidebar__title'>
                            <span>Attachments</span>
                        </div>
                        <ResourceBreadcrumbs className='sidebar__list document__metadata__resources' resource={this.props.resource} showChildren={true} lastSegmentOnly={true} />
                    </div>
                    : false
                }
            </div>
        );
    }
}
