import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { quotesApi, customersApi, meApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { QuoteInvoicePage } from "@/components/quotes/QuoteInvoicePage";

export default function QuoteEdit() {
  const [isNewMatch] = useRoute("/quotes/new");
  const [isEditMatch, params] = useRoute("/quotes/:id/edit");
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

  // Fetch quote data if editing
  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ["/api/quotes", id],
    enabled: !!id,
  });

  const loading = quoteLoading;

  // Transform quote data for the new component
  const initial = quote ? {
    customer: { id: (quote as any).customer_id },
    title: (quote as any).title,
    notes: (quote as any).notes,
    items: ((quote as any).lines || []).map((l: any) => ({
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
        await quotesApi.update(id, {
          title: payload.title,
          customer_id: payload.customerId,
          notes: payload.notes,
          lines,
        });
        nav(`/quotes/${id}`);
      } else {
        const r = await quotesApi.create({
          title: payload.title,
          customerId: payload.customerId,
          notes: payload.notes,
          lines,
        });
        nav(`/quotes/${r.id}`);
      }
    } catch (e: any) {
      console.error("Failed to save quote:", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleSend(payload: any) {
    await handleSave(payload);
    // TODO: Add send functionality
  }

  function handlePreview(payload: any) {
    // Create a preview window with the quote data
    const previewWindow = window.open('', 'preview', 'width=800,height=600,scrollbars=yes');
    if (!previewWindow) return;

    const customer = (customers as any[]).find((c: any) => c.id === payload.customerId) || {};
    const org = (meData as any)?.org || {};
    
    previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quote Preview - ${payload.title}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .company-info h1 { color: #0ea5e9; margin: 0; }
            .quote-info { text-align: right; }
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
            <div class="quote-info">
              <h2>QUOTE</h2>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Quote #:</strong> ${payload.header?.number || 'QUOTE-001'}</p>
            </div>
          </div>
          
          <div class="customer-section">
            <h3>Quote For:</h3>
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
      mode="quote"
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