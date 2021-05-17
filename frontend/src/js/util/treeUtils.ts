import { ColumnsConfig, isTreeLeaf, isTreeNode, Tree, TreeEntry, TreeNode } from '../types/Tree';
import * as R from 'ramda';

// It's important to match on the id and not for object equality,
// because we may have re-fetched the workspace and create new objects.
// Hence all these helper functions.
export function entriesIncludes<T>(entries: TreeEntry<T>[], entry: TreeEntry<T>) {
    return entries.some(e => e.id === entry.id);
}

export function entriesIndexOf<T>(entries: TreeEntry<T>[], entry: TreeEntry<T>) {
    return entries.findIndex(e => e.id === entry.id);
}

export function entriesAreEqual<T>(a: TreeEntry<T>, b: TreeEntry<T>) {
    return a.id === b.id;
}

function treeToOrderedEntriesRecursive<T>(
    entries: TreeEntry<T>[],
    linearisedIds: TreeEntry<T>[],
    columnsConfig: ColumnsConfig<T>,
    expandedNodes: TreeNode<T>[],
): TreeEntry<T>[] {
    const sortedEntries = sortEntries(entries, columnsConfig);
    let newLinearisedIds = [...linearisedIds];
    for (const entry of sortedEntries) {
        newLinearisedIds.push(entry);
        if (isTreeNode(entry) && entriesIncludes(expandedNodes, entry)) {
            newLinearisedIds = treeToOrderedEntriesRecursive(
                entry.children,
                newLinearisedIds,
                columnsConfig,
                expandedNodes
            );
        }
    }

    return newLinearisedIds;
}

export function isDescendantOf<T>(
    potentialDescendant: TreeEntry<T>,
    potentialAncestor: TreeEntry<T>
): boolean {
    if (isTreeLeaf(potentialAncestor)) {
        return false;
    }
    for (const child of potentialAncestor.children) {
        if (child === potentialDescendant) {
            return true;
        }
        if (isTreeNode(child) && isDescendantOf(potentialDescendant, child)) {
            return true;
        }
    }
    return false;
}

export function treeToOrderedEntries<T>(
    tree: Tree<T>,
    columnsConfig: ColumnsConfig<T>,
    expandedNodes: TreeNode<T>[]
): TreeEntry<T>[] {
    return treeToOrderedEntriesRecursive(tree, [], columnsConfig, expandedNodes);
}

export function sortEntries<T>(
    entries: TreeEntry<T>[],
    columnsConfig: ColumnsConfig<T>
): TreeEntry<T>[] {
    const sortColumn = columnsConfig.columns.find(c => c.name === columnsConfig.sortColumn);

    const sortedEntries = sortColumn ? R.sort(sortColumn.sort, entries) : entries;

    if (columnsConfig.sortDescending) {
        sortedEntries.reverse();
    }

    return sortedEntries;
}

export function getIdsOfEntriesToMove<T>(
    selectedEntries: TreeEntry<T>[],
    idOfDraggedEntry: string
): string[] {
    if (!selectedEntries.map(e => e.id).includes(idOfDraggedEntry)) {
        console.error('Dragged entry was not in selected entries');
        return [];
    }

    // Remove selected entries which are descendants of other selected entries.
    const selectedAncestors = selectedEntries.filter(entry =>
        !selectedEntries.some(e => isDescendantOf(entry, e))
    );
    return selectedAncestors.map(treeEntry => treeEntry.id);
}

export function getShiftClickSelectedEntries<T>(
    orderedEntries: TreeEntry<T>[],
    previouslyFocusedEntry: TreeEntry<T>,
    newlyFocusedEntry: TreeEntry<T>,
): TreeEntry<T>[] {
    const previouslyFocusedIndex = entriesIndexOf(orderedEntries, previouslyFocusedEntry);
    const newlyFocusedIndex = entriesIndexOf(orderedEntries, newlyFocusedEntry);
    const shiftClickSelectedEntries = orderedEntries.slice(
        Math.min(previouslyFocusedIndex, newlyFocusedIndex),
        Math.max(previouslyFocusedIndex, newlyFocusedIndex) + 1
    );
    return shiftClickSelectedEntries;
}

export function newSelectionFromShiftClick<T>(
    previousShiftClickSelectedEntries: TreeEntry<T>[],
    newShiftClickSelectedEntries: TreeEntry<T>[],
    currentSelectedEntries: TreeEntry<T>[]
): TreeEntry<T>[] {
    // shift-click lets us redefine the previous shift-click selection.
    // To do that, we need to remove those entries before we add our new shift-click selection.
    // We also remove entries from the new selection that are already in there,
    // to avoid duplicates if our shift-click selection overlaps with an existing selection.
    const currentSelectedEntriesWithoutShiftClickOnes = currentSelectedEntries.filter(entry =>
        !entriesIncludes(previousShiftClickSelectedEntries, entry)
        && !entriesIncludes(newShiftClickSelectedEntries, entry)
    );

    return [
        ...currentSelectedEntriesWithoutShiftClickOnes,
        ...newShiftClickSelectedEntries,
    ];
}
