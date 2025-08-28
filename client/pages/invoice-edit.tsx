import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { invoicesApi, customersApi, meApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { QuoteInvoicePage } from "@/components/quotes/QuoteInvoicePage";

export default function InvoiceEdit() {
  const [isNewMatch] = useRoute("/invoices/new");
  const [isEditMatch, params] = useRoute("/invoices/:id/edit");
  const [, nav] = useLocation();
  const id = params?.id;

  const [saving, setSaving] = useState(false);

  // Fetch customers and item presets
  const { data: customers = [] } = useQuery({
    queryKey: ["/api/customers"],
  });

  const { data: presets = [] } = useQuery({
    queryKey: ["/api/item-presets"],
  });

  const { data: meData } = useQuery({ queryKey: ["/api/me"] });

  // Fetch invoice data if editing
  const { data: invoice, isLoading: invoiceLoading } = useQuery({
    queryKey: ["/api/invoices", id],
    enabled: !!id,
  });

  const loading = invoiceLoading;

  // Transform invoice data for the new component
  const initial = invoice ? {
    customer: { id: (invoice as any).customer_id },
    title: (invoice as any).title,
    notes: (invoice as any).notes,
    items: ((invoice as any).lines || []).map((l: any) => ({
      id: crypto.randomUUID(),
      itemName: l.description || '',
      description: l.description || '',
      qty: Number(l.quantity || 1),
      price: Number(l.unit_amount || 0),
      discount: 0,
      tax: Number(l.tax_rate || 0) > 0 ? 'GST' : 'None',
    })),
  } : undefined;

  async function handleSave(payload: any) {
    setSaving(true);
    try {
      // Transform payload back to API format
      const lines = payload.items.map((item: any) => ({
        description: item.description || item.itemName,
        quantity: item.qty,
        unit_amount: item.price,
        tax_rate: item.tax === 'GST' ? 10 : 0,
      }));

      if (id) {
        await invoicesApi.update(id, {
          title: payload.title,
          customer_id: payload.customerId,
          notes: payload.notes,
          lines,
        });
        nav(`/invoices/${id}`);
      } else {
        const r = await invoicesApi.create({
          title: payload.title,
          customerId: payload.customerId,
          notes: payload.notes,
          lines,
        });
        nav(`/invoices/${r.id}`);
      }
    } catch (e: any) {
      console.error("Failed to save invoice:", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleSend(payload: any) {
    await handleSave(payload);
    // TODO: Add send functionality
  }

  function handlePreview(payload: any) {
    // Create a preview window with the invoice data
    const previewWindow = window.open('', 'preview', 'width=800,height=600,scrollbars=yes');
    if (!previewWindow) return;

    const customer = (customers as any[]).find((c: any) => c.id === payload.customerId) || {};
    const org = (meData as any)?.org || {};
    
    previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice Preview - ${payload.title}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .company-info h1 { color: #0ea5e9; margin: 0; }
            .invoice-info { text-align: right; }
            .customer-section { margin: 30px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8f9fa; font-weight: 600; }
            .amount { text-align: right; }
            .totals { margin-top: 30px; text-align: right; }
            .totals table { width: 300px; margin-left: auto; }
            .total-row { font-weight: bold; font-size: 1.1em; }
            .notes { margin-top: 30px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h1>${org.name || 'Your Company'}</h1>
              <p>${[org.street, org.suburb, org.state, org.postcode].filter(Boolean).join(', ') || 'Field Service Management'}</p>
              ${org.abn ? `<p>ABN: ${org.abn}</p>` : ''}
            </div>
            <div class="invoice-info">
              <h2>INVOICE</h2>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Invoice #:</strong> ${payload.header?.number || 'INV-001'}</p>
              ${payload.header?.dueDate ? `<p><strong>Due Date:</strong> ${new Date(payload.header.dueDate).toLocaleDateString()}</p>` : ''}
            </div>
          </div>
          
          <div class="customer-section">
            <h3>Bill To:</h3>
            <p><strong>${customer.name || 'Customer Name'}</strong></p>
            ${customer.email ? `<p>${customer.email}</p>` : ''}
            ${customer.phone ? `<p>${customer.phone}</p>` : ''}
            ${customer.address ? `<p>${customer.address}</p>` : ''}
            ${customer.street || customer.suburb || customer.state || customer.postcode ? `<p>${[customer.street, customer.suburb, customer.state, customer.postcode].filter(Boolean).join(', ')}</p>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Tax</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${payload.items.map((item: any) => {
                const amount = item.qty * item.price;
                const taxAmount = item.tax === 'GST' ? amount * 0.1 : 0;
                const total = amount + taxAmount;
                return `
                  <tr>
                    <td>${item.description || item.itemName}</td>
                    <td>${item.qty}</td>
                    <td>$${item.price.toFixed(2)}</td>
                    <td>${item.tax}</td>
                    <td class="amount">$${total.toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr><td>Subtotal:</td><td class="amount">$${payload.totals.subtotal.toFixed(2)}</td></tr>
              <tr><td>GST:</td><td class="amount">$${payload.totals.gst.toFixed(2)}</td></tr>
              <tr class="total-row"><td>Total:</td><td class="amount">$${payload.totals.total.toFixed(2)}</td></tr>
            </table>
          </div>

          ${payload.notes ? `
            <div class="notes">
              <h3>Notes:</h3>
              <p>${payload.notes}</p>
            </div>
          ` : ''}

          <div style="position: fixed; top: 10px; right: 10px; z-index: 1000;">
            <button onclick="window.close()" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px;">Close</button>
            <button onclick="window.print()" style="background: #0ea5e9; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; margin-left: 8px;">Print</button>
          </div>
        </body>
      </html>
    `);
    previewWindow.document.close();
  }

  return (
    <QuoteInvoicePage
      mode="invoice"
      initial={initial}
      customers={customers as any}
      presets={presets as any}
      onSave={handleSave}
      onSend={handleSend}
      onPreview={handlePreview}
      loading={loading}
      saving={saving}
    />
  );
}