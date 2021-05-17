import React from 'react';
import PropTypes from 'prop-types';

type PropTypes = {
    done: number,
    todo: number,
    failed: number,
}

export function MimeTypeProgress({ done, todo, failed }: PropTypes) {
    const total = done + todo + failed;
    const successWidth = (done / total) * 100;
    const failureWidth = (failed / total) * 100;

    return <div className="sparkchart-bar">
        <div className="sparkchart-bar__cell sparkchart-bar__success" style={{width: `${successWidth}%`}}></div>
        <div className="sparkchart-bar__cell sparkchart-bar__failure" style={{width: `${failureWidth}%`}}></div>
    </div>;
}
