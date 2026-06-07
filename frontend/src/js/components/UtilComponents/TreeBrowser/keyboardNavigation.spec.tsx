import React from "react";
import ReactDOM from "react-dom";
import { act, Simulate } from "react-dom/test-utils";
import TreeBrowser from "./index";
import {
  ColumnsConfig,
  TreeEntry,
  TreeLeaf,
  TreeNode,
} from "../../../types/Tree";

// A folder containing a single openable child.
const child: TreeLeaf<null> = {
  id: "child",
  name: "child",
  data: null,
  isExpandable: false,
};
const folder: TreeNode<null> = {
  id: "folder",
  name: "folder",
  data: null,
  children: [child],
};

const columnsConfig: ColumnsConfig<null> = {
  sortDescending: false,
  sortColumn: "name",
  columns: [
    {
      name: "name",
      align: "left",
      style: {},
      render: (entry: TreeEntry<null>) => <span>{entry.name}</span>,
      sort: (a, b) => a.name.localeCompare(b.name),
    },
  ],
};

const handlers = {
  onSelectLeaf: jest.fn(),
  onExpandNode: jest.fn(),
  onCollapseNode: jest.fn(),
};

// Mirrors the Workspaces container: it owns expanded/focused/selected state, so
// that handler calls produce the re-renders that exercise the keyboard paths.
// The whole tree is in memory up-front, as it is for the workspace view.
class Harness extends React.Component<
  {},
  {
    expanded: TreeEntry<null>[];
    focused: TreeEntry<null> | null;
    selected: TreeEntry<null>[];
  }
> {
  state = {
    expanded: [] as TreeEntry<null>[],
    focused: null as TreeEntry<null> | null,
    selected: [] as TreeEntry<null>[],
  };

  render() {
    return (
      <TreeBrowser<null>
        rootId="root"
        tree={[folder]}
        showColumnHeaders={false}
        columnsConfig={columnsConfig}
        selectedEntries={this.state.selected}
        focusedEntry={this.state.focused}
        expandedEntries={this.state.expanded}
        clearFocus={() => this.setState({ focused: null })}
        onFocus={(entry) => this.setState({ focused: entry })}
        onSelectLeaf={(leaf) => {
          handlers.onSelectLeaf(leaf.id);
          this.setState({ selected: [leaf] });
        }}
        onExpandLeaf={() => {}}
        onExpandNode={(entry) => {
          handlers.onExpandNode(entry.id);
          this.setState((s) => ({ expanded: [...s.expanded, entry] }));
        }}
        onCollapseNode={(entry) => {
          handlers.onCollapseNode(entry.id);
          this.setState((s) => ({
            expanded: s.expanded.filter((e) => e.id !== entry.id),
          }));
        }}
        onMoveItems={() => {}}
        onClickColumn={() => {}}
        onContextMenu={() => {}}
      />
    );
  }
}

function rowByName(container: HTMLElement, name: string): HTMLElement {
  const row = Array.from(container.querySelectorAll("tr")).find((r) =>
    Array.from(r.querySelectorAll("span")).some((s) => s.textContent === name),
  );
  if (!row) throw new Error(`No tree row found for "${name}"`);
  return row as HTMLElement;
}

// Deliver a key to whichever row currently holds focus, as a browser would.
function press(key: string) {
  const el = document.activeElement;
  if (!el) throw new Error("No focused element to receive the key press");
  act(() => {
    Simulate.keyDown(el, { key });
  });
}

describe("workspace tree keyboard navigation", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    jest.clearAllMocks();
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  });

  function mount() {
    act(() => {
      ReactDOM.render(<Harness />, container);
    });
  }

  it("ArrowDown into an expanded folder then Enter opens the child", () => {
    mount();
    rowByName(container, "folder").focus(); // tab into the tree

    press("Enter"); // expand the folder
    press("ArrowDown"); // move focus onto the child
    press("Enter"); // open the child

    expect(handlers.onSelectLeaf).toHaveBeenCalledWith("child");
    expect(handlers.onCollapseNode).not.toHaveBeenCalled();
  });

  // Regression: a child row that unmounts on collapse used to leave a stale ref
  // behind in Node, so after re-expanding, ArrowDown focused a detached row
  // (a no-op) and the next Enter re-collapsed the folder instead of opening the
  // child. See Node.render resetting childReactComponents.
  it("opens the child after the folder is collapsed and re-expanded", () => {
    mount();
    rowByName(container, "folder").focus();

    press("Enter"); // expand
    press("Enter"); // collapse
    press("Enter"); // re-expand
    press("ArrowDown"); // must land on the live child row
    press("Enter"); // must open the child, not re-collapse the folder

    expect(handlers.onSelectLeaf).toHaveBeenCalledWith("child");
    // Only the deliberate middle collapse — not a second one from the final Enter.
    expect(handlers.onCollapseNode).toHaveBeenCalledTimes(1);
  });
});
