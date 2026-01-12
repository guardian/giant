import React from "react";
import { displayRelativePath, findPath } from "../../util/workspaceUtils";
import { WorkspaceEntry, Workspace } from "../../types/Workspaces";
import { addFolderToWorkspace } from "../../actions/workspaces/addFolderToWorkspace";
import { isTreeLeaf, TreeEntry } from "../../types/Tree";

type Props = {
  workspace: Workspace;
  parentEntry: TreeEntry<WorkspaceEntry>;
  addFolderToWorkspace: typeof addFolderToWorkspace;
  onComplete: () => void;
};

type State = {
  name: string;
};

// TODO replace this modal with an in-situ file naming system like any sane file browser
export default class CreateFolderModal extends React.Component<Props, State> {
  state = {
    name: "",
  };

  onSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const path = findPath(
      this.props.parentEntry.id,
      [],
      this.props.workspace.rootNode,
    );
    if (!path) {
      return;
    }

    let parentId;
    if (isTreeLeaf(this.props.parentEntry)) {
      // The focused entry is a leaf, which is not a valid target for creating a folder,
      // so we use its parent node as the target.
      const parentNodeOfFocusedEntry = path[path.length - 1];
      parentId = parentNodeOfFocusedEntry.id;
    } else {
      parentId = this.props.parentEntry.id;
    }

    this.props.addFolderToWorkspace(
      this.props.workspace.id,
      parentId,
      this.state.name,
    );
    // TODO: I think maybe this should actually be sequenced after the above has finished?
    this.props.onComplete();
  };

  handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    this.setState({
      name: e.target.value,
    });

  render() {
    const relativePath = displayRelativePath(
      this.props.workspace.rootNode,
      this.props.parentEntry.id,
    );

    return (
      <form className="form" onSubmit={this.onSubmit}>
        <h2>New Folder</h2>
        <div className="form__row">
          <label className="form__label" htmlFor="#name">
            Name
          </label>

          <div>{relativePath}</div>
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

        <button className="btn" type="submit" disabled={!this.state.name}>
          Create
        </button>
      </form>
    );
  }
}
