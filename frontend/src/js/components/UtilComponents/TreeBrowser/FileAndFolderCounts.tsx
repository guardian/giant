import React from "react";

interface FileAndFolderCountsProps {
  descendantsNodeCount: number;
  descendantsLeafCount: number;
}

export const FileAndFolderCounts = ({descendantsNodeCount, descendantsLeafCount}: FileAndFolderCountsProps) => (
  <span style={{marginLeft: "5px", fontSize: "smaller", color: "#8b8b8b"}}>
    ({descendantsNodeCount === 0 && descendantsLeafCount === 0
      ? 'empty'
      : `${descendantsNodeCount.toLocaleString()} folders & ${descendantsLeafCount.toLocaleString()} files`
    })
  </span>
)
