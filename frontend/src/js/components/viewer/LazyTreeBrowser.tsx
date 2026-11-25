import React, { useState } from "react";
import { useSelector } from "react-redux";
import { GiantState } from "../../types/redux/GiantState";
import { Menu } from "semantic-ui-react";
import { Resource, BasicResource } from "../../types/Resource";
import { getLastPart } from "../../util/stringUtils";
import { TiDocument } from "react-icons/ti";
import { MdEmail } from "react-icons/md";
import TreeBrowser from "../UtilComponents/TreeBrowser";
import { ResourceBreadcrumbs } from "../ResourceBreadcrumbs";
import DetectClickOutside from "../UtilComponents/DetectClickOutside";
import AddToWorkspaceModal from "./AddToWorkspaceModal";
import { confirmDeleteChain, fetchResource } from "../../services/ResourceApi";
import { hasSingleBlobChild } from "../../util/resourceUtils";
import sortBy from "lodash/sortBy";
import {
  Tree,
  TreeEntry,
  TreeLeaf,
  TreeNode,
  isTreeLeaf,
} from "../../types/Tree";
import { getChildResource } from "../../actions/resources/getResource";

type PropTypes = {
  rootResource: Resource;
  descendantResources: { [uri: string]: BasicResource };
  getChildResource: typeof getChildResource;
};

function resourceToTreeEntry(
  rootResource: BasicResource,
  descendantResources: { [uri: string]: BasicResource },
): TreeEntry<BasicResource> {
  const resource =
    (descendantResources && descendantResources[rootResource.uri]) ||
    rootResource;
  const name = getLastPart(
    resource.display || decodeURIComponent(resource.uri),
    "/",
  );

  if (resource.children && resource.children.length) {
    const childrenFoldersOnTop = sortBy(
      resource.children,
      (child) => !child.isExpandable,
    );
    return {
      id: resource.uri,
      name,
      data: resource,
      children: childrenFoldersOnTop.map((child) =>
        resourceToTreeEntry(child, descendantResources),
      ),
    };
  } else {
    return {
      id: resource.uri,
      name,
      isExpandable: resource.isExpandable,
      data: resource,
    };
  }
}

function treeFromResource(
  rootResource: BasicResource,
  descendantResources: { [uri: string]: BasicResource },
): Tree<BasicResource> {
  if (rootResource.children && rootResource.children.length) {
    const childrenFoldersOnTop = sortBy(
      rootResource.children,
      (child) => !child.isExpandable,
    );
    return childrenFoldersOnTop.map((child) =>
      resourceToTreeEntry(child, descendantResources),
    );
  } else {
    return [];
  }
}

function renderIcon(resource: BasicResource) {
  // Zips aren't viewable, so don't show a document icon that makes it seem like they are
  if (resource.type === "file" && resource.isExpandable) {
    return null;
  }

  switch (resource.type) {
    case "file":
      return <TiDocument className="file-browser__icon" />;
    case "email":
      return <MdEmail className="file-browser__icon" />;
    default:
      return null;
  }
}

export default function LazyTreeBrowser({
  rootResource,
  descendantResources,
  getChildResource,
}: PropTypes) {
  const isAdmin = useSelector((state: GiantState) =>
    state.users.myPermissions.includes("CanPerformAdminOperations"),
  );

  const [focusedEntry, setFocusedEntry] =
    useState<TreeEntry<BasicResource> | null>(null);

  const [expandedEntries, setExpandedEntries] = useState<
    TreeEntry<BasicResource>[]
  >([]);
  const [selectedEntries, setSelectedEntries] = useState<
    TreeEntry<BasicResource>[]
  >([]);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    entry: TreeEntry<BasicResource> | null;
    positionX: number;
    positionY: number;
  }>({ isOpen: false, entry: null, positionX: 0, positionY: 0 });

  const [addToWorkspaceModal, setAddToWorkspaceModal] = useState<{
    isOpen: boolean;
    resource: Resource | BasicResource | null;
  }>({ isOpen: false, resource: null });

  function onExpandNode(node: TreeNode<BasicResource>) {
    setExpandedEntries([...expandedEntries, node]);
  }

  function onCollapseNode(node: TreeNode<BasicResource>) {
    setExpandedEntries(expandedEntries.filter(({ id }) => id !== node.id));
  }

  function onExpandLeaf(leaf: TreeLeaf<BasicResource>) {
    getChildResource(leaf.id);
    // The leaf will become a node (à la the ugly duckling)
    // once its resource has been fetched, since it will have children.
    // We want to make sure that node appears expanded.
    setExpandedEntries([...expandedEntries, leaf]);
  }

  function onContextMenu(e: React.MouseEvent, entry: TreeEntry<BasicResource>) {
    if (e.metaKey && e.shiftKey) {
      // override for devs to do "inspect element"
      return;
    }
    e.preventDefault();

    if (canDelete(entry) || (isTreeLeaf(entry) && !entry.isExpandable)) {
      setSelectedEntries([entry]);
      setFocusedEntry(entry);
      setContextMenu({
        isOpen: true,
        entry,
        positionX: e.pageX,
        positionY: e.pageY,
      });
    }
  }

  function closeContextMenu() {
    setContextMenu({ isOpen: false, entry: null, positionX: 0, positionY: 0 });
  }

  function canDelete(entry: TreeEntry<BasicResource>) {
    return (
      isAdmin && (entry.data.type === "file" || entry.data.type === "email")
    );
  }

  async function onDelete(entry: TreeEntry<BasicResource>) {
    closeContextMenu();
    const showAffectedCollections =
      entry.data.type === "email" ||
      entry.data.isExpandable ||
      /\.zip$/i.test(entry.name);
    try {
      if (
        await confirmDeleteChain(
          decodeURIComponent(entry.data.uri),
          entry.name,
          showAffectedCollections,
        )
      )
        window.location.reload();
    } catch {
      window.alert(`Could not delete "${entry.name}".`);
    }
  }

  function onAddToWorkspace(entry: TreeEntry<BasicResource>) {
    closeContextMenu();
    // Fetch the resource, then resolve file → blob if needed.
    // Workspaces store references to blobs, not their parent file nodes.
    fetchResource(entry.data.uri, true).then((resource) => {
      if (hasSingleBlobChild(resource)) {
        const blobUri = resource.children[0].uri;
        return fetchResource(blobUri, false).then((blobResource) => {
          setAddToWorkspaceModal({ isOpen: true, resource: blobResource });
        });
      }
      setAddToWorkspaceModal({ isOpen: true, resource });
    });
  }

  function dismissAddToWorkspaceModal() {
    setAddToWorkspaceModal({ isOpen: false, resource: null });
  }

  return (
    <React.Fragment>
      <ResourceBreadcrumbs
        className=""
        childClass="lazy-tree-browser__filename"
        resource={rootResource}
        showParents={false}
        showChildren={false}
        lastSegmentOnly={false}
        showCurrent={true}
      />
      <TreeBrowser
        rootId={rootResource.uri}
        tree={treeFromResource(rootResource, descendantResources)}
        onFocus={(entry, isMetaKeyHeld) => {
          setSelectedEntries([entry]);
          setFocusedEntry(entry);
        }}
        clearFocus={() => {}}
        selectedEntries={selectedEntries}
        focusedEntry={focusedEntry}
        onMoveItems={() => {}}
        onSelectLeaf={(leaf: TreeLeaf<BasicResource>) => {
          const resource = leaf.data;
          if (resource.isExpandable) {
            onExpandLeaf(leaf);
          } else {
            window.open(`/resources/${resource.uri}`, "_blank");
          }
        }}
        onClickColumn={() => {}}
        columnsConfig={{
          columns: [
            {
              name: "files",
              align: "left",
              style: { width: "100%" },
              render: (n: TreeEntry<BasicResource>) => {
                const name = n.name || "--";
                const resource = n.data;
                return (
                  <React.Fragment>
                    {renderIcon(resource)}
                    <span data-uri={`/resources/${resource.uri}`}>{name}</span>
                    &nbsp;
                    {resource.type === "email" && resource.isExpandable && (
                      <a href={`/resources/${resource.uri}`}>View email</a>
                    )}
                  </React.Fragment>
                );
              },
              sort: (a, b) => {
                if (a.data.isExpandable !== b.data.isExpandable) {
                  return a.data.isExpandable ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
              },
            },
          ],
          sortDescending: false,
          sortColumn: "Name",
        }}
        expandedEntries={expandedEntries}
        onExpandLeaf={onExpandLeaf}
        onExpandNode={onExpandNode}
        onCollapseNode={onCollapseNode}
        onContextMenu={onContextMenu}
        showColumnHeaders={false}
      />
      {contextMenu.isOpen && contextMenu.entry && (
        <DetectClickOutside onClickOutside={closeContextMenu}>
          <Menu
            style={{
              position: "absolute",
              left: contextMenu.positionX,
              top: contextMenu.positionY,
            }}
            vertical
          >
            {isTreeLeaf(contextMenu.entry) &&
              !contextMenu.entry.isExpandable && (
                <Menu.Item
                  icon="plus"
                  content="Add to workspace"
                  onClick={() =>
                    contextMenu.entry && onAddToWorkspace(contextMenu.entry)
                  }
                />
              )}
            {canDelete(contextMenu.entry) && (
              <Menu.Item
                icon="trash"
                content="Delete"
                onClick={() => contextMenu.entry && onDelete(contextMenu.entry)}
              />
            )}
          </Menu>
        </DetectClickOutside>
      )}
      {addToWorkspaceModal.isOpen && addToWorkspaceModal.resource && (
        <AddToWorkspaceModal
          resource={addToWorkspaceModal.resource}
          isOpen={true}
          dismissModal={dismissAddToWorkspaceModal}
        />
      )}
    </React.Fragment>
  );
}
