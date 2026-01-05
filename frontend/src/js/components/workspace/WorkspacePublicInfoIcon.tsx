import { Popup } from "semantic-ui-react";
import InfoIcon from "react-icons/lib/md/info-outline";
import React from "react";

export function WorkspacePublicInfoIcon() {
  const publicExplainer =
    "Public workspaces can be viewed and edited by all Giant users. " +
    "They are not accessible to people who do not have access to Giant.";

  return (
    <Popup
      content={publicExplainer}
      trigger={<InfoIcon className="info-icon" data-effect="solid" />}
    />
  );
}
