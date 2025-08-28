import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, User, Clock, ArrowRight } from "lucide-react";
import { utcIsoToLocalString } from "@/lib/time";

interface CompletedJob {
  id: string;
  original_job_id: string;
  customer_id: string | null;
  customer_name: string | null;
  title: string;
  description: string | null;
  notes: string | null;
  scheduled_at: string | null;
  completed_at: string;
  completed_by: string | null;
  original_created_by: string | null;
  original_created_at: string | null;
}

export default function CompletedJobsPage() {
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    loadCompletedJobs();
  }, []);

  async function loadCompletedJobs() {
    try {
      setLoading(true);
      const response = await fetch('/api/jobs/completed');
      if (!response.ok) {
        throw new Error('Failed to load completed jobs');
      }
      const jobs = await response.json();
      setCompletedJobs(jobs);
    } catch (e: any) {
      setError(e.message || 'Failed to load completed jobs');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6 min-h-screen bg-gray-100">
        <div className="text-center">Loading completed jobs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 space-y-6 min-h-screen bg-gray-100">
        <div className="text-center text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 min-h-screen bg-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500 grid place-items-center">
            <CheckCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Completed Jobs</h1>
            <p className="text-sm text-gray-500">{completedJobs.length} jobs completed</p>
          </div>
        </div>
        <Link href="/schedule">
          <Button variant="outline">
            Back to Schedule
          </Button>
        </Link>
      </div>

      {completedJobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No completed jobs yet</h3>
            <p className="text-gray-500 text-center max-w-md">
              When you complete jobs from your schedule, they'll appear here for easy reference.
            </p>
            <Link href="/schedule">
              <Button className="mt-4">View Schedule</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {completedJobs.map((job) => (
            <Card 
              key={job.id} 
              className="bg-white border-l-4 border-l-green-500 hover:shadow-md hover:bg-gray-50 transition-all cursor-pointer group"
              onClick={() => navigate(`/completed-jobs/${job.id}`)}
              data-testid={`card-completed-job-${job.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="font-semibold text-lg group-hover:text-green-600 transition-colors">
                        {job.title || "Untitled Job"}
                      </div>
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {job.customer_name && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{job.customer_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          Completed {utcIsoToLocalString(job.completed_at, { 
                            dateStyle: "short", 
                            timeStyle: "short" 
                          })}
                        </span>
                      </div>
                    </div>

                    {job.description && (
                      <p className="text-gray-600 text-sm line-clamp-2">
                        {job.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-green-600 ml-4">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500 group-hover:text-green-600 transition-colors">
                    Click for details →
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}