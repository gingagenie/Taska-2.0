import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, User, Clock, ArrowLeft, FileText } from "lucide-react";
import { utcIsoToLocalString } from "@/lib/time";
import { useToast } from "@/hooks/use-toast";

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

interface JobCharge {
  id: string;
  kind: 'labour' | 'material' | 'equipment' | 'other';
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export default function CompletedJobView() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [job, setJob] = useState<CompletedJob | null>(null);
  const [charges, setCharges] = useState<JobCharge[]>([]);
  const [hours, setHours] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convertingToInvoice, setConvertingToInvoice] = useState(false);

  useEffect(() => {
    loadCompletedJob();
  }, [id]);

  async function loadCompletedJob() {
    try {
      setLoading(true);
      const response = await fetch(`/api/jobs/completed/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load completed job');
      }
      const jobData = await response.json();
      setJob(jobData);
      
      // Load charges, hours, and parts for the completed job
      try {
        const [chargesResponse, hoursResponse, partsResponse] = await Promise.all([
          fetch(`/api/jobs/completed/${jobData.id}/charges`),
          fetch(`/api/jobs/completed/${jobData.id}/hours`),
          fetch(`/api/jobs/completed/${jobData.id}/parts`)
        ]);
        
        if (chargesResponse.ok) {
          const chargesData = await chargesResponse.json();
          setCharges(chargesData);
        }
        
        if (hoursResponse.ok) {
          const hoursData = await hoursResponse.json();
          setHours(hoursData);
        }
        
        if (partsResponse.ok) {
          const partsData = await partsResponse.json();
          setParts(partsData);
        }
      } catch (e) {
        console.error('Failed to load completed job data:', e);
        // Don't fail the whole page if these fail to load
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load completed job');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6 min-h-screen bg-gray-100">
        <div className="text-center">Loading completed job...</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-4 sm:p-6 space-y-6 min-h-screen bg-gray-100">
        <div className="text-center text-red-600">
          Error: {error || 'Job not found'}
        </div>
        <div className="text-center">
          <Link href="/completed-jobs">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Completed Jobs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  async function handleConvertToInvoice() {
    if (!job) return;
    
    try {
      setConvertingToInvoice(true);
      const response = await fetch(`/api/jobs/completed/${job.id}/convert-to-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to convert to invoice');
      }

      const result = await response.json();
      
      toast({
        title: "Invoice Created",
        description: result.message || "Invoice created successfully",
      });

      // Navigate to the created invoice (assuming you have an invoices page)
      navigate(`/invoices/${result.invoiceId}`);
      
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || 'Failed to convert to invoice',
        variant: "destructive",
      });
    } finally {
      setConvertingToInvoice(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 min-h-screen bg-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/completed-jobs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="w-9 h-9 rounded-xl bg-green-500 grid place-items-center">
            <CheckCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
            <p className="text-sm text-gray-500">Completed Job Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleConvertToInvoice}
            disabled={convertingToInvoice || !job.customer_id}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-convert-to-invoice"
          >
            <FileText className="h-4 w-4 mr-2" />
            {convertingToInvoice ? "Converting..." : "Convert to Invoice"}
          </Button>
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-4 w-4 mr-2" />
            Completed
          </Badge>
        </div>
      </div>

      {/* Job Details Card */}
      <Card className="bg-white border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="text-xl">Job Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer */}
          {job.customer_name && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Customer</h3>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{job.customer_name}</span>
              </div>
            </div>
          )}

          {/* Description */}
          {job.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                {job.description}
              </p>
            </div>
          )}

          {/* Work Notes */}
          {job.notes && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Work Notes</h3>
              <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                {job.notes}
              </p>
            </div>
          )}

          {/* Job Charges */}
          {charges.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Job Charges</h3>
              <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                {charges.map((charge) => (
                  <div key={charge.id} className="flex justify-between items-center bg-white p-3 rounded border">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{charge.description}</div>
                      <div className="text-sm text-gray-500 capitalize">
                        {charge.kind} • Qty: {charge.quantity} @ ${charge.unit_price.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">${charge.total.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 flex justify-between items-center font-semibold text-lg">
                  <span>Total:</span>
                  <span>${charges.reduce((sum, charge) => sum + charge.total, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Hours Worked */}
          {hours.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Hours Worked</h3>
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                {hours.map((hour: any) => (
                  <div key={hour.id} className="flex justify-between items-center bg-white p-3 rounded border">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{hour.hours} hours</div>
                      {hour.description && (
                        <div className="text-sm text-gray-500">{hour.description}</div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(hour.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 flex justify-between items-center font-semibold text-lg">
                  <span>Total Hours:</span>
                  <span>{hours.reduce((sum: number, hour: any) => sum + parseFloat(hour.hours || 0), 0)} hours</span>
                </div>
              </div>
            </div>
          )}

          {/* Parts Used */}
          {parts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Parts Used</h3>
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                {parts.map((part: any) => (
                  <div key={part.id} className="flex justify-between items-center bg-white p-3 rounded border">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{part.part_name}</div>
                      <div className="text-sm text-gray-500">Quantity: {part.quantity}</div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(part.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 flex justify-between items-center font-semibold text-lg">
                  <span>Total Parts:</span>
                  <span>{parts.reduce((sum: number, part: any) => sum + parseInt(part.quantity || 0), 0)} items</span>
                </div>
              </div>
            </div>
          )}

          {/* Timing Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {job.scheduled_at && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Originally Scheduled</h3>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">
                    {utcIsoToLocalString(job.scheduled_at, { 
                      dateStyle: "full", 
                      timeStyle: "short" 
                    })}
                  </span>
                </div>
              </div>
            )}
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Completed</h3>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="font-medium">
                  {utcIsoToLocalString(job.completed_at, { 
                    dateStyle: "full", 
                    timeStyle: "short" 
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Job ID Reference */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Original Job ID</h3>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
              {job.original_job_id}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}