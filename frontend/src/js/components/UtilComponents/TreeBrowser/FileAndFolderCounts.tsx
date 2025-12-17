import React from "react";

interface FileAndFolderCountsProps {
  descendantsNodeCount: number;
  descendantsLeafCount: number;
  prefix?: string;
  marginLeft?: string | number;
}

export const FileAndFolderCounts = ({marginLeft, descendantsNodeCount, descendantsLeafCount, prefix}: FileAndFolderCountsProps) => (
  <span style={{marginLeft, fontSize: "smaller", color: "#8b8b8b"}}>
    ({prefix}{prefix && " "}{descendantsNodeCount === 0 && descendantsLeafCount === 0
      ? 'empty'
      : `${descendantsNodeCount.toLocaleString()} folders & ${descendantsLeafCount.toLocaleString()} files`
    })
  </span>
)
