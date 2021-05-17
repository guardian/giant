import React from 'react';
import PropTypes from 'prop-types';
import {NavLink} from 'react-router-dom';

export class CollectionItem extends React.Component {
    static propTypes = {
        uri: PropTypes.string.isRequired,
        display: PropTypes.string.isRequired
    }

    render() {
        return (
            <NavLink to={`/collections/${this.props.uri}`} className='sidebar__item' activeClassName='sidebar__item sidebar__item--active'>
                <div className='sidebar__item__text'>
                    {this.props.display}
                </div>
            </NavLink>
        );
    }
}
