import { useEffect, useState } from "react";
import { itemPresetsApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function SettingsItems() {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("0");
  const [tax, setTax] = useState("10");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() { 
    setLoading(true);
    try {
      const data = await itemPresetsApi.search("");
      setList(data || []);
    } catch (error) {
      console.error("Failed to load presets:", error);
    }
    setLoading(false);
  }
  
  useEffect(()=>{ load(); }, []);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await itemPresetsApi.create({
        name: name.trim(),
        unit_amount: Number(unit || 0),
        tax_rate: Number(tax || 0),
      });
      setName(""); setUnit("0"); setTax("10");
      await load();
    } catch (error) {
      console.error("Failed to create preset:", error);
    }
    setSaving(false);
  }

  return (
    <div className="page space-y-6">
      <div className="header-row">
        <h1 className="text-2xl font-bold">Item Presets</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Preset</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-3 max-w-3xl">
            <Input 
              placeholder="Name (e.g., Labour)" 
              value={name} 
              onChange={e=>setName(e.target.value)}
              data-testid="input-preset-name"
            />
            <Input 
              placeholder="Unit $" 
              inputMode="decimal" 
              value={unit} 
              onChange={e=>setUnit(e.target.value)}
              data-testid="input-preset-unit"
            />
            <Input 
              placeholder="Tax %" 
              inputMode="decimal" 
              value={tax} 
              onChange={e=>setTax(e.target.value)}
              data-testid="input-preset-tax"
            />
            <Button 
              onClick={add} 
              disabled={saving || !name.trim()}
              data-testid="button-add-preset"
            >
              {saving ? "Adding..." : "Add / Update"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Presets</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading presets...</div>
          ) : (
            <div className="max-w-3xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-right font-medium">Unit Price</th>
                    <th className="px-3 py-2 text-right font-medium">Tax %</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                        No presets yet. Add some common items above to speed up billing.
                      </td>
                    </tr>
                  ) : (
                    list.map((p:any)=>(
                      <tr key={p.id} className="border-b dark:border-gray-700" data-testid={`row-preset-${p.name.toLowerCase().replace(/\s+/g, '-')}`}>
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2 text-right font-mono">${Number(p.unit_amount).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono">{Number(p.tax_rate).toFixed(2)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}