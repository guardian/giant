import React from "react";

import { connect } from "react-redux";
import { Redirect } from "react-router";

class Collections extends React.Component {
  componentDidMount() {
    document.title = "Collections - Giant";
  }

  componentWillUnmount() {
    document.title = "Giant";
  }

  render() {
    if (!this.props.userCollections) {
      return false;
    }

    const collections = this.props.userCollections;
    if (collections.length > 0) {
      const uri =
        localStorage.getItem("selectedCollectionUri") ||
        this.props.userCollections[0].uri;
      return <Redirect to={`/collections/${uri}`} />;
    } else {
      return (
        <div className="app__main-content">
          <h1>No datasets</h1>
        </div>
      );
    }
  }
}

function mapStateToProps(state) {
  return {
    userCollections: state.userCollections,
  };
}

export default connect(mapStateToProps)(Collections);
