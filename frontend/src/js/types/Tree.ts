import { CSSProperties, ReactElement } from 'react';


export interface BaseTreeEntry<T> {
    id: string,
    name: string,
    data: T
}

export interface TreeLeaf<T> extends BaseTreeEntry<T> {
    // isExpandable is only on the leaves, since nodes are expandable by definition (they already have children).
    // If a leaf is expandable, it means that it has children on the server but they have not yet been
    // fetched by the client.
    isExpandable: boolean,
}

export interface TreeNode<T> extends BaseTreeEntry<T> {
    children: TreeEntry<T>[]
}

export function isTreeNode<T>(treeEntry: TreeEntry<T>): treeEntry is TreeNode<T> {
    return (treeEntry as TreeNode<T>).children !== undefined;
}

export function isTreeLeaf<T>(treeEntry: TreeEntry<T>): treeEntry is TreeLeaf<T> {
    return (treeEntry as TreeNode<T>).children === undefined;
}

// This may seem redundant given BaseTreeEntry, but actually if I return a TreeNode from a function whose
// signature returns BaseTreeEntry, it complains because entries isn't in the BaseTreeEntry definition.
// Seems weird to me since normally you can return a subtype from a function whose signature is the supertype.
export type TreeEntry<T> = TreeLeaf<T> | TreeNode<T>
export type Tree<T> = TreeEntry<T>[]


type ColumnConfig<T> = {
    name: string,
    align: 'left' | 'center' | 'right',
    style: CSSProperties,
    render: (entry: TreeEntry<T>) => ReactElement
    sort: (a: TreeEntry<T>, b: TreeEntry<T>) => number
}

export type ColumnsConfig<T> = {
    sortDescending: boolean,
    sortColumn: string,
    columns: ColumnConfig<T>[]
}
