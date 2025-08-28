import React, { useMemo, useState } from 'react';
import { LineItemsTable } from './parts/LineItemsTable';
import { TotalsCard } from './parts/TotalsCard';

interface Customer {
  id: string;
  name: string;
  email?: string;
}

interface Preset {
  id: string;
  name: string;
  description?: string;
  unit_amount: number;
  tax_rate?: number;
}

interface LineItem {
  id: string;
  itemName: string;
  description: string;
  qty: number;
  price: number;
  discount: number;
  tax: string;
}

interface Initial {
  customer?: { id: string };
  issueDate?: string;
  dueDate?: string;
  number?: string;
  reference?: string;
  taxMode?: string;
  items?: LineItem[];
  title?: string;
  notes?: string;
}

interface Totals {
  subtotal: number;
  gst: number;
  total: number;
}

interface Payload {
  mode: string;
  customerId: string;
  header: {
    issueDate: string;
    dueDate: string;
    number: string;
    reference: string;
    taxMode: string;
  };
  items: LineItem[];
  totals: Totals;
  title: string;
  notes: string;
}

interface QuoteInvoicePageProps {
  mode?: 'quote' | 'invoice';
  initial?: Initial;
  customers?: Customer[];
  presets?: Preset[];
  onSave?: (payload: Payload) => Promise<void>;
  onSend?: (payload: Payload) => Promise<void>;
  onPreview?: (payload: Payload) => void;
  loading?: boolean;
  saving?: boolean;
}

export function QuoteInvoicePage({
  mode = 'invoice',
  initial,
  customers = [],
  presets = [],
  onSave,
  onSend,
  onPreview,
  loading = false,
  saving = false,
}: QuoteInvoicePageProps) {
  const [customerId, setCustomerId] = useState(initial?.customer?.id || '');
  const [issueDate, setIssueDate] = useState(initial?.issueDate || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(initial?.dueDate || '');
  const [docNo, setDocNo] = useState(initial?.number || '');
  const [reference, setReference] = useState(initial?.reference || '');
  const [taxMode, setTaxMode] = useState(initial?.taxMode || 'exclusive');
  const [title, setTitle] = useState(initial?.title || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [items, setItems] = useState<LineItem[]>(
    initial?.items?.length ? initial.items : [
      { id: crypto.randomUUID(), itemName: '', description: '', qty: 1, price: 0, discount: 0, tax: 'GST' },
    ]
  );

  const customer = useMemo(() => customers.find(c => c.id === customerId) || null, [customerId, customers]);

  function setItem(id: string, key: keyof LineItem, value: any) {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, [key]: value } : it)));
  }

  function addRow() {
    setItems(prev => [...prev, { id: crypto.randomUUID(), itemName: '', description: '', qty: 1, price: 0, discount: 0, tax: 'GST' }]);
  }

  function removeRow(id: string) {
    setItems(prev => (prev.length > 1 ? prev.filter(it => it.id !== id) : prev));
  }

  function applyPreset(id: string, presetId: string) {
    const p = presets.find(p => p.id === presetId);
    if (!p) return;
    setItems(prev => prev.map(it => (it.id === id ? {
      ...it,
      itemName: p.name,
      description: p.description || p.name,
      price: Number(p.unit_amount || 0),
      tax: (p.tax_rate || 0) > 0 ? 'GST' : 'None',
    } : it)));
  }

  const totals = useMemo(() => calcTotals(items, taxMode), [items, taxMode]);

  const payload = useMemo(() => ({
    mode,
    customerId,
    header: { issueDate, dueDate, number: docNo, reference, taxMode },
    items,
    totals,
    title,
    notes,
  }), [mode, customerId, issueDate, dueDate, docNo, reference, taxMode, items, totals, title, notes]);

  async function handleSave() { 
    await onSave?.(payload); 
  }
  
  async function handleSend() { 
    await onSend?.(payload); 
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-yellow-400 grid place-items-center font-black text-neutral-900">T</div>
            <div className="leading-tight">
              <div className="font-semibold text-neutral-800">Taska</div>
              <div className="text-xs text-neutral-500">{mode === 'quote' ? 'Quote' : 'Invoice'} composer</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              className="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50" 
              onClick={() => onPreview?.(payload)}
            >
              Preview
            </button>
            <button 
              className="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button 
              className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50 hover:bg-neutral-800" 
              disabled={!customerId || saving} 
              onClick={handleSend}
            >
              {mode === 'quote' ? 'Send quote' : 'Send invoice'}
            </button>
          </div>
        </div>
      </div>

      {/* Header form */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-4 bg-white p-4 rounded-2xl shadow-sm border">
          <div className="col-span-12 sm:col-span-6">
            <label className="text-xs font-medium text-neutral-600">Title</label>
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder={`${mode === 'quote' ? 'Quote' : 'Invoice'} title`}
              className="mt-1 w-full border rounded-lg px-3 py-2" 
            />
          </div>
          <div className="col-span-12 sm:col-span-6">
            <label className="text-xs font-medium text-neutral-600">Customer</label>
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-span-6 sm:col-span-3">
            <label className="text-xs font-medium text-neutral-600">Issue date</label>
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
          </div>
          <div className="col-span-6 sm:col-span-3">
            <label className="text-xs font-medium text-neutral-600">{mode === 'quote' ? 'Valid until' : 'Due date'}</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
          </div>
          <div className="col-span-6 sm:col-span-3">
            <label className="text-xs font-medium text-neutral-600">{mode === 'quote' ? 'Quote' : 'Invoice'} #</label>
            <input value={docNo} onChange={e => setDocNo(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Auto-generated" />
          </div>
          <div className="col-span-6 sm:col-span-3">
            <label className="text-xs font-medium text-neutral-600">Reference</label>
            <input value={reference} onChange={e => setReference(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Job reference" />
          </div>
        </div>

        {/* Items + Totals */}
        <div className="mt-6 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7">
            <LineItemsTable
              items={items}
              onChange={setItems}
              onSetItem={setItem}
              onAddRow={addRow}
              onRemoveRow={removeRow}
              onApplyPreset={applyPreset}
              presets={presets}
              taxMode={taxMode}
            />
            <div className="bg-white rounded-2xl border shadow-sm p-4 mt-4">
              <div className="text-sm font-medium text-neutral-700">Notes / Terms</div>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="mt-2 w-full border rounded-xl px-3 py-2 min-h-[96px]" 
                placeholder="e.g. Payment due within 7 days. Parts remain property of company until paid in full."
              />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5">
            <TotalsCard 
              totals={totals} 
              onSend={handleSend} 
              canSend={!!customerId && !saving} 
              mode={mode} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function calcTotals(items: LineItem[], taxMode: string): Totals {
  const GST = 0.10;
  const rows = items.map(it => {
    const base = Number(it.qty || 0) * Number(it.price || 0) * (1 - Number(it.discount || 0) / 100);
    if (it.tax === 'GST') {
      if (taxMode === 'inclusive') {
        const ex = base / (1 + GST);
        return { base: ex, gst: ex * GST, total: base };
      }
      return { base, gst: base * GST, total: base * (1 + GST) };
    }
    return { base, gst: 0, total: base };
  });
  const subtotal = rows.reduce((a, r) => a + r.base, 0);
  const gst = rows.reduce((a, r) => a + r.gst, 0);
  const total = rows.reduce((a, r) => a + r.total, 0);
  return { subtotal, gst, total };
}