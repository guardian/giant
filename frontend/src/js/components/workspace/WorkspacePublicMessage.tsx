import { Message } from "semantic-ui-react";
import React from "react";

export function WorkspacePublicMessage() {
  return (
    <Message info>
      <Message.Header>This workspace is public.</Message.Header>
      <p>
        Anyone with a login to Giant will be able to view, add, move, remove and
        rename files within it.
      </p>
      <p>
        Only you will be able to rename, delete or share the workspace itself.
      </p>
      <p>
        You can change this setting at any time by clicking Share Workspace.
      </p>
    </Message>
  );
}
