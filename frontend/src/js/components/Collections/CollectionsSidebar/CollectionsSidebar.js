import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { CollectionItem } from "./CollectionItem";
import { collection } from "../../../types/Collection";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import * as getCollections from "../../../actions/collections/getCollections";

export class CollectionsSidebar extends React.Component {
  static propTypes = {
    collections: PropTypes.arrayOf(collection),
    username: PropTypes.string,
    collectionsActions: PropTypes.shape({
      getCollections: PropTypes.func.isRequired,
    }),
  };

  componentDidMount() {
    this.props.collectionsActions.getCollections();
  }

  render() {
    if (!this.props.collections || !this.props.username) {
      return false;
    }

    // If you're an admin you have a full list of collections in Redux to power the settings page even if you
    // yourself don't have access to some of them (although you could grant yourself access)
    const visibleCollections = this.props.collections
      .filter(({ users }) => users.includes(this.props.username))
      .sort((a, b) => a.display.toLowerCase().localeCompare(b.display.toLowerCase()));

    return (
      <div className="sidebar">
        <div className="sidebar__group">
          <div className="sidebar__title">
            <Link to="/collections">Datasets</Link>
          </div>
          {visibleCollections.map((collection) => (
            <CollectionItem
              key={collection.uri}
              uri={collection.uri}
              display={collection.display}
            />
          ))}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    collections: state.collections,
    username: state.auth.token ? state.auth.token.user.username : undefined,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    collectionsActions: bindActionCreators(
      Object.assign({}, getCollections),
      dispatch,
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(CollectionsSidebar);
