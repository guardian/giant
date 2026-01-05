import React from "react";

type Props = {
  destinationWorkspaceName: string;
  onSubmit: (action: "copy" | "move") => void;
};
export const CopyOrMoveModal = ({
  destinationWorkspaceName,
  onSubmit,
}: Props) => {
  return (
    <form className="form">
      <h2>Copy or move items</h2>
      Do you want to copy or move the selected items to the workspace '
      {destinationWorkspaceName}'?
      <div className="modal-action__buttons">
        <button className="btn" onClick={() => onSubmit("move")} type="button">
          Move
        </button>

        <button className="btn" onClick={() => onSubmit("copy")} type="button">
          Copy
        </button>
      </div>
    </form>
  );
};
