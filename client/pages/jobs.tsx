import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobModal } from "@/components/modals/job-modal";
import { jobsApi } from "@/lib/api";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Edit, MoreHorizontal, Calendar, User, ArrowRight, CheckCircle } from "lucide-react";
import { utcIsoToLocalString } from "@/lib/time";

export default function Jobs() {
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: jobsApi.getAll, // expects id,title,status,scheduled_at,customer_id,customer_name
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "new":
        return "status-badge status-new";
      case "scheduled":
        return "status-badge status-scheduled";
      case "confirmed":
        return "status-badge status-confirmed";
      case "in_progress":
        return "status-badge status-in-progress";
      case "done":
      case "completed":
        return "status-badge status-completed";
      case "cancelled":
        return "status-badge status-cancelled";
      default:
        return "status-badge status-new";
    }
  };

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (jobs as any[]).filter((job) => {
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesSearch =
        !q ||
        job.title?.toLowerCase().includes(q) ||
        job.id?.toLowerCase().includes(q) ||
        job.customer_name?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [jobs, statusFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 animate-pulse">
          <div className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="header-row">
        <h1 className="text-2xl font-bold text-jobs">Jobs</h1>
        <div className="header-actions">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Search title, customer, ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-72"
            data-testid="input-search-jobs"
          />
          <Button 
            variant="outline"
            onClick={() => navigate('/completed-jobs')}
            data-testid="button-view-completed"
            className="border-green-200 text-green-700 hover:bg-green-50"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Completed Jobs
          </Button>
          <Button 
            onClick={() => setIsJobModalOpen(true)}
            data-testid="button-new-job"
            data-mobile-full="true"
            className="bg-jobs hover:bg-jobs/90 text-jobs-foreground"
          >
            New Job
          </Button>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <Card className="border-jobs bg-white">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              {jobs.length === 0 ? "No jobs found. Create your first job!" : "No jobs match your search or filter"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredJobs.map((job: any) => (
            <Card 
              key={job.id} 
              className="border-jobs bg-white hover:shadow-md hover:bg-gray-50 transition-all cursor-pointer group"
              onClick={() => navigate(`/jobs/${job.id}`)}
              data-testid={`card-job-${job.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="font-semibold text-lg group-hover:text-blue-600 transition-colors">
                        {job.title || "Untitled Job"}
                      </div>
                      <Badge className={getStatusBadgeClass(job.status)}>
                        {(job.status || "new").replace("_", " ")}
                      </Badge>
                    </div>
                    
                    {job.description && (
                      <div className="text-sm text-gray-600">
                        {job.description}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Customer</div>
                        <div className="font-medium flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {job.customer_name || "Not assigned"}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-gray-500">Scheduled</div>
                        <div className="font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {job.scheduled_at ? utcIsoToLocalString(job.scheduled_at, { dateStyle: "medium" }) : "Not scheduled"}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-gray-500">Time</div>
                        <div className="font-medium">
                          {job.scheduled_at ? utcIsoToLocalString(job.scheduled_at, { timeStyle: "short" }) : "—"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-blue-500 transition-colors pt-1">
                      <span>Click for details</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 opacity-70 hover:opacity-100"
                        data-testid={`button-actions-job-${job.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/jobs/${job.id}/edit`);
                      }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <JobModal 
        open={isJobModalOpen} 
        onOpenChange={setIsJobModalOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })}
      />
    </div>
  );
}
