import React, { DragEvent, ReactSVGElement } from "react";

import { MenuChevron } from "../MenuChevron";
import Leaf from "./Leaf";
import {
  ColumnsConfig,
  isTreeNode,
  TreeEntry,
  TreeLeaf,
  TreeNode,
} from "../../../types/Tree";

import { SearchLink } from "../SearchLink";
import { MAX_NUMBER_OF_CHILDREN } from "../../../util/resourceUtils";
import { sortEntries } from "../../../util/treeUtils";

type Props<T> = {
  entry: TreeNode<T>;
  index: number;
  depth: number;
  isFirst: boolean;
  selectedEntries: TreeEntry<T>[];
  focusedEntry: TreeEntry<T> | null;
  columnsConfig: ColumnsConfig<T>;
  expandedNodes: TreeNode<T>[];

  focusSibling: (
    i: number,
    offset: number,
    isMetaKeyHeld: boolean,
    isShiftKeyHeld: boolean,
  ) => void;
  onFocus: (
    entry: TreeEntry<T>,
    isMetaKeyHeld: boolean,
    isShiftKeyHeld: boolean,
  ) => void;
  clearFocus: () => void;
  onSelectLeaf: (leaf: TreeLeaf<T>) => void;
  onExpandLeaf: (leaf: TreeLeaf<T>) => void;
  onExpand: (entry: TreeNode<T>) => void;
  onCollapse: (entry: TreeNode<T>) => void;
  onDrop: (e: React.DragEvent, idOfLocationToMoveTo: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: TreeEntry<T>) => void;
};

type State = {
  hoveredOver: boolean;
  focusedChild: number;
};

export default class Node<T> extends React.Component<Props<T>, State> {
  // https://reactjs.org/docs/refs-and-the-dom.html
  tableRowElement: HTMLTableRowElement | null = null;

  childReactComponents: (Node<T> | Leaf<T>)[] = [];

  state = {
    hoveredOver: false,
    focusedChild: -1,
  };

  isSelected = () =>
    this.props.selectedEntries.some((e) => e.id === this.props.entry.id);
  isFocused = () =>
    this.props.focusedEntry
      ? this.props.focusedEntry.id === this.props.entry.id
      : false;

  focus = (isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => {
    if (this.tableRowElement) {
      this.tableRowElement.focus();
    }
    this.props.onFocus(this.props.entry, isMetaKeyHeld, isShiftKeyHeld);
  };

  onKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    e.stopPropagation();

    switch (e.key) {
      case "Escape":
        this.props.clearFocus();
        break;
      case "Enter":
        this.toggleExpanded(e.metaKey, e.shiftKey);
        break;
      case "ArrowLeft":
        this.collapse(e.metaKey, e.shiftKey);
        break;
      case "ArrowRight":
        this.expand(e.metaKey, e.shiftKey);
        break;
      case "ArrowUp":
        this.props.focusSibling(this.props.index, -1, e.metaKey, e.shiftKey);
        break;
      case "ArrowDown":
        if (this.isExpanded() && this.props.entry.children.length > 0) {
          this.focusEntry(0, 0, e.metaKey, e.shiftKey);
        } else {
          this.props.focusSibling(this.props.index, 1, e.metaKey, e.shiftKey);
        }
        break;
      default:
      //
    }
  };

  onMouseDown = (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.stopPropagation();
    // The meta key can deselect from an existing selection, so if it's held then we need to
    // fire the focus function even if the entry is currently selected.
    // But otherwise, mouse down inside an existing selection should not do anything,
    // because we might be about to drag that whole selection.
    if (!this.isSelected() || e.metaKey) {
      this.focus(e.metaKey, e.shiftKey);
    }
  };

  onMouseUp = (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.stopPropagation();

    // The meta key toggles the selected/unselected state of an entry.
    // Mouse down (with meta key held) will have toggled it, so we need
    // mouse up to not reverse the operation, otherwise the full click is no-op.
    if (!e.metaKey) {
      this.focus(e.metaKey, e.shiftKey);
    }
  };

  onClickMenuChevron = (e: React.MouseEvent<ReactSVGElement>) => {
    e.stopPropagation();

    this.toggleExpanded(e.metaKey, e.shiftKey);
  };

  onDoubleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.stopPropagation();

    this.toggleExpanded(e.metaKey, e.shiftKey);
  };

  onDragStart = (e: DragEvent<HTMLTableRowElement>) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({ id: this.props.entry.id }),
      );
    }
  };

  onDragOver = (e: DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    this.setState({
      hoveredOver: true,
    });
  };

  onDragLeave = (e: DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    this.setState({
      hoveredOver: false,
    });
  };

  onDrop = (e: DragEvent<HTMLTableRowElement>) => {
    this.setState({
      hoveredOver: false,
    });
    this.props.onDrop(e, this.props.entry.id);
  };

  isExpanded = () =>
    this.props.expandedNodes.some((e) => e.id === this.props.entry.id);

  expand = (isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => {
    this.props.onExpand(this.props.entry);
    this.props.onFocus(this.props.entry, isMetaKeyHeld, isShiftKeyHeld);
  };

  collapse = (isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => {
    this.props.onCollapse(this.props.entry);
    this.props.onFocus(this.props.entry, isMetaKeyHeld, isShiftKeyHeld);
  };

  toggleExpanded = (isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => {
    if (this.isExpanded()) {
      this.props.onCollapse(this.props.entry);
    } else {
      this.props.onExpand(this.props.entry);
    }
    this.props.onFocus(this.props.entry, isMetaKeyHeld, isShiftKeyHeld);
  };

  focusEntry = (
    i: number,
    offset: number,
    isMetaKeyHeld: boolean,
    isShiftKeyHeld: boolean,
  ) => {
    const targetEntry = i + offset;

    if (targetEntry === -1) {
      this.focus(isMetaKeyHeld, isShiftKeyHeld);
      return;
    }

    if (targetEntry >= 0 && targetEntry < this.childReactComponents.length) {
      if (this.childReactComponents[targetEntry]) {
        if (offset < 0) {
          this.childReactComponents[targetEntry].focusLastChild(
            isMetaKeyHeld,
            isShiftKeyHeld,
          );
        } else {
          this.childReactComponents[targetEntry].focus(
            isMetaKeyHeld,
            isShiftKeyHeld,
          );
        }
      }
    } else {
      this.props.focusSibling(
        this.props.index,
        offset,
        isMetaKeyHeld,
        isShiftKeyHeld,
      );
    }
  };

  focusLastChild = (isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => {
    if (this.isExpanded() && this.childReactComponents.length > 0) {
      this.childReactComponents[
        this.childReactComponents.length - 1
      ].focusLastChild(isMetaKeyHeld, isShiftKeyHeld);
    } else {
      this.focus(isMetaKeyHeld, isShiftKeyHeld);
    }
  };

  renderContent() {
    if (this.props.entry.children.length >= MAX_NUMBER_OF_CHILDREN) {
      return (
        <tr>
          <td>
            {[...Array(this.props.depth + 1)].map((m, i) => (
              <span key={i} className="file-browser__name-pad"></span>
            ))}
            <span>
              <SearchLink to={`/resources/${this.props.entry.id}`}>
                {this.props.entry.children.length} files. Click to load...
              </SearchLink>
            </span>
          </td>
        </tr>
      );
    }

    const sortedEntries = sortEntries<T>(
      this.props.entry.children,
      this.props.columnsConfig,
    );

    return sortedEntries.map((e: TreeEntry<T>, i: number) => {
      if (isTreeNode<T>(e)) {
        return (
          <Node
            key={e.id}
            ref={(n) => {
              if (n !== null) this.childReactComponents.push(n);
            }}
            isFirst={i === 0}
            entry={e}
            index={i}
            depth={this.props.depth + 1}
            focusSibling={this.focusEntry}
            onFocus={this.props.onFocus}
            selectedEntries={this.props.selectedEntries}
            focusedEntry={this.props.focusedEntry}
            expandedNodes={this.props.expandedNodes}
            clearFocus={this.props.clearFocus}
            onSelectLeaf={this.props.onSelectLeaf}
            onExpandLeaf={this.props.onExpandLeaf}
            onExpand={this.props.onExpand}
            onCollapse={this.props.onCollapse}
            onDrop={this.props.onDrop}
            onContextMenu={this.props.onContextMenu}
            columnsConfig={this.props.columnsConfig}
          />
        );
      } else {
        return (
          <Leaf
            key={e.id}
            ref={(l) => {
              if (l !== null) this.childReactComponents.push(l);
            }}
            isFirst={i === 0}
            entry={e}
            index={i}
            depth={this.props.depth + 1}
            focusSibling={this.focusEntry}
            onFocus={this.props.onFocus}
            selectedEntries={this.props.selectedEntries}
            focusedEntry={this.props.focusedEntry}
            onSelect={this.props.onSelectLeaf}
            // no onCollapse for a leaf - if it's expanded it becomes a node
            onExpand={this.props.onExpandLeaf}
            onContextMenu={this.props.onContextMenu}
            columnsConfig={this.props.columnsConfig}
          />
        );
      }
    });
  }

  render() {
    const { hoveredOver } = this.state;
    const focused = this.isFocused();
    const selected = this.isSelected();
    const expanded = this.isExpanded();
    const tabIndex = this.props.isFirst ? 0 : -1;

    return (
      <React.Fragment>
        <tr
          ref={(r) => {
            if (r !== null) this.tableRowElement = r;
          }}
          draggable
          className={`file-browser__entry ${focused || hoveredOver ? "file-browser__entry--focused" : ""} ${selected ? "file-browser__entry--selected" : ""}`}
          tabIndex={tabIndex}
          aria-expanded={focused}
          onKeyDown={this.onKeyDown}
          onMouseDown={this.onMouseDown} // focus
          onMouseUp={this.onMouseUp} // focus
          onDoubleClick={this.onDoubleClick} // toggleExpanded
          onDragStart={this.onDragStart}
          onDragOver={this.onDragOver}
          onDragLeave={this.onDragLeave}
          onContextMenu={(e: React.MouseEvent) =>
            this.props.onContextMenu(e, this.props.entry)
          }
          onDrop={this.onDrop}
        >
          {this.props.columnsConfig.columns.map((column, i) => {
            const align = column.align || "center";
            return (
              <td
                key={column.name}
                className="file-browser__cell"
                style={column.style}
                align={align}
              >
                <div className="file-browser__cell-flex-container">
                  {i === 0 ? (
                    <React.Fragment>
                      {[...Array(this.props.depth)].map((m, i) => (
                        <span key={i} className="file-browser__name-pad"></span>
                      ))}
                      <MenuChevron
                        onClick={this.onClickMenuChevron}
                        expanded={expanded}
                      />
                    </React.Fragment>
                  ) : (
                    false
                  )}
                  {column.render(this.props.entry)}
                </div>
              </td>
            );
          })}
          {/* Padding cell*/}
          <td className="file-browser__cell" />
        </tr>
        {expanded ? this.renderContent() : false}
      </React.Fragment>
    );
  }
}
