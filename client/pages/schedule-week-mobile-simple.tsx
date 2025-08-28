import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { scheduleApi } from "@/lib/api";

export default function ScheduleWeekMobileSimple() {
  console.log("[Simple Mobile Schedule] Loading...");
  
  const { data: jobs = [], isLoading, error } = useQuery({
    queryKey: ["/api/schedule/range", { start: "2025-08-23", end: "2025-08-31", tz: "Australia/Melbourne" }],
    queryFn: () => scheduleApi.range({ 
      start: "2025-08-23", 
      end: "2025-08-31", 
      tz: "Australia/Melbourne"
    }),
  });

  console.log("[Simple Mobile Schedule] Data:", { jobs: jobs?.length, isLoading, error });

  if (error) {
    console.error("[Simple Mobile Schedule] Error:", error);
    return <div className="p-4 text-red-600">Error: {String(error)}</div>;
  }

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Simple Mobile Schedule</h1>
      <div className="text-sm text-gray-600 mb-4">
        Found {jobs.length} jobs
      </div>
      
      {jobs.map((job: any, i: number) => (
        <div key={job.id || i} className="border p-3 mb-2 rounded">
          <div className="font-medium">{job.title || "No Title"}</div>
          <div className="text-sm text-gray-600">{job.customer_name || "No Customer"}</div>
          <div className="text-xs text-gray-500">Raw time: {job.scheduled_at || "No Time"}</div>
        </div>
      ))}
    </div>
  );
}