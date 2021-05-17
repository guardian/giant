import React from 'react';
import PropTypes from 'prop-types';

function percentageWidth(total, value) {
    return `${(value / total) * 100}%`;
}

export const ProgressBar = (props) => (
    <div className={props.className || 'progress-bar'}>
        <div className='progress-bar__bar' style={{width: percentageWidth(props.highest, props.value)}}></div>
    </div>
);

ProgressBar.propTypes = {
    highest: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired,
    className: PropTypes.string
};