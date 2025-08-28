// server/time.ts
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

const DEFAULT_TZ = process.env.DEFAULT_TIMEZONE || "Australia/Melbourne";

// Parse any input string that user typed in local tz → UTC Date
export function parseLocalToUTC(inputISOorLocal: string, userTz?: string): Date {
  const tz = userTz || DEFAULT_TZ;
  // fromZonedTime converts local time to UTC
  return fromZonedTime(inputISOorLocal, tz);
}

// Turn a UTC Date to ISO 8601 "Z" string for API
export function toIsoUTC(d: Date): string {
  return new Date(d).toISOString();
}

// Format a UTC Date for a given tz (for server-side pre-formatting if needed)
export function formatForTz(d: Date, tz = DEFAULT_TZ, fmt = "yyyy-LL-dd HH:mm") {
  return formatInTimeZone(d, tz, fmt);
}

// Only use this if you need a JS Date in a target tz (rare on server)
export function utcDateToTzDate(d: Date, tz = DEFAULT_TZ): Date {
  return toZonedTime(d, tz);
}