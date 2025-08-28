// Simple manual timezone conversion for Australia/Melbourne (UTC+10 in winter, UTC+11 in summer)
// For August (winter), Melbourne is UTC+10

// Convert UTC ISO string to Melbourne local time for datetime-local input
export function localInputFromISO(iso?: string) {
  if (!iso) return "";
  
  try {
    // Add 10 hours to UTC to get Melbourne time
    const utcDate = new Date(iso);
    const melbDate = new Date(utcDate.getTime() + (10 * 60 * 60 * 1000));
    
    const p = (n: number) => String(n).padStart(2, "0");
    return `${melbDate.getUTCFullYear()}-${p(melbDate.getUTCMonth()+1)}-${p(melbDate.getUTCDate())}T${p(melbDate.getUTCHours())}:${p(melbDate.getUTCMinutes())}`;
  } catch (error) {
    console.error("Error converting ISO to local input:", error);
    return "";
  }
}

// Convert Melbourne local time from datetime-local input to UTC ISO
export function isoFromLocalInput(local?: string) {
  if (!local) return null;
  
  try {
    // Simple approach: treat the input as Melbourne time and subtract 10 hours to get UTC
    // Add ":00" seconds if not present, then treat as UTC time and subtract 10 hours
    const withSeconds = local.includes(':') && local.split(':').length === 2 ? `${local}:00` : local;
    const melbourneTime = new Date(`${withSeconds}Z`); // Treat as UTC first
    const utcTime = new Date(melbourneTime.getTime() - (10 * 60 * 60 * 1000)); // Subtract 10 hours
    
    return utcTime.toISOString();
  } catch (error) {
    console.error("Error converting local input to ISO:", error);
    return null;
  }
}