import React from "react";
import { Link } from "react-router-dom";

type Props = {
  collections: string[];
  separator?: string;
};

export function CollectionLinks({ collections, separator = " · " }: Props) {
  if (!collections || collections.length === 0) return null;

  return (
    <React.Fragment>
      {separator}
      {collections.map((collection, i) => (
        <React.Fragment key={collection}>
          {i > 0 && ", "}
          <Link
            className="search-result__detail-link"
            to={`/collections/${encodeURIComponent(collection)}`}
          >
            {collection}
          </Link>
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}
