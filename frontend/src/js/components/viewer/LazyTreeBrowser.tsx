import React, { useState } from "react";
import { Menu } from "semantic-ui-react";
import { Resource, BasicResource } from "../../types/Resource";
import { getLastPart } from "../../util/stringUtils";
import DocumentIcon from "react-icons/lib/ti/document";
import EmailIcon from "react-icons/lib/md/email";
import TreeBrowser from "../UtilComponents/TreeBrowser";
import { ResourceBreadcrumbs } from "../ResourceBreadcrumbs";
import DetectClickOutside from "../UtilComponents/DetectClickOutside";
import AddToWorkspaceModal from "./AddToWorkspaceModal";
import { fetchResource } from "../../services/ResourceApi";
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
      return <DocumentIcon className="file-browser__icon" />;
    case "email":
      return <EmailIcon className="file-browser__icon" />;
    default:
      return null;
  }
}

export default function LazyTreeBrowser({
  rootResource,
  descendantResources,
  getChildResource,
}: PropTypes) {
  // You can't currently perform any actions after selecting a resource but we
  // highlight it anyway to avoid the UI feeling broken

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

    // Only show context menu for files, not expandable folders
    if (isTreeLeaf(entry) && !entry.isExpandable) {
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
            items={[
              {
                key: "addToWorkspace",
                content: "Add to workspace",
                icon: "plus",
              },
            ]}
            vertical
            onItemClick={() => {
              if (contextMenu.entry) {
                onAddToWorkspace(contextMenu.entry);
              }
            }}
          />
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
