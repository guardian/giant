import React from "react";

interface FileAndFolderCountsProps {
  descendantsNodeCount: number;
  descendantsLeafCount: number;
  prefix?: string;
  marginLeft?: string | number;
  // POC (issue #369): false when descendant counts aren't computed (lazy loading).
  // We then show "counts pending..." rather than the wrong "empty" — better to admit
  // we don't know than to assert false information.
  countsKnown?: boolean;
}

export const FileAndFolderCounts = ({
  marginLeft,
  descendantsNodeCount,
  descendantsLeafCount,
  prefix,
  countsKnown = true,
}: FileAndFolderCountsProps) => (
  <span style={{ marginLeft, fontSize: "smaller", color: "#8b8b8b" }}>
    ({prefix}
    {prefix && " "}
    {!countsKnown
      ? "counts pending..."
      : descendantsNodeCount === 0 && descendantsLeafCount === 0
        ? "empty"
        : `${descendantsNodeCount.toLocaleString()} folders & ${descendantsLeafCount.toLocaleString()} files`}
    )
  </span>
);
