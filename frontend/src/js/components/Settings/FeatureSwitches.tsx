import { GiantState } from "../../types/redux/GiantState";
import { GiantDispatch } from "../../types/redux/GiantDispatch";
import React from "react";
import PropTypes from "prop-types";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import { updatePreference } from "../../actions/preferences";

type Feature = { name: "PageViewer" | "EUI"; description: string };

export const features: Feature[] = [
  {
    name: "PageViewer",
    description: "Use new text viewer that understands pages",
  },
  {
    name: "EUI",
    description:
      "Use new EUI-based components (requires page reload to fix styles)",
  },
];

class FeatureSwitches extends React.Component<
  ReturnType<typeof mapStateToProps> & ReturnType<typeof mapDispatchToProps>
> {
  static propTypes = {
    updatePreference: PropTypes.func.isRequired,
    preferences: PropTypes.object,
  };

  toggleFeatureSwitch = (
    e: React.ChangeEvent<HTMLInputElement>,
    name: Feature["name"],
  ) => {
    this.props.updatePreference("feature" + name, !!e.target.checked);
  };

  renderRow = (feature: Feature) => {
    const value = this.props.preferences[`feature${feature.name}`];

    return (
      <tr className="date-table__row" key={feature.name}>
        <td>{feature.name}</td>
        <td>{feature.description}</td>
        <td align="center">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => this.toggleFeatureSwitch(e, feature.name)}
          />
        </td>
      </tr>
    );
  };

  render() {
    return (
      <div className="app__main-content">
        <h1 className="page-title">Feature Switches</h1>
        <table className="data-table">
          <thead>
            <tr className="data-table__row">
              <th className="data-table__item data-table__item--title">
                Feature
              </th>
              <th className="data-table__item data-table__item--title">
                Description
              </th>
              <th className="data-table__item data-table__item--title">
                Status
              </th>
            </tr>
          </thead>
          <tbody>{features.map((f) => this.renderRow(f))}</tbody>
        </table>
      </div>
    );
  }
}

function mapStateToProps(state: GiantState) {
  return {
    preferences: state.app.preferences,
  };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    updatePreference: bindActionCreators(updatePreference, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(FeatureSwitches);
