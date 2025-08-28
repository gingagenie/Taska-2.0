import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, format, set, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { utcIsoToLocalString } from "@/lib/time";
import { jobsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, Link } from "wouter";

type Job = {
  id: string;
  title: string;
  status: string;
  scheduled_at: string;
  customer_name?: string;
};

type ViewMode = "month" | "week";

// helpers
function statusTone(s: string) {
  if (!s) return "bg-gray-200 text-gray-700";
  if (s === "new") return "bg-blue-100 text-blue-800";
  if (s === "scheduled") return "bg-indigo-100 text-indigo-800";
  if (s === "in_progress") return "bg-amber-100 text-amber-800";
  if (s === "done" || s === "completed") return "bg-emerald-100 text-emerald-800";
  if (s === "cancelled") return "bg-rose-100 text-rose-800";
  return "bg-gray-200 text-gray-700";
}

function clampIsoDayWithTime(newDay: Date, timeFrom: Date) {
  // keep original hours:minutes of the job when moving between days
  return set(newDay, { hours: timeFrom.getHours(), minutes: timeFrom.getMinutes(), seconds: 0, milliseconds: 0 }).toISOString();
}

export default function SchedulePage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  // view + cursor date
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(new Date());

  // tech filter (single-select for now; can upgrade to multi later)
  const [techId, setTechId] = useState<string>("none");

  // compute range
  const monthStart = startOfMonth(cursor);
  const monthEnd   = endOfMonth(cursor);
  const gridStartM = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEndM   = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weekStart  = startOfWeek(cursor, { weekStartsOn: 1 });
  const weekEnd    = endOfWeek(cursor,   { weekStartsOn: 1 });

  const startDate = view === "month" ? gridStartM : weekStart;
  const endDate   = view === "month" ? gridEndM   : weekEnd;

  const startISO = startDate.toISOString();
  const endISO   = endDate.toISOString();

  // fetch jobs in window (optionally filtered by tech)
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["/api/jobs/range", startISO, endISO, techId === "none" ? "" : techId],
    queryFn: () => jobsApi.byRange(startISO, endISO, techId === "none" ? undefined : techId),
  });

  // fetch technicians for dropdown
  const { data: techs = [] } = useQuery({
    queryKey: ["/api/jobs/technicians"],
    queryFn: jobsApi.technicians,
  });

  // bucket jobs by yyyy-MM-dd (using Melbourne timezone for proper date grouping)
  const byDay = useMemo(() => {
    const map: Record<string, Job[]> = {};
    (jobs as Job[]).forEach((j) => {
      try {
        // Use formatInTimeZone to get Melbourne date for grouping
        const key = formatInTimeZone(j.scheduled_at, "Australia/Melbourne", "yyyy-MM-dd");
        (map[key] ||= []).push(j);
      } catch (e) {
        console.error(`Date parse error for job ${j.title}:`, e);
      }
    });
    return map;
  }, [jobs]);

  // build cells (either 6 weeks or 1 week)
  const cells: Date[] = [];
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) cells.push(d);

  // day modal
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const dayJobs: Job[] = useMemo(() => {
    if (!openDay) return [];
    const k = format(openDay, "yyyy-MM-dd");
    return byDay[k] || [];
  }, [openDay, byDay]);

  // drag & drop handlers (HTML5)
  function onDragStart(e: React.DragEvent, job: Job) {
    e.dataTransfer.setData("application/x-job-id", job.id);
    
    // Parse the UTC timestamp for drag operations
    try {
      const parsed = parseISO(job.scheduled_at);
      e.dataTransfer.setData("application/x-job-time", parsed.toISOString());
    } catch (err) {
      // Fallback to original
      e.dataTransfer.setData("application/x-job-time", new Date(job.scheduled_at).toISOString());
    }
    
    // allow move effect
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent) {
    // allow drop
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  async function onDrop(e: React.DragEvent, day: Date) {
    e.preventDefault();
    const id = e.dataTransfer.getData("application/x-job-id");
    const originalIso = e.dataTransfer.getData("application/x-job-time");
    if (!id || !originalIso) return;

    const newIso = clampIsoDayWithTime(day, new Date(originalIso));

    // optimistic: update cache for this range so UI moves instantly
    const key = ["/api/jobs/range", startISO, endISO, techId === "none" ? "" : techId];
    const prev = qc.getQueryData<Job[]>(key) || [];
    const next = (prev as Job[]).map(j => j.id === id ? { ...j, scheduled_at: newIso } : j);
    qc.setQueryData(key, next);

    try {
      await jobsApi.reschedule(id, newIso);
      // confirm with refetch
      qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      // revert on error
      qc.setQueryData(key, prev);
      console.error("Reschedule failed", err);
      alert("Failed to reschedule job.");
    }
  }

  // UI
  const weekNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return (
    <div className="p-6 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Schedule</h1>
          <div className="text-sm text-gray-500">
            {format(startDate, "d MMM")} – {format(endDate, "d MMM yyyy")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <Select value={view} onValueChange={(v)=>setView(v as ViewMode)}>
            <SelectTrigger className="w-36" data-testid="select-view-mode">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week view</SelectItem>
              <SelectItem value="month">Month view</SelectItem>
            </SelectContent>
          </Select>

          {/* Technician filter */}
          <Select value={techId} onValueChange={setTechId}>
            <SelectTrigger className="w-48" data-testid="select-technician">
              <SelectValue placeholder="All technicians" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All technicians</SelectItem>
              {(techs as any[]).map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name || t.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Nav */}
          <Button 
            variant="outline" 
            onClick={() => setCursor(new Date())}
            data-testid="button-schedule-today"
          >
            Today
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setCursor(view === "month" ? subMonths(cursor,1) : addDays(cursor, -7))}
            data-testid="button-schedule-prev"
          >
            Prev
          </Button>
          <Button 
            onClick={() => setCursor(view === "month" ? addMonths(cursor,1) : addDays(cursor, 7))}
            data-testid="button-schedule-next"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Grid */}
      <Card>
        <CardContent className="p-0">
          {/* Weekday header */}
          <div className="grid grid-cols-7 text-xs uppercase text-gray-500 border-b">
            {weekNames.map((w) => (<div key={w} className="px-3 py-2">{w}</div>))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {isLoading ? (
              <div className="col-span-7 p-8 text-center text-sm text-gray-500">Loading…</div>
            ) : (
              cells.map((d) => {
                const k = format(d, "yyyy-MM-dd");
                const list = byDay[k] || [];
                const faded = view === "month" && !isSameMonth(d, monthStart);
                const today = isToday(d);
                return (
                  <div
                    key={k}
                    onDragOver={onDragOver}
                    onDrop={(e)=>onDrop(e, d)}
                    className={[
                      view === "week" ? "h-64" : "h-36",
                      "p-2 border -m-[0.5px] text-left overflow-hidden",
                      "hover:bg-gray-50 transition",
                      faded ? "bg-gray-50/40 text-gray-400" : "bg-white",
                      today ? "ring-2 ring-primary/60 z-[1]" : ""
                    ].join(" ")}
                    data-testid={`day-cell-${k}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <button 
                        className="text-xs font-medium" 
                        onClick={()=>setOpenDay(d)}
                        data-testid={`day-number-${k}`}
                      >
                        {format(d, "d")}
                      </button>
                      {!!list.length && (
                        <Badge className="text-[10px] py-0 px-1.5" data-testid={`day-badge-${k}`}>
                          {list.length}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {list.slice(0, view === "week" ? 8 : 3).map((j) => (
                        <div
                          key={j.id}
                          draggable
                          onDragStart={(e)=>onDragStart(e, j)}
                          className={[
                            "text-[11px] px-1.5 py-0.5 rounded line-clamp-1 cursor-move",
                            statusTone(j.status)
                          ].join(" ")}
                          onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${j.id}`); }}
                          title={`${j.title}${j.customer_name ? " — " + j.customer_name : ""}`}
                          data-testid={`job-pill-${j.id}`}
                        >
                          {j.title}{j.customer_name ? ` — ${j.customer_name}` : ""}
                        </div>
                      ))}
                      {list.length > (view === "week" ? 8 : 3) && (
                        <button 
                          className="text-[10px] text-gray-500" 
                          onClick={()=>setOpenDay(d)}
                          data-testid={`more-jobs-${k}`}
                        >
                          +{list.length - (view === "week" ? 8 : 3)} more…
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Day modal */}
      <Dialog open={!!openDay} onOpenChange={(v) => setOpenDay(v ? openDay : null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="day-modal-title">
              {openDay ? format(openDay, "EEEE, d MMM yyyy") : "Day"}
            </DialogTitle>
          </DialogHeader>
          {dayJobs.length === 0 ? (
            <div className="text-sm text-gray-500" data-testid="no-jobs-message">
              No jobs scheduled.
            </div>
          ) : (
            <div className="space-y-2">
              {dayJobs.map((j) => (
                <Link key={j.id} href={`/jobs/${j.id}`}>
                  <a 
                    className="block border rounded p-2 hover:bg-gray-50"
                    data-testid={`day-job-${j.id}`}
                  >
                    <div className="text-sm font-medium">{j.title}</div>
                    <div className="text-xs text-gray-600">
                      {j.customer_name || "—"} • {utcIsoToLocalString(j.scheduled_at, { timeStyle: "short" })}
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}