import {useEffect, useState} from "react";
import moment from "moment";

interface FromNowDurationTextProps {
  date: Date;
}

export const FromNowDurationText = ({ date }: FromNowDurationTextProps) => {
  const setNow = useState<Date>()[1];
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date()); // use to trigger re-render
    }, 1000);
    return () => clearInterval(interval);
  }, [setNow]);
  return <span title={date?.toLocaleString()}>{moment(date).fromNow()}</span>;
};
