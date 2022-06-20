import React, { FC } from "react";
import RotateLeft from "react-icons/lib/md/rotate-left";
import RotateRight from "react-icons/lib/md/rotate-right";
import styles from "./Controls.module.css";
import { FindInput } from "./FindInput";
import { HighlightForSearchNavigation } from './model';

type ControlsProps = {
  // Rotation
  rotateClockwise: () => void;
  rotateAnticlockwise: () => void;

  // Find Search Input
  findSearch: string;
  setFind: (v: string) => void;

  performFind: (query: string) => Promise<void>;
  isPending: boolean;

  jumpToNextFindHit: () => void;
  jumpToPreviousFindHit: () => void;
  findHighlights: HighlightForSearchNavigation[];
  focusedFindHighlightIndex: number | null;
};

export const Controls: FC<ControlsProps> = ({
  rotateClockwise,
  rotateAnticlockwise,
  findSearch,
  setFind,
  jumpToNextFindHit,
  jumpToPreviousFindHit,
  performFind,
  isPending,
  findHighlights,
  focusedFindHighlightIndex,
}) => {
  return (
    <div className={styles.bar}>
      <div>
        <button onClick={rotateAnticlockwise}>
          <RotateLeft />
        </button>
        <button onClick={rotateClockwise}>
          <RotateRight />
        </button>
      </div>

      <FindInput
        value={findSearch}
        setValue={setFind}
        highlights={findHighlights}
        focusedFindHighlightIndex={focusedFindHighlightIndex}
        performFind={performFind}
        isPending={isPending}
        jumpToNextFindHit={jumpToNextFindHit}
        jumpToPreviousFindHit={jumpToPreviousFindHit}
      />
    </div>
  );
};
