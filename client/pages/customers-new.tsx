import { useState } from "react";
import { useLocation } from "wouter";
import { customersApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function CustomerNew() {
  const [, nav] = useLocation();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); 
    setErr(null);
    try {
      const result = await customersApi.create({
        name, 
        contact_name: contactName, 
        phone, 
        email, 
        street, 
        suburb, 
        state, 
        postcode
      });
      
      // Optimistic insert + refetch list
      const newCustomer = { 
        id: result.id, 
        name, 
        contact_name: contactName || null,
        email: email || null,
        phone: phone || null,
        street: street || null,
        suburb: suburb || null,
        state: state || null,
        postcode: postcode || null,
      };
      
      qc.setQueryData<any[]>(["/api/customers"], (prev = []) => {
        if (prev.some(c => c.id === newCustomer.id)) return prev;
        return [newCustomer, ...prev];
      });
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      nav("/customers");
    } catch (e: any) {
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[100svh] flex flex-col bg-gray-50">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>New Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {err && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{err}</div>}

              <div>
                <label className="block text-sm font-medium mb-1">Company Name *</label>
                <Input 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. ABC Manufacturing"
                  data-testid="input-company-name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Name</label>
                  <Input 
                    value={contactName} 
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Primary contact person"
                    data-testid="input-contact-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <Input 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                    data-testid="input-phone"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  data-testid="input-email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Street Address</label>
                <Input 
                  value={street} 
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="123 Main Street"
                  data-testid="input-street"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Suburb</label>
                  <Input 
                    value={suburb} 
                    onChange={(e) => setSuburb(e.target.value)}
                    placeholder="Suburb"
                    data-testid="input-suburb"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">State</label>
                  <Input 
                    value={state} 
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    data-testid="input-state"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Postcode</label>
                  <Input 
                    value={postcode} 
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="Postcode"
                    data-testid="input-postcode"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add bottom padding so content isn't hidden behind footer */}
          <div className="h-20" />
        </div>
      </div>

      {/* Sticky footer actions */}
      <div className="sticky bottom-0 inset-x-0 border-t bg-white/95 backdrop-blur px-4 py-3 sm:px-6 safe-area-inset-bottom">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={() => nav("/customers")}
            disabled={saving}
            data-testid="button-cancel-customer"
          >
            Cancel
          </Button>
          <Button 
            className="flex-1" 
            onClick={save} 
            disabled={saving || !name.trim()}
            data-testid="button-create-customer"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? "Creating…" : "Create Customer"}
          </Button>
        </div>
      </div>
    </div>
  );
}