import { useMemo } from "react";
import { utcIsoToLocalString } from "../lib/time";

export const useLocalTime = (isoUtc?: string | null) => {
  const text = useMemo(() => {
    if (!isoUtc) return "";
    return utcIsoToLocalString(isoUtc);
  }, [isoUtc]);
  return text;
};