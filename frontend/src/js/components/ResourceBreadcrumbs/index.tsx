import React from 'react';
import PropTypes from 'prop-types';
import {resourcePropType, Resource as ResourceType} from '../../types/Resource';

import {ResourceTrail} from './ResourceTrail';

type Props = {
    resource: ResourceType,
    showParents: boolean,
    showChildren: boolean,
    showCurrent: boolean,
    className?: string,
    lastSegmentOnly: boolean,
    childClass: string
}

const propTypes = {
    resource: resourcePropType,
    showParents: PropTypes.bool,
    showChildren: PropTypes.bool,
    showCurrent: PropTypes.bool,
    className: PropTypes.string,
    lastSegmentOnly: PropTypes.bool,
    childClass: PropTypes.string
}

export function ResourceBreadcrumbs(props: Props) {
    if (!props.resource) {
        return null;
    }

    return (
        <div className={props.className || 'sidebar__list'}>
            {props.showParents ? props.resource.parents.map((r) => <ResourceTrail key={r.uri} className={props.childClass} resource={r} lastSegmentOnly={props.lastSegmentOnly}/>) : false}
            {props.showCurrent ? <ResourceTrail resource={props.resource} className={props.childClass} lastSegmentOnly={props.lastSegmentOnly}/> : false}
            {props.showChildren ? props.resource.children.map((r) => <ResourceTrail key={r.uri} className={props.childClass} resource={r} lastSegmentOnly={props.lastSegmentOnly}/>) : false}
        </div>
    );
}

ResourceBreadcrumbs.propTypes = propTypes;
