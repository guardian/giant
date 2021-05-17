import React, { SyntheticEvent } from 'react';
import UpwardPointingChevron from 'react-icons/lib/md/expand-less';
import DownwardPointingChevron from 'react-icons/lib/md/expand-more';

import Node from './Node';
import Leaf from './Leaf';

import { KeyboardShortcut } from '../KeyboardShortcut';
import { ColumnsConfig, isTreeNode, Tree, TreeEntry, TreeLeaf, TreeNode } from '../../../types/Tree';
import { MAX_NUMBER_OF_CHILDREN } from '../../../util/resourceUtils';
import { SearchLink } from '../SearchLink';
import { getIdsOfEntriesToMove, sortEntries } from '../../../util/treeUtils';


type Props<T> = {
    onSelectLeaf: (leaf: TreeLeaf<T>) => void,
    showColumnHeaders: boolean,
    columnsConfig: ColumnsConfig<T>,

    rootId: string,
    tree: Tree<T>,

    clearFocus: () => void,
    onFocus: (entry: TreeEntry<T>, isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => void,
    selectedEntries: TreeEntry<T>[],
    focusedEntry: TreeEntry<T> | null,
    expandedEntries: TreeEntry<T>[],

    onMoveItems: (itemIds: string[], folderId: string) => void,
    onExpandLeaf: (leaf: TreeLeaf<T>) => void,
    onClickColumn: (columnName: string) => void,
    onExpandNode: (entry: TreeNode<T>) => void,
    onCollapseNode: (entry: TreeNode<T>) => void,
    onContextMenu: (e: React.MouseEvent, entry: TreeEntry<T>) => void,
}

type State = {
    widthOverrides: { [column: string]: number },
    draggingColumn: string | null,
    initialX: number | null,
    hoveredOver: boolean,
}

export default class TreeBrowser<T> extends React.Component<Props<T>, State> {

    childReactComponents: (Node<T> | Leaf<T>)[] = [];

    constructor(props: Props<T>) {
        super(props);
        this.state = {
            widthOverrides: {},
            draggingColumn: null,
            initialX: null,
            hoveredOver: false,
        };
    }

    componentDidUpdate(props: Props<T>, state: State) {
        if (this.state.draggingColumn && !state.draggingColumn) {
            document.addEventListener('mousemove', this.resizeMouseMove);
            document.addEventListener('mouseup', this.resizeMouseUp);
        } else if (!this.state.draggingColumn && state.draggingColumn) {
            document.removeEventListener('mousemove', this.resizeMouseMove);
            document.removeEventListener('mouseup', this.resizeMouseUp);
        }
    }

    focus = (isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => {
        if (this.childReactComponents.length > 0) {
            this.childReactComponents[0].focus(isMetaKeyHeld, isShiftKeyHeld);
        }
    };

    focusLast = (isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => {
        if (this.childReactComponents.length > 0) {
            this.childReactComponents[this.childReactComponents.length - 1].focusLastChild(isMetaKeyHeld, isShiftKeyHeld);
        }
    };

    focusEntry = (i: number, offset: number, isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => {
        const targetEntry = i + offset;

        if (targetEntry >= 0 && targetEntry < this.childReactComponents.length) {
            if (offset < 0) {
                this.childReactComponents[targetEntry].focusLastChild(isMetaKeyHeld, isShiftKeyHeld);
            } else {
                this.childReactComponents[targetEntry].focus(isMetaKeyHeld, isShiftKeyHeld);
            }
        }
    };

    onClickColumn = (e: SyntheticEvent, columnName: string) => {
        e.stopPropagation();
        this.props.onClickColumn(columnName);
    };

    resizeMouseDown = (e: React.MouseEvent | MouseEvent, columnName: string) => {
        e.stopPropagation();
        this.setState({
            draggingColumn: columnName,
            initialX: e.pageX
        });
    };

    resizeMouseUp = (e: React.MouseEvent | MouseEvent) => {
        e.stopPropagation();
        this.setState({
            draggingColumn: null,
            initialX: null
        });
    };

    resizeMouseMove = (e: React.MouseEvent | MouseEvent) => {
        e.preventDefault();

        // Prevent text selection when moving a column
        const selection = window.getSelection() || document.getSelection();
        if (selection) {
            selection.removeAllRanges();
        }

        if (!(this.state.draggingColumn && this.state.initialX)) {
            return;
        }

        const delta = e.pageX - this.state.initialX;
        const override = this.state.widthOverrides[this.state.draggingColumn] || 0;

        this.setState({
            widthOverrides: {
                ...this.state.widthOverrides,
                [ this.state.draggingColumn ]:  delta + override
            },
            initialX: e.pageX
        });
    };

    onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        this.setState({
            hoveredOver: true
        });
    };

    onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        this.setState({
            hoveredOver: false
        });
    };

    onDrop = (e: React.DragEvent, idOfLocationToMoveTo: string) => {
        e.preventDefault();

        const json = e.dataTransfer.getData('application/json');
        const {id: idOfDraggedEntry} = JSON.parse(json);
        const idsOfEntriesToMove = getIdsOfEntriesToMove(this.props.selectedEntries, idOfDraggedEntry);
        this.props.onMoveItems(idsOfEntriesToMove, idOfLocationToMoveTo);

        this.setState({
            hoveredOver: false
        });
    };

    renderTree(sortedEntries: Tree<T>) {
        return <React.Fragment>
            {sortedEntries.map((e, i) => {
                // Used to set the tab index on the first node
                const isFirst = i === 0;

                if (isTreeNode<T>(e)) {
                    return (
                        <Node
                            key={e.id}
                            ref={n => {if (n !== null) this.childReactComponents.push(n);}}

                            entry={e}
                            index={i}
                            depth={0}
                            isFirst={isFirst}
                            focusSibling={this.focusEntry}

                            // selectedEntries because these can be nodes or leaves
                            selectedEntries={this.props.selectedEntries}
                            focusedEntry={this.props.focusedEntry}
                            // expandedNodes because leaves can't be expanded but the LazyTreeBrowser does
                            // mark them as expanded in anticipation of them loading and becoming nodes
                            expandedNodes={this.props.expandedEntries.filter(isTreeNode)}

                            onFocus={this.props.onFocus}
                            onSelectLeaf={this.props.onSelectLeaf}
                            onExpandLeaf={this.props.onExpandLeaf}
                            clearFocus={this.props.clearFocus}
                            onExpand={this.props.onExpandNode}
                            onCollapse={this.props.onCollapseNode}
                            onDrop={this.onDrop}
                            onContextMenu={this.props.onContextMenu}

                            columnsConfig={this.props.columnsConfig}
                        />
                    );
                } else {
                    return (
                        <Leaf
                            key={e.id}
                            ref={l => {if (l !== null) this.childReactComponents.push(l);}}

                            entry={e}
                            index={i}
                            depth={0}
                            isFirst={isFirst}
                            focusSibling={this.focusEntry}

                            selectedEntries={this.props.selectedEntries}
                            focusedEntry={this.props.focusedEntry}

                            onFocus={this.props.onFocus}
                            onSelect={this.props.onSelectLeaf}
                            onExpand={this.props.onExpandLeaf}
                            onContextMenu={this.props.onContextMenu}

                            columnsConfig={this.props.columnsConfig}
                        />
                    );
                }
            })}
        </React.Fragment>
    }

    renderTruncated(sortedEntries: Tree<T>) {
        return <tr>
            <td>
            <SearchLink to={`/resources/${this.props.rootId}`}>
                {sortedEntries.length} files. Click to load...
            </SearchLink>
            </td>
        </tr>;
    }

    render() {
        this.childReactComponents = [];

        const sortedEntries = sortEntries<T>(this.props.tree, this.props.columnsConfig);

        return (
            <div className='file-browser__wrapper'>
                <KeyboardShortcut shortcut='home' func={this.focus} />
                <KeyboardShortcut shortcut='end' func={this.focusLast}  />
                <table className='file-browser'>
                    {this.props.showColumnHeaders
                        ?
                            <thead>
                                <tr>
                                    {this.props.columnsConfig.columns.map(c => {
                                        const override = this.state.widthOverrides[c.name];
                                        const widthCalc = `calc(${c.style.width} + ${override ? override : 0}px)`;
                                        const style = Object.assign({}, c.style, {width: widthCalc});

                                        return (
                                            <th key={c.name} className='file-browser__header' style={style} onClick={(e) => this.onClickColumn(e, c.name)}>
                                                <div className='file-browser__header-resizer' onMouseDown={e => this.resizeMouseDown(e, c.name)} onClick={e => e.stopPropagation()}>
                                                    <div className='file-browser__header-resizer-grabber'/>
                                                </div>

                                                {c.name}
                                                {
                                                    this.props.columnsConfig.sortColumn === c.name
                                                    ?
                                                        <span className='file-browser__sort-tip'>
                                                        {
                                                            this.props.columnsConfig.sortDescending
                                                            ? <DownwardPointingChevron/>
                                                            : <UpwardPointingChevron/>
                                                        }
                                                        </span>
                                                    :
                                                        false
                                                }
                                            </th>
                                        );
                                    }
                                    )}
                                    {/*Padding column*/}
                                    <th style={{width: '100%'}}/>
                                </tr>
                            </thead>
                        :
                            false
                    }
                    <tbody>
                        {sortedEntries.length < MAX_NUMBER_OF_CHILDREN ?
                            this.renderTree(sortedEntries) :
                            this.renderTruncated(sortedEntries)
                        }
                    </tbody>
                </table>
                <div className={`file-browser__highlighter ${this.state.hoveredOver ? 'file-browser__root-drop-highlight' : ''}`}/>
                <div onClick={this.props.clearFocus}
                     onDragOver={this.onDragOver}
                     onDragLeave={this.onDragLeave}
                     onDrop={(e) => this.onDrop(e, this.props.rootId)} className='file-browser__extender' />
            </div>
        );
    }
}

