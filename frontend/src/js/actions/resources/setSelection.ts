import { ResourceActionType } from "../../types/redux/GiantActions";
import { GiantDispatch } from "../../types/redux/GiantDispatch";
import { ResourceRange } from "../../types/Resource";

export function getOffsetWithinHighlightedText(
  offsetWithinNode: number,
  initialTextNode: Node,
): number {
  const parentSpan = initialTextNode.parentElement;
  return offsetWithinNode + parseInt(parentSpan!.dataset.highlightOffset!, 10);
}

function freezeSelection(selection: Selection): ResourceRange {
  const anchorOffset = getOffsetWithinHighlightedText(
    selection.anchorOffset,
    selection.anchorNode!,
  );
  const focusOffset = getOffsetWithinHighlightedText(
    selection.focusOffset,
    selection.focusNode!,
  );

  return {
    startCharacter: Math.min(anchorOffset, focusOffset),
    endCharacter: Math.max(anchorOffset, focusOffset),
  };
}

export function setSelection(selection?: Selection) {
  return (dispatch: GiantDispatch) => {
    dispatch({
      type: ResourceActionType.SET_SELECTION,
      selection: selection ? freezeSelection(selection) : undefined,
    });
  };
}
