import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = { id?: string; description: string; quantity: number; unit_price: number };

export function LineItemsEditor({
  items, onAdd, onUpdate, onDelete
}: {
  items: Item[];
  onAdd: (draft: Omit<Item,"id">) => Promise<void> | void;
  onUpdate: (id: string, patch: Partial<Item>) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Omit<Item,"id">>({ description: "", quantity: 1, unit_price: 0 });

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0),
    [items]
  );

  return (
    <div className="space-y-3">
      <div className="table-wrap">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit</th>
              <th className="px-3 py-2 text-right">Line</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((it) => (
              <tr key={it.id}>
                <td className="px-3 py-2">{it.description}</td>
                <td className="px-3 py-2 text-right">{Number(it.quantity).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">${Number(it.unit_price).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">
                  ${(Number(it.quantity)*Number(it.unit_price)).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" onClick={() => onDelete(it.id!)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <div className="form-grid">
        <div className="col-span-2">
          <Input placeholder="Description"
                 value={draft.description}
                 onChange={(e)=>setDraft({...draft, description:e.target.value})}/>
        </div>
        <Input type="number" step="0.01" placeholder="Qty"
               value={draft.quantity}
               onChange={(e)=>setDraft({...draft, quantity:Number(e.target.value)})}/>
        <Input type="number" step="0.01" placeholder="Unit Price"
               value={draft.unit_price}
               onChange={(e)=>setDraft({...draft, unit_price:Number(e.target.value)})}/>
        <Button onClick={async()=>{ if(!draft.description) return; await onAdd(draft); setDraft({description:"",quantity:1,unit_price:0}); }}>
          Add item
        </Button>
      </div>

      <div className="text-right text-sm">
        <div className="font-medium">Subtotal: ${subtotal.toFixed(2)}</div>
      </div>
    </div>
  );
}