import React from 'react';
import { MenuChevron } from '../MenuChevron';
import { ColumnsConfig, TreeEntry, TreeLeaf } from '../../../types/Tree';


type Props<T> = {
    entry: TreeLeaf<T>,
    index: number,
    depth: number,
    isFirst: boolean,
    selectedEntries: TreeEntry<T>[],
    focusedEntry: TreeEntry<T> | null,
    columnsConfig: ColumnsConfig<T>,

    focusSibling: (i: number, offset: number, isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => void,
    onFocus: (leaf: TreeLeaf<T>, isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => void,
    onSelect: (leaf: TreeLeaf<T>) => void,
    onExpand: (leaf: TreeLeaf<T>) => void,
    onContextMenu: (e: React.MouseEvent, entry: TreeEntry<T>) => void,
}

export default class Leaf<T> extends React.Component<Props<T>, {}> {
    tableRowElement: HTMLTableRowElement | null = null;

    isSelected = () => this.props.selectedEntries.some(e => e.id === this.props.entry.id);
    isFocused = () => this.props.focusedEntry ? (this.props.focusedEntry.id === this.props.entry.id) : false;

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
            this.focus(e.metaKey, e.shiftKey)
        }
    };

    onKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
        e.stopPropagation();
        switch (e.key) {
            case 'Enter':
                this.props.onSelect(this.props.entry);
                break;
            case 'ArrowRight':
                this.props.onExpand(this.props.entry);
                break;
            case 'ArrowUp':
                this.props.focusSibling(this.props.index, -1, e.metaKey, e.shiftKey);
                break;
            case 'ArrowDown':
                this.props.focusSibling(this.props.index, 1, e.metaKey, e.shiftKey);
                break;
            default:
                //
        }
    };

    onDragStart = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.dataTransfer.setData('application/json', JSON.stringify({id: this.props.entry.id}));
    };

    onDoubleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
        e.stopPropagation();
        this.props.onSelect(this.props.entry);
    };

    focus = (isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => {
        if (this.tableRowElement) {
            this.tableRowElement.focus();
        }
        this.props.onFocus(this.props.entry, isMetaKeyHeld, isShiftKeyHeld);
    };

    focusLastChild = (isMetaKeyHeld: boolean, isShiftKeyHeld: boolean) => {
        this.focus(isMetaKeyHeld, isShiftKeyHeld);
    };

    render() {
        // TODO: it's a shame these are duplicated between node and leaf
        const selected = this.props.selectedEntries.some(e => e.id === this.props.entry.id);
        const focused = this.props.focusedEntry ? (this.props.focusedEntry.id === this.props.entry.id) : false;
        const tabIndex = this.props.isFirst ? 0 : -1;

        return (
            <tr ref={n => {if (n !== null) this.tableRowElement = n;}}
                draggable
                className={`file-browser__entry ${focused ? 'file-browser__entry--focused' : ''} ${selected ? 'file-browser__entry--selected' : ''}`}
                tabIndex={tabIndex}
                onKeyDown={this.onKeyDown}
                onMouseDown={this.onMouseDown}
                onMouseUp={this.onMouseUp}
                onDoubleClick={this.onDoubleClick}
                onDragStart={this.onDragStart}
                onContextMenu={(e: React.MouseEvent) => this.props.onContextMenu(e, this.props.entry)}
            >

                {
                    this.props.columnsConfig.columns.map((column, index) => {
                        return (
                            <td key={column.name} className='file-browser__cell' style={column.style} align={column.align}>
                                <div className='file-browser__cell-flex-container'>
                                {
                                    index === 0
                                    ?
                                        <React.Fragment>
                                            {[...Array(this.props.depth)].map((m, i) => <span key={i} className='file-browser__name-pad'></span>)}
                                            {this.props.entry.isExpandable
                                            && <MenuChevron
                                                onClick={() => this.props.onExpand(this.props.entry)}
                                                expanded={false}
                                            />}
                                        </React.Fragment>
                                    : false
                                }
                                { column.render(this.props.entry) }
                                </div>
                            </td>
                        );
                    })
                }
                {/* Padding cell*/}
                <td className='file-browser__cell'/>
            </tr>
        );
    }
}
