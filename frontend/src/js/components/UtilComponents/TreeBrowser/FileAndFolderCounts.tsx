import React from "react";

interface FileAndFolderCountsProps {
  descendantsNodeCount: number;
  descendantsLeafCount: number;
  prefix?: string;
}

export const FileAndFolderCounts = ({descendantsNodeCount, descendantsLeafCount, prefix}: FileAndFolderCountsProps) => (
  <span style={{marginLeft: prefix ? undefined : "5px", fontSize: "smaller", color: "#8b8b8b"}}>
    ({prefix}{prefix && " "}{descendantsNodeCount === 0 && descendantsLeafCount === 0
      ? 'empty'
      : `${descendantsNodeCount.toLocaleString()} folders & ${descendantsLeafCount.toLocaleString()} files`
    })
  </span>
)
