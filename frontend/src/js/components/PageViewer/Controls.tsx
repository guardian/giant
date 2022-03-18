import React, { FC } from "react";
import RotateLeft from "react-icons/lib/md/rotate-left";
import RotateRight from "react-icons/lib/md/rotate-right";
import styles from "./Controls.module.css";
import { FindInput } from "./FindInput";

type ControlsProps = {
  // Rotation
  rotateClockwise: () => void;
  rotateAnticlockwise: () => void;

  // Find Search Input
  findSearch: string;
  setFind: (v: string) => void;

  performFind: (query: string) => Promise<void>;

  jumpToNextFindHit: () => void;
  jumpToPreviousFindHit: () => void;
  findSearchHits: number[];
  lastPageHit: number;
};

export const Controls: FC<ControlsProps> = ({
  rotateClockwise,
  rotateAnticlockwise,
  findSearch,
  setFind,
  jumpToNextFindHit,
  jumpToPreviousFindHit,
  performFind,
  findSearchHits,
  lastPageHit,
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
        hits={findSearchHits}
        lastPageHit={lastPageHit}
        performFind={performFind}
        jumpToNextFindHit={jumpToNextFindHit}
        jumpToPreviousFindHit={jumpToPreviousFindHit}
      />
    </div>
  );
};
