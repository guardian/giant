import React, { useState } from "react";
import { Pagination } from "semantic-ui-react";
import sortBy from "lodash/sortBy";

import DocumentIcon from "react-icons/lib/ti/document";
import EmailIcon from "react-icons/lib/md/email";
import FolderIcon from "react-icons/lib/md/folder-open";

import { Resource, BasicResource } from "../../types/Resource";
import { getLastPart } from "../../util/stringUtils";
import { MAX_NUMBER_OF_CHILDREN } from "../../util/resourceUtils";
import { ResourceBreadcrumbs } from "../ResourceBreadcrumbs";
import { SearchLink } from "../UtilComponents/SearchLink";

export function renderIcon(resource: BasicResource) {
  switch (resource.type) {
    case "directory":
      return <FolderIcon className="file-browser__icon" />;
    case "file":
      return <DocumentIcon className="file-browser__icon" />;
    case "email":
      return <EmailIcon className="file-browser__icon" />;
    default:
      return null;
  }
}

export default function PagedBrowser({ resource }: { resource: Resource }) {
  const totalPages = Math.floor(
    resource.children.length / MAX_NUMBER_OF_CHILDREN,
  );
  const [page, setPage] = useState(1);

  // Pull folders up to the top
  const sortedChildren = sortBy(
    resource.children,
    ({ type }) => type !== "directory",
  );
  const childrenToDisplay = sortedChildren.slice(
    (page - 1) * MAX_NUMBER_OF_CHILDREN,
    (page - 1) * MAX_NUMBER_OF_CHILDREN + MAX_NUMBER_OF_CHILDREN,
  );

  return (
    <React.Fragment>
      <ResourceBreadcrumbs
        className=""
        childClass="lazy-tree-browser__filename"
        resource={resource}
        showParents={false}
        showChildren={false}
        lastSegmentOnly={false}
        showCurrent={true}
      />
      <div className="file-browser__wrapper">
        <table className="file-browser">
          <tbody>
            {childrenToDisplay.map((resource) => {
              const name = getLastPart(
                resource.display || decodeURIComponent(resource.uri),
                "/",
              );

              return (
                <tr key={resource.uri} className="file-browser__entry">
                  <td>
                    {renderIcon(resource)}
                    <SearchLink to={`/resources/${resource.uri}`}>
                      {name}
                    </SearchLink>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination
          defaultActivePage={1}
          totalPages={totalPages}
          onPageChange={(e, { activePage }) => {
            if (activePage) {
              setPage(
                typeof activePage === "number"
                  ? activePage
                  : parseInt(activePage),
              );
            }
          }}
        />
      </div>
    </React.Fragment>
  );
}
