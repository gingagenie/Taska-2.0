// src/lib/time.ts
import { formatInTimeZone } from "date-fns-tz";

export function utcIsoToLocalDate(isoUtc: string): Date {
  // Treat as UTC and convert to local Date object
  return new Date(isoUtc); // JS Date keeps it UTC internally; .toLocaleString renders local
}

export function utcIsoToLocalString(
  isoUtc: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  locale?: string
) {
  // Force Melbourne timezone since the server environment is UTC
  const d = new Date(isoUtc);
  return d.toLocaleString(locale || "en-AU", { 
    ...opts, 
    timeZone: "Australia/Melbourne" 
  });
}

// If you want a specific tz (not the browser's), use date-fns-tz:
export function utcIsoToTzString(
  isoUtc: string,
  tz = "Australia/Melbourne",
  fmt = "yyyy-LL-dd HH:mm"
) {
  return formatInTimeZone(isoUtc, tz, fmt);
}