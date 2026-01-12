import React from "react";
import { EuiForm, EuiCheckboxGroup } from "@elastic/eui";
import { GiantState } from "../types/redux/GiantState";
import { GiantDispatch } from "../types/redux/GiantDispatch";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import { updatePreference } from "../actions/preferences";

import { features } from "../components/Settings/FeatureSwitches";

function GiantEuiSettings({
  preferences,
  updatePreference,
}: {
  preferences: any;
  updatePreference: (id: string, value: boolean) => void;
}) {
  const options = features.map(({ name, description }) => {
    return { id: name, label: description };
  });

  const selected = features.reduce(
    (acc, { name }) => {
      return { ...acc, [name]: preferences["feature" + name] };
    },
    {} as { [name: string]: boolean },
  );

  function onChange(name: string) {
    updatePreference("feature" + name, !selected[name]);
  }

  return (
    <EuiForm component="form">
      <EuiCheckboxGroup
        options={options}
        idToSelectedMap={selected}
        onChange={onChange}
        legend={{
          children: "Feature Switches",
        }}
      />
    </EuiForm>
  );
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

export default connect(mapStateToProps, mapDispatchToProps)(GiantEuiSettings);
