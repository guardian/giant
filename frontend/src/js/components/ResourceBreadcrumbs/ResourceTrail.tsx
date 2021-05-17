import React from 'react';
import PropTypes from 'prop-types';
import {Link} from 'react-router-dom';
import zip from 'lodash/zip';
import { BasicResource, basicResourcePropType } from '../../types/Resource';

type ResourceComponentProps = {
    resource: BasicResource,
    className: string,
    lastSegmentOnly: boolean
}

export const ResourceTrail = (props: ResourceComponentProps) => {
    switch(props.resource.type) {
        case('file'):
        case('directory'):
        case('ingestion'):
        case('collection'):
        case('blob'):
        case('email'):
            return <PathBasedResource className={props.className} resource={props.resource} lastSegmentOnly={props.lastSegmentOnly} />;
        default:
            return <div>Unknown Resource Type</div>;
    }
};

// I've retained the proptypes to ensure checking with usages that have not been converted to Typescript yet
ResourceTrail.propTypes = {
    resource: basicResourcePropType,
    className: PropTypes.string,
    lastSegmentOnly: PropTypes.bool
};

type PathBasedResourceProps = {
    className: string,
    resource: BasicResource,
    lastSegmentOnly: boolean
};

type PathSegment = {
    uri: string,
    display: string
};

export function buildSegments(resource: BasicResource): PathSegment[] {
    const uriParts = resource.uri.split("/");
    const displayParts = resource.display ? resource.display.split("/") : [];

    // Ingestions do not have a full display name for backwards compatibility reasons
    const parts = uriParts.length === displayParts.length ?
        zip(uriParts, displayParts) :
        zip(uriParts, uriParts.map(decodeURIComponent));

    let acc = "";
    const ret = [];

    for(const [uri, display] of parts) {
        acc += (acc.length === 0 ? uri : `/${uri}`);
        ret.push({ uri: acc, display: display || uri! })
    }

    return ret;
}

function shrinkDisplay(display: string): string {
    if(display.length > 15) {
        return display.substring(0, 15) + '...';
    }

    return display;
}

function PathBasedResource({ className, resource, lastSegmentOnly }: PathBasedResourceProps) {
    const allSegments = buildSegments(resource);
    const segments = lastSegmentOnly ? [allSegments[allSegments.length - 1]] : allSegments;

    return (
        <div className={className}>
            <div className='resource-browser__path'>
                {
                    segments.map(({ uri, display }, i) => {
                        const isLastSegment = i === (segments.length - 1);

                        return (<Link
                            key={uri}
                            className='resource-browser__resource'
                            to={`/resources/${encodeURI(uri)}`}>
                            {
                                isLastSegment ? display : shrinkDisplay(display)
                            }
                        </Link>);
                    })
                }
            </div>
        </div>
    );
}
