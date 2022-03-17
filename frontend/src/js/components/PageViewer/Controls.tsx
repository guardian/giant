import React, { FC } from "react";
import RotateLeft from "react-icons/lib/md/rotate-left";
import RotateRight from "react-icons/lib/md/rotate-right";
import styles from "./Controls.module.css";
import { ImpromptuSearchInput } from "./ImpromptuSearchInput";

type ControlsProps = {
  // Rotation
  rotateClockwise: () => void;
  rotateAnticlockwise: () => void;

  // Impromptu Search Input
  impromptuSearch: string;
  setImpromptuSearch: (v: string) => void;

  performImpromptuSearch: (query: string) => Promise<void>;

  jumpToNextImpromptuSearchHit: () => void;
  jumpToPreviousImpromptuSearchHit: () => void;
  impromptuSearchHits: number[];
  lastPageHit: number;
};

export const Controls: FC<ControlsProps> = ({
  rotateClockwise,
  rotateAnticlockwise,
  impromptuSearch,
  setImpromptuSearch,
  jumpToNextImpromptuSearchHit,
  jumpToPreviousImpromptuSearchHit,
  performImpromptuSearch,
  impromptuSearchHits,
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

      <ImpromptuSearchInput
        value={impromptuSearch}
        setValue={setImpromptuSearch}
        hits={impromptuSearchHits}
        lastPageHit={lastPageHit}
        performImpromptuSearch={performImpromptuSearch}
        jumpToNextImpromptuSearchHit={jumpToNextImpromptuSearchHit}
        jumpToPreviousImpromptuSearchHit={jumpToPreviousImpromptuSearchHit}
      />
    </div>
  );
};
