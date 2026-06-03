import React, { useState, useCallback } from "react";

import { MenuChevron } from "../UtilComponents/MenuChevron";
import { TriStateCheckbox } from "../UtilComponents/TriStateCheckbox";
import { TriState, getTriState, triStateCycle } from "../Search/triStateCycle";
import { PolarityValues } from "../Search/chipParsing";

interface AggBucket {
  key: string;
  count?: number;
  buckets?: AggBucket[];
}

interface SidebarOption {
  value: string;
  display?: string;
  suboptions?: SidebarOption[];
}

interface TriStateSidebarSectionProps {
  title: string;
  filterKey: string;
  options: SidebarOption[];
  positiveValues: string[];
  negativeValues: string[];
  onToggle: (values: PolarityValues) => void;
  agg?: { key: string; buckets?: AggBucket[] };
  isExpanded: boolean;
  setExpanded: () => void;
  missingAggValue?: string;
}

const TriStateSidebarSection: React.FC<TriStateSidebarSectionProps> = ({
  title,
  options,
  positiveValues,
  negativeValues,
  onToggle,
  agg,
  isExpanded,
  setExpanded,
  missingAggValue = "0",
}) => {
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(
    new Set(),
  );

  const toggleOptionExpanded = useCallback((value: string) => {
    setExpandedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const handleToggle = useCallback(
    (value: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const result = triStateCycle(value, positiveValues, negativeValues);
      onToggle(result);
    },
    [positiveValues, negativeValues, onToggle],
  );

  const findAggBucket = useCallback(
    (value: string): AggBucket | undefined => {
      if (!agg || !agg.buckets) return undefined;
      return agg.buckets.find((b) => b.key === value);
    },
    [agg],
  );

  const findSubBucket = useCallback(
    (parentValue: string, subValue: string): AggBucket | undefined => {
      const parentBucket = findAggBucket(parentValue);
      if (!parentBucket || !parentBucket.buckets) return undefined;
      return parentBucket.buckets.find((b) => b.key === subValue);
    },
    [findAggBucket],
  );

  const renderAggCount = (value: string) => {
    const bucket = findAggBucket(value);
    if (bucket) {
      return <div className="sidebar__count">{bucket.count}</div>;
    }
    if (agg) {
      return <div className="sidebar__count">{missingAggValue}</div>;
    }
    return null;
  };

  const renderSubOptions = (option: SidebarOption) => {
    if (!expandedOptions.has(option.value)) return null;
    if (!option.suboptions || option.suboptions.length === 0) return null;

    return option.suboptions.map((sub) => {
      const subBucket = findSubBucket(option.value, sub.value);
      const optState = getTriState(
        option.value,
        positiveValues,
        negativeValues,
      );
      if (agg && !subBucket && optState === "off") return null;

      return (
        <div key={sub.value} className="sidebar__item sidebar__mime-info">
          <div className="sidebar__chevron-container" />
          <div className="sidebar__item__text">{sub.display || sub.value}</div>
          {subBucket && <div className="sidebar__count">{subBucket.count}</div>}
        </div>
      );
    });
  };

  const renderOptions = () => {
    if (!isExpanded) return null;

    return options.map((option) => {
      const optState: TriState = getTriState(
        option.value,
        positiveValues,
        negativeValues,
      );
      const hasSuboptions = option.suboptions && option.suboptions.length > 0;
      const isSubExpanded = expandedOptions.has(option.value);

      return (
        <div key={option.value}>
          <div
            className="sidebar__filtervalue"
            onClick={() => hasSuboptions && toggleOptionExpanded(option.value)}
          >
            <div className="sidebar__item">
              <div className="sidebar__chevron-container">
                {hasSuboptions && (
                  <MenuChevron
                    expanded={isSubExpanded}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOptionExpanded(option.value);
                    }}
                  />
                )}
              </div>
              <div className="sidebar__item__text">
                {option.display || option.value}
              </div>
              {renderAggCount(option.value)}
              <TriStateCheckbox
                state={optState}
                onClick={(e) => handleToggle(option.value, e)}
              />
            </div>
          </div>
          {renderSubOptions(option)}
        </div>
      );
    });
  };

  return (
    <div className="sidebar__group">
      <div className="sidebar__item" onClick={setExpanded}>
        <MenuChevron
          expanded={isExpanded}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded();
          }}
        />
        <span className="sidebar__title__text">{title}</span>
      </div>
      {renderOptions()}
    </div>
  );
};

export default TriStateSidebarSection;
