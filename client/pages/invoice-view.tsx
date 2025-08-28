import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { invoicesApi } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ExternalLink } from "lucide-react";

export default function InvoiceView() {
  const [match, params] = useRoute("/invoices/:id");
  const [, nav] = useLocation();
  const id = params?.id;

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creatingXero, setCreatingXero] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const i = await invoicesApi.get(id);
        setInvoice(i);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleMarkPaid() {
    if (!id) return;
    try {
      await invoicesApi.markPaid(id);
      const i = await invoicesApi.get(id);
      setInvoice(i);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function handleCreateInXero() {
    if (!id) return;
    setCreatingXero(true);
    try {
      const response = await apiRequest(`/api/invoices/${id}/xero`, { method: 'POST' });
      
      toast({
        title: "Invoice created in Xero",
        description: `Invoice #${response.xeroNumber} created successfully`,
      });
      
      // Refresh invoice data to show Xero ID
      const updatedInvoice = await invoicesApi.get(id);
      setInvoice(updatedInvoice);
    } catch (e: any) {
      toast({
        title: "Failed to create in Xero",
        description: e.message || "Unable to create invoice in Xero",
        variant: "destructive",
      });
    } finally {
      setCreatingXero(false);
    }
  }

  if (loading) return <div className="page">Loading…</div>;
  if (!invoice) return <div className="page">Invoice not found</div>;

  return (
    <div className="page space-y-6">
      <div className="header-row">
        <h1 className="text-2xl font-bold">{invoice.title}</h1>
        <div className="header-actions">
          <Link href={`/invoices/${id}/edit`}><a><Button variant="outline">Edit</Button></a></Link>
          {invoice.status !== 'paid' && invoice.status !== 'void' && (
            <Button onClick={handleMarkPaid}>Mark Paid</Button>
          )}
          {!invoice.xero_id && (
            <Button 
              onClick={handleCreateInXero}
              disabled={creatingXero}
              variant="outline"
              data-testid="button-create-xero"
            >
              {creatingXero ? "Creating..." : "Create in Xero"}
            </Button>
          )}
          {invoice.xero_id && (
            <Button 
              variant="outline"
              onClick={() => window.open('https://my.xero.com', '_blank')}
              data-testid="button-view-xero"
            >
              View in Xero <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {err && <div className="text-red-600">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="card-pad space-y-4">
              <div><strong>Customer:</strong> {invoice.customer_name}</div>
              <div><strong>Status:</strong> <span className="capitalize">{invoice.status}</span></div>
              {invoice.notes && <div><strong>Notes:</strong> {invoice.notes}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
            <CardContent className="card-pad">
              <div className="table-wrap">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(invoice.items || []).map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">{item.description}</td>
                        <td className="px-3 py-2 text-right">{Number(item.quantity).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">${Number(item.unit_price).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">
                          ${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {(!invoice.items || invoice.items.length === 0) && (
                      <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">No items</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="card-pad">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${Number(invoice.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium text-lg">
                  <span>Total:</span>
                  <span>${Number(invoice.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}