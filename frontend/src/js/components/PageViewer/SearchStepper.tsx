import React, { FC } from "react";
import ChevronLeft from "react-icons/lib/fa/chevron-left";
import ChevronRight from "react-icons/lib/fa/chevron-right";
import styles from "./SearchStepper.module.css";

function formatQuery(raw: string): string {
  try {
    const parts = JSON.parse(raw);
    if (!Array.isArray(parts)) return raw;
    return parts
      .map((part: unknown) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "n" in part) {
          const chip = part as { n: string; v: string; op?: string };
          const prefix = chip.op === "-" ? "-" : "";
          return `${prefix}${chip.n}: ${chip.v}`;
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  } catch {
    return raw;
  }
}

type SearchStepperProps = {
  query: string;
  current: number | undefined;
  total: number;
  isPending?: boolean;
  onNext: () => void;
  onPrevious: () => void;
};

export const SearchStepper: FC<SearchStepperProps> = ({
  query,
  current,
  total,
  isPending,
  onNext,
  onPrevious,
}) => {
  if (!query || (total === 0 && !isPending)) {
    return null;
  }

  const displayQuery = formatQuery(query);

  const countText =
    current !== undefined ? `${current + 1} of ${total}` : `${total} results`;

  return (
    <div className={styles.container}>
      <span className={styles.query}>{displayQuery}</span>
      <span className={styles.count}>{isPending ? "..." : countText}</span>
      <button
        className={styles.navButton}
        onClick={onPrevious}
        title="Previous match"
      >
        <ChevronLeft />
      </button>
      <button className={styles.navButton} onClick={onNext} title="Next match">
        <ChevronRight />
      </button>
    </div>
  );
};
