import React from "react";
import PropTypes from "prop-types";
import SelectionPopover from "../UtilComponents/SelectionPopover";
import CommentIcon from "react-icons/lib/md/comment";
import SearchIcon from "react-icons/lib/md/search";
import history from "../../util/history";
import buildLink from "../../util/buildLink";

import { setSelection } from "../../actions/resources/setSelection";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

class TextPopoverUnconnected extends React.Component {
  static propTypes = {
    target: PropTypes.string.isRequired,
    allowComments: PropTypes.bool.isRequired,
    urlParams: PropTypes.shape({
      q: PropTypes.string,
      page: PropTypes.any,
      pageSize: PropTypes.any,
      sortBy: PropTypes.string,
      filters: PropTypes.any,
    }),
    setSelection: PropTypes.func.isRequired,
  };

  state = {
    showPopover: false,
    selectedText: undefined,
  };

  search = () => {
    history.push(
      buildLink("/search", this.props.urlParams, {
        q: JSON.stringify(['"' + window.getSelection().toString() + '"']),
        page: "1",
      }),
    );
  };

  addComment = () => {
    const selection = window.getSelection();
    this.props.setSelection(selection);

    this.setState({ showPopover: false });
  };

  onSelect = () => {
    this.setState({ showPopover: true });
  };

  onDeselect = (e) => {
    this.setState({ showPopover: false });
  };

  render() {
    return (
      <React.Fragment>
        <SelectionPopover
          target={this.props.target}
          showPopover={this.state.showPopover}
          onSelect={this.onSelect}
          onDeselect={this.onDeselect}
        >
          <div className="textpopover-wrapper">
            <div className="textpopover">
              <button className="btn textpopover__button" onClick={this.search}>
                <SearchIcon className="textpopover-icon" />
              </button>
              <button className="btn" onClick={this.addComment}>
                <CommentIcon className="textpopover-icon" />
              </button>
            </div>
          </div>
        </SelectionPopover>
      </React.Fragment>
    );
  }
}

function mapStateToProps(state) {
  return {
    urlParams: state.urlParams,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    setSelection: bindActionCreators(setSelection, dispatch),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(TextPopoverUnconnected);
