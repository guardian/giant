import React from "react";
import Select from "react-select";
import { MdInfoOutline } from "react-icons/md";
import ReactTooltip from "react-tooltip";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import { createWorkspace } from "../../actions/workspaces/createWorkspace";
import { Checkbox } from "../UtilComponents/Checkbox";
import { WorkspacePublicInfoIcon } from "./WorkspacePublicInfoIcon";
import { WorkspacePublicMessage } from "./WorkspacePublicMessage";
import { GiantDispatch } from "../../types/redux/GiantDispatch";

interface PropsFromParent {
  onComplete: () => void;
}

type Props = ReturnType<typeof mapStateToProps> &
  ReturnType<typeof mapDispatchToProps> &
  PropsFromParent;

type State = {
  name: string;
  isPublic: boolean;
  tagColor: { value: string; label: string };
};

class CreateWorkspaceModalUnconnected extends React.Component<Props, State> {
  state = {
    name: "",
    isPublic: false,
    tagColor: { value: "grey", label: "Grey" },
  };

  onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    this.props.createWorkspace(
      this.state.name,
      this.state.isPublic,
      this.state.tagColor.value,
    );
    this.props.onComplete();
  };

  handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    this.setState({ name: e.currentTarget.value });

  render() {
    const tagExplain =
      "Tags are used to quickly indicate if a document is in a workspace you follow";

    return (
      <form className="form" onSubmit={this.onSubmit}>
        <h2>New Workspace</h2>
        <div className="form__row">
          <label className="form__label" htmlFor="#name">
            Name
          </label>

          <input
            name="name"
            className="form__field"
            type="text"
            autoFocus
            placeholder="Name"
            autoComplete="off"
            onChange={this.handleChange}
            value={this.state.name}
          />
        </div>

        <div className="form__row">
          <WorkspacePublicInfoIcon />
          <Checkbox
            selected={this.state.isPublic}
            onClick={(e) => this.setState({ isPublic: !this.state.isPublic })}
          >
            Public
          </Checkbox>
        </div>

        <div className="form__row">
          <label className="form__label" htmlFor="#tagColor">
            Tag Colour
            <MdInfoOutline
              className="info-icon"
              data-tip={tagExplain}
              data-effect="solid"
            />
          </label>
          <Select
            classNamePrefix="giant-select"
            name="tagColor"
            value={this.state.tagColor}
            className="form__select"
            options={[
              { value: "grey", label: "Grey" },
              { value: "red", label: "Red" },
              { value: "green", label: "Green" },
              { value: "blue", label: "Blue" },
              { value: "orange", label: "Orange" },
              { value: "purple", label: "Purple" },
            ]}
            formatOptionLabel={({ value, label }) => (
              <span className="workspace-modal__tag-dropdown">
                <span className={`workspace__tag workspace__tag--${value}`} />
                {label}
              </span>
            )}
            onChange={(tagColor) => tagColor && this.setState({ tagColor })}
            isClearable={false}
            isSearchable={false}
          />
        </div>
        {this.state.isPublic ? <WorkspacePublicMessage /> : false}
        <button className="btn" type="submit" disabled={!this.state.name}>
          Create
        </button>
        <ReactTooltip insecure={false} html={false} />
      </form>
    );
  }
}

function mapStateToProps() {
  return {};
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    createWorkspace: bindActionCreators(createWorkspace, dispatch),
  };
}
export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(CreateWorkspaceModalUnconnected);
