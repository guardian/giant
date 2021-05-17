import React from 'react';
import PropTypes from 'prop-types';

import _isString from 'lodash/isString';
import _isObject from 'lodash/isObject';

export default class LabelSupper extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        value: PropTypes.string.isRequired
    }

    render() {
        const elements = JSON.parse(this.props.value);

        return (
            <p className={this.props.className}>{elements.map((e, i) => {
                if (e && _isString(e)) {
                    return (
                        <span className='label-supper__span' key={i}>{e}</span>
                    );
                } else if (_isObject(e)) {
                    return (
                        <span className='label-supper__span' key={i}>
                            <b className='highlight'>{e.op}</b>
                            <b>[{e.n}: </b>
                            <span>{e.v}</span>
                            <b>]</b>
                        </span>
                    );
                }

                return false;
            })}</p>
        );
    }
}
