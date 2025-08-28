// Timezone-aware date utilities for mobile schedule  
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

const DEFAULT_TZ = "Australia/Melbourne";

/** Parse an ISO string that SHOULD be UTC (ending with Z). */
export function parseUtcIso(iso: string): Date {
  const fixed = iso.endsWith("Z") ? iso : iso + "Z";
  const d = new Date(fixed);
  if (isNaN(d.getTime())) throw new Error(`Bad ISO date: ${iso}`);
  return d;
}

/** Build the UTC range [start,end] that corresponds to a LOCAL day in tz. */
export function utcRangeForLocalDay(
  anyLocalMoment: Date,
  tz: string = DEFAULT_TZ
): { fromUtc: Date; toUtc: Date } {
  const day = formatInTimeZone(anyLocalMoment, tz, "yyyy-MM-dd");
  const fromUtc = fromZonedTime(`${day} 00:00:00.000`, tz);
  const toUtc = fromZonedTime(`${day} 23:59:59.999`, tz);
  return { fromUtc, toUtc };
}

/** Filter jobs whose scheduled_at falls within the given LOCAL day window. */
export function filterJobsForLocalDay<T extends { scheduled_at: string }>(
  jobs: T[],
  dayLocal: Date,
  tz: string = DEFAULT_TZ
): T[] {
  const { fromUtc, toUtc } = utcRangeForLocalDay(dayLocal, tz);
  return jobs.filter(j => {
    if (!j.scheduled_at) return false;
    try {
      const d = parseUtcIso(j.scheduled_at);
      return d >= fromUtc && d <= toUtc;
    } catch {
      return false;
    }
  });
}

/** Make a day key in the target tz (useful for grouping headers). */
export function dayKeyLocal(dateUtc: Date, tz: string = DEFAULT_TZ): string {
  // "YYYY-MM-DD" in the chosen tz
  return formatInTimeZone(dateUtc, tz, "yyyy-MM-dd");
}

/** Group jobs by local day using their scheduled_at (UTC ISO). */
export function groupJobsByLocalDay<T extends { scheduled_at: string }>(
  jobs: T[],
  tz: string = DEFAULT_TZ
): Record<string, T[]> {
  const buckets: Record<string, T[]> = {};
  for (const j of jobs) {
    if (!j.scheduled_at) continue;
    try {
      const dUtc = parseUtcIso(j.scheduled_at);
      const key = dayKeyLocal(dUtc, tz);
      (buckets[key] ||= []).push(j);
    } catch {
      // Skip invalid dates
      continue;
    }
  }
  // Sort each bucket by time
  for (const key of Object.keys(buckets)) {
    buckets[key].sort((a, b) => {
      const aTime = parseUtcIso(a.scheduled_at).getTime();
      const bTime = parseUtcIso(b.scheduled_at).getTime();
      return aTime - bTime;
    });
  }
  return buckets;
}

/** Build UTC range for a full week starting from Monday in local timezone */
export function utcRangeForLocalWeek(
  weekStart: Date,
  tz: string = DEFAULT_TZ
): { fromUtc: Date; toUtc: Date } {
  // Get the first day (Monday) range
  const mondayRange = utcRangeForLocalDay(weekStart, tz);
  
  // Get the last day (Sunday) - add 6 days to Monday
  const sunday = new Date(weekStart);
  sunday.setDate(sunday.getDate() + 6);
  const sundayRange = utcRangeForLocalDay(sunday, tz);
  
  return {
    fromUtc: mondayRange.fromUtc,
    toUtc: sundayRange.toUtc
  };
}