import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { jobsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { utcRangeForLocalWeek, groupJobsByLocalDay, parseUtcIso } from "@/lib/mobileDates";
import { utcIsoToLocalString } from "@/lib/time";

// Status color mapping
const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  "in-progress": "bg-yellow-100 text-yellow-800 border-yellow-200", 
  completed: "bg-green-100 text-green-800 border-green-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  new: "bg-gray-100 text-gray-800 border-gray-200",
  pending: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function ScheduleWeekMobile() {
  const [, navigate] = useLocation();
  const [currentWeek] = useState(() => new Date('2025-08-25'));
  
  // Get Melbourne week range (Monday to Sunday)
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  
  // Fetch ALL jobs - simple and reliable
  const { data: allJobs = [], isLoading, error } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: () => jobsApi.getAll(),
  });

  // Filter jobs to current week using timezone-aware UTC ranges
  const weekJobs = useMemo(() => {
    if (!allJobs.length) return [];
    
    const { fromUtc, toUtc } = utcRangeForLocalWeek(weekStart);
    
    return allJobs.filter((job: any) => {
      if (!job.scheduled_at) return false;
      
      try {
        const jobUtc = parseUtcIso(job.scheduled_at);
        return jobUtc >= fromUtc && jobUtc <= toUtc;
      } catch {
        return false;
      }
    });
  }, [allJobs, weekStart]);

  // Group jobs by Melbourne local days
  const jobsByLocalDay = useMemo(() => {
    return groupJobsByLocalDay(weekJobs);
  }, [weekJobs]);

  // Create complete week structure with empty days
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dayKey = format(day, "yyyy-MM-dd");
      days.push({
        date: day,
        dayKey,
        jobs: jobsByLocalDay[dayKey] || []
      });
    }
    return days;
  }, [weekStart, jobsByLocalDay]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="text-center py-8">
          <p className="text-red-600 mb-2">Failed to load schedule</p>
          <p className="text-gray-600 text-sm">{error.toString()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">This Week</h1>
          <div className="text-sm text-gray-600">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
          </div>
        </div>
      </div>

      {/* Debug info - temporary */}
      <div className="px-4 py-2 text-xs text-gray-500 bg-blue-50 border-b">
        Total jobs: {allJobs.length} | Week jobs: {weekJobs.length} | 
        Days with jobs: {Object.keys(jobsByLocalDay).length}
      </div>

      {/* Week Days */}
      <div className="px-4 pb-4">
        {weekDays.map(({ date, dayKey, jobs: dayJobs }) => {
          const dayName = format(date, "EEEE");
          const dayNumber = format(date, "d");
          const isToday = format(new Date(), "yyyy-MM-dd") === dayKey;
          
          return (
            <div key={dayKey} className="mb-6">
              {/* Day Header */}
              <div className={`sticky top-[80px] bg-white border rounded-lg p-3 mb-3 z-[5] ${
                isToday ? "bg-blue-50 border-blue-200" : "border-gray-200"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      isToday ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                    }`}>
                      {dayNumber}
                    </div>
                    <div>
                      <div className={`font-semibold ${isToday ? "text-blue-900" : "text-gray-900"}`}>
                        {dayName}
                      </div>
                      <div className="text-xs text-gray-600">
                        {format(date, "MMM d")} ({dayKey})
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {dayJobs.length} {dayJobs.length === 1 ? "job" : "jobs"}
                  </Badge>
                </div>
              </div>

              {/* Jobs for this day */}
              <div className="space-y-3">
                {dayJobs.length === 0 ? (
                  <Card className="border-dashed border-gray-300">
                    <CardContent className="p-4 text-center text-gray-500 text-sm">
                      No jobs scheduled
                    </CardContent>
                  </Card>
                ) : (
                  dayJobs.map((job: any) => (
                    <Card 
                      key={job.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      data-testid={`card-job-${job.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 mb-1">
                              {job.title || "Untitled Job"}
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              {job.customer_name}
                            </div>
                          </div>
                          <Badge 
                            className={`text-xs ${statusColors[job.status] || "bg-gray-100 text-gray-800"}`}
                          >
                            {job.status}
                            {job.status === 'confirmed' && ' ✓'}
                          </Badge>
                        </div>

                        {/* Time */}
                        {job.scheduled_at && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              {utcIsoToLocalString(job.scheduled_at, { timeStyle: "short" })}
                            </span>
                          </div>
                        )}

                        {/* Description */}
                        {job.description && (
                          <div className="text-sm text-gray-600 line-clamp-2">
                            {job.description}
                          </div>
                        )}

                        {/* Debug info for each job - temporary */}
                        <div className="text-[10px] mt-1 opacity-60 bg-gray-100 p-1 rounded">
                          UTC: {job.scheduled_at}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}