import React, { FC } from "react";
import ChevronLeft from "react-icons/lib/fa/chevron-left";
import ChevronRight from "react-icons/lib/fa/chevron-right";
import styles from "./SearchStepper.module.css";
import { SearchHighlightStepper } from "../viewer/useSearchHighlightStepper";

// unfortunately in GiantState q is just a string so we have to do all this to tease out the type and format it nicely
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
      .join(" ");
  } catch {
    return raw;
  }
}

type SearchStepperProps = {
  highlightStepper: SearchHighlightStepper;
  isPending?: boolean;
};

export const SearchStepper: FC<SearchStepperProps> = ({
  highlightStepper,
  isPending,
}) => {
  const { query, currentHighlight, totalHighlights, next, previous } =
    highlightStepper;
  if (!query || (totalHighlights === 0 && !isPending)) {
    return null;
  }

  const displayQuery = formatQuery(query);

  const countText =
    currentHighlight !== undefined
      ? `${currentHighlight + 1} of ${totalHighlights}`
      : `${totalHighlights} results`;

  return (
    <div className={styles.container}>
      <span className={styles.query}>{displayQuery}</span>
      <span className={styles.count}>{isPending ? "..." : countText}</span>
      <button
        className={styles.navButton}
        onClick={previous}
        title="Previous match"
      >
        <ChevronLeft />
      </button>
      <button className={styles.navButton} onClick={next} title="Next match">
        <ChevronRight />
      </button>
    </div>
  );
};
