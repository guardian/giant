import React from 'react';
import PropTypes from 'prop-types';
import { collection } from '../../types/Collection';

import { sortBy as _sortBy } from 'lodash';

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getCollections} from '../../actions/collections/getCollections';

class DatasetPermissions extends React.Component {
    static propTypes = {
        collections: PropTypes.arrayOf(collection),
        getCollections: PropTypes.func.isRequired
    }

    componentDidMount() {
        this.props.getCollections();
    }

    render() {
        const colls = this.props.collections || [];
        const sortedColls = _sortBy(colls, ({ display }) => display.toLowerCase());

        return <div className='app__main-content'>
            <h1 className='page-title'>Dataset Permissions</h1>
            <table className='data-table'>
                <thead>
                <tr className='data-table__row'>
                    <th className='data-table__item data-table__item--title'>Dataset</th>
                    <th className='data-table__item data-table__item--title'>Users who can view it</th>
                </tr>
                </thead>
                <tbody>
                    {sortedColls.map(coll =>
                        <tr key={coll.uri}>
                            <td className='data-table__item'>{coll.display}</td>
                            <td className="data-table__item">{coll.users.join(', ')}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    }
}

function mapStateToProps(state) {
    return {
        collections: state.collections
    };
}

function mapDispatchToProps(dispatch) {
    return {
        getCollections: bindActionCreators(getCollections, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(DatasetPermissions);
