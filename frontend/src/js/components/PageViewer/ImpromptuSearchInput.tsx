import React, { ChangeEventHandler, FC } from "react";
import styles from "./ImpromptuSearchInput.module.css";

type ImpromptuSearchInputProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  performImpromptuSearch: (pageNumber: number) => Promise<void>;
  jumpToNextImpromptuSearchHit: () => void;
};

export const ImpromptuSearchInput: FC<ImpromptuSearchInputProps> = ({
  value,
  onChange,
  jumpToNextImpromptuSearchHit,
}) => {
  return (
    <div className={styles.popover}>
      <div className={styles.container}>
        <input value={value} onChange={onChange} />
        <button onClick={jumpToNextImpromptuSearchHit}>⬇️</button>
        <button>⬆️️</button>
      </div>
    </div>
  );
};
