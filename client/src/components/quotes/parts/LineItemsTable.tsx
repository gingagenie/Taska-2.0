import React from 'react';
import { PresetSelect } from './PresetSelect';

interface LineItem {
  id: string;
  itemName: string;
  description: string;
  qty: number;
  price: number;
  discount: number;
  tax: string;
}

interface Preset {
  id: string;
  name: string;
  description?: string;
  unit_amount: number;
  tax_rate?: number;
}

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  onSetItem: (id: string, key: keyof LineItem, value: any) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onApplyPreset: (id: string, presetId: string) => void;
  presets: Preset[];
  taxMode: string;
}

export function LineItemsTable({ 
  items, 
  onChange, 
  onSetItem, 
  onAddRow, 
  onRemoveRow, 
  onApplyPreset, 
  presets, 
  taxMode 
}: LineItemsTableProps) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b text-sm font-medium text-neutral-600 grid grid-cols-12 gap-3">
        <div className="col-span-4">Item</div>
        <div className="col-span-2 text-right">Qty.</div>
        <div className="col-span-2 text-right">Price</div>
        <div className="col-span-1 text-right">Disc. %</div>
        <div className="col-span-1">Tax</div>
        <div className="col-span-2 text-right">Amount</div>
      </div>

      {items.map((it) => {
        const GST = 0.10;
        const base = Number(it.qty || 0) * Number(it.price || 0) * (1 - Number(it.discount || 0) / 100);
        const gst = it.tax === 'GST' ? (taxMode === 'inclusive' ? (base / (1 + GST)) * GST : base * GST) : 0;
        const total = taxMode === 'inclusive' ? base : base + gst;
        
        return (
          <div key={it.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-start border-b last:border-b-0">
            <div className="col-span-4">
              <div className="flex gap-2 items-start">
                <input 
                  value={it.itemName} 
                  onChange={(e) => onSetItem(it.id, 'itemName', e.target.value)} 
                  placeholder="Item name" 
                  className="flex-1 border rounded-lg px-3 py-2 text-sm min-w-0" 
                />
                <div className="relative z-10 flex-shrink-0">
                  <PresetSelect presets={presets} onSelect={(pid: string) => onApplyPreset(it.id, pid)} />
                </div>
              </div>
            </div>
            <div className="col-span-2 text-right">
              <input 
                type="number" 
                step="1" 
                min="1"
                value={it.qty} 
                onChange={(e) => onSetItem(it.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))} 
                className="w-full border rounded-lg px-3 py-2 text-right text-sm" 
                placeholder="1"
              />
            </div>
            <div className="col-span-2 text-right">
              <input 
                type="number" 
                step="1" 
                min="0"
                value={it.price} 
                onChange={(e) => onSetItem(it.id, 'price', Math.max(0, parseInt(e.target.value) || 0))} 
                className="w-full border rounded-lg px-3 py-2 text-right text-sm" 
                placeholder="0"
              />
            </div>
            <div className="col-span-1 text-right">
              <input 
                type="number" 
                step="0.01" 
                value={it.discount} 
                onChange={(e) => onSetItem(it.id, 'discount', Number(e.target.value))} 
                className="w-full border rounded-lg px-3 py-2 text-right text-sm" 
                placeholder="0"
              />
            </div>
            <div className="col-span-1">
              <select 
                value={it.tax} 
                onChange={(e) => onSetItem(it.id, 'tax', e.target.value)} 
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="GST">GST</option>
                <option value="None">None</option>
              </select>
            </div>
            <div className="col-span-2 text-right font-medium pt-2 text-sm">{currency(total)}</div>
            <div className="col-span-12 flex items-center justify-between pt-2">
              <button 
                className="text-sm text-neutral-600 hover:text-neutral-900" 
                onClick={onAddRow}
              >
                + Add row
              </button>
              {items.length > 1 && (
                <button 
                  className="text-sm text-red-600 hover:text-red-800" 
                  onClick={() => onRemoveRow(it.id)}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function currency(n: number): string {
  const v = isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, { style: 'currency', currency: 'AUD' });
}