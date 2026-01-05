import React, { Component } from "react";
import _ from "lodash";
import HoverSearchLink from "../../UtilComponents/HoverSearchLink";

import { MimeTypeProgress } from "./MimeTypeProgress";
import { MimeType, MimeTypeCoverage } from "../../../types/MimeType";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { getMimeTypeCoverage } from "../../../actions/metrics/getMimeTypeCoverage";
import { GiantState } from "../../../types/redux/GiantState";
import { GiantDispatch } from "../../../types/redux/GiantDispatch";

type PropTypes = {
  getMimeTypeCoverage: () => void;
  mimeTypeCoverage: MimeTypeCoverage[] | null;
};

class FileTypes extends Component<PropTypes> {
  componentDidMount() {
    this.props.getMimeTypeCoverage();
  }

  renderMimeType = (mimeType: MimeType, display: string) => (
    <HoverSearchLink
      chipName="Mime Type"
      q={mimeType.mimeType}
      display={display}
      title={mimeType.mimeType}
      type="text"
    />
  );

  render() {
    if (!this.props.mimeTypeCoverage) {
      return false;
    }

    const sorted = _.orderBy(this.props.mimeTypeCoverage, "total", "desc");

    return (
      <div className="app__main-content">
        <div className="app__section bignum-container">
          <div className="bignum">
            <div className="bignum__number">
              {_.sumBy(this.props.mimeTypeCoverage, "total")}
            </div>
            <div className="bignum__description">Total Files</div>
          </div>
          <div className="bignum">
            <div className="bignum__number">
              {_.sumBy(this.props.mimeTypeCoverage, "todo")}
            </div>
            <div className="bignum__description">Tasks Pending</div>
          </div>
          <div className="bignum">
            <div className="bignum__number">
              {_.sumBy(this.props.mimeTypeCoverage, "failed")}
            </div>
            <div className="bignum__description">Tasks Failed</div>
          </div>
        </div>
        <div className="app__section">
          <table className="data-table">
            <thead>
              <tr className="data-table__row">
                <th className="data-table__item data-table__item--title">
                  File Type
                </th>
                <th className="data-table__item data-table__item--title">
                  Total
                </th>
                <th
                  className="data-table__item data-table__item--title"
                  colSpan={4}
                >
                  Processed (Failed)
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(
                ({
                  mimeType,
                  humanReadableMimeType,
                  total,
                  todo,
                  done,
                  failed,
                }) => (
                  <tr key={mimeType.mimeType} className="data-table__row">
                    <td className="data-table__item data-table__item--key">
                      {this.renderMimeType(
                        mimeType,
                        humanReadableMimeType
                          ? humanReadableMimeType
                          : mimeType.mimeType,
                      )}
                    </td>
                    <td className="data-table__item data-table__item--value">
                      {total}
                    </td>
                    <td
                      className="data-table__item data-table__item--value"
                      colSpan={4}
                    >
                      {todo === 0 && done === 0 ? (
                        "Unsupported format"
                      ) : (
                        <MimeTypeProgress
                          todo={todo}
                          done={done}
                          failed={failed}
                        />
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: GiantState) {
  return {
    mimeTypeCoverage: state.metrics.coverage,
  };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    getMimeTypeCoverage: bindActionCreators(getMimeTypeCoverage, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(FileTypes);
