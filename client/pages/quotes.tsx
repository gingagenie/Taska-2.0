import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { quotesApi } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { FileText, User, ArrowRight, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

export default function QuotesPage() {
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useQuery({ queryKey:["/api/quotes"], queryFn: quotesApi.getAll });
  const [q, setQ] = useState("");
  const [, navigate] = useLocation();

  const filtered = (list as any[]).filter(x => [x.title,x.customer_name,x.status].join(" ").toLowerCase().includes(q.toLowerCase()));

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 min-h-screen bg-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-financial">Quotes</h1>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Input 
            className="w-full sm:w-64" 
            placeholder="Search quotes…" 
            value={q} 
            onChange={(e)=>setQ(e.target.value)} 
          />
          <Link href="/quotes/new">
            <a>
              <Button 
                data-mobile-full="true" 
                className="bg-financial hover:bg-financial/90 text-financial-foreground w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" />
                New Quote
              </Button>
            </a>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading quotes…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <div className="text-xl font-semibold text-gray-600 mb-2">
            {q ? "No quotes found" : "No quotes yet"}
          </div>
          <div className="text-gray-500 mb-4">
            {q ? "Try adjusting your search terms" : "Create your first quote to get started"}
          </div>
          {!q && (
            <Link href="/quotes/new">
              <a>
                <Button className="bg-financial hover:bg-financial/90 text-financial-foreground">
                  <FileText className="h-4 w-4 mr-2" />
                  New Quote
                </Button>
              </a>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((quote: any) => (
            <Card 
              key={quote.id} 
              className="border-financial bg-white hover:shadow-md hover:bg-gray-50 transition-all cursor-pointer group"
              onClick={() => navigate(`/quotes/${quote.id}`)}
              data-testid={`card-quote-${quote.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="font-semibold text-lg group-hover:text-financial transition-colors">
                        {quote.title || "Untitled Quote"}
                      </div>
                      <Badge className={getStatusBadgeClass(quote.status)}>
                        {(quote.status || "draft").replace("_", " ")}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Customer</div>
                        <div className="font-medium flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {quote.customer_name || "No customer assigned"}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-gray-500">Total</div>
                        <div className="font-medium">
                          {quote.total_amount ? `$${Number(quote.total_amount).toFixed(2)}` : "—"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-financial transition-colors pt-1">
                      <span>Click for details</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                  
                  <div className="ml-4" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`menu-quote-${quote.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => {
                          navigate(`/quotes/${quote.id}/edit`);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}