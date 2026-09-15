import { Popup } from "semantic-ui-react";
import { MdInfoOutline } from "react-icons/md";
import React from "react";

export function WorkspacePublicInfoIcon() {
  const publicExplainer =
    "Public workspaces can be viewed and edited by all Giant users. " +
    "They are not accessible to people who do not have access to Giant.";

  return (
    <Popup
      content={publicExplainer}
      trigger={<MdInfoOutline className="info-icon" data-effect="solid" />}
    />
  );
}
