import React from 'react';
import PropTypes from 'prop-types';
import SearchIcon from 'react-icons/lib/md/search';
import {Link} from 'react-router-dom';
import buildLink from '../../util/buildLink';

import {connect} from 'react-redux';

class HoverSearchLinkUnconnected extends React.Component {
    static propTypes = {
        iconOnLeft: PropTypes.bool,
        highlight: PropTypes.bool,
        q: PropTypes.string.isRequired,
        display: PropTypes.string,
        urlParams: PropTypes.object,
        title: PropTypes.string,
        chipName: PropTypes.string,
        chipNegate: PropTypes.bool,
        type: PropTypes.string
    }

    render() {
        var wrapperClass = 'hover-search-link__icon-wrapper';
        if (this.props.iconOnLeft) {
            wrapperClass = 'hover-search-link__icon-wrapper--left';
        }

        var iconClass = 'hover-search-link__icon hover-show__hidden';
        if (this.props.highlight) {
                iconClass = 'hover-search-link__icon--highlighted hover-show__hidden';
        }

        let query;
        if (this.props.chipName) {
            const chip = {
                n: this.props.chipName,
                v: '"' + this.props.q + '"',
                op: this.props.chipNegate ? '-' : '+',
                t: this.props.type
            };

            query = JSON.stringify(['', chip, '']);
        } else {
            query = JSON.stringify(['"' + this.props.q + '"']);
        }

        const link = buildLink('/search', this.props.urlParams, {q: query, page: '1'});

        return (
            <Link className='hover-search-link hover-show' to={link} title={this.props.title}>
                <div className={wrapperClass}>
                    <SearchIcon className={iconClass}/>
                </div>
                {this.props.display ? this.props.display : this.props.q}
            </Link>
        );
    }
}

function mapStateToProps(state) {
    return {
        urlParams: state.urlParams
    };
}

function mapDispatchToProps() {
    return {
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(HoverSearchLinkUnconnected);
